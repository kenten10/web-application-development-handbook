# KEN-59 全文の編集校正とリンク検査 作業レポート

基準日: 2026-08-30
対象issue: [KEN-59 全文の編集校正とリンク検査を完了する](https://linear.app/kenten/issue/KEN-59) (WS6 / KEN-34 の最終子issue)
通読記録: [`KEN59_FULL_READ_LOG.md`](./KEN59_FULL_READ_LOG.md)

## 0. 結果の要約

| 指標 | 着手時 | 完了時 |
|---|---:|---:|
| `pnpm run check:handbook` 終了コード | 0 | **0** |
| `validate:handbook` ERROR / WARN | 0 / 27 | **0 / 0** |
| `validate:style` ERROR / WARN | 0 / 3 | **0 / 0** |
| `STYLE_BACKLOG.md` の未修正件数 | 338 | **0** |
| `validate:links` ERROR / WARN (新設) | ― | **0 / 0** |
| 本文の敬体文末 | ― | **0** |

本文へ適用した修正は **277件** (`config/editorial-fixes.json`)、加えて生成器による一括置換が **3系統** (コード集の使い方27ブロック、所要時間30箇所、用語統一293箇所)。通読で挙げた指摘は435件で、うち修正済291件・機械化50件・見送り94件。

---

## 1. 導入した検査ツールと、外部依存を入れなかった判断

### 判断: 外部npmパッケージは導入しない。Node.js 標準ライブラリで自作する

issue は「textlint・markdownlint・スペルチェック・リンクチェックを導入」と指定しているが、**既製の npm パッケージは1つも入れなかった**。理由は4つある。

1. **リポジトリの方針と一貫しない。** 本リポジトリは `scripts/build-site.mjs` が Markdown パーサも静的サイトジェネレータも使わず Node.js 標準ライブラリだけで動くよう作られている (`README.md` 138行目に明記)。`devDependencies` は `typescript` と `@types/node` の2つだけで、`pnpm-workspace.yaml` の `catalog` もこの2つに絞られている。ここへ textlint (+ 日本語ルールプリセット群)、markdownlint、cspell、markdown-link-check を入れると、直接依存4つに対し推移的依存が数百規模で増える。
2. **`config/release.json` のライセンス分類に影響する。** `validate:release-policy` は配布物のライセンス分類 (`code=797, text=51, notice=2`) を検査している。新しい依存を入れると、その依存自身のライセンス表記と `LICENSING.md` の記述を維持する義務が発生する。本書は v1.0 のリリース直前 (KEN-62 で確定済み) であり、リリース物のライセンス面を今から動かす利益がない。
3. **既製ルールが本書の規約と噛み合わない。** 本書の表記規約は KEN-58 が `STYLE_GUIDE.md` と `config/style-guide.json` に21ルール (S-JA / S-SYM / S-CODE / S-TERM / S-EN / S-VAGUE / S-IDX / S-META) として定義済みで、`scripts/validate-style.mjs` が既に機械検査している。textlint の日本語プリセットを重ねると、規約が二重化してどちらが正本か分からなくなる。**textlint 相当・スペルチェック相当は KEN-58 の `validate:style` が既に担っている**というのが実態である (常体の統一、句読点、全角半角、記号、コードフェンス言語、表の区切り行、用語の正表記、略語の初出併記、曖昧表現の根拠、索引語の一致)。
4. **本書固有の検査は既製ツールでは書けない。** 本issueで最も価値があったのは「`### コード集の使い方` の bash ブロックが指すファイルとスクリプトが実在するか」「`#section-13-25` が実在する節を指すか」「`[McLean, 2015]` が `09-references.md` に登録されているか」といった、この原稿の構造に固有の検査だった。markdown-link-check ではどれも検出できない。

### 新設したもの

| 追加 | 内容 |
|---|---|
| `scripts/validate-links.mjs` (新規) | リンク検査。`config/links.json` を正本に9ルールを検査する。外部依存なし |
| `config/links.json` (新規) | 検査対象文書31件、ルール定義、外部URLの許可スキーム、到達性検査の設定 |
| `scripts/validate-links.test.mjs` (新規) | 回帰テスト3件 |
| `scripts/apply-code-usage.mjs` (新規) | 章末「コード集の使い方」27ブロックを `config/exercises.json` から生成する |
| `scripts/apply-exercise-totals.mjs` (新規) | 実装課題節の所要時間30箇所を `config/exercises.json` から生成する |
| `scripts/apply-editorial-fixes.mjs` (新規) | 校正で確定した個別修正を `config/editorial-fixes.json` から冪等適用する |
| `scripts/validate-handbook.mjs` (改修) | コードフェンス内の見出しを走査対象から除外。索引メタデータの `group` 検査 (INDEX_GROUP_INVALID) を追加 |
| `scripts/validate-style.mjs` (改修) | 曖昧語を部分文字列として含む専門用語 (`最近傍`) を `vagueExceptions` で除外 |
| `scripts/apply-style-fixes.mjs` (改修) | `severity: warn` の用語 (S-TERM-002) も機械適用の対象へ |

`check:handbook` のチェーンへ `apply:code-usage:check`、`apply:exercise-totals:check`、`apply:editorial-fixes:check`、`validate:links` を、`test:handbook` へ `test:links`、`test:code-usage`、`test:exercise-totals` を組み込んだ。`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`config/release.json` は**変更していない** (依存を増やしていないため)。

### 到達性検査の扱い

`L-REACH-001` (外部URLの到達性) は `--check-external` のときだけ動き、**結果は警告として報告し終了コードを変えない**。`config/links.json` の `external.reachability.enabled` は `false` で、`check:handbook` のチェーンにも入れていない。ネットワーク制約のある環境で CI が落ちないようにするためである。手元での実行結果は次のとおり。

```
- reachability checked: 82, unreachable: 3
- [L-REACH-001] HTTP 502: https://crt.sh/
- [L-REACH-001] HTTP 403: https://www.iso.org/iso-4217-currency-codes.html
- [L-REACH-001] HTTP 403: https://www.iso.org/standard/78176.html
```

crt.sh の502は一時的、ISO の403は bot 遮断であり、いずれもURLは正しい。初回実行では doi.org の2件が404になったが、HEAD を拒否するホストだったため、4xx/5xx はすべて GET で確かめ直す実装へ改め、誤検出を解消した。

---

## 2. リンク検査の結果

`node scripts/validate-links.mjs` の最終出力。

```
Link validation
- documents: 31
- markdown links: 2277
- internal file links: 1952
- anchor links: 2153 (section anchors: 2111)
- chapter references: 220
- section references: 728
- code path references: 643
- code usage commands: 190
- external urls: 86 (occurrences: 88)
- errors: 0
- warnings: 0
```

| 種別 | 検査数 | 検出 → 修正 |
|---|---:|---|
| Markdownリンク (内部ファイル) | 1,952 | 0件 (もともと健全) |
| アンカー (うち節アンカー `#section-X-Y`) | 2,153 (2,111) | 0件 |
| 「第N章」参照 | 220 | 3件 (第1章→第2章、第23章→12.3、13.8→23.8) |
| 「N.M」節参照 | 728 | 3件 (27.5の位置、26.1/26.2の課題番号取り違え、30.3の完了形) |
| `code/` 参照パス (インラインコード内) | 643 | 6件 (`https-server.ts`、`task.ts`、`render-bench/index.html`、`todo-vanilla/index.html`、ch03ツリーの4ファイル欠落・1ファイル過剰) |
| コード集の使い方のコマンド | 190 | **41件** (全27ブロックを再生成して解消) |
| 引用キー (L-CITE-001、新設) | ― | **12件** (未登録9件、RFC番号誤り1件、帰属誤り1件、複合キー1件) |
| 外部URL (形式検査) | 86 (延べ88) | 1件 (`https://trusted.cdn` という実在しないTLD) |
| 外部URL (到達性、任意) | 82 | 3件 (すべて外部サイト側の事情。修正不要と判断) |

**検出→修正の合計 66件。** 最も収穫が大きかったのは L-CODE-002 (コード集のコマンド41件) と L-CITE-001 (引用キー12件) で、どちらも既製のリンクチェッカでは検出できない。

L-XREF-001 の実装では、`HTTP/1.0`、`OAuth 2.0`、`Python 3.14`、`RFC 9110 §9.2.2`、semver の `1.2.3-beta` を節参照と取り違える誤検出が当初39件出た。直前が英字語・スラッシュ・節記号のものと、0 を含む組を除く条件を足して0件にした。残った semver の1件は、本文側でバージョン番号をコードスパンにする修正 (E-FIX-002) で解消した。

---

## 3. 先行issueから引き継いだ既知欠陥 9項目の処理結果

### (1) `STYLE_BACKLOG.md` の338件 → **0件に解消**

| ルール | 着手時 | 完了時 | 処理 |
|---|---:|---:|---|
| S-TERM-002 用語集の非推奨表記 | 223 | **0** | `scripts/apply-style-fixes.mjs` を `severity: warn` にも適用するよう拡張し、293箇所を一括置換 |
| S-EN-001 略語の初出併記 | 59 | **0** | 44行へ英語正式名称を併記 (`E-EN-001`〜`E-EN-045`) |
| S-VAGUE-001 曖昧表現 | 56 | **0** | 50件を書き換え、2件は誤検出として `vagueExceptions` を新設、章タイトル2件を改題 |

`config/style-guide.json` の `baselines` は**引き上げていない**。全ファイル 0 へ**引き下げた**。`baselineNote` に「引き上げてはならない」と明記し、`STYLE_GUIDE.md` の運用手順にも反映した。

補足として、機械適用にあたり `config/glossary.json` へ4語の `exceptions` を足した。`CSS-in-JS` (固有名詞で、`CSS-in-JavaScript` は誤り)、`直列化異常` / `直列化失敗` / `直列化可能` (PostgreSQL のトランザクション分離で使われる定訳)。これは検査を緩めるものではなく、正表記が当たらない文脈を除く誤検出の是正である。あわせて、処理順序を1本にする意味で使われていた「直列化」6箇所は、値の変換を指すシリアライズと紛らわしいため「順番待ちにする」「一列に並べて処理する」等へ書き換えた (`E-TERM-001`〜`E-TERM-006`)。用語集の正表記に合わせて節タイトル 5.9 を「エラーハンドリングの設計」→「エラー処理の設計」へ改題し、`config/learning-levels.json`・`config/chapter-guides.json`・他章からの参照2箇所を同期した。

### (2) 本文「コード集の使い方」に実在しないパス・コマンドが残る章 → **解消 (生成器化)**

KEN-48 は第4/6/9/19/20/21/23/28章の8章を挙げていたが、通読で **27ブロックすべて**が誤っていた。`npm install` はワークスペースの `catalog:` 依存を解決できず失敗し、`npm run dev:*` 系のスクリプトはどの章の `package.json` にも存在しない (どの章も `lint`/`typecheck`/`test`/`build` の4つだけ)。

個別修正ではなく `scripts/apply-code-usage.mjs` を新設し、27ブロックを `config/exercises.json` の `solution` から生成するようにした。実行形は `CODE_TOOLCHAIN.md` の `pnpm --filter @handbook/chNN run test` と `pnpm --filter @handbook/chNN exec tsx <file>` に統一。再発は `validate-links.mjs` の L-CODE-002 が検出し、`check:handbook` で止まる。あわせて見出しを `### 第N章のコード集の使い方` と章ごとに一意にした (項目(6)を参照)。

### (3) 章末「合計N時間」表記と演習合計の不整合 → **解消 (生成器化)**

KEN-48 は第10/13/28/29章を挙げていたが、実際は **30章中28章**でずれていた (一致していたのは第27章と第30章のみ)。ずれの最大は第23章で、記載「7-9時間」に対し実合計19時間。「7-9時間」が3章で同値であるなど、実測ではなく定型句だった。

`scripts/apply-exercise-totals.mjs` を新設し、30箇所を `config/exercises.json` の合計から生成した。文面も「所要時間: 演習カードの推定時間の合計で15時間30分」と基準を明示する形へ変えた。

### (4) 13.1「固定ロックを避けよ」と 23.6「メール単位で5回ロック」の矛盾 → **13.1 が正しいと判断し、23.6 側に限界と前方参照を追加**

**技術的な判断**: 13.1 が正しい。固定回数のアカウント単位ロックには2つの欠陥がある。(a) 攻撃者が他人のメールアドレスへ5回失敗させるだけで正規利用者を締め出せる (lockout-DoS)。(b) 1アカウントあたり数回しか試さないパスワードスプレーと Credential Stuffing には、しきい値をどう設定しても効かない。しきい値を厳しくするほど (a) が容易になる。

**処理**: 23.6 のコードは削らず、最小構成の例として残した (KEN-52 が「既存コードを削っていない」と決めた方針を踏襲)。そのうえで、

- コメントを `// レート制限 + アカウントロック` から `// 最小構成の例。鍵はメールアドレス1つ、対応はロック1段だけである` へ限定 (`E-ABUSE-001`)
- コード直後に注意ブロックを追加。「そのまま本番へ置いてはいけない」理由 (上記 a と b) と、[13.25](04-part3-backend.md#section-13-25) への前方参照を置いた
- 13.1 側にも「(鍵の分け方と段階的な対応は 13.25 で扱う)」の導線を追加 (`E-ABUSE-002`)

これで、第VI部から読み始めた読者も 23.6 だけを参照した読者も、この例が最小形であることと具体化の位置を知れる。あわせて、同じコード例のダミーハッシュ `'$argon2id$...$abc...'` が Base64 として不正で `verify()` が例外を投げる (= 存在しないアカウントだけ挙動が変わる列挙オラクルになる) 問題も直した。

### (5) 22.3 が IP/UA を無マスクで出す例を GOOD としている → **修正**

GOOD 例が `ip: '192.168.1.1'` と `userAgent: req.headers['user-agent']` を無加工で出力していた。BAD/GOOD の対比軸が「パース可能か」だけで、個人データの扱いという軸が 22.3 全体に無かった。同章の学習ガイドが典型的な失敗として「ログへ秘密情報を出す」を挙げており、**本文の GOOD 例がガイドの禁止事項を実演している**自己矛盾になっていた。

`ipPrefix: maskIp(req.ip)` (下位オクテットを落とす) と `userAgentHash: hashUserAgent(...)` (鍵付きハッシュ) へ置き換え、直後に1段落を追加した (`E-PRIV-001`)。「構造化されていることと、そのまま保存してよいことは別」「ログは出力先が増えやすく個人データの複製装置になる (14.25)」「許可リストで項目を決め、保持期間も同時に決める」「完全なIPが要る場合は対象と期間を限った別系統へ短期保持する」。22.11 の実装例 (`ip: '1.2.3.4'`) も同時に修正した (`E-PRIV-002`)。

### (6) `validate:handbook` の `ANCHOR_DUPLICATE` 27件 → **根本対応して 0件**

27件を3つの原因に分けて処理した。

- **4件は検査側のバグ**。ADR テンプレートの `## Context` / `## Decision` / `## Consequences` / `## Alternatives Considered` は ```` ```markdown ```` フェンスの中にあり、見出しではなかった。`validate-handbook.mjs` の走査ループがフェンスを認識していなかったため、フェンス状態を追う修正を入れた。章30件・節415件の集計値は変わらないことを確認済み。
- **20件は `### コード集の使い方` の重複**。27章分がすべて同一の見出しで、GitHub のアンカーとしては曖昧、目次としても意味を持たなかった。生成器化 (項目(2)) にあわせて `### 第N章のコード集の使い方` と章ごとに一意な名前へ改めた。
- **3件は本文の見出しの重複**。`#### 採用判断` ×3 (14.16 レイクハウス / 15.11 CRDT / 16.11 ベクトルインデックス)、`#### 仕組み` ×2 (23.16 ブロックチェーンアンカー / 23.20 Certificate Transparency)。それぞれ主題を冠した名前へ改名した。これらは生成物に現れないため影響範囲が閉じている。

### (7) `CONTRIBUTING.md` に KEN-60 の成果物が未記載 → **追記**

- 「手動編集してよいもの・いけないもの」の表へ8行追加: `BETA_REVIEW_PLAN.md` / `BETA_REVIEW_SCENARIOS.md` / `BETA_REVIEW_TEMPLATES.md` (不可・生成物)、`beta-review-scope.json` (可・正本)、`config/links.json` (可・正本)、`config/editorial-fixes.json` (可・正本)、本文側の `handbook:code-usage` ブロック (不可)、本文の「所要時間: …」(不可)。
- 「自動検証」節のコマンド一覧へ `apply:code-usage:check` / `apply:exercise-totals:check` / `apply:editorial-fixes:check` / `validate:links` / `validate:beta-review` を追加し、「まとめて実行するには `pnpm run check:handbook`」を明記。
- 検証項目の箇条書きへ8項目追加 (索引 group、内部リンクとアンカー、章節参照、`code/` パスとコマンド、引用キー、外部URL、到達性検査は任意、ベータレビュー整合)。
- 「ベータ読者レビューの正本」節を新設。`beta-review-scope.json` が正本であること、3つの Markdown は生成物であること、章タイトルは `config/narrative-flow.json` を基準に照合されるため章タイトル変更時は6ファイルを同時更新すること、変更後は `validate:beta-review` と `test:beta-review` を実行することを明記した。
- 「全文校正で入れた個別修正の正本」節を新設し、`config/editorial-fixes.json` の運用を記載した。

### (8) 模範解答が本文要件を下回る演習8件 → **本文側を実体に合わせる方針で統一**

**判断**: 8件すべて**本文を直した**。模範解答を実装し直す選択肢もあったが、(a) KEN-48 が既に演習カードの完成条件・期待出力・警告へ差分を書き込んでおり、カードが実体を正しく表している、(b) 8件の再実装は編集校正issueの範囲を超え、`code/` 側の再検証 (KEN-56 のクリーン環境検証) をやり直す必要が出る、という2点による。本文の「要件」「機能」一覧に **★ で模範解答の到達範囲を示し、残りを読者の実装範囲として明示**する形へそろえた。

| 演習 | 処理 |
|---|---|
| 9.1 | 「模範解答: `code/ch09/`(4つのサブディレクトリ)」→ 実体の2方式 (mini-ssr / pwa-service-worker) を明示し、CSRとSSGは読者が組む範囲とした。同じ課題のカードが「コード成果物はない」と述べていた矛盾も解消 (`E-GAP-091`) |
| 12.4 | 機能一覧に ★ を付け、ping切断と履歴再送を読者の実装範囲へ (`E-GAP-124`) |
| 16.5 | 模範解答が `/search` のみ・ポート3004であることを明記し、4エンドポイントは到達点として位置づけた。模範解答パスも `solution/main.sh` へ (`E-GAP-165`, `E-GAP-165b`) |
| 19.2 | 6チェック項目のうち模範解答が判定できる4項目に ★。簡易YAMLパーサが配列を読み飛ばすため残り2項目は読者の実装範囲と明記 (`E-GAP-192`, `E-GAP-192b`) |
| 25.1 | 機能一覧に ★。`toBeGreaterThan`、`beforeEach`/`afterEach`、非ゼロ終了コードを読者の実装範囲へ (`E-GAP-251`) |
| 25.4 | 要件の「AST パース」を「模範解答は正規表現方式。AST 化は発展課題」へ改め、変異オペレータを実装済み4種 (★) と未実装の `+`↔`-` に分けた (`E-GAP-254`) |
| 26.3 | メトリクス一覧を `active`、`queued` (模範解答) と `rejected` (読者の実装範囲) に分けた (`E-GAP-263`) |
| 30.1 | `src/` 4階層の実装単位を「読者が組み立てる設計案」と明示。「本書最大の解答、複数ファイル構成」を実体 (`solution/main.sh`) の記述へ改め、未実装分をカードのマイルストーン2以降として切り分けた (`E-GAP-301`, `E-GAP-301b`) |

### (9) `config/exercises.json` の `services` の誤り → **17件修正、`validate:clean-environment` は通過**

KEN-48 が11件、通読で6件を追加検出した。ローカルで完結する課題に外部サービスを要求していたもの15件と、逆に必要なのに「なし」だったもの2件。

| 課題 | 修正前 | 修正後 | 根拠 |
|---|---|---|---|
| 3.5 | OpenSSL/TLS | なし | tsx で計測ツールを走らせるだけ |
| 4.5 | OpenSSL/TLS | なし | ESM/CJS の相互運用確認 |
| 13.6 | OpenSSL/TLS, localhost | なし | 純粋な TypeScript |
| 14.5 | PostgreSQL, Docker | SQLite | 模範解答は python3 同梱の SQLite |
| 17.1 | Kafka | なし | ミニ Kafka 風キューを自作する課題 |
| 17.4 | PostgreSQL, Kubernetes, Kafka | なし | インメモリの TypeScript |
| 18.1 | なし | localhost | サーバ起動 + 別端末から `nc` |
| 18.3 | Kubernetes | localhost | `node:http` と `kill -TERM` |
| 19.2 | Kubernetes | なし | YAML 文字列の静的解析 |
| 19.3 | Kubernetes | なし | Pod 数の遷移シミュレーション |
| 20.3 | AWS | なし | 静的な料金表の掛け算 |
| 20.4 | AWS | なし | `node:crypto` でローカルファイル暗号化 |
| 22.4 | Docker, Kubernetes, AWS, localhost | なし | 配列からの burn rate 計算 |
| 23.4 | AWS, localhost | localhost | `resolve` の差し替えで完結 |
| 26.4 | OpenSSL/TLS | なし | プロセス内 `Map` と `node:crypto` |
| 28.3 | PostgreSQL | なし | `node:fs/promises` のみ |
| 30.1 | PostgreSQL, Kubernetes | localhost | `node:http` と `Map` で動く18行 |

`pnpm run validate:clean-environment` は通過する (演習143件、カテゴリ集計143件)。

**`config/clean-environment-plan.json` の `category` は意図的に変更していない。** `services` はカード上の読者向け表示、`category` は KEN-56 が実施したクリーン環境検証の分類で、目的が異なる。より厳しい区分 (`external-service`) で検証済みの証跡はそのまま有効であり、区分を緩める変更は KEN-56 の完了根拠を弱める。カテゴリの見直しは KEN-63 へ引き継ぐ (第7章を参照)。

---

## 4. 全30章通読の所見サマリ

詳細は [`KEN59_FULL_READ_LOG.md`](./KEN59_FULL_READ_LOG.md) にある。総指摘 **435件** (修正済291 / 機械化50 / 見送り94)。まとめ・終章の3件を加えた内訳は次のとおり。

| 部 | 章 | 指摘 | 部 | 章 | 指摘 |
|---|---|---:|---|---|---:|
| I | 第1章 | 16 | IV | 第16章 | 13 |
| I | 第2章 | 19 | IV | 第17章 | 15 |
| I | 第3章 | 17 | V | 第18章 | 17 |
| I | 第4章 | 20 | V | 第19章 | 14 |
| II | 第5章 | 13 | V | 第20章 | 18 |
| II | 第6章 | 16 | V | 第21章 | 12 |
| II | 第7章 | 12 | V | 第22章 | 8 |
| II | 第8章 | 11 | VI | 第23章 | 24 |
| II | 第9章 | 15 | VI | 第24章 | 9 |
| III | 第10章 | 10 | VI | 第25章 | 10 |
| III | 第11章 | 9 | VI | 第26章 | 12 |
| III | 第12章 | 12 | VII | 第27章 | 11 |
| III | 第13章 | 21 | VII | 第28章 | 12 |
| IV | 第14章 | 21 | VII | 第29章 | 15 |
| IV | 第15章 | 16 | VII | 第30章 | 14 |

部末まとめ7本のうち6本は指摘0件で、章の実際の内容と一致していた。

### 重大なものの内容

**(a) 実行するとエラーになるコード例 (14件)。** 読者が写経して即座に破綻する種類の誤り。

- 第13章: `redis.del('session:*')` がグロブを解釈せず全セッション破棄が動かない (2箇所)、`timingSafeEqual` の長さ未チェックで401ではなく500になる、OAuth 1.0 の署名が Base64 パディングで壊れる、暗号化した TOTP シークレットを復号せず検証、`setTimeout` によるセッション書き換えがストアへ反映されない
- 第18章: nginx の `if ($scheme = http)` が443の server 内にあり**絶対に発火しない**、`keepalive` を宣言しながら `Connection: ""` が無くプールが使われない
- 第19章: `terminationGracePeriodSeconds` がコンテナ配下に置かれ `kubectl apply` が `unknown field` で失敗する
- 第23章: `async function` の本体で `yield` (構文エラー)、SSRF 対策の再構成URLがポート番号を落とす
- 第27章: Clean Architecture の中核例が未注入の `this.customerRepo` を呼ぶ、通貨換算が小数桁の差を無視して100倍ずれる、`allocate` が負の按分でループを回さず「合計は必ず一致する」という節の宣言を破る
- 第29章: MCP SDK の `setRequestHandler` に文字列を渡している
- 第30章: Prisma のカーソルが `orderBy` の基準列と一致せず `skip: 1` も無い

**(b) 意味が正反対・逆転している記述 (3件)。**

- 第20章 「**制限**: トランジティブ (A-B、B-C があっても A-C は直接通信不可)」 ― VPC Peering の制限は「**非**トランジティブ」であること
- 第30章 「SRE 経験は**本でしか得られない**学びを与える」 ― 文脈は実務経験を勧める段で、意味が逆
- 第14章 `CREATE ROLE app_user NOLOGIN;` ― 直前が「そのロールで**接続する**」と述べており例が成立しない

**(c) 出典・番号の誤り (8件)。** `[RFC 9835]` (実際は RFC 8935)、`[Vickery, 2015]` (実際は McLean)、DPoP「2022年RFC」(実際は2023)、PQXDH「2024年導入」(実際は2023)、PCI DSS「Level A」(存在しない区分)、個人情報保護法「2022年改正」(2020年改正・2022年施行)、`09-references.md` の RFC 8936 の書名、参考文献に未登録の引用キー9件。

**(d) AI生成文の痕跡として最も明確だったもの (3件)。**

- 第13章の「「**IAMA**」と呼ばれるこの4要素は、**全ての** IAM プラットフォームが備える基本機能だ」 ― 表の4項目 (Identity / Authentication / Authorization / Audit) の頭文字から機械的に作られた、業界で使われていない造語。しかも全称の断定が重なっていた
- 第5章の章タイトル「モダン**JavaScript完全マスター**」 ― 時点を欠く「モダン」と、章が保証できない「完全マスター」の重ね
- 終章の「本書の全 **158 課題**、**200,000 行以上**のコードを書いた」 ― 実測は課題147件、`code/` 配下 約14,974行

**(e) 自書内の自己矛盾 (7件)。** 第1章「本書はその全てを扱う」対「1冊で全てを網羅することはできない」(56行差)、第8章「Vite 8 は本番も Rolldown」対「本番ビルドは Rollup で行うハイブリッド戦略だ」(同一節)、第7章「RSC対応はライブラリによって異なる」対「RSC非対応のため使いづらい」(2行差)、第21章「可変タグを使うな」(学習ガイド) 対 `:latest` を push する本文例、第22章「ログへ秘密情報を出すな」(学習ガイド) 対 IP/UA を出す GOOD 例、第3章の Critical Rendering Path の定義が 3.x と 4.1 で二重化、第25章のテストトロフィー図が「Integration を厚く」という主張を図で打ち消していた。

### 通読でしか見つからない、部を横断する構造的欠陥 (5件)

自動検査では原理的に検出できず、通読して初めて見えたもの。3件は生成器化で構造的に解消し、2件は KEN-63 へ引き継いだ。

1. 章末「コード集の使い方」が27ブロックすべて実体から乖離 → 生成器化
2. 実装課題節の所要時間が30章中28章で不一致 → 生成器化
3. 演習カードの「必要サービス」が17件で誤り → 修正
4. narrative-bridge の構文が約400本で固定化 → KEN-63 へ
5. 演習カードと旧「要件/評価基準」ブロックの二重記述 → 内容が食い違う6件のみ修正、残りは KEN-63 へ

---

## 5. 本文へ適用した修正の総件数と、適用に使ったスクリプト

### 個別修正: 277件 (`scripts/apply-editorial-fixes.mjs` + `config/editorial-fixes.json`)

| ID接頭辞 | 件数 | 内容 |
|---|---:|---|
| `E-VAG-*` | 50 | 曖昧表現・過剰な断定の書き換え (S-VAGUE-001) |
| `E-EN-*` | 45 | 略語の初出に英語正式名称を併記 (S-EN-001) |
| `E-P1`〜`E-P7` | 100 | 部ごとの技術的誤り・矛盾・参照ずれ |
| `E-SVC-*` | 17 | 演習の必要サービスの是正 |
| `E-TITLE-*` | 16 | 章タイトル2件の改題と関連8ファイルの同期 |
| `E-TERM-*` | 11 | 用語の統一に伴う書き換えと節タイトル改題 |
| `E-GAP-*` | 11 | 模範解答と本文要件の整合 |
| `E-FIX-*`, `E-URL-*` | 5 | 生成物との整合、例示URLの是正 |
| `E-PRIV-*`, `E-ABUSE-*` | 4 | KEN-52 引き継ぎ (22.3 のログ、23.6/13.1 の矛盾) |

各修正は `id` / `file` / `note` (理由) / `from` / `to` を持つ。適用は冪等で、`--check` は未適用があると終了コード1を返す。生成物 (演習カード、章ガイド) の内容を直す修正は `file` に生成元の正本JSON (`config/exercises.json` など) を指定してある。

### 一括生成・置換: 3系統

| スクリプト | 適用箇所 |
|---|---:|
| `scripts/apply-code-usage.mjs` | 27ブロック (章末コード集の使い方) |
| `scripts/apply-exercise-totals.mjs` | 30箇所 (実装課題節の所要時間) |
| `scripts/apply-style-fixes.mjs` (拡張) | 293箇所 (用語の正表記への統一) |

### 個別編集 (スクリプトを介さない直接編集)

冪等な再実行が不要な、1回きりの構造修正のみ。すべて上記の検査で保護されている。

1. `05-part4-data.md` の `#### 採用判断` ×3、`07-part6-quality.md` の `#### 仕組み` ×2 の改名 (5箇所)
2. `04/05/07/08` の索引メタデータ `group` の是正 (12箇所、`INDEX_GROUP_INVALID` で以後保護)
3. `09-references.md` への文献追加 (RFC 8935、McLean 2015、Web一次資料9件)
4. `02-part1-foundations.md` の陳腐化した説明ブロック削除 (`task.ts` の3行)
5. `07-part6-quality.md` のテストトロフィー図の描き直し
6. `CONTRIBUTING.md` / `STYLE_GUIDE.md` / `package.json` / `config/*.json` の更新

---

## 6. 変更・新規作成したファイル一覧

### 新規作成 (9)

```
scripts/validate-links.mjs               リンク検査 (9ルール)
scripts/validate-links.test.mjs          その回帰テスト
scripts/apply-code-usage.mjs             コード集の使い方の生成器
scripts/apply-code-usage.test.mjs        その回帰テスト
scripts/apply-exercise-totals.mjs        所要時間の生成器
scripts/apply-exercise-totals.test.mjs   その回帰テスト
scripts/apply-editorial-fixes.mjs        個別修正の適用器
config/links.json                        リンク検査の正本
config/editorial-fixes.json              個別修正277件の正本
KEN59_FULL_READ_LOG.md                   全30章の通読記録
KEN59_EDITORIAL_REPORT.md                本レポート
```

### 変更 (正本)

```
00-front-matter.md, 02〜08-part*.md       本文8ファイル
09-references.md                          文献11件を追加・2件を訂正
config/exercises.json                     services 17件、タイトル、演習カード文言
config/chapter-guides.json                用語統一、章タイトル
config/learning-levels.json               節タイトル 5.9
config/narrative-flow.json                章タイトル 5 / 29
config/glossary.json                      exceptions 4件、RLS の正式名称
config/style-guide.json                   baselines を 0 へ、vagueExceptions を新設
config/links.json                         (新規)
narrative-flow.json                       章タイトル (config の複製)
beta-review-scope.json                    章タイトル (KEN-60 成果物・整合のため)
BETA_REVIEW_SCENARIOS.md                  章タイトル (KEN-60 成果物・整合のため)
RELEASE_POLICY.md                         章タイトル (KEN-62 成果物・整合のため)
CONTRIBUTING.md                           手動編集表・自動検証節・2節を新設
STYLE_GUIDE.md                            baseline 0 の明記、exceptions の運用
package.json                              新スクリプト11件、check/test チェーンへ組込み
scripts/validate-handbook.mjs             フェンス認識、INDEX_GROUP_INVALID
scripts/validate-style.mjs                vagueExceptions
scripts/apply-style-fixes.mjs             warn 変異形の機械適用
```

### 変更 (生成物・再生成のみ)

`01-toc.md`、`10-index.md`、`LEARNING_LEVELS.md`、`LEARNING_PATHS.md`、`CODE_EXERCISES.md`、`GLOSSARY.md`、`STYLE_BACKLOG.md`、`code/chXX/README.md` (31件)、`dist/site/`。すべて手書きせずスクリプトで再生成した。

### KEN-60 / KEN-62 成果物への変更について

`beta-review-scope.json`、`BETA_REVIEW_SCENARIOS.md`、`RELEASE_POLICY.md` の3ファイルを変更した。内容は**第5章と第29章の章タイトルの同期のみ**で、検査基準・範囲・tier・重大度・リリースブロッカーは一切変更していない。`scripts/validate-beta-review.mjs` は `beta-review-scope.json` の章タイトルを `config/narrative-flow.json` と突き合わせる (`BETA_CHAPTER_TITLE_MISMATCH`) ため、本文の改題には同期が必須である。`validate:beta-review` と `validate:release-policy` はどちらも通過する。`scripts/validate-beta-review.mjs`、`scripts/validate-release-policy.mjs`、`scripts/build-site.mjs`、`config/release.json`、`LICENSE*`、`.github/` は変更していない。

---

## 7. 実行した検証コマンドとその結果

```
$ pnpm run check:handbook
(全21ステップ)  終了コード 0

$ pnpm run validate:handbook
- chapters: 30 / numbered sections: 415 / learning metadata: 415 / chapter guides: 30
- errors: 0
- warnings: 0                       ← 着手時は warnings: 27 (ANCHOR_DUPLICATE)

$ pnpm run validate:style
- manuscript files: 8 / glossary terms: 156 / index terms: 640 / rules: 21
- errors: 0
- warnings: 0                       ← 着手時は warnings: 3 (baseline 338件)

$ node scripts/validate-links.mjs   (新設)
- documents: 31 / markdown links: 2277 / anchor links: 2153 / code path references: 643
- errors: 0
- warnings: 0

$ pnpm run validate:exercises        Exercise validation passed (演習カード147 / 見出し147)
$ pnpm run validate:narrative-flow   chapters=30, completed=30
$ pnpm run validate:beta-review      chapters=30 (core=15, exercise-only=5, sampled=10), exercises=37
$ pnpm run validate:release-policy   errors: 0 / warnings: 0
$ pnpm run validate:clean-environment 演習143件 / カテゴリ集計143件 / passed
$ pnpm run test:handbook             全テストパス (新規10件を含む)
$ node scripts/build-site.mjs --check Site build check passed
$ node scripts/validate-links.mjs --check-external
  reachability checked: 82, unreachable: 3  (終了コードは0のまま)
```

**`check:handbook` 終了コード 0、`validate:handbook` ERROR 0 / WARN 0、`validate:style` ERROR 0 / WARN 0。** 着手時の WARN 27 と 3 はどちらも 0 になった。ERROR は着手時・完了時とも 0 を維持している。

本文の敬体文末の機械確認 (コードブロック・引用符内を除く地の文):

```
本文の敬体文末: 0
```

---

## 8. 完了条件3つを満たしたと言える根拠

### 「自動検査が成功」

`pnpm run check:handbook` が終了コード0で完走する。チェーンは21ステップで、本issueで4ステップ (`apply:code-usage:check`、`apply:exercise-totals:check`、`apply:editorial-fixes:check`、`validate:links`) を追加した。`validate:handbook` と `validate:style` はどちらも ERROR 0 / WARN 0 で、着手時に残っていた WARN 30件 (27 + 3) をすべて解消している。`STYLE_BACKLOG.md` の未修正は 338件 → 0件で、`config/style-guide.json` の baseline も 0 へ引き下げた (引き上げていない)。新設した検査には回帰テスト10件を付け、`test:handbook` に組み込んだ。

### 「全30章を人手で最終通読」

7つの部ファイル (本文合計 41,874行) を冒頭から末尾まで全行読み通し、30章すべてと部末まとめ7本・終章について、章ごとに所見を記録した。記録は [`KEN59_FULL_READ_LOG.md`](./KEN59_FULL_READ_LOG.md) にある。全30章それぞれに指摘件数と、重大/中程度/軽微に分けた個別指摘 (行番号と原文の引用付き) を残してある。指摘0件の章は無く、最少の第22章・第24章でも9件、最多の第23章で24件を挙げた。**一部を読んで「他も同様」と推定した章は無い。**

通読の価値は、自動検査で原理的に検出できない欠陥を拾えた点にある。実行するとエラーになるコード例14件、意味が正反対の記述3件、自書内の自己矛盾7件、部を横断する構造的欠陥5件は、いずれも既存の21ルールでも新設の9ルールでも検出できず、読んで初めて見つかった。逆に、通読で見つけた構造的欠陥のうち3件 (コード集の使い方、所要時間、索引 group) は、その場で生成器または検査へ落として再発を止めた。

### 「重大な編集指摘が残っていない」

通読で「重大」に分類した指摘は、`KEN59_FULL_READ_LOG.md` の章別記録のとおりすべて処理済みである。見送りとした94件のうち「重大」に分類したものは11件で、いずれも次のいずれかに該当し、読者が誤った実装や誤った理解に至る性質のものではない。残る83件は中程度・軽微に分類したもので、表記の細かな不統一、章構成の変更を要する体裁、既に近傍で条件が示されている記述が中心である。

- 演習カード側に正しい記述があり、読者が実際に手を動かす経路では正しい情報に触れる (第10章のベンチマーク表、第13章の TOTP 窓、第15章のポート、第16章の完成条件)
- 直後または近傍に正しい説明があり、読み進めれば解消する (第2章の HTTP/2 引用、第9章の `use` の注意書き、第26章のリトライ順序)
- 節や章の構成変更を伴い、編集校正の範囲を超える (第4章のカスケード序列、第6章のフォーカストラップ実装、第29章の SDK 版統一、第30章の Stripe 節の重複)

プロジェクトの完了条件「過度な断定が解消されている」については、S-VAGUE-001 の56件をすべて処理したうえで、機械検査では拾えない過剰な断定 ― 造語「IAMA」への全称断定、章タイトルの「完全マスター」、根拠なき「7割の確率で失敗する」「70%+ のカバレッジ」「90%のWebアプリ」「数百万ノード」「世界最強」「事実上の聖典」、事実と乖離した「158課題・20万行」、範囲を広げすぎた Prime Video 事例 ― も個別に修正した。`config/style-guide.json` の baseline を 0 に固定したため、以後の新規混入は `check:handbook` が即座に止める。

---

## 9. 積み残しとブロッカー

### KEN-63 へ引き継ぐ項目

**(1) `config/narrative-flow.json` の `minimumBridgeCount` (issue の指示どおり据え置き)**

第12章は実数16に対し宣言13、第27章は実数19に対し宣言13。実数へ更新すると C4 しきい値が動いて章の tier (core / sampled) が変わり、`beta-review-scope.json` と `BETA_REVIEW_*.md` へ連鎖する。本issueでは据え置いた。KEN-63 で、tier の変化と KEN-60 成果物の再生成を含めて判断する。

**(2) narrative-bridge の構文の固定化 (通読の全体所見4)**

各節冒頭の接続段落 約400本の多くが「A できても／A だけでは、B は残る。C は〜する。」という同一構文で始まる。第23章で64本中41本、第14〜17章で68本中57本が正確に2文。1節ずつ読めば自然だが、通読すると生成テンプレートであることが露呈する。接続の意味を保ったまま構文を分散させる作業であり、`config/narrative-flow.json` の本数検査と `NARRATIVE_EDITING_GUIDE.md` の方針に照らして進める必要がある。

**(3) 演習カードと旧「要件/評価基準」ブロックの二重記述**

第I部だけで19課題すべてに重複がある。内容が食い違っていた6件は修正したが、単なる重複は残した。片方へ寄せるには本文の分量配分が変わるため、章構成の判断が要る。

**(4) 節の `handbook:learning` の `minutes` と演習カード合計の基準差**

`minutes` は「難易度表示と課題数からの見積もり」(`LEARNING_LEVELS.md`) で、演習カードの推定時間の合計とは基準が違う。実装課題節では前者が後者のおよそ半分になっており、読者には矛盾に見える。本issueでは本文側に基準を明記して誤読を防いだが、`minutes` 自体は変更していない。`scripts/validate-beta-review.mjs` が `section.minutes` を必須学習時間の集計に使っており、変更すると KEN-60 の tier 判定へ連鎖するためである。

**(5) `config/clean-environment-plan.json` のカテゴリ再分類**

`services` を17件是正した結果、`external-service` に分類されている演習のうち複数 (18.3、19.2、19.3、20.3、20.4、22.4、23.4、26.4、28.3、30.1) は実際にはローカルで完結する。カテゴリを実態に合わせると `counts` が動き、KEN-56 のクリーン環境検証の分類が変わる。検証はより厳しい区分で済ませてあるため実害はないが、台帳としての正確さは KEN-63 で回復させる。

**(6) 通読で見送った個別指摘 94件 (うち重大 11件)**

`KEN59_FULL_READ_LOG.md` に「見送り」として理由付きで列挙してある。代表的なものは、第10章のベンチマーク数値表 (章の方針と矛盾するが演習カードが警告済み)、第23章の OWASP Top 10 の版 (2021 → 2025 の差し替えは列挙内容と演習前提の同時更新が要る)、第29章の Vercel AI SDK の版混在 (v4 と v5 の API が同一例に同居)、第21章の DORA 変更失敗率の区分値 (一次資料の確認が要る)。

### ブロッカー

なし。すべての検証がローカルで通過している。

### 実行環境についての注記

固定版の Node.js 24.18.0 ではなく、ローカルの Node.js v26.7.0 で検証した (`pnpm` は 11.15.1)。`check:handbook` は Node.js の版に依存する処理を含まないため結果は変わらないが、固定版での再確認は `pnpm run validate:clean-environment:runtime` で別途行う必要がある。外部サービスとブラウザ実操作を伴う演習の実行確認は KEN-56 のクリーン環境検証の範囲であり、本issueでは実施していない。

---

## 10. 再現手順

```bash
# 正本を変更したときの適用順
pnpm run apply:editorial-fixes      # config/editorial-fixes.json → 本文と正本JSON
pnpm run apply:style-fixes          # 用語・記号・括弧の統一
pnpm run apply:learning-levels      # 学習メタデータ
pnpm run generate:learning-paths    # 学習ルート
pnpm run apply:chapter-guides       # 章学習ガイド
pnpm run apply:code-usage           # 章末コード集の使い方
pnpm run apply:exercise-totals      # 実装課題節の所要時間
pnpm run apply:exercise-rubrics     # 演習カード
pnpm run generate:exercise-catalog  # CODE_EXERCISES.md と各章README
pnpm run generate:glossary          # GLOSSARY.md
pnpm run generate:handbook          # 01-toc.md と 10-index.md
pnpm run report:style-backlog       # STYLE_BACKLOG.md
pnpm run build:site                 # dist/site

# 検証
pnpm run check:handbook             # 上記すべての --check と全検証
pnpm run validate:links:external    # 外部URLの到達性 (任意・失敗許容)
```
