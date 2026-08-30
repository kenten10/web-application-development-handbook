# KEN-58 作業レポート: 表記・用語・コード・図表のスタイルガイド

- 対象issue: KEN-58「表記・用語・コード・図表のスタイルガイドを作る」(親 KEN-34 [WS6])
- 実施日: 2026-08-30
- 前提: KEN-57 (引用形式と一次資料マッピング) 完了、KEN-49〜52 (WS4) の節追加反映後
- 後続: KEN-59 (全文の編集校正とリンク検査) がこの成果物を使って走る

## 1. 実態調査

思い込みでルールを決めないため、本文7ファイル (非コード行 26,849行、コードフェンス 860個) を機械走査して分布を数えた。調査スクリプトは使い捨てのため残していないが、結果は `scripts/validate-style.mjs` が同じ判定で再現できる。

### 1.1 文字種・記号

| 項目 | 調査前の分布 | 判定 |
|---|---|---|
| 句読点 | `、` 14,013 / `。` 7,743 / `，` 0 / `．` 0 | 揺れなし。回帰ガードとして規則化 |
| 全角英数字 | 0件 | 揺れなし。回帰ガードとして規則化 |
| 感嘆符・疑問符 | `!` 5 / `！` 0 / `?` 53 / `？` 0 | 揺れなし。回帰ガードとして規則化 |
| 全角スペース (U+3000) | 0件 | 揺れなし。回帰ガードとして規則化 |
| 括弧 | 半角 `(` 2,725 / 全角 `（` 839 | **揺れあり**。半角へ統一 |
| 半角括弧の外側スペース | 前に空白あり 1,883 / なし 842 | **揺れあり**。和文隣接時に空白必須へ統一 |
| 全角ダッシュ | `―` (U+2015) 818 / `—` (U+2014) 67 / `–` 0 | **揺れあり**。`―` へ統一 |
| 波ダッシュ | `〜` (U+301C) 87 / `～` (U+FF5E) 0 | 揺れなし。回帰ガードとして規則化 |

全角括弧839件のうち622件は演習カード・章学習ガイドの生成ブロック内にあり、`config/exercises.json` と `scripts/apply-exercise-rubrics.mjs` のラベル定義が発生源だった。`scripts/generate-exercise-catalog.mjs` は同じラベルを半角で出力しており、生成器どうしで書式が食い違っていた。

全角ダッシュ67件はすべて `scripts/apply-chapter-guides.mjs` が出力する「前提知識」行の区切りだった。

### 1.2 コードブロック

860個のフェンスのうち **177個 (20.6%) が言語指定なし**。内容はテキスト図、コンソール出力、ディレクトリ構成、HTTPメッセージ例で、いずれも構文強調を意図していない。指定ありの内訳は typescript 404、bash 75、sql 60、tsx 38、yaml 18、json 16、html 11、text 10、ほか。

### 1.3 文体

敬体の文末を検出したのは20行。うち16行はかぎ括弧で囲んだUI文言・エラーメッセージ・発話の例示 (`「メールアドレスは @ を含む必要があります」` など) で、KEN-52 が定めた例外に該当する。実際の違反は次の5件だった。

- `config/exercises.json` の観察課題定型文「コード成果物はありません。…照合します。」が本文4か所へ展開されていた (発生源は `scripts/apply-exercise-rubrics.mjs` のハードコード)
- 見出し `### 完成おめでとうございます!` (08-part7-practice.md)

### 1.4 用語・同義語

52グループを語境界つきで数え、35グループで揺れを検出した。是正対象にしたのは次のとおり。

| 揺れ | 調査結果 | 決定 |
|---|---|---|
| サーバー / サーバ | 1 / 487 | サーバ |
| ユーザー / ユーザ | 148 / 30 | ユーザー |
| ヘッダー / ヘッダ | 2 / 174 | ヘッダ |
| ルーター / ルータ | 1 / 8 | ルータ |
| インターフェース / インタフェース | 1 / 10 | インタフェース |
| トリガー / トリガ | 3 / 2 | トリガー |
| PostgreSQL / Postgres | 46 / 59 | PostgreSQL |
| Nginx / NGINX | 15 / 3 | nginx |
| Kubernetes / k8s / K8s | 54 / 9 / 2 | Kubernetes、略記は K8s |
| CloudFlare / Cloudflare | 1 / 多数 | Cloudflare |
| リトライ / 再試行 | 86 / 91 | リトライ (既存分はKEN-59へ) |
| デフォルト / 既定 | 26 / 60 | デフォルト (既存分はKEN-59へ) |
| JavaScript / JS | 96 / 41 | JavaScript (既存分はKEN-59へ) |
| TypeScript / TS | 90 / 10 | TypeScript (既存分はKEN-59へ) |
| シリアライズ / 直列化 | 8 / 14 | シリアライズ (既存分はKEN-59へ) |
| エラー処理 / エラーハンドリング | 11 / 7 | エラー処理 (既存分はKEN-59へ) |

揺れがなかった語 (ブラウザ、メモリ、クエリ、プロキシ、ライブラリ、コンテナ、クラスタ、パラメータ、ハンドラ、スキーマ、冪等、Cookie、MySQL、MongoDB、Redis、GraphQL、WebSocket ほか) も回帰ガードとして用語集へ登録した。

大文字小文字の混在は ASCII トークン424件で検出したが、`javascript:` スキーム、`.github/workflows`、`docker-compose`、`react-intl`、`web-vitals` のような識別子・パスが大半で、実表記の誤りは `CloudFlare` 1件のみだった。`REdis Serialization Protocol` と `eXpress Data Path` は正式な略語展開であり誤りではない。

### 1.5 略語の初出

68個の主要略語を読み順に走査したところ、**67個が初出行に英語正式名称を伴っていなかった**。段落単位・地の文限定・生成ブロック除外で数え直すと59件が残る。初出位置の多くが章導入文、学習ガイド (生成物)、表、チェックリストであり、機械的な一括挿入は本文の意味を壊す。KEN-59 へ引き継ぐ。

### 1.6 曖昧表現

21語を対象に「同じ段落に時点・出典・判定基準があるか」で判定した。総出現95件のうち **根拠あり39件、根拠なし56件**。語別の内訳は 最新7、近年7、モダン6、主流5、事実上の標準5、人気4、最近4、業界標準3、AI時代2、爆発的2、圧倒的2、一般的に2、劇的2、最強2、革命1、驚くほど1、ベストプラクティス1。

## 2. 定義したルール

`STYLE_GUIDE.md` に21ルールを定義し、`config/style-guide.json` へ機械検査用の定義を置いた。両者のID集合が一致しないと S-META-001 で失敗する。

| ID | 分類 | 内容 | 適用 |
|---|---|---|---|
| S-JA-001 | 日本語表記 | 句読点は「、」「。」に統一する | error |
| S-JA-002 | 日本語表記 | 英数字は半角で書く | error |
| S-JA-003 | 日本語表記 | 感嘆符・疑問符は半角で書く | error |
| S-JA-004 | 日本語表記 | 括弧は半角 () に統一する | error |
| S-JA-005 | 日本語表記 | 全角スペースを使わない | error |
| S-JA-006 | 日本語表記 | 半角括弧の外側に半角スペースを1つ置く | error |
| S-JA-007 | 日本語表記 | 本文の文体は常体に統一する | error |
| S-SYM-001 | 記号 | 全角ダッシュは ― (U+2015) を使う | error |
| S-SYM-002 | 記号 | 波ダッシュは 〜 (U+301C) を使う | error |
| S-CODE-001 | コード・図表 | コードブロックには必ず言語を指定する | error |
| S-CODE-002 | コード・図表 | 言語識別子は許可一覧から選ぶ | error |
| S-CODE-003 | コード・図表 | 表はGFMのパイプ表とし区切り行を置く | error |
| S-CODE-004 | コード・図表 | 図はテキスト図としてコードブロックに置く | error |
| S-CODE-005 | コード・図表 | 注意・補足はラベル4種で書く | error |
| S-TERM-001 | 用語 | 用語集の非正規表記を使わない | error |
| S-TERM-002 | 用語 | 用語集の非推奨表記を新規に増やさない | baseline |
| S-EN-001 | 英語併記 | 略語は初出で英語正式名称を併記する | baseline |
| S-VAGUE-001 | 曖昧表現 | 時点・出典・判定基準を添えて使う | baseline |
| S-IDX-001 | 索引 | 索引語に非正規表記を含めない | error |
| S-IDX-002 | 索引 | 索引必須の用語は索引に存在させる | error |
| S-META-001 | 運用 | ルールIDはSTYLE_GUIDE.mdと一致させる | error |

内訳: error 18ルール、baseline 3ルール。分類別は 日本語表記7、記号2、コード・図表5、用語2、英語併記1、曖昧表現1、索引2、運用1。

### 2.1 曖昧表現の「使用基準」の考え方

禁止ではなく条件付き許可とした (S-VAGUE-001)。対象語を同じ段落で使ってよいのは、次のいずれかを添えたときに限る。

1. 時点 (西暦年、版番号、「2026年時点」)
2. 出典 (`[Fielding, 2000]` `[RFC 9110]` などの参考文献キー、一次資料名)
3. 判定基準 (数値、条件、観測方法)

判定は `config/style-guide.json` の `evidencePatterns` が担い、段落単位で根拠の有無を見る。95件中39件は既にこの基準を満たしており、禁止ではなく基準化が実態に合う。

### 2.2 baseline 方式を選んだ理由

「検出できるが誰も直さない」を避けつつ `check:handbook` を落とさないため、次の方針を採った。

- error 分類の18ルールは、**本issueで本文の違反を0件にした**うえで有効化した。1件でも混入すれば失敗する。
- baseline 分類の3ルールは、既存違反数を `config/style-guide.json` の `baselines` にファイル単位で記録した。**その件数を超えたら失敗する**ため、新規混入だけを止める。既存分は警告として報告し、`STYLE_BACKLOG.md` に全件を残してKEN-59へ引き継ぐ。上限の引き上げは禁止し、修正して減ったときだけ下げる運用を `STYLE_GUIDE.md` と `CONTRIBUTING.md` に明記した。

## 3. 用語集

- 正本: `config/glossary.json` (見出し語 **156語**、別表記 **128件**、うち error 106件・warn 22件)
- 生成物: `GLOSSARY.md` (`scripts/generate-glossary.mjs`、`--check` で差分検出)
- 分類: 日本語表記48、製品名・プロジェクト名38、略語65、訳語の選択5
- 索引必須フラグ (`indexTerm`): 45語

各見出し語は正表記、読み (五十音整列用)、分類、定義、別表記と重大度、検査除外文字列 (`exceptions`)、略語の英語正式名称を持つ。

### 3.1 正表記の判断が割れたものと理由

| 語 | 決定 | 理由 |
|---|---|---|
| nginx | `nginx` (全小文字) | nginx.org の公式表記が全小文字。F5 のブランド表記 `NGINX` と割れるため、製品名 `NGINX Ingress` / `NGINX Plus` だけを例外に登録した。節見出し「18.8 リバースプロキシとしての Nginx」も改名し、`config/learning-levels.json` と `config/exercises.json` を同時に更新した |
| PostgreSQL | `PostgreSQL` | 公式サイトは `Postgres` も別称として認めるが、正式名称を優先した。節見出し 14.18 / 15.8 / 16.7 と索引語3件を改名した |
| Kubernetes / K8s | 本体は `Kubernetes`、略記は `K8s` | Kubernetes 公式が認める略記は `K8s`。`k8s` `K8S` を非正規とした。`**Kubernetes (k8s)**` のような略語導入箇所を壊さないため、`k8s` を `Kubernetes` ではなく `K8s` へ寄せた。課題19.2の見出しも改名した |
| サーバ / ユーザー | 語ごとに固定 (`サーバ` と `ユーザー`) | 長音符の扱いを書物全体で一律にしない方針を採った。JIS Z 8301 系の語尾長音省略に寄せると `ユーザ` 148件を書き換えることになり、慣用から離れる。本書の支配的表記 (サーバ 487:1、ユーザー 148:30) を語ごとの正表記とした |
| トリガー | `トリガー` | 3件対2件でほぼ拮抗。PostgreSQL 日本語ドキュメントの表記に合わせて長音を保持した |
| 括弧 | 半角 `()` | 既存の多数派 (半角2,725 : 全角839)。かぎ括弧 `「」` と書名 `『』` は全角のまま |
| 全角ダッシュ | `―` (U+2015) | 既存の多数派 (818 : 67)。節タイトルの副題区切りに使われている形 |
| リトライ / 既定 / JS / TS / 直列化 / エラーハンドリング | 正表記は決定、既存分は未修正 | いずれも訳語選択であり、どちらも日本語として正しい。本文をまたぐ一括置換は文意の確認が要るため warn とし、KEN-59 へ引き継いだ |
| 可観測性 | `可観測性` (`オブザーバビリティ` は非推奨) | 本文は `可観測性` 22件のみ。節見出し「22.1 Monitoring と Observability の違い」があるため、英語表記 `Observability` は例外に登録した |
| Cookie | `Cookie` | RFC 6265 の表記。`クッキー` は本文0件だが回帰ガードとして登録した |
| SSL | TLS の別表記にしない | `SSL` は歴史的に別プロトコルであり、`SSL/TLS` の併記や過去の説明で正当に使う。用語集の別表記から外した |

## 4. 索引と用語表記の一致

完了条件「索引と用語表記が一致」は、次の2方向の機械検査と実際の修正で満たした。

- **S-IDX-001**: `10-index.md` の索引語639件を用語集の error 別表記と照合する。括弧内の限定語も対象にする。
- **S-IDX-002**: 用語集で `indexTerm` が真の45語が索引に同表記で存在することを確認する。索引語を消す変更が用語集の見出し語を孤立させないための回帰ガード。

実際に一致させるために変更した索引語は4件。いずれも本文側の `handbook:index` メタデータを直し、`pnpm run generate:handbook` で `10-index.md` を再生成した。

| 変更前 | 変更後 | 位置 |
|---|---|---|
| `JSONB (Postgres)` | `JSONB (PostgreSQL)` | 05-part4-data.md:106 |
| `永続化 (Postgres VACUUM)` | `永続化 (PostgreSQL VACUUM)` | 05-part4-data.md:1189 |
| `Postgres` | `PostgreSQL` | 05-part4-data.md:3626 |
| `Nginx` | `nginx` | 06-part5-infrastructure.md:287 |

`NGINX Ingress` は F5 の製品名として `exceptions` に登録し、索引語のまま維持した。検査後の結果は S-IDX-001 / S-IDX-002 ともに0件。

## 5. 本文へ適用した修正

すべて `scripts/apply-style-fixes.mjs` 経由で行った。手作業の一括置換はしていない。作業前の状態へこのスクリプトを1回実行すると現在の状態が完全に再現できることを確認済み (本文8ファイルと正本JSON 3ファイルがバイト単位で一致)。スクリプトは冪等で、2回目以降は0件になる。

| ルール | 内容 | 件数 |
|---|---|---:|
| S-TERM-001 | 用語を正表記へ置換 | 130 |
| S-JA-004 | 全角括弧を半角へ置換 (`（` と `）` を個別に計上) | 2,042 |
| S-JA-006 | 和文と半角括弧の間へ半角スペースを挿入 | 688 |
| S-SYM-001 | 全角ダッシュを `―` へ統一 | 67 |
| S-CODE-001 | 言語指定のないコードブロックへ `text` を付与 | 177 |
| S-CODE-005 | 注意ラベルを `**注意**:` 形へ整形 | 6 |
| S-JA-007 | 敬体の定型文・見出しを常体へ置換 | 5 |
| 生成器 | 本文へ書き出すラベル定義の修正 | 7 |

用語置換130件の内訳 (検査側の集計):

| 置換 | 件数 |
|---|---:|
| Postgres → PostgreSQL | 59 |
| ユーザ → ユーザー | 30 |
| Nginx → nginx | 15 |
| k8s → K8s | 9 |
| NGINX → nginx | 3 |
| トリガ → トリガー | 3 |
| ヘッダー → ヘッダ | 2 |
| インターフェース → インタフェース | 1 |
| サーバー → サーバ | 1 |
| ルーター → ルータ | 1 |
| CloudFlare → Cloudflare | 1 |

### 5.1 誤置換を避けるための保護

適用スクリプトと検査スクリプトは同じ保護規則を共有する (回帰テストで両者のパターン一致を検証)。

- コードフェンスの内側、インラインコード、Markdownリンク先、URL、HTMLタグは対象外
- `code/` `scripts/` `config/` `.github/` などで始まるパス、拡張子付きのパス断片は対象外
- 正本JSONでは、文字列全体がパス・識別子のものを対象外 (`code/ch11/mini-express.ts` を `mini-Express.ts` にしない)
- 用語ごとの `exceptions` を先にマスクしてから照合 (`サーバーレス`、`NGINX Ingress`、`docker compose`、`.terraform.state`、`javascript:` など)
- 正表記が別表記の前方一致になる場合は後続文字を除外 (`ユーザ(?!ー)`、`トリガ(?!ー)`)

適用前に全差分をレビューし、次の誤置換を検出して例外を追加した。`**Kubernetes (k8s)**` → `**Kubernetes (Kubernetes)**`、`.terraform.state.json` → `.Terraform.state.json`、`docker --init` → `Docker --init`、`code/ch11/mini-express.ts` → `mini-Express.ts`、`**完成条件 (…) **` の末尾余白による強調の破壊。

### 5.2 生成器への修正

本文へ直接ラベルを書き出す生成器が発生源だったため、正本側を直した。

- `scripts/apply-exercise-rubrics.mjs`: `**完成条件（自己採点用チェックリスト）**` → `**完成条件 (自己採点用チェックリスト)**`、`**テスト方法（自己採点手順）**` → 半角、`**段階的ヒント**（…）` → 半角、観察課題の敬体定型文を常体へ。`scripts/generate-exercise-catalog.mjs` は既に半角であり、生成器間の食い違いが解消した。
- `scripts/apply-exercise-rubrics.test.mjs`: 期待ラベルを追従。
- `scripts/apply-chapter-guides.mjs`: 「前提知識」行の区切りを `—` から `―` へ。

### 5.3 節見出しの改名

用語の正表記化にともない4つの見出しを改名し、参照する正本JSONを同時に更新した。生成物 (`01-toc.md`、`LEARNING_PATHS.md`、`CODE_EXERCISES.md`、`code/chXX/README.md`) は再生成で追従させ、`--check` 系がすべて差分なしで通ることを確認した。

| 変更前 | 変更後 | 追従した正本 |
|---|---|---|
| 14.18 VACUUM の詳細 ― Postgres 運用の死活問題 | ― PostgreSQL 運用の死活問題 | `config/learning-levels.json` |
| 15.8 Postgres でどこまで戦えるか | 15.8 PostgreSQL でどこまで戦えるか | `config/learning-levels.json` |
| 16.7 Postgres の全文検索 | 16.7 PostgreSQL の全文検索 | `config/learning-levels.json` |
| 18.8 リバースプロキシとしての Nginx | ― としての nginx | `config/learning-levels.json`、`config/exercises.json` |
| 課題19.2: k8s manifest 検証ツール | 課題19.2: K8s manifest 検証ツール | `config/exercises.json` |

`beta-review-scope.json` と `config/narrative-flow.json` には影響がなく、`validate:beta-review` と `validate:narrative-flow` は変更前後で同じ結果になった。

## 6. KEN-59 へ引き継ぐ未修正違反

合計 **338件**。全件の箇所と本文を `STYLE_BACKLOG.md` (生成物、372行) に記載した。`config/style-guide.json` の `baselines` が各ファイルの上限として働くため、この件数を超えると `validate:style` が失敗する。

| ルール | 内容 | 件数 | 主な内訳 |
|---|---|---:|---|
| S-TERM-002 | 用語集の非推奨表記 | 223 | 再試行→リトライ 91、既定→デフォルト 60、JS→JavaScript 41、直列化→シリアライズ 14、TS→TypeScript 10、エラーハンドリング→エラー処理 7 |
| S-EN-001 | 略語の初出併記なし | 59 | HTTP、URI、URL、HTML、CSS、DNS、TLS、API ほか。初出位置が章導入・表・チェックリストのため機械挿入できない |
| S-VAGUE-001 | 曖昧表現の根拠なし | 56 | 最新7、近年7、モダン6、主流5、事実上の標準5 ほか。第5章の章タイトル「モダンJavaScript完全マスター」を含む |

引き継ぎ方針を `STYLE_BACKLOG.md` の冒頭と `STYLE_GUIDE.md` の 0.3 に明記した。修正して件数が減ったときだけ `pnpm run validate:style --update-baseline` と `pnpm run report:style-backlog` で上限と一覧を下げる。

## 7. 変更・新規作成したファイル

### 新規

| ファイル | 役割 |
|---|---|
| `STYLE_GUIDE.md` | 表記・用語・コード・図表・注記の規約。21ルールとID、章レビュー用チェックリスト |
| `GLOSSARY.md` | 用語集 (生成物) |
| `STYLE_BACKLOG.md` | 未修正違反の一覧 (生成物) |
| `config/glossary.json` | 用語の正表記・別表記・定義の正本 |
| `config/style-guide.json` | ルールID、検査範囲、語彙一覧、ベースラインの正本 |
| `scripts/validate-style.mjs` | ルールの機械検査。`--update-baseline` `--backlog` `--backlog --check` |
| `scripts/validate-style.test.mjs` | 検査・適用・生成の回帰テスト (33件) |
| `scripts/apply-style-fixes.mjs` | 機械適用できるルールの一括適用 (冪等) |
| `scripts/generate-glossary.mjs` | `GLOSSARY.md` の生成と `--check` |
| `KEN58_STYLE_GUIDE_REPORT.md` | このレポート |

### 変更

| ファイル | 変更内容 |
|---|---|
| `00-front-matter.md` | 括弧の半角化 |
| `02-part1-foundations.md` 〜 `08-part7-practice.md` | 用語、括弧、ダッシュ、コードブロック言語、注意ラベル、文体、索引メタデータ |
| `config/exercises.json` | 用語、括弧、敬体定型文、課題19.2の見出し、18.8への参照 |
| `config/learning-levels.json` | 改名した4節のタイトル |
| `config/chapter-guides.json` | 節リンクのラベル |
| `scripts/apply-exercise-rubrics.mjs` / `.test.mjs` | 生成ラベルの書式と敬体定型文 |
| `scripts/apply-chapter-guides.mjs` | 前提知識行の区切り記号 |
| `scripts/validate-handbook.mjs` | リンク検査の対象へ新規3文書を追加 |
| `package.json` | 6スクリプト追加、`check:handbook` と `test:handbook` へ組み込み |
| `CONTRIBUTING.md` | 1.9節を新設して`STYLE_GUIDE.md`へリンク、手動編集可否表、PR確認項目、自動検証一覧、末尾に運用手順を追加 |
| `README.md` | 文書一覧と編集規約の案内に3文書を追加 |
| `01-toc.md`、`10-index.md`、`LEARNING_LEVELS.md`、`LEARNING_PATHS.md`、`CODE_EXERCISES.md`、`CHAPTER_TEMPLATE.md`、`code/chXX/README.md` | 生成物。すべて生成スクリプト経由で再生成 |

`LICENSE`、`LICENSE-TEXT`、`LICENSING.md`、`RELEASE_POLICY.md`、`CHANGELOG.md`、`ERRATA.md`、`config/release.json`、`.github/`、`scripts/build-site.mjs`、`scripts/validate-release-policy.mjs` (KEN-62)、`beta-review-scope.json`、`BETA_REVIEW_*.md`、`scripts/validate-beta-review.mjs` (KEN-60) は変更していない。新規ファイルは `config/release.json` の既存規則 (`scripts/**`、`config/**`、`*.md`) で分類されるため、判定規則への追記も不要だった。

## 8. package.json への組み込み

```
validate:style               node scripts/validate-style.mjs
test:style                   node --test scripts/validate-style.test.mjs
generate:glossary            node scripts/generate-glossary.mjs
generate:glossary:check      node scripts/generate-glossary.mjs --check
apply:style-fixes            node scripts/apply-style-fixes.mjs
report:style-backlog         node scripts/validate-style.mjs --backlog
report:style-backlog:check   node scripts/validate-style.mjs --backlog --check
```

- `check:handbook` へ `generate:glossary:check` (生成物の差分検出)、`validate:style`、`report:style-backlog:check` を追加
- `test:handbook` へ `test:style` を追加

## 9. 検証結果

| コマンド | 結果 |
|---|---|
| `pnpm run validate:style` | **ERROR 0 / WARN 3** (baseline 3ルールの既知件数サマリ) |
| `pnpm run test:style` | **33 tests / 33 pass / 0 fail** |
| `pnpm run validate:handbook` | **ERROR 0 / WARN 27** (すべて既存の `ANCHOR_DUPLICATE`) |
| `pnpm run check:handbook` | **終了コード0**。内訳は下表 |
| `pnpm run validate:release-policy` | ERROR 0 / WARN 0 (licensed files: code=788, text=50, notice=2) |
| `pnpm run validate:beta-review` | 変更なし (chapters=30 core=15/exercise-only=5/sampled=10、requiredSections=199) |
| `pnpm run validate:narrative-flow` | 変更なし (chapters=30, completed=30) |
| `pnpm run validate:exercises` | 通過 (cards 147 / headings 147、manuscript references 156) |
| `pnpm run build:site:check` | 通過 |

`check:handbook` 内訳:

| 検査 | ERROR | WARN |
|---|---:|---:|
| `validate:handbook` | 0 | 27 (`ANCHOR_DUPLICATE`、作業前と同一) |
| `validate:release-policy` | 0 | 0 |
| `validate:style` | 0 | 3 (新規) |
| その他の `--check` / `validate:*` / `test:*` | 0 | 0 |

**ERROR 0 を維持した。`ANCHOR_DUPLICATE` の27件は作業前後で件数・内容とも変わっていない** (`#コード集の使い方` 18、`#採用判断` 2、`#仕組み` 1、ADR の `#context` `#decision` `#consequences` `#alternatives-considered` 各1、`#コード集の使い方` の残り4)。

**WARN は3件増えた。** 増分はすべて `validate:style` が出す baseline 3ルールの集計行で、S-TERM-002 223件、S-EN-001 59件、S-VAGUE-001 56件の存在を1行ずつ報告するものである。個々の違反は `STYLE_BACKLOG.md` に一覧化してある。件数がベースラインを超えた時点でWARNではなくERRORへ変わる。

`pnpm run validate:workspace` は実行環境の Node.js が v26.7.0 (本書の固定版は 24.18.0) のため作業前から失敗する。今回の変更とは無関係で、`check:handbook` には含まれない。

## 10. 完了条件の充足

### (1) STYLE_GUIDE が存在する

`STYLE_GUIDE.md` を作成した。issueの作業5項目をすべて含む。

- 日本語表記・全角半角・句読点・英語併記のルール: S-JA-001〜007、S-SYM-001〜002、S-EN-001
- 用語集と同義語の混在解消: S-TERM-001〜002、`config/glossary.json` (156語)、`GLOSSARY.md`、本文130件の置換
- コードブロック・警告・補足・表・図の記法統一: S-CODE-001〜005、本文183件の修正
- 製品名・規格名・略語の初出ルール: S-TERM-001 (公式表記優先の決定手順)、S-EN-001 (初出の定義と併記形式)
- 曖昧表現の使用基準: S-VAGUE-001 (禁止ではなく、時点・出典・判定基準のいずれかを添える条件付き許可)

各ルールに `S-JA-001` 形式のIDを付け、KEN-59 から参照できるようにした。IDの過不足は S-META-001 が機械検出する。

### (2) 全章レビューで参照できる

- `STYLE_GUIDE.md` の「9. 章レビュー用チェックリスト」に、機械検査 (9.1)、表記と文体 (9.2)、用語 (9.3)、コード・図表 (9.4)、主張の強さ (9.5) の5区分・20項目のチェックボックスを置き、各項目に対応ルールIDを併記した。
- `CONTRIBUTING.md` の 1.9節から `STYLE_GUIDE.md` へリンクし、手動編集可否表、PR確認項目 (4項目追加)、自動検証一覧、末尾の運用手順へ反映した。
- `README.md` の文書一覧と編集規約の案内にも追加した。
- `GLOSSARY.md` から `STYLE_GUIDE.md` へ相互リンクし、`validate:handbook` のリンク検査対象に含めた。

### (3) 索引と用語表記が一致

- S-IDX-001 が索引語639件を用語集の正表記と照合し、S-IDX-002 が索引必須45語の存在を確認する。いずれも `check:handbook` で走る。
- 不一致だった索引語4件を本文の索引メタデータ側で修正し、`generate:handbook` で `10-index.md` を再生成した。検査結果は0件。
- 回帰テストで、索引語に非正規表記を入れた場合 (S-IDX-001) と索引必須語を消した場合 (S-IDX-002) の双方が検出されることを確認した。

## 11. 積み残しとブロッカー

### 積み残し (KEN-59 へ)

1. S-TERM-002 の223件。訳語選択 (リトライ / 再試行、デフォルト / 既定、JS / JavaScript、TS / TypeScript、シリアライズ / 直列化、エラー処理 / エラーハンドリング) はどちらも日本語として正しく、文脈によっては短縮形が適切なため、一括置換ではなく通読時の判断に委ねた。
2. S-EN-001 の59件。略語の初出併記。初出位置の多くが章導入文・表・チェックリストであり、正式名称を挿入するには本文の書き換えが要る。
3. S-VAGUE-001 の56件。とくに第5章の章タイトル「モダンJavaScript完全マスター」は改名すると `config/learning-levels.json`、`config/chapter-guides.json`、`config/exercises.json`、`beta-review-scope.json` へ波及するため、KEN-59 と KEN-60 の収束状況を見て判断するのが望ましい。
4. `ANCHOR_DUPLICATE` 27件。KEN-48 以降の既知事項で、本issueの範囲外。見出し名の一意化が必要。
5. 半角括弧の外側スペースのうち、隣接文字が英数字・記号のもの (約335件) は S-JA-006 の対象外にした。`useState()` のような関数呼び出しの記法を壊さないためで、`**強調**(補足)` のような箇所は人手の判断が要る。

### ブロッカー

なし。

### 注意点

- 実行環境の Node.js は v26.7.0 で、本書の固定版 24.18.0 と異なる。`validate:workspace` は作業前から失敗しており、今回の変更とは無関係。固定環境での再確認が望ましい。
- `apply:style-fixes` は本文と正本JSONの両方を書き換える。実行後は `apply:chapter-guides` → `apply:exercise-rubrics` → `generate:exercise-catalog` → `generate:handbook` → `generate:glossary` → `report:style-backlog` の順で生成物を追従させる必要がある。手順は `STYLE_GUIDE.md` の10節と `CONTRIBUTING.md` 末尾に記載した。
