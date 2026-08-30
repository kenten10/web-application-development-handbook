# 模範解答 — 課題3.3

```bash
bash code/ch03/cert-gen.solution.sh certs
rm -rf /tmp/ch03 && tsc -p code/ch03/tsconfig.json --outDir /tmp/ch03
TLS_KEY=certs/localhost-key.pem \
TLS_CERT=certs/localhost-cert.pem \
node /tmp/ch03/https-server.solution.js
```

別のターミナルで確認します。

```bash
curl -k https://localhost:3443/
openssl s_client -connect localhost:3443 -servername localhost </dev/null
```

`curl -k`なしで失敗するのは、自己署名証明書の発行者がOSやcurlの信頼ストアに登録されていないためです。検証を無効にするのではなく、演習用CAまたはこの証明書を明示的に指定する方法もあります。

```bash
curl --cacert certs/localhost-cert.pem https://localhost:3443/
```

秘密鍵は教材ディレクトリへコミットせず、localhostまたは隔離環境だけで使います。
