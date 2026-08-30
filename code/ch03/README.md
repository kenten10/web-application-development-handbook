# 第3章 URL・DNS・TLS — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch03 run lint
pnpm --filter @handbook/ch03 run typecheck
pnpm --filter @handbook/ch03 run test
pnpm --filter @handbook/ch03 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 3.1 課題3.1: URLパーサを自作 (★) | `url-parser.ts` | `url-parser.solution.ts` | ★ | 45分 | なし |
| 3.2 課題3.2: DNS リゾルバの観察ツール (★★) | `dns-resolver.ts` | `dns-resolver.solution.ts` | ★★ | 90分 | なし |
| 3.3 課題3.3: 自己署名証明書でHTTPSサーバを立てる (★★) | `cert-gen.sh`<br>`starter.md` | `cert-gen.solution.sh`<br>`https-server.solution.ts`<br>`solution.md` | ★★ | 90分 | OpenSSL/TLS |
| 3.4 課題3.4: TLS handshake を可視化 (★★★) | `tls-trace.md` | `tls-trace.solution.md` | ★★★ | 150分 | OpenSSL/TLS |
| 3.5 課題3.5: 「URLを入力してから画面表示まで」のすべてを観察 (★★★) | `url-trace.ts` | `url-trace.solution.ts` | ★★★ | 150分 | なし |

## 課題詳細

### 3.1 課題3.1: URLパーサを自作 (★)

**目的**: URL の各構成要素を正規表現や状態機械で解析できることを確認する。

**難易度**: ★

**推定時間**: 45分 (分解ロジックの実装に20分、テストケース5件の通しに15分、resolveUrlと異常系に10分)

**必要サービス**: なし

**前提**

- 3.1 URI/URL/URN を読み、scheme・authority・path・query・fragment を分ける区切り文字を説明できる
- TypeScript で正規表現と文字列の切り出しを扱える
- Node.js 内蔵の URL クラスを使わずに実装する、という制約を理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] `parseUrl(input: string): ParsedUrl` が scheme / userInfo / host / port / path / query / fragment を返す
- [ ] `https://user:pass@www.example.com:8080/path/to/resource?key=value&x=1#section` を全要素へ分解でき、port が数値の 8080 になる
- [ ] `mailto:alice@example.com`、`/path/only`、`//cdn.example.com/asset.js` の3形式で scheme と host の有無が正しく分かれる
- [ ] `?a=1&a=2` のように同じキーが複数回現れるクエリを、キーごとの配列として保持する
- [ ] 空文字列や範囲外のポート番号など不正入力で例外を投げる
- [ ] `resolveUrl(base, ref)` が `../` を含む相対参照を正規化して絶対URLを返す

**期待出力**

- `parseUrl('https://user:pass@www.example.com:8080/a?x=1#top')` が scheme='https'、userInfo='user:pass'、host='www.example.com'、port=8080、fragment='top' を持つオブジェクトを返す
- `parseUrl('https://example.com/path?a=1&a=2')` の query でキー `a` に `['1','2']` の2要素が入る
- `parseUrl('//cdn.example.com/asset.js')` は scheme が null で host が `cdn.example.com` になる
- `resolveUrl('https://example.com/a/b/page.html', '../asset.js')` が `https://example.com/a/asset.js` を返す
- `https://example.com:70000/` のような範囲外ポートでは undefined を返さず例外メッセージが出る

**観察項目**

- `curl -v 'https://example.com/a#frag'` のリクエストラインを見て、フラグメントがサーバへ送られないことを確認する
- `http://[::1]:8080/` を入力し、角括弧内のコロンをポート区切りと誤認しない実装になっているか確認する
- `+` を含むクエリ値やパーセントエンコード済みのパスでデコード結果が変わることを見て、どこまでを自作パーサの責務にするか決める
- 自作結果と `new URL(input)` の結果を並べて差分を出し、末尾スラッシュ・空パス・大文字schemeなど解釈が分かれる箇所を特定する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch03 run test` を実行し、`URL parser handles authority, duplicate query keys, and fragment` と `URL resolver normalizes relative segments` の2件がパスすることを確認する
2. `tsx code/ch03/url-parser.solution.ts 'https://user:pass@www.example.com:8080/path?a=1&a=2#s'` を実行し、7要素すべてが埋まったオブジェクトが表示されれば期待出力を確認できる
3. 本文のテストケース5件 (通常URL、mailto、パスのみ、プロトコル相対、同一キー重複) を自分の実装へ順に入力し、例外なく分解できれば合格とする

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 後ろから削ると分岐が減る。まず `#` でフラグメントを切り、次に `?` でクエリを切り、残った文字列に対して scheme と authority を判定する。
2. 構造: authority は `//` で始まる場合だけ存在する。`@` の最後の出現で userInfo と host:port を分け、host が `[` で始まるなら IPv6 として `]` まで読む。クエリは `&` で分割し `Map<string, string[]>` へ push する。
3. 実装の要点: ポートは `/^\d+$/` の検査と 1〜65535 の範囲検査を両方行う。`mailto:` のように scheme の後が `/` で始まらない場合は authority を持たない不透明部として path と分けて保持すると、相対解決の判定が楽になる。

**本番利用時の警告**

- この自作パーサはパーセントエンコードの正規化、IDNのPunycode変換、制御文字の除去を行わない。認可判定やリダイレクト先の検証に流用すると、正規化差分を突いたオープンリダイレクトやパストラバーサルを許す
- userInfo にパスワードを含むURLは、ログやRefererに残ると資格情報が漏れる。解析結果をそのままログへ出力しない

**導線**

- 開始地点: `url-parser.ts`
- 模範解答: `url-parser.solution.ts`

### 3.2 課題3.2: DNS リゾルバの観察ツール (★★)

**目的**: DNS 解決の階層構造を体感する。

**難易度**: ★★

**推定時間**: 90分 (レコード5種の取得実装に35分、TTLと異常系の処理に25分、出力整形に15分、digとの突き合わせに15分)

**必要サービス**: なし

**前提**

- 3.2 DNS ― 名前を住所に変える を読み、スタブリゾルバ・再帰リゾルバ・権威サーバの役割を区別できる
- `node:dns/promises` の Resolver クラスで resolve4 などを呼べる
- 比較用に dig または nslookup が PATH にある

**完成条件 (自己採点用チェックリスト)**

- [ ] ドメイン名を引数に取り、A / AAAA / MX / TXT / NS の5種類を1回の実行でまとめて表示する
- [ ] A と AAAA について TTL を秒数で表示している (`{ ttl: true }` を指定している)
- [ ] レコードが存在しない場合 (ENODATA や ENOTFOUND) に例外で落ちず、空の結果として扱う
- [ ] 名前解決に要した時間をミリ秒で表示している
- [ ] 出力に、使用したリゾルバのアドレスと、キャッシュ由来か権威由来かを node:dns からは判別できない旨の注記を含める

**期待出力**

- 1行目が `Resolving example.com...`、2行目が `Resolver: ` に続くリゾルバのIPアドレスになる
- `A:      23.215.0.136  (TTL: 3600)` のように、種別・値・TTLが1行ずつ並ぶ
- MXが未設定のドメインではMX行が0件になり、エラー終了しない
- 末尾に `Time:   NN.N ms` と `Source: recursive resolver response` で始まる注記の2行が出る

**観察項目**

- 同じドメインを続けて2回実行し、2回目の Time が短くなることからキャッシュの効きを推測する
- `DNS_SERVER=1.1.1.1` のようにリゾルバを変えて実行し、返るAレコードや順序が変わること (CDNの応答分散) を確認する
- `dig example.com +noall +answer` のTTLと自分のツールのTTLを比べ、キャッシュ経過に伴ってTTLが減っていく様子を確認する
- NSで得た権威サーバへ直接問い合わせるとTTLが常に初期値で返ることを確認し、途中のキャッシュがTTLを削っていると理解する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch03 run test` を実行し、`DNS formatter includes TTL and source limitation` がパスすることを確認する
2. `tsx code/ch03/dns-resolver.solution.ts example.com` を実行し、A行・NS行・Time行がそろって出れば実行環境は正常である
3. MXを持たないドメインと持つドメインの両方で実行し、前者が例外なく0件で終われば異常系の扱いが合格である
4. `dig example.com A +noall +answer` の結果と自分のツールのA行を突き合わせ、アドレスの集合が一致することを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 5種類を順番に await すると総時間が種別数だけ伸びる。まず1種類で動かしてから `Promise.all` で並列化する。
2. 構造: `new Resolver()` を作り、必要なら `resolver.setServers([...])` を呼ぶ。A と AAAA は `resolve4(domain, { ttl: true })` の形でTTL付き配列を得られるが、MX / TXT / NS はTTLを返さない点に注意する。
3. 実装の要点: `ENODATA` `ENOTFOUND` `ESERVFAIL` `EREFUSED` は「そのレコードが無い」ことを示す正常系として空配列へ落とし、それ以外のエラーだけ再送出する。catch で全部握り潰すと設定ミスに気づけなくなる。

**本番利用時の警告**

- node:dns の高水準APIは応答がキャッシュ由来か権威由来かを返さない。出力に「権威回答」と書くと誤った診断根拠になるため、判別できないことを明示する
- 大量のドメインを短時間に問い合わせると、社内リゾルバやパブリックDNSでレート制限やブロックの対象になる。ループで回す場合は間隔を空ける

**導線**

- 開始地点: `dns-resolver.ts`
- 模範解答: `dns-resolver.solution.ts`

### 3.3 課題3.3: 自己署名証明書でHTTPSサーバを立てる (★★)

**目的**: TLS の構成要素 (秘密鍵、証明書、CA) を実際に作り、HTTPSサーバを動かす。

**難易度**: ★★

**推定時間**: 90分 (証明書生成とSANの調整に25分、HTTPSサーバ起動と接続確認に20分、-kあり/なしの比較と原因の記述に25分、s_clientでのハンドシェイク観察に20分)

**必要サービス**: OpenSSL/TLS

**前提**

- 3.3 TLS/SSL ― 通信を暗号化する と 3.4 実装例: 自己署名証明書でHTTPSサーバを立てる を読み、証明書チェーンと信頼ストアの関係を説明できる
- `openssl version` が 3.x 系を返す環境がある
- `node:https` の createServer に key と cert を渡してサーバを起動できる

**完成条件 (自己採点用チェックリスト)**

- [ ] `openssl req -x509` で秘密鍵と自己署名証明書を生成し、subjectAltName に `DNS:localhost` と `IP:127.0.0.1` を含めている
- [ ] 生成した秘密鍵のパーミッションを 600 に絞っている
- [ ] HTTPSサーバが 3443 番で起動し、`curl -k https://localhost:3443/` がJSONを返す
- [ ] `-k` なしのcurlが証明書検証エラーで失敗することを確認し、その理由を書いている
- [ ] `curl --cacert <証明書>` を使い、検証を無効にせずに成功させる方法を確認している
- [ ] `openssl s_client -connect localhost:3443` でハンドシェイクのログと証明書のSubject/SANを確認している

**期待出力**

- `openssl x509 -in <cert> -noout -subject -issuer -dates -ext subjectAltName` の subject と issuer がどちらも `CN=localhost` になる (自己署名の証拠)
- サーバ起動時に `HTTPS server: https://localhost:3443` が出力される
- `curl -k https://localhost:3443/` が `{"message":"Hello over TLS","protocol":"https"}` を返す
- `-k` なしのcurlは `SSL certificate problem: self-signed certificate` を含むエラーで終了する
- `openssl s_client` の出力に `Verify return code: 18 (self signed certificate)` と選択された Cipher が現れる

**観察項目**

- subjectAltName から `DNS:localhost` を外して再生成し、ブラウザ (Chrome / Edge / Safari) で開くと `ERR_CERT_COMMON_NAME_INVALID` になることを確認する。ブラウザは2017年以降 CN を見ない。一方 curl や Node.js は、ビルドに使った TLS ライブラリによっては CN へフォールバックして接続に成功することがあるため、CLI だけで確かめると逆の結論になる
- `openssl s_client` の Protocol 行と Cipher 行を見て、サーバ側の `minVersion` 指定がどのバージョンを許すかを確認する
- `https://127.0.0.1:3443/` と `https://localhost:3443/` の両方を叩き、SANのDNS名とIPのどちらに一致したかで結果が変わることを確認する
- 証明書の notAfter を過ぎた状態で接続し、期限切れが検証エラーとして現れることを確認する

**テスト方法 (自己採点手順)**

1. `bash code/ch03/cert-gen.solution.sh certs` を実行し、`certs/localhost-key.pem` と `certs/localhost-cert.pem` が生成され SAN が表示されれば準備完了とする
2. `rm -rf /tmp/ch03 && tsc -p code/ch03/tsconfig.json --outDir /tmp/ch03 && TLS_KEY=certs/localhost-key.pem TLS_CERT=certs/localhost-cert.pem node /tmp/ch03/https-server.solution.js` でサーバを起動し、別ターミナルの `curl -k https://localhost:3443/` がJSONを返せば合格とする
3. `curl https://localhost:3443/` が失敗し、`curl --cacert certs/localhost-cert.pem https://localhost:3443/` が成功することを両方確認する
4. `openssl s_client -connect localhost:3443 -servername localhost </dev/null` の出力に証明書チェーンと Verify return code が出ることを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 手順を「鍵と証明書を作る」「サーバへ読み込ませる」「クライアントに信頼させる」の3段に分ける。失敗したときどの段の問題かを切り分けられるようにする。
2. 構造: `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'` の1コマンドで生成できる。サーバ側は `https.createServer({ key: readFileSync(...), cert: readFileSync(...) }, handler)` へ渡すだけでよい。
3. 実装の要点: `-k` なしで通したい場合は検証を切るのではなく `curl --cacert cert.pem` で「この証明書を信頼する」と明示する。接続に使うホスト名は証明書のSANに含まれる必要があり、`https://127.0.0.1:3443` を使うなら SAN に `IP:127.0.0.1` が要る。

**本番利用時の警告**

- `curl -k` や `rejectUnauthorized: false` は証明書検証そのものを無効にし、中間者攻撃を検出できなくする。デバッグ時の一時措置に限り、アプリケーションのコードや設定へ残さない
- 生成した秘密鍵をリポジトリへコミットしない。教材用の鍵でも使い回すと、漏えい時の影響範囲が広がる
- 自己署名証明書は失効確認 (CRL/OCSP) も自動更新も持たない。公開環境では信頼されたCAの発行と更新の自動化が前提になる

**導線**

- 開始地点: `cert-gen.sh`、`starter.md`
- 模範解答: `cert-gen.solution.sh`、`https-server.solution.ts`、`solution.md`

### 3.4 課題3.4: TLS handshake を可視化 (★★★)

**目的**: TLS 1.2 vs TLS 1.3 のハンドシェイクの違いを実際に見る。

**難易度**: ★★★

**推定時間**: 150分 (2バージョンのログ取得に30分、メッセージ順序の抽出と表の作成に40分、5回ずつの時間計測に40分、Wiresharkでの発展観察に40分)

**必要サービス**: OpenSSL/TLS

**前提**

- 3.3 TLS/SSL ― 通信を暗号化する を読み、ClientHello から Finished までの各メッセージの目的を説明できる
- `openssl s_client` の `-tls1_2` `-tls1_3` `-state` `-msg` オプションを使える
- 発展課題を行う場合は、Wireshark か tcpdump でキャプチャできる環境がある

**完成条件 (自己採点用チェックリスト)**

- [ ] TLS 1.2 と TLS 1.3 の両方でハンドシェイクのログをファイルへ保存している
- [ ] 各ログから ClientHello / ServerHello / Certificate / Finished / NewSessionTicket の出現順を抜き出し、2バージョンを並べた表を作っている
- [ ] 選択された Cipher と ALPN プロトコルを両バージョンについて記録している
- [ ] `time` の real 値を各5回以上取り、単発値ではなく中央値で比較している
- [ ] 往復数 (RTT) の違いと実測時間の違いを分けて記述している

**期待出力**

- TLS 1.2 のログに `SSL_connect:SSLv3/TLS write client hello` などの state 行と、`Cipher is ECDHE-RSA-AES128-GCM-SHA256` の形式の行が現れる
- TLS 1.3 のログでは Cipher が `TLS_AES_256_GCM_SHA384` などの命名になり、NewSessionTicket がハンドシェイク完了後に現れる
- ハンドシェイクの各段階を `grep -c ClientHello tls12.log` のように数えると、ClientHello・ServerHello・Certificate・Finished が両ログで1件以上ヒットする。NewSessionTicket は TLS 1.2 のログには出るが、TLS 1.3 で `</dev/null` を使って即座に切ると0件になる (チケットがハンドシェイク完了後に送られるため)
- `time` の real はネットワーク遅延に支配され、TLS 1.3 が常に速いとは限らない結果になることがある

**観察項目**

- TLS 1.2 では Certificate が平文で流れるのに対し、TLS 1.3 では ServerHello 以降が暗号化され `-msg` の表示内容が変わることを確認する
- `-servername` を外して実行し、SNIなしでは共有ホスティング先から意図しない証明書が返る場合があることを確認する
- `ALPN protocol` の行を見て、HTTP/2 を使うかどうかがTLSハンドシェイクの中で決まっていることを確認する
- 2回目以降の接続でセッション再開が起きると往復が減ることを、実測時間の分布から読み取る

**テスト方法 (自己採点手順)**

1. `{ time openssl s_client -tls1_2 -state -msg -connect example.com:443 -servername example.com </dev/null; } > tls12.log 2>&1` を実行し、ログに `Cipher is` の行が含まれていれば取得成功とする
2. 同じ手順を `-tls1_3` で行い、`grep -c ServerHello tls13.log` が1以上を返すことを確認する。NewSessionTicket も数えたい場合は `</dev/null` を外し、代わりに `-sess_out ticket.pem` を付けて数秒待ってから切る。TLS 1.3 のチケットはハンドシェイク完了後に別途送られるため、即座に切断すると受け取れない
3. 作成した比較表が `code/ch03/tls-trace.solution.md` の5項目 (Hello、証明書とFinishedの順序、Cipher、ALPN、実測時間) をすべて埋めていれば合格とする
4. 5回分の計測値を並べ、中央値で比較していれば単発測定の一般化を避けられている

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: まず比較条件を固定する。接続先、SNI、ネットワーク、時間帯を揃えないと、バージョン差ではなく回線差を測ることになる。
2. 構造: `openssl s_client -state -msg` で状態遷移とメッセージの両方を出す。`</dev/null` を付けて標準入力を閉じないとコマンドが終わらず、`time` の値が取れない。
3. 実装の要点: TLS 1.3 では Certificate 以降が暗号化されるため、平文でメッセージ名を追えるのは ClientHello と ServerHello までである。中身まで見たい場合は Wireshark と鍵ログ (`SSLKEYLOGFILE`) の併用が必要になる。

**本番利用時の警告**

- `SSLKEYLOGFILE` は通信内容を平文へ戻せる鍵素材を書き出す。実運用のブラウザや業務端末で有効にしたまま放置しない
- 第三者のホストへ繰り返しハンドシェイクを張ると接続元制限やブロックの対象になる。反復計測は自分が管理するサーバか、課題3.3で立てた localhost のサーバで行う
- パケットキャプチャは同一ネットワーク上の他者の通信も取得しうる。許可のないネットワークでキャプチャしない

**導線**

- 開始地点: `tls-trace.md`
- 模範解答: `tls-trace.solution.md`

### 3.5 課題3.5: 「URLを入力してから画面表示まで」のすべてを観察 (★★★)

**目的**: 本章のまとめ。1つの URL に対して、すべてのフェーズの所要時間を計測する。

**難易度**: ★★★

**推定時間**: 150分 (計測点のイベント配線に40分、5区間と合計の算出に30分、TLS情報とサブリソース数の追加に30分、複数サイトでの反復計測とブラウザとの突き合わせに50分)

**必要サービス**: なし

**前提**

- 3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ) を読み、DNS→TCP→TLS→HTTPの順序を説明できる
- 課題3.2と課題3.3で DNS と TLS を個別に観察済みである
- `https.request` の socket イベントと、ソケットの lookup / connect / secureConnect イベントを扱える

**完成条件 (自己採点用チェックリスト)**

- [ ] URLを引数に取り、DNS・TCP・TLS・TTFB・ボディ受信の5区間をミリ秒で表示する
- [ ] 解決されたIPアドレス、HTTPバージョン、TLSプロトコル名、Cipher名を出力に含める
- [ ] 受信バイト数と、HTML内のサブリソース参照数を数えて表示する
- [ ] 合計時間と、DNS+TCP+TLS+TTFB がその何パーセントかを表示する
- [ ] `http://` のURLを渡したときにエラーとして拒否する
- [ ] 15秒程度のタイムアウトを設定し、無応答のホストで待ち続けない

**期待出力**

- 出力が `[DNS]` `[TCP]` `[TLS]` `[HTTP]` `[Body]` `[Parse]` の6行に続き、`Total:` と `Critical path estimate:` の2行で終わる
- `[TLS]` 行に `TLSv1.3` と `TLS_AES_128_GCM_SHA256` のようなプロトコル名とCipher名が入る
- `[HTTP]` 行にHTTPバージョン、ステータスコード、TTFBが出る
- 5区間の合計が Total とおおむね一致し、Critical path estimate の割合が0〜100%の範囲に収まる
- `[Parse]` のサブリソース数は正規表現による概算であり、実際の読み込み数とは一致しない

**観察項目**

- 同じURLを2回続けて実行し、DNSキャッシュとTLSセッション再開により2回目のDNS区間とTLS区間が短くなることを確認する
- example.com と github.com を比べ、ボディサイズとサブリソース数の差が Total のどの区間に効くかを確認する
- ブラウザのNetworkタブの Waterfall と自分のツールの5区間を並べ、ブラウザ側にはサブリソース取得とレンダリングの時間が加わることを確認する
- `[Parse]` の概算値をNetworkタブの実リクエスト数と比べ、正規表現によるHTML解析の限界を確認する

**テスト方法 (自己採点手順)**

1. `tsx code/ch03/url-trace.solution.ts https://example.com` を実行し、8行の出力がそろって Total が正の値になれば合格とする
2. `pnpm --filter @handbook/ch03 run test` を実行し、第3章のテストと教材ファイル検証が通ることを確認する
3. `tsx code/ch03/url-trace.solution.ts http://example.com` を実行し、`this exercise traces https:// URLs only` のエラーで終了することを確認する
4. 自分のツールのDNSとTLSの値を、課題3.2のツールおよび `curl -w '%{time_namelookup} %{time_appconnect}'` の値と突き合わせ、同じオーダーなら計測点の取り方が正しい

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 計測点は「イベントが発火した時刻を記録する」だけにして、区間の計算は最後にまとめて行う。先に引き算を始めると順序の前提が崩れやすい。
2. 構造: `https.request(target, ...)` の socket イベントで得たソケットに対し、lookup・connect・secureConnect の3イベントで `performance.now()` を記録する。レスポンス到着時刻がTTFB、`end` の時刻がボディ完了時刻になる。
3. 実装の要点: secureConnect の中で `socket.getProtocol()` と `socket.getCipher().name` を取るとTLS情報が得られる。リダイレクトを追わない設計なら、301/302 を受けたときに何を計測しているのかを出力へ明示しないと読み誤りやすい。

**本番利用時の警告**

- このツールはリダイレクト追跡、HTTP/2の多重化、サブリソースの実取得、レンダリング時間を含まない。体感速度の指標として提示すると誤解を生む
- 公開サイトが対象でも、短時間の反復実行はレート制限や遮断の対象になる。連続実行では間隔を空け、負荷試験として第三者のサイトへ向けない

**導線**

- 開始地点: `url-trace.ts`
- 模範解答: `url-trace.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch03 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
