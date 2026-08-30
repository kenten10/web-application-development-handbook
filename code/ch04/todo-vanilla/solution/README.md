# 模範解答 — 課題4.2

`index.html`と`app.ts`に、状態とDOM描画を分けた最小Todoアプリを実装しています。

```bash
rm -rf /tmp/ch04 && tsc -p code/ch04/tsconfig.json --outDir /tmp/ch04
cp code/ch04/todo-vanilla/solution/index.html /tmp/ch04/todo-vanilla/solution/
cd /tmp/ch04 && python3 -m http.server 8080
# http://127.0.0.1:8080/todo-vanilla/solution/ を開く
```

追加、削除、完了切替、3種類のフィルター、localStorage、Esc、Ctrl/Cmd+Enter、`aria-live`とフォーカス復帰を確認します。
