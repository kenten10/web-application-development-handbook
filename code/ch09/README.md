# 第9章 レンダリング戦略 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch09 run lint
pnpm --filter @handbook/ch09 run typecheck
pnpm --filter @handbook/ch09 run test
pnpm --filter @handbook/ch09 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 9.1 課題9.1: 4方式の Todo アプリ実装と性能比較 (★★★) | — (観察課題) | — (観察記録) | ★★★ | 150分 | localhost, Chrome |
| 9.2 課題9.2: Service Worker でオフライン対応 (★★) | `pwa-service-worker/starter/main.js` | `pwa-service-worker/solution/main.js`<br>`pwa-service-worker/solution/index.html`<br>`pwa-service-worker/solution/app.js`<br>`pwa-service-worker/solution/style.css`<br>`pwa-service-worker/solution/offline.html`<br>`pwa-service-worker/solution/manifest.webmanifest` | ★★ | 90分 | なし |
| 9.3 課題9.3: 簡易 SSR フレームワークを書く (★★★) | `mini-ssr/starter/main.ts` | `mini-ssr/solution/main.ts`<br>`mini-ssr/solution/pages/index.ts`<br>`mini-ssr/solution/pages/about.ts` | ★★★ | 150分 | localhost |

## 課題詳細

### 9.1 課題9.1: 4方式の Todo アプリ実装と性能比較 (★★★)

**目的**: CSR/SSR/SSG/PWA の挙動の違いを実測で確認。

**難易度**: ★★★

**推定時間**: 150分 (4方式の実装と条件そろえに70分、TTFB・HTML サイズの計測に25分、Lighthouse と Performance での FCP/TTI/ハイドレーション計測に35分、オフライン確認と表の考察記述に20分)

**必要サービス**: localhost, Chrome

**前提**

- 9.1 CSR (Client-Side Rendering)、9.2 SSR (Server-Side Rendering)、9.3 SSG (Static Site Generation) を読み、HTML の生成時点とデータ取得位置の違いを説明できる状態にする
- 9.8 同じ Todo アプリを CSR / SSR / SSG で実装比較 を読み、同一機能を方式だけ変えて比較する条件を把握しておく
- Chrome DevTools の Network、Performance、Lighthouse パネルを開いて計測できる
- `curl` が使え、ローカルで4つのポートを同時に立ち上げられる

**完成条件 (自己採点用チェックリスト)**

- [ ] Todo 一覧・追加・完了切替の同一機能を CSR、SSR、SSG、PWA の4方式で動かせる状態にする
- [ ] 4方式でデータ件数、スタイル、ネットワーク条件 (DevTools のスロットリング設定) をそろえて計測している
- [ ] FCP、TTI、HTML サイズ、サーバ処理時間、オフライン可否、ハイドレーション時間の6項目を4方式ぶん表に埋めている
- [ ] SSR と SSG では初期 HTML の中に Todo のテキストが含まれ、CSR では含まれないことを HTML ソースで確認している
- [ ] PWA 版だけがネットワークを切っても一覧を表示できることを確認している
- [ ] 初期表示・SEO・動的更新それぞれで有利な方式と、その理由を計測値を根拠に書き出している

**期待出力**

- CSR の初期 HTML は空のコンテナのみで、`curl` で取得したバイト数が他方式より明確に小さい
- SSR と SSG の初期 HTML には Todo の件数と同じ数の `<li>` が含まれる
- SSG の TTFB が最も小さく、SSR は毎リクエストの生成時間ぶんだけ大きい値になる
- オフラインにすると CSR・SSR・SSG は失敗し、PWA だけがキャッシュから一覧を返す
- CSR を除く3方式でハイドレーション時間が Performance パネルのスクリプト実行区間として観測できる

**観察項目**

- 各方式のページで JavaScript を無効化して再読み込みし、何が表示され何が消えるかを比べる
- DevTools の Network で Slow 4G のスロットリングをかけ、方式間の初期表示差が拡大することを確認する
- Performance パネルで、SSR 版の First Paint とインタラクション可能になる時点の間にハイドレーションの区間があることを確認する
- Todo を追加したときのリクエスト数と再描画範囲を Network と Elements で比べ、更新の得意不得意を記録する
- SSG 版でビルド後にデータだけ変更し、再ビルドするまで内容が古いままであることを確認する

**テスト方法 (自己採点手順)**

1. 各方式に対し `curl -s -o /dev/null -w "ttfb=%{time_starttransfer} size=%{size_download}\n" http://localhost:<port>/` を実行し、TTFB と HTML サイズが表に転記できれば計測手順は成立している
2. `curl -s http://localhost:<port>/ -o page.html` で初期 HTML を保存し `grep -c "<li>" page.html` を4方式で実行して、CSR が 0、SSR と SSG が Todo 件数と一致すれば生成時点の判定は正しい
3. DevTools の Lighthouse を同一条件 (モバイル、スロットリングあり) で4方式へ実行し、FCP と TTI が表に埋まれば合格
4. DevTools の Network で Offline にチェックを入れて再読み込みし、PWA 版だけが一覧を描画できれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に「変えない条件」を固定する。Todo の件数、スタイル、フォント、スロットリング設定、計測回数を決めてから実装に入らないと、あとの数値が比較不能になる
2. 構造: SSR 版は `code/ch09/mini-ssr/solution/main.ts` の `renderPage` と `startServer` を、PWA 版は `code/ch09/pwa-service-worker/solution/main.js` を土台にできる。CSR 版は同じ描画関数をブラウザ側で呼び、SSG 版はビルド時に同じ関数で HTML を書き出す形にすると、方式以外の差が消える
3. 実装の要点: 計測は1回では判断しない。各方式5回計測して中央値を採り、ブラウザのキャッシュを毎回クリアする。キャッシュを残したまま2回目を測ると、SSG と PWA が不当に速く見える

**本番利用時の警告**

- この比較は認証、CDN、実データ量、同時アクセスを含まない最小例で、計測はローカルの1台に閉じている。ここで出た順位をそのまま本番アーキテクチャの選定根拠にすると、CDN キャッシュ率やサーバ負荷という支配的な要因を見落とす
- 計測用に立てた4つのサーバは認証もレート制限も持たない。localhost バインドのまま実行し、外部公開したりデータに実在の個人情報を入れたりしない

**導線**

- コード成果物はありません。本文の手順に従って観察し、記録を完成条件と照合します。
- 本文: `03-part2-frontend.md`

### 9.2 課題9.2: Service Worker でオフライン対応 (★★)

**目的**: PWA の核となる Service Worker を自前で実装する。

**難易度**: ★★

**推定時間**: 90分 (install と activate のキャッシュ管理に30分、fetch の分岐と stale-while-revalidate に35分、オフライン遷移と更新経路の DevTools 検証に25分)

**必要サービス**: なし

**前提**

- 9.10 PWA (Progressive Web Apps) ― Webをアプリ化する を読み、install / activate / fetch のライフサイクルを把握しておく
- Service Worker が localhost か HTTPS でのみ登録できることを理解している
- 静的ファイルを HTTP で配信する手段 (`python3 -m http.server` など) が使える
- `pnpm --filter @handbook/ch09 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch09/pwa-service-worker/starter/main.js` に install イベントを実装し、HTML・CSS・JavaScript・オフライン用ページを含むアプリシェルを1つのキャッシュへ登録する
- [ ] activate イベントで現行バージョン以外のキャッシュを削除して `clients.claim()` を呼び、`message` の `SKIP_WAITING` で待機中の新バージョンを即時有効化できる
- [ ] fetch イベントで GET かつ同一オリジンのリクエストだけを扱い、それ以外は素通しする
- [ ] ナビゲーションリクエスト (`request.mode === 'navigate'`) が失敗したときに `offline.html` を返す
- [ ] 静的アセットは stale-while-revalidate で、キャッシュを即返しつつ裏で更新する
- [ ] `manifest.webmanifest` を用意し、`display` が `standalone` になっている

**期待出力**

- テスト `service worker includes cache lifecycle, offline navigation, and update path` が pass する
- 初回アクセス後、DevTools の Application → Cache Storage に指定したキャッシュ名のエントリが並ぶ
- Application → Service Workers に登録済みの Worker が `activated and is running` と表示される
- Network を Offline にして再読み込みしても一覧が表示され、未キャッシュのページへ遷移すると `offline.html` が表示される
- Service Worker のバージョンを上げて再読み込みすると、旧キャッシュが activate 時に削除される

**観察項目**

- DevTools の Application → Service Workers で `waiting to activate` の状態を作り、`SKIP_WAITING` を送る前後で制御タブが切り替わる瞬間を確認する
- Network タブの Size 列で、Service Worker から返されたレスポンスが `(ServiceWorker)` 表記になることを確認する
- stale-while-revalidate の裏側の更新リクエストが、画面表示より後に飛んでいることを Network の時系列で確認する
- POST リクエストを発行し、fetch ハンドラが介入せずネットワークへ素通しされることを確認する
- キャッシュ名を変えずにファイルだけ更新し、古い内容が返り続ける現象を再現してバージョニングの必要性を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch09 run test` を実行し、Service Worker のテストが pass すれば、必要なライフサイクルと offline 経路がソースに揃っている
2. `python3 -m http.server 8080 --directory code/ch09/pwa-service-worker/solution` を起動し、`http://localhost:8080/index.html` を開いて Application → Service Workers が activated になれば登録は成功
3. DevTools の Network で Offline にチェックを入れて再読み込みし、アプリシェルが表示されれば合格
4. Application → Storage の Clear site data で全消去してから再度アクセスし、初回キャッシュが再構築されれば合格
5. Manifest、Service Worker、オフライン遷移、更新、インストール導線を個別に確認し、単一のスコアだけで合否を決めない

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3つのイベントを一度に書かない。まず install で `cache.addAll` が成功することだけを DevTools の Cache Storage で確認し、それから fetch の介入を足す
2. 構造: `caches.open(CACHE_VERSION)` を軸に、install は addAll、activate は `caches.keys()` の差分削除、fetch は `caches.match` とネットワークの組み合わせ、と役割を1つずつ対応させる。stale-while-revalidate は「キャッシュを返す」と「裏で fetch して put する」の2本を並行させる形になる
3. 実装の要点: `response.clone()` を忘れるとボディが二重読み取りになって落ちる。また裏側の更新 fetch の失敗は必ず catch で握りつぶさないと、オフライン時に未処理拒否が積み上がる

**本番利用時の警告**

- Service Worker はオリジン全体のリクエストを横取りする。認証済みレスポンスや個人情報を含む API 応答をキャッシュすると、同じ端末の別ユーザーやログアウト後に内容が露出する。キャッシュ対象は静的アセットに限定する
- 登録した Service Worker はキャッシュを消しても残り続ける。バージョニングと `activate` での旧キャッシュ削除を誤ると、利用者の端末に古いアプリが固定され、修正版を配れなくなる
- 検証は必ず localhost か自分が管理するオリジンで行う。他人のサイトを対象にキャッシュ挙動を試すことはできず、試みるべきでもない

**導線**

- 開始地点: `pwa-service-worker/starter/main.js`
- 模範解答: `pwa-service-worker/solution/main.js`、`pwa-service-worker/solution/index.html`、`pwa-service-worker/solution/app.js`、`pwa-service-worker/solution/style.css`、`pwa-service-worker/solution/offline.html`、`pwa-service-worker/solution/manifest.webmanifest`

### 9.3 課題9.3: 簡易 SSR フレームワークを書く (★★★)

**目的**: Next.js 風のミニ SSR フレームワークを作る。

**難易度**: ★★★

**推定時間**: 150分 (ルート導出とページ探索の実装に45分、renderPage と props シリアライズに45分、HTTP サーバと 404/500 の分岐に35分、curl とテストによる検証に25分)

**必要サービス**: localhost

**前提**

- 9.2 SSR (Server-Side Rendering) を読み、サーバでの HTML 生成とクライアントのハイドレーションの分担を説明できる状態にする
- 9.7 戦略の選択基準 を読み、リクエストごとにデータ取得する方式の適用条件を確認しておく
- Node.js の `http` サーバと動的 `import()` によるモジュール読み込みを書ける
- `pnpm --filter @handbook/ch09 run test` が実行できる状態にしておく

**完成条件 (自己採点用チェックリスト)**

- [ ] `code/ch09/mini-ssr/starter/main.ts` にファイル名からルートを導く関数を実装し、`index` が `/`、`about` が `/about`、`blog/index` が `/blog` になる
- [ ] ページディレクトリを再帰的に走査して default export を持つモジュールだけをルート表へ登録し、default export が無いファイルではエラーを投げる
- [ ] `getServerSideProps(context)` があれば await し、その `props` を default export の関数へ渡して HTML 本体を得る
- [ ] 生成した HTML に props を JSON として埋め込んでハイドレーション用マーカーを出力し、`<`、`>`、`&` をエスケープして `</script>` を含む値でも HTML が壊れない
- [ ] 登録の無いパスへ 404 を返し、ページ関数が例外を投げたときは 500 を返す
- [ ] `solutions.test.ts` の import を自分の実装へ向けた状態で `pnpm --filter @handbook/ch09 run test` が全件パスする

**期待出力**

- テスト `routeFromFilename implements file-based routes`、`SSR renders props and hydration marker`、`SSR server returns page and 404`、`discoverPages loads default-exported modules` の4件が pass する
- クエリ `?name=Alice` を付けたリクエストで、返る HTML に `Hello Alice` が含まれる
- 返る HTML に `__SSR_PROPS__` と `__HYDRATED__` の2つのマーカーが含まれる
- `/` が 200 とページ HTML を返し、`/missing` が 404 を返す
- `discoverPages` が `/` と `/about` の2ルートを持つ Map を返す

**観察項目**

- `curl` で取得した HTML ソースを見て、Todo の中身がクライアント JavaScript の実行前から含まれていることを確認する
- `getServerSideProps` を持たないページと持つページを両方置き、props が空オブジェクトになる経路を確認する
- props の値に `</script>` を含む文字列を入れ、エスケープが無い場合に HTML が途中で切れることを再現してからエスケープを戻す
- ページモジュールを import する際のクエリ (ファイル更新時刻) を外し、ファイルを書き換えてもサーバ再起動まで反映されなくなることを確認する
- `getServerSideProps` の中で意図的に例外を投げ、500 応答とサーバログの対応を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch09 run test` を実行し、mini SSR の4テストが pass すれば合格
2. `pnpm --filter @handbook/ch09 run typecheck` を実行し、`PageModule` と `PageContext` の型でエラー0件なら合格
3. `curl -s "http://127.0.0.1:<port>/?name=Alice" -o ssr.html` で保存した HTML に対する `grep -c "Hello Alice" ssr.html` が 1 を返せばサーバ側描画が効いている
4. `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/missing` が 404 を返せばルーティングの分岐が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ルーティング、描画、サーバの3つを別関数に分ける。まずファイル名から URL を作る純粋関数だけを書き、テストで固めてから残りへ進む
2. 構造: `routeFromFilename`、`discoverPages`、`renderPage`、`startServer` の4本立てにする。`discoverPages` は再帰走査して動的 `import()` し、`renderPage` は `getServerSideProps` の結果を default export へ渡して HTML 文字列を組み立てる
3. 実装の要点: props をそのまま `JSON.stringify` して `<script>` へ埋めると `</script>` を含む値で HTML が壊れ、XSS の入口になる。`<`、`>`、`&` を Unicode エスケープしてから埋め込む

**本番利用時の警告**

- props の JSON 埋め込みは、エスケープを1つでも落とすとサーバ側データがそのままスクリプト実行につながる XSS になる。本番では実績のあるシリアライザを使い、埋め込む値の出所を限定する
- この実装はストリーミング、キャッシュ、タイムアウト、同時実行制御を持たない。`getServerSideProps` が遅いページを公開すると、リクエストごとにサーバのイベントループが専有され、少数のアクセスで応答不能になる
- ページモジュールをディレクトリ走査で動的 import するため、書き込み可能なディレクトリを pages に指定すると任意コード実行になる。走査対象はリポジトリ内の固定パスに限定する

**導線**

- 開始地点: `mini-ssr/starter/main.ts`
- 模範解答: `mini-ssr/solution/main.ts`、`mini-ssr/solution/pages/index.ts`、`mini-ssr/solution/pages/about.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch09 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
