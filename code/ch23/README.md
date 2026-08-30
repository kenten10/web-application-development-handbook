# 第23章 セキュリティ — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch23 run lint
pnpm --filter @handbook/ch23 run typecheck
pnpm --filter @handbook/ch23 run test
pnpm --filter @handbook/ch23 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 23.1 課題23.1: SQL インジェクション ― 実演と防御 (★★) | `sqli/starter/README.md`<br>`sqli/starter/demo.ts` | `sqli/solution/README.md`<br>`sqli/solution/demo.ts` | ★★ | 90分 | なし |
| 23.2 課題23.2: XSS 防御 ― エスケープとサニタイズ (★★) | `xss/starter/main.ts` | `xss/solution/main.ts` | ★★ | 90分 | なし |
| 23.3 課題23.3: CSRF 防御 ― トークン + SameSite (★★) | `csrf.ts` | `csrf.solution.ts` | ★★ | 90分 | なし |
| 23.4 課題23.4: SSRF 防御 ― URL バリデータ (★★) | `ssrf-guard.ts` | `ssrf-guard.solution.ts` | ★★ | 90分 | localhost |
| 23.5 課題23.5: レート制限 (★★★) | `rate-limit.ts` | `rate-limit.solution.ts` | ★★★ | 150分 | なし |
| 23.6 課題23.6: セキュアヘッダ middleware (★★) | `secure-headers.ts` | `secure-headers.solution.ts` | ★★ | 90分 | なし |
| 23.7 課題23.7: 依存パッケージ脆弱性スキャナ (★★) | `dep-scanner.ts` | `dep-scanner.solution.ts` | ★★ | 90分 | なし |
| 23.8 課題23.8: Merkle Tree(23.14 の応用) (★★★) | `merkle-tree.ts` | `merkle-tree.solution.ts` | ★★★ | 150分 | なし |
| 23.9 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★) | `upload-validation/starter/main.ts` | `upload-validation/solution/main.ts`<br>`upload-validation/solution/report.ts` | ★★★ | 150分 | なし |
| 23.10 課題23.10: 濫用対策の鍵と応答の設計を破って塞ぐ (★★★) | `abuse-defense/starter/main.ts` | `abuse-defense/solution/main.ts`<br>`abuse-defense/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 23.1 課題23.1: SQL インジェクション ― 実演と防御 (★★)

**目的**: 脆弱な実装が文字列連結でクエリを組み立てる場合、どう破られるかを実演。

**難易度**: ★★

**推定時間**: 90分 (unsafeQuery と safeQuery の実装25分、擬似評価と demonstrateAttack の実装35分、攻撃入力3種の比較と記録30分)

**必要サービス**: なし

**前提**

- 23.2 SQLインジェクション を読み、文字列連結とプレースホルダでSQLの構文木がどう変わるかを説明できる
- 23.1 OWASP Top 10 (2021) を読み、インジェクションが占める位置を確認する
- code/ch23 で pnpm install が完了し、`pnpm --filter @handbook/ch23 run test` が実行できる
- Node.js と TypeScript で正規表現によるSQL文字列の簡易評価関数を書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] unsafeQuery("' OR 1=1 --") が SELECT id, name FROM users WHERE name = '' OR 1=1 --' という連結済み文字列を返す
- [ ] safeQuery(input) が sql と params の2キーを返し、sql 側に入力文字列が一切現れない
- [ ] demonstrateAttack("' OR 1=1 --") の badResult が2件、goodResult が0件になる
- [ ] '; DROP TABLE users; --' を渡すと bad 側だけが users table dropped by injected statement という例外メッセージを返す
- [ ] 実データベースへ接続せず、テストデータ配列 alice と bob だけを対象に攻撃入力を評価している

**期待出力**

- demonstrateAttack() が unsafeSql と badResult と safe と goodResult の4キーを持つオブジェクトを返す
- 'OR 1=1' 入力で bad 側は2レコード配列、good 側は空配列という対比が同一実行で出力される
- DROP TABLE 入力では badResult が文字列のエラーメッセージ、goodResult が空配列になる

**観察項目**

- unsafeSql の文字列を目視し、入力のシングルクォートが直前のリテラルを閉じ、`--` 以降が構文的にコメント化される位置を特定する
- safeQuery() の sql が入力内容に関わらず SELECT id, name FROM users WHERE name = ? のまま変化しないことを確認する
- 攻撃文字列が params[0] に生の値のまま入り、値としてしか比較されない信頼境界を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="SQL injection" solutions.test.ts` を実行し、1件がpassすれば合格
2. `pnpm --filter @handbook/ch23 run test` を実行し、solutions.test.ts のテストがすべてpassすることを確認する
3. 自作実装で demonstrateAttack('bob') を呼び、bad と good の双方が bob 1件だけを返せば正常系を壊していないと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に攻撃入力なしの正常系で bad と good が同じ1件を返す状態を作り、その後で `' OR 1=1 --` を入れて結果件数の差が出る形にする
2. 構造: unsafeQuery() はテンプレートリテラルで連結、safeQuery() は sql と params に分けたオブジェクトを返す。bad 側の「実行」は実DBではなく、生成されたSQL文字列を正規表現で判定する擬似評価関数にする
3. 実装の要点: 攻撃判定は大文字小文字と空白の揺れを吸収する必要があるため /\bor\s+1\s*=\s*1\b/i のように i フラグと \s* を入れる。DROP TABLE 側は結果を返さず throw して破壊性を結果の型の違いとして表現する

**本番利用時の警告**

- 攻撃文字列の投入先はこの教材のローカル配列に限定する。実運用DBや第三者が管理するホストへ同じ入力を送ると不正アクセスにあたる
- simulateUnsafe() は正規表現による擬似評価であり実SQLパーサではない。UNION SELECT、時間差ブラインド、スタッククエリ、二次注入は再現されず、この演習を通過しても注入耐性の証明にはならない
- safeQuery() のプレースホルダが守るのは値だけである。テーブル名・カラム名・ORDER BY 方向を動的に組み立てる箇所は連結が残るため、許可リストによる別防御が必要になる

**導線**

- 開始地点: `sqli/starter/README.md`、`sqli/starter/demo.ts`
- 模範解答: `sqli/solution/README.md`、`sqli/solution/demo.ts`

### 23.2 課題23.2: XSS 防御 ― エスケープとサニタイズ (★★)

**目的**: HTML エスケープ + DOM XSS の両方を体験。

**難易度**: ★★

**推定時間**: 90分 (escapeHtml の実装15分、sanitize の段階的置換の実装40分、innerHTML と textContent の比較観察と迂回入力の試行35分)

**必要サービス**: なし

**前提**

- 23.3 XSS (Cross-Site Scripting) を読み、Reflected と Stored の違いと出力文脈ごとのエスケープを説明できる
- 23.25 CSP Trusted Types ― XSS 防御の最終形 に目を通し、サニタイズが唯一の防御層ではないことを確認する
- ブラウザのDevToolsで Elements パネルを開き、innerHTML 代入後のDOMノードを確認できる
- 正規表現の置換で貪欲・非貪欲の違いを扱える

**完成条件 (自己採点用チェックリスト)**

- [ ] escapeHtml() が & < > " ' の5文字を &amp; &lt; &gt; &quot; &#39; に置換する
- [ ] sanitize('<p onclick="x">Hi<script>x</script><b>ok</b></p>', {allowedTags:['p','b']}) が <p>Hi<b>ok</b></p> を返す
- [ ] script 要素は開始タグから終了タグまで中身ごと削除され、許可外の一般タグはタグだけ削除して内側のテキストは残る
- [ ] on で始まるイベントハンドラ属性と javascript: スキームが出力文字列に1つも残らない
- [ ] HTMLコメント <!-- --> が出力から除去される

**期待出力**

- escapeHtml('<x>') が &lt;x&gt; という7文字の文字列を返す
- sanitize() は属性を持たない許可タグだけの文字列を返し、br や hr や img などのvoid要素は <br /> の形で出力される
- 同じ入力を textContent へ代入した場合はタグが文字として表示され、DOMノードは増えない

**観察項目**

- 同じ攻撃文字列を innerHTML と textContent に代入し、DevTools の Elements パネルで script 要素ノードが生成されるかどうかの差を確認する
- sanitize() の置換段 (コメント除去、script除去、タグ絞り込み、on属性除去) を1段ずつ外し、どの入力が通過するようになるかを記録する
- <scr<script>ipt> のような入れ子入力を与え、1回だけの置換で穴が残るかどうかを出力文字列で確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="XSS sanitizer" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作 sanitize に <a href="javascript:alert(1)">x</a> を渡し、出力に javascript: が含まれなければ合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: エスケープとサニタイズを別関数に分ける。エスケープは「HTMLを一切許さない」場合、サニタイズは「一部タグだけ許す」場合という用途の違いから設計を始める
2. 構造: sanitize は許可タグの Set を作り、置換を段階に分ける。コメント除去、script要素の中身ごと除去、タグ名の正規表現置換で許可外を落とす、最後に on属性と javascript: を除去、という順序にする
3. 実装の要点: タグ置換のコールバックでは tag.toLowerCase() で比較し、full.startsWith('</') で終了タグを判別して属性を丸ごと捨てる。属性を残さない設計にすると on属性の取りこぼしを構造的に防げる

**本番利用時の警告**

- XSSペイロードは自分のlocalhostで開いたページだけで実行する。第三者のサイトやSaaSの入力欄へ投入すると攻撃行為になり、社内環境でも事前許可なしに行ってはならない
- この自作サニタイザは正規表現ベースで、HTMLパーサの状態機械を再現していない。mXSS (パース時の再解釈)、SVG や MathML の名前空間、属性値内のエンコード、data: URI は防げず、本番では DOMPurify のような実装済みライブラリを使う
- サニタイズは単独の防御層にならない。CSP の script-src と nonce、および Trusted Types による sink 制限を併用しないと、1つの取りこぼしがそのままセッション奪取につながる

**導線**

- 開始地点: `xss/starter/main.ts`
- 模範解答: `xss/solution/main.ts`

### 23.3 課題23.3: CSRF 防御 ― トークン + SameSite (★★)

**目的**: CSRF 攻撃の仕組みと、トークン方式 + SameSite Cookie の併用。

**難易度**: ★★

**推定時間**: 90分 (トークン生成の実装20分、検証関数と失敗系の実装30分、SameSite属性の挙動整理と別オリジン送信の観察40分)

**必要サービス**: なし

**前提**

- 23.4 CSRF (再掲) を読み、ブラウザが自動でCookieを付ける条件を説明できる
- Cookie属性 SameSite と Secure と Path の意味を区別できる
- node:crypto の createHmac と timingSafeEqual を使える
- code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] createCsrfToken(secret, sessionId) が nonce とHMACをドットで連結した2要素の文字列を返す
- [ ] verifyCsrfToken() が cookieToken と formToken が一致し、かつ sessionId が発行時と同じ場合にのみ true を返す
- [ ] sessionId を別の値に変えると同じトークンでも false になる
- [ ] cookieToken か formToken のどちらかが欠けた場合に false を返す
- [ ] csrfCookie() が Path=/ と Secure と SameSite=Strict の3属性を含む Set-Cookie 値を返す

**期待出力**

- createCsrfToken() の戻り値が base64url の nonce とHMACをドットでつないだ1行の文字列になる
- 同じ secret と sessionId と nonce を与えると毎回同一のトークンが再現され、nonce を省くと呼び出しごとに異なる値になる
- verifyCsrfToken() は true か false の真偽値のみを返し、不一致の理由は返さない

**観察項目**

- sessionId だけを変えて検証したときに false になることを確認し、トークンがセッションに束縛されている (別セッションへ使い回せない) ことを読み取る
- MAC の比較を === に変えても機能テストは通ることを確認し、timingSafeEqual が守っているのは機能ではなくタイミング差であることを区別する
- csrfCookie() の SameSite=Strict を Lax や None に変えたときに、どのリクエスト (トップレベル遷移、フォームPOST、サブリソース) でCookieが送られるかを整理する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="CSRF double-submit" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作実装でトークンの末尾1文字を書き換えて verifyCsrfToken に渡し、false が返れば改ざん検知が働いていると判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: トークンは「推測不能な乱数」と「サーバだけが作れる署名」の2つの性質が要る。まず乱数だけの版を作り、次にセッションへ束縛する署名を足すという順に組む
2. 構造: randomBytes で nonce を作り、createHmac('sha256', secret) に sessionId と nonce を連結して更新し、nonce と MAC を結合した文字列を返す。検証側は受け取った nonce で同じ手順を再計算して比較する
3. 実装の要点: MAC の比較は timingSafeEqual を使うが、長さが異なると例外になるため a.length === b.length を先に確認してから呼ぶ。Cookie とフォームの一致 (double submit) だけでは不十分で、署名検証と組み合わせて初めてサブドメインからのCookie注入に耐える

**本番利用時の警告**

- 別オリジンから自動送信されるフォームを実際に作って試す場合は、送信先を自分のlocalhostに限定する。他人が運用するサイトへ向けたCSRF検証用フォームを設置・公開すると攻撃の実行にあたる
- この実装は署名の検証だけで、トークンの有効期限・ワンタイム化・ログアウト時の失効・Origin と Referer ヘッダの照合を持たない。漏れたトークンは secret を変えるまで無期限に有効なままになる
- SameSite=Strict はブラウザ側の防御であり、古いクライアントや非ブラウザのHTTPクライアントには効かない。本番ではトークン検証を必須とし、SameSite は多層防御の1枚として扱う

**導線**

- 開始地点: `csrf.ts`
- 模範解答: `csrf.solution.ts`

### 23.4 課題23.4: SSRF 防御 ― URL バリデータ (★★)

**目的**: ユーザー指定 URL を fetch する機能 (画像プレビュー、Webhook 等) で内部リソースを叩かれないようにする。

**難易度**: ★★

**推定時間**: 90分 (CIDR判定関数の実装30分、URL検査パイプラインとDNS解決の注入35分、rebinding とリダイレクトの迂回実験25分)

**必要サービス**: localhost

**前提**

- 23.5 SSRF (Server-Side Request Forgery) を読み、クラウドのメタデータエンドポイントが狙われる理由を説明できる
- IPv4のCIDR表記とビットマスクによる所属判定を計算できる
- node:dns/promises の lookup と node:net の isIP を使える
- code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] isBlockedAddress('169.254.169.254') と isBlockedAddress('127.0.0.1') と isBlockedAddress('192.168.0.1') がすべて true を返す
- [ ] isBlockedAddress('93.184.216.34') が false を返し、公開アドレスを誤って弾かない
- [ ] SSRFGuard.validate() が http と https 以外のスキームで例外を投げる
- [ ] hostname が localhost の場合と、URLに username か password が含まれる場合に例外を投げる
- [ ] resolve 済みのIPが1つでもブロック対象なら例外を投げ、通過時は url と addresses を持つオブジェクトを返す
- [ ] allowedPorts を指定した場合、リストにないポートで例外を投げる

**期待出力**

- validate('https://example.com') が addresses に解決済みIPの配列、url に URL オブジェクトを持つ結果を返す
- 拒否ケースは戻り値ではなく reject となり、unsupported protocol / localhost is blocked / private or special address is blocked / port is not allowed のいずれかのメッセージになる
- IPv6は :: と ::1 と fc/fd 始まり (ULA) と fe80 系 (link-local) と ::ffff:127. 始まり (IPv4射影) が拒否される

**観察項目**

- resolve をテスト用の関数に差し替え、ホスト名は公開ドメインのままIPだけ 127.0.0.1 を返す構成にして、DNS rebinding が名前だけの検査を素通りすることを確認する
- 0.0.0.0 と 10.0.0.0/8 と 100.64.0.0/10 (CGNAT) と 224.0.0.0/4 (マルチキャスト) が拒否リストに入っている理由を、それぞれ何に到達しうるかで整理する
- 検査に通ったあと実際にfetchするまでの間に再解決が起こりうる点を確認し、検査済みIPへ直接接続する必要性を読み取る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="SSRF guard" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作実装で resolve を async () => ['127.0.0.1'] に差し替えて validate('http://example.test') を呼び、rejectされれば解決後IP検査が効いていると判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「ホスト名を見て弾く」では足りない。名前とIPは別物なので、スキーム、認証情報、ポート、ホスト名、解決後IP という順に段階を分けた検査パイプラインとして設計する
2. 構造: IPv4は 4オクテットを32bit整数へ畳み、prefix長からマスクを作って base と一致するかで判定する。IPv6は正規化して小文字にし、::1 と fc/fd と fe80 系のプレフィックスで判定する。DNS解決は差し替え可能な resolve オプションとして注入できるようにする
3. 実装の要点: ビットシフトは符号付きになるため (0xffffffff << (32 - bits)) >>> 0 のように符号なしへ戻す。prefix長0のときシフト量32はシフトなしと同義になるので、bits === 0 を分岐で先に処理する

**本番利用時の警告**

- 自作バリデータの穴を探す実験は、自分のマシンのlocalhostと自分が所有するテストドメインだけで行う。169.254.169.254 などクラウドのメタデータエンドポイントを他人のアカウントや職場の環境で叩くと権限昇格の試行とみなされる
- この SSRFGuard は検査時点のIPしか見ないため、検査と実際の接続の間にDNSが差し替わる TOCTOU 型の rebinding は防げない。本番では解決済みIPを固定して接続するか、egress proxy と VPC のネットワークポリシーで出口自体を制限する
- リダイレクト追跡は実装されていない。fetch のデフォルトは 3xx を自動追従するため、検査を通った公開URLから内部アドレスへ飛ばされる。本番では redirect を manual にし、各ホップで同じ検査をやり直す必要がある

**導線**

- 開始地点: `ssrf-guard.ts`
- 模範解答: `ssrf-guard.solution.ts`

### 23.5 課題23.5: レート制限 (★★★)

**目的**: ブルートフォース攻撃 / DDoS 防御の基本。Token Bucket と Sliding Window 両方を実装。

**難易度**: ★★★

**推定時間**: 150分 (TokenBucket の遅延補充実装35分、SlidingWindow のログ管理と retryAfterMs 実装40分、仮想時刻テストの作成40分、両方式の許可パターン比較と記録35分)

**必要サービス**: なし

**前提**

- 23.6 認証関連の脆弱性 を読み、ブルートフォースに対するレート制限の位置づけを説明できる
- 23.12 ログとモニタリング を読み、拒否イベントを記録する意味を確認する
- 時刻を関数として注入し、テストで仮想時間を進める書き方ができる
- Map を使ったキー別の状態管理を TypeScript で書ける

**完成条件 (自己採点用チェックリスト)**

- [ ] TokenBucket({capacity:2, refillPerSec:1}) が連続2回の tryConsume() で true、3回目で false を返す
- [ ] 仮想時刻を1000ms進めると TokenBucket が再び true を返し、トークンが capacity を超えて溜まらない
- [ ] tryConsume(n) が n トークンをまとめて消費でき、残量不足なら消費せずに false を返す
- [ ] SlidingWindowLimiter({windowMs:1000, max:2}) が同一キーで2回まで allowed:true、3回目に allowed:false を返す
- [ ] check() の戻り値が allowed と remaining と retryAfterMs の3キーを持ち、拒否時の retryAfterMs が正の値になる
- [ ] キーが異なる場合はカウンタが独立し、別ユーザーの消費が影響しない

**期待出力**

- TokenBucket.remaining() が経過時間に比例して増え、capacity で頭打ちになる小数値を返す
- SlidingWindowLimiter.check() が {allowed:true, remaining:1, retryAfterMs:0} のような形のオブジェクトを返し、拒否時は remaining:0 になる
- 拒否時の retryAfterMs が「最古のログ時刻 + windowMs - 現在時刻」に一致する

**観察項目**

- TokenBucket は burst を許して平均を絞り、SlidingWindow は窓内の総数を厳密に絞るという性質差を、20回連続呼び出しの許可パターンを並べて確認する
- SlidingWindowLimiter のログ配列がキーごとに増え続けるかどうかを確認し、窓外の要素をいつ捨てているかをコード上で特定する
- 固定窓 (fixed window) で実装した場合に窓の境界をまたいで max の2倍が通ってしまう現象を、境界時刻をまたぐ呼び出しで再現する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="rate limiters" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作実装で now を関数注入し、時刻を進めない状態で capacity+1 回呼んで最後だけ false になれば境界条件が正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 実時間に依存させるとテストが不安定になる。最初から now を差し替え可能なオプションとして受け取り、Date.now をデフォルトにする設計から始める
2. 構造: TokenBucket は「最後に補充した時刻」と「現在のトークン数」の2状態だけを持ち、呼び出しのたびに経過秒数 × refillPerSec を加算して capacity で clamp する。SlidingWindow はキーごとに許可時刻の配列を持ち、窓外を filter で捨ててから長さを max と比較する
3. 実装の要点: TokenBucket は補充を setInterval ではなく呼び出し時の遅延計算で行うのが要点で、これによりアイドル時にタイマーが走らない。SlidingWindow は拒否したときも filter 後の配列を保存し直さないと、古い要素が残って retryAfterMs がずれる

**本番利用時の警告**

- このレート制限はプロセス内の Map に状態を持つため、複数インスタンスへスケールアウトすると実効上限がインスタンス数倍になる。本番では Redis などの共有ストアか、ロードバランサ層の制限機能を使う
- SlidingWindowLimiter はキーごとに許可時刻をすべて配列で保持し、キーの上限も TTL も持たない。攻撃者が毎回異なるキー (IPやユーザーID) を送ると Map が際限なく膨らみメモリ枯渇を起こすため、本番ではLRU退避か有効期限付きストアが必須になる
- レート制限をIPアドレス単位だけで行うと、NAT配下の正規利用者をまとめて遮断する一方、分散した攻撃元には効かない。認証情報やアカウント単位の制限と組み合わせ、拒否イベントを監視へ送る前提で設計する

**導線**

- 開始地点: `rate-limit.ts`
- 模範解答: `rate-limit.solution.ts`

### 23.6 課題23.6: セキュアヘッダ middleware (★★)

**目的**: CSP、HSTS、X-Frame-Options 等を一括設定する Express 風ミドルウェア。

**難易度**: ★★

**推定時間**: 90分 (ヘッダ組み立て関数の実装30分、ミドルウェア化と curl での確認25分、CSP違反をブラウザで発生させて観察35分)

**必要サービス**: なし

**前提**

- 23.11 セキュアヘッダ を読み、各ヘッダが防ぐ攻撃を対応付けられる
- 23.17 HSTS の詳細 ― HTTPS 強制の正しい使い方 を読み、preload の不可逆性を確認する
- Express 風の (req, res, next) ミドルウェアの呼び出し規約を知っている
- ブラウザのDevToolsの Network タブでレスポンスヘッダを確認できる

**完成条件 (自己採点用チェックリスト)**

- [ ] buildSecurityHeaders() の戻り値が Content-Security-Policy と Strict-Transport-Security と X-Frame-Options と X-Content-Type-Options と Referrer-Policy と Permissions-Policy の6キーをすべて含む
- [ ] csp の defaultSrc と scriptSrc というキャメルケースのキーが default-src と script-src へ変換され、値がスペース区切り、ディレクティブ間がセミコロン区切りで連結される
- [ ] hsts の includeSubDomains と preload が false のときは対応するトークンが出力に含まれない
- [ ] contentTypeOptions が true のとき X-Content-Type-Options: nosniff が付く
- [ ] securityHeaders() が返す関数が res.setHeader を各ヘッダ分だけ呼び、最後に next() を1回呼ぶ
- [ ] オプションで指定しなかったヘッダは戻り値のキーに現れない

**期待出力**

- Content-Security-Policy の値が default-src 'self'; script-src 'self' https://cdn.example.com のような1行の文字列になる
- Strict-Transport-Security の値が max-age=31536000; includeSubDomains; preload のようにセミコロン区切りで組まれる
- Permissions-Policy が camera=(), microphone=() のようにカンマ区切りで、空配列は空の括弧になる

**観察項目**

- 生成した CSP を実際のページに適用し、DevTools の Console に出る Refused to load / Refused to execute の違反メッセージで、どのディレクティブがどのリソースを止めたかを対応付ける
- X-Frame-Options: DENY と CSP の frame-ancestors 'none' を並べ、どちらが新しく、どちらが古いブラウザ向けの冗長化かを確認する
- Referrer-Policy を no-referrer と strict-origin-when-cross-origin で切り替え、Network タブの Referer ヘッダの中身がどこまで残るかを比較する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="security middleware" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作ミドルウェアを組み込んだサーバに `curl -sI http://localhost:3000/` を実行し、6ヘッダすべてが出力に現れれば合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ヘッダ文字列の組み立てと、res へ書き込むミドルウェアを別関数に分ける。前者は純関数なのでテストが容易になり、後者は薄いラッパで済む
2. 構造: buildSecurityHeaders(options) が Record<string, string> を返し、securityHeaders(options) がそれを閉じ込めた (req, res, next) を返す構成にする。CSP は Object.entries でディレクティブ名を変換しつつ join('; ') する
3. 実装の要点: キャメルケースからケバブケースへの変換は value.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`) の1行で書ける。HSTS の includeSubDomains は仕様上この大文字小文字混在の綴りで、ケバブケース変換の対象にしてはいけない

**本番利用時の警告**

- HSTS の preload はブラウザに組み込まれたリストへ載るため、いったん配信すると取り消しに数か月かかる。max-age を短くして検証してから preload を付ける手順を踏まないと、証明書の失効やサブドメインのHTTP運用でサイト全体が到達不能になる
- このミドルウェアは静的な文字列を組み立てるだけで、リクエストごとの nonce 生成もハッシュ計算も行わない。script-src に 'self' しか書かない状態でインラインスクリプトを使うページに適用すると、CSPが機能を壊すか、'unsafe-inline' を足して防御が無効化されるかのどちらかになる
- ヘッダは多層防御の最外層でしかない。CSP が付いていても、サーバ側のエスケープ・認可・入力検証を省略してよい理由にはならず、レポート専用モード (Content-Security-Policy-Report-Only) での事前計測を経ずに本番へ入れると正規機能を遮断する

**導線**

- 開始地点: `secure-headers.ts`
- 模範解答: `secure-headers.solution.ts`

### 23.7 課題23.7: 依存パッケージ脆弱性スキャナ (★★)

**目的**: npm audit 風のツールを自作。package.json と package-lock.json を読んで、脆弱性 DB (簡易版) と照合。

**難易度**: ★★

**推定時間**: 90分 (ロックファイル2形式のパース実装25分、semver レンジ判定の実装35分、突き合わせと重大度ソート15分、prerelease や重複バージョンでの検出漏れ確認15分)

**必要サービス**: なし

**前提**

- 23.10 依存パッケージの脆弱性 を読み、直接依存と推移的依存の違いを説明できる
- package-lock.json の packages キーと dependencies キーの2形式の違いを把握している
- semver の キャレット と チルダ と比較演算子レンジの意味を説明できる
- code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる

**完成条件 (自己採点用チェックリスト)**

- [ ] extractLockedVersions() が lock の packages 配下の node_modules/ プレフィックスを除いたパッケージ名とバージョンの対応表を返す
- [ ] 旧形式の dependencies ツリーを再帰的にたどり、ネストした推移的依存もバージョン表に含める
- [ ] satisfies('1.2.3', '>=1.0.0 <2.0.0') が true、satisfies('2.0.0', '>=1.0.0 <2.0.0') が false を返す
- [ ] キャレットとチルダのレンジがメジャー固定・マイナー固定として正しく判定される
- [ ] scan() が該当する脆弱性ごとに name と version と severity と id と title を持つ Finding を返す
- [ ] 結果が CRITICAL, HIGH, MEDIUM, LOW の順に並ぶ

**期待出力**

- scan() が Finding の配列を返し、該当0件のときは空配列になる
- 1件ヒットしたときの要素が {name, range, severity:'HIGH', id, title, version:'1.2.3'} のように advisory の全項目に実バージョンを足した形になる
- 重大度の異なる複数件を渡すと、CRITICAL が先頭、LOW が末尾に並んだ配列になる

**観察項目**

- スペース区切りのレンジがAND、二重パイプ区切りがORとして扱われることを、両方を含むレンジ文字列で確認する
- prerelease 付きバージョン (1.2.3-beta.1 など) を渡し、数値化の際に beta 部分がどう扱われるかを確認して semver 仕様との差を記録する
- 同じパッケージが異なるバージョンで複数階層に入っている lock を与え、バージョン表が後勝ちで1つに潰れることによる検出漏れを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="dependency scanner" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作 scan に空の advisory 配列を渡して空配列が返り、該当する1件だけを渡して長さ1の配列が返れば分類ロジックが正しいと判定する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: ロックファイルの読み取り、レンジ判定、突き合わせ、重大度による並べ替えという4つの独立した関数に分け、それぞれ単体でテストできる形にする
2. 構造: バージョン比較はメジャー・マイナー・パッチの3要素を数値配列にして辞書順で比較する。レンジは二重パイプで OR に分割し、各項をスペースで AND に分割し、先頭の演算子を正規表現で切り出して分岐する
3. 実装の要点: キャレットとチルダは「下限以上」かつ「上位桁が一致」の2条件の合成として書くと短くなる。数値化のとき Number('') が NaN になる点と、v プレフィックスの除去を忘れると全比較が壊れる点に注意する

**本番利用時の警告**

- この簡易 semver 実装は prerelease タグとビルドメタデータを切り捨てるため、`1.2.3-beta` と `1.2.3` を同一視する。本物の npm audit と結果が食い違うので、実プロジェクトの可否判断には使わず、公式のアドバイザリDBと npm audit を使う
- スキャナは脆弱性の存在しか見ず、その関数が実際に呼ばれているか (到達可能性) や実行時の入力条件を評価しない。結果をそのままCIの失敗条件にすると、影響のない検出でビルドが止まり、無効化の運用に流れて本当に危険な検出まで無視されるようになる
- バージョン表がパッケージ名で一意になる設計のため、同名パッケージが複数バージョン同居する実際の node_modules では脆弱なほうを見落とす。本番のスキャナはパス単位でツリーを保持する

**導線**

- 開始地点: `dep-scanner.ts`
- 模範解答: `dep-scanner.solution.ts`

### 23.8 課題23.8: Merkle Tree(23.14 の応用) (★★★)

**目的**: 監査ログの改ざん検知に使う Merkle Tree を実装。

**難易度**: ★★★

**推定時間**: 150分 (葉ハッシュと root 畳み込みの実装35分、proof 生成の兄弟インデックス計算40分、verify とプレフィックスなし版での second preimage 実験40分、葉数1から8までの網羅確認35分)

**必要サービス**: なし

**前提**

- 23.14 Merkle Tree ― 大量データの完全性証明 を読み、inclusion proof の検証手順を図で追える
- 23.20 Certificate Transparency (CT) を読み、Merkle Tree が実運用で何を保証しているかを確認する
- node:crypto の createHash で SHA-256 のダイジェストを計算できる
- ビット演算とインデックス計算で兄弟ノードを求められる

**完成条件 (自己採点用チェックリスト)**

- [ ] append() で追加した各エントリが葉ハッシュへ変換され、root() が固定長のhex文字列を返す
- [ ] 葉とノードで異なるプレフィックス (leaf: と node:) を付けてハッシュしている
- [ ] エントリ数が奇数の階層で最後のノードを複製して繰り上げ、根が1つに収束する
- [ ] proof(index) が position (left か right) と hash を持つ要素の配列を返す
- [ ] MerkleTree.verify(値, proof, root) が正しい値で true、1文字でも異なる値で false を返す
- [ ] 範囲外のインデックスを proof() に渡すと index out of range で例外になる

**期待出力**

- 3件を追加したツリーの root() が64文字のhex文字列になる
- proof(1) の長さが log2(葉数) の切り上げ (3葉なら2要素) になり、各要素が position と hash の2キーを持つ
- 改ざんした値で verify するとハッシュの再計算結果が root と一致せず false になる

**観察項目**

- 葉に leaf: プレフィックスを付けない実装に変え、内部ノードのハッシュを葉として提出できてしまう second preimage 攻撃が成立することを確認する
- 葉を1件追加したときに root が全面的に変わり、proof の長さが階層の増減に応じて変わる様子を記録する
- proof の position を left と right で入れ替えると検証が false になることを確認し、結合順序が証明の一部であることを読み取る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="Merkle proof" solutions.test.ts` を実行し、passすれば合格
2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
3. 自作実装で葉を1件から8件まで増やしながら全インデックスの proof を verify し、すべて true になり、かつ他の葉の値では false になれば合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に root() だけを作り、階層を1段ずつ畳む while ループを完成させる。proof はその畳み込みと同じループの中で兄弟を記録するだけ、と気づくと実装が半分になる
2. 構造: 葉配列を保持し、level を while (level.length > 1) で畳む。proof では現在位置 i の兄弟を i ^ 1 で求め、i が偶数なら兄弟は右、奇数なら左として position を記録し、各段の最後に i = Math.floor(i / 2) で親へ移動する
3. 実装の要点: 奇数個の階層では level[i + 1] が undefined になるので自分自身を複製して埋める。verify 側は position に従って結合順を入れ替える必要があり、left なら proof のハッシュを前、right なら後ろに置く

**本番利用時の警告**

- Merkle Tree はログの改ざんを検知できるだけで、防止も復旧もしない。root を同じ改ざん可能なストレージに置くと攻撃者が木ごと作り直せるため、本番では root を別系統の追記専用ストアや外部のタイムスタンプ機関へ固定する必要がある
- この実装は木全体をメモリ上の配列に保持し、root() のたびに全体を再計算する。監査ログ規模 (数百万件) ではメモリと計算時間が線形に増えるため、本番では追記時に増分更新する形へ置き換える
- consistency proof (過去の root が現在の root の接頭辞であることの証明) を実装していないため、この木では「過去のエントリが削除・並べ替えされていないこと」を第三者へ示せない。CT のような用途では inclusion proof だけでは不十分になる

**導線**

- 開始地点: `merkle-tree.ts`
- 模範解答: `merkle-tree.solution.ts`

### 23.9 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★)

**目的**: MIME 偽装、多重拡張子、圧縮爆弾、配信ヘッダの不足という4件を無害な検体で再現し、判定を差し替えると1件も通らず、かつ正当なファイルは受理され続けることを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (sniffType と検体の組み立て35分、naiveGate と strictGate の実装40分、expandArchive の上限判定35分、deliveryHeaders と観察40分)

**必要サービス**: なし

**前提**

- 23.26 アップロードされたファイルの検証 を読み、申告された種別を信用しない理由と展開比の上限を確認する
- 12.13 ファイルアップロードの転送方式 を読み、保存キーをサーバで生成する理由を押さえる
- 23.3 XSS (Cross-Site Scripting) を読み、配信されたファイルがスクリプトとして実行される経路を確認する
- `code/ch23` で pnpm install 済みで、`pnpm --filter @handbook/ch23 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `sniffType` がマジックバイトから種別を判定し、判定できないものに null を返す
- [ ] `strictGate` が実体の種別と申告の食い違いを拒否し、拡張子をクライアント由来の値から決めない
- [ ] `expandArchive` が展開しながらサイズと圧縮比を数え、宣言された展開後サイズを使わない
- [ ] `deliveryHeaders` が検出した種別、Content-Disposition、nosniff、サンドボックスの CSP、CORP を付ける
- [ ] 正当な PNG が strictGate でも受理され、拒否件数に含まれない
- [ ] `pnpm --filter @handbook/ch23 exec tsx upload-validation/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive gate: 4/4 weaknesses reproduced` が出る
- V1 の行が `naive accepted as image/png / strict rejected: declared type mismatch` になる
- V2 の行が `naive accepted as application/pdf / strict rejected: unsupported type` になる
- V3 の行が `naive expanded=268435456 / strict expanded=20971520 aborted=compression ratio` になる
- 最終行が `strict gate: 0/4 weaknesses remaining (benign png still accepted)` になる

**観察項目**

- `SIGNATURES` から PNG の項目を外し、正当な PNG まで unsupported type で落ちること (過剰な拒否) を確認する
- `strictGate` の申告と実体の一致検査を外し、V1 だけが再現に戻ることを確認する
- `expandArchive` の中断判定を外し、V3 だけが再現に戻ることを確認する
- `FIXTURES.limits.maxRatio` を 1000 へ上げ、V3 の中断理由が compression ratio から expanded size limit へ変わることを確認する
- `deliveryHeaders` から nosniff を外し、V4 が再現に戻ることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx upload-validation/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch23 run test` を実行し、upload validation のテストが pass することを確認する
3. 自分の `upload-validation/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch23 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 判定の入口を1つに絞る。受理の可否、種別、拡張子、配信ヘッダのすべてを同じ Decision から導くと、どこか1か所だけ古い判断が残るという誤りが起きなくなる。
2. 構造: 検体を4種類の形として整理する。実体と申告が食い違うもの、名前だけで判断させようとするもの、展開すると膨らむもの、そして中身は正当だが配信で危険になるものである。最初の3つは受理の段階で、最後の1つは配信の段階で止まる、という違いを判定の構造に反映させる。
3. 実装の要点: `expandArchive` は、宣言値を一切参照しない形にする。読み進めながら累計を数え、累計と圧縮後サイズの比が上限を超えた時点で中断する。入れ子の深さとエントリ数の上限も同じループの外側で数え、どれか1つが超えたら中断する。

**本番利用時の警告**

- この課題の検体はすべて無害なバイト列であり、実際のマルウェアやエクスプロイトを含まない。実検体を扱う場合は隔離環境と組織の規程に従う。
- マジックバイトの検査は最低限の関門でしかない。ポリグロットや、形式としては妥当だが解析器を攻撃するファイルは通る。本番では画像の再エンコード、隔離実行、スキャンを併用する。
- `expandArchive` の模擬は実際の ZIP や gzip の構造を再現していない。本番では利用する展開ライブラリが途中中断と資源上限に対応しているかを個別に確認する。

**導線**

- 開始地点: `upload-validation/starter/main.ts`
- 模範解答: `upload-validation/solution/main.ts`、`upload-validation/solution/report.ts`

### 23.10 課題23.10: 濫用対策の鍵と応答の設計を破って塞ぐ (★★★)

**目的**: 分散した Credential Stuffing の素通り、応答の差によるアカウント列挙、固定ロックによる締め出し、Retry-After を伴わない拒否という4件を再現し、層を重ねた実装へ差し替えると1件も残らず、かつ平常時の正しいログインは通り続けることを機械的に確かめる。

**難易度**: ★★★

**推定時間**: 150分 (NaiveGuard と攻撃の模擬の読解30分、signals の設計30分、login の段階的対応50分、runFindings と観察40分)

**必要サービス**: なし

**前提**

- 13.25 認証エンドポイントの濫用 を読み、4種類の攻撃で効く対策が違うことと、鍵を層として置く理由を確認する
- 23.27 自動化された脅威 を読み、鍵・層・返し方の3つを決めるという枠組みを押さえる
- 課題23.5 レート制限を実装する を先に終えて、固定窓とトークンバケットの違いを把握しておく
- `code/ch23` で pnpm install 済みで、`pnpm --filter @handbook/ch23 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `LayeredGuard.signals` がアカウント・送信元IP・ネットワーク・全体の4層の鍵を返し、鍵を正規化する
- [ ] `LayeredGuard.login` が2層以上の超過で 429 と Retry-After を返し、その判定が保存領域を引かずに完結する
- [ ] 1層だけの超過では拒否せず、追加確認へ回す。成否で応答の文言を変えない
- [ ] 存在しないアカウントでも同じ経路を通り、処理時間の差 (verifiedHash) が残らない
- [ ] 漏洩資格情報 (BREACHED) に一致するパスワードは、正しくても素通りさせない
- [ ] `pnpm --filter @handbook/ch23 exec tsx abuse-defense/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `naive guard: 4/4 weaknesses reproduced` が出る
- B1 の行の naive が `accepted=2 [chiba@example.test, bito@example.test]` で、layered が `accepted=0 []` になる
- B2 の行が `naive distinguishable=2/2 / layered distinguishable=0/2` になる
- B3 の行が `naive victim-blocked=true / layered victim-blocked=false` になる
- 最終行が `layered guard: 0/4 weaknesses remaining (normal login still succeeds)` になる

**観察項目**

- `signals` をアカウント1層だけにし、B4 が再現に戻る (layered blocked=0/30 status=401 retry-after=none) ことを確認する
- BREACHED の照合を外し、B1 が再現に戻る (layered accepted=2) ことを確認する
- 失敗時の応答文言を成否で分け、B2 が再現に戻る (layered distinguishable=1/2) ことを確認する
- 429 の条件を `exceeded.length >= 1` へ変え、4件は解消したまま拒否件数が 10 から 25 へ増えることを確認する
- `normalizeEmail` の呼び出しを外し、report の4件は変わらないが章テストの「大文字小文字を変えても同じ鍵として数える」が 401 で失敗することを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch23 exec tsx abuse-defense/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch23 run test` を実行し、abuse defence の4件のテストが pass することを確認する
3. 自分の `abuse-defense/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch23 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 同じ試行を複数の鍵で同時に数える。1つの鍵しか持たないと、その粒度に合わない攻撃 (1アカウントあたり数回しか試さないもの、送信元を分散させたもの) が必ず素通りする。逆に鍵を厳しくするほど巻き添えが増えるため、層ごとに違う上限を置く。
2. 構造: しきい値を超えたときの選択肢を、拒否の一択にしない。超えた層が1つなら追加確認、2つ以上なら拒否、という段階を作れば、攻撃者の費用は上がるが正規の利用者には回復手段が残る。固定ロックを使うと、攻撃者が他人を締め出せるようになる。
3. 実装の要点: 応答から情報が漏れる経路は、文言だけではない。処理時間、状態コード、レート制限がかかるかどうかのすべてが手掛かりになる。存在しないアカウントでも同じ経路を通し、同じ文言を返し、同じ制限を適用する。

**本番利用時の警告**

- 資格情報も漏洩リストもすべて架空の値であり、実在のものではない。攻撃の模擬はプロセス内で完結する。
- 自分が所有していない、あるいは許可を得ていないシステムに対して、同種の試行を行ってはならない。不正アクセスにあたりうる。
- この実装は固定窓の最小構成であり、時間窓の減衰も分散環境でのカウンタ共有も持たない。プロセス内カウンタのままスケールアウトすると、実効上限が台数分だけ緩む (23.27、課題23.5)。
- しきい値、チャレンジの方式、漏洩資格情報の照合先の選定は、利用者層とアクセシビリティ、そして法務の判断を伴う。本課題は法的助言ではない (13.25、23.27、30.16)。

**導線**

- 開始地点: `abuse-defense/starter/main.ts`
- 模範解答: `abuse-defense/solution/main.ts`、`abuse-defense/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch23 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
