# 模範解答 — 課題2.3

`../solution.ts` はNode.js標準の`http`モジュールだけで実装したインメモリAPIです。

```bash
# ルートから
rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02
node /tmp/ch02/blog-api/solution.js

curl -i http://127.0.0.1:3001/posts
curl -i -X POST http://127.0.0.1:3001/posts \
  -H 'content-type: application/json' \
  -d '{"title":"New","body":"Text"}'
curl -i -X PATCH http://127.0.0.1:3001/posts/1 \
  -H 'content-type: application/json' \
  -d '{"title":"Updated"}'
curl -i -X DELETE http://127.0.0.1:3001/posts/1
```

確認点:

- POSTは`201`と`Location`を返す
- PUTは全置換、PATCHは部分更新
- DELETE成功時は`204`で本文なし
- 不正JSON・入力不足は`400`
- 存在しないIDは`404`
