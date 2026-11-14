#!/usr/bin/env python3
"""Fetch YouTube India trending videos and write trending.json next to index.html.
Runs on the VPS by cron. API key is read from /etc/toolsaku/yt.key (never commit it)."""
import json, os, sys, urllib.request, urllib.parse, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = open("/etc/toolsaku/yt.key").read().strip()
q = urllib.parse.urlencode({"part": "snippet,statistics", "chart": "mostPopular", "regionCode": "IN", "maxResults": 12, "key": KEY})
data = json.load(urllib.request.urlopen("https://www.googleapis.com/youtube/v3/videos?" + q, timeout=20))
items = [{"id": v["id"], "t": v["snippet"]["title"], "c": v["snippet"]["channelTitle"],
          "v": int(v.get("statistics", {}).get("viewCount", 0))} for v in data.get("items", [])]
if not items: sys.exit("no items")
tmp = os.path.join(ROOT, "trending.json.tmp")
json.dump({"at": int(time.time()), "items": items}, open(tmp, "w"), ensure_ascii=False)
os.replace(tmp, os.path.join(ROOT, "trending.json"))
print(len(items), "videos")
