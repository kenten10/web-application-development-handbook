# ベータレビュー フィードバック台帳

KEN-61 のベータレビューで収集した指摘の台帳である。機械可読の正本は [`beta-review-findings.json`](beta-review-findings.json)、書式の定義は [`BETA_REVIEW_TEMPLATES.md`](BETA_REVIEW_TEMPLATES.md) の第8節、重大度の定義は [`BETA_REVIEW_PLAN.md`](BETA_REVIEW_PLAN.md) の第7節にある。

> **この台帳の性質**: 本レビューは実在の人間のベータ読者ではなく、本文を事前に読んでいない独立エージェント13体による代行実施の結果である。詳細と限界は [`reports/KEN61_BETA_REVIEW_RESULT_REPORT.md`](reports/KEN61_BETA_REVIEW_RESULT_REPORT.md) に記す。個人情報方針 (BETA_REVIEW_PLAN.md 第10節) は人間のレビュアーを対象とした規定であり、代行実施では収集対象となる個人情報が存在しないため該当しない。

## 1. 集計

| 項目 | 件数 |
|---|---:|
| 総件数 (重複統合前) | 653 |
| ユニーク件数 | 488 |
| 重複として統合 | 165 |

| 重大度 | ユニーク件数 | KEN-61 の分類 |
|---|---:|---|
| Blocker | 23 | Urgent |
| Major | 130 | High |
| Minor | 301 | next-version |
| Suggestion | 34 | next-version |

| KEN-61 の分類 | ユニーク件数 | 状態 |
|---|---:|---|
| Urgent | 23 | 全件 closed |
| High | 144 | 全件 closed |
| next-version | 321 | deferred |

Urgent と High の合計 167 件はすべて解消した。うち 14 件は、当初 Minor と判定したものを第4節の release blocker 突き合わせで High へ引き上げて解消したものである。

## 2. Urgent (Blocker) 一覧

すべて `closed`。再検証は本文・コード・設定の各検査コマンドと、該当箇所の実行によって行った。

| id | 報告者数 | 箇所 | 節・演習 | 内容 |
|---|---:|---|---|---|
| FB-058 | 4 | `04-part3-backend.md:5893` | 13.20 | 必修節13.20のIdP `/authorize` 実装が、クエリで受け取った `redirect_uri` を事前登録値と照合せずリダイレクト先に使っており、任意URLへ認可コードを送出できる（オープンリダイレクト／コード奪取→アカウント乗っ取り）。 |
| FB-059 | 4 | `04-part3-backend.md:5879` | 13.20 | 13.20 のサンプルIdPは `code_challenge_method` 未指定を素通りさせ、`code_challenge` が無ければ PKCE 検証ごと飛ばすため、クライアントは PKCE をダウングレードできる。 |
| FB-081 | 1 | `05-part4-data.md:5691` | 17.2 | 「読んでから書く」形の冪等コンシューマ例が、本書が14.7で教えた READ COMMITTED では並行実行時に両方通過する。実際に守っているのは一意制約だが本文が触れておらず、残高減算の例なので写すと二重引き落としになる。 |
| FB-154 | 3 | `07-part6-quality.md:491` | 23.11 | 必修節が `preload` 付き HSTS を「レスポンスに付けるべきヘッダ」として無条件に推奨しており、取り消しが事実上不可能である警告は非必修の 23.17 にしかない。30.9 のチェックリストでも `[x]` 済みで再掲されている。 |
| FB-155 | 3 | `07-part6-quality.md:284` | 23.5 | SSRF の「対策」として提示された `safeFetch` がリダイレクトを制御しておらず、`fetch` の既定 `redirect: 'follow'` により 302 一つで内部IP判定を迂回される。本文は DNS rebinding だけを残存リスクに挙げるため、読者は「これで守れた」と誤認する。 |
| FB-200 | 4 | `07-part6-quality.md:5163` | 26.10 | 「同じ Idempotency-Key で何度呼び出されても課金は1回のみ、結果は同じ」と断定しているが、直前のコードは例外時に `redis.del(cacheKey)` でマーカーを消すため、決済がPSP側で成功しつつ応答がタイムアウトした場合に再送で二重課金になる。 |
| FB-225 | 4 | `08-part7-practice.md:4932` | 30.5 | 総合演習のSaaS実装例で `tasks.create` が `input.projectId` の所属組織を検証しておらず、組織Aの正規メンバーが組織BのprojectIdを指定するだけで他組織のプロジェクト配下へ書き込める（クロステナント書き込み）。30.4 が「1つでも漏れると他組織のデータが漏洩する」と明言した規則を、本書のSaaS実装例そのものが破っている。 |
| FB-250 | 1 | `08-part7-practice.md:3569` | 29.3 | RAG の検索クエリに利用者の閲覧権限・テナント・可視範囲による絞り込みが一切なく警告もない。同節が用途に「社内ドキュメント検索(Slack履歴、Wiki、契約書)」「法律・医療・金融のアシスタント」を挙げているため、この実装をそのまま使うと質問者が閲覧権限のない文書の内容をLLM経由で読める。 |
| FB-368 | 2 | `06-part5-infrastructure.md:2453` | 20.8 | `terraform destroy` が警告文なしでコマンド一覧に並んでおり、直前の main.tf が `prod/terraform.tfstate` と `identifier = "myapp-prod"`、`Environment = production` を明示的に指しているため、読者が写経してそのまま実行すると本番 VPC・RDS・セキュリティグループが削除される。 |
| FB-538 | 1 | `code/ch04/event-loop/event-loop.solution.ts:35` | 4.9 | 模範解答がソート前の `timers[0]` を読んで仮想時刻を進めるため、setTimeout(20) → setTimeout(10) の順に登録するとタイマーが1件も発火せず `event loop exceeded maxSteps` で停止し、演習カードの期待出力が再現しない。 |
| FB-539 | 1 | `code/ch09/pwa-service-worker/solution/main.js:34` | 9.10 | 模範解答がナビゲーション失敗時に要求URLのキャッシュを確認せず無条件で offline.html を返すため、オフラインで /index.html を再読み込みするとアプリシェルではなく offline.html が出て、期待出力とテスト方法3が成立しない。 |
| FB-540 | 3 | `code/ch09/solutions.test.ts:7` | 9.10 | 演習カードが自己採点手順として指定するテストが、模範解答のソース文字列に対する単語の grep で、読者の実装も実際の挙動も検証しない。コメントに単語があれば通るため、読者は pass を根拠に自分の実装が正しいと誤認する。 |
| FB-541 | 1 | `code/ch06/web-component-counter/solution/main.html:47` | 6.12 | 属性が無いとき `Number(null) === 0` で `Number.isFinite(0)` が true になりフォールバック値が使われないため、`<my-counter>`（属性なし）は step が 1 ではなく 0 になり、期待出力が模範解答で成立しない。 |
| FB-545 | 4 | `config/clean-environment-plan.json` | 4.5 | `config/clean-environment-plan.json` の `category` / `services` / `requiredEvidence` が演習の実体および `config/exercises.json`・本文カードの「必要サービス」と広範に矛盾しており、要求された証跡を取得する方法が原理的に存在しない演習が多数ある。RB-06 の判定が不能になる。 |
| FB-579 | 1 | `.devcontainer/Dockerfile:3` | 14.27 | 課題14.5 は必須検証演習だが、CLEAN_ENVIRONMENT.md が「最も再現性が高い」と指定する devcontainer に python3 も sqlite3 CLI も入っておらず、前提・模範解答・観察項目・検証方法のすべてが devcontainer で実行不能。回避手順の記載も無い。 |
| FB-582 | 1 | `code/ch14/migration-runner/solution/main.sh:17` | 14.27 | up/down を区切るマーカー文字列 `-- +migrate Down`（D が大文字）が演習カード・章README・サブREADME・starter・ヒントのいずれにも書かれておらず、検証方法1に従って自作の migrations へ模範解答をかけると down セクションの SQL が up の一部として実行され、作成直後のテーブルが黙って DROP される。 |
| FB-598 | 1 | `scripts/validate-exercises.mjs:202` | — | bootstrap が最後に全30章を build して `code/chXX/dist` を生成するが、その後に演習カードの「テスト方法1」を実行すると `ERROR: FORBIDDEN_ARTIFACT: code/chXX/dist` で必ず失敗し、PR-3 の10演習すべての自己採点手順が最初のステップで止まる。回避手順の記載がどこにもない。 |
| FB-599 | 1 | `code/ch18/graceful-shutdown.solution.ts` | 18.12 | 模範解答が `shutdown()` の冒頭で `this.server.close()` を呼ぶが、Node.js 19 以降の `server.close()` は listener を停止しアイドルな keep-alive 接続も切断するため、新規リクエストが 503 を受け取る経路が存在しない。完成条件1・観察項目2・期待出力1 が模範解答で再現できない。 |
| FB-600 | 1 | `code/ch19/dockerfile-optimization/solution/main.sh` | 19.12 | 模範解答が Dockerfile のテキストを2つ書き出すだけで `docker build` を1度も実行せず、アプリのコンテキストも生成しないため、`RUN_DOCKER_BENCH=1` でも `app:naive` / `app:cached` / `app:multi` が作られず、完成条件1・2・4・5 とテスト方法3・4 を模範解答で判定できない。 |
| FB-602 | 1 | `code/ch19/rollout-simulator.solution.ts` | 19.12 | `Math.max(1, canRemove)` と `Math.max(1, capacity …)` により maxSurge / maxUnavailable の上限が無視されるため、期待出力（total 最大13）も観察項目（maxSurge=1.0 で総 Pod 数が20まで増える）も模範解答で再現できない。 |
| FB-628 | 1 | `07-part6-quality.md:3539` | 24.9 | 課題24.5 の完成条件「レイアウトシフトを起こすボタンを押すと CLS の値が増加する」と、同じカードの完成条件「hadRecentInput が true のエントリを除外して CLS を累積する」が両立しない。クリックハンドラ内で同期的に起こしたシフトには Chrome が必ず hadRecentInput:true を付けるため、正しく実装するほど CLS は 0 のままになる。 |
| FB-629 | 1 | `code/ch28/characterization-test.solution.ts` | 28.13 | 模範解答が生成するテストが `assert.throws` の第2引数に文字列を渡しているため Node が `ERR_AMBIGUOUS_ARGUMENT` を投げ、自己採点手順2 のとおり実行すると100件中14件が fail する。章テストは正規表現一致しか見ないため検出できない。 |
| FB-630 | 1 | `code/ch23/rate-limit.solution.ts` | 23.28 | `remaining()` が補充計算をしないため時刻を進めても値が変化せず、期待出力「経過時間に比例して増え capacity で頭打ちになる小数値を返す」を模範解答が再現しない。章テストは `remaining()` を呼ばないため検出できない。 |

## 3. High (Major) の内訳

すべて `closed`。件数の多い順に原因のまとまり (cluster) で示す。個別の指摘は `beta-review-findings.json` を参照する。

| 原因のまとまり | 件数 |
|---|---:|
| `chapter-guide-objective-scope` | 34 |
| `unsafe-recommendation-without-warning` | 9 |
| `missing-primary-source` | 8 |
| `destructive-command-without-warning` | 7 |
| `sample-contradicts-own-principle` | 6 |
| `expected-output-not-reproducible` | 5 |
| `criteria-vs-solution-mismatch` | 5 |
| `missing-production-caveat` | 4 |
| `required-section-depends-on-nonrequired` | 3 |
| `sample-code-defect` | 3 |
| `figure-unreadable` | 2 |
| `learning-route-prerequisite-gap` | 2 |
| `numeric-error-in-text` | 2 |
| `personal-data-handling-inconsistency` | 2 |
| `sample-workflow-does-not-run` | 2 |
| `inaccurate-technical-claim` | 2 |
| `decision-criteria-missing` | 2 |
| `csrf-defense-incomplete` | 2 |
| `prompt-injection-mitigations-incomplete` | 2 |
| `llm-tool-arg-validation-missing` | 2 |
| `llm-cost-leak` | 2 |
| `csp-missing-directives` | 2 |
| `plaintext-secret-in-sample` | 2 |
| `missing-topic` | 2 |
| `llm-sdk-api-outdated` | 2 |
| `starter-stub-empty` | 2 |
| `solution-misses-own-criteria` | 2 |
| `bootstrap-version-gate` | 2 |
| `missing-referenced-content` | 1 |
| `outdated-nodejs-module-interop` | 1 |
| `accessibility-sample-contradiction` | 1 |
| `unsafe-recommendation-without-condition` | 1 |
| `outdated-base-image` | 1 |
| `outdated-security-standard` | 1 |
| `explanation-insufficient` | 1 |
| `required-section-is-empty-shell` | 1 |
| `concurrency-defect-in-sample` | 1 |
| `cross-tenant-write-missing-check` | 1 |
| `japanese-locale-gap` | 1 |
| `checklist-not-usable` | 1 |
| `release-readiness-gap` | 1 |
| `learning-route-onboarding-check` | 1 |
| `xss-in-sample-code` | 1 |
| `idempotency-not-actually-guaranteed` | 1 |
| `learning-level-misclassification` | 1 |
| `session-fixation-missing` | 1 |
| `time-estimate-metadata-mismatch` | 1 |
| `card-requires-solution-file` | 1 |
| `solution-not-reproducing-expected-output` | 1 |
| `starter-inconsistent-with-criteria` | 1 |
| `estimate-vs-actual-over-2x` | 1 |
| `incomplete-exercise-criteria` | 1 |

### 3.1 release blocker 突き合わせで引き上げた指摘

当初 Minor と判定したが、RB-07 (本番環境で実行すると被害が生じる記述が残っている) の停止条件に該当しうると判断し、High へ引き上げて解消した。

| id | 箇所 | 内容 |
|---|---|---|
| FB-165 | `07-part6-quality.md:540` | IPアドレスを原文のまま30日保持する例が無警告で示されており、22.3 が定めた「IPとUAは原文のまま残さない／多くの法域で個人データ」という方針と章をまたいで矛盾する。 |
| FB-196 | `07-part6-quality.md:3209` | 負荷試験の注意はあるが、誤って本番URLへ向けた場合の影響（外部依存への課金、レート制限、共有DBの汚染）に触れておらず、ガイドの「負荷生成側が先に飽和する」に対応する診断方法も本文にない。 |
| FB-291 | `02-part1-foundations.md:1667` | ローカル開発用の自己署名 HTTPS サーバのサンプルが1年・includeSubDomains の HSTS を送出している。証明書エラー中はブラウザが無視するが、直後に本書が勧める mkcert で信頼される証明書に切り替えると本当に記録され、localhost 配下の他プロ |
| FB-372 | `06-part5-infrastructure.md:1276` | 日常の停止コマンドを並べた一覧の中に `docker compose down -v` が混ざっており、「停止 + ボリューム削除」という日本語コメントだけでは、消えるのがこのプロジェクトの Postgres データそのものだと伝わらない。 |
| FB-374 | `06-part5-infrastructure.md:4208` | 必修節の推奨実装が `/metrics` をアプリの公開ポート上に無認証で生やしており、`collectDefaultMetrics` のプロセス情報と内部ルート一覧・エラー分布が外部から読める。同章の課題22.2 の警告はこの脅威を正しく指摘しているのに本文には無い。 |
| FB-389 | `06-part5-infrastructure.md:2481` | Secrets Manager の使い方を説明する節で、パスワードをソースへ直書きした例を示しており、23.9「コードにシークレットを書かない」と正面から矛盾する。写経されればリポジトリに秘密が入る。 |
| FB-390 | `06-part5-infrastructure.md:391` | 本番ホストでのパケットキャプチャの手順に、平文HTTPの Cookie・Authorization ヘッダ・個人データ・決済情報が端末表示され pcap としてディスクに残ることの注意も削除の指示もない。22.3 が「IPとUAは原文のまま残さない」と厳格に書いているのと非対称。 |
| FB-473 | `04-part3-backend.md:6404` | `rejectUnauthorized: false` が行内コメント以外の警告なしに掲載されており、直後の手動検証を落としてコピーすると TLS のピア検証が完全に無効になる。 |
| FB-475 | `05-part4-data.md:1521` | `CREATE ROLE ... PASSWORD '...'` のパスワードリテラルが `pg_stat_activity` とサーバログ（`log_statement = 'ddl'` 以上）へ平文で残ることへの注記が無い。 |
| FB-490 | `04-part3-backend.md:5800` | PKCE クライアント例が `sessionStorage.setItem('pkce_verifier', codeVerifier)` を使うが、XSS で `code_verifier` が読み出せる点の断りが無く、BFF 構成なら verifier をサーバ側に置くという |
| FB-492 | `04-part3-backend.md:7044` | 課題13.1 の完成条件「PBKDF2-HMAC-SHA256 で 100,000 回反復」に、この値が演習の実行時間のために意図的に低く設定されていることの断りが無い（OWASP の現行推奨は 600,000 回）。 |
| FB-515 | `07-part6-quality.md:214` | 推奨 CSP 例に `style-src 'self' 'unsafe-inline';` が含まれるのにその旨の断りが無く、読者はこれを「安全な例」として写す。 |
| FB-593 | `code/ch13/policy-engine.solution.ts:20` | 観察項目が「判定不能時に拒否へ倒れるか」を確かめよと言いながら、参照実装は condition の例外を捕捉せず呼び出し元まで抜けるため倒れない。カードの「本番利用時の警告」3件にもこの点の記載が無い。 |
| FB-625 | `06-part5-infrastructure.md` | `pkill -f` はコマンドライン全体のパターン一致で、`mini-init` を含む無関係なプロセス（エディタの検索プロセス等）を巻き込みうる。 |

## 4. next-version の扱い

321 件を次版候補として `deferred` にした。内訳の上位は次のとおり。

| 原因のまとまり | 件数 |
|---|---:|
| `missing-primary-source` | 39 |
| `explanation-insufficient` | 21 |
| `missing-production-caveat` | 19 |
| `incomplete-exercise-criteria` | 17 |
| `sample-code-defect` | 15 |
| `undefined-term-in-required-section` | 13 |
| `required-section-depends-on-nonrequired` | 10 |
| `missing-topic` | 10 |
| `overconfident-assertion` | 9 |
| `sample-contradicts-own-principle` | 9 |
| `decision-criteria-missing` | 9 |
| `index-metadata-misplaced` | 9 |
| `expected-output-not-reproducible` | 9 |
| `undefined-identifier-in-sample-code` | 8 |
| `inaccurate-technical-claim` | 8 |

### 4.1 release blocker への該当確認

次版候補が正式版の公開を妨げないことを、RB-01 から RB-11 の停止条件と1件ずつ突き合わせて確認した。

| ID | 停止条件 | 関連する次版候補 | 判定 | 根拠 |
|---|---|---:|---|---|
| RB-01 | 未解消のBlocker/Major指摘が残っている | 0 | **解消 (成立しない)** | 停止条件は「severity が Blocker または Major かつ status が closed/waived でない項目が1件以上」である。次版候補はすべて Minor または Suggestion であり、定義上この条件の対象にならない。Urgent/High は全件 closed。 |
| RB-02 | 必須検証章の通読記録が欠けている | 0 | **解消 (成立しない)** | 必須検証章15章すべてについて通読記録シートがある (第5節)。次版候補に通読記録の欠落を指摘するものは無い。 |
| RB-03 | 必須検証演習が未実施または失敗のまま残っている | 0 | **解消 (成立しない)** | 必須検証演習37件すべてを実施し、失敗0件。部分成功だったものは原因の指摘を Urgent/High として解消済みである。 |
| RB-04 | 原稿整合性検証が失敗する | 23 | **解消 (成立しない)** | 停止条件は `pnpm run check:handbook` の非ゼロ終了である。終了コードは0。該当する次版候補は索引メタデータの節ずれ、コードフェンスの言語タグ、表記の重複といった、いずれも検査が失敗しない範囲の指摘である。 |
| RB-05 | 演習定義または模範解答の検証が失敗する | 40 | **解消 (成立しない)** | 停止条件は `pnpm run validate:exercises` の非ゼロ終了、または未完成 solution の検出である。検証は成功し、未完成 solution は0件。該当する次版候補は期待出力の環境差 (OpenSSL の版による文言差、GPU の有無による計測差など) に関する注記の不足であり、検証の失敗ではない。 |
| RB-06 | ブラウザ手動・外部サービス演習の証跡が自動テストで代替されている | 6 | **解消 (成立しない)** | 停止条件は「requiredEvidence を満たす記録がなく、ローカル自動テストの成功だけで完了扱いにしている」ことである。演習実施者は取得できなかった証跡を「取得できなかった」として記録し、自動テストの成功で代替していない。証跡の定義そのものが取得不能だった問題は Urgent (FB-545) として解消した。該当する次版候補は「章の自動テストの中身が章ごとに違う」など証跡定義の粒度に関する指摘である。 |
| RB-07 | 本番環境で実行すると被害が生じる記述が残っている | 0 | **解消 (成立しない)** | 専門領域レビュアーが挙げた危険な記述はすべて解消した。判断に幅のある14件は第3.1節のとおり High へ引き上げて解消し、次版候補には残していない。 |
| RB-08 | 推定所要時間が実測から大きく乖離している | 0 | **解消 (成立しない)** | 停止条件は「実測が推定の2倍を超える章が3章以上」である。通読者4名の算出では、30章すべてで算出値が推定値を下回った (0.20〜0.86倍)。該当章は0章。演習単位で2倍を超えた4件は個別に解消した (第6節)。 |
| RB-09 | クリーン環境の初期構築が新規環境で完走しない | 3 | **解消 (成立しない)** | 停止条件は `bash scripts/bootstrap-clean-environment.sh` が固定環境で完走しないことである。Node.js 24.18.0 の環境で警告0件で完走した。該当する次版候補のうち、bootstrap がリポジトリへ書き込むこと、静的配信ツールの前提が未記載だった2件は先行して解消し、残りは Dev Container CLI の導入手順など補足の充実である。 |
| RB-10 | 公開・利用条件が未確定である | 0 | **解消 (成立しない)** | ライセンス、版番号、CHANGELOG、正誤報告先はいずれも公開済みで、`pnpm run validate:release-policy` が成功する。該当する指摘は0件。 |
| RB-11 | 個人情報方針に反する収集または保存が発生した | 0 | **解消 (成立しない)** | 本レビューは独立エージェントによる代行実施であり、匿名IDを含めて個人を識別する情報を一切収集していない。したがって停止条件が成立しない。本文中の個人データの扱いに関する指摘 (IPアドレスの保持など) は本書の記述の問題であって、レビューの収集行為の問題ではない。判断に幅のある3件は High へ引き上げて解消した。 |

いずれの停止条件も成立しない。次版候補321件は正式版v1.0の公開を妨げない。

## 5. 記録の所在

| 記録 | 所在 |
|---|---|
| 各レビュアーの記録シート (通読・演習・技術校閲) | 実施レポート `reports/KEN61_BETA_REVIEW_RESULT_REPORT.md` の第3節に要旨、原本は作業環境のスクラッチ領域 |
| 指摘の機械可読な台帳 | `beta-review-findings.json` |
| 修正の正本 | `config/editorial-fixes.json` (KEN-61 の項目は `issue` が `KEN-61`) |

## 6. 見送った理由の記録

next-version としたものは、次のいずれかに当たる。いずれも読者が本書の記述どおりに実行して被害を受けることはなく、学習目標の達成も妨げない。

- **一次資料の追加** (39件): 主張は正しいが出典が無い、または出典が粗い。読者は本文の説明だけでも学習を進められる。
- **説明の厚みの不足** (21件): 記述は正しいが、例や図を足すと理解が速くなる。
- **教育用簡略化の断り書き** (19件): 本番との差分の記載を足すとより丁寧になるが、危険な操作を誘発するものは Urgent/High として解消済みである。
- **演習の完成条件の粒度** (17件): 自己採点は可能だが、判定基準をさらに細かくできる。
- **索引メタデータの節ずれ** (9件): 索引から意図と違う節へ飛ぶ。目次・本文・リンクの検査はいずれも成功する。
- **その他の表記・体裁** (残り): 表記ゆれ、図表の説明、用語の初出位置など。

これらは正誤表 ([`ERRATA.md`](ERRATA.md)) と v1.1 以降のバックログで追跡する。
