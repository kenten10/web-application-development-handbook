# 模範解答 — 課題7.3 楽観的更新

`optimistic-update.ts` は「確定状態」と「未確定操作列」を分離します。各操作はUIへ即時反映され、成功時は確定状態へ取り込まれ、失敗時はその操作だけが除外されます。連続操作が並行していても、別操作の成功結果を巻き戻しません。

```typescript
const store = new OptimisticStore({ count: 0 });
store.subscribe((state) => console.log('UI:', state.count));
store.onError((error) => console.error('toast:', error.message));

await store.mutate(
  (state) => ({ count: state.count + 1 }),
  flakyServer(0.3),
);
```

実行確認:

```bash
pnpm --filter @handbook/ch07 run build
node --test code/ch07/dist/solutions.test.js
```

確認項目は、送信完了前に値が変わること、失敗時に元へ戻ること、複数操作のうち失敗した操作だけが除外されること、`onError`で利用者へ通知できることです。
