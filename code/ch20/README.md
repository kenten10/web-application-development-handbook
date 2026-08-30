# 第20章 クラウドとIaC — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch20 run lint
pnpm --filter @handbook/ch20 run typecheck
pnpm --filter @handbook/ch20 run test
pnpm --filter @handbook/ch20 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 20.1 課題20.1: ミニ Terraform(状態管理 + plan/apply) (★★★) | `mini-terraform/starter/main.sh` | `mini-terraform/solution/main.sh` | ★★★ | 150分 | なし |
| 20.2 課題20.2: IaC ドリフト検出ツール (★★) | `mini-terraform/drift.ts` | `mini-terraform/drift.solution.ts` | ★★ | 90分 | なし |
| 20.3 課題20.3: Cost estimator(リソース→月額推定) (★★) | `cost-estimator.ts` | `cost-estimator.solution.ts` | ★★ | 90分 | なし |
| 20.4 課題20.4: Secrets ローテーション スクリプト (★★) | `secrets-rotator.ts` | `secrets-rotator.solution.ts` | ★★ | 90分 | なし |

## 課題詳細

### 20.1 課題20.1: ミニ Terraform(状態管理 + plan/apply) (★★★)

**目的**: Terraform の核「desired state を宣言 → 現状と diff → 必要な操作だけ実行」を理解。

**難易度**: ★★★

**推定時間**: 150分 (差分計算の設計と実装に60分、plan と apply の出力整形に40分、state 保存と削除検出の確認に30分、手動変更を挟んだ再現テストに20分)

**必要サービス**: なし

**前提**

- 20.7 IaC (Infrastructure as Code) を読み、宣言的な desired state という考え方を押さえる
- 20.8 Terraform の実例 を読み、plan と apply と state の3者の関係を把握する
- Node.js の node:fs 同期APIでファイルとディレクトリを作成・削除できる
- 使い捨ての作業ディレクトリを用意し、その中でだけスクリプトを実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] plan が差分だけを create file / update file / delete file / create dir / delete dir の記号付きで表示し、ファイルを一切変更しない
- [ ] apply がファイルとディレクトリを作成し、.terraform.state.json に desired と appliedAt と fingerprint を保存する
- [ ] 変更なしの状態で plan を再実行すると No changes. Infrastructure is up-to-date. だけが出る
- [ ] resources.json から1エントリ削除して plan すると、state に残っている分が delete file として出る
- [ ] update の plan 出力に変更前と変更後の内容が2行で表示される

**期待出力**

- 初回 plan で create 行が resources.json の件数分だけ出力される
- apply の最後に Created N files, M directories の集計行と State saved to .terraform.state.json の2行が出る
- 内容だけ変えて plan すると update file 行の下に旧内容と新内容がJSON文字列で並ぶ

**観察項目**

- apply 後に .terraform.state.json を開き、fingerprint が desired の SHA-256 になっていることを確認する
- state ファイルを削除してから resources.json のエントリを減らして plan し、削除が検出できなくなる (state が無いと消すべき対象を知れない) ことを確認する
- plan と apply を連続実行した場合と、間に手動でファイルを触った場合で apply が行う操作数が変わることを確認する
- 本物の `terraform plan` の出力記号と自作の出力記号を並べ、表現が対応していることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch20 run test` を実行し、mini terraform plans/applies and persists state が通ることを確認する
2. 使い捨てディレクトリで `bash code/ch20/mini-terraform/solution/main.sh plan resources.json` を実行し、create 行が出るだけでファイルが作られないことを `ls` で確認する
3. 続けて `bash code/ch20/mini-terraform/solution/main.sh apply resources.json` を実行し、config/app.conf の中身が resources.json の content と一致すれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: plan と apply で「差分を計算する処理」を共有し、出力するか実行するかだけを切り替える。この分離ができていれば plan に出ない変更が apply で起きる事故を防げる
2. 構造: desired の files と directories を Map と Set にし、実ファイルの存在と内容を突き合わせて 操作種別と名前と内容 を持つ変更リストを作る。削除の判定だけは前回の state を参照する
3. 実装の要点: 削除対象は「前回の state にあって今回の desired に無いもの」であり、実ファイルの一覧から求めてはいけない (管理外のファイルまで消す)。apply 後の state には desired そのものを保存する

**本番利用時の警告**

- このツールは apply 時に確認プロンプトを持たず、いきなり削除を実行する。相対パスの名前をカレントディレクトリ基準で削除するため、リポジトリ直下で実行すると必要なファイルを消す。必ず使い捨てディレクトリで実行する
- state ファイルにはリソースの中身が平文で入る。実際の Terraform でも state に接続文字列やパスワードが平文で残るため、リポジトリへコミットせず暗号化されたリモートバックエンドに置き、同時実行を防ぐロックを掛ける必要がある

**導線**

- 開始地点: `mini-terraform/starter/main.sh`
- 模範解答: `mini-terraform/solution/main.sh`

### 20.2 課題20.2: IaC ドリフト検出ツール (★★)

**目的**: 「コード (IaC) で記述した状態」と「実際のリソースの状態」のズレ (drift) を検出。

**難易度**: ★★

**推定時間**: 90分 (3種の kind を返す検出関数の実装に35分、手動変更を作っての検証に30分、出力整形とエラー分岐の確認に25分)

**必要サービス**: なし

**前提**

- 課題20.1 のミニ Terraform を先に完了し、apply 済みのファイル群と .terraform.state.json がある
- 20.7 IaC (Infrastructure as Code) を読み、コードと実体が乖離する drift の意味を押さえる
- 20.10 GitOps ― 宣言的な運用 を読み、乖離を検知して宣言へ戻す運用像を把握する
- node:fs/promises の stat と readFile で ENOENT を判定できる

**完成条件 (自己採点用チェックリスト)**

- [ ] detectDrift(files, cwd) が missing と content-mismatch と type-mismatch の3種の kind を返し分ける
- [ ] 内容が異なるファイルで path と kind と expected と actual の4フィールドを持つ結果が返る
- [ ] ファイルが存在しない場合に missing、同名のディレクトリになっていた場合に type-mismatch が返る
- [ ] ドリフトが無い場合に空配列が返り、formatDrifts が No drift detected. を返す
- [ ] formatDrifts の出力が DRIFT DETECTED の見出しに続けて1件1行の形式で並ぶ

**期待出力**

- 手動で書き換えたファイルに対し DRIFT DETECTED の見出しと content mismatch の行、expected と actual の2行が出る
- ドリフトなしでは No drift detected. の1行のみが出る
- ENOENT 以外のI/Oエラー (権限不足など) は握り潰されずそのまま例外になる

**観察項目**

- apply 直後に検出を掛けて0件、`echo manually changed > config/app.conf` の後に1件になることを確認する
- ファイルを消した場合と同名ディレクトリへ置き換えた場合で kind が missing と type-mismatch に分かれることを確認する
- 末尾の改行だけを削った場合でも content-mismatch として検出される (バイト単位比較である) ことを確認する
- 検出後に課題20.1 の apply を再実行し、drift が解消されて0件へ戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch20 run test` を実行し、drift detector reports changed files が通ることを確認する
2. 使い捨てディレクトリで apply 後に `echo manually changed > config/app.conf` してから検出を呼び、kind が content-mismatch なら合格
3. 何も変更していない状態で formatDrifts の出力が No drift detected. になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 検出は「期待値の一覧」と「実体」を1件ずつ突き合わせるだけ。まず内容不一致だけを検出し、後から欠損と種別違いを足す
2. 構造: 1ファイルごとに stat して isFile() を確認し、そのうえで readFile して文字列比較する。エラーは code が ENOENT のときだけ missing に変換し、それ以外は再スローする
3. 実装の要点: readFile の例外を全部 catch すると権限エラーを drift と誤報する。catch の中で必ず errno の code を見分けること

**本番利用時の警告**

- この検出器はファイル内容しか見ておらず、パーミッション、所有者、シンボリックリンクの変更を drift として扱わない。クラウド資源では security group の穴あけのような手動変更こそ検出対象なので、実運用では terraform plan -detailed-exitcode やプロバイダAPIによる実体取得が必要
- expected と actual をそのまま出力するため、管理対象にAPIキーや接続文字列が含まれると差分ログへ平文で残る。CIのジョブログは広く閲覧されるので、秘密を含むリソースはマスクするか検出対象から外す

**導線**

- 開始地点: `mini-terraform/drift.ts`
- 模範解答: `mini-terraform/drift.solution.ts`

### 20.3 課題20.3: Cost estimator(リソース→月額推定) (★★)

**目的**: AWS / GCP の主要リソース (EC2、RDS、S3) に対する月額コストを概算するツール。

**難易度**: ★★

**推定時間**: 90分 (料金表と型定義の設計に25分、3リソースの計算関数の実装に35分、整形出力と実料金ツールとの突き合わせに30分)

**必要サービス**: なし

**前提**

- 20.2 AWSの主要サービス を読み、EC2 と RDS と S3 の課金軸 (時間、ストレージ、リクエスト) を押さえる
- 20.1 クラウドの3層モデル を読み、管理責任と料金の関係を把握する
- TypeScript の判別可能ユニオン型 (type フィールドで分岐する型) を書ける
- 月間稼働時間を730時間として計算する前提を理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] estimateResource が ec2 と rds と s3 の3種を type で分岐し、label と monthlyUsd を持つ行を返す
- [ ] estimate が lines 配列と total を返し、total が各行の合計と一致する
- [ ] count 省略時に1、hours_per_month 省略時に730が適用される
- [ ] rds の月額がインスタンス時間課金と storage_gb にストレージ単価を掛けた額の合計になる
- [ ] formatEstimate の出力が 各行と区切り線と TOTAL 行 で構成され、金額が小数点以下2桁に揃う

**期待出力**

- t3.medium を730時間で1台計上すると 30.37 USD 前後になる
- ec2 t3.medium 730時間と s3 100GB の合計が 32 から 33 USD の範囲に収まる
- formatEstimate がラベルを35桁で左詰めした行を並べ、最後に48文字の区切り線と TOTAL 行を出す

**観察項目**

- 同じ構成を AWS Pricing Calculator に入力し、自作の概算との乖離率を計算する
- 料金表の単価を1つ変えたときに total がどれだけ動くかを見て、この構成で支配的なコスト要因がEC2の時間課金であることを確認する
- hours_per_month を730から300へ減らし、常時起動と間欠運用のコスト差を比較する
- s3 の requests_per_month を100万にしたときの寄与が数十セントにとどまり、ストレージ課金と桁が違うことを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch20 run test` を実行し、cost estimator calculates deterministic total が通ることを確認する
2. code/ch20 で `tsx --test solutions.test.ts` を実行し、estimate の total が 32 より大きく 33 未満になることを確認する
3. 自分で書いたリソース定義を formatEstimate に通し、TOTAL が各行の合計と一致することを検算する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: リソース種別ごとに「何に何を掛けるか」を先に表にする。EC2は時間、RDSは時間とGB、S3はGBとリクエスト千件、と課金軸が違う点が本質
2. 構造: 単価は1つの定数オブジェクトへ集約し、estimateResource は type で分岐して1行分の結果を返す純関数にする。合計は reduce、整形は padEnd と toFixed(2) で行う
3. 実装の要点: count は ec2 と rds にしかない任意フィールドなので、in 演算子による存在チェックを挟まないと型エラーになる。s3 は台数の概念が無いため掛けてはいけない

**本番利用時の警告**

- この見積りはオンデマンド単価の静的表であり、リージョン差、データ転送料、NAT Gateway、スナップショット、リザーブドや Savings Plans の割引を一切含まない。実際の請求は数倍になりうるため、予算判断には Cost Explorer と Budgets を併用する
- 演習のために実際に EC2 や RDS を起動して検証する場合、停止と削除を忘れると t3.medium 1台でも月30ドル、RDS を足せば数十ドルが自動で課金され続ける。検証は必ずリソース削除まで行い、始める前に AWS Budgets で金額アラートを設定する

**導線**

- 開始地点: `cost-estimator.ts`
- 模範解答: `cost-estimator.solution.ts`

### 20.4 課題20.4: Secrets ローテーション スクリプト (★★)

**目的**: Vault や AWS Secrets Manager 風の「シークレットを定期的にローテーション」する仕組みを実装。

**難易度**: ★★

**推定時間**: 90分 (暗号化と復号の実装に30分、set と get と rotate および previous 保持の実装に35分、時刻注入によるローテーション検証と監査ログ確認に25分)

**必要サービス**: なし

**前提**

- 20.2 AWSの主要サービス を読み、Secrets Manager や Parameter Store が担う役割を押さえる
- 20.13 Twelve-Factor App ― クラウド時代の設計指針 を読み、設定と秘密をコードから分離する原則を把握する
- node:crypto の createCipheriv と AES-256-GCM の iv と authTag の役割を知っている
- テストで時刻を進められるよう、現在時刻を関数として注入する設計に慣れている

**完成条件 (自己採点用チェックリスト)**

- [ ] SecretStore が AES-256-GCM でファイルを暗号化し、保存ファイルに平文の値が現れない
- [ ] `set(name, { value, metadata: { rotationDays } })` で登録した秘密を `get(name)` で取り出せる
- [ ] rotationDays を過ぎた時点で needsRotation(name) が true を返す
- [ ] rotate(name, generate) 後に get(name) が新値、version に previous を指定すると旧値を返す
- [ ] grace 期間 (デフォルト7日) を過ぎた previous を取得すると version expired で失敗する
- [ ] audit() が set と get と rotate の操作履歴を時刻付きで返す

**期待出力**

- 保存ファイルの先頭4バイトが HSS1 で、以降に平文の秘密文字列がバイト列として含まれない
- rotate 直後の get は新値、previous 指定は旧値を返す
- audit() の配列に at と action と name の3キーを持つ要素が操作回数分並ぶ

**観察項目**

- `xxd secrets.enc` の先頭を見て、マジック4バイトと12バイトのIVと16バイトの認証タグが並ぶ構造を確認する
- ファイルを1バイト書き換えてから読み込み、GCM の認証タグ検証が失敗して復号エラーになることを確認する
- 同じ内容を2回保存してもIVが毎回変わるためファイルのバイト列が異なることを確認する
- `ls -l secrets.enc` でパーミッションが 600 になっていることを確認する
- get を呼ぶたびに監査ログが増えてファイルが書き換わる (読み取りが書き込みを伴う) 副作用に気づく

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch20 run test` を実行し、secret store encrypts, rotates, and retains previous version が通ることを確認する
2. code/ch20 で `tsx --test solutions.test.ts` を実行し、保存ファイルに旧値の文字列が含まれないアサーションが通ることを確認する
3. 注入した時刻を1か月進めた状態で needsRotation が true になり、rotate 後に previous が取得できれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「暗号化された1ファイルを毎回読んで書き戻す」だけの単純なストアでよい。まず平文JSONで set と get と rotate を作り、最後に暗号化層を挟む
2. 構造: 鍵は scryptSync でマスターキーから32バイト導出し、暗号は createCipheriv の aes-256-gcm を使う。保存形式を マジック4バイト + IV12バイト + 認証タグ16バイト + 本体 と決めておくと復号側が subarray だけで書ける
3. 実装の要点: GCM の認証タグは final() を終えた後でないと取得できないため、連結順序を間違えると復号が必ず失敗する。ローテーション時は previous に expiresAt を入れ、get 側で現在時刻と比較して期限切れを弾く

**本番利用時の警告**

- マスターキーを引数やソースへ直書きする設計のままでは、リポジトリやプロセス一覧の引数から鍵が漏れる。本番では KMS や Secrets Manager に鍵を預け、アプリには復号権限だけを IAM で与える
- このストアはローテーション後に旧値を使っているアプリへ通知しないため、実サービスでそのまま切り替えると grace 期間を過ぎた瞬間に認証失敗が一斉に起きる。本番では新旧2値を同時に有効にし、利用側の切替完了を確認してから旧値を無効化する
- 監査ログを同じファイルへ書き足しているためファイルが肥大化し、get のたびに全体を再暗号化する。改竄検知も外部転送も無く、監査要件は満たさない

**導線**

- 開始地点: `secrets-rotator.ts`
- 模範解答: `secrets-rotator.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch20 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
