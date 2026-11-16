"""Toolsaku API: optional Google login + connect YouTube / Instagram / Facebook, and the AI Stream Moment Finder.

Runs on the VPS behind nginx at /api/ (systemd unit: server/deploy/toolsaku-api.service).
Every secret comes from the environment file /etc/toolsaku/api.env (chmod 600). Nothing secret lives in the repo.

Stored per user (SQLite): Google id + email + name, sessions (hashed), and connected accounts with their OAuth
tokens encrypted (Fernet, key = TOKEN_KEY in api.env). Videos sent with "Post to ..." are written to a temp file,
uploaded to the platform, and deleted right after.
"""
import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.parse
from contextlib import closing

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse

# ---- Settings (all from the environment) ---------------------------------------------
ENV = os.environ.get
PUBLIC_URL = ENV("PUBLIC_URL", "http://localhost:8000").rstrip("/")
GOOGLE_CLIENT_ID = ENV("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = ENV("GOOGLE_CLIENT_SECRET", "")
META_APP_ID = ENV("META_APP_ID", "")
META_APP_SECRET = ENV("META_APP_SECRET", "")
GRAPH = ENV("META_GRAPH_VERSION", "v21.0")
META_EXTRA_SCOPES = [s for s in ENV("META_EXTRA_SCOPES", "").replace(",", " ").split() if s]
DB_PATH = ENV("DB_PATH", "/var/lib/toolsaku/toolsaku.db")
TMP_DIR = ENV("TMP_DIR", "/var/lib/toolsaku/tmp")
MAX_UPLOAD = int(ENV("MAX_UPLOAD_MB", "200")) * 1024 * 1024
COOKIE_SECURE = PUBLIC_URL.startswith("https://")
SESSION_DAYS = 60
COOKIE = "tsk_sid"
_key = ENV("TOKEN_KEY", "")
FERNET = Fernet(_key.encode()) if _key else None

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke"
YT_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
YT_UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos"
FB_DIALOG = f"https://www.facebook.com/{GRAPH}/dialog/oauth"
GRAPH_URL = f"https://graph.facebook.com/{GRAPH}"
GRAPH_VIDEO = f"https://graph-video.facebook.com/{GRAPH}"
RUPLOAD = f"https://rupload.facebook.com/ig-api-upload/{GRAPH}"
META_SCOPES = {
    "facebook": ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    "instagram": ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
}
PROVIDERS = ("youtube", "instagram", "facebook")

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def http():
    """One place to build the HTTP client, so tests can swap in a fake transport."""
    return httpx.AsyncClient(timeout=httpx.Timeout(60, read=600), follow_redirects=False)


# ---- Storage --------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, google_sub TEXT UNIQUE NOT NULL, email TEXT, name TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS sessions (sid_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, provider TEXT NOT NULL, account_id TEXT NOT NULL, account_name TEXT,
  token_enc TEXT, refresh_enc TEXT, expires_at INTEGER, extra TEXT, created_at INTEGER,
  UNIQUE(user_id, provider, account_id));
CREATE TABLE IF NOT EXISTS deletions (code TEXT PRIMARY KEY, created_at INTEGER);
"""


def db():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c


@app.on_event("startup")
def _init():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)
    with closing(db()) as c, c:
        c.executescript(SCHEMA)
        c.execute("PRAGMA journal_mode=WAL")
    # Remove temp videos left behind by a crash.
    for f in os.listdir(TMP_DIR):
        try: os.remove(os.path.join(TMP_DIR, f))
        except OSError: pass


def enc(s):
    if s is None: return None
    if not FERNET: raise HTTPException(503, "server_not_configured")
    return FERNET.encrypt(s.encode()).decode()


def dec(s):
    if not s: return None
    try: return FERNET.decrypt(s.encode()).decode()
    except (InvalidToken, AttributeError): return None


def now():
    return int(time.time())


# ---- Sessions and safety --------------------------------------------------------------
def _h(sid):
    return hashlib.sha256(sid.encode()).hexdigest()


def current_user(req):
    sid = req.cookies.get(COOKIE)
    if not sid: return None
    with closing(db()) as c:
        r = c.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid_hash=? AND s.expires_at>?", (_h(sid), now())).fetchone()
    return dict(r) if r else None


def need_user(req):
    u = current_user(req)
    if not u: raise HTTPException(401, "login_required")
    return u


def check_post(req):
    """CSRF guard for every state-changing call: same-origin Origin header + a custom header a form cannot send."""
    if req.headers.get("x-toolsaku") != "1": raise HTTPException(403, "bad_request")
    origin = req.headers.get("origin")
    if origin and origin.rstrip("/") != PUBLIC_URL: raise HTTPException(403, "bad_origin")


def set_session(resp, user_id):
    sid = secrets.token_urlsafe(32)
    with closing(db()) as c, c:
        c.execute("INSERT INTO sessions VALUES (?,?,?)", (_h(sid), user_id, now() + SESSION_DAYS * 86400))
        c.execute("DELETE FROM sessions WHERE expires_at<?", (now(),))
    resp.set_cookie(COOKIE, sid, max_age=SESSION_DAYS * 86400, httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")


def safe_back(back):
    """Only ever send people back to a page on this site."""
    if not back or not back.startswith("/") or back.startswith("//") or "\\" in back: return "/"
    return back


def with_q(back, **kw):
    p = urllib.parse.urlsplit(back)
    q = dict(urllib.parse.parse_qsl(p.query))
    q.update({k: v for k, v in kw.items() if v})
    return urllib.parse.urlunsplit(("", "", p.path, urllib.parse.urlencode(q), p.fragment))


def new_state(**data):
    st = secrets.token_urlsafe(24)
    with closing(db()) as c, c:
        c.execute("DELETE FROM oauth_states WHERE created_at<?", (now() - 900,))
        c.execute("INSERT INTO oauth_states VALUES (?,?,?)", (st, json.dumps(data), now()))
    return st


def take_state(st):
    if not st: return None
    with closing(db()) as c, c:
        r = c.execute("SELECT data, created_at FROM oauth_states WHERE state=?", (st,)).fetchone()
        c.execute("DELETE FROM oauth_states WHERE state=?", (st,))
    if not r or r["created_at"] < now() - 900: return None
    return json.loads(r["data"])


def pkce():
    v = secrets.token_urlsafe(48)
    ch = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b"=").decode()
    return v, ch


def save_conn(user_id, provider, account_id, name, token, refresh=None, expires_at=None, extra=None):
    with closing(db()) as c, c:
        c.execute("""INSERT INTO connections (user_id, provider, account_id, account_name, token_enc, refresh_enc, expires_at, extra, created_at)
                     VALUES (?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(user_id, provider, account_id) DO UPDATE SET account_name=excluded.account_name, token_enc=excluded.token_enc,
                     refresh_enc=COALESCE(excluded.refresh_enc, connections.refresh_enc), expires_at=excluded.expires_at, extra=excluded.extra""",
                  (user_id, provider, str(account_id), name, enc(token), enc(refresh), expires_at, json.dumps(extra or {}), now()))


def get_conn(user_id, cid):
    with closing(db()) as c:
        r = c.execute("SELECT * FROM connections WHERE id=? AND user_id=?", (cid, user_id)).fetchone()
    return dict(r) if r else None


# ---- Public info ----------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "google": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET), "meta": bool(META_APP_ID and META_APP_SECRET), "keys": bool(FERNET)}


@app.get("/api/me")
def me(req: Request):
    u = current_user(req)
    cfg = {"google": bool(GOOGLE_CLIENT_ID), "meta": bool(META_APP_ID)}
    if not u: return JSONResponse({"user": None, "connections": [], "config": cfg}, headers={"Cache-Control": "no-store"})
    with closing(db()) as c:
        rows = c.execute("SELECT id, provider, account_name FROM connections WHERE user_id=? ORDER BY provider, id", (u["id"],)).fetchall()
    return JSONResponse({"user": {"email": u["email"], "name": u["name"]},
                         "connections": [{"id": r["id"], "provider": r["provider"], "name": r["account_name"]} for r in rows], "config": cfg},
                        headers={"Cache-Control": "no-store"})


# ---- Google login (+ YouTube) ---------------------------------------------------------
def google_redirect(then, back, login_hint=None):
    if not GOOGLE_CLIENT_ID: return RedirectResponse(with_q(back, account_error="not_configured"), 303)
    scopes = ["openid", "email", "profile"] + ([YT_SCOPE] if then == "youtube" else [])
    v, ch = pkce()
    st = new_state(kind="google", then=then, back=back, verifier=v)
    q = {"client_id": GOOGLE_CLIENT_ID, "redirect_uri": PUBLIC_URL + "/api/auth/google/callback", "response_type": "code",
         "scope": " ".join(scopes), "state": st, "code_challenge": ch, "code_challenge_method": "S256", "prompt": "select_account"}
    if then == "youtube":
        q.update(access_type="offline", prompt="consent select_account", include_granted_scopes="true")
    if login_hint: q["login_hint"] = login_hint
    return RedirectResponse(GOOGLE_AUTH + "?" + urllib.parse.urlencode(q), 303)


@app.get("/api/connect/{provider}")
def connect(provider: str, req: Request, back: str = "/"):
    """The only entry point to login: tapping Connect YouTube / Instagram / Facebook."""
    back = safe_back(back)
    if provider not in PROVIDERS: raise HTTPException(404)
    u = current_user(req)
    if provider == "youtube" or not u:
        return google_redirect(provider, back, u and u["email"])
    return meta_redirect(provider, back, u)


def _id_token_claims(tok):
    # The id_token comes straight from Google's token endpoint over TLS, so (per OpenID Connect) we check its
    # audience, issuer and expiry rather than its signature.
    try:
        p = tok.split(".")[1]
        c = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
    except Exception:
        return None
    if c.get("aud") != GOOGLE_CLIENT_ID or c.get("iss") not in ("https://accounts.google.com", "accounts.google.com") or c.get("exp", 0) < now():
        return None
    return c


@app.get("/api/auth/google/callback")
async def google_cb(req: Request, state: str = "", code: str = "", error: str = ""):
    st = take_state(state)
    if not st or st.get("kind") != "google": return RedirectResponse("/?account_error=expired", 303)
    back = safe_back(st.get("back"))
    if error or not code: return RedirectResponse(with_q(back, account_error="cancelled"), 303)
    async with http() as h:
        r = await h.post(GOOGLE_TOKEN, data={"code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
                                             "redirect_uri": PUBLIC_URL + "/api/auth/google/callback", "grant_type": "authorization_code",
                                             "code_verifier": st["verifier"]})
    if r.status_code != 200: return RedirectResponse(with_q(back, account_error="google_failed"), 303)
    t = r.json()
    claims = _id_token_claims(t.get("id_token", ""))
    if not claims or not claims.get("sub"): return RedirectResponse(with_q(back, account_error="google_failed"), 303)
    then, me_now = st.get("then"), current_user(req)
    if then == "youtube" and me_now:
        uid = me_now["id"]  # already signed in: add this Google account's channel to the current Toolsaku account
    else:
        with closing(db()) as c, c:
            c.execute("INSERT INTO users (google_sub, email, name, created_at) VALUES (?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name",
                      (claims["sub"], claims.get("email"), claims.get("name"), now()))
            uid = c.execute("SELECT id FROM users WHERE google_sub=?", (claims["sub"],)).fetchone()["id"]
    if then == "youtube":
        if YT_SCOPE in (t.get("scope") or "").split():
            # One Google account = one YouTube connection (the upload goes to that account's channel).
            save_conn(uid, "youtube", claims["sub"], claims.get("email") or "YouTube", t.get("access_token"), t.get("refresh_token"),
                      now() + int(t.get("expires_in", 3600)) - 60)
            dest = with_q(back, connected="youtube")
        else:
            dest = with_q(back, account_error="youtube_not_allowed")
    elif then in ("instagram", "facebook"):
        dest = "/api/connect/" + then + "?" + urllib.parse.urlencode({"back": back})
    else:
        dest = back
    resp = RedirectResponse(dest, 303)
    if not me_now or me_now["id"] != uid: set_session(resp, uid)
    return resp


async def yt_access_token(conn):
    if conn["expires_at"] and conn["expires_at"] > now() + 30:
        tok = dec(conn["token_enc"])
        if tok: return tok
    refresh = dec(conn["refresh_enc"])
    if not refresh: raise HTTPException(409, "reconnect_youtube")
    async with http() as h:
        r = await h.post(GOOGLE_TOKEN, data={"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "refresh_token": refresh, "grant_type": "refresh_token"})
    if r.status_code != 200: raise HTTPException(409, "reconnect_youtube")
    t = r.json()
    with closing(db()) as c, c:
        c.execute("UPDATE connections SET token_enc=?, expires_at=? WHERE id=?", (enc(t["access_token"]), now() + int(t.get("expires_in", 3600)) - 60, conn["id"]))
    return t["access_token"]


# ---- Meta (Instagram + Facebook Pages) ------------------------------------------------
def meta_redirect(provider, back, u):
    if not META_APP_ID: return RedirectResponse(with_q(back, account_error="not_configured"), 303)
    st = new_state(kind="meta", provider=provider, back=back, user_id=u["id"])
    q = {"client_id": META_APP_ID, "redirect_uri": PUBLIC_URL + "/api/connect/meta/callback", "state": st, "response_type": "code",
         "scope": ",".join(META_SCOPES[provider] + META_EXTRA_SCOPES)}
    return RedirectResponse(FB_DIALOG + "?" + urllib.parse.urlencode(q), 303)


@app.get("/api/connect/meta/callback")
async def meta_cb(req: Request, state: str = "", code: str = "", error: str = ""):
    st = take_state(state)
    u = current_user(req)
    if not st or st.get("kind") != "meta" or not u or u["id"] != st.get("user_id"): return RedirectResponse("/?account_error=expired", 303)
    back, provider = safe_back(st.get("back")), st["provider"]
    if error or not code: return RedirectResponse(with_q(back, account_error="cancelled"), 303)
    async with http() as h:
        r = await h.get(GRAPH_URL + "/oauth/access_token", params={"client_id": META_APP_ID, "client_secret": META_APP_SECRET,
                                                                   "redirect_uri": PUBLIC_URL + "/api/connect/meta/callback", "code": code})
        if r.status_code != 200: return RedirectResponse(with_q(back, account_error="meta_failed"), 303)
        short = r.json()["access_token"]
        # Long-lived user token (~60 days); Page tokens taken from it do not expire.
        r = await h.get(GRAPH_URL + "/oauth/access_token", params={"grant_type": "fb_exchange_token", "client_id": META_APP_ID,
                                                                   "client_secret": META_APP_SECRET, "fb_exchange_token": short})
        user_tok = r.json().get("access_token", short) if r.status_code == 200 else short
        r = await h.get(GRAPH_URL + "/me", params={"fields": "id", "access_token": user_tok})
        meta_uid = r.json().get("id") if r.status_code == 200 else None
        r = await h.get(GRAPH_URL + "/me/accounts", params={"fields": "id,name,access_token,instagram_business_account{id,username}",
                                                            "limit": 100, "access_token": user_tok})
    if r.status_code != 200: return RedirectResponse(with_q(back, account_error="meta_failed"), 303)
    pages = r.json().get("data", [])
    n = 0
    for p in pages:
        extra = {"meta_user_id": meta_uid, "page_id": p["id"], "page_name": p.get("name")}
        if provider == "facebook":
            save_conn(u["id"], "facebook", p["id"], p.get("name") or "Facebook Page", p["access_token"], user_tok, None, extra)
            n += 1
        elif p.get("instagram_business_account"):
            ig = p["instagram_business_account"]
            save_conn(u["id"], "instagram", ig["id"], "@" + ig["username"] if ig.get("username") else "Instagram", p["access_token"], user_tok, None, extra)
            n += 1
    if not n:
        return RedirectResponse(with_q(back, account_error="no_pages" if provider == "facebook" or not pages else "no_instagram"), 303)
    return RedirectResponse(with_q(back, connected=provider), 303)


def _parse_signed_request(sr):
    try:
        sig, payload = sr.split(".", 1)
        pad = lambda s: s + "=" * (-len(s) % 4)
        want = hmac.new(META_APP_SECRET.encode(), payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(base64.urlsafe_b64decode(pad(sig)), want): return None
        return json.loads(base64.urlsafe_b64decode(pad(payload)))
    except Exception:
        return None


@app.post("/api/meta/data-deletion")
async def meta_data_deletion(signed_request: str = Form("")):
    """Meta's Data Deletion Callback: someone removed Toolsaku from their Facebook settings."""
    data = _parse_signed_request(signed_request)
    if not data or not data.get("user_id"): raise HTTPException(400, "bad_signed_request")
    with closing(db()) as c, c:
        rows = c.execute("SELECT id, extra FROM connections WHERE provider IN ('instagram','facebook')").fetchall()
        ids = [r["id"] for r in rows if json.loads(r["extra"] or "{}").get("meta_user_id") == str(data["user_id"])]
        c.executemany("DELETE FROM connections WHERE id=?", [(i,) for i in ids])
        code = secrets.token_hex(8)
        c.execute("INSERT INTO deletions VALUES (?,?)", (code, now()))
    return {"url": PUBLIC_URL + "/api/meta/deletion-status?code=" + code, "confirmation_code": code}


@app.get("/api/meta/deletion-status")
def meta_deletion_status(code: str = ""):
    with closing(db()) as c:
        r = c.execute("SELECT created_at FROM deletions WHERE code=?", (code,)).fetchone()
    if not r: raise HTTPException(404, "unknown_code")
    return {"status": "deleted", "code": code, "deleted_at": r["created_at"]}


# ---- Disconnect, logout, delete -------------------------------------------------------
async def revoke(conn, last_meta):
    try:
        async with http() as h:
            if conn["provider"] == "youtube":
                tok = dec(conn["refresh_enc"]) or dec(conn["token_enc"])
                if tok: await h.post(GOOGLE_REVOKE, data={"token": tok})
            elif last_meta:
                tok, meta_uid = dec(conn["refresh_enc"]), json.loads(conn["extra"] or "{}").get("meta_user_id")
                if tok and meta_uid: await h.delete(f"{GRAPH_URL}/{meta_uid}/permissions", params={"access_token": tok})
    except httpx.HTTPError:
        pass  # the row is deleted either way; the token can no longer be used by us


@app.post("/api/connections/{cid}/disconnect")
async def disconnect(cid: int, req: Request):
    check_post(req); u = need_user(req)
    conn = get_conn(u["id"], cid)
    if not conn: raise HTTPException(404)
    with closing(db()) as c, c:
        c.execute("DELETE FROM connections WHERE id=?", (cid,))
        left = c.execute("SELECT COUNT(*) FROM connections WHERE user_id=? AND provider IN ('instagram','facebook')", (u["id"],)).fetchone()[0]
    await revoke(conn, conn["provider"] != "youtube" and left == 0)
    return {"ok": True}


@app.post("/api/logout")
def logout(req: Request):
    check_post(req)
    sid = req.cookies.get(COOKIE)
    if sid:
        with closing(db()) as c, c: c.execute("DELETE FROM sessions WHERE sid_hash=?", (_h(sid),))
    r = JSONResponse({"ok": True}); r.delete_cookie(COOKIE, path="/")
    return r


@app.post("/api/account/delete")
async def delete_account(req: Request):
    check_post(req); u = need_user(req)
    with closing(db()) as c:
        conns = [dict(r) for r in c.execute("SELECT * FROM connections WHERE user_id=?", (u["id"],)).fetchall()]
    meta_done = False
    for conn in conns:
        last = conn["provider"] != "youtube" and not meta_done
        await revoke(conn, last)
        meta_done = meta_done or last
    with closing(db()) as c, c:
        c.execute("DELETE FROM connections WHERE user_id=?", (u["id"],))
        c.execute("DELETE FROM sessions WHERE user_id=?", (u["id"],))
        c.execute("DELETE FROM users WHERE id=?", (u["id"],))
    r = JSONResponse({"ok": True}); r.delete_cookie(COOKIE, path="/")
    return r


# ---- Posting (background jobs, polled by the page) ------------------------------------
JOBS = {}          # job id -> {"user": id, "status": "working|done|error", "step": str, "url": str, "error": str, "at": ts}
RUNNING = {}       # user id -> number of running jobs


class PostError(Exception):
    pass


def _err(r):
    try:
        j = r.json(); e = j.get("error") or {}
        return (e.get("message") if isinstance(e, dict) else str(e)) or r.text[:300]
    except Exception:
        return r.text[:300]


async def post_youtube(job, conn, path, size, ctype, f):
    tok = await yt_access_token(conn)
    title = (f.get("title") or "Short").strip()[:100]
    meta = {"snippet": {"title": title, "description": (f.get("description") or "")[:4900], "categoryId": "22",
                        "tags": [t.strip().lstrip("#") for t in (f.get("tags") or "").replace(",", " ").split() if t.strip()][:30]},
            "status": {"privacyStatus": f.get("privacy") if f.get("privacy") in ("private", "unlisted", "public") else "private",
                       "selfDeclaredMadeForKids": False}}
    async with http() as h:
        job["step"] = "uploading"
        r = await h.post(YT_UPLOAD, params={"uploadType": "resumable", "part": "snippet,status"}, json=meta,
                         headers={"Authorization": "Bearer " + tok, "X-Upload-Content-Type": ctype, "X-Upload-Content-Length": str(size)})
        if r.status_code != 200 or "location" not in r.headers: raise PostError(_err(r))
        with open(path, "rb") as fh:
            r = await h.put(r.headers["location"], content=fh.read(), headers={"Content-Type": ctype})
        if r.status_code not in (200, 201): raise PostError(_err(r))
        vid = r.json()["id"]
    return "https://www.youtube.com/shorts/" + vid


async def post_instagram(job, conn, path, size, ctype, f):
    tok, ig = dec(conn["token_enc"]), conn["account_id"]
    async with http() as h:
        job["step"] = "uploading"
        r = await h.post(f"{GRAPH_URL}/{ig}/media", data={"media_type": "REELS", "upload_type": "resumable", "share_to_feed": "true",
                                                          "caption": (f.get("caption") or "")[:2200], "access_token": tok})
        if r.status_code != 200: raise PostError(_err(r))
        cid = r.json()["id"]
        up = r.json().get("uri") or f"{RUPLOAD}/{cid}"
        with open(path, "rb") as fh:
            r = await h.post(up, content=fh.read(), headers={"Authorization": "OAuth " + tok, "offset": "0", "file_size": str(size)})
        if r.status_code != 200: raise PostError(_err(r))
        job["step"] = "processing"
        for _ in range(60):  # Instagram processes the video before it can be published (up to ~5 minutes)
            await asyncio.sleep(5)
            r = await h.get(f"{GRAPH_URL}/{cid}", params={"fields": "status_code,status", "access_token": tok})
            sc = r.json().get("status_code") if r.status_code == 200 else None
            if sc == "FINISHED": break
            if sc in ("ERROR", "EXPIRED"): raise PostError(r.json().get("status") or sc)
        else:
            raise PostError("Instagram is still processing the video. Try again in a few minutes.")
        job["step"] = "publishing"
        r = await h.post(f"{GRAPH_URL}/{ig}/media_publish", data={"creation_id": cid, "access_token": tok})
        if r.status_code != 200: raise PostError(_err(r))
        mid = r.json()["id"]
        r = await h.get(f"{GRAPH_URL}/{mid}", params={"fields": "permalink", "access_token": tok})
    return (r.json().get("permalink") if r.status_code == 200 else None) or "https://www.instagram.com/"


async def post_facebook(job, conn, path, size, ctype, f):
    tok, page = dec(conn["token_enc"]), conn["account_id"]
    async with http() as h:
        job["step"] = "uploading"
        with open(path, "rb") as fh:
            r = await h.post(f"{GRAPH_VIDEO}/{page}/videos", data={"title": (f.get("title") or "")[:250], "description": (f.get("description") or "")[:5000],
                                                                  "access_token": tok}, files={"source": ("clip." + ("mp4" if "mp4" in ctype else "webm"), fh, ctype)})
    if r.status_code != 200: raise PostError(_err(r))
    return "https://www.facebook.com/" + str(r.json().get("id"))


POSTERS = {"youtube": post_youtube, "instagram": post_instagram, "facebook": post_facebook}


async def run_job(jid, conn, path, size, ctype, fields):
    job = JOBS[jid]
    try:
        job["url"] = await POSTERS[conn["provider"]](job, conn, path, size, ctype, fields)
        job["status"] = "done"
    except HTTPException as e:
        job["status"], job["error"] = "error", e.detail
    except PostError as e:
        job["status"], job["error"] = "error", str(e)[:300]
    except Exception as e:  # network failure or unexpected answer
        job["status"], job["error"] = "error", "failed: " + type(e).__name__
    finally:
        RUNNING[job["user"]] = max(0, RUNNING.get(job["user"], 1) - 1)
        try: os.remove(path)
        except OSError: pass


@app.post("/api/post/{provider}")
async def post(provider: str, req: Request, connection_id: int = Form(...), file: UploadFile = File(...),
               title: str = Form(""), description: str = Form(""), tags: str = Form(""), caption: str = Form(""), privacy: str = Form("private")):
    check_post(req); u = need_user(req)
    conn = get_conn(u["id"], connection_id)
    if not conn or conn["provider"] != provider: raise HTTPException(404, "not_connected")
    if RUNNING.get(u["id"], 0) >= 2: raise HTTPException(429, "busy")
    ctype = (file.content_type or "video/mp4").split(";")[0]
    if not ctype.startswith("video/"): raise HTTPException(415, "not_video")
    if provider == "instagram" and ctype != "video/mp4": raise HTTPException(415, "instagram_needs_mp4")
    path = os.path.join(TMP_DIR, secrets.token_hex(12))
    size = 0
    with open(path, "wb") as out:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk: break
            size += len(chunk)
            if size > MAX_UPLOAD:
                out.close(); os.remove(path); raise HTTPException(413, "too_big")
            out.write(chunk)
    if not size:
        os.remove(path); raise HTTPException(400, "empty")
    for k in [k for k, j in JOBS.items() if j["at"] < now() - 3600]: JOBS.pop(k, None)
    jid = secrets.token_urlsafe(12)
    JOBS[jid] = {"user": u["id"], "status": "working", "step": "queued", "url": None, "error": None, "at": now()}
    RUNNING[u["id"]] = RUNNING.get(u["id"], 0) + 1
    asyncio.create_task(run_job(jid, conn, path, size, ctype,
                                {"title": title, "description": description, "tags": tags, "caption": caption, "privacy": privacy}))
    return {"job": jid}


@app.get("/api/post/status/{jid}")
def post_status(jid: str, req: Request):
    u = need_user(req)
    j = JOBS.get(jid)
    if not j or j["user"] != u["id"]: raise HTTPException(404)
    return JSONResponse({k: j[k] for k in ("status", "step", "url", "error")}, headers={"Cache-Control": "no-store"})


# ---- AI Stream Moment Finder ----------------------------------------------------------
# POST /api/stream-moments {url, count}. The video itself is NEVER downloaded: we read the public watch page
# (title, channel, length, the "Most replayed" heatmap), the caption track and a capped sample of the live-chat
# replay, turn them into a compact 30-second signal table and let Gemini pick the clip-worthy moments.
GEMINI_API_KEY = ENV("GEMINI_API_KEY", "")
GEMINI_MODEL = ENV("GEMINI_MODEL", "gemini-3.8-flash") or "gemini-3.8-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
YT_WATCH = "https://www.youtube.com/watch"
YT_CHAT = "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay"
YT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+001; SOCS=CAI",
}
SM_BUCKET = 30                 # seconds per signal bucket
SM_CHAT_MAX_REQ = 150          # hard cap on live-chat replay requests per video
SM_CHAT_MAX_SEC = 25.0         # hard cap on time spent reading chat
SM_CHAT_PARALLEL = 6
SM_PROMPT_CHARS = 120_000      # ~70-95k tokens even for Hinglish: well under the ~200k we allow ourselves
SM_RATE = (5, 600)             # 5 fresh analyses per IP per 10 minutes
SM_CACHE_TTL = 1800
SM_CACHE, SM_SIGNALS, SM_HITS = {}, {}, {}
SM_SEM = asyncio.Semaphore(3)  # at most 3 analyses at once on the VPS
MSG_BLOCKED = "YouTube is rate-limiting the server, try again in a few minutes."
KW_RE = re.compile(r"(?<![a-z])(l+o+l+|lmao+|kekw|omegalul|pog+(?:gers)?|w+|gg+|op|omg|wtf|clip(?: it| that| this)?|bhai|bro+|insane|crazy|haha+|hehe+)(?![a-z])", re.I)
EMOJI_RE = re.compile("[\U0001F602\U0001F923\U0001F525\U0001F480\U0001F631\U0001F633\U0001F92F\U0001F44F\U0001F3C6\u2764]")


class SMError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg); self.status, self.msg = status, msg


def yt_video_id(s):
    s = str(s or "").strip()
    if re.fullmatch(r"[\w-]{11}", s): return s
    if not re.match(r"^https?://", s, re.I): s = "https://" + s
    try: u = urllib.parse.urlsplit(s)
    except ValueError: return ""
    h = (u.hostname or "").lower()
    h = re.sub(r"^(www|m|music)\.", "", h)
    vid = ""
    if h == "youtu.be": vid = u.path.split("/")[1] if len(u.path) > 1 else ""
    elif h in ("youtube.com", "youtube-nocookie.com"):
        vid = (urllib.parse.parse_qs(u.query).get("v") or [""])[0]
        if not vid:
            m = re.match(r"^/(?:shorts|embed|live|v)/([^/?#]+)", u.path)
            vid = m.group(1) if m else ""
    return vid if re.fullmatch(r"[\w-]{11}", vid or "") else ""


def hms(sec):
    sec = int(max(0, sec)); h, r = divmod(sec, 3600); m, s = divmod(r, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _json_after(text, marker):
    """Decode the JSON object that follows `marker` (e.g. 'ytInitialData = '), trying every occurrence."""
    dec_ = json.JSONDecoder()
    for m in re.finditer(re.escape(marker), text):
        i = m.end()
        while i < len(text) and text[i] in " \t\r\n=": i += 1
        if i < len(text) and text[i] == "{":
            try: return dec_.raw_decode(text, i)[0]
            except ValueError: continue
    return None


def _walk(o):
    stack = [o]
    while stack:
        x = stack.pop()
        if isinstance(x, dict):
            yield x; stack.extend(x.values())
        elif isinstance(x, list):
            stack.extend(x)


def parse_watch_page(html_text):
    player = _json_after(html_text, "ytInitialPlayerResponse") or {}
    data = _json_after(html_text, "ytInitialData") or {}
    m = re.search(r'"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"', html_text)
    ctx = _json_after(html_text, '"INNERTUBE_CONTEXT":')
    return player, data, (m.group(1) if m else ""), ctx


def parse_meta(player, vid):
    vd = player.get("videoDetails") or {}
    mf = (player.get("microformat") or {}).get("playerMicroformatRenderer") or {}
    dur = int(vd.get("lengthSeconds") or mf.get("lengthSeconds") or 0)
    return {"id": vid, "title": vd.get("title") or "", "channel": vd.get("author") or mf.get("ownerChannelName") or "",
            "duration_sec": dur, "is_live_now": bool(vd.get("isLive")), "is_upcoming": bool(vd.get("isUpcoming")),
            "was_live": bool(vd.get("isLiveContent")), "url": "https://www.youtube.com/watch?v=" + vid,
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"}


def check_playable(player):
    ps = player.get("playabilityStatus") or {}
    st, reason = ps.get("status") or "", " ".join(str(ps.get(k) or "") for k in ("reason", "messages")).lower()
    if not player: raise SMError(429, MSG_BLOCKED)
    if st in ("OK", "LIVE_STREAM_OFFLINE", ""): return
    if "bot" in reason or "unusual traffic" in reason: raise SMError(429, MSG_BLOCKED)
    if "private" in reason: raise SMError(403, "This video is private. Only public streams and videos can be analysed.")
    if "members" in reason or "join this channel" in reason: raise SMError(403, "This stream is for channel members only, so it can't be analysed.")
    if st == "LOGIN_REQUIRED": raise SMError(403, "YouTube needs a sign-in for this video (private or age-restricted), so it can't be analysed.")
    raise SMError(404, "This video is unavailable. Check the link.")


def parse_heatmap(data):
    """Most-replayed markers -> [(start_sec, dur_sec, intensity 0..1)]. Handles both YouTube layouts."""
    out = {}
    for d in _walk(data):
        if "intensityScoreNormalized" in d and "startMillis" in d:  # frameworkUpdates ... macroMarkersListEntity.markersList.markers
            s, du, v = d.get("startMillis"), d.get("durationMillis"), d.get("intensityScoreNormalized")
        elif "heatMarkerIntensityScoreNormalized" in d:  # playerOverlays ... markersMap ... heatMarkerRenderer
            s, du, v = d.get("timeRangeStartMillis"), d.get("markerDurationMillis"), d.get("heatMarkerIntensityScoreNormalized")
        else:
            continue
        try: out[int(s) / 1000] = (int(s) / 1000, int(du or 0) / 1000, float(v))
        except (TypeError, ValueError): pass
    return sorted(out.values())


def pick_caption_track(player):
    tracks = ((player.get("captions") or {}).get("playerCaptionsTracklistRenderer") or {}).get("captionTracks") or []
    def rank(t):
        lang, asr = (t.get("languageCode") or "").split("-")[0], t.get("kind") == "asr"
        return ({"en": 0, "hi": 1}.get(lang, 2), asr)
    tracks = [t for t in tracks if t.get("baseUrl")]
    return min(tracks, key=rank) if tracks else None


def parse_json3(j):
    """YouTube timedtext fmt=json3 -> [(start_sec, text)]."""
    out = []
    for ev in (j or {}).get("events") or []:
        segs = ev.get("segs")
        if not segs: continue
        txt = re.sub(r"\s+", " ", "".join(s.get("utf8", "") for s in segs)).strip()
        if txt: out.append((int(ev.get("tStartMs") or 0) / 1000, txt))
    return out


def parse_timedtext_xml(text):
    """srv1 (<text start=..>) or srv3 (<p t=ms>) caption XML -> [(start_sec, text)]."""
    import html as _html
    out = []
    for m in re.finditer(r'<text[^>]*\bstart="([\d.]+)"[^>]*>(.*?)</text>', text or "", re.S):
        t = re.sub(r"<[^>]+>", "", _html.unescape(_html.unescape(m.group(2))))
        t = re.sub(r"\s+", " ", t).strip()
        if t: out.append((float(m.group(1)), t))
    if not out:
        for m in re.finditer(r'<p[^>]*\bt="(\d+)"[^>]*>(.*?)</p>', text or "", re.S):
            t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", _html.unescape(m.group(2)))).strip()
            if t: out.append((int(m.group(1)) / 1000, t))
    return out


ANDROID_CTX = {"client": {"clientName": "ANDROID", "clientVersion": "20.10.38", "androidSdkVersion": 34, "hl": "en", "gl": "IN"}}
ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"


async def fetch_captions(h, vid, player, api_key, dbg):
    """Try the web caption URL, then the Android player's caption URL (no PO token needed). -> (transcript, lang)."""
    async def grab(url, ua=None):
        hdr = dict(YT_HEADERS); 
        if ua: hdr["User-Agent"] = ua
        base = re.sub(r"&fmt=[^&]*", "", url)
        for fmt in ("json3", None):
            r = await h.get(base + (f"&fmt={fmt}" if fmt else ""), headers=hdr)
            dbg.setdefault("cap_tries", []).append([fmt or "xml", r.status_code, len(r.content)])
            if r.status_code != 200 or not r.content.strip(): continue
            try: tr = parse_json3(r.json()) if fmt == "json3" else parse_timedtext_xml(r.text)
            except ValueError: tr = []
            if tr: return tr
        return []
    tr = pick_caption_track(player)
    dbg["cap_tracks_web"] = len(((player.get("captions") or {}).get("playerCaptionsTracklistRenderer") or {}).get("captionTracks") or [])
    try:
        if tr:
            got = await grab(tr["baseUrl"])
            if got: return got, tr.get("languageCode")
        r = await h.post("https://www.youtube.com/youtubei/v1/player", params={"key": api_key or "", "prettyPrint": "false"},
                         headers={"User-Agent": ANDROID_UA, "Content-Type": "application/json"},
                         json={"context": ANDROID_CTX, "videoId": vid, "contentCheckOk": True, "racyCheckOk": True})
        dbg["android_player"] = r.status_code
        if r.status_code == 200:
            ap = r.json()
            dbg["cap_tracks_android"] = len(((ap.get("captions") or {}).get("playerCaptionsTracklistRenderer") or {}).get("captionTracks") or [])
            tr2 = pick_caption_track(ap)
            if tr2:
                got = await grab(tr2["baseUrl"], ANDROID_UA)
                if got: return got, tr2.get("languageCode")
    except (httpx.HTTPError, ValueError, KeyError) as e:
        dbg["cap_error"] = type(e).__name__ + ": " + str(e)[:120]
    return [], None


def chat_continuation(data):
    for d in _walk(data):
        lc = d.get("liveChatRenderer")
        if isinstance(lc, dict):
            for c in lc.get("continuations") or []:
                for v in c.values():
                    if isinstance(v, dict) and v.get("continuation"): return v["continuation"]
    return None


def _runs_text(msg):
    parts = []
    for r in (msg or {}).get("runs") or []:
        if "text" in r: parts.append(r["text"])
        elif "emoji" in r:
            e_ = r["emoji"]
            parts.append(e_.get("emojiId") if not e_.get("isCustomEmoji") and len(e_.get("emojiId") or "") <= 4
                         else ((e_.get("shortcuts") or [""])[0]))
    return "".join(parts).strip()


def parse_chat_page(j):
    """One get_live_chat_replay answer -> ([(offset_sec, id, text, paid)], next_continuation)."""
    lcc = ((j or {}).get("continuationContents") or {}).get("liveChatContinuation") or {}
    msgs = []
    for a in lcc.get("actions") or []:
        rp = a.get("replayChatItemAction") or {}
        try: off = int(rp.get("videoOffsetTimeMsec")) / 1000
        except (TypeError, ValueError): continue
        for sub in rp.get("actions") or []:
            item = (sub.get("addChatItemAction") or {}).get("item") or {}
            for kind in ("liveChatTextMessageRenderer", "liveChatPaidMessageRenderer"):
                r = item.get(kind)
                if r: msgs.append((off, r.get("id") or "", _runs_text(r.get("message")), kind != "liveChatTextMessageRenderer"))
    nxt = None
    for c in lcc.get("continuations") or []:
        v = c.get("liveChatReplayContinuationData")
        if v and v.get("continuation"): nxt = v["continuation"]; break
    return msgs, nxt


def hype_words(text):
    return len(KW_RE.findall(text or "")) + len(EMOJI_RE.findall(text or ""))


async def fetch_chat(h, cont, api_key, ctx, duration, dbg=None):
    dbg = {} if dbg is None else dbg
    """Sample the chat replay across the whole stream within SM_CHAT_MAX_REQ requests / SM_CHAT_MAX_SEC seconds.
    Returns ({bucket: {"n", "kw", "samples"}}, covered_bucket_set, total_messages)."""
    if not cont or not api_key or not ctx: return {}, set(), 0
    hdr = {**YT_HEADERS, "Content-Type": "application/json", "Origin": "https://www.youtube.com", "X-YouTube-Client-Name": "1",
           "X-YouTube-Client-Version": ((ctx.get("client") or {}).get("clientVersion") or "2.20241101.00.00")}
    state = {"req": 0, "seek_broken": False}
    seen, buckets, covered = set(), {}, set()

    async def page(c, offset_ms):
        if state["req"] >= SM_CHAT_MAX_REQ: return None
        state["req"] += 1
        r = await h.post(YT_CHAT, params={"key": api_key, "prettyPrint": "false"}, headers=hdr,
                         json={"context": ctx, "continuation": c, "currentPlayerState": {"playerOffsetMs": str(int(offset_ms))}})
        if r.status_code == 429: raise SMError(429, MSG_BLOCKED)
        if r.status_code != 200:
            dbg.setdefault("chat_bad", []).append(r.status_code) if len(dbg.get("chat_bad", [])) < 5 else None
            return None
        res = parse_chat_page(r.json())
        if "chat_first" not in dbg: dbg["chat_first"] = [len(res[0]), bool(res[1])]
        return res

    def add(msgs):
        offs = []
        for off, mid, txt, paid in msgs:
            offs.append(off)
            key = mid or f"{off}:{txt}"
            if key in seen: continue
            seen.add(key)
            b = buckets.setdefault(int(off // SM_BUCKET), {"n": 0, "kw": 0, "samples": []})
            b["n"] += 1; k = hype_words(txt) + (2 if paid else 0); b["kw"] += k
            if txt and len(b["samples"]) < 4 and (k or len(b["samples"]) < 2): b["samples"].append(txt[:60])
        if offs:
            covered.update(range(int(min(offs) // SM_BUCKET), int(max(offs) // SM_BUCKET) + 1))
        return offs

    async def segment(start, end, budget, c=None):
        c, off, last = c or cont, start * 1000, None
        for _ in range(budget):
            res = await page(c, off)
            if not res: return None
            msgs, nxt = res
            offs = add(msgs)
            if offs:
                if last is None and start > 90 and min(offs) < start - 120:  # this endpoint ignored our seek
                    state["seek_broken"] = True; return None
                last = max(offs); off = last * 1000
            if not nxt: return None
            c = nxt
            if last is not None and last >= end: break
        return (c, off)  # where this segment stopped, so reading can carry on from here

    n_seg = max(1, min(40, (duration or 0) // 300))
    seg_len = (duration or 0) / n_seg if duration else 10 ** 9
    per = max(2, SM_CHAT_MAX_REQ // n_seg)
    sem = asyncio.Semaphore(SM_CHAT_PARALLEL)

    async def run_seg(i):
        async with sem:
            if state["seek_broken"] and i: return None
            return await segment(i * seg_len, (i + 1) * seg_len, per)

    tasks = [asyncio.ensure_future(run_seg(i)) for i in range(n_seg)]
    t0 = time.monotonic()
    done, pending = await asyncio.wait(tasks, timeout=SM_CHAT_MAX_SEC)
    for t in pending: t.cancel()
    errs = [t.exception() for t in done if not t.cancelled() and t.exception()]
    if errs and isinstance(errs[0], SMError) and not buckets: raise errs[0]
    # Seeking not supported: read straight on from where the first segment stopped, with what is left of the budget.
    if state["seek_broken"] and tasks[0] in done and not tasks[0].exception() and tasks[0].result():
        c, off = tasks[0].result()
        left = SM_CHAT_MAX_SEC - (time.monotonic() - t0)
        if left > 1:
            try: await asyncio.wait_for(segment(off / 1000, 10 ** 9, SM_CHAT_MAX_REQ, c), left)
            except (asyncio.TimeoutError, SMError, httpx.HTTPError): pass
    dbg["chat_req"] = state["req"]; dbg["seek_broken"] = state["seek_broken"]
    return buckets, covered, len(seen)


async def gather_signals(vid):
    hit = SM_SIGNALS.get(vid)
    if hit and hit["at"] > time.time() - SM_CACHE_TTL: return hit["v"]
    async with http() as h:
        try:
            r = await h.get(YT_WATCH, params={"v": vid, "hl": "en", "gl": "IN", "has_verified": "1", "bpctr": "9999999999"}, headers=YT_HEADERS)
        except httpx.HTTPError:
            raise SMError(502, "Couldn't reach YouTube from the server. Try again in a minute.")
        loc = r.headers.get("location", "")
        if r.status_code == 429 or "google.com/sorry" in loc or "consent." in loc: raise SMError(429, MSG_BLOCKED)
        if r.status_code == 404: raise SMError(404, "This video is unavailable. Check the link.")
        if r.status_code != 200: raise SMError(502, f"YouTube answered with an error ({r.status_code}). Try again in a minute.")
        player, data, api_key, ctx = parse_watch_page(r.text)
        check_playable(player)
        meta = parse_meta(player, vid)
        if meta["is_live_now"] or meta["is_upcoming"]:
            raise SMError(409, "This stream is still live or hasn't started. Try again after it ends and YouTube has processed the replay (usually a few hours).")
        heat = parse_heatmap(data)
        dbg = {"has_api_key": bool(api_key), "has_ctx": bool(ctx), "playability": (player.get("playabilityStatus") or {}).get("status")}
        transcript, cap_lang = await fetch_captions(h, vid, player, api_key, dbg)
        chat, covered, n_msgs = {}, set(), 0
        cont = chat_continuation(data)
        dbg["chat_cont"] = bool(cont)
        if cont:
            try: chat, covered, n_msgs = await fetch_chat(h, cont, api_key, ctx, meta["duration_sec"], dbg)
            except (httpx.HTTPError, ValueError, SMError) as e:  # chat is a bonus; never fail the whole request on it
                dbg["chat_error"] = type(e).__name__ + ": " + str(e)[:120]
    if not meta["duration_sec"]:
        meta["duration_sec"] = int(max([t for t, _ in transcript] + [s + d for s, d, _ in heat] + [b * SM_BUCKET + SM_BUCKET for b in chat] + [0]))
    sig = {"meta": meta, "heat": heat, "transcript": transcript, "caption_lang": cap_lang, "chat": chat, "covered": covered, "chat_messages": n_msgs, "debug": dbg}
    SM_SIGNALS[vid] = {"at": time.time(), "v": sig}
    _trim_cache(SM_SIGNALS)
    return sig


def _trim_cache(c, keep=200):
    if len(c) > keep:
        for k in sorted(c, key=lambda k: c[k]["at"])[: len(c) - keep]: c.pop(k, None)


def build_table(sig):
    """One row per 30 s bucket: chat count (None = not sampled), heatmap 0..1, transcript text, chat samples, hype score."""
    dur = sig["meta"]["duration_sec"]
    n = max(1, int(dur // SM_BUCKET) + 1)
    rows = [{"b": i, "t": i * SM_BUCKET, "chat": (0 if i in sig["covered"] else None), "kw": 0, "heat": None, "text": "", "samples": []} for i in range(n)]
    for i, b in sig["chat"].items():
        if 0 <= i < n: rows[i].update(chat=b["n"], kw=b["kw"], samples=b["samples"])
    for s, d, v in sig["heat"]:
        for i in range(int(s // SM_BUCKET), int((s + max(d, 1) - 0.001) // SM_BUCKET) + 1):
            if 0 <= i < n: rows[i]["heat"] = max(rows[i]["heat"] or 0, v)
    for t, txt in sig["transcript"]:
        i = int(t // SM_BUCKET)
        if 0 <= i < n: rows[i]["text"] = (rows[i]["text"] + " " + txt).strip()
    rates = sorted(r["chat"] for r in rows if r["chat"])
    med = rates[len(rates) // 2] if rates else 0
    for r in rows:
        c = (min(r["chat"] / med, 6) / 6) if (med and r["chat"]) else 0
        k = min((r["kw"] / max(r["chat"] or 1, 1)), 1) if r["chat"] else 0
        r["rel"] = round(r["chat"] / med, 1) if (med and r["chat"] is not None) else None
        r["score"] = 0.5 * c + 0.35 * (r["heat"] or 0) + 0.15 * k
    return rows


def table_text(rows, max_chars=SM_PROMPT_CHARS):
    """Compact text table; merges buckets and trims transcript text so the prompt stays small."""
    group = 1
    while len(rows) / group > 1500: group += 1
    merged = []
    for i in range(0, len(rows), group):
        g = rows[i:i + group]
        chats = [r["chat"] for r in g if r["chat"] is not None]
        heats = [r["heat"] for r in g if r["heat"] is not None]
        rels = [r["rel"] for r in g if r["rel"] is not None]
        merged.append({"t": g[0]["t"], "chat": sum(chats) if chats else None, "rel": max(rels) if rels else None,
                       "heat": max(heats) if heats else None, "text": " ".join(r["text"] for r in g).strip(),
                       "samples": [s for r in g for s in r["samples"]][:3], "score": max(r["score"] for r in g)})
    top = set(sorted(range(len(merged)), key=lambda i: -merged[i]["score"])[:200])
    text_budget = max(40, (max_chars - 70 * len(merged)) // max(1, len(merged) + len(top)))
    lines = []
    for i, r in enumerate(merged):
        chat = "-" if r["chat"] is None else f'{r["chat"]}(x{r["rel"]})'
        heat = "-" if r["heat"] is None else f'{r["heat"]:.2f}'
        txt = r["text"][: text_budget * (2 if i in top else 1)].replace("|", "/")
        smp = (" || chat: " + " / ".join(s.replace("|", "/") for s in r["samples"])) if (i in top and r["samples"]) else ""
        lines.append(f'{hms(r["t"])}|{chat}|{heat}|{txt}{smp}')
    return "\n".join(lines), group * SM_BUCKET


MOMENT_SCHEMA = {
    "type": "OBJECT",
    "properties": {"moments": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
        "start_sec": {"type": "INTEGER"}, "end_sec": {"type": "INTEGER"}, "title": {"type": "STRING"}, "hook": {"type": "STRING"},
        "why": {"type": "STRING"}, "score": {"type": "INTEGER"}},
        "required": ["start_sec", "end_sec", "title", "hook", "why", "score"]}}},
    "required": ["moments"],
}


def build_prompt(sig, rows, count):
    m = sig["meta"]
    table, step = table_text(rows)
    used = [k for k, v in (("live-chat replay", bool(sig["chat"])), ("Most-replayed heatmap", bool(sig["heat"])), ("captions", bool(sig["transcript"]))) if v]
    return f"""You help fan pages of live streamers (mostly Indian gaming streamers: GTA RP, BGMI, Valorant, Minecraft, IRL) find clip-worthy moments in a long stream replay. You cannot watch the video; you only get this signal table.

Stream: "{m['title']}" by {m['channel']} — length {hms(m['duration_sec'])} ({m['duration_sec']} s). Caption language: {sig['caption_lang'] or 'none'}. Signals available: {', '.join(used)}.

Table: one row per {step} s. Columns: start time | chat messages in the row (xN = times the stream's median chat rate; '-' = chat not sampled there) | Most-replayed intensity 0-1 ('-' = none) | what was said (captions, may be auto-generated and imperfect) || sample chat messages.

Pick the {count} best moments for YouTube Shorts / Instagram Reels, best first. Good moments: big chat spikes (especially laughing, KEKW, LOL, W, 💀, 🔥, "clip it", super chats), high Most-replayed intensity, funny or wild quotes, fails, clutches, rage, jump scares, reveals, emotional or wholesome bits. Avoid intros, "starting soon", ads/sponsor reads, and breaks.

Rules:
- start_sec/end_sec are whole seconds inside 0..{m['duration_sec']}. Clip length 15-90 s (aim 30-60). Start about 5 s before the peak so the setup is included; end after the payoff.
- Moments must not overlap each other.
- title: short (max 60 chars), in the stream's own language and style (Hinglish in Roman script is fine).
- hook: one punchy caption line for Shorts/Reels (max 90 chars), same language style, no hashtags.
- why: one short line saying which signal backs it (e.g. "Chat x4 with KEKW spam", "Most replayed peak 0.92", or the quote).
- score: 1-100, how strong the clip is likely to be.
- Return exactly {count} moments if the table has enough material, otherwise as many good ones as you can.

{table}
"""


SM_DEBUG = (ENV("SM_DEBUG", "") or "").strip() == "1"  # server-log only; never sent to visitors
GEMINI_BACKUP_MODELS = [m.strip() for m in (ENV("GEMINI_BACKUP_MODELS", "gemini-3.7-flash,gemini-3.5-flash") or "").split(",") if m.strip()]
GEMINI_BUSY_WAIT = 2.0  # seconds before retrying a busy model once


def _gemini_busy(r):
    return r.status_code in (429, 500, 503) or any(w in r.text.lower() for w in ("high demand", "overloaded", "unavailable"))


async def _gemini_post(h, model, body, timeout):
    hdrs = {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}
    gc = body["generationConfig"]
    r = await h.post(GEMINI_URL.format(model=model), headers=hdrs, json=body, timeout=httpx.Timeout(timeout))
    if r.status_code == 400 and "think" in r.text.lower() and "thinkingConfig" in gc:  # model doesn't take thinkingLevel: try a budget, then nothing
        level = gc["thinkingConfig"]
        gc["thinkingConfig"] = {"thinkingBudget": 512}
        r = await h.post(GEMINI_URL.format(model=model), headers=hdrs, json=body, timeout=httpx.Timeout(timeout))
        if r.status_code == 400 and "think" in r.text.lower():
            gc.pop("thinkingConfig", None)
            r = await h.post(GEMINI_URL.format(model=model), headers=hdrs, json=body, timeout=httpx.Timeout(timeout))
        if "thinkingConfig" in gc: gc["thinkingConfig"] = level
    return r


async def gemini_call(prompt, schema, timeout=210, max_tokens=16384, temperature=0.4, thinking="low", timeout_next=False, models=None):
    """Call Gemini in JSON mode; returns (parsed object, model used). When the main model is busy (429/5xx,
    "high demand") it retries once after a short wait, then tries GEMINI_BACKUP_MODELS in order.
    With timeout_next, a model that times out is skipped and the next backup gets its own `timeout`.
    `prompt` is text, or a list of Gemini parts (text and inline_data images). `models` overrides the order to try.
    Raises SMError with a user-facing message."""
    models = list(models) if models else [GEMINI_MODEL] + [m for m in GEMINI_BACKUP_MODELS if m != GEMINI_MODEL]
    parts = prompt if isinstance(prompt, list) else [{"text": prompt}]
    tries = [models[0], models[0]] + models[1:]
    r, model, timed_out = None, models[0], None
    async with http() as h:
        for i, model in enumerate(tries):
            if i == 1:
                if timed_out: continue  # main model hung: don't wait on it again
                await asyncio.sleep(GEMINI_BUSY_WAIT)
            body = {"contents": [{"role": "user", "parts": parts}],
                    "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema, "temperature": temperature,
                                         "maxOutputTokens": max_tokens, "thinkingConfig": {"thinkingLevel": thinking}}}
            try:
                r = await _gemini_post(h, model, body, timeout)
            except httpx.HTTPError as e:
                timed_out = e
                if timeout_next and i < len(tries) - 1: continue
                raise SMError(504, "The AI took too long to answer (" + type(e).__name__ + ").")
            timed_out = None
            if r.status_code == 404 and i >= 2: continue  # a backup model this key can't use: try the next one
            if not _gemini_busy(r): break
    if r is None: raise SMError(504, "The AI took too long to answer.")
    if r.status_code in (400, 401, 403) and "api key" in r.text.lower(): raise SMError(503, "The AI key on the server is invalid or not allowed for this model.")
    if r.status_code == 429 or (r.status_code == 503 and "high demand" in r.text.lower()): raise SMError(503, "The AI is busy right now. Try again in a minute.")
    if r.status_code != 200: raise SMError(502, "AI error: " + _err(r)[:200])
    j = r.json()
    try:
        text = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"])
        out = json.loads(text)
        if not isinstance(out, dict): raise ValueError
        return out, model
    except (KeyError, IndexError, ValueError, AttributeError, TypeError):
        raise SMError(502, "The AI answer couldn't be read" + (" (" + str((j.get("candidates") or [{}])[0].get("finishReason")) + ")" if isinstance(j, dict) else "") + ".")


async def gemini_json(prompt, schema, **kw):
    return (await gemini_call(prompt, schema, **kw))[0]


async def call_gemini(prompt):
    return (await gemini_json(prompt, MOMENT_SCHEMA)).get("moments") or []


def _clean_moment(m, dur):
    try: s, e_ = int(float(m.get("start_sec"))), int(float(m.get("end_sec")))
    except (TypeError, ValueError): return None
    s = max(0, s)
    if dur: s = min(s, max(0, dur - 15))
    if e_ - s < 15: e_ = s + 15
    if e_ - s > 90: e_ = s + 90
    if dur: e_ = min(e_, dur)
    if e_ <= s: return None
    try: sc = max(1, min(100, int(float(m.get("score") or 50))))
    except (TypeError, ValueError): sc = 50
    return {"start_sec": s, "end_sec": e_, "title": str(m.get("title") or "").strip()[:80] or "Moment",
            "hook": str(m.get("hook") or "").strip()[:140], "why": str(m.get("why") or "").strip()[:160], "score": sc, "source": m.get("source", "ai")}


def _overlaps(a, b):
    inter = min(a["end_sec"], b["end_sec"]) - max(a["start_sec"], b["start_sec"])
    return inter > 0.4 * min(a["end_sec"] - a["start_sec"], b["end_sec"] - b["start_sec"]) or abs(a["start_sec"] - b["start_sec"]) < 15


def dedupe(moments):
    kept = []
    for m in sorted(moments, key=lambda m: -m["score"]):
        if not any(_overlaps(m, k) for k in kept): kept.append(m)
    return kept


def fill_from_signals(kept, rows, count, dur):
    """Top-up with the strongest signal buckets (labelled "Hype spike") until we have `count` moments."""
    cand = sorted((r for r in rows if r["score"] > 0), key=lambda r: -r["score"])
    best = cand[0]["score"] if cand else 1
    for r in cand:
        if len(kept) >= count: break
        peak = r["t"] + SM_BUCKET // 2
        why = []
        if r["rel"]: why.append(f'Chat x{r["rel"]} vs normal' + (" with hype reactions" if r["kw"] else ""))
        if r["heat"]: why.append(f'Most replayed {r["heat"]:.2f}')
        hook = (r["text"][:100] + "…") if len(r["text"]) > 100 else r["text"]
        if not hook and r["samples"]: hook = "Chat: " + r["samples"][0]
        m = _clean_moment({"start_sec": peak - 20, "end_sec": peak + 25, "title": "Hype spike at " + hms(peak), "hook": hook,
                           "why": " · ".join(why) or "Signal spike", "score": max(1, round(60 * r["score"] / best)), "source": "signal"}, dur)
        if m and not any(_overlaps(m, k) for k in kept): kept.append(m)
    return kept


def finish_moments(raw, rows, count, dur, vid):
    ms = [x for x in (_clean_moment(m, dur) for m in raw if isinstance(m, dict)) if x]
    ai = dedupe(ms)[:count]
    out = fill_from_signals(ai, rows, count, dur)
    ai_part = [m for m in out if m["source"] == "ai"]
    fill_part = [m for m in out if m["source"] != "ai"]
    out = ai_part + fill_part  # AI picks (best first), then the signal top-ups
    for i, m in enumerate(out):
        m.update(rank=i + 1, start=hms(m["start_sec"]), end=hms(m["end_sec"]), url=f"https://www.youtube.com/watch?v={vid}&t={m['start_sec']}s")
    return out


def _client_ip(req):
    return req.client.host if req.client else "?"


@app.post("/api/stream-moments")
async def stream_moments(req: Request):
    if req.headers.get("x-toolsaku") != "1": raise HTTPException(403, "bad_request")
    origin = req.headers.get("origin")
    if origin and urllib.parse.urlsplit(origin).netloc not in (req.headers.get("host"), urllib.parse.urlsplit(PUBLIC_URL).netloc):
        raise HTTPException(403, "bad_origin")
    try: body = await req.json()
    except ValueError: body = None
    if not isinstance(body, dict): raise HTTPException(400, "Send JSON like {\"url\": \"https://www.youtube.com/watch?v=...\"}.")
    vid = yt_video_id(body.get("url"))
    if not vid: raise HTTPException(400, "That doesn't look like a YouTube link. Paste a youtube.com/watch?v=…, youtu.be/… or /live/… link.")
    try: count = int(body.get("count") or 50)
    except (TypeError, ValueError): count = 50
    count = max(5, min(100, count))
    if not GEMINI_API_KEY: raise HTTPException(503, "AI key not set on server")
    key = f"{vid}:{count}"
    hit = SM_CACHE.get(key)
    if hit and hit["at"] > time.time() - SM_CACHE_TTL:
        return JSONResponse({**hit["v"], "cached": True}, headers={"Cache-Control": "no-store"})
    ip, t = _client_ip(req), time.time()
    hits = [x for x in SM_HITS.get(ip, []) if x > t - SM_RATE[1]]
    if len(hits) >= SM_RATE[0]:
        wait_min = max(1, int((hits[0] + SM_RATE[1] - t) // 60) + 1)
        raise HTTPException(429, f"Too many searches from your network. Try again in {wait_min} minute{'s' if wait_min > 1 else ''}.")
    SM_HITS[ip] = hits + [t]
    if len(SM_HITS) > 5000:
        for k in [k for k, v in SM_HITS.items() if not v or v[-1] < t - SM_RATE[1]]: SM_HITS.pop(k, None)
    async with SM_SEM:
        try:
            sig = await gather_signals(vid)
            used = {"heatmap": bool(sig["heat"]), "captions": bool(sig["transcript"]), "chat": bool(sig["chat"])}
            if not any(used.values()):
                if SM_DEBUG: print("stream-moments no signals", vid, json.dumps(sig.get("debug")), flush=True)
                return JSONResponse({"detail": "No signals to work with: this video has no chat replay, no captions and no Most-replayed data yet. "
                                     "Try a finished stream with chat replay turned on, or come back after YouTube adds captions."}, status_code=422, headers={"Cache-Control": "no-store"})
            rows = build_table(sig)
            warning = None
            try:
                raw = await call_gemini(build_prompt(sig, rows, count))
            except SMError as e:
                if e.status == 503 and "invalid" in e.msg: raise
                raw, warning = [], e.msg + " Showing moments ranked from the stream's signals only."
            moments = finish_moments(raw, rows, count, sig["meta"]["duration_sec"], vid)
        except SMError as e:
            raise HTTPException(e.status, e.msg)
    dur = sig["meta"]["duration_sec"]
    res = {"video": {k: sig["meta"][k] for k in ("id", "title", "channel", "duration_sec", "url", "thumbnail", "was_live")},
           "signals_used": used,
           "signal_detail": {"chat_messages_sampled": sig["chat_messages"], "caption_language": sig["caption_lang"],
                             "chat_coverage_pct": round(100 * len(sig["covered"]) / max(1, dur // SM_BUCKET + 1)) if sig["chat"] else 0,
                             "heatmap_points": len(sig["heat"])},
           "model": GEMINI_MODEL, "count_requested": count, "moments": moments, "warning": warning, "cached": False}
    if SM_DEBUG: print("stream-moments debug", vid, json.dumps(sig.get("debug")), flush=True)
    if not warning:
        SM_CACHE[key] = {"at": time.time(), "v": res}; _trim_cache(SM_CACHE)
    return JSONResponse(res, headers={"Cache-Control": "no-store"})


# ---- AI Caption Generator: titles, captions, descriptions and hashtags ----------------------------
# Only the text the user types is sent here (never files). Same guards as Stream Moment Finder:
# x-toolsaku header + same-origin check, 5 fresh requests per IP per 10 minutes, 30-minute cache,
# and a template fallback with a warning when the AI is down.
AC_RATE = (5, 600)
AC_CACHE_TTL = 1800
AC_CACHE, AC_HITS = {}, {}
AC_SEM = asyncio.Semaphore(4)
AC_KINDS = ("titles", "captions", "descriptions", "hashtags")
AC_COUNTS = {"titles": 8, "captions": 6, "descriptions": 2, "hashtags": 20}
AC_TONES = ("Fun", "Professional", "Inspiring", "Casual")
AC_PLATFORMS = {"youtube": "a YouTube video", "shorts": "YouTube Shorts / Instagram Reels", "instagram": "an Instagram post"}
AC_SCHEMA = {
    "type": "OBJECT",
    "properties": {k: {"type": "ARRAY", "items": {"type": "STRING"}} for k in AC_KINDS},
    "required": list(AC_KINDS),
}


def _ac_text(v, n):
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def ac_parse(body):
    """Validate and normalise a request body. Raises HTTPException(400) with a friendly message."""
    if not isinstance(body, dict): raise HTTPException(400, "Send JSON like {\"topic\": \"GTA RP police chase\"}.")
    topic = _ac_text(body.get("topic"), 200)
    if len(topic) < 3: raise HTTPException(400, "Type what your video or post is about (at least 3 characters).")
    details = _ac_text(body.get("details"), 500)
    lang = "english" if str(body.get("lang") or "").lower() == "english" else "hinglish"
    tone = next((t for t in AC_TONES if t.lower() == str(body.get("tone") or "").lower()), "Fun")
    platform = str(body.get("platform") or "").lower()
    if platform not in AC_PLATFORMS: platform = "youtube"
    kinds = body.get("kinds")
    kinds = [k for k in AC_KINDS if isinstance(kinds, list) and k in kinds] or list(AC_KINDS)
    return {"topic": topic, "details": details, "lang": lang, "tone": tone, "platform": platform, "kinds": kinds}


def ac_prompt(q):
    lang = ("Hinglish: Hindi words written in Roman (English) script mixed naturally with English, the way Indian creators write "
            "(for example \"Bhai ye scene dekh ke hasi nahi rukegi 😂\"). Never use Devanagari." if q["lang"] == "hinglish" else "simple, natural English")
    want = []
    if "titles" in q["kinds"]: want.append(f"- titles: {AC_COUNTS['titles']} clickable titles, max 70 characters each, no hashtags, no clickbait lies.")
    if "captions" in q["kinds"]: want.append(f"- captions: {AC_COUNTS['captions']} short captions (1-3 lines, max 220 characters) with fitting emoji, no hashtags.")
    if "descriptions" in q["kinds"]: want.append(f"- descriptions: {AC_COUNTS['descriptions']} descriptions of 3-6 short lines: a hook line, what the viewer gets, and a call to like/subscribe/follow. No hashtags, no links, no made-up timestamps.")
    if "hashtags" in q["kinds"]: want.append(f"- hashtags: {AC_COUNTS['hashtags']} relevant hashtags, each starting with #, no spaces, a mix of broad and niche, India-relevant where it fits.")
    skip = [k for k in AC_KINDS if k not in q["kinds"]]
    return f"""You write copy for Indian content creators (gaming, vlogs, education, comedy, tech, lifestyle).

Content: {q['topic']}
{('Extra details: ' + q['details']) if q['details'] else ''}
Platform: {AC_PLATFORMS[q['platform']]}
Tone: {q['tone']}
Language: {lang}

Return JSON with these lists:
{chr(10).join(want)}
{('Return an empty list for: ' + ', '.join(skip) + '.') if skip else ''}
Every item must be different, ready to copy and paste, and must not invent facts that are not in the content above.
"""


def _ac_tag(s):
    w = re.sub(r"[^0-9A-Za-z]+", " ", s).split()
    return "#" + "".join(_ac_cap(x) for x in w[:4]) if w else ""


def _ac_cap(x):
    return x if x.isupper() else x[:1].upper() + x[1:]


def ac_templates(q):
    """Offline fallback so the tool still gives something useful when the AI is down."""
    t = q["topic"]
    if q["lang"] == "hinglish":
        titles = [f"{t} 😱 | Ye dekh ke shock ho jaoge", f"{t} – Full Story in Hindi", f"Maine try kiya {t}… aur ye hua!", f"{t} | Last tak zaroor dekhna",
                  f"{t} ka sach 🔥", f"{t} – Beginners ke liye Guide", f"{t} 😂 Funniest Moments", f"Kya {t} worth hai? Honest Review"]
        caps = [f"{t} vibes 🔥 Aapka kya kehna hai? 👇", f"Ye moment miss mat karna 😂 #{t.split()[0] if t.split() else 'video'}", f"{t} – full energy ⚡ Share karo apne dost ke saath!",
                f"Bas itna hi kahunga… {t} 💯", f"Kaun kaun relate kar raha hai? 🙋 {t}", f"{t} ✨ Save kar lo baad ke liye 📌"]
        descs = [f"{t} 🔥\nIs video mein dekhiye {t} ka poora maza.\nVideo pasand aaye toh Like karo, Share karo aur Subscribe karna mat bhoolna! 🔔",
                 f"Aaj ka topic: {t}\nLast tak dekhna, best part end mein hai 😉\nComment mein batao aapko kaisa laga 👇"]
    else:
        titles = [f"{t} 😱 You Won't Believe This", f"{t} – The Full Story", f"I Tried {t}… Here's What Happened", f"{t} | Watch Till the End",
                  f"The Truth About {t} 🔥", f"{t}: A Beginner's Guide", f"{t} 😂 Funniest Moments", f"Is {t} Worth It? Honest Review"]
        caps = [f"{t} vibes 🔥 What do you think? 👇", f"Don't miss this moment 😂", f"{t} – full energy ⚡ Share with a friend!",
                f"Just going to leave this here… {t} 💯", f"Who can relate? 🙋 {t}", f"{t} ✨ Save this for later 📌"]
        descs = [f"{t} 🔥\nIn this video, enjoy {t} from start to finish.\nIf you liked it, Like, Share and Subscribe! 🔔",
                 f"Today's topic: {t}\nWatch till the end, the best part is last 😉\nTell me what you think in the comments 👇"]
    base = _ac_tag(t)
    words = [w for w in re.sub(r"[^0-9A-Za-z]+", " ", t).split() if len(w) > 2]
    plat = {"youtube": ["#YouTube", "#YouTubeIndia", "#Trending"], "shorts": ["#Shorts", "#Reels", "#Viral"], "instagram": ["#Instagram", "#InstaDaily", "#Explore"]}[q["platform"]]
    tags = [x for x in [base] + ["#" + _ac_cap(w) for w in words] + plat + ["#India", "#Hindi" if q["lang"] == "hinglish" else "#Creator", "#ContentCreator", "#Viral"] if x]
    tags = list(dict.fromkeys(tags))[:AC_COUNTS["hashtags"]]
    out = {"titles": titles, "captions": caps, "descriptions": descs, "hashtags": tags}
    return {k: (out[k] if k in q["kinds"] else []) for k in AC_KINDS}


def ac_clean(raw, q):
    out = {}
    for k in AC_KINDS:
        items = raw.get(k) if k in q["kinds"] else []
        items = [str(x).strip() for x in (items if isinstance(items, list) else []) if str(x).strip()]
        if k == "hashtags":
            items = ["#" + re.sub(r"[\s#]+", "", x) for x in items]
            items = [x for x in items if len(x) > 1]
        lim = {"titles": 100, "captions": 400, "descriptions": 1500, "hashtags": 60}[k]
        out[k] = list(dict.fromkeys(x[:lim] for x in items))[:AC_COUNTS[k] + 4]
    return out


@app.post("/api/ai-captions")
async def ai_captions(req: Request):
    if req.headers.get("x-toolsaku") != "1": raise HTTPException(403, "bad_request")
    origin = req.headers.get("origin")
    if origin and urllib.parse.urlsplit(origin).netloc not in (req.headers.get("host"), urllib.parse.urlsplit(PUBLIC_URL).netloc):
        raise HTTPException(403, "bad_origin")
    try: body = await req.json()
    except ValueError: body = None
    q = ac_parse(body)
    key = hashlib.sha256(json.dumps(q, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    hit = AC_CACHE.get(key)
    if hit and hit["at"] > time.time() - AC_CACHE_TTL:
        return JSONResponse({**hit["v"], "cached": True}, headers={"Cache-Control": "no-store"})
    ip, t = _client_ip(req), time.time()
    hits = [x for x in AC_HITS.get(ip, []) if x > t - AC_RATE[1]]
    if len(hits) >= AC_RATE[0]:
        wait_min = max(1, int((hits[0] + AC_RATE[1] - t) // 60) + 1)
        raise HTTPException(429, f"Too many AI requests from your network. Try again in {wait_min} minute{'s' if wait_min > 1 else ''}.")
    AC_HITS[ip] = hits + [t]
    if len(AC_HITS) > 5000:
        for k in [k for k, v in AC_HITS.items() if not v or v[-1] < t - AC_RATE[1]]: AC_HITS.pop(k, None)
    warning, source, used_model = None, "ai", None
    if not GEMINI_API_KEY:
        res, warning, source = ac_templates(q), "AI isn't set up on the server yet. Showing template ideas instead.", "template"
    else:
        async with AC_SEM:
            try:
                raw, used_model = await gemini_call(ac_prompt(q), AC_SCHEMA, timeout=40, max_tokens=4096, temperature=0.9, thinking="minimal", timeout_next=True)
                res = ac_clean(raw, q)
                if not any(res.values()): raise SMError(502, "The AI gave an empty answer.")
            except SMError as e:
                res, warning, source = ac_templates(q), e.msg.rstrip(".") + ". Showing template ideas instead.", "template"
    out = {**res, "kinds": q["kinds"], "lang": q["lang"], "source": source, "model": used_model if source == "ai" else None, "warning": warning, "cached": False}
    if not warning:
        AC_CACHE[key] = {"at": time.time(), "v": out}; _trim_cache(AC_CACHE)
    return JSONResponse(out, headers={"Cache-Control": "no-store"})


# ---- Long Video to Shorts, AI mode: is this loud moment a real highlight? ----------------------
# The phone finds loud spikes on its own, then sends ~8 small JPEG snapshots (and spoken words, if it
# already has them) per candidate clip. The full video never leaves the device. Images live only in
# memory for the length of the request and are never stored or logged.
CM_MAX_BODY = 12 * 1024 * 1024     # whole request
CM_MAX_CLIPS = 8                   # clips per request
CM_MAX_FRAMES = 12                 # snapshots per clip
CM_MAX_IMG = 150 * 1024            # bytes per snapshot (decoded)
CM_MAX_SPAN = 180                  # seconds per candidate clip
CM_RATE = (60, 600)                # 60 clips per IP per 10 minutes
CM_HITS = {}
CM_SEM = asyncio.Semaphore(5)      # at most 5 Gemini calls at once for this tool
CM_PREFER = {"model": None, "until": 0.0}  # after the main model was busy, start on the backup that worked for 2 minutes
CM_TYPES = ("clutch", "funny", "rage", "hype", "fail", "other")
CM_SCHEMA = {
    "type": "OBJECT",
    "properties": {"is_moment": {"type": "BOOLEAN"}, "score": {"type": "INTEGER"}, "type": {"type": "STRING", "enum": list(CM_TYPES)},
                   "reason": {"type": "STRING"}, "hook_title": {"type": "STRING"}},
    "required": ["is_moment", "score", "type", "reason", "hook_title"],
}
CM_B64_RE = re.compile(r"^[A-Za-z0-9+/_-]+={0,2}$")


def _cm_img(s):
    """Validate one snapshot (base64 JPEG, optionally a data: URL). Returns clean standard base64."""
    if not isinstance(s, str) or not s: raise HTTPException(400, "Each snapshot must be a base64 JPEG.")
    if s.startswith("data:"):
        head, _, s = s.partition(",")
        if "image/jpeg" not in head.lower(): raise HTTPException(400, "Snapshots must be JPEG images.")
    s = s.strip()
    if len(s) > CM_MAX_IMG * 4 // 3 + 8: raise HTTPException(413, "A snapshot is too big (max 150 KB each).")
    if not CM_B64_RE.match(s): raise HTTPException(400, "A snapshot isn't valid base64.")
    try: raw = base64.b64decode(s.replace("-", "+").replace("_", "/") + "=" * (-len(s) % 4), validate=True)
    except (binascii.Error, ValueError): raise HTTPException(400, "A snapshot isn't valid base64.")
    if len(raw) > CM_MAX_IMG: raise HTTPException(413, "A snapshot is too big (max 150 KB each).")
    if raw[:3] != b"\xff\xd8\xff": raise HTTPException(400, "Snapshots must be JPEG images.")
    return base64.b64encode(raw).decode()


def _num(v, lo=None, hi=None):
    try: x = float(v)
    except (TypeError, ValueError): return None
    if x != x or x in (float("inf"), float("-inf")): return None
    if lo is not None and x < lo: return None
    if hi is not None and x > hi: return None
    return x


def cm_parse(body):
    """Validate a /api/clip-moments body. Raises HTTPException 400 (bad shape) or 413 (too much)."""
    if not isinstance(body, dict) or not isinstance(body.get("clips"), list) or not body["clips"]:
        raise HTTPException(400, "Send JSON like {\"clips\": [{\"start\": 60, \"end\": 90, \"frames\": [\"<base64 jpeg>\"]}]}.")
    if len(body["clips"]) > CM_MAX_CLIPS: raise HTTPException(413, f"Too many clips in one request (max {CM_MAX_CLIPS}).")
    clips = []
    for i, c in enumerate(body["clips"]):
        if not isinstance(c, dict): raise HTTPException(400, "Each clip must be an object.")
        st, en = _num(c.get("start"), 0), _num(c.get("end"), 0)
        if st is None or en is None or en <= st: raise HTTPException(400, "Each clip needs a start and an end time in seconds, end after start.")
        if en - st > CM_MAX_SPAN: raise HTTPException(400, f"A clip can be at most {CM_MAX_SPAN} seconds long.")
        frames = c.get("frames")
        if not isinstance(frames, list) or not frames: raise HTTPException(400, "Each clip needs at least one snapshot.")
        if len(frames) > CM_MAX_FRAMES: raise HTTPException(413, f"Too many snapshots in one clip (max {CM_MAX_FRAMES}).")
        imgs = [_cm_img(f) for f in frames]
        times = c.get("times") if isinstance(c.get("times"), list) and len(c.get("times")) == len(imgs) else None
        times = [(_num(t, 0, en - st + 1) or 0.0) for t in times] if times else [(en - st) * (k + 0.5) / len(imgs) for k in range(len(imgs))]
        loud = c.get("loud") if isinstance(c.get("loud"), list) else []
        loud = [int(max(0, min(100, _num(x) or 0))) for x in loud[:int(CM_MAX_SPAN)]]
        spike = _num(c.get("spike"), 0, en - st)
        clips.append({"id": _ac_text(c.get("id"), 40) or str(i), "start": st, "end": en, "frames": imgs, "times": times,
                      "loud": loud, "spike": spike, "words": _ac_text(c.get("words"), 1500)})
    lang = "hinglish" if str(body.get("lang") or "").lower() == "hinglish" else "english"
    return {"clips": clips, "title": _ac_text(body.get("title"), 120), "lang": lang}


def cm_prompt(c, q):
    dur = round(c["end"] - c["start"])
    lang = ("Hinglish (Hindi words in Roman script mixed with English, like Indian gaming creators write; never Devanagari)"
            if q["lang"] == "hinglish" else "simple English")
    spike = f" at about {c['spike']:.0f} s into the clip" if c["spike"] is not None else ""
    loud = ", ".join(str(x) for x in c["loud"]) if c["loud"] else "not available"
    words = f'"{c["words"]}"' if c["words"] else "not available"
    return f"""You check candidate highlight clips cut from a long video (usually a gaming live stream) for YouTube Shorts and Instagram Reels.

Video title or game (typed by the creator): {q['title'] or 'not given'}
This candidate runs from {hms(int(c['start']))} to {hms(int(c['end']))} ({dur} s). It was picked because the audio suddenly got loud{spike}.
Loudness for each second of the clip (0-100): {loud}
Spoken words in this clip: {words}
After this text come {len(c['frames'])} snapshots in time order, each labelled with its second inside the clip.

Decide if this is a real highlight people would stop scrolling for: a clutch play, a funny moment, rage, big hype, or an epic fail.
Loud music, menus, loading or lobby screens, ads, idle talk or a screen where nothing changes are NOT moments.
Return JSON:
- is_moment: true only for a real highlight.
- score: 0-100, how strong a Short this would make.
- type: clutch, funny, rage, hype, fail or other.
- reason: at most 12 words on what happens, based only on these snapshots, loudness and words.
- hook_title: a catchy on-screen hook for this clip, at most 60 characters, in {lang}, no hashtags, no invented names.
"""


def cm_clean(raw):
    try: score = int(round(float(raw.get("score"))))
    except (TypeError, ValueError): score = 0
    typ = str(raw.get("type") or "").lower()
    return {"is_moment": raw.get("is_moment") is True, "score": max(0, min(100, score)), "type": typ if typ in CM_TYPES else "other",
            "reason": _ac_text(raw.get("reason"), 140), "hook_title": _ac_text(raw.get("hook_title"), 80).strip("#").strip()}


async def cm_check(c, q):
    parts = [{"text": cm_prompt(c, q)}]
    for t, img in zip(c["times"], c["frames"]):
        parts += [{"text": f"Snapshot at {t:.1f} s:"}, {"inline_data": {"mime_type": "image/jpeg", "data": img}}]
    models = None
    if CM_PREFER["model"] and CM_PREFER["until"] > time.time():
        models = [CM_PREFER["model"]] + [m for m in [GEMINI_MODEL] + GEMINI_BACKUP_MODELS if m != CM_PREFER["model"]]
    async with CM_SEM:
        t0 = time.time()
        try:
            raw, model = await gemini_call(parts, CM_SCHEMA, timeout=40, max_tokens=2048, temperature=0.3, thinking="minimal", timeout_next=True, models=models)
        except SMError as e:
            return {"id": c["id"], "ok": False, "status": e.status, "error": e.msg}
    if model != GEMINI_MODEL: CM_PREFER.update(model=model, until=time.time() + 120)
    return {"id": c["id"], "ok": True, **cm_clean(raw), "model": model, "ms": int((time.time() - t0) * 1000)}


@app.post("/api/clip-moments")
async def clip_moments(req: Request):
    if req.headers.get("x-toolsaku") != "1": raise HTTPException(403, "bad_request")
    origin = req.headers.get("origin")
    if origin and urllib.parse.urlsplit(origin).netloc not in (req.headers.get("host"), urllib.parse.urlsplit(PUBLIC_URL).netloc):
        raise HTTPException(403, "bad_origin")
    cl = req.headers.get("content-length") or ""
    if cl.isdigit() and int(cl) > CM_MAX_BODY: raise HTTPException(413, "Too much data in one request (max 12 MB).")
    raw = await req.body()
    if len(raw) > CM_MAX_BODY: raise HTTPException(413, "Too much data in one request (max 12 MB).")
    try: body = json.loads(raw)
    except ValueError: body = None
    q = cm_parse(body)
    del raw, body
    if not GEMINI_API_KEY: raise HTTPException(503, "AI key not set on server")
    ip, t = _client_ip(req), time.time()
    hits = [x for x in CM_HITS.get(ip, []) if x > t - CM_RATE[1]]
    if len(hits) + len(q["clips"]) > CM_RATE[0]:
        wait_min = max(1, int(((hits[0] if hits else t) + CM_RATE[1] - t) // 60) + 1)
        raise HTTPException(429, f"AI has checked a lot of clips from your network. Try again in {wait_min} minute{'s' if wait_min > 1 else ''}.")
    CM_HITS[ip] = hits + [t] * len(q["clips"])
    if len(CM_HITS) > 5000:
        for k in [k for k, v in CM_HITS.items() if not v or v[-1] < t - CM_RATE[1]]: CM_HITS.pop(k, None)
    verdicts = await asyncio.gather(*(cm_check(c, q) for c in q["clips"]))
    q = None  # drop the snapshots now
    ok = [v for v in verdicts if v["ok"]]
    if not ok:
        bad = verdicts[0]
        raise HTTPException(bad["status"], bad["error"])
    models = [v["model"] for v in ok]
    return JSONResponse({"verdicts": verdicts, "model": max(set(models), key=models.count), "ms": int((time.time() - t) * 1000)},
                        headers={"Cache-Control": "no-store"})
