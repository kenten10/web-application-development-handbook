# KEN-66 ブラウザ演習6件 検証レポート

## 結論

KEN-56で「管理制限により実行できない」として保留になっていたブラウザ演習6件を、実 Google Chrome 152.0.7977.65 を DevTools Protocol で自動操作して全件確認した。**6演習すべて PASS**、Console 重大エラー0件、Network 失敗0件、CSP違反0件。Service Worker の install→installed→activating→activated とオフラインフォールバック、および LCP・INP・FID・CLS の実測値をすべて取得した。

KEN-56 の `ken56-browser-smoke-results-final.json` で全件 `blocked` だった6演習は、本検証で `passed` に置き換わる。

実行方法はユーザーの手動 DevTools 操作ではなく、許可を得たうえでヘッドレス Chrome + CDP による自動代替検証とした。

## 検証環境

| 項目 | 値 |
|---|---|
| Chrome | Google Chrome 152.0.7977.65 (HeadlessChrome/152.0.0.0、`--headless=new`) |
| CDP プロトコル | 1.3 |
| Node.js | v26.7.0 (グローバル `WebSocket` / `fetch` を使用) |
| OS | darwin 25.6.0 arm64 |
| 自動化方式 | CDP を Node 標準 WebSocket で直叩き。**npm 依存は1件も追加していない** (Puppeteer 不使用、`pnpm-workspace.yaml`・`pnpm-lock.yaml` は未変更) |
| ネットワーク | localhost のみ。`--proxy-server=http://127.0.0.1:1` で非 loopback 宛を全遮断 (Chrome は loopback を既定でプロキシ迂回する) |
| セキュアコンテキスト | `http://localhost:<port>` を使用。Service Worker が必要とする secure context 条件を満たす (自己署名証明書は不要だった) |
| CSP 検証 | 検証サーバが全応答に `Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'` を付与。`securitypolicyviolation` イベントと `Log.entryAdded(source=security)` の両方を収集 |

## 演習別 結果一覧

| 演習 | ポート | 実測所要時間 | Console エラー | Console 警告 | Network 失敗 | CSP 違反 | 取得した計測値 | スクリーンショット | 判定 |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| 1.4 使用履歴の可視化 | 8641 (+8647) | 1.64秒 | 0 | 0 | 0 | 0 | DNS 0.000013s / TCP 0.000311s / TTFB 0.003380s / total 0.003621s (localhost)。棒グラフ8本・分類表8行。Document リクエスト: 通常リンク遷移 +1 / SPA遷移2回 +0 | `.verification/ken66/screenshots/1.4.png` | **PASS** |
| 4.1 レンダリングパイプライン計測 | 8642 | 2.44秒 | 0 | 0 | 0 | 0 | Bad 240ms / Better 1.5ms / Best 9.9ms、LayoutCount 1006、RecalcStyleCount 1014、LayoutDuration 0.2535s、**LCP 56ms / INP 248ms / FID 1ms / CLS 0** | `.verification/ken66/screenshots/4.1.png` | **PASS** |
| 4.2 DOM APIによるTodoアプリ | 8643 | 2.98秒 | 0 | 0 | 0 | 0 | 追加3件→`3件が未完了`、完了1件→`2件が未完了`、Active 2件 / Completed 1件 / All 3件、localStorage 3件が再読込後も保持、Ctrl+Enter で全完了→`0件が未完了`、削除後2件 | `.verification/ken66/screenshots/4.2.png` | **PASS** |
| 6.4 Web ComponentsによるCounter | 8644 | 0.88秒 | 0 | 0 | 0 | 0 | `customElements.get('my-counter')` 定義済、Shadow DOM `open`、initial=10 / step=2 で change イベント `[12, 14, 12]`、属性変更 initial=100 反映、`value=7` 反映、Shadow 内 button `min-width: 32px` / `:host` `inline-flex` (light DOM に漏れなし) | `.verification/ken66/screenshots/6.4.png` | **PASS** |
| 9.2 Service Workerによるオフライン対応 | 8645 | 3.10秒 | 0 | 0 | 0 | 0 | ライフサイクル `installing → installed → activating → activated`、scope `http://localhost:8645/`、App Shell 6件キャッシュ、offline 再読込で `offline.html` にフォールバック (CDP エミュレーション・サーバ停止の両方) | `.verification/ken66/screenshots/9.2-online.png`、`.verification/ken66/screenshots/9.2.png` | **PASS** |
| 24.5 Web Vitals計測 | 8646 | 3.62秒 | 0 | 0 | 0 | 0 | **LCP 72ms / INP 40ms / FID 0ms / CLS 0.0115**。入力直後のシフトは `hadRecentInput` により CLS から除外されることも確認 | `.verification/ken66/screenshots/24.5.png` | **PASS** |

合計所要時間: 14.65秒 (ブラウザ操作部のみ。`tsc` ビルドと Chrome 起動を含めた全体は約25秒)

## 演習別の詳細

### 1.4 自分のWebの「使用履歴」を可視化 — PASS

安全条件のため **実ブラウザ履歴は一切参照していない**。`.verification/ken66/fixtures/ex1_4/history.json` の検証専用ダミーデータ (8サイト、実在しない `*.localhost` 名) だけを使う。

- `code/ch01/measure-http.solution.sh` を localhost 3 URL に対して実行し、DNS / TCP / TLS / TTFB / total の CSV を取得 (`.verification/ken66/logs/1.4-measure-http.out`)。
- ダミー履歴を棒グラフ8本 + 分類表8行として描画できることを DOM 実測で確認。
- `solution.md` が求める「クリック時に Document リクエストが発生したか / URL 変更時にページ全体が再読込されたか」を CDP の `Network.requestWillBeSent` で機械的に判定した。通常リンク遷移では Document リクエストが1件増え、SPA の `history.pushState` 遷移2回では0件のまま URL と表示だけが `view=settings` に変わることを確認。

### 4.1 レンダリングパイプラインを計測する — PASS

`code/ch04/render-bench/index.solution.html` を localhost 配信し、Bad / Better / Best を実クリックで実行した。

- ページ内 `performance.measure`: Bad 240ms、Better 1.5ms、Best 9.9ms。教材の狙いどおり **Bad (強制同期レイアウト) が最も遅い**。
- DevTools Performance パネルの代替として CDP `Performance.getMetrics` を使用: LayoutCount 1006、RecalcStyleCount 1014、LayoutDuration 0.2535秒、RecalcStyleDuration 0.0070秒。1000要素に対する強制リフローが実際に約1000回発生していることが数値で確認できた。
- Web Vitals も併せて実測: LCP 56ms / INP 248ms (Bad 実行時の長いイベント処理を反映) / FID 1ms / CLS 0。

### 4.2 純粋なDOM APIでTodoアプリ — PASS

`code/ch04/todo-vanilla/solution/README.md` の手順どおり `tsc -p code/ch04/tsconfig.json` で `app.ts` を JS 化し (出力先だけ `.verification/ken66/build/ch04` に変更)、`index.html` を並置して localhost 配信した。

追加 / 完了切替 / 3種フィルター / localStorage 永続化 / Ctrl+Enter 全完了 / 削除 / `aria-live` の残件表示 / `aria-pressed` を、すべて実マウス・実キーイベント (`Input.dispatchMouseEvent` / `Input.insertText` / `Input.dispatchKeyEvent`) で操作して確認。再読込後も3件が復元される。

### 6.4 Web Components で型安全な Counter — PASS

Shadow DOM 内の `[part=increment]` / `[part=decrement]` の座標を実測して**実マウスクリック**を送り込んだ (JS からの `.click()` ではない)。

- `initial="10" step="2"` から +2 → +2 → −2 で `change` イベントの detail が `[12, 14, 12]`、light DOM の `<output id="log">` が `12` に追随。
- `setAttribute('initial', '100')` で `attributeChangedCallback` 経由の再描画、`counter.value = 7` でプロパティ経由の書き込みも確認。
- スタイル隔離: Shadow 内 `button` の `min-width` は `2rem`(=32px) だが light DOM に `button` は存在せず、`:host{display:inline-flex}` がホストに適用されている。

### 9.2 Service Worker でオフライン対応 — PASS

`main.js` の `APP_SHELL` が `/index.html` など絶対パスなので、`code/ch09/pwa-service-worker/solution` を**サーバのルート**として配信した (`http://localhost:8645/`)。`http://localhost` は secure context のため Service Worker が登録できる。

- ライフサイクルを2系統で確認 — ページ側の `ServiceWorkerRegistration` / `statechange` フック: `installing → installed → activating → activated`。CDP `ServiceWorker.workerVersionUpdated`: `new → installing → installed → activating → activated`。
- `caches.open('webbook-v1')` に App Shell 6件 (`/`, `/app.js`, `/index.html`, `/manifest.webmanifest`, `/offline.html`, `/style.css`) がキャッシュ済み。
- SW 制御下の再読込で `navigator.serviceWorker.controller` が有効になり、画面ステータスが `offline ready` に変わることを確認。
- **オフライン確認は2通り実施し、両方で `offline.html` (「オフラインです」) にフォールバックした**:
  1. `Network.emulateNetworkConditions(offline: true)` を page ターゲットと service_worker ターゲットの計3セッションへ適用して再読込。
  2. HTTP サーバプロセス自体を停止して再読込 (真のネットワーク断)。
- オフライン状態でも `caches.match('/style.css')` が成功する。

> 補足: 1つ目だけでは、Service Worker が別ターゲットで動くため page セッションのみのオフライン設定が SW の `fetch` に効かない可能性がある。そのため SW ターゲットにも明示的に適用し、さらにサーバ停止で二重に裏を取っている。

### 24.5 Web Vitals 計測スクリプト (LCP/FID/CLS) — PASS

`code/ch24/web-vitals.solution.html` を localhost 配信し、教材ページ自身の `PerformanceObserver` と、検証側が注入した独立の Observer の**両方**で同じ値を得た。

| 指標 | 実測値 | 取得方法 |
|---|---:|---|
| LCP | 72 ms | `largest-contentful-paint` (buffered) |
| INP (event duration) | 40 ms | `event` (durationThreshold 16)。`#interact` の 35ms ブロッキング処理を反映 |
| FID | 0 ms | `first-input` の `processingStart - startTime` |
| CLS | 0.0115 | `layout-shift` の `hadRecentInput === false` のみ加算 |

CLS は入力に依らないプログラム起因のシフト (`.shift` の `margin-top` 変更) で計上させた。その後 `#shift` ボタンを実クリックして起こしたシフトでは値が `0.0115` のまま変わらず、**`hadRecentInput` によるユーザー入力直後のシフト除外**が正しく働くことも確認した。

## 発見した不具合と対処

### 教材コード側の不具合

**なし。** 6演習の模範解答はいずれも無修正で期待どおり動作した。`code/` 配下のファイルは1バイトも変更していない (`tsc` の出力先を `.verification/ken66/build/` に向けただけ)。

### 検証ハーネス側で修正した点

| # | 事象 | 原因 | 対処 |
|---|---|---|---|
| 1 | 全6演習で `Failed to load resource: 404 (Not Found)` が Console エラーとして計上され、初回実行が6件とも FAIL になった | Chrome があらゆるページに対して自動要求する `/favicon.ico` に、教材側がファイルを持たない。演習コードの不具合ではなく検証ハーネス由来のノイズ | 検証サーバが `/favicon.ico` にだけ `204 No Content` を返すようにした (`.verification/ken66/lib/server.mjs`)。ログには `-> 204 (harness stub)` と明記して区別できるようにしてある |
| 2 | 4.1 で `Performance.getMetrics` の `LayoutCount` が 0 になった | `Performance.enable` を計測後に呼んでいたため、カウンタがナビゲーション以降を積算していなかった | ページセッション初期化時 (ナビゲーション前) に `Performance.enable` するよう修正。以後 LayoutCount 1006 が取れている |
| 3 | Chrome の外部通信遮断に `--proxy-bypass-list=<-loopback>` を指定していた | `<-loopback>` は「loopback もプロキシ経由にする」という逆の意味で、localhost まで遮断してしまう | 当該オプションを削除。Chrome は既定で loopback をプロキシ迂回するため、`--proxy-server=http://127.0.0.1:1` だけで「localhost だけ到達可能」を実現できる |

### 教材コードに関する観察 (不具合ではない)

- **9.2 の初回ロード時のステータス表示**: `app.js` は `registration.active ? 'offline ready' : 'installing'` を登録解決時に一度だけ評価するため、初回ロードでは `installing` のまま更新されない。2回目のロードでは `offline ready` になる。Service Worker のライフサイクル上は正しい挙動で、オフライン動作にも影響しないため修正していない。
- **1.4 の `measure-http.solution.sh` の既定引数**: 引数省略時は `https://example.com` を計測する。演習本来の趣旨としては妥当だが、KEN-66 の「localhost だけを使用する」安全条件とは両立しないため、本検証では localhost の URL を明示的に渡して実行した。教材側は変更していない。

## 完了条件の充足根拠

| KEN-66 の完了条件 | 充足状況 | 根拠 |
|---|---|---|
| 6演習すべてで README の期待動作を確認 | 充足 | 6/6 PASS。各演習で README / solution.md 記載の操作 (Bad/Better/Best、追加・完了・フィルター・削除、Shadow DOM のボタン操作、オフライン再読込、Web Vitals 取得) を CDP の実入力イベントで実行。演習別チェック計66項目すべて PASS。`ken66-browser-verification-results.json` の `checks` 配列に個別記録 |
| 各演習についてスクリーンショットまたは短い画面録画を添付 | 充足 | PNG 7枚 (9.2 のみオンライン/オフラインの2枚)。`.verification/ken66/screenshots/` |
| Console と Network の重大エラーが0件 | 充足 | 全6演習で `Runtime.consoleAPICalled(error/assert)` + `Runtime.exceptionThrown` + `Log.entryAdded(level=error)` = 0件、`Network.loadingFailed` = 0件。CSP (Report-Only) 違反も0件。9.2 のオフライン検証フェーズで発生しうる失敗は `phase` タグで分離して集計しており、実際には0件だった |
| Service Worker の install・activate・offline fallback を確認 | 充足 | `installing → installed → activating → activated` をページ側フックと CDP `ServiceWorker.workerVersionUpdated` の2系統で確認。offline fallback は CDP エミュレーションとサーバ停止の2方式で `offline.html` の表示を確認 |
| LCP・FID または INP・CLS の計測結果を記録 | 充足 | 24.5: LCP 72ms / INP 40ms / FID 0ms / CLS 0.0115。4.1: LCP 56ms / INP 248ms / FID 1ms / CLS 0 |
| 使用ポートと実測所要時間を記録 | 充足 | 8641〜8646 (+1.4 の HTTP 計測用 8647)。所要時間は上表および JSON の `elapsedSec` |
| localhost だけを使用する | 充足 | サーバは全て `127.0.0.1` にバインド。Chrome は `--proxy-server=http://127.0.0.1:1` で非 loopback 宛を遮断。CSP Report-Only (`default-src 'self'`) の違反0件が、外部オリジンへの読み込みが1件も無かったことの裏付けになる |
| ブラウザ履歴演習には検証用データだけを使用する | 充足 | `fixtures/ex1_4/history.json` の架空8サイトのみ。実ブラウザ履歴 API・プロファイルは一切参照していない。Chrome は毎回使い捨ての一時 `--user-data-dir` で起動し、終了時に削除している |
| 個人の実ブラウザ履歴や秘密情報を添付しない | 充足 | 成果物は検証用ダミーデータ・localhost URL・計測値のみ。個人情報・認証情報は含まない |

## 生成したファイル

| パス | 内容 |
|---|---|
| `ken66-browser-verification-results.json` | 機械可読な検証結果 (`ken56-browser-smoke-results-final.json` の後継。演習ごとの verdict / port / elapsedSec / エラー件数 / metrics / checks / screenshot) |
| `KEN66_BROWSER_VERIFICATION_REPORT.md` | 本レポート |
| `.verification/ken66/run-ken66.sh` | 再実行用エントリポイント (tsc ビルド → 1.4 の HTTP 計測 → CDP 検証 → 後片付け) |
| `.verification/ken66/verify.mjs` | 6演習のブラウザ検証本体 |
| `.verification/ken66/lib/cdp.mjs` | 依存ゼロの CDP クライアント (Node グローバル WebSocket 使用) |
| `.verification/ken66/lib/server.mjs` | localhost 専用の静的配信サーバ (CSP Report-Only 付与、favicon スタブ) |
| `.verification/ken66/fixtures/ex1_4/` | 1.4 用の検証専用ダミーデータと可視化ページ (`history.json` / `index.html` / `static.html` / `spa.html`) |
| `.verification/ken66/logs/*.out` | 演習別ログ、環境情報、Chrome バージョン、1.4 の HTTP 計測 CSV、full-run ログ、cleanup 結果 |
| `.verification/ken66/screenshots/*.png` | 証跡スクリーンショット7枚 |
| `.verification/ken66/build/ch04/` | 4.2 用の `tsc` 出力 (中間生成物。配布対象外) |

## 再実行方法

```bash
bash .verification/ken66/run-ken66.sh
# headful Chrome で目視したい場合
KEN66_HEADFUL=1 bash .verification/ken66/run-ken66.sh
# Chrome のパスを変えたい場合
CHROME_BIN=/path/to/chrome bash .verification/ken66/run-ken66.sh
```

`run-ken66.sh` は `trap cleanup EXIT` で、起動した HTTP サーバと `ken66-chrome-*` プロファイルの Chrome を必ず終了させ、8641〜8647 のリスナが0件であることを `logs/cleanup.txt` に記録する。最終実行時の記録は全ポート0件・残存プロセス0件だった。

## 積み残し・ブロッカー

- **なし (KEN-66 の範囲)**。6演習すべてを実際にブラウザで動かし、完了条件をすべて満たした。
- 留意点として、本検証は `--headless=new` で実施している。ヘッドレスとヘッドフルではコンポジット処理などが異なるため、LCP・INP・CLS の**絶対値**は headful 実行や別マシンで変動する。値そのものではなく「計測値が取得できること」「Bad が最も遅いこと」「`hadRecentInput` で除外されること」といった性質を判定条件にしてある。目視確認したい場合は `KEN66_HEADFUL=1` で再実行できる。
- `.verification/ken66/build/` は `tsc` の中間生成物であり、配布対象外 (各章 README の「配布対象外」規定に従う)。
- Linear の status 更新は本作業では行っていない (管理側の運用に従う)。
