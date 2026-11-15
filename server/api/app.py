"""Toolsaku account API: optional Google login + connect YouTube / Instagram / Facebook.

Runs on the VPS behind nginx at /api/ (systemd unit: server/deploy/toolsaku-api.service).
Every secret comes from the environment file /etc/toolsaku/api.env (chmod 600). Nothing secret lives in the repo.

Stored per user (SQLite): Google id + email + name, sessions (hashed), and connected accounts with their OAuth
tokens encrypted (Fernet, key = TOKEN_KEY in api.env). Videos sent with "Post to ..." are written to a temp file,
uploaded to the platform, and deleted right after.
"""
import asyncio
import base64
import hashlib
import hmac
import json
import os
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
