#!/usr/bin/env bash
# Point the site at a domain and turn on free HTTPS (Let's Encrypt).
# Run:  sudo bash <repo>/server/deploy/set-domain.sh yourdomain
set -euo pipefail
D="${1:?give the domain, e.g. toolsak.online}"
D="${D#https://}"; D="${D#http://}"; D="${D%%/*}"; D="${D#www.}"
SITE=/etc/nginx/sites-available/toolsaku
ENVF=/etc/toolsaku/api.env
echo "Domain: $D and www.$D"
for h in "$D" "www.$D"; do
  ip="$(getent hosts "$h" | awk '{print $1; exit}')"
  echo "  $h -> ${ip:-not found}"
  [ "$ip" = "45.195.129.69" ] || { echo "DNS for $h does not point to 45.195.129.69 yet. Wait and run again."; exit 1; }
done
cp "$SITE" "$SITE.bak-$(date +%s)"
if grep -qE '^[[:space:]]*server_name' "$SITE"; then
  sed -i -E "0,/^([[:space:]]*)server_name[^;]*;/s//\1server_name $D www.$D;/" "$SITE"
else
  sed -i -E "0,/^([[:space:]]*)listen[^;]*;/s//&\n\1server_name $D www.$D;/" "$SITE"
fi
nginx -t && systemctl reload nginx
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
certbot --nginx -d "$D" -d "www.$D" --redirect --agree-tos --register-unsafely-without-email --non-interactive
if [ -f "$ENVF" ]; then
  sed -i -E "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$D#" "$ENVF"
  systemctl restart toolsaku-api || true
fi
echo "HTTPS ready: https://$D  (certificate renews by itself)"
curl -s "https://$D/api/health" && echo
