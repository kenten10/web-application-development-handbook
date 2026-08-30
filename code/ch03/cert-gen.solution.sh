#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-certs}"
mkdir -p "$OUT_DIR"
KEY="$OUT_DIR/localhost-key.pem"
CERT="$OUT_DIR/localhost-cert.pem"

openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 7 \
  -keyout "$KEY" \
  -out "$CERT" \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -addext 'keyUsage=digitalSignature,keyEncipherment' \
  -addext 'extendedKeyUsage=serverAuth'

chmod 600 "$KEY"
openssl x509 -in "$CERT" -noout -subject -issuer -dates -ext subjectAltName
printf 'generated:\n  key:  %s\n  cert: %s\n' "$KEY" "$CERT"
