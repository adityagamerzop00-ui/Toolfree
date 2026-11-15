#!/usr/bin/env bash
# Toolsaku account API: one-time setup on the VPS (safe to run again).
# Run:  sudo bash <repo>/server/deploy/install.sh
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE=/etc/nginx/sites-available/toolsaku
ENVF=/etc/toolsaku/api.env
VENV=/opt/toolsaku-api/venv
echo "Repo: $REPO"

echo "== 1/6 packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-venv sqlite3 >/dev/null

echo "== 2/6 user and folders"
id toolsaku >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin toolsaku
install -d -m 755 /etc/toolsaku
install -d -m 700 -o toolsaku -g toolsaku /var/lib/toolsaku /var/lib/toolsaku/tmp

echo "== 3/6 python packages"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$REPO/server/api/requirements.txt"

echo "== 4/6 secrets file $ENVF"
if [ ! -f "$ENVF" ]; then
  KEY="$("$VENV/bin/python" -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())')"
  cat > "$ENVF" <<ENV
# Toolsaku API secrets. Never copy this file into the GitHub repo.
PUBLIC_URL=http://45.195.129.69
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
# Encrypts every saved token. If you lose or change it, everyone must connect again.
TOKEN_KEY=$KEY
DB_PATH=/var/lib/toolsaku/toolsaku.db
TMP_DIR=/var/lib/toolsaku/tmp
MAX_UPLOAD_MB=200
ENV
  echo "   created (new TOKEN_KEY generated)"
else
  echo "   exists, left as it is"
fi
chown root:root "$ENVF"; chmod 600 "$ENVF"

echo "== 5/6 systemd"
cat > /etc/systemd/system/toolsaku-api.service <<UNIT
[Unit]
Description=Toolsaku account API
After=network.target

[Service]
User=toolsaku
Group=toolsaku
EnvironmentFile=$ENVF
WorkingDirectory=$REPO/server/api
ExecStart=$VENV/bin/uvicorn app:app --host 127.0.0.1 --port 8787 --workers 1 --proxy-headers --forwarded-allow-ips 127.0.0.1
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/toolsaku

[Install]
WantedBy=multi-user.target
UNIT
# Restart the API automatically when the cron git pull brings new backend code.
cat > /etc/systemd/system/toolsaku-api-restart.service <<UNIT
[Unit]
Description=Restart Toolsaku API after a code update
[Service]
Type=oneshot
ExecStartPre=/bin/sleep 3
ExecStart=/bin/bash -c '$VENV/bin/pip install -q -r $REPO/server/api/requirements.txt; /bin/systemctl restart toolsaku-api.service'
UNIT
cat > /etc/systemd/system/toolsaku-api-restart.path <<UNIT
[Unit]
Description=Watch Toolsaku API code
[Path]
PathChanged=$REPO/server/api/app.py
PathChanged=$REPO/server/api/requirements.txt
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now toolsaku-api.service toolsaku-api-restart.path >/dev/null
systemctl restart toolsaku-api.service

echo "== 6/6 nginx"
install -m 644 "$REPO/server/deploy/nginx-api.conf" /etc/nginx/snippets/toolsaku-api.conf
if ! grep -q "snippets/toolsaku-api.conf" "$SITE"; then
  cp "$SITE" "$SITE.bak-$(date +%s)"
  # add the include right after every "root ...;" line (one per server block)
  sed -i -E 's#^([[:space:]]*)root[[:space:]]+[^;]+;#&\n\1include snippets/toolsaku-api.conf;#' "$SITE"
fi
if nginx -t 2>/dev/null; then systemctl reload nginx; else
  echo "nginx test FAILED, restoring backup"; B="$(ls -t "$SITE".bak-* | head -1)"; cp "$B" "$SITE"; nginx -t; exit 1
fi

sleep 2
echo "== check"
curl -s http://127.0.0.1:8787/api/health && echo
echo "Done. Next: put your Google / Meta keys in $ENVF, then: sudo systemctl restart toolsaku-api"
