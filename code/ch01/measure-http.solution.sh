#!/usr/bin/env bash
set -euo pipefail

# URLごとのDNS/TCP/TLS/TTFB/総時間をcurlで計測する。
# 使用例:
#   ./measure-http.solution.sh https://example.com https://www.github.com

if ! command -v curl >/dev/null 2>&1; then
  echo "curl が必要です。" >&2
  exit 1
fi

if (($# == 0)); then
  set -- https://example.com
fi

printf 'url,http_code,http_version,dns_s,tcp_s,tls_s,ttfb_s,total_s,size_bytes\n'
for url in "$@"; do
  curl --location --silent --show-error --output /dev/null \
    --write-out "${url},%{http_code},%{http_version},%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total},%{size_download}\n" \
    "$url"
done
