# 模範解答 — 課題2.4

同一のTLSサーバを`allowHTTP1: true`で起動し、HTTP/1.1は最大6ソケット、HTTP/2は1セッション上の100ストリームとして比較します。

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout certs/localhost-key.pem \
  -out certs/localhost-cert.pem \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'

rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02
node /tmp/ch02/benchmark/solution/server.js
# 別ターミナル
node /tmp/ch02/benchmark/solution/client.js
```

比較時は、`COUNT`、HTTP/1.1の`maxSockets`、遅延、CPU、キャッシュ、TLSセッション再利用を固定します。単一回の値ではなく、ウォームアップ後に複数回実行して中央値とp95を記録してください。
