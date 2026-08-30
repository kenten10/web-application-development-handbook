# KEN-48 章末演習を評価可能な教材へ改訂 — 実施レポート

## 目的

章末演習を「やってみる課題」から「読者が自分で採点できる教材」へ改訂する。到達判定を著者の暗黙知に頼らず、本文・章README・検証スクリプトの3か所で同じ基準を機械的に保証できる状態にする。

## 問題の分析

改訂前の演習は、章本文に手順と要件が書かれ、`config/exercises.json` に開始地点・模範解答・必要サービス・推定時間が登録されていた。しかし評価に必要な情報が欠けていた。

- 132演習のうち70件の `expected` が「本文に記載された観察結果または振る舞いを確認できる。」という汎用文だった。
- 132演習のうち127件の `hints` が同一の3文（「本文の中核概念を小さな関数または小さな実験へ分解する。」ほか）だった。段階差がなく、模範解答を開く前の足場にならない。
- 前提、完成条件、観察項目、テスト方法、本番利用時の警告に相当する項目が存在しなかった。
- 推定時間の根拠が記録されておらず、補正の判断ができなかった。
- 本文の課題見出し136件のうち4件（課題1.1、1.2、1.3、9.1）はマニフェスト未登録で、検証の対象外だった。

## 改訂の設計

`config/exercises.json` を唯一の正本とし、そこから本文と章READMEの両方を生成する方式にした。演習ごとに次の項目を必須化した。

| 項目 | キー | 件数 | 内容 |
|---|---|---:|---|
| 目的 | `purpose` | 1 | その課題で確認する原理 |
| 難易度 | `difficulty` | 1 | 1〜3。本文見出しの★数と一致 |
| 推定時間 | `minutes` | 1 | 5分刻み、15〜600分 |
| 推定時間の内訳 | `estimateBasis` | 1 | 分の積み上げ根拠 |
| 前提 | `prerequisites` | 2〜6 | 先に読む節、必要な知識、必要な環境 |
| 完成条件 | `completion` | 3〜8 | 二値判定できる自己採点チェックリスト |
| 期待出力 | `expected` | 2〜8 | 実行時に得られる出力の形 |
| 観察項目 | `observations` | 2〜8 | どのツールのどこを見て何が読めるか |
| テスト方法 | `verification` | 2〜8 | 実行コマンドを含む自己採点手順 |
| 段階的ヒント | `hints` | 3 | 方針 → 構造 → 実装の要点 |
| 本番利用時の警告 | `warnings` | 1〜4 | 省略した保証と、そのまま使った場合の被害 |
| 導線 | `starter` / `solution` | 1組 | 命名規約どおりの1対1対応 |

コード成果物を持たない4件の観察課題は、章別演習の集計（132件）を動かさずに同じ項目を課すため、`observationExercises` として同じマニフェストへ登録した。これにより `config/clean-environment-plan.json`（KEN-56の検証台帳、132件）と証跡区分は無改変のまま、演習カードの対象を本文の全136課題へ広げた。

## 変更内容

### 本文（全7ファイル・30章・136課題）

各 `#### 課題X.Y:` 見出し直下の `**目的**:` 行の次に、生成ブロック「演習カード」を1つ挿入した。

- `<!-- handbook:exercise:start {"id":"X.Y"} -->` 〜 `<!-- handbook:exercise:end -->` で囲み、手編集を検出できるようにした。
- 挿入行数の合計は7,615行。

| ファイル | 演習カード | カード行数 |
|---|---:|---:|
| `02-part1-foundations.md` | 19 | 1,074 |
| `03-part2-frontend.md` | 21 | 1,195 |
| `04-part3-backend.md` | 19 | 1,091 |
| `05-part4-data.md` | 19 | 1,019 |
| `06-part5-infrastructure.md` | 21 | 1,176 |
| `07-part6-quality.md` | 23 | 1,285 |
| `08-part7-practice.md` | 14 | 775 |
| 合計 | 136 | 7,615 |

### 演習メタデータ（`config/exercises.json`）

`schemaVersion` を1から2へ上げ、136課題へ評価メタデータを追加した。

- 前提: 481項目
- 完成条件: 754項目（自己採点用チェックボックスとして描画）
- 期待出力: 490項目（132件すべてを書き換え。汎用文70件を廃止）
- 観察項目: 500項目
- テスト方法: 438項目（136課題すべてで、1件以上に実行コマンドを含む）
- 段階的ヒント: 408項目（136課題×3段階。汎用文127件を廃止）
- 本番利用時の警告: 332項目
- 推定時間の内訳: 136件
- 合計: 3,539項目

内容はすべて演習固有である。starterとsolutionの実ファイル、章の `solutions.test.ts` のテスト名、本文の節見出しを参照して執筆し、実在しない関数名・コマンド・パスを含まない。

### 難易度と推定時間の補正

- 難易度は本文見出しの★数との整合を崩さないため、136件すべてで据え置いた。分布は ★10件 / ★★68件 / ★★★58件。
- 推定時間は1件だけ補正した。課題30.1（総合演習）を150分から480分へ。本文 30.14 が「合計8-12時間」と明記し、要件がJWT風トークン・RBAC・APIキー・Merkle監査ログ・`/metrics`・レート制限・セキュアヘッダ・冪等性に及ぶため、150分は実作業量と乖離していた。
- 観察課題4件へ新規付与: 1.1=20分/★、1.2=15分/★、1.3=15分/★★、9.1=150分/★★★。1.1〜1.4の合計140分は、本文 `### 1.10` の `handbook:learning {"minutes":140}` と一致する。
- 演習の推定時間合計は 14,940分（249時間0分）から 15,470分（257時間50分）になった。
- `config/clean-environment-plan.json` の該当エントリ（30.1）の `minutes` を追従させた。件数・カテゴリ集計・必要証跡・安全境界は変更していない。

### 本番利用時の警告

332件の警告を、教材実装の危険な単純化に対して名指しで付与した。代表例。

- 課題2.1: 自作HTTPパーサはヘッダ長・ボディ長の上限を持たず、公開するとメモリ枯渇によるDoSを受ける。
- 第13章: 自作JWT検証の `kid` / JWKS / `iss` / `aud` / leeway / 失効の欠如と鍵取り違え攻撃、教材IdPが `subject` を呼び出し側指定にしているためlocalhost限定、TOTPの使用済みコード未記録によるリプレイ。
- 第23章（8演習すべて）: 再現・攻撃コードの実行先を自己所有環境に限定すること、および教材防御のカバー範囲の限界（23.1の擬似評価はUNION・ブラインド・二次注入を再現しない、23.2のサニタイザはmXSS・SVG名前空間・`data:` URIを防げない、23.4のSSRFGuardはTOCTOU型rebindingとリダイレクト追跡を防げない、ほか）。
- 第24章: 負荷試験の対象を自分のlocalhostまたは所有・許可済み環境へ限定すること。
- 第18〜20章: 第三者ホストへの大量接続・傍受は不正アクセスと通信の秘密の侵害にあたること、クラウドリソース削除忘れによる継続課金。
- 第29章: 外部LLM APIの利用コスト、機密情報の送信禁止、生成物の検証必須。

### スクリプト

新規作成。

- `scripts/apply-exercise-rubrics.mjs` — マニフェストから本文の演習カードを生成・再適用する。冪等。`--check` で差分検出。
- `scripts/apply-exercise-rubrics.test.mjs` — カードの必須ラベル、冪等性、手編集の検出と復元、未登録見出しの拒否を検査（5テスト）。
- `scripts/merge-exercise-rubrics.mjs` — 執筆したルーブリックJSONを `config/exercises.json` へ一括適用し、観察課題を本文から起こし、検証台帳の推定時間を追従させる再現用スクリプト。

拡張。

- `scripts/validate-exercises.mjs` — 下記の検査を追加。
- `scripts/validate-exercises.test.mjs` — 8テストから23テストへ。
- `scripts/generate-exercise-catalog.mjs` — 章READMEの課題詳細へ全項目を描画。観察課題を章READMEと `CODE_EXERCISES.md` へ収録。

### 追加した検証（`scripts/validate-exercises.mjs`）

| コード | 検出する状態 |
|---|---|
| `SCHEMA_VERSION` | マニフェストのスキーマ版が2でない |
| `RUBRIC_FIELD_MISSING` | 必須項目そのものが無い |
| `RUBRIC_FIELD_COUNT` | 件数が規定範囲外（ヒントが3件でない、警告が0件、ほか） |
| `RUBRIC_ITEM_EMPTY` | 8文字未満の空項目 |
| `RUBRIC_ITEM_FORMAT` | 改行・パイプ・行頭括弧・箇条書き記号・リンク記法の混入（本文の表とリンク検査を壊す表記） |
| `RUBRIC_ITEM_BOILERPLATE` | 改訂前の汎用テンプレート文が残っている |
| `RUBRIC_ITEM_DUPLICATE` | 同一項目内の重複 |
| `VERIFICATION_COMMAND_MISSING` | テスト方法に実行コマンドが1件も無い |
| `ESTIMATE_BASIS_MISSING` | 推定時間の内訳が無い |
| `DIFFICULTY_INVALID` / `DIFFICULTY_STAR_MISMATCH` | 難易度が1〜3でない、見出しの★数と食い違う |
| `MINUTES_INVALID` | 推定時間が15〜600分の5分刻みでない |
| `STARTER_SOLUTION_UNPAIRED` | starterに対応するsolutionが命名規約どおりに存在しない |
| `HEADING_UNREGISTERED` / `HEADING_MISSING` | 本文の課題見出しとマニフェストの対応漏れ |
| `TITLE_MISMATCH` | 本文見出しとマニフェストのタイトル不一致 |
| `CARD_MISSING` / `CARD_ORPHAN` / `CARD_MARKER_UNBALANCED` | 演習カードの欠落・孤立・マーカー不整合 |
| `OBSERVATION_FIELD_MISSING` / `OBSERVATION_SOURCE_INVALID` | 観察課題の登録不備 |
| `EXERCISE_ID_DUPLICATE` | 演習IDの重複 |

導線の対応規則は「`name.ext` → `name.solution.ext`」「`starter.ext` → `solution.ext`」「`starter/` → `solution/`」の3通り。140件のstarterすべてが規則どおり対応することを確認した。

### ドキュメント

- `CONTRIBUTING.md` — 「4.5 演習カードの必須項目」を追加。正本と再生成コマンドの手順を追記。
- `README.md` — 演習カードの説明と正本・検証コマンドを追記。
- `CHAPTER_TEMPLATE.md`（生成物）— 「演習詳細はKEN-48で拡張します」を、実際の項目一覧へ差し替え。
- `CODE_EXERCISES.md`（生成物）— 必須項目表、全体集計、観察課題一覧を追加。
- `code/ch01/README.md` 〜 `code/ch30/README.md`（生成物、30ファイル）— 課題詳細に全項目を描画。

### package.json

- `apply:exercise-rubrics` / `apply:exercise-rubrics:check` を追加し、`check:handbook` へ組み込んだ。
- `test:exercise-rubrics` を追加し、`test:handbook` へ組み込んだ。

## 検証結果

固定版ではなくローカルのNode.js v26.7.0 / pnpm 11.15.1 で実行した（`engines` は Node.js 24.18.0 を要求するため pnpm が engine 警告を出すが、実行結果には影響していない）。

| コマンド | 結果 |
|---|---|
| `pnpm run validate:exercises` | 成功（エラー0、警告0） |
| `pnpm run generate:exercise-catalog:check` | 成功（31ファイル差分なし） |
| `pnpm run apply:exercise-rubrics:check` | 成功（136カード、7ファイル差分なし） |
| `pnpm run test:exercises` | 成功（23/23） |
| `pnpm run test:exercise-rubrics` | 成功（5/5） |
| `pnpm run validate:handbook` | 成功（エラー0、既知の重複アンカー候補27件） |
| `pnpm run check:handbook` | 成功（終了コード0、WARN 0件、ERROR 0件、テスト58/58） |

`validate:exercises` の集計。

- 対象章: 30
- 演習単位: 132
- 観察課題: 4
- 開始地点成果物: 140
- 模範解答成果物: 157
- 本文コード参照: 145
- 演習カード: 136 / 課題見出し: 136

`check:handbook` に含まれる個別チェックもすべて成功した。

- 学習レベル385節: 差分なし
- 学習ルート6経路: 差分なし
- 章学習ガイド30章: 差分なし
- 目次・索引・アンカー生成: 差分なし
- 物語構成: 30/30章 completed
- クリーン環境台帳: 132件、カテゴリ集計 local-automated 102 / local-tls 7 / external-service 17 / browser-manual 6（改訂前と同一）

全30章について `node scripts/validate-exercises.mjs --chapter chXX`（各章の `lint` / `test` スクリプトが呼ぶ形式）を個別に実行し、30/30成功を確認した。

## 完了条件の達成根拠

### 1. 読者が自己採点できる

- 136課題すべてに、二値判定できる完成条件を合計754項目、チェックボックス形式で本文と章READMEへ描画した。「理解する」「意識する」のような判定不能な表現は使っていない。
- 136課題すべてに、合否判定基準付きのテスト方法を合計438項目付与し、全課題で1件以上に実行コマンド（`pnpm --filter @handbook/chXX run test`、`node`、`bash`、`curl`、`docker compose`、`openssl` など）を含めた。`VERIFICATION_COMMAND_MISSING` が機械的にこれを保証する。
- 期待出力490項目は「200 OKのステータス行」「5列のCSVが1行」「`content-length` の数値とボディのバイト数が一致」のように出力の形を示し、実行結果と突き合わせられる。
- 観察項目500項目が、合否の外側で原理を確認する見るべき対象（DevToolsのタブ、ログ行、コマンド出力）を指定する。

### 2. starterからsolutionまでの導線が一致

- 演習カードに開始地点と模範解答の実パスを明示した。
- `STARTER_SOLUTION_UNPAIRED` が、starter 140件すべてについて命名規約どおりのsolutionの存在を検査する。現在の違反は0件。
- 章READMEの課題一覧表と課題詳細の導線は同じマニフェストから生成されるため、本文・章README・マニフェストの三者がずれない。ずれた場合は `generate:exercise-catalog:check` と `apply:exercise-rubrics:check` が失敗する。
- `TITLE_MISMATCH`、`HEADING_MISSING`、`CARD_MISSING` により、本文の課題見出しとマニフェストの対応漏れも検出する。
- コード成果物を持たない4件は `observationExercises` として区別し、「コード成果物はありません。観察結果と判断根拠を自分の記録へ残し、完成条件で照合します」と明示した。導線の欠落を沈黙で通さない。

### 3. 演習だけを実施しても学習目標を確認できる

- 前提481項目が、着手前に読む節を「3.4 TLSハンドシェイク」のように節番号+節タイトルで指定する。演習から入った読者が必要な本文だけを辿れる。
- 目的と完成条件が対で示されるため、章本文を通読しなくても、その課題で何を確認したことになるのかが閉じる。
- 段階的ヒント408項目（方針 → 構造 → 実装の要点）が、模範解答を開く前の足場になる。汎用文は `RUBRIC_ITEM_BOILERPLATE` で禁止した。
- 本番利用時の警告332項目が、教材実装で省略した保証を明示する。演習だけを実施した読者が、到達点と本番要件の差を誤解しない。
- 推定時間の内訳136件により、着手前に所要時間を見積もれる。

## 積み残し

今回の改訂で発見したが、KEN-48の範囲外として修正していない項目。

### 本文のコマンド例と実ファイルの不一致

演習カードは実ファイル側に合わせて執筆したため読者は詰まらないが、本文の「コード集の使い方」ブロックには存在しないパスが残っている。

- 第4章: `open render-bench/index.html`、`open todo-vanilla/index.html`（実体は `index.solution.html` のみ）
- 第9章: `npm run dev:csr` 〜 `dev:pwa`、`serve:ssg`（`code/ch09/package.json` に無い）
- 第6章: `npm run serve`（無い）
- 第19章: `manifest-validator/validate.ts`、`cd dockerfile-optimization && bash bench.sh`（実体は `solution/main.sh`）
- 第20〜21章: `tsx mini-terraform.ts`、`tsx drift-detect.ts`、`blue-green-controller.ts`、`canary-controller.ts`（実体は `*/solution/main.sh` または `drift.solution.ts`）
- 第23章: `tsx sqli/demo.ts`、`tsx xss/demo.ts`（実体は `sqli/solution/demo.ts`、`xss/solution/main.ts`）
- 第28章: `tsx adr-gen.solution.ts new "..."` は動作しない（`adr-gen.solution.ts` は関数をexportするだけで `process.argv` を読まない）

### 模範解答が本文要件を下回る演習

- 課題9.1: 本文は「模範解答: `code/ch09/`（4つのサブディレクトリ）」と書くが、CSR版とSSG版が存在しない。今回は観察課題として計測手順で採点する形にした。
- 課題12.4: WebSocketチャットのルーム制・ping切断・履歴再送が未実装（部品のみ）。
- 課題16.5: 本文は4エンドポイント・ポート7000だが、実体は `/search` のみ・ポート3004。
- 課題25.1: 本文が要求する `beforeEach` 系フック、`toBeGreaterThan`、非ゼロ終了コードが未実装。
- 課題25.4: 本文はASTパースを要求するが実装は正規表現置換で、`+`/`-` の変異が未実装。
- 課題26.3: 本文が要求する `rejected` メトリクスが未実装。
- 課題19.2: 本文の6チェック項目のうち、配列を読み飛ばす簡易YAMLパーサのため2項目が未実装。
- 課題30.1: 組織登録・ログイン、RBAC、APIキー、Merkle監査、`/metrics`、レート制限、CSP/HSTSが未実装。完成条件をマイルストーン6段に分け、未実装分は読者の実装範囲として切り分けた。

いずれも演習カードの完成条件・期待出力・警告で差分を明示してあるため、読者が「模範解答と一致しない」と誤解する状態にはしていない。

### `config/exercises.json` の `services` の誤り

`services` は `config/clean-environment-plan.json` のカテゴリ区分と拡張CIの手動・外部サービス台帳の入力になっている。変更するとKEN-56の検証台帳と拡張CIの対象が動くため、今回は触っていない。

- 実際には不要: 3.5・4.5・13.6・26.4 の `OpenSSL/TLS`、23.4・20.3・20.4 の `AWS`、28.3・30.1 の `PostgreSQL`、30.1 の `Kubernetes`、22.4 の `Docker` / `Kubernetes` / `AWS` / `localhost`
- 実際には必要: 18.1（大量接続を張るが `なし`）

### 章の所要時間表記の不整合

本文の章末に書かれた合計時間が、`config/exercises.json` の演習合計と食い違う章がある（第10章「合計5-7時間」に対し435分、第13章「合計8-10時間」に対し720分、第28章「5-7時間」に対し480分、第29章「6-8時間」に対し570分）。個別演習の推定時間は妥当と判断したため、本文側の記述調整として残した。

### 実行環境

固定版の Node.js 24.18.0 / pnpm 11.15.1 ではなく、ローカルの Node.js v26.7.0 で検証した。`check:handbook` はNode.js版に依存する処理を含まないため結果は変わらないが、クリーン環境での再確認は `pnpm run validate:clean-environment:runtime` で別途行う。外部サービス（PostgreSQL、Redis、Kafka、Kubernetes、AWS）とブラウザ実操作を伴う演習の実行確認は、KEN-56のクリーン環境検証の範囲であり今回は実施していない。

## 再現手順

```bash
pnpm run apply:exercise-rubrics      # config/exercises.json から本文の演習カードを再生成
pnpm run generate:exercise-catalog   # CODE_EXERCISES.md と code/chXX/README.md を再生成
pnpm run validate:exercises          # 必須項目・導線・本文対応の検査
pnpm run test:exercises              # 検証スクリプトの回帰テスト
pnpm run test:exercise-rubrics       # 演習カード生成の回帰テスト
pnpm run check:handbook              # 上記を含む原稿全体の検査
```

演習カードの内容を変更する場合は `config/exercises.json` だけを編集し、上記を順に実行する。本文・章README・`CODE_EXERCISES.md` を直接編集した変更は `--check` 系のコマンドが失敗として検出する。
