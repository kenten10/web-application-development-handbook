# KEN-61 ベータ読者による通読・演習検証 実施レポート

- 対象: Linear issue KEN-61「ベータ読者による通読・演習検証を実施する」(親 KEN-35、入力 KEN-60、後続 KEN-63)
- 実施日: 2026年8月30日
- 対象成果物: 全7部・30章 (本文415節、演習137件)、コード教材 `code/ch01`〜`code/ch30`
- 計画の正本: [`BETA_REVIEW_PLAN.md`](../BETA_REVIEW_PLAN.md) / [`BETA_REVIEW_SCENARIOS.md`](../BETA_REVIEW_SCENARIOS.md) / [`BETA_REVIEW_TEMPLATES.md`](../BETA_REVIEW_TEMPLATES.md) / `beta-review-scope.json`
- 指摘の台帳: [`BETA_REVIEW_FINDINGS.md`](../BETA_REVIEW_FINDINGS.md) / `beta-review-findings.json`

## 1. 代行実施であることの明記と、その限界

**本レビューは、実在の人間のベータ読者によるものではない。** 本文を一度も読んでいない独立エージェント13体を役割ごとに立ち上げ、ベータ読者の代行として実施した。利用者の承認を得たうえでの代行実施である。

代行によって得られたものと、得られなかったものを分けて記す。

### 代行できたこと

- 本文を初見で読み、理解できない箇所・前提知識の飛躍・説明不足を行番号付きで特定すること
- starter から実際に実装し、模範解答と突き合わせ、期待出力の再現性を実測で確かめること
- 一次資料 (RFC、W3C/WHATWG仕様、OWASP、NIST、各製品の公式ドキュメント) を実際に取得して記述と照合すること
- 実 Chrome、実 PostgreSQL、実 Redis、実 Docker への接続を伴う検証

### 代行できなかったこと

- **実利用の文脈**: 自分の業務システムに当てはめたときに何が足りないか、という判断
- **学習動機と離脱**: 難しさに直面したときに読み進める気力が続くか、どこで諦めるか
- **支援技術の実使用**: スクリーンリーダーやキーボード操作での実際の読了体験。アクセシビリティの指摘は記述の検査にとどまる
- **長期的な定着**: 数週間後に内容を思い出せるか、業務で使えるか
- **所要時間の実測**: 人間が実際に費やす時間。本レビューの所要時間はすべて、実測した分量 (文字数、コード行数、実装した行数、試行回数) からの**換算値**である。個人差、既知技術の有無、集中の途切れは反映されていない

これらは人間のベータ読者でなければ得られない。正式版の公開後も、[`ERRATA.md`](../ERRATA.md) と GitHub の正誤報告経路で実読者からの指摘を受け付ける必要がある。

### 個人情報方針の扱い

[`BETA_REVIEW_PLAN.md`](../BETA_REVIEW_PLAN.md) 第10節の個人情報方針は、人間のレビュアーを対象とした規定である。代行実施では収集対象となる個人情報が存在せず、匿名IDと実名の対応表も発生しない。したがって同節および release blocker RB-11 は**該当しない**。同意文面の提示も行っていない。レビュアーの匿名ID (`BR-READ-01` など) は、記録シートの書式を計画どおりに保つための識別子として用いた。

## 2. 起動したサブエージェントの構成

計画の目標人数 (13名) と同数の13体を、役割ごとに独立したエージェントとして起動した。各エージェントには本文の事前知識がなく、[`BETA_REVIEW_TEMPLATES.md`](../BETA_REVIEW_TEMPLATES.md) の該当設問と記録シート書式を渡して、その書式で回答させた。本文ファイルの編集は禁止し、読み取りと演習コードの実行だけを許可した。修正はすべてレビュー管理者側 (本作業) で一元的に行った。

| 役割 | 体数 | 匿名ID | ペルソナ | 担当範囲 |
|---|---:|---|---|---|
| RL-READ 通読者 | 4 | BR-READ-01〜04 | PS-GENERALIST 2 / PS-FRONTEND 1 / PS-TECHLEAD 1 | 標準通読ルートの必修199節を分割 (第1〜8章 / 第9〜17章 / 第18〜24章 / 第25〜30章) |
| RL-EXEC 演習実施者 | 4 | BR-EXEC-01〜04 | PS-FRONTEND / PS-BACKEND / PS-INFRA / PS-SECURITY | 必須検証演習37件を4トラックへ分割 (PR-1 12件 / PR-2 7件 / PR-3 10件 / PR-4 8件) |
| RL-SPEC 専門領域レビュアー | 5 | BR-SPEC-01〜05 | 5領域 | SP-FE 11章 / SP-BE 15章 / SP-INF 12章 / SP-SEC 15章 / SP-TL 15章+第29章+第27章 |

計画の最低成立人数 (RL-READ 2、RL-EXEC 2、RL-SPEC 3) をすべて上回っている。

指摘件数の内訳は次のとおりで、13体すべてが実際に指摘を提出している。

| 匿名ID | 指摘数 | 匿名ID | 指摘数 | 匿名ID | 指摘数 |
|---|---:|---|---:|---|---:|
| BR-READ-01 | 57 | BR-EXEC-01 | 40 | BR-SPEC-01 (FE) | 67 |
| BR-READ-02 | 66 | BR-EXEC-02 | 24 | BR-SPEC-02 (BE) | 57 |
| BR-READ-03 | 76 | BR-EXEC-03 | 35 | BR-SPEC-03 (INF) | 47 |
| BR-READ-04 | 66 | BR-EXEC-04 | 32 | BR-SPEC-04 (SEC) | 67 |
| | | | | BR-SPEC-05 (TL) | 122 |

## 3. 3観点それぞれの結果

### 3.1 通読 (RL-READ)

| 項目 | 結果 |
|---|---|
| 実施章数 | **30章** (必須検証章15、演習必須章5、抽出通読章10) |
| 実施節数 | **必修199節すべて** |
| 記録シート | 必須検証章15章すべてに通読記録シート (QS-READER-01〜08) |
| 通読全体サマリ | 4枚 (QS-READER-09〜14) |
| 回答した設問 | QS-COMMON 5問 + QS-READER 14問 = **19問**、4体すべてが全問回答 |
| 途中参加チェック (SC-READ-02) | `frontend` と `tech-lead` の2ルートを検証 |

必須検証章15章 (第1・2・3・4・5・13・14・17・19・20・22・23・26・28・30章) はすべて記録シートが存在する。RB-02 の判定材料として欠落は無い。

主な所見は、章の学習ガイドが掲げる到達目標が、標準通読ルート (必修節のみ) では構造上達成できない章が多いこと (13章で報告、合計60件) であった。第4節の systematic fix で解消している。

### 3.2 演習 (RL-EXEC)

| 項目 | 結果 |
|---|---|
| 実施演習数 | **37件 / 37件** (未実施0件) |
| 結果の内訳 | 成功 25件、部分成功 12件、失敗 0件 |
| 記録シート | 演習37件すべてに演習記録シート、環境構築記録シート4枚 |
| 回答した設問 | QS-COMMON 5問 + QS-PRACTITIONER 16問 = **21問**、4体すべてが全問回答 |

部分成功12件はいずれも「自分の実装は完成条件を満たしたが、模範解答または本文と食い違った」もので、原因はすべて Urgent または High として起票し解消した。

実環境での検証は次のとおり実施した。ローカル自動テストの成功だけで完了扱いにした演習は無い。

- 実 Chrome 152 を `--headless=new` + Chrome DevTools Protocol で駆動し、クリック、キー入力、Shadow DOM 参照、Layout/Paint 計数、Service Worker のオフライン検証を実施 (ブラウザ手動6件)
- 実 PostgreSQL 18.6 コンテナへ接続し、psql 2セッションでのトランザクション分離実験、`EXPLAIN (ANALYZE, BUFFERS)` を実施
- 実 Redis 8.10.1 へ接続し、生の RESP バイト列を比較
- 実 Docker 29.7.2 で3つのイメージを実際に build し、サイズと再ビルド時間を計測
- localhost TLS 接続ログと証明書検証境界を取得

取得できなかった証跡は、DevTools GUI パネルの画面表示そのものと、`chrome://history` の実訪問履歴 (レビュアー個人の閲覧履歴に当たるため収集しない判断) である。いずれも該当箇所へ「取得できなかった」と明記した。

### 3.3 専門校閲 (RL-SPEC)

| 項目 | 結果 |
|---|---|
| 精読章数 | SP-FE 11章 / SP-BE 15章 / SP-INF 12章 (+参考2章) / SP-SEC 15章 / SP-TL 17章 |
| 技術校閲シート | 5領域すべて (QS-SPECIALIST-01〜10) |
| 回答した設問 | QS-COMMON 5問 + QS-SPECIALIST 10問 = **15問**、5体すべてが全問回答 |
| 実際に照合した一次資料 | 5領域合計 **97件** (FE 23 / BE 16 / INF 14 / SEC 15 / TL 29) |

RFC 6749、RFC 7636、RFC 9110、RFC 9700、NIST SP 800-63B、OWASP Top 10:2025、OWASP の各 Cheat Sheet、WHATWG Fetch/DOM、W3C CSP3、PostgreSQL 公式ドキュメント、Google SRE Workbook、Stripe API リファレンス、Kubernetes / Docker / Terraform / Prometheus の各公式ドキュメントなどを実際に取得して照合した。

**設問カバレッジの合計**: QS-COMMON 5 + QS-READER 14 + QS-PRACTITIONER 16 + QS-SPECIALIST 10 = **45問すべてに回答**。`beta-review-scope.json` の `totals.questions` と一致する。

## 4. 収集したフィードバックと分類

| 項目 | 件数 |
|---|---:|
| 総件数 (重複統合前) | **653** |
| ユニーク件数 | **488** |
| 重複として統合 | 165 |

| KEN-61 の分類 | 重大度 | ユニーク件数 | 状態 |
|---|---|---:|---|
| **Urgent** | Blocker | **23** | 全件 closed |
| **High** | Major | **144** | 全件 closed |
| **次版候補** | Minor / Suggestion | **321** | deferred |

分類は [`BETA_REVIEW_PLAN.md`](../BETA_REVIEW_PLAN.md) 第7節のマッピング (Blocker→Urgent、Major→High、Minor/Suggestion→次版候補) に従った。High 144件のうち14件は、当初 Minor と判定したものを第6節の release blocker 突き合わせで引き上げたものである (内訳は第5.2節)。

## 5. Urgent / High の解消結果

### 5.1 Urgent (Blocker) 23件

すべて解消した。「報告」列は独立に同じ箇所を指摘したレビュアーの数である。

| # | id | 報告 | 箇所 | 内容と解消 |
|---:|---|---:|---|---|
| 1 | FB-058 | 4 | 13.20 `04-part3-backend.md` | IdP の `/authorize` が `redirect_uri` を事前登録値と照合せずリダイレクトし、認可コードを任意URLへ送出できた。→ クライアント登録との完全一致照合を追加し、不一致時は照合前にリダイレクトせず400を返す形へ修正 |
| 2 | FB-059 | 4 | 13.20 `04-part3-backend.md` | `code_challenge` を送らなければ PKCE 検証ごと飛ばせた (ダウングレード)。→ `/authorize` で S256 の明示を必須にし、`/token` の検証から条件分岐を削除 |
| 3 | FB-081 | 1 | 17.2 `05-part4-data.md` | 冪等コンシューマ例が「確認してから書く」形で、READ COMMITTED では並行時に両方通過し二重引き落としになった。→ 「先に記録し、一意制約違反を処理済みとして扱う」形へ書き換え、分離レベルとの関係を本文に追加 |
| 4 | FB-154 | 3 | 23.11 `07-part6-quality.md` | 必修節が撤回困難な HSTS `preload` を無警告で推奨。→ 例から `preload` を外し、取り消しの難しさと段階的な導入手順を必修節へ記載。30.9 のチェックリストも修正 |
| 5 | FB-155 | 3 | 23.5 `07-part6-quality.md` | SSRF「対策」が `redirect: 'follow'` のままで、302 一つで内部IP判定を迂回できた。→ `redirect: 'manual'` と再検査つきの追跡へ書き換え、TLS と `Host` ヘッダに関する限界を明記 |
| 6 | FB-200 | 4 | 26.10 `07-part6-quality.md` | 例外時に冪等マーカーを消すため、決済成立後のタイムアウトで二重課金になるのに「保証される」と断定していた。→ 適用済みか判定できるときだけ消す形へ修正し、断定を条件つきの記述へ変更 |
| 7 | FB-225 | 4 | 30.5 `08-part7-practice.md` | `tasks.create` が `projectId` の所属組織を検証せず、クロステナント書き込みが成立した。→ 書き込み前に組織所属を確認する処理を追加 |
| 8 | FB-250 | 1 | 29.3 `08-part7-practice.md` | RAG の検索に権限フィルタが無く、社内文書用途で閲覧権限外の内容が読めた。→ 組織とACLでの絞り込みを追加し、権限を埋め込み時点から保存する必要性を本文へ追加 |
| 9 | FB-368 | 2 | 20.8 `06-part5-infrastructure.md` | 本番を指す main.tf の直後に `terraform destroy` が無警告で並んでいた。→ コマンド一覧から外し、消える対象と復旧不能性、安全な試し方を記載 |
| 10 | FB-538 | 1 | `code/ch04/event-loop/event-loop.solution.ts` | 並べ替え前のタイマーを読んで仮想時刻を進め、`setTimeout(20)→(10)` の順で1件も発火しなかった。→ 時刻を進める前に並べ替え、期限超過分をすべて取り出す形へ修正 (実行して期待出力の再現を確認) |
| 11 | FB-539 | 1 | `code/ch09/pwa-service-worker/solution/main.js` | オフライン時に要求URLのキャッシュを見ず無条件で offline.html を返していた。→ 要求URL → アプリシェル → offline.html の順に落とす形へ修正 |
| 12 | FB-540 | 3 | `code/ch09/solutions.test.ts` | 自己採点テストが模範解答ソースの単語 grep で、挙動を検証していなかった。→ Cache Storage と fetch を差し替えて実際にイベントを発火させる挙動テスト6件へ置き換え |
| 13 | FB-541 | 1 | `code/ch06/web-component-counter/solution/main.html` | `Number(null) === 0` でフォールバックが効かず、属性なしの要素で step が0になった。→ 属性の有無を先に判定する形へ修正 |
| 14 | FB-545 | 4 | `config/clean-environment-plan.json` | 17件の演習で `services` が実体と食い違い、接続しないサービスの「実サービス接続ログ」を要求していたため RB-06 の判定が原理的に不能だった。→ `services` を `config/exercises.json` へ合わせ、`requiredEvidence` を演習が実際に生む証跡へ差し替え。自動テスト以外の証跡を必ず1件以上求める点は維持 |
| 15 | FB-579 | 1 | `.devcontainer/Dockerfile` | 課題14.5 が要求する python3 と sqlite3 が devcontainer に無かった。→ 両方を追加 |
| 16 | FB-582 | 1 | `code/ch14/migration-runner/` | 未文書のマーカー `-- +migrate Down` の不一致で、検証手順どおりに実行すると作成直後のテーブルが黙って DROP された。→ マーカーの形式を演習カードのヒントと前提へ明記し、starter のコメントも修正 |
| 17 | FB-598 | 1 | `scripts/validate-exercises.mjs` | bootstrap が全章を build して `dist/` を残すため、その後の自己採点手順が `FORBIDDEN_ARTIFACT` で必ず失敗した。→ `scripts/clean-build-artifacts.mjs` を追加して bootstrap の最後に実行し、`check:handbook` へ検査を追加 (失敗の再現と解消を実測で確認) |
| 18 | FB-599 | 1 | `code/ch18/graceful-shutdown.solution.ts` | 停止処理の冒頭で `server.close()` を呼ぶため、Node.js 19以降では新規要求が503ではなく接続拒否になった。→ 「停止フラグ→排出→close」の順へ修正 (503 と `connection: close` の返却を実測で確認) |
| 19 | FB-600 | 1 | `code/ch19/dockerfile-optimization/solution/main.sh` | `docker build` を一度も実行せず、完成条件4項目とテスト方法2件を判定できなかった。→ 計測用アプリと3つの Dockerfile を生成し、実際に build してサイズと再ビルド時間を出す実装へ書き換え (実 Docker で3イメージの生成を確認) |
| 20 | FB-602 | 1 | `code/ch19/rollout-simulator.solution.ts` | 上限が無視され、期待出力 (total 最大13) も観察項目 (Blue-Green で20) も再現しなかった。→ surge と unavailable の制約を正しく適用し、記録をサージの頂点で取る形へ修正。進行不能の検知も追加 (5つの主張すべての再現を確認) |
| 21 | FB-628 | 1 | 課題24.5 | 完成条件どうしが両立せず、正しく実装するほど CLS が0のままになった。→ 模範解答のシフトを入力の帰属窓の外へ移し、カードの文言を実挙動へ合わせた (実 Chrome で CLS が 0 → 0.0192 へ増えることを確認) |
| 22 | FB-629 | 1 | `code/ch28/characterization-test.solution.ts` | 生成テストが `assert.throws` へ文字列を渡し `ERR_AMBIGUOUS_ARGUMENT` で100件中14件失敗した。→ 述語関数を渡す形へ修正 (100件生成して100件passを実測) |
| 23 | FB-630 | 1 | `code/ch23/rate-limit.solution.ts` | `remaining()` が補充計算をせず、期待出力を再現しなかった。→ 補充を消費と残量照会の両方から呼ぶ形へ修正 (0/2.5/5/10 の期待値一致を実測)。回帰テストも追加 |

### 5.2 High (Major) 144件

すべて解消した。原因のまとまりごとに示す。個別の指摘は `beta-review-findings.json` を参照する。

| 原因のまとまり | 件数 | 解消の方法 |
|---|---:|---|
| 章ガイドの到達目標が必修範囲を超える | 60 | `scripts/apply-chapter-guides.mjs` を改修し、中核概念・前提知識の節リンクへ学習レベル (実務選択/発展/展望) を自動付記。到達目標の直下に「標準通読ルートで到達できる範囲の見分け方」を全30章へ挿入 |
| 一次資料が `09-references.md` に無い | 13 | RFC 9700、RFC 8725、NIST SP 800-63B、OWASP Top 10:2025 と各 Cheat Sheet、W3C CSP3、WHATWG DOM/Fetch、CSS Cascade 5、SRE Workbook、PostgreSQL、Prometheus、OpenTelemetry、Docker、Terraform、Kubernetes、cgroups(7)、Node.js Releases、Stripe など計32件を追加 |
| 危険な操作に警告が無い | 14 | Chaos Mesh の本番 namespace、`docker system prune -a`、RDS 昇格のデータ損失、Pulumi の秘密直書き、`rejectUnauthorized: false`、`CREATE ROLE ... PASSWORD` の平文、本番でのパケットキャプチャ、開発サーバの HSTS、`docker compose down -v`、無認証の `/metrics`、`pkill -f` などへ警告と代替手順を追加 |
| 実装例が自章の原則に反する | 13 | 4.3 の `innerHTML` 補間 (XSS)、7.7 の label 欠落、13.10 の認可規則の評価順、26.10 の lost update、27.3 の通貨固定、30.5 の日付型、23.14 の Merkle ドメイン分離などを修正 |
| 模範解答が期待出力を再現しない | 9 | ch02 ベンチマークのウォームアップ、ch04 の `will-change`、ch09 の `skipWaiting`、ch19 のマニフェスト検証ルール、ch20 のコスト見積り、ch13 のポリシーエンジンの fail-open を修正 |
| 記述が古い | 8 | OWASP Top 10 の版、Node 20 のベースイメージ、`require(esm)`、AI SDK 5 のAPI、OpenAI Structured Outputs の現行形、`server.close()` の挙動、module syntax detection、TLS 1.3 の NewSessionTicket |
| 完成条件と模範解答の食い違い | 8 | 20.4 の `set` 署名、4.2 の評価基準、17.1 の push/pull、30.1 の API 設計と自己採点手順、19.2 の★印、1.4 と 3.3 と 4.1 の「模範解答を先に開く」指示 |
| 必修節が必修外に依存 | 5 | 6.4 の Hooks、19.1 の namespace/cgroups、27.1 の Bounded Context に自己完結する説明を追加。学習ルートの途中参加チェックへ 11.1 を追加、tech-lead の開始位置を明示 |
| 数値の誤り | 4 | 22.9 のバーンレート (14倍=1日→約2日)、24.6 の計算量 (100万→約5000万)、20.3 の見積り出力、19.1 のイメージサイズ |
| 節の内容が薄い | 3 | 18.5 に層ごとの責務と切り分け表、21.4 に4方式の比較表と選択軸、26.14 に規模表の多軸化と4つの確認項目を追加 |
| 推定時間が実測と乖離 | 4 | 第7節に記載 |
| starter が空の雛形 | 2 | `scripts/apply-starter-contracts.mjs` を追加し、必須検証演習23件の starter へ模範解答から抽出した公開APIの契約を自動付記。4.1 と 9.2 は計測用ページとアプリシェルを starter へ用意 |
| その他 (図の読解不能、CI例が動かない、チェックリストが使えない等) | 14 | 14.8 の MVCC 図、11.6 の Chain 図、21.2 のワークフロー (OIDC権限、Action固定)、30.9 のチェックリスト、30.2 の技術選定根拠、30.12 の Must、29章のコスト・プロンプトインジェクション・ツール引数検証など |

### 5.3 release blocker 突き合わせで引き上げた14件

第6節の RB-07 突き合わせで、当初 Minor と判定したものが「危険な記述に警告が無い」に該当しうると判断し、High へ引き上げて解消した。

FB-165 (生IPの30日保持)、FB-196 (本番URLへの負荷試験)、FB-291 (開発サーバのHSTS)、FB-372 (`docker compose down -v`)、FB-374 (無認証の `/metrics`)、FB-389 (Pulumi の秘密直書き)、FB-390 (本番でのパケットキャプチャ)、FB-473 (`rejectUnauthorized: false`)、FB-475 (`CREATE ROLE ... PASSWORD` の平文)、FB-490 (`sessionStorage` の code_verifier)、FB-492 (PBKDF2 の反復数)、FB-515 (CSP の `unsafe-inline`)、FB-593 (認可エンジンの fail-open)、FB-625 (`pkill -f`)。

## 6. 次版候補が正式版の公開を妨げないことの確認

次版候補321件を、RB-01 から RB-11 の停止条件と1件ずつ突き合わせた。**いずれの停止条件も成立しない。**判定の根拠は [`BETA_REVIEW_FINDINGS.md`](../BETA_REVIEW_FINDINGS.md) 第4.1節に表として記録した。要点は次のとおり。

| ID | 判定 | 根拠 |
|---|---|---|
| RB-01 | 成立しない | 停止条件は Blocker/Major が未クローズであること。次版候補はすべて Minor または Suggestion で、定義上この条件の対象外。Urgent/High は全件 closed |
| RB-02 | 成立しない | 必須検証章15章すべてに通読記録シートがある |
| RB-03 | 成立しない | 必須検証演習37件すべてを実施、失敗0件 |
| RB-04 | 成立しない | 停止条件は `check:handbook` の非ゼロ終了。終了コード0。関連する23件は索引メタデータの節ずれなど、検査が失敗しない範囲 |
| RB-05 | 成立しない | 停止条件は `validate:exercises` の非ゼロ終了または未完成solution。検証成功、未完成solution 0件。関連する40件は期待出力の環境差に関する注記の不足 |
| RB-06 | 成立しない | 演習実施者は取得できなかった証跡を「取得できなかった」と記録しており、自動テストの成功で代替していない。証跡定義が取得不能だった問題は FB-545 として解消済み |
| RB-07 | 成立しない | 危険な記述はすべて解消。判断に幅のある14件は第5.3節のとおり引き上げて解消し、次版候補に残していない |
| RB-08 | 成立しない | 停止条件は「実測が推定の2倍を超える章が3章以上」。30章すべてで算出値が推定を下回った (0.20〜0.86倍)。該当0章 |
| RB-09 | 成立しない | Node.js 24.18.0 の環境で bootstrap が警告0件で完走。関連3件のうち、書き込み先と静的配信ツールの未記載2件は先行して解消 |
| RB-10 | 成立しない | ライセンス・版番号・CHANGELOG・正誤報告先は公開済みで `validate:release-policy` が成功。該当指摘0件 |
| RB-11 | 成立しない | 代行実施のため個人情報を一切収集していない。停止条件が成立する余地がない |

次版候補は正誤表 ([`ERRATA.md`](../ERRATA.md)) と v1.1 以降のバックログで追跡する。見送りの理由は [`BETA_REVIEW_FINDINGS.md`](../BETA_REVIEW_FINDINGS.md) 第6節に記録した。

## 7. 演習の推定時間と実測の乖離

### 7.1 章単位 (RB-08 の判定材料)

通読者4体が、必修節の実測文字数とコード量から所要時間を算出した (平常な技術文章 毎分600字、コードブロック・表 毎分250字)。

| 担当範囲 | 推定 | 算出 | 比 |
|---|---:|---:|---:|
| 第1〜8章 | 350分 | 176分 | 0.50 |
| 第9〜17章 | 425分 | 177分 | 0.42 |
| 第18〜24章 | 315分 | 169分 | 0.54 |
| 第25〜30章 | 355分 | 180分 | 0.51 |

**推定値の2倍を超えた章は0章**であり、RB-08 は成立しない。乖離はすべて逆方向 (推定が算出の約2倍) であった。これは「読者が速い」のではなく、推定分数が約束する深さに対して必修節の分量が足りていないことを示す。この構造は第5.2節の「章ガイドの到達目標が必修範囲を超える」60件と同じ原因であり、到達目標に必要な節を明示する形で解消した。推定値そのものは、初見の読者が図やコードを追いながら読む時間として妥当な範囲にあると判断し、据え置いた。

### 7.2 演習単位

推定の2倍を超えたのは4件。それぞれ原因を除去するか、推定を実測へ合わせた。

| 演習 | 推定 | 実測 | 比 | 原因 | 対応 |
|---|---:|---:|---:|---|---|
| 4.1 | 45分 | 95分 | 2.11 | starter に計測対象ページが無く、3方式を白紙から作る必要があった | **原因を除去**。3方式の骨組みと `performance.mark` による計測の枠を持つ `starter/index.html` を追加。推定は据え置き |
| 9.2 | 90分 | 185分 | 2.06 | starter が1ファイルなのに、必要な成果物は6ファイルだった | **原因を除去**。アプリシェル5ファイルを starter へ追加し、Service Worker の実装に集中できるようにした。推定は据え置き |
| 19.1 | 90分 | 190分 | 2.11 | 3つの Dockerfile 作成、約1.9GB のベースイメージ取得、初回と再ビルドの計測 | **推定を実測へ補正** (90分→190分)。イメージ取得時間は削減できないため。`config/exercises.json`、`config/clean-environment-plan.json`、`beta-review-scope.json`、計画・シナリオの集計値をすべて更新 |
| 24.5 | 90分 | 210分 | 2.33 | 超過120分はすべて、両立しない完成条件の切り分けに費やされた | **原因を除去** (FB-628 の解消)。矛盾が無くなったため推定は据え置き |

あわせて、実装課題節のメタデータが節内の演習カードの合計と食い違っていた3件 (13.26 350→870分、14.27 510→930分、17.17 730→990分) を補正した。13.26 は2.49倍で Major に当たる。`LEARNING_LEVELS.md` の総計は219時間20分から239時間20分になった。

## 8. 変更・新規作成したファイル

### 8.1 新規作成 (12件)

| ファイル | 内容 |
|---|---|
| `BETA_REVIEW_FINDINGS.md` | フィードバック台帳 (集計、Urgent全件、High の内訳、RB突き合わせ、見送り理由) |
| `beta-review-findings.json` | 台帳の機械可読な正本 (653件、22列相当のフィールド) |
| `reports/KEN61_BETA_REVIEW_RESULT_REPORT.md` | 本レポート |
| `scripts/clean-build-artifacts.mjs` | ビルド成果物 (`code/chXX/dist`) の削除。冪等 |
| `scripts/clean-build-artifacts.test.mjs` | 同テスト (3件) |
| `scripts/apply-starter-contracts.mjs` | 模範解答から公開APIを抽出し starter へ契約として付記。冪等 |
| `scripts/apply-starter-contracts.test.mjs` | 同テスト (5件) |
| `code/ch04/render-bench/starter/index.html` | 課題4.1 の計測対象ページ |
| `code/ch09/pwa-service-worker/starter/` の5ファイル | 課題9.2 のアプリシェル (index.html、app.js、style.css、offline.html、manifest.webmanifest) |

### 8.2 修正 (主なもの)

- **本文8ファイル**: `02-part1-foundations.md`〜`08-part7-practice.md`、`09-references.md`
- **設定6ファイル**: `config/exercises.json`、`config/clean-environment-plan.json`、`config/learning-levels.json`、`config/learning-paths.json`、`config/chapter-guides.json`、`config/editorial-fixes.json`
- **計画・環境文書**: `beta-review-scope.json`、`BETA_REVIEW_PLAN.md`、`BETA_REVIEW_SCENARIOS.md`、`CLEAN_ENVIRONMENT.md`、`NARRATIVE_EDITING_GUIDE.md`
- **コード教材**: 模範解答8件 (ch04 event-loop、ch09 SW、ch06 counter、ch13 policy-engine、ch18 graceful-shutdown、ch19 dockerfile-optimization / manifest-validator / rollout-simulator、ch20、ch23 rate-limit、ch24 web-vitals、ch28 characterization-test、ch02 benchmark、ch04 render-bench)、章テスト3件 (ch09、ch23、ch28)、starter 25件
- **環境**: `.devcontainer/Dockerfile` (python3、sqlite3 を追加)、`.devcontainer/docker-compose.yml` (`name: handbook` を追加)、`scripts/bootstrap-clean-environment.sh` (後始末を追加)
- **スクリプト**: `scripts/apply-chapter-guides.mjs` (学習レベルの付記)、`scripts/apply-editorial-fixes.mjs` (JSON置換の冪等性を修正、ドットを含むキーへのパス指定に対応)、`scripts/apply-learning-levels.test.mjs` (期待値を正本から導出する形へ)
- **生成物**: `01-toc.md`、`LEARNING_LEVELS.md`、`LEARNING_PATHS.md`、`CODE_EXERCISES.md`、`code/chXX/README.md` (すべてスクリプト経由で再生成)

### 8.3 一括修正の方法

本文の修正はすべて `config/editorial-fixes.json` へ登録し、既存の `scripts/apply-editorial-fixes.mjs` 経由で適用した。KEN-61 で追加した項目は **215件** (全492件中)。同スクリプトは冪等であり、`pnpm run apply:editorial-fixes:check` が `check:handbook` に組み込まれている。

作業中に、このスクリプトの JSON 置換経路が「`to` が `from` を含む場合に再実行のたび追記が重なる」不具合を持つことが判明したため、テキスト経路と同じ適用済み判定を追加して修正した (再実行3回で内容が変わらないことを確認)。

## 9. 実行した検証コマンドとその結果

| コマンド | 結果 |
|---|---|
| `pnpm run validate:style` | **ERROR 0 / WARN 0** |
| `pnpm run validate:links` | **ERROR 0 / WARN 0** |
| `pnpm run validate:exercises` | 成功 (演習143件、カード147/147、未完成solution 0件) |
| `pnpm run validate:narrative-flow` | 成功 (30章 completed) |
| `pnpm run validate:beta-review` | 成功 (core 15 / exercise-only 5 / sampled 10、演習37件、設問45、必修199節) |
| `pnpm run validate:release-policy` | 成功 (ERROR 0 / WARN 0) |
| `pnpm run validate:clean-environment` | 成功 (143件、local-automated 113 / local-tls 7 / external-service 17 / browser-manual 6) |
| `pnpm run validate:handbook` | **ERROR 0 / WARN 0** (節415、学習メタデータ415、章ガイド30) |
| `pnpm run check:handbook` | **終了コード 0** |

KEN-59 が達成した水準 (`check:handbook` 終了コード0、`validate:handbook` 0/0、`validate:style` 0/0、`validate:links` 0/0) を維持している。退行は無い。

`check:handbook` には本作業で `apply:starter-contracts:check` と `clean:artifacts:check` を追加し、`test:handbook` には対応するテスト2件 (計8ケース) を追加した。検査は増やす方向にのみ変更しており、緩めていない。

## 10. `config/narrative-flow.json` の第12章・第27章に関する最終判断

**据え置く** と判断した。`minimumBridgeCount` は第12章が実数16に対し13、第27章が実数19に対し13のままである。理由は3つある。

1. **この値は下限であり、実数が上回るのは不整合ではない。** `scripts/validate-narrative-flow.mjs` は実数が下限を下回ったときだけ失敗させる。上回っている状態は意図した余裕である。
2. **下限を実数へ引き上げると原稿が壊れやすくなる。** 以後、編集で接続文を1つ減らしただけで検証が失敗する。減らしてよい場面まで検証が止めることになり、下限としての意味を失う。
3. **選定基準が相対値のため連鎖する。** 基準C4は「節間接続数が全章の第75パーセンタイル以上」であり、2章の値を上げるとしきい値が14から15へ動く。その結果、C4に該当する章が `[13,14,17,20,23,26,28,29,30]` から `[12,13,14,17,23,26,27,28,30]` へ変わり、第12章と第27章が必須検証章へ入る (15章→17章)。基準E2により課題12.2 と課題27.3 (各150分) が必須検証演習へ加わり、37件から39件になる。**この2件は本レビューで実施していないため、変更した時点で release blocker RB-03 (必須検証演習が未実施のまま残っている) が新たに成立してしまう。**

据え置きは検査基準を緩める変更ではない。下限は13のままで、原稿はそれを上回っている。この判断と、将来値を動かす場合の連鎖の内容を [`NARRATIVE_EDITING_GUIDE.md`](../NARRATIVE_EDITING_GUIDE.md) 第6節へ記録した。

## 11. 完了条件を満たしたと言える根拠

### 完了条件1: 通読・演習・専門校閲の各観点で結果がある

| 観点 | 結果 | 根拠 |
|---|---|---|
| 通読 | 30章・必修199節を通読、必須検証章15章の記録シート、通読全体サマリ4枚 | 第3.1節 |
| 演習 | 必須検証演習37件を全件実施 (未実施0)、演習記録シート37枚、環境構築記録4枚 | 第3.2節 |
| 専門校閲 | 5領域すべてで技術校閲シート、一次資料97件と実際に照合 | 第3.3節 |

設問45問すべてに回答があり、`beta-review-scope.json` の `totals.questions` と一致する。必須検証章15章・必須検証演習37件はいずれも全件カバーしており、一部実施で残りを推測した箇所は無い。

### 完了条件2: Urgent/High 指摘をすべて解消

Urgent 23件、High 144件の合計167件をすべて解消した。内訳と1件ずつの解消内容は第5節に記載した。

解消の確認は、指摘の種類に応じて次の方法で行った。

- **コードの欠陥**: 修正後に実際に実行し、演習カードの期待出力が再現することを確かめた (event-loop のタイマー順序、TokenBucket の 0/2.5/5/10、rollout の total 最大13と20、graceful shutdown の503、characterization の100件pass、CLS の 0→0.0192、Docker 3イメージの生成)
- **設定の不整合**: 検証スクリプトで再確認した (services の不一致0件、`FORBIDDEN_ARTIFACT` の再現と解消)
- **本文の修正**: `config/editorial-fixes.json` へ登録し、`apply:editorial-fixes:check` で適用済みであることを機械的に確認した
- **全体**: `check:handbook` 終了コード0、8つの検証すべてが ERROR 0 / WARN 0

### 完了条件3: 次版候補が正式版の公開を妨げないことを確認

次版候補321件を RB-01 から RB-11 と1件ずつ突き合わせ、いずれの停止条件も成立しないことを確認した (第6節、および [`BETA_REVIEW_FINDINGS.md`](../BETA_REVIEW_FINDINGS.md) 第4.1節)。判断に幅のある14件は次版候補に残さず、High へ引き上げて解消した。

## 12. 積み残しとブロッカー

### 積み残し

1. **人間のベータ読者による検証は未実施である。** 第1節に記した5点 (実利用の文脈、学習動機と離脱、支援技術の実使用、長期的な定着、所要時間の実測) は代行では得られない。正式版の公開後、正誤報告経路で継続的に受け付ける必要がある。
2. **次版候補321件は未着手である。** 一次資料の追加39件、説明の厚み21件、教育用簡略化の断り書き19件、演習の完成条件の粒度17件、索引メタデータの節ずれ9件などが含まれる。いずれも公開を妨げないが、v1.1 で扱う価値がある。
3. **通読時間の推定値と分量の乖離は残っている。** 30章すべてで算出値が推定を下回った (平均約0.5倍)。RB-08 は成立しないため公開は妨げないが、「推定分数が約束する深さに、必修節の分量が届いていない」という構造は残る。到達目標に必要な節を明示することで読者が迷わないようにしたが、必修節そのものを厚くする判断は次版へ送った。
4. **starter の公開API契約は必須検証演習23件に限った。** 残り110件の演習の starter は定型文のままである。次版で同じスクリプトを全演習へ広げられる。
5. **`code/ch14/migration-runner` は SQLite のみで検証した。** 演習の区分は `external-service` のままだが、実体は SQLite である。区分の意味づけは `CLEAN_ENVIRONMENT.md` へ明記したが、区分そのものの見直しは、必須検証演習の集合が変わるため次版の課題とした。

### ブロッカー

**無い。** 8つの検証はすべて ERROR 0 / WARN 0、`check:handbook` は終了コード0であり、release blocker 11条件のいずれも成立しない。KEN-63 (v1.0リリースチェックリスト) へ引き渡せる状態にある。

なお、Linear の status 更新は本作業では行っていない (管理側の作業とする指示による)。
