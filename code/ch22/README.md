# 第22章 可観測性 (Observability) — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch22 run lint
pnpm --filter @handbook/ch22 run typecheck
pnpm --filter @handbook/ch22 run test
pnpm --filter @handbook/ch22 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 22.1 課題22.1: 構造化ログライブラリ自作 (★★) | `logger.ts` | `logger.solution.ts` | ★★ | 90分 | なし |
| 22.2 課題22.2: Prometheus 風メトリクスサーバ (★★★) | `metrics.ts` | `metrics.solution.ts` | ★★★ | 150分 | なし |
| 22.3 課題22.3: OpenTelemetry 風 分散トレース (★★★) | `tracer.ts` | `tracer.solution.ts` | ★★★ | 150分 | なし |
| 22.4 課題22.4: SLO Burn Rate アラート計算 (★★) | `slo-burn-rate.ts` | `slo-burn-rate.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 22.1 課題22.1: 構造化ログライブラリ自作 (★★)

**目的**: pino / winston 風のロガーを実装。JSON 出力、コンテキスト伝播、ログレベル制御。

**難易度**: ★★

**推定時間**: 90分 (レベルフィルタとJSON出力の実装に25分、child と AsyncLocalStorage のマージ実装に35分、Error シリアライズと出力検証に30分)

**必要サービス**: なし

**前提**

- 22.3 構造化ログ (Structured Logging) を読み、1行1JSONのログが検索でどう扱われるかを押さえる
- 22.4 ログレベル を読み、debug と info と warn と error の使い分けを把握する
- node:async_hooks の AsyncLocalStorage が非同期呼び出しをまたいで値を保持することを知っている
- JSON.stringify が Error オブジェクトを空オブジェクトにしてしまう問題を知っている

**完成条件 (自己採点用チェックリスト)**

- [ ] createLogger が debug と info と warn と error と child の5メソッドを持つロガーを返す
- [ ] 設定レベルより低い重みのログが出力関数へ渡らない (level=info のとき debug は0行)
- [ ] child で作った子ロガーの出力に親から渡したフィールドが必ず含まれる
- [ ] withContext で包んだ内側で出したログに traceId が自動付与される
- [ ] fields に Error を渡すと name と message と stack の3キーへ展開されて出力される
- [ ] 1回の呼び出しで出るのは改行を含まないJSON1行である

**期待出力**

- 出力JSONが timestamp と level と service と msg に加え、base と非同期コンテキストと呼び出し時 fields をこの順でマージした結果になる
- level=info の設定で debug を呼ぶと出力関数が呼ばれず行数が増えない
- error フィールドの stack に元の例外メッセージが含まれる

**観察項目**

- child を2段重ねて、親から孫までのフィールドが後勝ちでマージされる順序を確認する
- 同名キーを base と withContext と fields の3か所に置き、どれが最終的に残るかで優先順位を確認する
- await を挟む関数の中でログを出し、withContext のコンテキストが維持されることを確認する
- 出力を `jq .level` へパイプし、全行が機械処理できるJSONになっていることを確認する
- pino の出力と並べ、level が数値か文字列かなどフィールド設計の違いを比較する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch22 run test` を実行し、logger filters levels and merges child/async context が通ることを確認する
2. code/ch22 で `tsx --test solutions.test.ts` を実行し、出力1行に requestId と traceId が含まれ error.stack が例外メッセージを含むことを確認する
3. 自作の呼び出しスクリプトの出力を `jq .` へ通し、全行が妥当なJSONとしてパースできれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ログレベルは「数値の重み比較」に落とすと一撃で書ける。まずレベルフィルタとJSON1行出力だけを作り、コンテキストは後から足す
2. 構造: レベルごとの重みを辞書で持ち、child は base フィールドをマージした新しいロガーを返す再帰的な生成関数にする。リクエストスコープは AsyncLocalStorage の run と getStore で受け渡す
3. 実装の要点: Error は JSON.stringify で空オブジェクトになるため、fields を走査して instanceof Error のものだけ name と message と stack へ変換する。マージ順は base、非同期コンテキスト、呼び出し時 fields の順にしないとその場の指定が上書きされる

**本番利用時の警告**

- このロガーはフィールドを無検査でそのまま出力するため、リクエストボディやヘッダを渡すとパスワードや Cookie やトークンがログ基盤へ平文で流れ込む。本番では機密キーのマスク設定を必須にする
- 出力が同期のため大量出力時にプロセスがI/O待ちでブロックする。出力量の上限もサンプリングも無くログ課金が跳ね上がるので、本番では pino のような非同期でバッファリングする実装を使う
- 改行を含む文字列をそのまま入れると1行1JSONの前提が崩れ収集側のパーサが壊れる。値の長さ制限も併せて掛ける

**導線**

- 開始地点: `logger.ts`
- 模範解答: `logger.solution.ts`

### 22.2 課題22.2: Prometheus 風メトリクスサーバ (★★★)

**目的**: Counter / Gauge / Histogram を自作し、/metrics HTTP エンドポイントで公開。

**難易度**: ★★★

**推定時間**: 150分 (Counter と Gauge と Histogram の実装に60分、ラベル処理とテキスト形式出力に45分、/metrics サーバと curl 確認に25分、Prometheus 形式の検証に20分)

**必要サービス**: なし

**前提**

- 22.6 メトリクス を読み、Counter と Gauge と Histogram の使い分けを押さえる
- 22.2 Three Pillars of Observability を読み、メトリクスがログやトレースと何を分担するかを把握する
- Prometheus のテキスト公開形式 (HELP 行、TYPE 行、名前とラベルと値の行) を見たことがある
- node:http でHTTPサーバを立て、ポート0で空きポートを取得できる

**完成条件 (自己採点用チェックリスト)**

- [ ] MetricRegistry が counter と gauge と histogram の3ファクトリを持ち、登録したメトリクスを expose() でまとめて出力する
- [ ] Counter の inc に負値を渡すと counter cannot decrease で例外になる
- [ ] Gauge が set と inc と dec に対応し、ラベルごとに独立した値を保持する
- [ ] Histogram が buckets を昇順に整列し、le ラベル付きの bucket 行と sum 行と count 行を出力する
- [ ] expose() の出力が各メトリクスにつき HELP 行、TYPE 行、値行の順に並ぶ
- [ ] serve() が起動し GET /metrics が text/plain で本文を返し、他のパスが 404 を返す

**期待出力**

- counter の出力行が `requests_total{method="GET"} 1` の形式になる
- histogram では le ごとの bucket 行に加えて +Inf の行、sum 行、count 行が出て、+Inf の値と count が一致する
- `curl -s http://127.0.0.1:9100/metrics` の本文に HELP と TYPE のコメント行が含まれ、Content-Type が text/plain になる

**観察項目**

- /metrics を2回叩き、Counter が単調増加し Gauge が上下することを確認する
- 同じメトリクス名に異なるラベル組を与え、行数がラベルの組み合わせ数だけ増える (カーディナリティ爆発の入口) ことを確認する
- バケット境界ちょうどの値を observe し、le が「以下」を意味する累積カウントであることを確認する
- 出力を実際の Prometheus か promtool へ食わせ、形式が受け入れられることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch22 run test` を実行し、metrics exposes counter gauge histogram and serves endpoint が通ることを確認する
2. code/ch22 で `tsx --test solutions.test.ts` を実行し、expose() がラベル付き counter 行を含み /metrics の本文が bucket 行を含むことを確認する
3. serve() で起動して `curl -s http://127.0.0.1:9100/metrics` を叩き、HELP と TYPE と値の3種の行が揃えば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 3種のメトリクスは「値の持ち方」だけが違う。共通の抽象へ name と help と expose() を置き、Counter は加算のみ、Gauge は代入可、Histogram は観測値の集計、と分けて考える
2. 構造: ラベルはキーでソートして1本の文字列へ畳み、値を Map で保持する。expose() は HELP 行と TYPE 行を先頭に置き、値行を並べて改行で結合する
3. 実装の要点: Histogram の bucket 行は累積 (le 以下の件数) であり各バケットの個数ではない。最後に必ず +Inf の行を出して count と一致させ、ラベル値は必ず引用符で囲むこと

**本番利用時の警告**

- ラベル値にユーザーIDやリクエストURLのような高カーディナリティの値を入れると時系列数が爆発し、Prometheus 側のメモリと保存費用が桁違いに膨らむ。本番ではラベル値を有限集合に限定する
- この Histogram は観測値を全件配列に貯め続けるため、長時間動かすとメモリを際限なく消費する。本物の実装はバケットごとのカウンタだけを持つので、このまま常駐プロセスへ入れるとメモリ不足で落ちる
- /metrics を認証なしで公開すると、内部のエンドポイント名やエラー数やキュー長といった攻撃者に有用な情報を渡すことになる。本番ではネットワークを分離するか認証を掛ける

**導線**

- 開始地点: `metrics.ts`
- 模範解答: `metrics.solution.ts`

### 22.3 課題22.3: OpenTelemetry 風 分散トレース (★★★)

**目的**: Span / Context propagation を実装。

**難易度**: ★★★

**推定時間**: 150分 (Span と Tracer の基本実装に50分、AsyncLocalStorage による暗黙の親と withSpan の実装に40分、traceparent の生成と解析およびHTTP伝播の確認に40分、サンプリングと出力確認に20分)

**必要サービス**: なし

**前提**

- 22.8 分散トレース ― マイクロサービスを追う を読み、traceId と spanId と親子関係の意味を押さえる
- W3C Trace Context の traceparent が バージョン2桁、traceId 32桁、spanId 16桁、フラグ2桁 の形式であることを知っている
- node:async_hooks の AsyncLocalStorage で暗黙のコンテキストを持ち回れる
- 課題22.1 の構造化ログを実装済みで、traceId をログへ載せる流れが想像できる

**完成条件 (自己採点用チェックリスト)**

- [ ] startSpan が name と traceId と spanId と service と startTime を持つ Span を返す
- [ ] 親 span から作った子 span が同じ traceId を引き継ぎ、parentSpanId に親の spanId を持つ
- [ ] withSpan の中で startSpan した span が、親を明示指定しなくても親子関係になる
- [ ] span.end() が endTime と durationMs を計算し、二重呼び出しでは何もしない
- [ ] traceparent() が規定桁数の文字列を返し、parseTraceparent が不正な文字列で invalid traceparent を投げる
- [ ] export() が終了済み span の配列を end した順で返す

**期待出力**

- root と child の2 span を end した後の export() が長さ2の配列を返し、先に終わる child が先頭に来る
- child の parentSpanId が root の spanId と一致し、traceId は両者で同一になる
- root の traceparent を解析した traceId が root の traceId と一致する

**観察項目**

- 各 span の durationMs を合計し、親の durationMs が子の合計以上になる (親が子を包含する) ことを確認する
- withSpan を使わずに startSpan した場合、親子関係が切れて孤立した trace になることを確認する
- sampleRate を 0.1 にして多数の span を出し、export() の件数がおよそ1割になることを確認する
- traceparent をHTTPヘッダに載せて別プロセスへ渡し、受信側で同じ traceId の span が作られることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch22 run test` を実行し、tracer preserves parent relation and traceparent が通ることを確認する
2. code/ch22 で `tsx --test solutions.test.ts` を実行し、export() の長さが2で先頭 span の parentSpanId が root の spanId であることを確認する
3. 不正な文字列を parseTraceparent へ渡し invalid traceparent が投げられれば、形式検証が効いていると判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: trace は「木構造をフラットな配列で表現する」だけ。まず親子関係と duration を持つ span を配列へ貯める版を作り、暗黙の親と伝播は後から足す
2. 構造: traceId は16バイト乱数の16進32桁、spanId は8バイト乱数の16桁。end() で performance.now() の差分を取り、tracer 側の finish で配列へ push する
3. 実装の要点: 暗黙の親は AsyncLocalStorage の getStore で取るが、withSpan で run しないと store が空になり全 span が root になる。traceparent は桁数を正規表現で厳密に検証しないと、他システムからの不正な値で trace が分断される

**本番利用時の警告**

- サンプリング判定を span の終了時に行っているため、親が捨てられて子だけ残る不完全な trace が生まれる。本番の実装は trace 単位 (root で決めて子へ伝播) でサンプリングする
- 属性にSQL文をそのまま入れると、バインド前の値や個人情報がトレース基盤へ送られる。実運用ではプレースホルダのまま送るか値をマスクする
- export() が全 span をメモリに保持し続けるため常駐プロセスでは無限に増える。実際は OTLP エクスポータでバッチ送信し、送信済みを解放する必要がある

**導線**

- 開始地点: `tracer.ts`
- 模範解答: `tracer.solution.ts`

### 22.4 課題22.4: SLO Burn Rate アラート計算 (★★)

**目的**: 「SLO の error budget を、現在の速度で食い尽くすまで何時間か」を計算するロジックを実装。

**難易度**: ★★

**推定時間**: 90分 (burn rate と error budget の計算実装に30分、窓の絞り込みとアラート評価に35分、fast burn と slow burn の閾値検算と観察に25分)

**必要サービス**: なし

**前提**

- 22.7 SLI / SLO / SLA を読み、error budget が 1 から target を引いた値であることを押さえる
- 22.9 アラート設計 を読み、症状ベースのアラートと multi-window multi-burn-rate の考え方を把握する
- burn rate が 実エラー率を許容エラー率で割った値であることを理解している
- 課題22.2 のメトリクスからエラー率を取り出す流れが想像できる

**完成条件 (自己採点用チェックリスト)**

- [ ] SLOTracker が target を 0 より大きく 1 未満に制限し、範囲外で例外になる
- [ ] record で観測を蓄積し、status(windowMin, now) が指定窓内のイベントだけを集計する
- [ ] status が requests と currentErrorRate と burnRate と errorBudgetRemaining の4キーを返す
- [ ] evaluateAlerts が burnRate が閾値以上のルールだけを返す
- [ ] target=0.999 で1000件中20件失敗のとき burnRate が 19 を超える
- [ ] hoursUntilBudgetExhausted が burnRate から残り時間を返し、エラー0件で無限大になる

**期待出力**

- 1000件中20件のエラー (エラー率2%) で、許容0.1%に対する burnRate が 20 前後になる
- windowMin=60 かつ閾値14.4 の fast-burn ルールだけを渡した evaluateAlerts が長さ1の配列を返す
- エラーが無い期間では currentErrorRate が0、burnRate が0、errorBudgetRemaining が1になる

**観察項目**

- 同じエラー率でも観測窓を60分と6時間に変えたとき、burnRate は同じでもサンプル数が変わることを確認する
- fast-burn(14.4倍) と slow-burn(6倍) の両方を渡し、短期スパイクと継続的劣化で発火するルールが分かれる状況を作り分ける
- burn rate 14.4 が「1時間で30日分の予算の2%を消費する速度」に対応することを windowDays と時間から検算する
- hoursUntilBudgetExhausted の値と、実際に予算を使い切るまでイベントを流したときの時間を突き合わせる

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch22 run test` を実行し、SLO tracker computes burn-rate alerts が通ることを確認する
2. code/ch22 で `tsx --test solutions.test.ts` を実行し、status(60) の burnRate が 19 を超え evaluateAlerts の結果が1件になることを確認する
3. 閾値を 100 に上げた同じデータで evaluateAlerts が空配列を返せば、閾値判定が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に用語を式にする。許容エラー率は 1 から target を引いた値、burn rate は実エラー率を許容エラー率で割った値。この2式が書ければ残りは窓で絞り込むだけ
2. 構造: イベントを success と timestamp の配列で持ち、窓の絞り込みは timestamp が now から窓幅を引いた値以上かのフィルタで行う。evaluateAlerts はルール配列を map して status を計算し、閾値超えだけ filter する
3. 実装の要点: イベント0件の窓でエラー率を計算するとゼロ除算になるため、requests が0なら0として扱う分岐が必要。burnRate の比較を「超えたら」にするか「以上なら」にするかで閾値ちょうどの挙動が変わる

**本番利用時の警告**

- 全イベントを配列へ貯め続けるため、30日窓の実トラフィックでは数千万件がメモリに載って破綻する。本番では Prometheus の rate() のように時間バケットへ集約済みのカウンタから burn rate を計算する
- このトラッカーは成功と失敗の2値しか見ておらず、レイテンシSLOや部分的な劣化を表現できない。アラートの抑制や重複排除や通知先の振り分けも無いため、そのまま通知先へ接続すると同じ事象でオンコール担当を呼び続ける
- ウィンドウ内にイベントが数件しか無いときも burn rate が巨大になり誤発火する。実運用では最小トラフィック量の条件を併記する

**導線**

- 開始地点: `slo-burn-rate.ts`
- 模範解答: `slo-burn-rate.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch22 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
