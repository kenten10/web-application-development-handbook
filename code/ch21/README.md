# 第21章 CI/CDとDevOps — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch21 run lint
pnpm --filter @handbook/ch21 run typecheck
pnpm --filter @handbook/ch21 run test
pnpm --filter @handbook/ch21 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 21.1 課題21.1: Blue-Green デプロイ実装 (★★★) | `blue-green/starter/main.sh` | `blue-green/solution/main.sh` | ★★★ | 150分 | なし |
| 21.2 課題21.2: Canary デプロイ実装 (★★★) | `canary/starter/main.sh` | `canary/solution/main.sh` | ★★★ | 150分 | なし |
| 21.3 課題21.3: GitHub Actions ワークフロー生成器 (★★) | `workflow-generator.ts` | `workflow-generator.solution.ts` | ★★ | 90分 | なし |
| 21.4 課題21.4: 自動ロールバック付きパイプライン (★★★) | `auto-rollback.ts` | `auto-rollback.solution.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 21.1 課題21.1: Blue-Green デプロイ実装 (★★★)

**目的**: ロードバランサのターゲットを瞬間切り替える Blue-Green の挙動を、リアルなプロセス操作で実装。

**難易度**: ★★★

**推定時間**: 150分 (状態ファイル設計とサブコマンド実装に55分、ヘルスチェックのガードと異常系に40分、実バックエンド2台を立てての切替確認に35分、ロールバック手順の記録に20分)

**必要サービス**: なし

**前提**

- 21.4 デプロイ戦略 ― それぞれの実装と使い分け を読み、Blue-Green が2系統を同時に維持する戦略であることを押さえる
- 21.5 ロールバック戦略 を読み、切り戻しがLBの向き先を戻すだけで済む条件を把握する
- 18.7 ロードバランサ ― L4 vs L7 を読み、切替の対象がどこかを理解している
- bash から node を起動し、JSONの状態ファイルを読み書きできる

**完成条件 (自己採点用チェックリスト)**

- [ ] status が Active と Idle の2行を color と port と status 付きで表示する
- [ ] deploy green v2 で green の version と status が更新され、ヘルスチェック通過の行が出る
- [ ] idle 側が healthy でない状態で switch すると非ゼロ終了し is not healthy のエラーになる
- [ ] switch 成功時に Switching の行と Done. New traffic goes to green. の行が出て、状態ファイルの active が更新される
- [ ] アクティブなカラーに対する stop が cannot stop active color で拒否される
- [ ] request が現在のアクティブカラーの color と version と port をJSONで返す

**期待出力**

- 初期状態の status が Active: blue (port 4001) - healthy と Idle: green (port 4002) - stopped の2行になる
- deploy 前の switch は終了コード非ゼロで終わり、標準エラーに green is not healthy が出る
- switch 後の request が color=green のJSONを返す

**観察項目**

- 状態ファイルを switch の前後で diff し、active フィールドだけが変わることを確認する
- switch の前後で request を連続実行し、切替が1リクエスト単位で瞬時に起きて段階が無いことを確認する
- 旧カラーを stop せずに残した場合、ロールバックが switch 1回で済むことを確認する
- green を deploy せず stop のままで switch を試み、ヘルスチェックがガードとして機能することを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch21 run test` を実行し、blue-green refuses unhealthy switch and switches after deploy が通ることを確認する
2. 使い捨てディレクトリで `bash code/ch21/blue-green/solution/main.sh status` の後に deploy green v2 と switch を順に実行し、blue から green への切替行が出れば合格
3. `BLUE_GREEN_STATE=/tmp/bg.json bash code/ch21/blue-green/solution/main.sh switch` を deploy 前に実行し、終了コードが 0 以外になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 実サーバを立てる前に状態遷移だけを作る。active と2色分の port と version と status を持つJSONを1つ置き、サブコマンドでそれを読み書きする設計にする
2. 構造: status と deploy と switch と stop と request の5サブコマンドに分け、switch では必ず切替先の status を確認してから active を書き換える。異常時は例外を投げて非ゼロ終了させる
3. 実装の要点: ガードの順序が肝心で、active を書き換えてからヘルスチェックすると不健全な側へ流れる。またアクティブなカラーの stop を禁止しないと、無停止のはずが全断になる

**本番利用時の警告**

- この実装はヘルスチェックの成功を決め打ちしており、実際に新カラーへHTTPリクエストを送っていない。本番でこの形のまま切り替えると、起動しただけで接続を受けられないプロセスへ全トラフィックを流して全断になる
- Blue-Green は切替時にDBスキーマが両バージョンから同時に使われる点を扱っていない。後方互換の無いマイグレーションを同時に流すと、切り戻し時に旧バージョンがデータを読めずロールバック不能になる
- 状態ファイルにロックが無いため、複数人が同時に switch すると状態が壊れ、active と実際の向き先が食い違う

**導線**

- 開始地点: `blue-green/starter/main.sh`
- 模範解答: `blue-green/solution/main.sh`

### 21.2 課題21.2: Canary デプロイ実装 (★★★)

**目的**: トラフィック比率を段階的に新バージョンに振る Canary の実装。

**難易度**: ★★★

**推定時間**: 150分 (状態設計と shift と route の実装に50分、メトリクス収集と evaluate の閾値判定に45分、promote とロールバック経路の検証に35分、比率の分布確認に20分)

**必要サービス**: なし

**前提**

- 21.4 デプロイ戦略 ― それぞれの実装と使い分け を読み、Canary が比率で段階的に流す戦略であることを押さえる
- 21.6 デプロイ頻度と DORA メトリクス を読み、変更失敗率という指標を押さえる
- 課題21.1 の Blue-Green を先に実装し、状態ファイルでデプロイ状態を持つ形に慣れている
- bash と node で状態JSONの読み書きができる

**完成条件 (自己採点用チェックリスト)**

- [ ] shift に渡す比率が 0 から 100 の範囲で更新され、範囲外は shift must be 0..100 で拒否される
- [ ] route が リクエスト番号を100で割った余りと比率の比較で stable か canary を返し、選ばれた側の requests とレイテンシを加算する
- [ ] record-error canary でエラーが計上され、evaluate が canary のエラー率5%超で rollback 行を出し比率を0へ戻す
- [ ] エラー率が閾値以下なら evaluate が healthy 行を出し、比率を変更しない
- [ ] promote で stable のバージョンが canary のバージョンへ置き換わり、metrics が初期化される
- [ ] start と status が stable と canary の現在比率を1行で返す

**期待出力**

- shift 10 の後の status が stable: 90% / canary: 10% を出す
- canary に6件のエラーを記録してから evaluate すると rollback: canary error rate 100.00% の行が出る
- promote 後の出力が stable が canary を取り込み100%になった旨の1行になる

**観察項目**

- route を100回呼び、canary が選ばれた回数が設定比率とほぼ一致することを確認する
- 比率が小さいほど、同じエラー率を検出するのに必要なリクエスト数が増えることを件数を変えて確認する
- 状態ファイルの metrics を見て、stable と canary で総レイテンシをリクエスト数で割った平均がどう違うかを比較する
- エラー0件のまま evaluate を実行し、requests が0でもエラー率0として healthy になる危うさを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch21 run test` を実行し、canary rolls back on high error rate が通ることを確認する
2. 使い捨てディレクトリで `bash code/ch21/canary/solution/main.sh shift 50` の後に record-error canary を6回実行し、`bash code/ch21/canary/solution/main.sh evaluate` が rollback を出せば合格
3. `CANARY_STATE=/tmp/canary.json bash code/ch21/canary/solution/main.sh route 7` を番号を変えて複数回実行し、比率どおりに分かれることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「比率で振り分ける」と「メトリクスで判定する」を別サブコマンドに分ける。判定は蓄積した requests と errors だけを見る計算にする
2. 構造: 状態は比率と、stable と canary それぞれの requests と errors と総レイテンシを持つJSONで足りる。route はリクエスト番号を100で割った余りと比率の比較にすると決定的でテストしやすい
3. 実装の要点: evaluate の閾値判定で requests が0のときのゼロ除算を避けること。またロールバック時に比率を0へ戻すだけでなく、記録済みメトリクスを残すか捨てるかを決めないと次の判定が汚染される

**本番利用時の警告**

- エラー率の判定に最小サンプル数を設けていないため、canary に数リクエストしか流れていない段階で1件のエラーが出ると即ロールバックし、逆に0件なら常に healthy と判定する。本番では最小観測数や SLO burn rate で判断する
- 振り分けがリクエスト番号ベースのため同一ユーザーが stable と canary を行き来する。セッションやキャッシュの整合が崩れて利用者に断続的な不整合を見せるので、実運用ではユーザーIDのハッシュで固定する必要がある
- canary が新しいマイグレーションを必要とする場合、stable と canary が同一DBを共有するため片方が壊れる。スキーマ変更は両バージョン互換にしてから流す

**導線**

- 開始地点: `canary/starter/main.sh`
- 模範解答: `canary/solution/main.sh`

### 21.3 課題21.3: GitHub Actions ワークフロー生成器 (★★)

**目的**: package.json / プロジェクト構成から GitHub Actions YAML を自動生成する CLI。

**難易度**: ★★

**推定時間**: 90分 (検出ロジックの実装に25分、Node と Python の2種のテンプレート生成に35分、生成YAMLの構文検証と実リポジトリでの起動確認に30分)

**必要サービス**: なし

**前提**

- 21.2 GitHub Actions を読み、on と jobs と steps と uses の構造を押さえる
- 21.3 マトリクスビルド ― 複数環境で同時にテスト を読み、strategy.matrix の展開を把握する
- package.json の scripts を読み取って条件分岐する処理を書ける
- 生成先の .github/workflows ディレクトリを作成できる権限がある

**完成条件 (自己採点用チェックリスト)**

- [ ] detectProject が package.json のあるディレクトリで node 種別と lint / test / build の有無を返す
- [ ] pyproject.toml のみのディレクトリで python 種別を返し、どちらも無ければ Node.js or Python project not found を投げる
- [ ] generateWorkflow の Node 版が strategy.matrix の node へ指定バージョン配列を展開する
- [ ] scripts に lint が無いプロジェクトでは npm run lint の行が生成されない
- [ ] writeWorkflow が .github/workflows/ci.yml を作成し、そのパスを返す
- [ ] 生成したYAMLが actionlint もしくは GitHub 上で構文エラーにならない

**期待出力**

- lint と test と build を持つプロジェクトで node: [20, 22] の行と、npm ci / npm run lint / npm test / npm run build の4ステップが出力される
- Python プロジェクトでは setup-python と ruff check と pytest を含むワークフローが返る
- 出力されるYAMLが name: CI と on: [push, pull_request] で始まる

**観察項目**

- 生成したYAMLを実際のリポジトリへ置いて push し、Actions のジョブ一覧がマトリクスの数だけ並ぶことを確認する
- cache 指定を外した場合と付けた場合で、依存インストールの所要時間の差を Actions のログで比較する
- scripts から build を消して再生成し、生成されるステップ数が減ることを diff で確認する
- actions のバージョン指定がタグであり、コミットSHAで固定されていないことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch21 run test` を実行し、workflow generator detects scripts and renders matrix が通ることを確認する
2. code/ch21 で `tsx --test solutions.test.ts` を実行し、生成YAMLが node: [20, 22] と npm run lint を含むことを確認する
3. `npx actionlint .github/workflows/ci.yml` を実行するか GitHub へ push してジョブが起動すれば構文として合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「検出」と「生成」を分ける。検出は小さな構造体を返すだけにし、生成はその構造体からテンプレート文字列を組み立てる純関数にする
2. 構造: 検出は package.json を先に、次に pyproject.toml を stat して判定する。生成側は steps を配列で組み立ててから改行で結合すると、条件付きステップの追加が簡単になる
3. 実装の要点: YAMLはインデントが意味を持つためテンプレート文字列内の空白数を揃えること。matrix 変数の参照はテンプレートリテラル内でドル記号をエスケープしないと、JavaScript の式として評価されてしまう

**本番利用時の警告**

- 生成されるワークフローは permissions を指定していないため、リポジトリデフォルトの広い GITHUB_TOKEN 権限で動く。pull_request トリガーと組み合わせるとフォークからのPRへ意図しない権限が渡る恐れがあるので、本番では contents: read を明示する
- actions をタグで参照しているとタグは可変であり、上流が乗っ取られると任意コードがCIで実行される。実運用ではコミットSHAでピン留めし、Dependabot で更新する
- 生成物を既存の .github/workflows/ci.yml へ無確認で上書きするため、手で調整したワークフローを失う。実行前に差分を確認する手順を挟む

**導線**

- 開始地点: `workflow-generator.ts`
- 模範解答: `workflow-generator.solution.ts`

### 21.4 課題21.4: 自動ロールバック付きパイプライン (★★★)

**目的**: 「デプロイ → 監視 → エラー率上昇で自動ロールバック」の一連を実装。

**難易度**: ★★★

**推定時間**: 150分 (アダプタ interface とパイプラインの実装に45分、閾値判定と境界テストに40分、メモリ内実装とテスト整備に35分、実デプロイ手段との接続確認に30分)

**必要サービス**: なし

**前提**

- 21.5 ロールバック戦略 を読み、自動切り戻しの判断材料と条件を押さえる
- 21.6 デプロイ頻度と DORA メトリクス を読み、変更失敗率と平均復旧時間の関係を把握する
- 課題21.1 または課題21.2 でデプロイ切替の操作を実装済みである
- TypeScript の interface でアダプタを定義し、テスト用の実装へ差し替えられる

**完成条件 (自己採点用チェックリスト)**

- [ ] PipelineAdapter が currentVersion と deploy と rollback と metrics の4メソッドを持つ interface として定義されている
- [ ] deploy がデプロイ前のバージョンを記録し、観測後の結果を status と errorRate と previous の3キーで返す
- [ ] エラー率が閾値を超えたときに rollback が呼ばれ status が rolled-back になる
- [ ] 閾値以下なら status が healthy となりロールバックが呼ばれない
- [ ] requests が0のときにエラー率が0として扱われ、ゼロ除算しない
- [ ] テスト用アダプタの history に deploy と rollback が実行順で記録される

**期待出力**

- requests=100 かつ errors=6 で閾値0.05のとき status が rolled-back、errorRate が 0.06、バージョンが v1 に戻る
- requests=100 かつ errors=0 のとき status が healthy、errorRate が 0 でバージョンは v2 のまま
- history 配列が deploy:v2 と rollback:v1 の順で並ぶ

**観察項目**

- 閾値をちょうど 0.06 にして、判定が「超えたら」か「以上なら」かで結果が変わることを確認する
- 観測窓を短くして、窓が短いとノイズで誤ロールバックしやすくなることをエラーを散らしたメトリクスで確認する
- rollback 自体が失敗した場合に例外が伝播し、パイプラインが不整合な状態で止まることを確認する
- 課題21.1 の blue-green スクリプトをアダプタの実装として差し込み、実際に active カラーが戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch21 run test` を実行し、pipeline rolls back when threshold is exceeded が通ることを確認する
2. code/ch21 で `tsx --test solutions.test.ts` を実行し、requests=100 errors=6 で status が rolled-back、バージョンが v1 になることを確認する
3. errors を 4 に変えて同じ流れを実行し status が healthy になれば、境界判定が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「デプロイする手段」と「判断するロジック」を分離する。判断側は数値しか見ないので、実デプロイをアダプタの裏に隠せばテストが一瞬で終わる
2. 構造: アダプタに currentVersion と deploy と rollback と metrics を定義し、パイプラインはその4つを順に呼ぶだけにする。テスト用にメトリクスを固定で返すメモリ内実装を用意する
3. 実装の要点: デプロイ前に previous を取得しておかないとロールバック先が分からなくなる。現在バージョン取得、デプロイ、観測、判定、必要なら rollback の順序を厳守する

**本番利用時の警告**

- 1回だけメトリクスを取って判定するため、デプロイ直後のウォームアップ由来のエラーを本物の障害と誤判定して不要なロールバックを起こす。本番では観測窓を複数回サンプリングし、連続超過で初めて発火させる
- 自動ロールバックは「バージョンを戻せば復旧する」前提に立っている。破壊的なマイグレーションや外部への副作用 (メール送信、決済) を伴うデプロイでは戻しても復旧せず、状態が壊れたまま残る。ロールバック不能な変更は自動化の対象から外す
- ロールバック処理自体の失敗を検知して通知する経路が無いため、切り戻しに失敗した障害が誰にも気づかれない

**導線**

- 開始地点: `auto-rollback.ts`
- 模範解答: `auto-rollback.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch21 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
