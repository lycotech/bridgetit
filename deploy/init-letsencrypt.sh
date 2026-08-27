#!/usr/bin/env bash
# One-time bootstrap for the Let's Encrypt certificate on a fresh VPS.
#
# Why this dance: the webapp container's nginx config always references
# /etc/letsencrypt/live/$DOMAIN/{fullchain,privkey}.pem for its 443 server
# block, but nginx refuses to start at all if those files don't exist yet —
# and Let's Encrypt's HTTP-01 challenge needs nginx running on port 80 to
# prove domain ownership before it will issue the real certificate. So: put
# a throwaway self-signed cert in place first (just to let nginx start),
# request the real one over the now-working HTTP-01 challenge, then delete
# the throwaway and reload nginx with the real cert.
#
# Usage: ./deploy/init-letsencrypt.sh yourdomain.com you@example.com
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 2 ]; then
  echo "Usage: $0 <domain> <email>" >&2
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
RSA_KEY_SIZE=4096

if [ ! -f .env ] || ! grep -q "^DOMAIN=${DOMAIN}$" .env 2>/dev/null; then
  echo "DOMAIN=${DOMAIN}" > .env
fi

echo "### Creating a temporary self-signed certificate for ${DOMAIN} ..."
docker compose run --rm --entrypoint "\
  mkdir -p /etc/letsencrypt/live/${DOMAIN} && \
  openssl req -x509 -nodes -newkey rsa:${RSA_KEY_SIZE} -days 1 \
    -keyout '/etc/letsencrypt/live/${DOMAIN}/privkey.pem' \
    -out '/etc/letsencrypt/live/${DOMAIN}/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx (webapp) and backend ..."
docker compose up -d --build backend webapp

echo "### Deleting the temporary certificate ..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/${DOMAIN} \
         /etc/letsencrypt/archive/${DOMAIN} \
         /etc/letsencrypt/renewal/${DOMAIN}.conf" certbot

echo "### Requesting the real Let's Encrypt certificate for ${DOMAIN} and www.${DOMAIN} ..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email ${EMAIL} -d ${DOMAIN} -d www.${DOMAIN} \
    --rsa-key-size ${RSA_KEY_SIZE} \
    --agree-tos --non-interactive" certbot

echo "### Reloading nginx with the real certificate ..."
docker compose exec webapp nginx -s reload

echo "### Starting the certbot auto-renew service ..."
docker compose up -d certbot

echo "### Done. https://${DOMAIN} should now be serving a valid certificate."
