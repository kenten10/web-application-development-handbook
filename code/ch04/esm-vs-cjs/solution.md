# 模範解答 — 課題4.5

```bash
bash code/ch04/esm-vs-cjs/solution/main.sh
```

スクリプトは一時ディレクトリにESM/CJSの小さなプロジェクトを作り、次を再現します。

- ESM内の`import`は成功する
- ESM内でグローバル`require`を使うと失敗する
- CJS内の`require`は成功する
- `.cjs`内の静的`import`は構文エラーになる
- ESMからCJSをdefault importすると`module.exports`全体を受け取れる

相互運用の詳細はNode.jsバージョンで改善されることがあります。教材では拡張子`.mjs`/`.cjs`または`package.json`の`type`を明示し、暗黙の判定へ依存しません。
