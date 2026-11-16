#!/usr/bin/env bash
# Toolsaku: gzip, cache headers, www/http -> https://toolsak.online (301), trending.json cron.
# Run on the VPS:  sudo bash <repo>/server/deploy/nginx-perf.sh   (safe to run again; restores the backup if nginx -t fails)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE=/etc/nginx/sites-available/toolsaku
D=toolsak.online
cp "$SITE" "$SITE.bak-$(date +%s)"

install -m 644 "$REPO/server/deploy/nginx-cache-map.conf" /etc/nginx/conf.d/toolsaku-cache-map.conf
install -m 644 "$REPO/server/deploy/nginx-perf.conf" /etc/nginx/snippets/toolsaku-perf.conf

# Include the perf rules next to the API include (the HTTPS block that serves the site).
if ! grep -q "snippets/toolsaku-perf.conf" "$SITE"; then
  sed -i -E 's#^([[:space:]]*)include snippets/toolsaku-api.conf;#&\n\1include snippets/toolsaku-perf.conf;#' "$SITE"
fi
# Certbot's port-80 block sends http://www to https://www; send everything straight to the main domain in one hop.
sed -i -E "s#return 301 https://\\\$host\\\$request_uri;#return 301 https://$D\\\$request_uri;#" "$SITE"

if nginx -t; then systemctl reload nginx; echo "nginx OK"; else
  echo "nginx test FAILED, restoring backup"; B="$(ls -t "$SITE".bak-* | head -1)"; cp "$B" "$SITE"
  rm -f /etc/nginx/conf.d/toolsaku-cache-map.conf; nginx -t && systemctl reload nginx; exit 1
fi

# trending.json: refresh every 3 hours (needs the YouTube API key in /etc/toolsaku/yt.key).
echo "17 */3 * * * root /usr/bin/python3 $REPO/server/trending.py >/dev/null 2>&1" > /etc/cron.d/toolsaku-trending
chmod 644 /etc/cron.d/toolsaku-trending
if [ -s /etc/toolsaku/yt.key ]; then python3 "$REPO/server/trending.py" || true
else echo "Note: /etc/toolsaku/yt.key is missing, so trending.json stays empty (the site answers 204, no error)."; fi

echo "== check"
curl -sI "https://$D/" | grep -iE "^(HTTP|cache-control|content-encoding)" || true
curl -sI -H "Accept-Encoding: gzip" "https://$D/" | grep -i content-encoding || true
curl -sI "https://www.$D/" | grep -iE "^(HTTP|location)" || true
curl -sI "http://$D/" | grep -iE "^(HTTP|location)" || true
