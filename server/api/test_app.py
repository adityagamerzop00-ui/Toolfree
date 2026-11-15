"""Offline tests for app.py: Google, YouTube and Meta are replaced by a fake HTTP transport.
Run:  cd server/api && python3 -m pytest -q test_app.py   (needs: pip install pytest)"""
import base64, hashlib, hmac, json, os, tempfile, time, urllib.parse

D = tempfile.mkdtemp()
os.environ.update(PUBLIC_URL="http://testserver", GOOGLE_CLIENT_ID="gid", GOOGLE_CLIENT_SECRET="gsec", META_APP_ID="mid", META_APP_SECRET="msec",
                  TOKEN_KEY=base64.urlsafe_b64encode(b"k" * 32).decode(), DB_PATH=D + "/t.db", TMP_DIR=D + "/tmp")
import httpx  # noqa: E402
import app as A  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

CALLS = []
IG_POLLS = {"n": 0}


def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).rstrip(b"=").decode()


def fake(req: httpx.Request):
    u, CALLS_ = str(req.url), CALLS
    CALLS_.append((req.method, u.split("?")[0]))
    if u.startswith(A.GOOGLE_TOKEN):
        body = urllib.parse.parse_qs(req.content.decode())
        if body.get("grant_type") == ["refresh_token"]:
            return httpx.Response(200, json={"access_token": "yt-new", "expires_in": 3600})
        code = body["code"][0]
        sub = "sub-" + code
        idt = "x." + b64({"aud": "gid", "iss": "https://accounts.google.com", "exp": int(time.time()) + 600, "sub": sub, "email": code + "@gmail.com", "name": code}) + ".y"
        scope = "openid email profile" + (" " + A.YT_SCOPE if code.startswith("yt") else "")
        return httpx.Response(200, json={"id_token": idt, "access_token": "yt-acc", "refresh_token": "yt-ref", "expires_in": 3600, "scope": scope})
    if u.startswith(A.GOOGLE_REVOKE): return httpx.Response(200)
    if u.startswith(A.YT_UPLOAD) and req.method == "POST":
        assert req.headers["authorization"].startswith("Bearer ")
        assert json.loads(req.content)["status"]["privacyStatus"] == "private"
        return httpx.Response(200, headers={"Location": "https://upload.example/session1"})
    if u.startswith("https://upload.example/session1"):
        assert len(req.content) == 5000
        return httpx.Response(200, json={"id": "VID123"})
    if "/oauth/access_token" in u: return httpx.Response(200, json={"access_token": "meta-user"})
    if u.endswith("/me") or "/me?" in u: return httpx.Response(200, json={"id": "fbuser1"})
    if "/me/accounts" in u:
        return httpx.Response(200, json={"data": [{"id": "page1", "name": "My Page", "access_token": "page-tok",
                                                    "instagram_business_account": {"id": "ig1", "username": "creator"}},
                                                   {"id": "page2", "name": "Other", "access_token": "page2-tok"}]})
    if u.startswith(A.GRAPH_URL + "/ig1/media_publish"): return httpx.Response(200, json={"id": "M1"})
    if u.startswith(A.GRAPH_URL + "/ig1/media"): return httpx.Response(200, json={"id": "C1", "uri": "https://rupload.example/C1"})
    if u.startswith("https://rupload.example/C1"):
        assert req.headers["authorization"] == "OAuth page-tok" and req.headers["file_size"] == "5000"
        return httpx.Response(200, json={"success": True})
    if u.startswith(A.GRAPH_URL + "/C1"):
        IG_POLLS["n"] += 1
        return httpx.Response(200, json={"status_code": "FINISHED" if IG_POLLS["n"] > 1 else "IN_PROGRESS"})
    if u.startswith(A.GRAPH_URL + "/M1"): return httpx.Response(200, json={"permalink": "https://www.instagram.com/reel/abc/"})
    if u.startswith(A.GRAPH_VIDEO + "/page1/videos"):
        assert b"page-tok" in req.content
        return httpx.Response(200, json={"id": "FBV1"})
    if "/permissions" in u: return httpx.Response(200, json={"success": True})
    return httpx.Response(404, json={"error": {"message": "unexpected " + u}})


A.http = lambda: httpx.AsyncClient(transport=httpx.MockTransport(fake))
_sleep = A.asyncio.sleep
A.asyncio.sleep = lambda s: _sleep(0)
H = {"x-toolsaku": "1", "origin": "http://testserver"}


def client():
    return TestClient(A.app, base_url="http://testserver", follow_redirects=False)


def google_login(c, then, code, back="/long-video-to-shorts/"):
    r = c.get(f"/api/connect/{then}", params={"back": back})
    assert r.status_code == 303 and r.headers["location"].startswith(A.GOOGLE_AUTH)
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(r.headers["location"]).query)
    assert q["redirect_uri"] == ["http://testserver/api/auth/google/callback"] and q["code_challenge_method"] == ["S256"]
    return c.get("/api/auth/google/callback", params={"state": q["state"][0], "code": code}), q


def wait(c, jid):
    for _ in range(50):
        r = c.get("/api/post/status/" + jid).json()
        if r["status"] != "working": return r
        time.sleep(0.05)
    return r


def test_logged_out_me_and_csrf():
    with client() as c:
        assert c.get("/api/me").json()["user"] is None
        assert c.post("/api/logout").status_code == 403
        assert c.post("/api/logout", headers={"x-toolsaku": "1", "origin": "https://evil.example"}).status_code == 403
        assert c.post("/api/account/delete", headers=H).status_code == 401


def test_open_redirect_blocked():
    assert A.safe_back("//evil.com") == "/" and A.safe_back("https://evil.com") == "/" and A.safe_back("/a/?b=1") == "/a/?b=1"


def test_state_reuse_rejected():
    with client() as c:
        r, q = google_login(c, "youtube", "yt1")
        again = c.get("/api/auth/google/callback", params={"state": q["state"][0], "code": "yt1"})
        assert "account_error=expired" in again.headers["location"]


def test_youtube_flow_post_disconnect_delete():
    with client() as c:
        r, q = google_login(c, "youtube", "yt2")
        assert "youtube.upload" in q["scope"][0] and q["access_type"] == ["offline"]
        assert r.headers["location"] == "/long-video-to-shorts/?connected=youtube"
        assert "httponly" in r.headers["set-cookie"].lower() and "samesite=lax" in r.headers["set-cookie"].lower()
        me = c.get("/api/me").json()
        assert me["user"]["email"] == "yt2@gmail.com" and me["connections"][0]["provider"] == "youtube"
        # token is stored encrypted, never in clear
        raw = open(os.environ["DB_PATH"], "rb").read()
        assert b"yt-ref" not in raw and b"yt-acc" not in raw
        cid = me["connections"][0]["id"]
        r = c.post("/api/post/youtube", headers=H, data={"connection_id": cid, "title": "Hi #Shorts"}, files={"file": ("a.mp4", b"0" * 5000, "video/mp4")})
        assert r.status_code == 200, r.text
        s = wait(c, r.json()["job"])
        assert s == {"status": "done", "step": "uploading", "url": "https://www.youtube.com/shorts/VID123", "error": None}
        assert not os.listdir(os.environ["TMP_DIR"])  # temp video deleted
        assert c.post(f"/api/connections/{cid}/disconnect", headers=H).json() == {"ok": True}
        assert ("POST", A.GOOGLE_REVOKE) in CALLS
        assert c.get("/api/me").json()["connections"] == []
        assert c.post("/api/account/delete", headers=H).json() == {"ok": True}
        assert c.get("/api/me").json()["user"] is None


def test_meta_instagram_and_facebook():
    with client() as c:
        r, q = google_login(c, "instagram", "plain1")
        assert "youtube.upload" not in q["scope"][0]
        assert r.headers["location"].startswith("/api/connect/instagram?")
        r = c.get(r.headers["location"])
        assert r.headers["location"].startswith(A.FB_DIALOG)
        mq = urllib.parse.parse_qs(urllib.parse.urlsplit(r.headers["location"]).query)
        assert "instagram_content_publish" in mq["scope"][0]
        r = c.get("/api/connect/meta/callback", params={"state": mq["state"][0], "code": "m1"})
        assert r.headers["location"] == "/long-video-to-shorts/?connected=instagram"
        ig = [x for x in c.get("/api/me").json()["connections"] if x["provider"] == "instagram"]
        assert ig == [{"id": ig[0]["id"], "provider": "instagram", "name": "@creator"}]
        r = c.post("/api/post/instagram", headers=H, data={"connection_id": ig[0]["id"], "caption": "Hello"}, files={"file": ("a.mp4", b"0" * 5000, "video/mp4")})
        s = wait(c, r.json()["job"])
        assert s["status"] == "done" and s["url"] == "https://www.instagram.com/reel/abc/", s
        # WebM is refused for Instagram
        r = c.post("/api/post/instagram", headers=H, data={"connection_id": ig[0]["id"]}, files={"file": ("a.webm", b"0" * 10, "video/webm")})
        assert r.status_code == 415
        # Facebook: already logged in, so straight to Meta
        r = c.get("/api/connect/facebook", params={"back": "/"})
        mq = urllib.parse.parse_qs(urllib.parse.urlsplit(r.headers["location"]).query)
        assert "pages_manage_posts" in mq["scope"][0]
        r = c.get("/api/connect/meta/callback", params={"state": mq["state"][0], "code": "m2"})
        fb = [x for x in c.get("/api/me").json()["connections"] if x["provider"] == "facebook"]
        assert sorted(x["name"] for x in fb) == ["My Page", "Other"]
        p1 = [x for x in fb if x["name"] == "My Page"][0]
        r = c.post("/api/post/facebook", headers=H, data={"connection_id": p1["id"], "title": "T"}, files={"file": ("a.mp4", b"0" * 5000, "video/mp4")})
        s = wait(c, r.json()["job"])
        assert s["status"] == "done" and s["url"] == "https://www.facebook.com/FBV1", s


def test_other_user_cannot_use_connection():
    with client() as a, client() as b:
        google_login(a, "youtube", "yt3")
        cid = a.get("/api/me").json()["connections"][0]["id"]
        google_login(b, "youtube", "yt4")
        r = b.post("/api/post/youtube", headers=H, data={"connection_id": cid}, files={"file": ("a.mp4", b"0" * 10, "video/mp4")})
        assert r.status_code == 404
        assert b.post(f"/api/connections/{cid}/disconnect", headers=H).status_code == 404


def test_meta_data_deletion_callback():
    with client() as c:
        r, _ = google_login(c, "facebook", "plain2")
        r = c.get(r.headers["location"])
        mq = urllib.parse.parse_qs(urllib.parse.urlsplit(r.headers["location"]).query)
        c.get("/api/connect/meta/callback", params={"state": mq["state"][0], "code": "m3"})
        assert any(x["provider"] == "facebook" for x in c.get("/api/me").json()["connections"])
        payload = b64({"user_id": "fbuser1", "algorithm": "HMAC-SHA256"})
        sig = base64.urlsafe_b64encode(hmac.new(b"msec", payload.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
        r = c.post("/api/meta/data-deletion", data={"signed_request": sig + "." + payload})
        assert r.status_code == 200 and r.json()["confirmation_code"]
        assert not any(x["provider"] != "youtube" for x in c.get("/api/me").json()["connections"])
        assert c.post("/api/meta/data-deletion", data={"signed_request": "bad." + payload}).status_code == 400
        assert c.get("/api/meta/deletion-status", params={"code": r.json()["confirmation_code"]}).json()["status"] == "deleted"
