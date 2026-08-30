# 模範解答 — 課題8.2: ツリーシェイキングを観察する (★★)

- Purpose: 「使わないコードが消える」とはどういうことか、実物を見る。
- Implementation checklist:
- - 本文に記載された観察結果または振る舞いを確認できる。

## 本文掲載スニペット

```text
[bash]
# esbuild でバンドル
npx esbuild src/index.js --bundle --outfile=out/esbuild.js --minify
# Rollup
npx rollup src/index.js -o out/rollup.js -f esm
```
