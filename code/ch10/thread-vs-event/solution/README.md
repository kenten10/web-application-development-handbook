# 模範解答 — スレッドプール vs イベントループ

`main.mjs`は、イベントループ上で待機するI/O相当タスクと、libuvのスレッドプールで動く`crypto.pbkdf2`を同じ並列数で比較します。

```bash
node code/ch10/thread-vs-event/solution/main.mjs 32
UV_THREADPOOL_SIZE=8 node code/ch10/thread-vs-event/solution/main.mjs 32
```

I/O待機は多数を重ねてもほぼ同じ時間で終了します。一方、CPU処理はワーカープール数を超えると待ち行列が発生します。実測値はCPU、電源設定、Node.js版に依存するため、絶対値ではなく並列数を変えた傾向を評価します。
