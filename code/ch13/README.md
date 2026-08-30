# 第13章 認証と認可 — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch13 run lint
pnpm --filter @handbook/ch13 run typecheck
pnpm --filter @handbook/ch13 run test
pnpm --filter @handbook/ch13 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 13.1 課題13.1: パスワードハッシュ ― ソルト + 反復 ハッシュ自作 (★★) | `password-hash.ts` | `password-hash.solution.ts` | ★★ | 90分 | なし |
| 13.2 課題13.2: JWT 完全自作 ― HS256 と RS256 (★★★) | `jwt.ts` | `jwt.solution.ts` | ★★★ | 150分 | なし |
| 13.3 課題13.3: OAuth 2.0 Authorization Code + PKCE フロー自作 (★★★) | `oauth-pkce/starter/README.md` | `oauth-pkce/solution/pkce.ts`<br>`oauth-pkce/solution/README.md` | ★★★ | 150分 | なし |
| 13.4 課題13.4: HMAC-SHA256 Webhook 署名検証 (★★) | `webhook-signing.ts` | `webhook-signing.solution.ts` | ★★ | 90分 | なし |
| 13.5 課題13.5: TOTP (Time-based OTP) 実装 (★★) | `totp.ts` | `totp.solution.ts` | ★★ | 90分 | なし |
| 13.6 課題13.6: ポリシーエンジン ― 中央集権認可 (★★★) | `policy-engine.ts` | `policy-engine.solution.ts` | ★★★ | 150分 | なし |
| 13.7 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★) | `tenant-isolation/starter/main.ts` | `tenant-isolation/solution/main.ts`<br>`tenant-isolation/solution/report.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 13.1 課題13.1: パスワードハッシュ ― ソルト + 反復 ハッシュ自作 (★★)

**目的**: 「なぜソルトと反復が必要か」を実装で確認。

**難易度**: ★★

**推定時間**: 90分 (hashPasswordとverifyPasswordの実装30分、ソルト固定版との比較実験25分、反復数と計算時間の計測20分、改ざん入力の失敗系確認15分)

**必要サービス**: なし

**前提**

- 13.1 パスワード認証の基礎 を読み、ソルトと反復が防ぐ攻撃を確認する
- node:crypto から pbkdf2、randomBytes、timingSafeEqual を呼べる
- promisify でコールバック型APIをPromise化できる
- base64url エンコードとバイト列の扱いを理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] hashPassword(password) が反復数、ソルト、ハッシュを1つの文字列へ連結して返す
- [ ] 同じパスワードを2回ハッシュすると異なる文字列になる
- [ ] verifyPassword が正しいパスワードで true、誤りで false を返す
- [ ] 保存文字列の形式が壊れている入力に対し、例外ではなく false を返す
- [ ] 比較に crypto.timingSafeEqual を使い、長さが違う場合は比較前に false を返す
- [ ] 反復数10万での1回のハッシュ計算時間を計測して記録している

**期待出力**

- 保存文字列が pbkdf2、ダイジェスト名、反復数、base64urlソルト、base64urlハッシュ をドル記号で連結した5要素になる
- 同一パスワードの2回のハッシュ値が一致しない
- 1文字違いのパスワードでは検証が false になる
- 反復数10万のハッシュ計算が一般的なノートPCで数十から百数十ミリ秒かかる

**観察項目**

- ソルトを固定した版と乱数版で、同じパスワードのハッシュ値が一致するかを比べ、事前計算表が効く条件を確認する
- 反復数を1万、10万、100万と変え、計算時間がほぼ線形に伸びることを計測する
- timingSafeEqual を通常の等値比較へ置き換え、先頭が違う場合と末尾だけ違う場合の比較時間差を測る
- 保存文字列に反復数を含めることで、後から反復数を引き上げても既存ユーザーが検証できることを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `password hashing uses random salt and verifies safely` がパスすることを確認する
2. 小さなスクリプトを `pnpm --filter @handbook/ch13 exec tsx スクリプト名` で実行し、hashPassword の戻り値がドル記号で4回区切られていることを確認する
3. 保存文字列の末尾1文字を書き換えて verifyPassword に渡し、例外で落ちずに false が返ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 保存するのはハッシュだけではない。検証時に同じ計算を再現するために必要な情報 (アルゴリズム、反復数、ソルト) を一緒に持たせる、という発想から保存形式を決める。
2. 構造: promisify した pbkdf2 に password、salt、iterations、keyLength、digest を渡す。randomBytes(16) のソルトと結果を base64url へ変換し、ドル記号で連結する。検証は分解して同じパラメータで再計算する。
3. 実装の要点: timingSafeEqual は長さが違うと例外を投げるため、比較前に長さ一致を確認する。反復数は保存文字列から来るので、整数チェックと上下限の検証を入れないと、改ざんされた保存値で反復数を極端に下げられる。

**本番利用時の警告**

- この自作PBKDF2実装を本番のパスワード保存に使わない。PBKDF2はGPUによる並列化に弱く、現在の推奨はArgon2idやbcrypt、scryptといったメモリ困難な関数である。
- パラメータをユーザー由来の保存文字列から読む設計は、DBへ書き込める攻撃者に反復数を下げられる余地を残す。本番では最小反復数をコード側で強制し、下回る保存値は再ハッシュ対象にする。
- この演習にはアカウントロック、レート制限、漏洩パスワードリストとの照合が無い。これらが無いと総当たりとクレデンシャルスタッフィングは防げない。

**導線**

- 開始地点: `password-hash.ts`
- 模範解答: `password-hash.solution.ts`

### 13.2 課題13.2: JWT 完全自作 ― HS256 と RS256 (★★★)

**目的**: JWT が「Base64URL エンコードされた3つの JSON + 署名」であることを実装で確認。

**難易度**: ★★★

**推定時間**: 150分 (sign/decode/verifyの実装50分、RS256の鍵生成と検証40分、alg:noneと改ざん・期限切れの攻撃デモ40分、境界条件の確認20分)

**必要サービス**: なし

**前提**

- 13.4 JWT (JSON Web Token) の構造と注意点 を読み、header、payload、signature の3分割を確認する
- 13.23 JWS / JWE / JWA ― JWT の構成要素 を読み、署名と暗号化が別物であることを把握する
- node:crypto の createHmac、createSign、createVerify、generateKeyPairSync を使える
- base64url と base64 の違い (記号2文字とパディング無し) を説明できる

**完成条件 (自己採点用チェックリスト)**

- [ ] signJwt が HS256 でヘッダ、ペイロード、署名をドットで連結した文字列を返す
- [ ] RS256 でRSA秘密鍵により署名し、対応する公開鍵で検証できる
- [ ] verifyJwt が許可アルゴリズム一覧を引数で受け取り、一覧外の alg を拒否する
- [ ] alg が none のトークンが Unsupported algorithm で拒否される
- [ ] exp を過ぎたトークンが Token expired で拒否され、nbf 前のトークンも拒否される
- [ ] ペイロードを1文字改ざんしたトークンが Invalid signature で拒否される

**期待出力**

- HS256トークンをドットで分割すると3要素になり、先頭要素をbase64urlデコードすると alg と typ を持つJSONになる
- 検証成功時にペイロードのオブジェクトが返る
- alg none のトークンは署名部が空で末尾がドットになる
- 失敗系の例外メッセージが Unsupported algorithm、Algorithm is not allowed、Invalid signature、Token expired のいずれかになる

**観察項目**

- 生成したトークンのペイロード部をbase64urlデコードし、暗号化されておらず誰でも読めることを確認する
- alg を none に書き換えたトークンと、RS256をHS256と偽ったトークンの両方を検証へ通し、どこで弾かれるかを追う
- 署名比較を timingSafeEqual から通常の等値比較へ変えても機能テストは通ることを確認し、テストで守れない性質があることを見る
- exp を現在時刻ちょうどに設定し、境界の比較演算子でどちらへ転ぶかを確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `JWT supports HS256 and RS256 and rejects none/expired` がパスすることを確認する
2. alg none のトークンを生成して verifyJwt へ渡し、例外が投げられることを確認する (検証を通ってしまえば不合格)
3. 生成したHS256トークンのペイロード部を1文字書き換えて verifyJwt へ渡し、Invalid signature になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: JWTは暗号ではなく、base64urlで連結した2つのJSONにその連結文字列への署名を付けたもの。まず署名なしで3部構成を組み立て、後から署名だけを差し替えられる形にする。
2. 構造: 署名対象はヘッダとペイロードをドットで繋いだ文字列。HS256は createHmac('sha256', key) の digest、RS256は createSign('RSA-SHA256') の sign を使い、検証は同じ入力から再計算して比較する。
3. 実装の要点: 検証関数は必ず呼び出し側が許可したアルゴリズム一覧を引数で受け取り、トークンの alg を信用して分岐しないこと。alg に従って鍵の使い方を決めると、HS256を名乗って公開鍵を共有鍵として使わせる鍵取り違え攻撃が成立する。

**本番利用時の警告**

- この自作JWT検証を本番へ持ち込まない。kid による鍵選択、鍵ローテーション、JWKS取得、iss と aud の検証、時刻ずれの許容を持たないため、別発行者のトークンや別サービス向けのトークンをそのまま受け入れてしまう。
- JWTは署名されているだけで暗号化されていない。ペイロードへ機微情報を入れると、Cookieやアクセスログから誰でも読める。
- 失効の仕組みが無いため、ログアウトや権限剥奪をしても exp までトークンは有効なままになる。即時失効が要るなら jti のブロックリストか、短命トークンとリフレッシュトークンの組み合わせが必要になる。

**導線**

- 開始地点: `jwt.ts`
- 模範解答: `jwt.solution.ts`

### 13.3 課題13.3: OAuth 2.0 Authorization Code + PKCE フロー自作 (★★★)

**目的**: OAuth プロバイダ (IdP) とクライアントの両方を実装し、PKCE の役割を理解する。

**難易度**: ★★★

**推定時間**: 150分 (IdPの認可・トークン交換の実装60分、PKCE計算とstate照合を含むクライアント実装40分、コード再利用・redirect不一致・期限切れの検証50分)

**必要サービス**: なし

**前提**

- 13.7 OAuth 2.0 ― 第三者認可 を読み、認可コードフローの登場人物と往復を確認する
- 13.20 PKCE ― OAuth/OIDC のクライアント側保護 を読み、code_verifier と code_challenge の関係を把握する
- node:crypto の randomBytes と createHash('sha256') で base64url 文字列を作れる
- URL オブジェクトでクエリパラメータを組み立て・読み取りできる

**完成条件 (自己採点用チェックリスト)**

- [ ] 登録済み redirect URI と完全一致しない要求を Invalid redirect_uri で拒否する
- [ ] 認可要求が短寿命 (60秒) で一度きりの認可コードを発行し、redirect URI に code と state を付けたURLを返す
- [ ] トークン交換が code_verifier のSHA-256と保存済み code_challenge の一致を検証し、不一致を PKCE verification failed で拒否する
- [ ] 同じコードを2回交換しようとすると Invalid or expired authorization code で拒否される
- [ ] クライアント側が callback の state を自分が生成した値と照合し、不一致で中断する
- [ ] 交換に成功するとアクセストークンと Bearer が返り、introspect で subject を引ける

**期待出力**

- クライアントフローの戻り値がアクセストークンと tokenType: Bearer になる
- introspect が有効トークンで active: true と subject を返し、未知のトークンでは active: false を返す
- code_challenge が43文字から128文字のbase64url文字列で、形式外は Invalid PKCE challenge で拒否される
- コード再利用、redirect URI 不一致、client_id 不一致はいずれも例外になる

**観察項目**

- 認可要求のパラメータに code_verifier そのものが含まれないことを確認し、コードを盗んだだけでは交換できない理由を説明する
- code_challenge を平文方式にした場合、傍受した challenge をそのまま verifier として送れることを再現する
- コードの有効期限を過去に設定し、期限切れコードが拒否されることを確認する
- state を照合しない版を作り、攻撃者が用意したコードを被害者のセッションへ結び付けられることを追う

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `PKCE binds code to verifier, client, redirect, and one-time use` がパスすることを確認する
2. 誤った codeVerifier で交換を呼び、PKCE verification failed が投げられることを確認する
3. 同じ code で交換を2回呼び、2回目が Invalid or expired authorization code になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 認可サーバの状態は3つのMapで表せる。登録済みクライアント、発行済みコード、発行済みトークン。コードには誰に、どのredirectへ、どのchallengeで出したかを一緒に保存するのが要点。
2. 構造: code_verifier は randomBytes(32) の base64url、code_challenge は createHash('sha256') の digest を base64url にしたもの。交換時は受け取った verifier から challenge を再計算して保存済みの値と比較する。
3. 実装の要点: コードレコードに used フラグと有効期限を必ず持たせ、交換成功時に used を立てる。忘れると盗まれたコードが何度でも交換でき、PKCEを入れた意味が薄れる。

**本番利用時の警告**

- この教材IdPはユーザー認証そのもの (ログイン画面とパスワード検証) を持たず、subject を呼び出し側が自由に指定できる。誰にでもなりすませるため、隔離した localhost 以外で起動しない。
- アクセストークンをメモリ上のMapへ平文で保持し、失効、スコープ、有効期限、監査ログを持たない。本番の認可サーバは既存のOAuth/OIDC製品を使い、自作しない。
- redirect URI の検証を前方一致や部分一致へ緩めると、攻撃者が制御するパスへ認可コードを送らせるオープンリダイレクトになる。完全一致以外は採用しない。

**導線**

- 開始地点: `oauth-pkce/starter/README.md`
- 模範解答: `oauth-pkce/solution/pkce.ts`、`oauth-pkce/solution/README.md`

### 13.4 課題13.4: HMAC-SHA256 Webhook 署名検証 (★★)

**目的**: Stripe / GitHub の Webhook 署名検証ロジックを自作。

**難易度**: ★★

**推定時間**: 90分 (署名生成と検証の実装35分、リプレイ検出の追加25分、時刻ずれと改ざんの失敗系テスト30分)

**必要サービス**: なし

**前提**

- 13.14 HMAC-SHA256 ― 共有秘密鍵による署名 を読み、HMACが満たす性質を確認する
- 13.6 CSRF 対策 を読み、リプレイと意図しない再送が別問題であることを把握する
- node:crypto の createHmac と timingSafeEqual を使える
- UNIX時刻の秒表現で時刻差を計算できる

**完成条件 (自己採点用チェックリスト)**

- [ ] 署名生成が `v1,t=秒,sig=base64url` 形式の1ヘッダを返す
- [ ] 署名対象がタイムスタンプと本文の連結であり、タイムスタンプを含まない署名では検証が失敗する
- [ ] 現在時刻との差が許容秒数 (デフォルト300秒) を超えるヘッダを Webhook timestamp outside tolerance で拒否する
- [ ] 署名不一致を Invalid webhook signature で拒否し、比較に timingSafeEqual を使う
- [ ] 同一のタイムスタンプと署名の組を2回目に受け取ると Webhook replay detected で拒否する
- [ ] ヘッダ形式が壊れている場合に Malformed signature header を投げる

**期待出力**

- 正しいヘッダと本文の組で検証関数が true を返す
- 同じヘッダを同じリプレイ検出器で2回検証すると2回目が例外になる
- 301秒ずらした時刻で検証すると許容範囲外の例外になる
- ヘッダ値がバージョン、t、sig の3フィールドで構成される

**観察項目**

- 本文の1バイトだけを変えて検証し、HMACが本文全体に依存することを確認する
- タイムスタンプを署名対象から外すと、古い正当なリクエストをそのまま再送できることを再現する
- リプレイ検出器の期限切れ掃除を止め、記録が無限に増えてメモリが伸びることを確認する
- 許容秒数を極端に短くし、送受信間の時計ずれで正当な配信が落ちる境界を測る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `webhook signature checks age, constant-time signature, and replay` がパスすることを確認する
2. 検証関数へ現在時刻としてタイムスタンプ+301秒を渡し、tolerance を含むメッセージの例外になることを確認する
3. 署名の末尾1文字を書き換えたヘッダで検証し、Invalid webhook signature が投げられることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 署名対象を本文だけにすると、正当なリクエストをそのまま撃ち返すリプレイを防げない。何を署名対象に含めれば再送を見分けられるかから設計する。
2. 構造: createHmac('sha256', secret) にタイムスタンプとドットと本文を連結した文字列を update し、digest を base64url にする。ヘッダはカンマ区切りで組み立て、検証側はカンマと等号で分解する。
3. 実装の要点: 比較は必ず Buffer 化して長さ一致を確認してから timingSafeEqual を使う。文字列の等値比較だと短絡評価で先頭一致長が漏れ、署名を1バイトずつ推測される余地が残る。

**本番利用時の警告**

- リプレイ検出はプロセス内のMapであり、再起動と水平スケールで記録が消える。複数インスタンスで受ける本番では、共有ストアへイベントIDを記録する必要がある。
- 受信ボディをJSONパースして再シリアライズしてから検証すると、空白やキー順の差で検証が壊れる。必ず受け取った生のバイト列に対して検証する。
- 秘密鍵をコードやログへ残さない。ヘッダと本文をそのままログ出力すると、署名と本文の組が漏れて解析材料を与える。

**導線**

- 開始地点: `webhook-signing.ts`
- 模範解答: `webhook-signing.solution.ts`

### 13.5 課題13.5: TOTP (Time-based OTP) 実装 (★★)

**目的**: Google Authenticator が動く仕組みを RFC 6238 から実装する。

**難易度**: ★★

**推定時間**: 90分 (Base32の実装と往復テスト30分、HOTP/TOTP計算の実装30分、RFCベクタ照合とウィンドウ検証20分、otpauth URLと認証アプリでの確認10分)

**必要サービス**: なし

**前提**

- 13.21 MFA と TOTP ― 多要素認証の実装 を読み、HOTPからTOTPへの拡張を確認する
- 13.14 HMAC-SHA256 ― 共有秘密鍵による署名 を読み、HMACの入力と出力を把握する
- Base32のアルファベットと8バイトのビッグエンディアン整数を扱える
- node:crypto の createHmac と randomBytes を使える

**完成条件 (自己採点用チェックリスト)**

- [ ] Base32のエンコードとデコードが往復して元のバイト列へ戻る
- [ ] generateSecret() が Base32 文字列を返す
- [ ] generateTotp(secret) が30秒ごとに変わる6桁の数字文字列を返し、先頭が0でも6桁を保つ
- [ ] RFC 6238 のテストベクタ (SHA-1、秘密鍵 12345678901234567890、時刻59秒、8桁) で 94287082 が得られる
- [ ] verifyTotp が前後1ウィンドウを許容し、比較に timingSafeEqual を使う
- [ ] otpauth URL に secret、issuer、period、digits のクエリが含まれる

**期待出力**

- 6桁のコードが文字列として返り、30秒境界をまたぐと値が変わる
- RFC 6238 のベクタで8桁 94287082 が一致する
- 時刻を30秒ずらした検証が window=1 で true、90秒ずらすと false になる
- otpauth URL が otpauth://totp/ で始まる

**観察項目**

- 同じ秘密鍵で連続してコードを生成し、30秒の境界をまたいだ瞬間だけ値が変わることを確認する
- window を0にして、時計が数秒ずれた端末のコードが弾かれることを再現する
- 動的切り捨てのオフセット値を出力し、毎回異なる位置から4バイトを読んでいることを確認する
- 生成した otpauth URL をQRコードにして認証アプリへ登録し、アプリの表示と自作コードが一致することを見る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `TOTP matches RFC 6238 SHA1 vector and window verification` がパスすることを確認する
2. 時刻59秒・8桁の条件で生成したコードが 94287082 になれば、Base32デコードからHOTPまでの経路は合格
3. 現在時刻から90秒後の時刻で window=1 の検証を行い、false になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: TOTPはHOTPのカウンタを時刻を30で割った値へ置き換えただけ。まず固定カウンタでHMACから6桁を取り出す部分を作り、その後に時刻からカウンタを求める。
2. 構造: カウンタは8バイトのバッファへビッグエンディアンで書く。HMACのダイジェスト末尾バイトの下位4ビットをオフセットとし、そこから4バイトを読んで最上位ビットを落とし、桁数に応じた10のべき乗で剰余を取ってゼロ埋めする。
3. 実装の要点: 秘密鍵をBase32文字列のまま createHmac へ渡してはいけない。必ずデコードしたバイト列を鍵にする。ここを間違えると自作コード同士では一貫して動くのに、認証アプリの表示と一致しない。

**本番利用時の警告**

- TOTPの秘密鍵は共有秘密であり、サーバ側に平文で保管すると漏洩時に全ユーザーの第2要素が即座に突破される。本番では鍵管理サービスや暗号化保管を使う。
- この実装は使用済みコードの記録を持たないため、30秒以内なら同じコードを何度でも使える。フィッシングで抜かれたコードのリプレイを防ぐには、成功したカウンタをユーザーごとに記録して再利用を拒否する必要がある。
- 検証回数の制限が無いと6桁は総当たりで突破されうる。ログイン試行と同様にレート制限とロックアウトを併用する。

**導線**

- 開始地点: `totp.ts`
- 模範解答: `totp.solution.ts`

### 13.6 課題13.6: ポリシーエンジン ― 中央集権認可 (★★★)

**目的**: 13.11 で扱った「認可ロジックの中央集権化」を実装する。

**難易度**: ★★★

**推定時間**: 150分 (ポリシー定義とcanの実装50分、ワイルドカードとロール照合40分、deny優先とデフォルト拒否の検証40分、テストケース作成20分)

**必要サービス**: なし

**前提**

- 13.11 認可ロジックを「中央集権」にする を読み、判断点を1か所へ集める狙いを確認する
- 13.10 認可モデル ― RBAC、ABAC、ReBAC を読み、ロールと属性による判定の違いを把握する
- TypeScript のジェネリクスと述語関数を書ける
- 課題13.2 または 課題13.3 で得た subject (誰か) の情報を入力として渡せる

**完成条件 (自己採点用チェックリスト)**

- [ ] define で effect、action、任意の roles、任意の condition を持つポリシーを登録できる
- [ ] can(subject, action, resource) が真偽値を返し、一致するポリシーが0件ならデフォルト拒否で false になる
- [ ] アスタリスク単独と接頭辞付きのワイルドカードがアクション一致に使える
- [ ] roles を指定したポリシーが、subject の role または roles に含まれるときだけ一致する
- [ ] condition による属性判定 (自分の投稿かどうかなど) が動く
- [ ] deny が allow より優先され、両方一致する場合は false になる

**期待出力**

- 自分の投稿への post.edit が true、他人の投稿では false になる
- role が admin の subject はワイルドカードのポリシーにより user.delete が true になる
- 機密リソースに対する deny 条件に該当すると、admin でも false になる
- 未登録アクションはデフォルト拒否で false になる

**観察項目**

- ポリシーの登録順を入れ替えても結果が変わらないことを確認し、順序非依存の設計であることを見る
- deny優先を外して allow優先にすると、admin が機密リソースへ到達できてしまうことを再現する
- デフォルトを allow に変え、書き忘れたアクションが素通りすることを確認する
- condition の中で例外が起きた場合の挙動を確認し、判定不能時に拒否へ倒れるかを検証する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `policy engine combines RBAC, ABAC, wildcard, and deny precedence` がパスすることを確認する
2. 未定義のアクション (例 post.delete) を can へ渡し、例外ではなく false が返ることを確認する
3. deny ポリシーと allow ポリシーの両方に一致する入力を作り、必ず false になることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 判定を「一致するポリシーを集める」と「集めた中に deny があれば拒否、なければ allow の有無を見る」の2段に分けると、登録順に依存しない実装になる。
2. 構造: アクション一致はアスタリスク単独、接頭辞付き、完全一致の3パターンを判定する小さな関数へ切り出す。subject のロールは role と roles を1つの Set にまとめてから照合する。
3. 実装の要点: デフォルトは必ず拒否にすること。最後を「allow が1件以上あるか」で判定すれば一致0件で自動的に false になる。ここを「deny が無いか」で書くと、ポリシー未定義のアクションが全許可になる。

**本番利用時の警告**

- このエンジンはテナント境界や所有関係をデータ側から取得せず、渡された resource を信じて判定する。呼び出し側がIDだけでオブジェクトを組み立てると、他テナントのリソースを自分のものとして判定させられる。
- 監査ログ、ポリシーのバージョン管理、判定結果のキャッシュ無効化を持たないため、権限剥奪が即座に反映されない構成になりやすい。本番では判定の入力と結果を記録し、いつ誰が何を許可されたか追跡できるようにする。
- condition に任意の関数を書けるため、外部入力からポリシーを組み立てる設計にすると任意コード実行に近い危険がある。ポリシーはコードとしてレビューし、実行時に外部から注入しない。

**導線**

- 開始地点: `policy-engine.ts`
- 模範解答: `policy-engine.solution.ts`

### 13.7 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★)

**目的**: 主キー直接参照・全文検索・親の付け替え・キャッシュキーの4経路でテナント境界が破れることを実際に再現し、Row-Level Security に相当するポリシー層を通すと同じ手順で再現しなくなることを確かめる。

**難易度**: ★★★

**推定時間**: 150分 (4経路の probe 実装に40分、ポリシー層とガード付きAPIの実装に50分、所有者バイパスと接続使い回しの再現に30分、観察項目の書き換え比較に30分。)

**必要サービス**: なし

**前提**

- 13.24 マルチテナントの認可とテナント境界 を読み、境界が破れる典型経路の表を手元に用意する
- 13.11 認可ロジックを「中央集権」にする を読み、判断点を1か所へ集める狙いを確認する
- 14.20 テナント分離モデルと Row-Level Security を読み、USING と WITH CHECK の役割の違いを押さえる
- 14.19 Connection Pooler ― DB接続管理の必須インフラ を読み、SET と SET LOCAL の差が事故になる理由を確認する
- `code/ch13` で pnpm install 済みで、`pnpm --filter @handbook/ch13 run typecheck` が通る状態にする

**完成条件 (自己採点用チェックリスト)**

- [ ] `probeLeaks` が L1 から L4 の4経路を試し、漏洩の有無を API の戻り値だけから判定する
- [ ] 境界の抜けた `createUnsafeApi` に対して 4件すべてが leaked=true になる
- [ ] `tenantPolicy` が using と withCheck の両方を持ち、tenantId が未設定のセッションを通さない
- [ ] `PolicyEngine` が force=false のとき所有者セッションを素通りさせ、force=true のとき素通りさせない
- [ ] `createGuardedApi` を通した同じ `probeLeaks` が 4件すべて leaked=false になる
- [ ] `probePoolReset` が、SET LOCAL 相当なしのときだけ前テナントの文脈を観測する
- [ ] `pnpm --filter @handbook/ch13 exec tsx tenant-isolation/starter/report.ts` が6行の要約を出力する

**期待出力**

- 1行目に `unguarded api: 4/4 leaks reproduced` が出る
- L1 の詳細が `read tsk_a1 of ten_a` になり、他テナントのタスクを読めたことが分かる
- L3 の詳細が、境界の抜けた実装では `moved into prj_a1 of ten_a`、ポリシー層では `NotFoundError` になる
- `guarded api: 0/4 leaks reproduced` に続く4行がすべて leaked=false になる
- 最後の2行が `owner bypass: without force=true / with force=false` と `session pool: without SET LOCAL=true / with SET LOCAL=false` になる

**観察項目**

- `createGuardedApi` の listTasksCached のキーからセッションのテナント識別子を外し、L4 だけが再び leaked=true になることを確認する
- moveTask から移動先プロジェクトの visible 検査だけを外すと L3 は assertWritable で止まり、assertWritable も外すと L3 だけが leaked=true に戻ることを確認する
- `PolicyEngine` を force=false で作り、owner=true のセッションで probeLeaks を実行して、ポリシーを書いても4件すべてが leaked=true に戻ることを確認する
- `withPooledSession` の setLocal を false にしたまま、貸し出し順を B から A へ入れ替えて、観測されるテナントが変わることを確認する
- searchIndex のキーをテナント込みに変える案と、索引はそのままでポリシー層で絞る案を比べ、返る件数と実装量の差を見る

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch13 exec tsx tenant-isolation/solution/report.ts` を実行し、6行の要約が出力されることを確認する
2. `pnpm --filter @handbook/ch13 run test` を実行し、tenant boundary leaks・WITH CHECK・owner bypass の3つのテストが pass することを確認する
3. 自分の `tenant-isolation/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
4. `pnpm --filter @handbook/ch13 run typecheck` が 0 エラーで終わることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に probeLeaks だけを書き、境界の抜けた実装で 4/4 が出る状態を作る。塞ぐ側から書き始めると、何を検出できていないのかが分からなくなる。
2. 構造: ポリシーは行の述語2つ、エンジンは述語を配列と単一行へ適用する2メソッド、APIはエンジンを呼ぶだけ、という3層に分ける。API側に条件式を書き始めたら、それはポリシーへ移すべき判断である。
3. 実装の要点: probeLeaks の各経路で createStore() を呼び直す。L3 はストアを書き換えるため、同じストアを使い回すと後続の経路の結果が変わる。moveTask では移動先プロジェクトを visible で取り出し、移動後の行を assertWritable へ通す。visible だけでは、他テナントへ書き出す経路が残る。

**本番利用時の警告**

- このポリシー層はアプリケーションのプロセス内にあるため、同じデータベースへ別経路で接続されれば無力である。本番では PostgreSQL の Row-Level Security のように、データストア側で宣言する必要がある。
- SessionPool は単一スレッドの逐次実行を前提にしており、実際のコネクションプールが持つ待ち行列、タイムアウト、切断検知を持たない。接続の使い回しによる文脈残留の再現だけを目的としている。
- 認可の判定はテナント境界だけを扱い、ロールによる操作権限を含めていない。実際の設計では 13.10 の認可モデルと組み合わせる必要がある。

**導線**

- 開始地点: `tenant-isolation/starter/main.ts`
- 模範解答: `tenant-isolation/solution/main.ts`、`tenant-isolation/solution/report.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch13 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
