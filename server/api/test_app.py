"""Offline tests for app.py: Google, YouTube, Meta and Gemini are replaced by a fake HTTP transport (no network).
Run:  cd server/api && python3 -m pytest -q test_app.py   (needs: pip install pytest)"""
import base64, hashlib, hmac, json, os, tempfile, time, urllib.parse

D = tempfile.mkdtemp()
os.environ.update(PUBLIC_URL="http://testserver", GOOGLE_CLIENT_ID="gid", GOOGLE_CLIENT_SECRET="gsec", META_APP_ID="mid", META_APP_SECRET="msec",
                  TOKEN_KEY=base64.urlsafe_b64encode(b"k" * 32).decode(), DB_PATH=D + "/t.db", TMP_DIR=D + "/tmp",
                  GEMINI_API_KEY="test-gemini-key", GEMINI_MODEL="gemini-2.5-flash")
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


# ---- AI Stream Moment Finder ----------------------------------------------------------
VID = "abcDEF12345"
SMX = {}


def sm_reset(**kw):
    A.SM_CACHE.clear(); A.SM_SIGNALS.clear(); A.SM_HITS.clear()
    SMX.clear(); SMX.update(dict(watch_status=200, private=False, chat=True, captions=True, heat=True, seek=True, gemini="ok", chat_calls=[], gemini_body=[]))
    SMX.update(kw)


def watch_html():
    player = {"playabilityStatus": {"status": "LOGIN_REQUIRED", "reason": "This video is private"} if SMX["private"] else {"status": "OK"},
              "videoDetails": {"videoId": VID, "title": "GTA RP Day 5 | Police chase 😂", "author": "StreamerX", "lengthSeconds": "3600", "isLiveContent": True}}
    if SMX["captions"]:
        player["captions"] = {"playerCaptionsTracklistRenderer": {"captionTracks": [
            {"baseUrl": "https://www.youtube.com/api/timedtext?v=" + VID + "&lang=hi&kind=asr", "languageCode": "hi", "kind": "asr"},
            {"baseUrl": "https://www.youtube.com/api/timedtext?v=" + VID + "&lang=en&kind=asr", "languageCode": "en", "kind": "asr"}]}}
    data = {"contents": {"twoColumnWatchNextResults": {}}}
    if SMX["chat"]:
        data["contents"]["twoColumnWatchNextResults"]["conversationBar"] = {"liveChatRenderer": {"continuations": [{"reloadContinuationData": {"continuation": "CONT0"}}]}}
    if SMX["heat"]:
        data["frameworkUpdates"] = {"entityBatchUpdate": {"mutations": [{"payload": {"macroMarkersListEntity": {"markersList": {"markerType": "MARKER_TYPE_HEATMAP", "markers": [
            {"startMillis": str(i * 36000), "durationMillis": "36000", "intensityScoreNormalized": 1.0 if i == 75 else 0.1} for i in range(100)]}}}}]}}
    return ('<html><script>window["ytInitialPlayerResponse"] = null;</script><script>var ytInitialPlayerResponse = ' + json.dumps(player) + ';var meta = {};</script>'
            '<script>ytcfg.set({"INNERTUBE_API_KEY":"KEY1","INNERTUBE_CONTEXT":{"client":{"clientName":"WEB","clientVersion":"2.20241101"}}});</script>'
            '<script>var ytInitialData = ' + json.dumps(data) + ';</script></html>')


def chat_page(start_ms):
    acts = []
    for k, off in enumerate(range(start_ms, start_ms + 60000, 2000)):
        n = 15 if 900000 <= off < 930000 else 1  # a chat spike at 15:00
        txt = "KEKW 😂 clip it" if n > 1 else "hello"
        acts.append({"replayChatItemAction": {"videoOffsetTimeMsec": str(off), "actions": [
            {"addChatItemAction": {"item": {"liveChatTextMessageRenderer": {"id": f"m{off}-{j}", "message": {"runs": [{"text": txt.split(" ")[0] + " "}, {"emoji": {"emojiId": "😂", "shortcuts": [":joy:"]}}, {"text": " clip it" if n > 1 else ""}]}}}}}
            for j in range(n)]}})
    nxt = start_ms + 60000
    conts = [{"liveChatReplayContinuationData": {"continuation": f"C:{nxt}"}}] if nxt < 3600000 else [{"playerSeekContinuationData": {"continuation": "END"}}]
    return {"continuationContents": {"liveChatContinuation": {"actions": acts, "continuations": conts}}}


def gemini_answer():
    ms = [{"start_sec": 2695, "end_sec": 2740, "title": "Bhai police ne pakad liya", "hook": "Jab plan fail ho jaye 😂", "why": "Most replayed peak 1.0", "score": 95},
          {"start_sec": 2700, "end_sec": 2745, "title": "Duplicate", "hook": "dup", "why": "dup", "score": 80},
          {"start_sec": 895, "end_sec": 940, "title": "KEKW moment", "hook": "Chat lost it", "why": "Chat x15 with KEKW", "score": 90},
          {"start_sec": 100, "end_sec": 90, "title": "Bad range", "hook": "h", "why": "w", "score": 40},
          {"start_sec": 5000, "end_sec": 5100, "title": "Past the end", "hook": "h", "why": "w", "score": 30},
          {"start_sec": "x", "end_sec": 5, "title": "Junk", "hook": "", "why": "", "score": 10}]
    return {"candidates": [{"content": {"parts": [{"text": json.dumps({"moments": ms})}]}, "finishReason": "STOP"}]}


def sm_fake(req: httpx.Request):
    u = str(req.url)
    if u.startswith(A.YT_WATCH):
        if SMX["watch_status"] != 200: return httpx.Response(SMX["watch_status"], text="Too many requests")
        assert "CONSENT=" in req.headers["cookie"] and req.headers["accept-language"].startswith("en")
        return httpx.Response(200, text=watch_html())
    if u.startswith("https://www.youtube.com/api/timedtext"):
        assert "lang=en" in u and "fmt=json3" in u  # English preferred over Hindi
        evs = [{"tStartMs": t * 1000, "dDurationMs": 4000, "segs": [{"utf8": f"line {t}"}]} for t in range(0, 3600, 10)]
        evs.append({"tStartMs": 2705000, "segs": [{"utf8": "bhai ye "}, {"utf8": "kya ho gaya"}]})
        evs.append({"tStartMs": 10, "aAppend": 1})  # event without text is skipped
        return httpx.Response(200, json={"events": evs})
    if u.startswith(A.YT_CHAT):
        assert "key=KEY1" in u
        b = json.loads(req.content)
        assert b["context"]["client"]["clientVersion"] == "2.20241101"
        c = b["continuation"]
        SMX["chat_calls"].append(c)
        if c == "CONT0":
            start = int(b["currentPlayerState"]["playerOffsetMs"]) if SMX["seek"] else 0
        else:
            start = int(c.split(":")[1])
        return httpx.Response(200, json=chat_page(start // 2000 * 2000))
    if u.startswith("https://generativelanguage.googleapis.com/"):
        assert req.headers["x-goog-api-key"] == "test-gemini-key" and "gemini-2.5-flash:generateContent" in u
        SMX["gemini_body"].append(json.loads(req.content))
        if SMX["gemini"] == "ok": return httpx.Response(200, json=gemini_answer())
        if SMX["gemini"] == "badkey": return httpx.Response(400, json={"error": {"message": "API key not valid. Please pass a valid API key."}})
        return httpx.Response(500, json={"error": {"message": "internal"}})
    return None


_fake_accounts = fake
A.http = lambda: httpx.AsyncClient(transport=httpx.MockTransport(lambda r: sm_fake(r) or _fake_accounts(r)))
SMH = {"x-toolsaku": "1", "origin": "http://testserver"}


def sm_post(c, url="https://youtu.be/" + VID, count=10, headers=SMH):
    return c.post("/api/stream-moments", headers=headers, json={"url": url, "count": count})


def test_sm_video_id_parsing():
    for u in [VID, "https://www.youtube.com/watch?v=" + VID + "&t=10s", "youtube.com/live/" + VID + "?si=x", "https://m.youtube.com/shorts/" + VID,
              "https://youtu.be/" + VID, "https://www.youtube.com/embed/" + VID]:
        assert A.yt_video_id(u) == VID, u
    for u in ["", "https://vimeo.com/123", "https://www.youtube.com/watch?v=short", "https://evil.com/watch?v=" + VID]:
        assert A.yt_video_id(u) == ""


def test_sm_parse_heatmap_both_layouts():
    new = {"x": [{"startMillis": "0", "durationMillis": "5000", "intensityScoreNormalized": 0.5}, {"startMillis": "5000", "durationMillis": "5000", "intensityScoreNormalized": 1}]}
    old = {"playerOverlays": {"markersMap": [{"key": "HEATSEEKER", "value": {"heatmap": {"heatmapRenderer": {"heatMarkers": [
        {"heatMarkerRenderer": {"timeRangeStartMillis": 10000, "markerDurationMillis": 5000, "heatMarkerIntensityScoreNormalized": 0.25}}]}}}}]}}
    assert A.parse_heatmap(new) == [(0.0, 5.0, 0.5), (5.0, 5.0, 1.0)]
    assert A.parse_heatmap(old) == [(10.0, 5.0, 0.25)]
    assert A.parse_heatmap({}) == []


def test_sm_parse_captions_and_chat():
    assert A.parse_json3({"events": [{"tStartMs": 1500, "segs": [{"utf8": "hi\n"}, {"utf8": " there"}]}, {"tStartMs": 9}]}) == [(1.5, "hi there")]
    msgs, nxt = A.parse_chat_page(chat_page(900000))
    assert nxt == "C:960000" and len(msgs) == 15 * 15 + 15
    assert msgs[0][0] == 900.0 and "KEKW" in msgs[0][2] and "😂" in msgs[0][2]
    assert A.parse_chat_page(chat_page(3540000))[1] is None  # end of replay
    sm_reset()
    player, data, key, ctx = A.parse_watch_page(watch_html())
    assert key == "KEY1" and ctx["client"]["clientName"] == "WEB" and A.chat_continuation(data) == "CONT0"
    assert A.parse_meta(player, VID)["duration_sec"] == 3600 and A.pick_caption_track(player)["languageCode"] == "en"


def test_sm_full_flow_ai_dedupe_fill_and_cache():
    sm_reset()
    with client() as c:
        r = sm_post(c, count=10)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["video"]["title"].startswith("GTA RP") and j["video"]["channel"] == "StreamerX" and j["video"]["duration_sec"] == 3600
        assert j["signals_used"] == {"heatmap": True, "captions": True, "chat": True}
        assert j["signal_detail"]["chat_coverage_pct"] > 90  # seeking spread the sample over the whole stream
        ms = j["moments"]
        assert len(ms) == 10 and [m["rank"] for m in ms] == list(range(1, 11))
        assert ms[0]["start_sec"] == 2695 and ms[0]["url"] == f"https://www.youtube.com/watch?v={VID}&t=2695s" and ms[0]["start"] == "44:55"
        assert ms[1]["start_sec"] == 895 and "Duplicate" not in [m["title"] for m in ms]
        for m in ms:
            assert 15 <= m["end_sec"] - m["start_sec"] <= 90 and 0 <= m["start_sec"] and m["end_sec"] <= 3600
        for a in ms:
            for b in ms:
                if a is not b: assert not A._overlaps(a, b), (a, b)
        assert any(m["title"].startswith("Hype spike") and m["source"] == "signal" for m in ms)
        # Gemini got JSON mode + schema and a compact prompt carrying all three signals
        g = SMX["gemini_body"][0]
        assert g["generationConfig"]["responseMimeType"] == "application/json" and g["generationConfig"]["responseSchema"]["required"] == ["moments"]
        prompt = g["contents"][0]["parts"][0]["text"]
        assert "KEKW" in prompt and "bhai ye kya ho gaya" in prompt and "|1.00|" in prompt and "Pick the 10 best" in prompt and len(prompt) < 200000
        assert len(SMX["chat_calls"]) <= A.SM_CHAT_MAX_REQ
        # second call is served from cache: no YouTube or Gemini traffic, no rate-limit hit
        n = len(SMX["chat_calls"])
        r2 = sm_post(c, count=10)
        assert r2.json()["cached"] is True and len(SMX["chat_calls"]) == n and len(SMX["gemini_body"]) == 1


def test_sm_chat_without_seek_reads_sequentially():
    sm_reset(seek=False)
    async def go():
        async with A.http() as h:
            return await A.fetch_chat(h, "CONT0", "KEY1", {"client": {"clientVersion": "2.20241101"}}, 3600)
    buckets, covered, n = A.asyncio.run(go())
    assert n > 0 and 0 in covered and buckets[30]["n"] == 225 and buckets[30]["kw"] > 225 and max(covered) >= 119
    assert len(SMX["chat_calls"]) <= A.SM_CHAT_MAX_REQ


def test_sm_missing_chat_and_captions_still_works_with_heatmap():
    sm_reset(chat=False, captions=False)
    with client() as c:
        j = sm_post(c, count=5).json()
        assert j["signals_used"] == {"heatmap": True, "captions": False, "chat": False} and len(j["moments"]) == 5


def test_sm_errors():
    with client() as c:
        sm_reset()
        assert sm_post(c, headers={}).status_code == 403
        assert sm_post(c, headers={"x-toolsaku": "1", "origin": "https://evil.example"}).status_code == 403
        r = sm_post(c, url="https://vimeo.com/1"); assert r.status_code == 400 and "YouTube link" in r.json()["detail"]
        sm_reset(watch_status=429)
        r = sm_post(c); assert r.status_code == 429 and r.json()["detail"] == "YouTube is rate-limiting the server, try again in a few minutes."
        sm_reset(private=True)
        r = sm_post(c); assert r.status_code == 403 and "private" in r.json()["detail"]
        sm_reset(chat=False, captions=False, heat=False)
        r = sm_post(c); assert r.status_code == 422 and "No signals" in r.json()["detail"]
        sm_reset(gemini="badkey")
        r = sm_post(c); assert r.status_code == 503 and "invalid" in r.json()["detail"]
        sm_reset(gemini="down")  # AI fails -> still useful: signal-ranked moments plus a warning
        r = sm_post(c, count=8); j = r.json()
        assert r.status_code == 200 and j["warning"] and len(j["moments"]) == 8 and all(m["title"].startswith("Hype spike") for m in j["moments"])
        sm_reset()
        key, A.GEMINI_API_KEY = A.GEMINI_API_KEY, ""
        try:
            r = sm_post(c); assert r.status_code == 503 and r.json()["detail"] == "AI key not set on server"
        finally:
            A.GEMINI_API_KEY = key


def test_sm_rate_limit():
    sm_reset()
    with client() as c:
        codes = [sm_post(c, count=5 + i).status_code for i in range(6)]  # different counts so the cache doesn't answer
        assert codes == [200] * 5 + [429]
        assert "Too many" in sm_post(c, count=99).json()["detail"]
        assert sm_post(c, count=5).json()["cached"] is True  # a cached answer is still served
