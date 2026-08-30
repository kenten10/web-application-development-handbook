# 第I部 基礎編 ― Webを支える原理

ブラウザでリンクを1つ開くと、私たちには「ページが表示された」という一つの出来事に見える。しかし、内部では別々の責務を持つ仕組みが順番に協調している。リソースを名前で指し示し、相手の場所を調べ、安全な通信路を作り、メッセージを交換し、受け取った文字列を画面へ変換する。Webアプリケーションは、この長い処理の連鎖の上に成り立っている。

フレームワークはこの連鎖を使いやすく包んでくれるが、境界そのものを消すわけではない。本番で「遅い」「つながらない」「一部のブラウザだけ崩れる」といった問題が起きると、どの境界で期待と現実がずれたのかを切り分ける必要がある。HTTPヘッダを読む、DNS (Domain Name System) の応答を確認する、TLS (Transport Layer Security) ハンドシェイクを追う、レンダリングのタイムラインを見る、といった診断はすべて同じ処理の連鎖を逆向きにたどる作業である。

第I部では、アドレスバーへURL (Uniform Resource Locator) を入力してから画面にピクセルが現れるまでを一続きに追う。第1章で全体の役割分担をつかみ、第2章でメッセージ交換の契約を読み、第3章で宛先の解決と通信相手への信頼を扱い、第4章で受け取ったHTML (HyperText Markup Language)・CSS (Cascading Style Sheets)・JavaScriptが画面と操作へ変わる過程を見る。後の章で登場するフレームワーク、API (Application Programming Interface)、データベース、インフラは、すべてこの土台のどこかを拡張するものとして位置づけられる。

---

<a id="chapter-1"></a>
## 第1章 Webとは何か ― 歴史と全体像

Web開発を学び始めると、React、Rails、PostgreSQL、AWSのような具体的な技術名が先に目に入る。しかし、それらはWebそのものではなく、Webの基本的な約束の上に作られた選択肢である。個別技術を知識の断片として覚えないためには、まず「何を識別し、どう要求し、何を表現として返すのか」という変わりにくい骨格を持つ必要がある。

本章では、WebをURI (Uniform Resource Identifier)・HTTP・HTML、クライアント・サーバ、状態という少数の役割へ分解する。ここでは各仕組みの詳細にはまだ踏み込まない。先に全体地図を作り、以後の章で新しい概念が出たときに「処理のどこを担い、何の制約を解決するものか」を置けるようにすることが目的である。

<!-- handbook:chapter-guide:start {"chapter":1} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 目の前のフレームワークやクラウド製品だけで判断せず、WebアプリをURI・HTTP・HTML・クライアント/サーバという長寿命の原理から説明できるようにする。
>
> **到達目標**
> - Webを構成する基本要素と、それぞれの責務を説明できる。
> - ステートレス性、クライアント/サーバ分離、Web標準が設計判断に与える影響を説明できる。
> - 本書の範囲と学習ルートを理解し、自分の目的に合う読み方を選べる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - 前提知識は不要。ブラウザでWebサイトを利用した経験があればよい。
>
> **中核概念**  
> [1.1 Webの誕生と設計思想](#section-1-1)、[1.3 クライアント/サーバモデルとステートレス性](#section-1-3)、[1.4 「Webアプリケーション」とは何か](#section-1-4)
>
> **最小実装**  
> [1.10 実装課題 ― Webを「観察する」](#section-1-10) (実務選択)
>
> **本番実装との差分**
> - 歴史上の設計原則は重要だが、実際のシステムでは認証、状態管理、CDN、非同期処理などの追加層が必要になる。
>
> **典型的な失敗**
> - Webを特定のJavaScriptフレームワークと同一視する。
> - ステートレスを「状態が存在しない」と誤解する。
>
> **診断・デバッグ方法**
> - ブラウザのNetworkパネルで文書・API・静的資産の境界を観察する。
> - URL、HTTPメソッド、レスポンス形式を分けて記録する。
>
> **意思決定チェックリスト**
> - 標準仕様で解ける問題か、アプリ固有の仕組みが必要か。
> - サーバとクライアントのどちらに責務を置くべきか。
>
> **演習と評価基準**  
> 対象: [1.10 実装課題 ― Webを「観察する」](#section-1-10) (実務選択)
> - 観察したリクエストをURI・HTTP・表現形式の3要素に分解できる。
> - 本書で重点的に学ぶ章を理由付きで選べる。
>
> **一次資料・発展資料**
> - Berners-LeeのWeb提案書
> - RFC 3986
> - RFC 9110
<!-- handbook:chapter-guide:end -->

<a id="section-1-1"></a>
### 1.1 Webの誕生と設計思想
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.1"} -->

Webが解こうとした最初の問題は、組織もOSも異なるコンピュータの間で、情報を特定して参照できるようにすることだった。現在の技術から遡るのではなく、この問題設定から始めると、URI・HTTP・HTMLの役割分担が見えやすい。

1989年、欧州原子核研究機構 (CERN) のティム・バーナーズ=リーは、研究者間で論文や実験データを共有する仕組みとして「World Wide Web」を提案した [Berners-Lee, 1989]。彼が設計した3つの要素は、現在もWebの基盤として生きている。

1. **URI (Uniform Resource Identifier)** ― リソースを一意に識別する
2. **HTTP (HyperText Transfer Protocol)** ― リソースをやり取りするプロトコル
3. **HTML (HyperText Markup Language)** ― リソースの内容を表現するフォーマット

注目すべきは、これらが**疎結合**に設計されたことだ。URIで参照できれば、その先がHTMLでもPDFでも画像でも構わない。HTTPはHTML専用ではなく、任意のバイト列を運ぶ。この設計により、新しい種類のリソースを増やすたびにプロトコルを作り直す必要がなくなった。

<a id="section-1-2"></a>
### 1.2 静的Webから動的Webへ ― 4つの時代
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"Ajax"} -->

<!-- handbook:narrative-bridge {"section":"1.2"} -->

URI・HTTP・HTMLは文書を共有する骨格を作ったが、初期のWebは用意された情報を読むことが中心だった。利用者の入力に応じて内容を変え、状態を保存し、画面の一部だけを更新したいという要求が、計算を置く場所を少しずつ変えていく。

Webアプリケーションの歴史は、おおよそ4つの時代に分けられる。

**第1世代: 静的HTML (1991〜1995頃)**
サーバはディスク上の `.html` ファイルをそのまま返すだけ。ユーザーは「読む」ことしかできない。

**第2世代: CGIとサーバサイドスクリプト (1995〜2005頃)**
CGI (Common Gateway Interface) によって、リクエストごとにプログラムを実行できるようになった。PerlやPHPによる動的ページが生まれ、掲示板やECサイトが登場する。この時代、ページ遷移は常にフルリロードだった。

**第3世代: Ajaxとリッチクライアント (2005〜2015頃)**
2005年、Google MapsとGmailが衝撃を与えた。`XMLHttpRequest` を使えば、ページを再読み込みせずにサーバと通信できる ― この技法は「Ajax」と命名され、Webはアプリケーションプラットフォームへと変貌した。jQuery、Backbone.js、AngularJS、Reactと続くフレームワークの系譜が始まる。

**第4世代: SPA (Single Page Application) と2015年以降のWeb**
React、Vue、Svelte などのフレームワークと、Webpack、Vite といったビルドツール、TypeScript による型システム、Server-Side Rendering の復活 (Next.js、Remix)、エッジコンピューティング、WebAssembly ― Webアプリは単なる「サイト」ではなく、ネイティブアプリと肩を並べる実行環境になった。

<a id="section-1-3"></a>
### 1.3 クライアント/サーバモデルとステートレス性
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"L","term":"localStorage"} -->
<!-- handbook:index {"group":"さ行","term":"ステートレス"} -->

<!-- handbook:narrative-bridge {"section":"1.3"} -->

歴史を通してサーバ側とブラウザ側の役割は何度も移動した。それでも、要求する側と応答する側に分かれる基本形は変わっていない。技術の流行から独立してWebを考えるため、ここでクライアント/サーバとステートレス性を抽象化する。

Webの通信は、根本的にはこの繰り返しでしかない。

```text
クライアント:  「このURLのリソースをくれ」 (リクエスト)
サーバ:        「これだ。ステータスは200だ」 (レスポンス)
```

このシンプルさは設計上の意図的な選択だ。Webが大規模に成長できた理由のひとつは、**サーバが個々のリクエスト間で状態を持たない (ステートレス)** ことにある。各リクエストは独立しており、サーバはどのリクエストを誰が送ったかを内部状態として保持しない。これによりサーバを水平方向にスケールしやすくなる ― リクエストをどのサーバに振り分けても同じ結果が得られるからだ。

「ログイン状態」のような状態はどう扱うのか? それはクライアント側 (Cookie、localStorage、トークン) か、共有ストレージ (Redis、データベース) に置く。HTTPプロトコル自体は依然としてステートレスなままだ。これは第13章 (認証と認可) で深掘りする。

<a id="section-1-4"></a>
### 1.4 「Webアプリケーション」とは何か
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.4"} -->

ステートレスなHTTPの上でも、Cookieやデータベースを組み合わせれば、利用者の操作に応じて状態を変えられる。文書の閲覧から状態変化を伴う処理へ進んだとき、私たちが「Webアプリケーション」と呼ぶ対象と、必要になる技術領域が見えてくる。

ここで言葉の整理をしておこう。

- **Webサイト**: 主に情報の閲覧を目的とした静的または半動的なページ群
- **Webアプリケーション**: ユーザーの入力を受けて状態を変化させ、何らかの処理を提供するもの

境界は曖昧だが、本書が扱うのは後者だ。具体的には:

- ユーザー認証がある
- データを永続化する (データベース)
- ビジネスロジックを持つ
- 複数のユーザーが同時に使う

これらを満たすアプリを作るには、フロントエンド、バックエンド、データベース、インフラ、セキュリティ、運用 ― あらゆる領域の知識が必要になる。本書はその全体の見取り図と、各領域で判断の軸になる原理を扱う。

<a id="section-1-5"></a>
### 1.5 本書の使い方
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.5"} -->

Webアプリケーションが複数の層をまたぐことが分かると、本書を一度に均等な深さで読むのが現実的でないことも分かる。全体像を維持したまま必要な深さを選べるよう、ここで読み方を整理する。

本書は通読型・参照型のどちらでも使えるように設計してある。

**通読型 ― 上から順に読む**

第I部から第VII部までを順に読むと、Web開発の全体地図が見える。各章は前の章の概念を踏まえて書かれているため、最初に通読すると後の理解が早い。週に1章ずつでも、半年で読み切れる構成だ。

**参照型 ― 必要なときに該当章を引く**

仕事で特定のテーマに直面したときに該当章を引く使い方もできる。たとえば:

- 「SQLが遅い」 → 第14章 (実行計画とインデックス)
- 「認証を実装する」 → 第13章 (認証と認可)
- 「Webhookに署名を付けたい / 検証したい」 → 第13章 (HMAC-SHA256)
- 「自社SaaSにエンタープライズSSOを実装したい」 → 第13章 (SAML、IAM、SCIM)
- 「サプライチェーンを守りたい」 → 第23章 (Evidence Bundle、SLSA)
- 「監査ログを改ざん不可にしたい」 → 第23章 (Merkle Tree、ブロックチェーンアンカー)
- 「テストの書き方が分からない」 → 第25章 (テスト戦略)
- 「Kubernetesを導入する」 → 第19章 (コンテナとオーケストレーション)

各部末にまとめがあり、各章は次章へつなぐ段落で終わる。いずれも関連する他章への参照を明示している。詰まったら戻り、わかったら進むという読み方が現実的だ。

<a id="section-1-6"></a>
### 1.6 本書が扱う読者層
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.6"} -->

読み方を選ぶには、どこを出発点とする本なのかを明確にしておく必要がある。本書は構文を初めて学ぶ読者ではなく、動くアプリを作った経験を、原理・診断・設計判断へ結び直したい読者を想定している。

本書は**Web開発経験1〜3年程度の開発者**を主な想定読者としている。具体的には:

- フレームワーク (React、Express、Rails、Django など) を使って何かを作った経験がある
- HTTPやデータベースの基本は知っているが、「なぜこう動くのか」まで掘り下げたことはない
- 自分が書いたコードが本番でどう振る舞うか、不安に感じることがある
- 「コードは書けるけど、設計判断やトラブル対応に自信がない」

この層が次のレベル (シニア・テックリード) に進むためのギャップを埋めるのが本書の役割だ。逆に、初学者 (プログラミング自体に触れて間もない) 向けではない。最低限、何かの言語で簡単なCRUDアプリが作れる程度の経験を前提とする。

<a id="section-1-7"></a>
### 1.7 本書が扱う範囲と扱わない範囲
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.7"} -->

想定読者を定めても、Web開発に関係するすべてを一冊で同じ深さまで扱うことはできない。以後の概念をどこまで掘り下げるか判断できるよう、本書が提供する地図の境界を先に示す。

ソフトウェア開発は広大で、1冊で全てを網羅することはできない。本書のスコープを明確にしておく。

**扱うこと:**

- Web標準 (HTTP、URL、HTML、CSS、JavaScript)
- フロントエンド (React中心、内部実装まで)
- バックエンド (Node.js中心、他言語との比較あり)
- データベース (RDBMS、NoSQL、検索、メッセージング)
- インフラ運用 (Linux、コンテナ、クラウド、CI/CD、可観測性)
- 品質保証 (セキュリティ、パフォーマンス、テスト、アーキテクチャ)
- 設計思想 (DDD、Clean Architecture、SOLID)
- LLMを組み込む開発 (RAG、Function Calling)

**扱わないこと:**

- プログラミング言語そのものの入門 (JavaScriptの基礎構文など)
- 各フレームワークの網羅的なAPIリファレンス (公式ドキュメントを参照)
- モバイルアプリ開発 (iOS/Android ネイティブ)
- ゲーム開発、組み込み開発
- 機械学習モデルの訓練 (LLMを使う側に焦点)
- プロジェクトマネジメント、チームビルディング

「**広く、しかし表層ではなく中層まで**」が本書の深さ設定だ。ある領域を本当に深く知るには、その領域の専門書を1冊読み切る必要がある。本書は各領域の地図と入り口を提供し、深堀りすべき方向を示す役目を負う。

<a id="section-1-8"></a>
### 1.8 コード例について
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.8"} -->

扱う領域がフロントエンドからインフラまで広いため、コード例の言語が章ごとに変わると、概念の差より構文の差へ注意を奪われる。本書では比較の軸を保つためにTypeScriptとNode.jsを共通言語として使う。

コード例は主に **TypeScript + Node.js** で書く。理由は3つある。

1. **フロント・バック両方で使える**: 1つの言語で全層を扱える
2. **型システムが思考の補助線になる**: 設計意図がコードに現れる
3. **本書全体で同じ言語を使いやすい**: フロントエンドとバックエンドをまたいで概念を比較できる

ただし、他言語のほうが優れる領域では公平に紹介する。たとえば第10章ではGo、Rust、Python、Rubyの強みも比較する。「全部TypeScriptで書け」とは主張しない。

コード例はあくまで**概念を理解するための最小実装**であり、本番で使うときは前提・エラー処理・テストを追加する必要がある。「動くコード」より「読んで分かるコード」を優先している。

<a id="section-1-9"></a>
### 1.9 読み始める前に
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"1.9"} -->

共通言語があっても、コードを眺めるだけでは、プロトコルや実行時の挙動を自分で診断できる知識にはならない。以後は説明を読んだ直後に観測や最小実装を行い、概念と現象を対応づける。

本書には500以上のコード例、多数の図表、7つの部末まとめがある。一気に読み切ろうとすると消化不良になる。「**1日30分、半年で読む**」程度のペースが現実的だ。

そして最も重要なこと ― **読むだけでなく、手を動かしてほしい**。第2章で出てくる `nc example.com 80` を実際に叩いてみる。第4章でブラウザの開発者ツールを開いてみる。第30章のSaaSを実装してみる。手を動かして初めて、知識は技能になる。

準備はいいだろうか。それでは、Web の土台から見ていこう。

<a id="section-1-10"></a>
### 1.10 実装課題 ― Webを「観察する」
<!-- handbook:learning {"level":"practical","minutes":140} -->

<!-- handbook:narrative-bridge {"section":"1.10"} -->

ここまで作ったのはWebを分解するための地図である。最初の演習では何かを作るより先に、普段利用しているWebをその地図で読み直し、URI・リクエスト・応答・表現が実際に分かれていることを確かめる。

本章は概論なので、コードを書く課題は少なめ。代わりに、**普段使っているWebが裏で何をしているか観察する**課題に取り組んでほしい。所要時間: 演習カードの推定時間の合計で2時間20分。

#### 課題1.1: ブラウザの開発者ツールでWebを覗く (★)

**目的**: 普段使っているサイトが裏で何をしているか体感する。

<!-- handbook:exercise:start {"id":"1.1"} -->
> **演習カード 課題1.1** ― 難易度 ★ ／ 推定時間 20分 ／ 必要サービス: Chrome
>
> **前提**
>
> - 1.1 Webの誕生と設計思想 を読み、URI・HTTP・HTMLの役割分担を自分の言葉で言えるようにしておく
> - Chrome または Firefox の最新版を用意し、F12 で開発者ツールを開ける
> - Network タブの Disable cache チェックボックスと、キャッシュを使わない再読み込み操作を把握しておく
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] https://github.com を再読み込みし、Network タブのリクエスト総数と転送量合計と Finish 時刻の3つを数値で記録している
> - [ ] サイズ降順に並べ替えて最大リソース1件のファイル名・種別 (JavaScript/CSS/画像)・転送サイズを記録している
> - [ ] ステータス 200 のリクエスト数と 304 のリクエスト数を分けて数えている
> - [ ] Protocol 列を表示し、h2 / h3 / http/1.1 のどれが使われたかを記録している
> - [ ] https://www.amazon.com についても同じ5項目を記録し、GitHub との差を1行で書いている
>
> **期待出力**
>
> - Network タブのフッタに `NN requests` `X.X MB transferred` `Finish: N.NN s` の形式で集計が表示される
> - Waterfall 列のツールチップに Queueing / DNS Lookup / Initial connection / SSL / TTFB / Content Download の内訳が出る
> - Protocol 列は主要ホストで `h2` または `h3` になり、一部の第三者ドメインだけ `http/1.1` が残る
> - 2回目の再読み込みでは 200 の一部が 304 または `(disk cache)` に変わり、転送量合計が減る
>
> **観察項目**
>
> - Waterfall の各バーで DNS と SSL の区間が最初の接続だけに現れ、同一ホストへの後続リクエストでは消えることを確認する
> - Size 列の転送量とリソースサイズの2段表示を比べ、gzip や br による圧縮でどれだけ縮んでいるかを読む
> - DOMContentLoaded の青線と Load の赤線の位置から、描画開始後もリソース取得が続いていることを確認する
> - Type 列で document / script / stylesheet / image / xhr を分類し、GitHub と Amazon でどの種別が支配的かを比べる
>
> **テスト方法 (自己採点手順)**
>
> 1. 開発者ツールを開いた状態で再読み込みし、Network タブ下部の集計行にリクエスト数と転送量が表示されれば計測が成立している
> 2. `curl -s -o /dev/null -w '%{http_code} %{http_version} %{size_download}\n' https://github.com` を実行し、開発者ツールで見たドキュメントのステータスとプロトコル番号が一致することを確認する
> 3. Disable cache をオンにして再読み込みし、304 が0件になれば「304 はキャッシュヒット」という読み取りが正しいと確認できる
> 4. 記録した5項目が2サイト分そろい、数値の空欄がなければ合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 観察を始める前に記録表を先に作る。列は「リクエスト数」「最大リソース」「200の件数」「304の件数」「プロトコル」の5つで足りる。
> 2. **構造**: Network タブは列見出しの右クリックで列を追加できる。Protocol 列と Size 列を表示し、Size 見出しをクリックして降順に並べ替えると最大リソースが先頭に来る。
> 3. **実装の要点**: 304 の件数はフィルタ欄に `status-code:304` と入力すると数えられる。逆に Disable cache を入れて再読み込みすると 304 が消えるので、この2状態を切り替えないとキャッシュヒット数を正しく比較できない。
>
> **本番利用時の警告**
>
> - Network タブに表示される Cookie や Authorization ヘッダには自分のセッション情報が含まれる。画面を共有・保存する前に該当行を隠すこと
> - 計測値は回線・拡張機能・キャッシュ状態で大きく変わる。この1回の数値を対象サイトの性能評価として外部へ提示しない
>
> **導線**
>
> - コード成果物はない。観察結果と判断根拠を自分の記録へ残し、完成条件で照合する。
>
> **推定時間の内訳**: GitHubの5項目の観察に10分、Amazonの同一観察に5分、2サイトの比較メモに5分
<!-- handbook:exercise:end -->

**手順**:
1. Chrome / Firefox で `https://github.com` を開く
2. F12 で開発者ツールを起動
3. Network タブに切り替え、ページを再読み込み (F5)
4. 以下を観察して記録する:
   - HTML 読み込みから、最初のコンテンツが描画されるまで何 ms かかったか
   - リクエスト数の合計
   - 一番大きなファイル (サイズ順) とその種類 (JavaScript、CSS、画像など)
   - ステータス 200 と 304 のリクエスト数 (304 はキャッシュヒット)
   - HTTPプロトコルのバージョン (HTTP/1.1、HTTP/2、HTTP/3)
5. 同じ手順で `https://www.amazon.com` も観察し、GitHub と比較

**評価基準**: 各項目の数値を記録できていればOK。「最初のコンテンツが見えるまで何秒かかったか」を体感するのが目的。

#### 課題1.2: curl で生のHTTP通信を見る (★)

**目的**: ブラウザが隠している HTTP の生の姿を見る。

<!-- handbook:exercise:start {"id":"1.2"} -->
> **演習カード 課題1.2** ― 難易度 ★ ／ 推定時間 15分 ／ 必要サービス: なし
>
> **前提**
>
> - 1.1 Webの誕生と設計思想 を読み、HTTPがリソースを運ぶ層であることを確認しておく
> - ターミナルで `curl --version` が動き、curl 7.x 以降が入っている
> - 標準出力のリダイレクトと `-o /dev/null` の意味を理解している
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `curl -I https://example.com` の出力からステータス行と、ヘッダ名を5個以上書き出している
> - [ ] `curl -v` の出力を `>` の送信行と `<` の受信行に分け、送信側ヘッダを3個以上特定している
> - [ ] time_namelookup / time_connect / time_appconnect / time_starttransfer / time_total の5つについて、それぞれが何の完了時点かを1行ずつ書いている
> - [ ] 5つの値が累積時間であり、各フェーズ単体の時間は隣り合う値の差で求まることを、実測値の引き算で示している
>
> **期待出力**
>
> - `curl -I` の1行目が `HTTP/2 200` で、続けて `content-type` `date` `etag` `cache-control` などのヘッダ行が出る
> - `curl -v` では `* Connected to` `* TLSv1.3 (OUT), TLS handshake` `* ALPN: server accepted h2` などの `*` 行と、`>` `<` のヘッダ行が混在して出る
> - `curl -o /dev/null -s -w '%{http_code}'` は本文を出さず `200` だけを出力する
> - time_* の5値は単調非減少で、time_namelookup < time_connect < time_appconnect < time_starttransfer <= time_total の順になる
>
> **観察項目**
>
> - `time_appconnect` から `time_connect` を引き、TLSハンドシェイクだけで何ミリ秒使っているかを確認する
> - 同じコマンドを2回続けて実行し、DNSキャッシュにより2回目の `time_namelookup` が大きく縮むことを確認する
> - `http://example.com` のように平文で実行すると `time_appconnect` が 0.000000 になることを確認する
> - `curl -v` の `* ALPN` 行を見て、HTTP/2 を使う合意がTLSハンドシェイクの中で行われていることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch01/measure-http.solution.sh https://example.com https://github.com` を実行し、`url,http_code,http_version,dns_s,tcp_s,tls_s,ttfb_s,total_s,size_bytes` のヘッダ行と2行のCSVが出れば計測環境は正常である
> 2. 自分が書いた time_* の説明を `code/ch01/solution.md` の一覧と突き合わせ、5項目すべてで意味が一致すれば合格とする
> 3. `curl -o /dev/null -s -w '%{http_code}' https://example.com/missing` を実行し `404` が返ることで、ステータス取得の書式が正しく動くと確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 4つのコマンドを一度に理解しようとせず、`-I` はヘッダのみ、`-v` は通信ログ、`-w` は計測書式、という3系統に分けて役割を覚える。
> 2. **構造**: `-w` の `%{time_*}` はすべて「リクエスト開始からその段階が終わるまでの累積秒数」である。名前解決・接続・TLS・最初のバイト・完了の順に5つを並べ、隣同士の差を取れば各フェーズの所要時間になる。
> 3. **実装の要点**: `-o /dev/null -s` を付けないとボディが標準出力へ混ざって計測結果が読めなくなる。またHTTPのURLでは `time_appconnect` が常に0になるため、TLSの所要時間を測る実験はhttpsのURLで行う。
>
> **本番利用時の警告**
>
> - curlが返すのはクライアント側から見た時間であり、サーバの処理時間の証拠にはならない。`time_starttransfer` にはネットワーク遅延とサーバ処理が混ざっている
> - 第三者のサイトへ高頻度でcurlを繰り返すと攻撃トラフィックとみなされる。反復計測は自分が管理するホストか localhost で行う
>
> **導線**
>
> - コード成果物はない。観察結果と判断根拠を自分の記録へ残し、完成条件で照合する。
>
> **推定時間の内訳**: 4つのcurlコマンドの実行と出力読解に8分、time_*の5項目の意味を書き出すのに7分
<!-- handbook:exercise:end -->

**手順**: ターミナルで以下を実行。

```bash
# レスポンスヘッダだけ表示
curl -I https://example.com

# 詳細な通信ログ(リクエストヘッダ、レスポンスヘッダ、ボディ全て)
curl -v https://example.com

# ステータスコードだけ取得
curl -o /dev/null -s -w "%{http_code}\n" https://example.com

# レスポンス時間の内訳を見る
curl -w "\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nFirst byte: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s https://example.com
```

**問題**: 上記の `time_*` の各項目が何を意味するか説明せよ (`time_namelookup` から `time_total` まで5つ)。

**ヒント**: 第3章で詳しく扱うが、ブラウザがURLを叩いてから最初の1バイトを受け取るまでに、複数のフェーズがある。

#### 課題1.3: 静的サイトと動的サイトを見分ける (★★)

**目的**: 「同じURLで毎回違う内容を返す」のが動的サイトの特徴。

<!-- handbook:exercise:start {"id":"1.3"} -->
> **演習カード 課題1.3** ― 難易度 ★★ ／ 推定時間 15分 ／ 必要サービス: Chrome
>
> **前提**
>
> - 1.2 静的Webから動的Webへ ― 4つの時代 を読み、計算をどこで行うかが世代ごとに移動したことを把握しておく
> - 1.3 クライアント/サーバモデルとステートレス性 を読み、同じURLに同じ応答が返るとは限らない理由を確認しておく
> - ブラウザの `view-source:` と開発者ツールの Elements タブが別物であることを区別できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] https://news.ycombinator.com、https://example.com、https://www.google.com、https://www.google.com/search?q=hello の4URLを静的・動的・ハイブリッドに分類し、根拠を1つずつ書いている
> - [ ] 分類の根拠に「再読み込みで内容が変わったか」だけでなく「view-source のHTMLに主要コンテンツが含まれるか」を含めている
> - [ ] 発展問題として、普段使うサイト5件について動的に変わる部分と静的な部分を対にして列挙している
> - [ ] サイト単位ではなくページ単位・遷移単位で挙動が分かれる場合はハイブリッドとする、という判定基準を明記している
>
> **期待出力**
>
> - news.ycombinator.com は2回の再読み込みで投稿順やコメント数が変化し、HTMLに記事タイトルが直接含まれる
> - example.com は何度再読み込みしても同じHTMLで、`curl -I` の `etag` と `last-modified` も変わらない
> - google.com のトップと `/search?q=hello` では、後者だけがクエリ文字列に応じて本文を変える
> - 4URLと判断根拠を並べた分類表が、空欄なしで完成する
>
> **観察項目**
>
> - `curl -I https://example.com` を2回叩いて `etag` が同一であること、動的サイトでは `cache-control: private` などで再検証が促されることを確認する
> - Network タブの document リクエストを見て、初回HTMLに本文が入っているか、後続の fetch/XHR で埋まるかを区別する
> - JavaScript を無効にして再読み込みし、主要コンテンツが残るサイトと空白になるサイトを分ける
> - `/search?q=hello` のクエリだけを変えて応答が変わることを確認し、URLが識別子として機能していることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `curl -s https://example.com -o /tmp/a1.html` と `curl -s https://example.com -o /tmp/a2.html` を実行して `diff /tmp/a1.html /tmp/a2.html` が差分なしになり、同じ手順を news.ycombinator.com で行うと差分が出ることを確認する
> 2. 自分の記録が `code/ch01/solution.md` の4つの判定観点 (Documentリクエストの有無、全体再読込の有無、HTMLへのコンテンツ同梱、JavaScript無効時の挙動) をすべて使っていれば合格とする
> 3. 分類に「判別困難」が残った場合でも、4つの判定観点のどれを試していないかを書けていれば可とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「変わる/変わらない」を再読み込みだけで判定しない。URL、時刻、ログイン状態のどれを変えたときに応答が変わるかを分けて試す。
> 2. **構造**: 判定材料を3つ用意する。`curl -I` の `etag` と `last-modified`、`view-source:` のHTMLに本文が含まれるか、開発者ツールで document 以外に fetch/XHR が走るか、の3点である。
> 3. **実装の要点**: 迷ったら「HTMLの生成場所」と「更新の頻度」を分けて考える。CDN配信の動的ページは静的に見えるため、レスポンスヘッダの `cache-control` と `age` を見ると配信経路のキャッシュを踏んだか判断できる。
>
> **本番利用時の警告**
>
> - 大量の再読み込みやスクレイピングは対象サイトの利用規約違反やレート制限の対象になる。観察は数回にとどめ、自動ループで叩かない
> - HTMLの見た目だけで実装方式を断定しない。CDNキャッシュやエッジレンダリングにより、動的生成でも静的に見えることがある
>
> **導線**
>
> - コード成果物はない。観察結果と判断根拠を自分の記録へ残し、完成条件で照合する。
>
> **推定時間の内訳**: 4URLの再読み込み比較に6分、view-sourceとJavaScript無効での確認に5分、分類表と5サイトの列挙に4分
<!-- handbook:exercise:end -->

**手順**:
1. `https://news.ycombinator.com` を**ブラウザで2回続けて再読み込み**し、内容 (コメント数や投稿順序) が変わるか確認
2. `https://example.com` を同様に。変わらないことを確認
3. `https://www.google.com` (ロゴだけ) と `https://www.google.com/search?q=hello` の違いを比較

**問題**: 上記サイトを「静的」「動的」「ハイブリッド」に分類し、その判断根拠を説明せよ。

**発展問題**: 自分が普段使っているWebサイトを5つ挙げ、それぞれの「動的に変わる部分」と「静的な部分」を識別せよ (例: GitHubの場合、HTMLは動的、CSS・JavaScriptは静的)。

#### 課題1.4: 自分のWebの「使用履歴」を可視化 (★★)

**目的**: Webアプリ開発者として、自分自身がWebをどう使っているか自覚する。

<!-- handbook:exercise:start {"id":"1.4"} -->
> **演習カード 課題1.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: Chrome
>
> **前提**
>
> - 1.3 クライアント/サーバモデルとステートレス性 と 1.4 「Webアプリケーション」とは何か を読み、サイトとアプリケーションの線引きを持っておく
> - Chrome で `chrome://history` を開き、直近1週間の訪問履歴を参照できる
> - curl が使え、`bash code/ch01/measure-http.sh` を実行できる (中身はこれから書く)
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 直近1週間の訪問上位20サイトを一覧化し、各サイトを SPA / 伝統的SSR / ハイブリッド / 判別困難 の4分類のいずれかへ割り当てている
> - [ ] 各サイトについて、判定に使った観察 (遷移時に document リクエストが増えたか、全画面が再描画されたか) を1つ以上記録している
> - [ ] 20件のうち5件以上について、自分で書いた `code/ch01/measure-http.sh` でDNS/TCP/TLS/TTFB/総時間を計測し、CSVとして保存している。列は `url,http_code,http_version,dns_s,tcp_s,tls_s,ttfb_s,total_s,size_bytes` の順、引数を与えない場合は `https://example.com` の1件だけを計測する
> - [ ] 4分類それぞれの件数を集計し、SPAとそれ以外でユーザー体験がどう違ったかを3行以内で書いている
>
> **期待出力**
>
> - `bash code/ch01/measure-http.sh <url>...` が `url,http_code,http_version,dns_s,tcp_s,tls_s,ttfb_s,total_s,size_bytes` のヘッダ行に続き、URL1件につき1行のCSVを出力する
> - `http_version` 列には `2` や `3` が入り、`tls_s` は `dns_s` や `tcp_s` より大きい累積値になる
> - 分類表は「サイト」「分類」「観察した挙動」「判断根拠」の4列で20行埋まる
> - 引数を与えずに実行した場合は `https://example.com` の1件だけが計測される
>
> **観察項目**
>
> - リンククリック時に Network タブへ document 型のリクエストが増えるかどうかで、フルページ遷移とクライアント遷移を区別する
> - 同じサイトでもトップはSSR、内部の管理画面はSPAというように、遷移単位で挙動が変わる例を探す
> - CSVの `ttfb_s` から `tls_s` を引き、サーバ処理が支配的なサイトと接続確立が支配的なサイトを見分ける
> - 履歴上位が業務ツールに偏るか消費系サイトに偏るかを見て、自分が作る側として想定すべき利用パターンを言語化する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch01/measure-http.sh https://example.com https://github.com` を実行し、ヘッダ行を含む3行のCSVが出て `http_code` が両方 200 なら合格とする。書き終えてから `measure-http.solution.sh` を同じ引数で実行し、列と値の桁が揃うかを突き合わせる
> 2. 分類表を `code/ch01/solution.md` の記録例と突き合わせ、4つの判定観点 (Documentリクエスト、全体再読込、HTMLへのコンテンツ同梱、JavaScript無効時の挙動) がすべて使われていれば合格とする
> 3. `pnpm --filter @handbook/ch01 run test` を実行し、第1章の教材ファイル構成の検証が通ることを確認する
> 4. 分類が「判別困難」へ偏った場合でも、試していない判定観点を列挙できていれば可とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 分類を急がず、まず上位20サイトを列挙して「そのサイトでよく行う操作」を1つずつ書き出す。判定はその操作を実際に行いながら決める。
> 2. **構造**: 判定は Network タブのフィルタを `Doc` に絞って行う。クリック時に document が1件増えれば従来型のページ遷移、増えずに Fetch/XHR だけが増えればクライアント側遷移である。
> 3. **実装の要点**: 計測は `bash code/ch01/measure-http.solution.sh url1 url2 url3` のように複数URLをまとめて渡し、出力をファイルへリダイレクトして保存する。値は累積なので、各フェーズ単体の時間は `tls_s - tcp_s` のように差分で求める。
>
> **本番利用時の警告**
>
> - 閲覧履歴には業務システムのURLや個人情報が含まれる。CSVや分類表を社外へ共有したりリポジトリへコミットしたりしない
> - 計測対象が第三者のサイトの場合、短時間に多数のリクエストを送ると迷惑行為になる。1サイトあたり数回にとどめる
>
> **導線**
>
> - 開始地点: `code/ch01/measure-http.sh`、`code/ch01/starter.md`
> - 模範解答: `code/ch01/measure-http.solution.sh`、`code/ch01/solution.md`
>
> **推定時間の内訳**: 履歴の抽出と20サイトの列挙に20分、遷移操作による分類に40分、5サイトのcurl計測に15分、集計と振り返りに15分
<!-- handbook:exercise:end -->

**手順**: 過去1週間で自分が訪問したサイトのうち、上位20を Chrome 履歴から抽出 (`chrome://history`) し、以下に分類:

- SPA (Single Page Application) と判断したもの
- 伝統的なサーバサイドレンダリング (リンク遷移でフルページリロード)
- ハイブリッド
- 判別困難なもの

**判別のヒント**:
- ページ内リンクをクリックして、URL は変わるが**全画面が点滅しない** → SPA の可能性が高い
- リンクをクリックすると**ブラウザのローディングバーが進む**(全画面更新) → 伝統的SSR

**振り返り**: SPA とそうでないサイトで、ユーザー体験はどう違ったか?

---

### 解答例とコード

本章の課題はいずれも「観察」中心なので、`code/ch01/` に置いたのは計測スクリプトと記録用の雛形だけである。

- `code/ch01/measure-http.sh` - URLを引数にHTTP応答時間を計測 (開始地点)
- `code/ch01/measure-http.solution.sh` - 同スクリプトの模範解答
- `code/ch01/starter.md` - 観察結果を書き込む記録用の雛形
- `code/ch01/solution.md` - 課題1.2の `time_*` の説明、その他の参考解答

---

<a id="chapter-2"></a>
## 第2章 HTTPプロトコル徹底解剖

第1章では、Webを「リソースを識別し、クライアントが要求し、サーバが表現を返す仕組み」として捉えた。この説明のうち、要求と応答の具体的な約束を担うのがHTTPである。

ブラウザとサーバが単にバイト列を送り合うだけでは、取得なのか更新なのか、成功したのか失敗したのか、再利用してよい応答なのかを判断できない。HTTPは、メソッド、ステータス、ヘッダ、ボディに意味を分担させることで、異なる実装同士が同じ会話を成立させる。本章ではHTTPをAPIの表面的な書式ではなく、クライアント、サーバ、キャッシュ、プロキシが共有する契約として読む。

<!-- handbook:chapter-guide:start {"chapter":2} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> APIの不具合、キャッシュ事故、再送による二重処理、接続遅延を、フレームワークの外側にあるHTTPの意味論から診断する。
>
> **到達目標**
> - リクエストとレスポンスをメソッド、ヘッダ、ボディ、状態コードに分解できる。
> - 安全性・冪等性・キャッシュ可能性を踏まえてAPIを設計できる。
> - HTTP/1.1、HTTP/2、HTTP/3の差を接続と多重化の観点で説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [1.3 クライアント/サーバモデルとステートレス性](#section-1-3) ― クライアント/サーバモデルとステートレス性
>
> **中核概念**  
> [2.1 HTTPメッセージの構造](#section-2-1)、[2.2 メソッドの意味論](#section-2-2)、[2.4 ヘッダ ― HTTPの真の主役](#section-2-4)、[2.6 HTTP/2 ― バイナリ多重化](#section-2-6) (実務選択)、[2.7 HTTP/3 ― QUICによる革命](#section-2-7) (実務選択)
>
> **最小実装**  
> [2.8 実装例: Node.jsで生のHTTPサーバを書く](#section-2-8) (実務選択)、[2.10 実装課題 ― HTTPを「手で組み立てる」](#section-2-10) (実務選択)
>
> **本番実装との差分**
> - 教材の生HTTPサーバは、入力上限、タイムアウト、TLS終端、プロキシ、脆弱なヘッダ処理を省略している。
>
> **典型的な失敗**
> - GETに副作用を持たせる。
> - 再送可能な操作を冪等にしない。
> - キャッシュ制御をブラウザ任せにする。
>
> **診断・デバッグ方法**
> - curl -v、ブラウザNetwork、サーバアクセスログを同じrequest IDで突き合わせる。
> - レスポンス時間をDNS・接続・TTFB・転送に分解する。
>
> **意思決定チェックリスト**
> - 操作の意味に合うメソッドと状態コードか。
> - 再送、キャッシュ、プロキシ通過時にも意味が保たれるか。
>
> **演習と評価基準**  
> 対象: [2.9 デバッグの実践技法](#section-2-9)、[2.10 実装課題 ― HTTPを「手で組み立てる」](#section-2-10) (実務選択)
> - 生のHTTPメッセージを組み立て、期待する応答を得られる。
> - 不正入力と再送時の挙動を説明できる。
>
> **一次資料・発展資料**
> - RFC 9110
> - RFC 9112
> - RFC 9113
> - RFC 9114
<!-- handbook:chapter-guide:end -->

<a id="section-2-1"></a>
### 2.1 HTTPメッセージの構造
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"H","term":"HTTP/1.1"} -->

<!-- handbook:narrative-bridge {"section":"2.1"} -->

HTTPを契約として読むには、まず一つの会話がどの部品からできているかを知る必要がある。メソッドやステータスの意味へ進む前に、リクエストとレスポンスの共通の封筒を分解する。

HTTPは「テキストベースのリクエスト/レスポンスプロトコル」である (HTTP/2以降はバイナリだが、概念は同じ)。

**リクエストの構造:**

```text
GET /api/users/42 HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0
Accept: application/json
Authorization: Bearer eyJhbGc...

(空行)
(ボディ ― GETの場合は通常なし)
```

最初の行が**リクエストライン**で、メソッド・パス・バージョンを含む。次に**ヘッダ**が並び、空行を挟んで**ボディ**が来る。

**レスポンスの構造:**

```text
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 52
Cache-Control: max-age=300

{"id":42,"name":"Alice","email":"alice@example.com"}
```

最初の行は**ステータスライン**(バージョン・ステータスコード・テキスト)、続いてヘッダとボディ。

この単純さこそがHTTPの強みだ。`telnet` や `nc` で手打ちしても通信できる。実際にやってみよう。

```bash
$ nc example.com 80
GET / HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
...
```

<a id="section-2-2"></a>
### 2.2 メソッドの意味論
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"2.2"} -->

メッセージの構造だけでは、その要求が参照なのか更新なのか、途中で再送してよいのかを判断できない。HTTPメソッドの意味論は、サーバだけでなくブラウザ、キャッシュ、プロキシが安全に振る舞うための共通情報を与える。

HTTPメソッドには2つの重要な性質がある。

| メソッド | 安全 (Safe) | 冪等 (Idempotent) | キャッシュ可能 |
|---|---|---|---|
| GET | ✓ | ✓ | ✓ |
| HEAD | ✓ | ✓ | ✓ |
| OPTIONS | ✓ | ✓ | ✗ |
| PUT | ✗ | ✓ | ✗ |
| DELETE | ✗ | ✓ | ✗ |
| POST | ✗ | ✗ | △ |
| PATCH | ✗ | ✗ | ✗ |

- **安全**: そのメソッドはサーバの状態を変更しない (GET、HEAD)
- **冪等**: 同じリクエストを何度送っても、サーバ側に残る状態が1回送ったときと変わらない (PUT、DELETE、GETなど)。応答まで同じとは限らない。DELETE の2回目は404を返しうる

この性質はインフラのあらゆる箇所で前提とされる。例えばロードバランサやプロキシは、ネットワークエラー時にGETリクエストを自動リトライするが、POSTはリトライしない。冪等でないからだ。

**よくある誤解: POSTとPUTの違い**

「新規作成はPOST、更新はPUT」ではない。正確には:

- **PUT**: 指定したURIにリソースを**まるごと配置**する (冪等)
- **POST**: サーバに**何か新しい操作**を依頼する (冪等性は保証されない)

例えば `PUT /users/42` は「IDが42のユーザーをこの内容にする」であり、存在しなければ作成、存在すれば全置換する。一方 `POST /users` は「ユーザーを作って」とサーバに依頼し、IDはサーバが決める。

<a id="section-2-3"></a>
### 2.3 ステータスコード
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"さ行","term":"ステータスコード"} -->

<!-- handbook:narrative-bridge {"section":"2.3"} -->

メソッドがクライアントの意図を表す一方、処理の結果をクライアントへ返す共通語も必要になる。ステータスコードは単なる成功・失敗の番号ではなく、リトライ、認証、リダイレクト、キャッシュの次の行動を決める入力である。

5つのクラスに分かれている。

- **1xx Informational** (続行)
- **2xx Success** (成功)
- **3xx Redirection** (リダイレクト)
- **4xx Client Error** (クライアント側のエラー)
- **5xx Server Error** (サーバ側のエラー)

実務でよく出くわすものを整理する。

| コード | 意味 | 使いどころ |
|---|---|---|
| 200 OK | 成功 | 一般的な成功 |
| 201 Created | 作成成功 | POSTでリソース作成後 |
| 204 No Content | 成功・ボディなし | DELETE成功時など |
| 301 Moved Permanently | 恒久的移動 | URL変更 (キャッシュされる) |
| 302 Found | 一時的移動 | ログイン後リダイレクト等 |
| 304 Not Modified | 未変更 | 条件付きGETの結果 |
| 400 Bad Request | リクエスト不正 | バリデーションエラー |
| 401 Unauthorized | 認証必要 | 未ログイン |
| 403 Forbidden | 認可されない | ログイン済みだが権限なし |
| 404 Not Found | 見つからない | リソース存在せず |
| 409 Conflict | 競合 | 楽観的ロック失敗時 |
| 422 Unprocessable Entity | 処理不能 | バリデーションエラー (詳細) |
| 429 Too Many Requests | レート制限 | API rate limit |
| 500 Internal Server Error | サーバエラー | 予期しない例外 |
| 502 Bad Gateway | 上流エラー | プロキシ先の異常 |
| 503 Service Unavailable | サービス停止 | メンテナンス、過負荷 |
| 504 Gateway Timeout | 上流タイムアウト | プロキシ先の応答なし |

**実務での落とし穴:**

- **401 vs 403**: 「あなたが誰か分からない」が401、「あなたは誰か分かるがダメ」が403。混同しやすい。
- **400 vs 422**: 422 は RFC 9110 §15.5.21 で「構文は理解できたが内容の指示に従えない」と定義されている。構文自体が壊れていれば400、構文は正しく値が業務上不正なら422、と分ける実装が多い。ただしフレームワークのデフォルトは割れており (Rails は422、Django REST framework は400)、APIごとに方針を決めて文書化する。
- **404 vs 403**: セキュリティ上、存在を隠したい場合は意図的に404を返すことがある (存在を匂わせない)。

<a id="section-2-4"></a>
### 2.4 ヘッダ ― HTTPの真の主役
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"ヘッダ (HTTP)"} -->

<!-- handbook:narrative-bridge {"section":"2.4"} -->

メソッドとステータスで会話の骨格は表せるが、表現形式、圧縮、キャッシュ期限、認証情報のような条件までは運べない。その可変な文脈を本文から分離して伝えるのがヘッダである。

ヘッダは多くの開発者が見落としがちだが、HTTPの挙動を制御する司令塔だ。重要なものを分類する。

**コンテンツ関連:**
- `Content-Type`: MIMEタイプ (`application/json`、`text/html` など)
- `Content-Length`: ボディのバイト数
- `Content-Encoding`: 圧縮方式 (`gzip`、`br`)
- `Accept`: クライアントが受け取れるMIMEタイプ
- `Accept-Encoding`: クライアントが対応する圧縮方式

**キャッシュ関連:**
- `Cache-Control`: キャッシュの挙動を細かく制御
- `ETag`: リソースのバージョン識別子
- `If-None-Match`: ETagと組み合わせて条件付きリクエスト
- `Last-Modified` / `If-Modified-Since`: 更新時刻ベースの条件付きリクエスト

**認証関連:**
- `Authorization`: 認証情報 (`Bearer xxx`、`Basic xxx`)
- `WWW-Authenticate`: サーバが要求する認証方式
- `Cookie` / `Set-Cookie`: セッション維持

**接続関連:**
- `Connection`: `keep-alive` で接続維持
- `Host`: 仮想ホスト判別 (1つのIPで複数ドメインを捌くのに必須)

**CORS (Cross-Origin Resource Sharing) 関連 (12.3 で詳述):**
- `Origin`、`Access-Control-Allow-Origin`、`Access-Control-Allow-Methods` など

<a id="section-2-5"></a>
### 2.5 Keep-Aliveとコネクション再利用
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"K","term":"Keep-Alive"} -->

<!-- handbook:narrative-bridge {"section":"2.5"} -->

ここまでで一つのHTTPメッセージの意味は読めるようになった。次に問題になるのは、そのメッセージを運ぶたびに接続準備を繰り返すコストである。HTTP/1.1の接続再利用は、契約を変えずに輸送の無駄を減らす。

初期のHTTP/1.0利用では、レスポンスごとにTCPコネクションを閉じる方式が一般的だった。HTTP/1.0にも後付けのKeep-Alive実装は存在したが、相互運用性は統一されていなかった。新しいTCP接続には通常1 RTTのハンドシェイクが必要で、TLSを併用すれば追加の往復も発生する。

HTTP/1.1では、`Connection: close` が指定されない限り接続を持続させるのが標準である。`Connection: keep-alive` はHTTP/1.1で接続維持を有効にするための必須指定ではない。さらに**パイプライニング** (レスポンスを待たずに後続リクエストを送る) も規格化されたが、レスポンス順序の制約やリトライの難しさから、ブラウザでは広く定着しなかった [RFC 9112]。

HTTP/1.1の根本的な制約として**ヘッドオブラインブロッキング**がある。先に送ったリクエストが遅いと、後続のレスポンスもそれを追い越せない。この問題を解決するのがHTTP/2だ。

<a id="section-2-6"></a>
### 2.6 HTTP/2 ― バイナリ多重化
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"H","term":"HTTP/2"} -->
<!-- handbook:index {"group":"は行","term":"バイナリプロトコル"} -->

<!-- handbook:narrative-bridge {"section":"2.6"} -->

接続を再利用すればハンドシェイクの重複は減るが、HTTP/1.1では一つの接続上で複数の応答を効率よく並行させにくい。ページが多数の資産を要求するようになると、この制約が新しいボトルネックになる。

HTTP/2 [Belshe et al., 2015] はGoogleのSPDYを下敷きにして設計された。主要な変更点:

1. **バイナリプロトコル化** ― テキストではなくフレーム単位のバイナリ通信
2. **ストリームによる多重化** ― 1つのTCP接続で複数のリクエスト/レスポンスを並行
3. **ヘッダ圧縮 (HPACK)** ― 同じヘッダの繰り返しを圧縮
4. **サーバプッシュ** ― クライアントが要求する前にサーバが送れる機能。ただし主要ブラウザでは利用が縮小・廃止され、実務では前提にしにくい

多重化により、HTTP/1.1のヘッドオブラインブロッキングは大幅に改善された。ただし、**TCPレベルでのブロッキング**は依然として残る。1つのTCPパケットがロスすると、そのTCP接続上の全てのストリームが待たされる。

<a id="section-2-7"></a>
### 2.7 HTTP/3 ― QUICによる革命
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"H","term":"HTTP/3"} -->
<!-- handbook:index {"group":"Q","term":"QUIC"} -->

<!-- handbook:narrative-bridge {"section":"2.7"} -->

HTTP/2は一つのTCP接続を複数のストリームへ分けた。しかし、すべてのストリームが同じTCP接続に載るため、パケット損失時にはトランスポート層の順序待ちを共有する。HTTP/3はこの残った制約を輸送層から見直す。

HTTP/3 (RFC 9114、2022年) はTCPを捨て、UDP上に新たなプロトコル **QUIC** を構築した。狙いは:

1. **ストリーム間のトランスポート層HOLブロッキングを回避** ― あるストリームのパケット損失が、別ストリームの配送まで一律に止めない。ただし同一ストリーム内の順序待ちは残る
2. **0-RTT接続再開** ― 条件を満たす再接続で早期データを送れる。ただしリプレイ可能性があるため、副作用のある操作には使わない
3. **接続マイグレーション** ― 接続IDを用いて、ネットワーク切替時にも接続を継続できる場合がある
4. **TLS 1.3を統合** ― QUICのハンドシェイクと暗号化はTLS 1.3を前提とする

UDP通信が利用できない経路や実装上の都合もあるため、クライアントとサーバはHTTP/2やHTTP/1.1へのフォールバックを考慮する [RFC 9114]。

<a id="section-2-8"></a>
### 2.8 実装例: Node.jsで生のHTTPサーバを書く
<!-- handbook:learning {"level":"practical","minutes":30} -->

<!-- handbook:narrative-bridge {"section":"2.8"} -->

HTTP/1.1からHTTP/3までを比較すると、抽象化の背後にある設計上の制約が見えてくる。ここで一度フレームワークを外し、生のHTTPサーバを作ることで、メソッド・ヘッダ・ステータスが実際にどこで組み立てられるかを確認する。

抽象化なしのHTTPサーバを実装してみよう。フレームワーク (Express など) に頼らず、Node.jsの標準モジュールだけで書く。

```typescript
// raw-http-server.ts
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // 1. リクエストの解析
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);

  // 2. ボディの受信 (ストリームとして到着する)
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf-8');

    // 3. ルーティング
    if (req.method === 'GET' && url.pathname === '/users/42') {
      const data = { id: 42, name: 'Alice' };
      const json = JSON.stringify(data);

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json),
        'Cache-Control': 'max-age=60',
        'ETag': '"abc123"',
      });
      res.end(json);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/echo') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`You sent: ${body}`);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

実行して `curl -v` で観察する。

```bash
$ curl -v http://localhost:3000/users/42
> GET /users/42 HTTP/1.1
> Host: localhost:3000
> User-Agent: curl/7.79.1
> Accept: */*
>
< HTTP/1.1 200 OK
< Content-Type: application/json; charset=utf-8
< Content-Length: 24
< Cache-Control: max-age=60
< ETag: "abc123"
< Date: Tue, 19 May 2026 12:00:00 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
<
{"id":42,"name":"Alice"}
```

`> ` がクライアントから送ったヘッダ、`< ` がサーバから返ったヘッダ。Node.jsが裏で自動付与した `Date`、`Connection`、`Keep-Alive` も見える。

**ストリーミングレスポンス:**

大きなデータを返すときは、全部をメモリに乗せずにストリームで返すべきだ。

```typescript
import { createReadStream } from 'node:fs';

if (req.method === 'GET' && url.pathname === '/download') {
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': 'attachment; filename="large.bin"',
    // Content-Lengthはstreamなので自動でTransfer-Encoding: chunkedになる
  });
  createReadStream('./large-file.bin').pipe(res);
  return;
}
```

`Content-Length` を省略すると、HTTPは `Transfer-Encoding: chunked` で送信し、受信側はストリームとして処理できる。

<a id="section-2-9"></a>
### 2.9 デバッグの実践技法
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"2.9"} -->

自分でメッセージを組み立てられるようになると、デバッグは「何となく動かない」状態から、期待したメッセージと観測したメッセージの差を探す作業へ変わる。ここでは各層で事実を採取する道具を整理する。

トラブルシュート時に必須の道具:

- **`curl -v`**: ヘッダ含めて詳細表示。`-H` でヘッダ追加、`-d` でPOSTボディ
- **`curl --resolve`**: DNSを上書きして特定IPに送る (デプロイ前検証で有用)
- **`http` (httpie)**: より人間に優しいCLI
- **ブラウザDevTools**: NetworkタブでHARエクスポート可能
- **`tcpdump` / `Wireshark`**: パケットレベル解析
- **`mitmproxy`**: TLSを復号化してインスペクト

<a id="section-2-10"></a>
### 2.10 実装課題 ― HTTPを「手で組み立てる」
<!-- handbook:learning {"level":"practical","minutes":240} -->

<!-- handbook:narrative-bridge {"section":"2.10"} -->

HTTPの各要素を個別に読んだだけでは、組み合わせたときの振る舞いまでは身につかない。演習ではソケットからREST (Representational State Transfer) APIまでを段階的に組み立て、意味論が再送・キャッシュ・エラー処理へどう影響するかを観察する。

第2章では HTTP の構造を学んだ。本節では実際にコードを書いて手で組み立て、頭の中の理解を「指の記憶」に変える。所要時間: 演習カードの推定時間の合計で7時間45分。

#### 課題2.1: 生のソケットでHTTPリクエストを送る (★★)

**目的**: HTTPは「TCPの上で動くテキストプロトコル」であることを実感する。

<!-- handbook:exercise:start {"id":"2.1"} -->
> **演習カード 課題2.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 2.1 HTTPメッセージの構造 を読み、リクエストライン・ヘッダ・空行・ボディの並びを書き出せる
> - Node.js の net モジュールで `net.createConnection` を使いTCPソケットを開ける
> - Buffer の `indexOf` と `subarray` でバイト列を切り出せる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch02/raw-http-client.ts` に http / https モジュールを import せず、net だけで実装している
> - [ ] レスポンス解析関数が `statusCode` を数値、`headers` を Map、`body` を Buffer として返す
> - [ ] `Content-Length` の値を読み、ボディをその長さで切り詰めている (余分なバイトが続いていても捨てる)
> - [ ] ヘッダ名を小文字化して格納し、同名ヘッダが複数来た場合は `, ` で連結している
> - [ ] example.com の `/` に対して 200 のステータス行とHTMLボディを取得できる
> - [ ] ヘッダ境界が現れないバイト列や不正な Content-Length で例外を投げる
>
> **期待出力**
>
> - 標準出力の1行目が `HTTP/1.1 200 OK` の形式で、続けて `content-type: text/html; charset=UTF-8` などのヘッダ行が並ぶ
> - ヘッダの後に空行を挟み、`<!doctype html>` で始まるボディが出力される
> - `content-length` ヘッダの数値と、出力されたボディのバイト数が一致する
> - 存在しないパスを指定すると `HTTP/1.1 404 Not Found` のステータス行が返る
>
> **観察項目**
>
> - `Connection: close` を送るとサーバ側から切断され `end` イベントが来ることを確認し、Keep-Alive では終端が来ないことと対比する
> - `data` イベントごとに受信バイト数をログへ出し、ヘッダとボディが1回のイベントで届くとは限らないことを確認する
> - `Accept-Encoding: identity` を外すと `content-encoding: gzip` が返り、ボディがそのままでは読めなくなることを確認する
> - chunked を返すサーバでは `content-length` が無く、本文に16進のチャンクサイズ行が挟まることを生バイトで確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch02 run test` を実行し、`raw HTTP response parser separates status, headers, and body` がパスすることを確認する
> 2. `rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02 && node /tmp/ch02/raw-http-client.js example.com /` を実行し、ステータス行・ヘッダ・HTMLボディの3ブロックが順に出れば合格とする
> 3. ヘッダ境界のないバイト列を解析関数へ渡し、無言で不正な結果を返さず例外になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ソケットから届くバイトを貯める処理と、貯まったバッファを解析する処理を別の関数に分ける。先に解析関数だけを固定文字列でテストすると切り分けが楽になる。
> 2. **構造**: `net.createConnection` で接続し、`connect` イベントでリクエスト行とヘッダを `\r\n` 区切りで書く。`data` イベントで Buffer を配列へ push し、`end` で `Buffer.concat` してから `raw.indexOf('\r\n\r\n')` でヘッダ境界を探す。
> 3. **実装の要点**: ヘッダ部は `latin1` で文字列化し、ボディは Buffer のまま扱うと文字化けを避けられる。`content-length` を読んだら `body.subarray(0, length)` で切り詰める。シグネチャは `parseHttpResponse(raw: Buffer): HttpResponse` の形になる。
>
> **本番利用時の警告**
>
> - この自作パーサはヘッダ行数・ヘッダ長・ボディ長の上限を持たないため、そのまま公開サービスへ組み込むとメモリ枯渇によるDoSを受ける。本番では実装済みのHTTPクライアントを使う
> - TLS、証明書検証、リダイレクト追跡、圧縮の解凍を一切行わないため https のURLへは接続できず、平文で送った内容は経路上で読まれる
>
> **導線**
>
> - 開始地点: `code/ch02/raw-http-client.ts`
> - 模範解答: `code/ch02/raw-http-client.solution.ts`
>
> **推定時間の内訳**: 解析関数の実装に35分、ソケット接続と受信バッファ結合に25分、chunkedと異常系の追加に20分、観察記録に10分
<!-- handbook:exercise:end -->

**手順**: Node.js の `net` モジュール (TCPソケット) だけで HTTP/1.1 リクエストを送信し、レスポンスをパースする。

**要件**:
- `http` / `https` モジュールは**使わない**(TCPだけ)
- リクエストラインとヘッダを文字列として組み立てる
- レスポンスを「ステータス行」「ヘッダ」「ボディ」の3部分に分解
- `Content-Length` を読み取って、ボディの正しい長さを抽出
- Chunked Transfer Encoding にも対応 (発展課題)

**ヒント**:
- HTTP の行末は `\r\n`(LF だけはNG)
- ヘッダとボディの境界は `\r\n\r\n`
- TCPは「ストリーム」なので、データが分割されて届くことに注意 (`data` イベントで受信バッファに追記し、`\r\n\r\n` が来たらヘッダパース開始)

**評価基準**:
- 200 OK のレスポンスでステータス・ヘッダ・ボディを正しく分離できる
- 複数のヘッダ行を Map として取り出せる
- 異なるサーバ (`example.com`、`httpbin.org`) で動作する

模範解答: `code/ch02/raw-http-client.solution.ts`

#### 課題2.2: 最小HTTPサーバを自作 (★★)

**目的**: HTTP サーバの仕事は「ソケットからリクエストを読み、レスポンスを書く」だけだと体感する。

<!-- handbook:exercise:start {"id":"2.2"} -->
> **演習カード 課題2.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: localhost
>
> **前提**
>
> - 課題2.1 のレスポンス解析、または 2.1 HTTPメッセージの構造 の読了
> - 2.3 ステータスコード を読み、200 / 400 / 404 の使い分けを説明できる
> - `net.createServer` でTCPサーバを listen し、curl から接続できる環境がある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `net.createServer()` だけでサーバを構成し、http モジュールを使っていない
> - [ ] `GET /` が `Hello, World!`、`GET /echo/test` が `test`、`POST /echo` がリクエストボディをそのまま返す
> - [ ] 未定義のパスで 404、リクエストラインやヘッダが不正なときに 400 を返す
> - [ ] すべてのレスポンスに正しいバイト数の `Content-Length` と `Connection: close` を付けている
> - [ ] `Content-Length` 分のボディが届くまでレスポンスを返さず、データの分割到着に耐える
>
> **期待出力**
>
> - `curl -i http://127.0.0.1:3000/` が `HTTP/1.1 200 OK` と `Content-Length: 13` を返し、本文が `Hello, World!` になる
> - `curl -i http://127.0.0.1:3000/echo/test` の本文が4バイトの `test` になる
> - `curl -i -X POST -d 'hello' http://127.0.0.1:3000/echo` の本文が `hello` になる
> - `curl -i http://127.0.0.1:3000/none` が `HTTP/1.1 404 Not Found` を返す
> - リクエストラインが不正なバイト列に対して `HTTP/1.1 400 Bad Request` が返る
>
> **観察項目**
>
> - `curl -v` の出力で、レスポンス後にサーバ側から接続が閉じられていることを確認し、Keep-Alive の場合との違いを見る
> - `Content-Length` をわざと1バイト減らすとcurlが本文を途中で切ることを確認し、ヘッダが本文の解釈を支配していると分かる
> - ヘッダ終端の空行を送らずに接続を保持すると、サーバが応答を保留したままになることを確認し、タイムアウト設計が必要な理由を見る
> - `/echo/%E3%81%82` のようなパーセントエンコード済みパスを叩き、デコードの有無で出力が変わることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch02 run test` を実行し、`raw server handles GET and POST echo routes` がパスすることを確認する
> 2. サーバ起動後に `curl -i http://127.0.0.1:3000/ && curl -i http://127.0.0.1:3000/echo/test && curl -i -X POST -d 'hello' http://127.0.0.1:3000/echo` を実行し、3件とも 200 と期待どおりの本文なら合格とする
> 3. `printf 'BAD\r\n\r\n' > /tmp/bad-request.txt` を作り `nc 127.0.0.1 3000 < /tmp/bad-request.txt` を実行して `HTTP/1.1 400 Bad Request` が返ることを確認する
> 4. `curl -i http://127.0.0.1:3000/none` が 404 を返すことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: サーバの仕事を「バイトを貯める」「リクエストへ解析する」「経路を選ぶ」「レスポンスをシリアライズする」の4段に分ける。経路はまず `GET /` の1本だけ通す。
> 2. **構造**: `net.createServer((socket) => ...)` の `data` イベントで Buffer を貯め、`\r\n\r\n` が現れたらリクエストラインとヘッダを解析する。解析結果から `route()` で `{ status, reason, body }` を作り、`serializeResponse()` でヘッダ付き Buffer に変換して `socket.end()` する。
> 3. **実装の要点**: 詰まりやすいのはボディ未着の扱いで、解析関数から `null` を返して次の `data` を待つのが要点になる。`Content-Length` の値と、受信済みバイト数 (`raw.length - boundary - 4`) を比べて判定する。
>
> **本番利用時の警告**
>
> - この自作サーバはリクエスト行長・ヘッダ数・ボディサイズの上限がなく、接続を占有する Slowloris 型の攻撃やメモリ枯渇に無防備である。公開インタフェースで listen せず `127.0.0.1` に限定する
> - 受け取ったパスやボディをそのまま返すため、ブラウザから開けば Content-Type 次第で反射型XSSの土台になる。実運用ではエスケープと Content-Type の固定が必須になる
>
> **導線**
>
> - 開始地点: `code/ch02/raw-http-server.ts`
> - 模範解答: `code/ch02/raw-http-server.solution.ts`
>
> **推定時間の内訳**: リクエスト解析の実装に30分、ルーティングとシリアライズに25分、400と404およびボディ分割到着の対応に20分、curlでの動作確認に15分
<!-- handbook:exercise:end -->

**手順**: `net.createServer()` だけで HTTP/1.1 サーバを実装する。

**要件**:
- GET と POST に対応
- ルーティング:
  - `GET /` → `Hello, World!` を返す
  - `GET /echo/:message` → URL パラメータをそのまま返す
  - `POST /echo` → リクエストボディをそのまま返す
  - 上記以外 → 404 Not Found
- `Content-Length` を正しく設定する
- Connection: close で1リクエストごとに切断 (Keep-Alive 対応は発展課題)

**評価基準**:
- `curl http://localhost:3000/` で `Hello, World!` が返る
- `curl http://localhost:3000/echo/test` で `test` が返る
- `curl -X POST -d "hello" http://localhost:3000/echo` で `hello` が返る
- 不正なリクエストで 400 が返る

模範解答: `code/ch02/raw-http-server.solution.ts`

#### 課題2.3: HTTP のメソッドとステータスコードを正しく使う (★)

**目的**: REST API としての正しいメソッド・ステータスコードの使い分けを身につける。

<!-- handbook:exercise:start {"id":"2.3"} -->
> **演習カード 課題2.3** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 2.2 メソッドの意味論 と 2.3 ステータスコード を読み、安全性と冪等性の違いを説明できる
> - `code/ch02/blog-api/starter/README.md` を読み、6つのエンドポイント仕様を把握している
> - `node:http` の createServer とリクエストボディのストリーム読み取りができる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] GET /posts が 200 とJSON配列、GET /posts/:id が存在時 200・不在時 404 を返す
> - [ ] POST /posts が 201 と `Location: /posts/<新ID>` を返し、title か body が欠けた入力では 400 を返す
> - [ ] PUT /posts/:id が全置換で 200、PATCH /posts/:id が部分更新で 200、いずれも不在IDで 404 を返す
> - [ ] DELETE /posts/:id が 204 を返し、レスポンス本文が0バイトである
> - [ ] 同じ本文でPOSTを2回実行すると別IDの記事が2件でき、同じ本文でPUTを2回実行しても結果が変わらないことを確認している
>
> **期待出力**
>
> - POST のレスポンスが `HTTP/1.1 201 Created` と `Location: /posts/2` の形式のヘッダを含む
> - 作成された本文が `{"id":2,"title":"New","body":"Text"}` のように id / title / body の3キーを持つJSONになる
> - DELETE のレスポンスが `HTTP/1.1 204 No Content` で、本文が空になる
> - 不正なJSONを送ると 400 と `{"error":...}` 形式のJSONが返る
> - JSONレスポンスには `Content-Type: application/json; charset=utf-8` が付く
>
> **観察項目**
>
> - POSTを3回叩き `Location` のIDが単調増加すること、つまりPOSTが冪等でないことを確認する
> - 同じ本文でPUTを2回叩き、レスポンスのJSONが完全に一致すること、つまりPUTが冪等であることを確認する
> - 存在しないIDへのPUTが 404 になり、201 で新規作成しない設計であることを確認し、仕様上のupsert可否と比べる
> - DELETE成功後に同じIDをGETすると 404 になり、状態遷移がステータスコードに現れることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch02 run test` を実行し、`blog API returns REST status codes and Location` がパスすることを確認する
> 2. サーバ起動後に `curl -i -X POST http://127.0.0.1:3001/posts -H 'content-type: application/json' -d '{"title":"New","body":"Text"}'` を実行し、201 と Location ヘッダの両方が出れば合格とする
> 3. `curl -i -X DELETE http://127.0.0.1:3001/posts/1` の後に `curl -i http://127.0.0.1:3001/posts/1` を実行し、204 の次に 404 が返ることを確認する
> 4. `curl -i -X POST http://127.0.0.1:3001/posts -H 'content-type: application/json' -d '{"title":""}'` が 400 を返すことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ルーティングを先に表として書き出し、メソッドとパス形状 (`/posts` か `/posts/:id` か) の2軸で分岐を作る。ステータスコードは分岐の出口ごとに1つ決めておく。
> 2. **構造**: `new URL(request.url, 'http://localhost')` で pathname を取り、`/^\/posts\/(\d+)$/` でIDを抜く。保存先は `Map<number, Post>` にし、`nextId` を単調増加のカウンタで持つ。
> 3. **実装の要点**: 204 は本文を書いてはいけないため `response.writeHead(204)` の直後に `response.end()` だけを呼ぶ。PATCH は欠けたキーを既存値で埋め、PUT は欠けたキーを 400 にする、という扱いの差が両者の分かれ目になる。
>
> **本番利用時の警告**
>
> - 保存先がプロセス内の Map なので再起動で全件消え、複数プロセスへ増やすと内容が食い違う。永続化と排他制御は第14章以降の題材になる
> - 認証・認可・レート制限・CSRF対策が一切ないため、この状態で公開すると誰でも記事を削除できる
>
> **導線**
>
> - 開始地点: `code/ch02/blog-api/starter/README.md`
> - 模範解答: `code/ch02/blog-api/solution.ts`、`code/ch02/blog-api/solution/README.md`
>
> **推定時間の内訳**: ルーティングとハンドラの実装に20分、ステータスとLocationの調整に10分、curlによる冪等性の確認に10分、失敗系の追加に5分
<!-- handbook:exercise:end -->

**設定**: `code/ch02/blog-api/` にスケルトンを用意した。これを完成させる。

**仕様**:

| メソッド | パス | 動作 | 成功時ステータス | エラー時ステータス |
|---|---|---|---|---|
| GET | `/posts` | 全記事取得 | 200 | - |
| GET | `/posts/:id` | 記事1件取得 | 200 | 404(存在しない時) |
| POST | `/posts` | 記事作成 | 201 + Location ヘッダ | 400(バリデーション失敗) |
| PUT | `/posts/:id` | 記事全置換 | 200 | 404 |
| PATCH | `/posts/:id` | 記事部分更新 | 200 | 404, 400 |
| DELETE | `/posts/:id` | 記事削除 | 204 (No Content) | 404 |

**評価基準**:
- 各メソッドが正しいステータスを返す
- POST 成功時に `Location: /posts/<新ID>` ヘッダがある
- DELETE は本文を返さず 204
- 同じ ID への POST 連続実行で異なる結果 (POST は冪等でない)
- 同じ内容での PUT 連続実行で同じ結果 (PUT は冪等)

模範解答: `code/ch02/blog-api/solution.ts`

#### 課題2.4: HTTP/1.1 vs HTTP/2 の体感ベンチマーク (★★★)

**目的**: 「HTTP/2 はなぜ速いのか」を実測で理解する。

<!-- handbook:exercise:start {"id":"2.4"} -->
> **演習カード 課題2.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: OpenSSL/TLS
>
> **前提**
>
> - 2.5 Keep-Aliveとコネクション再利用 と 2.6 HTTP/2 ― バイナリ多重化 を読み、ヘッドオブラインブロッキングの発生箇所を説明できる
> - openssl が PATH にあり、`openssl req -x509` で自己署名証明書を作れる
> - `node:http2` と `node:https` の非同期APIを Promise でまとめられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `certs/localhost-key.pem` と `certs/localhost-cert.pem` を生成し、`allowHTTP1: true` のTLSサーバを1つだけ起動している
> - [ ] サーバが `/asset/<数字>` に対して1024バイトの固定ペイロードを返し、それ以外は 404 を返す
> - [ ] 同一サーバに対しHTTP/1.1 (最大6ソケット) とHTTP/2 (1セッション多重化) の両方で100件を取得し、所要ミリ秒を出力している
> - [ ] ウォームアップ後に3回以上計測し、単発値ではなく中央値または分布を記録している
> - [ ] 測定条件 (COUNT、maxSockets、CPU、ネットワーク遅延、TLSセッション再利用の有無) を記録に残している
>
> **期待出力**
>
> - クライアントが `console.table` で protocol / requests / ms の3列を持つ2行の表を出力する
> - 表の後に、結果が測定条件に依存する旨の1行が出力される
> - サーバ起動時に `benchmark server: https://127.0.0.1:3444` が表示される
> - 100件の取得ではHTTP/2側が小さい値になることが多いが、ループバックでは差が数ミリ秒まで縮むこともある
>
> **観察項目**
>
> - HTTP/1.1側の `maxSockets` を 1 / 6 / 20 と変えて再測定し、並列度が結果を支配することを確認する
> - `tcpdump -i lo0 port 3444` などでパケットを見て、HTTP/1.1が複数のTCP接続を張るのに対しHTTP/2が1接続で済むことを確認する
> - ペイロードを1KBから100KBへ増やし、多重化の利得が帯域律速で消えることを確認する
> - ループバックは遅延がほぼ0のため、外部ホストや遅延注入を加えると差が拡大することを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -keyout certs/localhost-key.pem -out certs/localhost-cert.pem -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'` を実行し、2ファイルが生成されれば準備完了とする
> 2. `rm -rf /tmp/ch02 && tsc -p code/ch02/tsconfig.json --outDir /tmp/ch02 && node /tmp/ch02/benchmark/solution/server.js` でサーバを起動し、別ターミナルで `node /tmp/ch02/benchmark/solution/client.js` が2行の表を出せば計測が成立している
> 3. `COUNT=10` と `COUNT=200` で実行し、リクエスト数の増加に伴ってHTTP/1.1側の増え方が急になることを確認する
> 4. 記録に3回以上の測定値が残り、単一回の結果でHTTP/2の優位を結論づけていなければ合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 比較の妥当性はサーバを1つにすることで決まる。`allowHTTP1: true` の同じTLSサーバへ、クライアント側だけプロトコルを変えて接続する構成にする。
> 2. **構造**: HTTP/1.1側は `new https.Agent({ keepAlive: true, maxSockets: 6 })` を使い、HTTP/2側は `http2.connect(origin)` で1セッションを作り `session.request({ ':path': ... })` を100本並べる。両方とも `Promise.all` で完了を待ち `performance.now()` の差を取る。
> 3. **実装の要点**: 自己署名証明書のため両クライアントで `rejectUnauthorized: false` が必要になる。またレスポンスを読み捨てないと `end` が来ないので、HTTP/1.1側は `response.resume()`、HTTP/2側は `request.on('data', () => {})` を必ず入れる。
>
> **本番利用時の警告**
>
> - `rejectUnauthorized: false` は証明書検証そのものを無効にし、中間者攻撃を検出できなくする。localhost の計測専用にとどめ、アプリケーションのコードへ持ち込まない
> - 生成した鍵と証明書はリポジトリへコミットしない。`-days 1` のような短命の証明書を都度作り捨てる
> - 同じ手順を第三者のホストへ向けると負荷試験にあたる。許可のない対象へ100並列のリクエストを送らない
>
> **導線**
>
> - 開始地点: `code/ch02/benchmark/starter/README.md`
> - 模範解答: `code/ch02/benchmark/solution/server.ts`、`code/ch02/benchmark/solution/client.ts`、`code/ch02/benchmark/solution/README.md`
>
> **推定時間の内訳**: 証明書生成とサーバ起動に20分、2種のクライアント実装に50分、条件を変えた反復計測に50分、tcpdump観察と記録に30分
<!-- handbook:exercise:end -->

**手順**:
1. `code/ch02/benchmark/` にあるサーバとクライアントを起動
2. サーバは 100 個の小さな画像 (1KB 各) を返す
3. クライアントは HTTP/1.1 と HTTP/2 でそれぞれ 100 個を同時に取得
4. それぞれの完了時間を比較

**観察するポイント**:
- HTTP/1.1では、クライアントの接続数、Keep-Alive、パイプライニングの有無で結果が変わる
- HTTP/2では、同一接続上の複数ストリームとして処理されるか確認する
- 遅延、パケット損失、TLSセッション再利用、キャッシュの有無を固定して比較する
- 「HTTP/2なら常に高速」と結論づけず、測定条件とボトルネックを記録する

**発展**: tcpdump で実際のパケットを観察し、HTTP/1.1 の「複数の TCP 接続」 vs HTTP/2 の「1接続多重化」を確認する。

模範解答: `code/ch02/benchmark/`

#### 課題2.5: パフォーマンスのアンチパターンを再現する (★★)

**目的**: 「やってはいけない HTTP」のパターンを実装し、なぜ遅いか測定する。

<!-- handbook:exercise:start {"id":"2.5"} -->
> **演習カード 課題2.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 2.4 ヘッダ ― HTTPの真の主役 を読み、`Accept-Encoding` と `Content-Encoding` の役割を説明できる
> - 2.5 Keep-Aliveとコネクション再利用 を読み、TCP接続確立のコストを見積もれる
> - `node:http` の Agent と `performance.now()` で経過時間を測れる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] ローカルHTTPサーバを1つ立て、`/small` `/bundle` `/json` の3経路で比較用のレスポンスを返している
> - [ ] 小さなリクエストを100回送る場合と1回にまとめる場合の所要時間を、同一プロセス内で計測している
> - [ ] Keep-Aliveなしとありを同じ回数で計測している
> - [ ] `Accept-Encoding: gzip` の有無で同じ大きなJSONを取得し、所要時間と転送バイト数の両方を記録している
> - [ ] 各アンチパターンの超過時間を、接続確立回数・リクエスト数・転送バイト数のどれで説明できるか書いている
>
> **期待出力**
>
> - `console.table` に label と ms の2列で6行 (小さなリクエスト、まとめて1回、Keep-Aliveなし、Keep-Aliveあり、gzipなし、gzipあり) が出力される
> - 表の後に `plain JSON=NNNNNN bytes, gzip=NNNN bytes` の1行が出て、gzip後が1桁以上小さくなる
> - まとめて1回の値は、小さなリクエスト100回より一桁小さいミリ秒になる
> - Keep-Aliveなしはあり側より遅く、その差は接続回数に比例して広がる
>
> **観察項目**
>
> - COUNT を 10 / 100 / 500 と変え、超過時間がリクエスト数に対しておおむね線形に伸びることを確認する
> - Keep-Aliveなしの計測中に `netstat -an` の出力を見て、TIME_WAIT 状態のソケットが増えることを確認する
> - gzipあり・なしで ms の差が小さいのに転送バイト数が大きく減る場合を見て、ループバックでは帯域が支配要因でないと理解する
> - サーバとクライアントが同一プロセスであることを踏まえ、実ネットワークでは各差分がRTTの分だけ拡大すると見積もる
>
> **テスト方法 (自己採点手順)**
>
> 1. `COUNT=100 bash code/ch02/antipatterns/solution/main.sh` を実行し、6行の表と `plain JSON=... gzip=...` の行が出れば計測が成立している
> 2. 表の `one bundled request` が `100 small requests` より小さい値になっていれば、リクエスト数削減の効果を再現できている
> 3. `COUNT=10` と `COUNT=200` で同じスクリプトを実行し、Keep-Alive有無の差が回数に応じて広がることを確認する
> 4. 各行の差をミリ秒で書き出し、原因 (接続確立、往復回数、転送量) と対応付けた表が完成していれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3つのアンチパターンを別スクリプトに分けず、1つのサーバと1つの計測関数で回すと条件が揃う。まず `measure(label, fn)` の形の計測関数を作る。
> 2. **構造**: 経路は `/small` (256バイト)、`/bundle` (256バイト×COUNT)、`/json` (`accept-encoding` に応じて gzip 済みか生かを返す) の3つで足りる。クライアント側は `new http.Agent({ keepAlive: true })` を渡す場合と `agent: false` の場合を切り替える。
> 3. **実装の要点**: gzip比較は事前に `gzipSync(json)` した Buffer を持っておき、`content-encoding: gzip` を付けるかどうかだけを切り替える。`content-length` を実際に返す本文の長さへ合わせないと、クライアントが受信完了を待ち続ける。
>
> **本番利用時の警告**
>
> - ループバック上の計測は接続確立コストとRTTを過小評価する。ここで得た数値をそのまま本番の改善見込みとして提示しない
> - 同じ負荷スクリプトを第三者のサーバへ向けるとDoSにあたる。計測対象は自分が起動したローカルサーバに限定する
>
> **導線**
>
> - 開始地点: `code/ch02/antipatterns/starter/main.sh`
> - 模範解答: `code/ch02/antipatterns/solution/main.sh`、`code/ch02/antipatterns/solution/benchmark.mjs`
>
> **推定時間の内訳**: 計測用サーバと3経路の実装に30分、6条件の計測関数に25分、COUNTを変えた反復に20分、原因との対応付けの記述に15分
<!-- handbook:exercise:end -->

**3つのアンチパターン**:

1. **大量の小さなリクエスト**: 1000 リソースを1個ずつ取得 vs 1個にまとめて取得
2. **Keep-Alive なし**: 各リクエストで TCP 接続を作り直す
3. **圧縮なし**: gzip を無効化して大きな JSON を送る

**手順**: `code/ch02/antipatterns/` のスクリプトを実行して、各パターンの所要時間を計測し、改善版と比較。

**問題**: 各アンチパターンが「何 ms 余計にかかったか」を計測し、その理由を本書の解説と結びつけて説明せよ。

模範解答: `code/ch02/antipatterns/solution.md`

---

<!-- handbook:code-usage:start {"chapter":2} -->
### 第2章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第2章の模範解答をまとめて検証する
pnpm --filter @handbook/ch02 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch02 exec tsx raw-http-client.solution.ts   # 課題2.1
pnpm --filter @handbook/ch02 exec tsx raw-http-server.solution.ts   # 課題2.2
pnpm --filter @handbook/ch02 exec tsx blog-api/solution.ts          # 課題2.3
pnpm --filter @handbook/ch02 exec tsx benchmark/solution/server.ts  # 課題2.4
bash code/ch02/antipatterns/solution/main.sh                        # 課題2.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch02/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


HTTPの契約を読めるようになっても、そのメッセージは宛先へ届く通信路がなければ始まらない。次章では、HTTPより前に働くURLの解釈、DNSによる名前解決、TLSによる相手確認と暗号化を一つの接続手順として扱う。

---

<a id="chapter-3"></a>
## 第3章 URL・DNS・TLS

第2章でHTTPメッセージの読み方は分かった。しかし、`GET /login` というメッセージだけでは、どのコンピュータへ接続するのかも、その相手を信頼してよいのかも決まらない。HTTPの会話を始める前には、URLを分解し、ホスト名を通信可能な宛先へ変換し、必要なら暗号化された通信路を確立する工程がある。

本章では、ユーザーが `https://example.com/login` を入力してから最初のHTTPリクエストを送れる状態になるまでを追う。URL、DNS、TLSは別々の用語として暗記するのではなく、「何を求めるか」「どこへ届けるか」「相手と通信内容をどう信頼するか」という連続した問いへの答えとして扱う。

<!-- handbook:chapter-guide:start {"chapter":3} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 「サイトにつながらない」「証明書エラーになる」「一部地域だけ遅い」を、URL解析、名前解決、暗号化通信の各段階に切り分ける。
>
> **到達目標**
> - URLの構成要素とサーバへ送られない部分を説明できる。
> - DNS解決の階層、キャッシュ、TTLの影響を説明できる。
> - TLSが提供する機密性・完全性・相手認証と、提供しない保証を説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [2.1 HTTPメッセージの構造](#section-2-1) ― HTTPメッセージの構造
> - [2.5 Keep-Aliveとコネクション再利用](#section-2-5) ― 接続再利用
>
> **中核概念**  
> [3.1 URI/URL/URN](#section-3-1)、[3.2 DNS ― 名前を住所に変える](#section-3-2)、[3.3 TLS/SSL ― 通信を暗号化する](#section-3-3)、[3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](#section-3-5)
>
> **最小実装**  
> [3.4 実装例: 自己署名証明書でHTTPSサーバを立てる](#section-3-4) (実務選択)、[3.6 実装課題 ― URL・DNS・TLS を「見る」](#section-3-6) (実務選択)
>
> **本番実装との差分**
> - 自己署名証明書は学習用であり、公開環境では信頼された認証局、自動更新、秘密鍵保護、適切なTLS設定が必要になる。
>
> **典型的な失敗**
> - DNS変更が即時反映されると思い込む。
> - 証明書のホスト名、期限、中間証明書を確認しない。
> - URLへ秘密情報を含める。
>
> **診断・デバッグ方法**
> - dig/nslookup、curl -v、openssl s_clientでDNS・TCP・TLSを別々に確認する。
> - 証明書チェーンとSNI、ALPNを記録する。
>
> **意思決定チェックリスト**
> - DNSの可用性と変更手順をどう設計するか。
> - TLS終端をアプリ、リバースプロキシ、クラウドLBのどこに置くか。
>
> **演習と評価基準**  
> 対象: [3.6 実装課題 ― URL・DNS・TLS を「見る」](#section-3-6) (実務選択)
> - 名前解決とTLS失敗を再現し、どの層で失敗したか説明できる。
>
> **一次資料・発展資料**
> - RFC 3986
> - RFC 1034/1035
> - RFC 8446
> - CA/Browser Forum Baseline Requirements
<!-- handbook:chapter-guide:end -->

<a id="section-3-1"></a>
### 3.1 URI/URL/URN
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"U","term":"URL/URI/URN"} -->

<!-- handbook:narrative-bridge {"section":"3.1"} -->

HTTPが要求を運ぶには、要求対象と接続先を表す文字列が必要になる。URLは単なるアドレス表示ではなく、スキーム、権限情報、ホスト、パス、クエリ、フラグメントへ責務を分けた構造である。

混同されがちだが正確には:

- **URI** (Uniform Resource Identifier): リソースを識別する文字列の総称
- **URL** (Uniform Resource Locator): 「場所」で識別するURI (例: `https://example.com/foo`)
- **URN** (Uniform Resource Name): 「名前」で識別するURI (例: `urn:isbn:9784873119045`)

実務では「URL」と呼んでおいて、まず問題ない。

**URLの構造:**

```text
https://user:pass@www.example.com:8080/path/to/resource?key=value&x=1#section
└─┬─┘   └───┬───┘ └──────┬──────┘ └─┬┘└───────┬───────┘ └─────┬─────┘ └──┬──┘
scheme  userinfo       host     port    path            query    fragment
```

- **scheme**: プロトコル (`https`、`mailto`、`ws`、`file` など)
- **userinfo**: 認証情報 (HTTPでは原則使わない、セキュリティリスク)
- **host**: ドメイン名またはIPアドレス
- **port**: ポート番号 (省略時はスキーマのデフォルト、HTTPSなら443)
- **path**: リソースのパス
- **query**: クエリパラメータ (キー=値のペア)
- **fragment**: 文書内の位置 (ブラウザだけが処理、サーバには送られない)

**URLエンコーディング (パーセントエンコーディング):**

URLには使えない文字 (空白、日本語、記号の一部) は `%XX` 形式でエンコードする。

```typescript
encodeURIComponent('東京 都'); // "%E6%9D%B1%E4%BA%AC%20%E9%83%BD"
decodeURIComponent('%E6%9D%B1'); // "東"

// 注意: encodeURIComponent は / や ? もエンコードする
// encodeURI は URL 全体用で、構造文字 (/, ?, #) は保持する
encodeURIComponent('foo/bar?baz'); // "foo%2Fbar%3Fbaz"
encodeURI('foo/bar?baz');          // "foo/bar?baz"
```

クエリ文字列を手作業で連結するより、`URL` と `URLSearchParams` を使う方が安全である。低レベルに値だけをエンコードする場合は `encodeURIComponent` を使うが、すでにエンコード済みの値を再度処理すると二重エンコードになる点に注意する。

<a id="section-3-2"></a>
### 3.2 DNS ― 名前を住所に変える
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"D","term":"DNS"} -->

<!-- handbook:narrative-bridge {"section":"3.2"} -->

URLからホスト名を取り出しても、ネットワークは `example.com` という名前へ直接パケットを送れない。人間とサービスが使う安定した名前を、通信時点のIPアドレスへ変換する層としてDNSが必要になる。

ドメイン名 `example.com` をIPアドレス (2026年8月時点では `23.215.0.136` など) に変換するのがDNS (Domain Name System) だ。アドレスは運用側の都合で変わるため、手元で `dig example.com A` を引いて確かめてほしい。

**階層構造:**

DNSは木構造になっている。

```text
                  . (ルート)
                 /  |  \
              com  jp   org
              /     |
        example   co
        /         /
      www       google
```

**名前解決のフロー:**

クライアントが `www.example.com` を解決する流れ:

1. クライアントは設定された**リゾルバ** (通常はISPやGoogle Public DNSなど) に問い合わせる
2. リゾルバはキャッシュを確認、なければ再帰的に問い合わせる
3. ルートサーバに問い合わせ → 「`.com` の権威サーバはここ」と返答
4. `.com` 権威サーバに問い合わせ → 「`example.com` の権威サーバはここ」と返答
5. `example.com` の権威サーバに問い合わせ → IPアドレスを取得
6. リゾルバはキャッシュに保存し、クライアントに返す

各レコードには **TTL (Time To Live)** があり、その秒数だけキャッシュされる。

**主要なレコードタイプ:**

| タイプ | 内容 |
|---|---|
| A | IPv4アドレス |
| AAAA | IPv6アドレス |
| CNAME | 別名 (他のドメインへの参照) |
| MX | メールサーバ |
| NS | 権威ネームサーバ |
| TXT | テキスト (SPF、DKIM、ドメイン所有確認など) |
| SRV | サービスの場所 (port含む) |
| CAA | どのCAが証明書を発行できるか |

**実務での落とし穴:**

- **TTLとデプロイ**: ドメインのIPを変更するなら、変更の数時間前にTTLを短くしておく (例: 3600→60)。さもないと旧IPがキャッシュされ続けて切替に時間がかかる
- **CNAMEとAPEX**: ドメインの頂点 (`example.com` 自体、サブドメインなしのもの) にはCNAMEを設定できない (RFC違反)。多くのCDNが提供する `ALIAS` や `ANAME` といった独自レコードで回避する
- **DNSキャッシュポイズニング**: 悪意ある応答を返してキャッシュを汚染する攻撃。DNSSEC (署名による検証) で防げるが、普及途上

<a id="section-3-3"></a>
### 3.3 TLS/SSL ― 通信を暗号化する
<!-- handbook:learning {"level":"required","minutes":15} -->
<!-- handbook:index {"group":"H","term":"HTTPS"} -->
<!-- handbook:index {"group":"T","term":"TLS 1.3"} -->
<!-- handbook:index {"group":"た行","term":"中間者攻撃"} -->

<!-- handbook:narrative-bridge {"section":"3.3"} -->

DNSによって接続先のIPアドレスは得られるが、その応答だけでは相手が本物か、途中で内容を読まれたり書き換えられたりしないかは保証されない。HTTPを安全に送る前に、この信頼の不足をTLSで補う。

TLS (Transport Layer Security) は、TCP上で動作し、通信に3つの保証を与える:

1. **機密性 (Confidentiality)**: 第三者が内容を読めない
2. **完全性 (Integrity)**: 内容が改ざんされていないことを検出できる
3. **認証 (Authentication)**: 通信相手が本物だと確認できる

「SSL」は旧名で、現在のプロトコルは全てTLSだ (TLS 1.0、1.1、1.2、1.3)。ただし慣用的に「SSL証明書」のように呼ばれ続けている。

**TLS 1.2ハンドシェイク (2-RTT):**

```text
Client                                    Server
   │                                        │
   │── ClientHello ──────────────────────→  │
   │    対応する暗号スイート、乱数、SNI       │
   │                                        │
   │  ←──────────────── ServerHello ─────── │
   │              選んだ暗号、乱数            │
   │  ←──────────────── Certificate ─────── │
   │                サーバ証明書              │
   │  ←─────────── ServerKeyExchange ────── │
   │  ←──────────── ServerHelloDone ─────── │
   │                                        │
   │── ClientKeyExchange ─────────────────→ │
   │── ChangeCipherSpec ──────────────────→ │
   │── Finished (暗号化済み) ───────────────→│
   │                                        │
   │  ←──────────── ChangeCipherSpec ────── │
   │  ←──────────── Finished (暗号化済み) ── │
   │                                        │
   │═══════════ 暗号化された通信開始 ═══════ │
```

**TLS 1.3ハンドシェイク (通常1-RTT、条件付きで0-RTT):**

TLS 1.3は古い暗号方式を整理し、通常のフルハンドシェイク後に1 RTTでアプリケーションデータを送れる設計になった。PSKによる再開では**0-RTT early data**を利用できる場合があるが、接続間のリプレイを完全には防げない。クライアントは、重複実行されても安全な操作以外を0-RTTで送ってはならない [RFC 8446]。

**証明書チェーン:**

サーバ証明書は、それ自体では信頼できない。**認証局 (CA)** によって署名されており、CAは別のCAに署名されているか、ブラウザにビルトインの**ルート証明書**を信頼の起点とする。

```text
[ルートCA証明書 (ブラウザにビルトイン)]
        │ 署名
        ▼
[中間CA証明書]
        │ 署名
        ▼
[サーバ証明書 (example.com)]
```

サーバは自分の証明書と中間証明書をクライアントに送る (これを忘れると「証明書チェーン不完全」エラーになる、よくあるトラブル)。

**実務で重要な概念:**

- **SAN (Subject Alternative Name)**: 1枚の証明書で複数のドメインをカバー
- **ワイルドカード証明書**: `*.example.com` で全サブドメインをカバー (1階層のみ)
- **Let's Encrypt**: 無料でDV (ドメイン認証) 証明書を発行、自動更新が標準
- **HSTS (HTTP Strict Transport Security)**: `Strict-Transport-Security` ヘッダを受信した対応ブラウザが、指定期間中は同一ホストへのHTTPアクセスをHTTPSへ切り替える。初回アクセスや対象外ホストまで自動的に保護する仕組みではない
- **証明書の透明性 (Certificate Transparency)**: 全証明書が公開ログに記録される。誤発行や不正発行の検知に使える ([crt.sh](https://crt.sh/) で検索可能)
- **ECH (Encrypted Client Hello)**: SNI (どのドメインにアクセスしているか) も暗号化する次世代仕様

<a id="section-3-4"></a>
### 3.4 実装例: 自己署名証明書でHTTPSサーバを立てる
<!-- handbook:learning {"level":"practical","minutes":30} -->
<!-- handbook:index {"group":"さ行","term":"自己署名証明書"} -->

<!-- handbook:narrative-bridge {"section":"3.4"} -->

TLSの保証を概念として理解したら、次は証明書と秘密鍵が実際のサーバ設定へどう現れるかを確認する。自己署名証明書は公開環境の解決策ではないが、信頼ストアがなぜ必要かを局所的に観察できる。

開発環境ではLet's Encryptが使えない (公開ドメインが必要)。自己署名証明書で動作確認しよう。

```bash
# 秘密鍵と自己署名証明書を生成
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
```

Node.jsでHTTPSサーバを起動:

```typescript
// https-server.ts
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const server = createServer({
  key: readFileSync('./key.pem'),
  cert: readFileSync('./cert.pem'),
}, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    // 開発用サンプルでは HSTS を送らない。信頼されない証明書の間はブラウザが無視するが、
    // mkcert などで信頼される証明書へ切り替えた瞬間に本当に記録され、
    // localhost 配下の他プロジェクトまで1年間 HTTPS 固定になって元に戻せなくなる (23.11)
  });
  res.end(`Hello over TLS!\nProtocol: ${(req.socket as any).getProtocol?.()}\n`);
});

server.listen(8443, () => {
  console.log('Listening on https://localhost:8443');
});
```

```bash
# 自己署名なので -k で警告を無視
$ curl -kv https://localhost:8443
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* TLSv1.3 (IN), TLS handshake, Server hello (2):
...
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
...
< HTTP/1.1 200 OK
< Strict-Transport-Security: max-age=31536000; includeSubDomains
...
Hello over TLS!
Protocol: TLSv1.3
```

実務では開発でも自己署名は避けて、`mkcert` というツールでローカルCAを作るのが楽だ。これを使うとブラウザに信頼された証明書を一発で発行できる。

<a id="section-3-5"></a>
### 3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"3.5"} -->

URL、DNS、TCP、TLS、HTTPを個別に見てきたので、ここで一つのページアクセスへ再結合する。順序を追うことで、接続障害や遅延を「Webが遅い」という一語ではなく、具体的な段階へ切り分けられる。

ここまでの知識を結合する。`https://example.com/` を開いたとき何が起きるか:

1. ブラウザはURLをパース (スキーム、ホスト、パス分離)
2. **DNS解決** ― `example.com` のIPを取得 (キャッシュにあれば即返答)
3. **TCPハンドシェイク** ― SYN → SYN-ACK → ACK (1 RTT)
4. **TLSハンドシェイク** ― ClientHello から Finished まで (TLS 1.3で1 RTT)
5. **HTTPリクエスト送信** ― `GET / HTTP/2`
6. サーバが処理 (動的なら DB アクセスなど)
7. **HTTPレスポンス受信** ― HTML本体
8. ブラウザがHTMLをパース、CSSやJavaScriptを発見すると追加リクエスト
9. レンダリングパイプライン (第4章)

ここまでがナビゲーションの一連の流れである。このうちHTMLを受け取った後の描画工程だけを取り出したものを Critical Rendering Path と呼び、4.1 で扱う。各段の待ち時間をどう測り、どこから削るかは第24章で扱う。

<a id="section-3-6"></a>
### 3.6 実装課題 ― URL・DNS・TLS を「見る」
<!-- handbook:learning {"level":"practical","minutes":270} -->

<!-- handbook:narrative-bridge {"section":"3.6"} -->

一連の流れを理解したかどうかは、各段階の値と所要時間を自分で取得できるかで確かめられる。演習ではURLパースからTLSトレースまでを観測し、抽象的な層を実際のログへ対応づける。

第3章では URL の構造、DNS 解決、TLS ハンドシェイクを学んだ。本節では、これらを実際に**観察し、ツールを自作する**ことで理解を深める。所要時間: 演習カードの推定時間の合計で8時間45分。

#### 課題3.1: URLパーサを自作 (★)

**目的**: URL の各構成要素を正規表現や状態機械で解析できることを確認する。

<!-- handbook:exercise:start {"id":"3.1"} -->
> **演習カード 課題3.1** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 3.1 URI/URL/URN を読み、scheme・authority・path・query・fragment を分ける区切り文字を説明できる
> - TypeScript で正規表現と文字列の切り出しを扱える
> - Node.js 内蔵の URL クラスを使わずに実装する、という制約を理解している
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `parseUrl(input: string): ParsedUrl` が scheme / userInfo / host / port / path / query / fragment を返す
> - [ ] `https://user:pass@www.example.com:8080/path/to/resource?key=value&x=1#section` を全要素へ分解でき、port が数値の 8080 になる
> - [ ] `mailto:alice@example.com`、`/path/only`、`//cdn.example.com/asset.js` の3形式で scheme と host の有無が正しく分かれる
> - [ ] `?a=1&a=2` のように同じキーが複数回現れるクエリを、キーごとの配列として保持する
> - [ ] 空文字列や範囲外のポート番号など不正入力で例外を投げる
> - [ ] `resolveUrl(base, ref)` が `../` を含む相対参照を正規化して絶対URLを返す
>
> **期待出力**
>
> - `parseUrl('https://user:pass@www.example.com:8080/a?x=1#top')` が scheme='https'、userInfo='user:pass'、host='www.example.com'、port=8080、fragment='top' を持つオブジェクトを返す
> - `parseUrl('https://example.com/path?a=1&a=2')` の query でキー `a` に `['1','2']` の2要素が入る
> - `parseUrl('//cdn.example.com/asset.js')` は scheme が null で host が `cdn.example.com` になる
> - `resolveUrl('https://example.com/a/b/page.html', '../asset.js')` が `https://example.com/a/asset.js` を返す
> - `https://example.com:70000/` のような範囲外ポートでは undefined を返さず例外メッセージが出る
>
> **観察項目**
>
> - `curl -v 'https://example.com/a#frag'` のリクエストラインを見て、フラグメントがサーバへ送られないことを確認する
> - `http://[::1]:8080/` を入力し、角括弧内のコロンをポート区切りと誤認しない実装になっているか確認する
> - `+` を含むクエリ値やパーセントエンコード済みのパスでデコード結果が変わることを見て、どこまでを自作パーサの責務にするか決める
> - 自作結果と `new URL(input)` の結果を並べて差分を出し、末尾スラッシュ・空パス・大文字schemeなど解釈が分かれる箇所を特定する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch03 run test` を実行し、`URL parser handles authority, duplicate query keys, and fragment` と `URL resolver normalizes relative segments` の2件がパスすることを確認する
> 2. `tsx code/ch03/url-parser.solution.ts 'https://user:pass@www.example.com:8080/path?a=1&a=2#s'` を実行し、7要素すべてが埋まったオブジェクトが表示されれば期待出力を確認できる
> 3. 本文のテストケース5件 (通常URL、mailto、パスのみ、プロトコル相対、同一キー重複) を自分の実装へ順に入力し、例外なく分解できれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 後ろから削ると分岐が減る。まず `#` でフラグメントを切り、次に `?` でクエリを切り、残った文字列に対して scheme と authority を判定する。
> 2. **構造**: authority は `//` で始まる場合だけ存在する。`@` の最後の出現で userInfo と host:port を分け、host が `[` で始まるなら IPv6 として `]` まで読む。クエリは `&` で分割し `Map<string, string[]>` へ push する。
> 3. **実装の要点**: ポートは `/^\d+$/` の検査と 1〜65535 の範囲検査を両方行う。`mailto:` のように scheme の後が `/` で始まらない場合は authority を持たない不透明部として path と分けて保持すると、相対解決の判定が楽になる。
>
> **本番利用時の警告**
>
> - この自作パーサはパーセントエンコードの正規化、IDNのPunycode変換、制御文字の除去を行わない。認可判定やリダイレクト先の検証に流用すると、正規化差分を突いたオープンリダイレクトやパストラバーサルを許す
> - userInfo にパスワードを含むURLは、ログやRefererに残ると資格情報が漏れる。解析結果をそのままログへ出力しない
>
> **導線**
>
> - 開始地点: `code/ch03/url-parser.ts`
> - 模範解答: `code/ch03/url-parser.solution.ts`
>
> **推定時間の内訳**: 分解ロジックの実装に20分、テストケース5件の通しに15分、resolveUrlと異常系に10分
<!-- handbook:exercise:end -->

**要件**:
- `parseUrl(input: string): ParsedUrl` を実装
- `ParsedUrl` は `{ scheme, userInfo, host, port, path, query, fragment }` を含む
- `URL` クラス (Node.js 内蔵) は使わない (自作で書く)
- 不正な URL は適切にエラーを返す
- 相対 URL の解決 (`resolveUrl(base, ref)`) を実装

**テストケース**:
```typescript
parseUrl('https://user:pass@www.example.com:8080/path/to/resource?key=value&x=1#section')
// { scheme: 'https', userInfo: 'user:pass', host: 'www.example.com', port: 8080, ... }

parseUrl('mailto:alice@example.com')
parseUrl('/path/only')
parseUrl('//cdn.example.com/asset.js')  // プロトコル相対 URL
parseUrl('https://example.com/path?a=1&a=2')  // 同じキーが複数回
```

模範解答: `code/ch03/url-parser.solution.ts`

#### 課題3.2: DNS リゾルバの観察ツール (★★)

**目的**: DNS 解決の階層構造を体感する。

<!-- handbook:exercise:start {"id":"3.2"} -->
> **演習カード 課題3.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 3.2 DNS ― 名前を住所に変える を読み、スタブリゾルバ・再帰リゾルバ・権威サーバの役割を区別できる
> - `node:dns/promises` の Resolver クラスで resolve4 などを呼べる
> - 比較用に dig または nslookup が PATH にある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] ドメイン名を引数に取り、A / AAAA / MX / TXT / NS の5種類を1回の実行でまとめて表示する
> - [ ] A と AAAA について TTL を秒数で表示している (`{ ttl: true }` を指定している)
> - [ ] レコードが存在しない場合 (ENODATA や ENOTFOUND) に例外で落ちず、空の結果として扱う
> - [ ] 名前解決に要した時間をミリ秒で表示している
> - [ ] 出力に、使用したリゾルバのアドレスと、キャッシュ由来か権威由来かを node:dns からは判別できない旨の注記を含める
>
> **期待出力**
>
> - 1行目が `Resolving example.com...`、2行目が `Resolver: ` に続くリゾルバのIPアドレスになる
> - `A:      23.215.0.136  (TTL: 3600)` のように、種別・値・TTLが1行ずつ並ぶ
> - MXが未設定のドメインではMX行が0件になり、エラー終了しない
> - 末尾に `Time:   NN.N ms` と `Source: recursive resolver response` で始まる注記の2行が出る
>
> **観察項目**
>
> - 同じドメインを続けて2回実行し、2回目の Time が短くなることからキャッシュの効きを推測する
> - `DNS_SERVER=1.1.1.1` のようにリゾルバを変えて実行し、返るAレコードや順序が変わること (CDNの応答分散) を確認する
> - `dig example.com +noall +answer` のTTLと自分のツールのTTLを比べ、キャッシュ経過に伴ってTTLが減っていく様子を確認する
> - NSで得た権威サーバへ直接問い合わせるとTTLが常に初期値で返ることを確認し、途中のキャッシュがTTLを削っていると理解する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch03 run test` を実行し、`DNS formatter includes TTL and source limitation` がパスすることを確認する
> 2. `tsx code/ch03/dns-resolver.solution.ts example.com` を実行し、A行・NS行・Time行がそろって出れば実行環境は正常である
> 3. MXを持たないドメインと持つドメインの両方で実行し、前者が例外なく0件で終われば異常系の扱いが合格である
> 4. `dig example.com A +noall +answer` の結果と自分のツールのA行を突き合わせ、アドレスの集合が一致することを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 5種類を順番に await すると総時間が種別数だけ伸びる。まず1種類で動かしてから `Promise.all` で並列化する。
> 2. **構造**: `new Resolver()` を作り、必要なら `resolver.setServers([...])` を呼ぶ。A と AAAA は `resolve4(domain, { ttl: true })` の形でTTL付き配列を得られるが、MX / TXT / NS はTTLを返さない点に注意する。
> 3. **実装の要点**: `ENODATA` `ENOTFOUND` `ESERVFAIL` `EREFUSED` は「そのレコードが無い」ことを示す正常系として空配列へ落とし、それ以外のエラーだけ再送出する。catch で全部握り潰すと設定ミスに気づけなくなる。
>
> **本番利用時の警告**
>
> - node:dns の高水準APIは応答がキャッシュ由来か権威由来かを返さない。出力に「権威回答」と書くと誤った診断根拠になるため、判別できないことを明示する
> - 大量のドメインを短時間に問い合わせると、社内リゾルバやパブリックDNSでレート制限やブロックの対象になる。ループで回す場合は間隔を空ける
>
> **導線**
>
> - 開始地点: `code/ch03/dns-resolver.ts`
> - 模範解答: `code/ch03/dns-resolver.solution.ts`
>
> **推定時間の内訳**: レコード5種の取得実装に35分、TTLと異常系の処理に25分、出力整形に15分、digとの突き合わせに15分
<!-- handbook:exercise:end -->

**要件**: ドメイン名を引数に取り、以下の情報を表示するツール:
- A レコード (IPv4 アドレス)
- AAAA レコード (IPv6 アドレス)
- MX レコード (メールサーバ)
- TXT レコード
- NS レコード (権威サーバ)
- 各レコードの TTL
- Authoritative answer か Cached answer か

Node.js の `node:dns` モジュールを使う。

```typescript
$ tsx dns-resolver.ts example.com

Resolving example.com...
A:      23.215.0.136  (TTL: 3600)
A:      96.7.128.198  (TTL: 3600)
AAAA:   2606:2800:21f:cb07:6820:80da:af6b:8b2c  (TTL: 3600)
MX:     0 .  (TTL: 86400, no MX configured)
TXT:    "v=spf1 -all"
NS:     a.iana-servers.net
NS:     b.iana-servers.net
```

**発展**: dig コマンドのような実行時間表示も追加。

模範解答: `code/ch03/dns-resolver.solution.ts`

#### 課題3.3: 自己署名証明書でHTTPSサーバを立てる (★★)

**目的**: TLS の構成要素 (秘密鍵、証明書、CA) を実際に作り、HTTPSサーバを動かす。

<!-- handbook:exercise:start {"id":"3.3"} -->
> **演習カード 課題3.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: OpenSSL/TLS
>
> **前提**
>
> - 3.3 TLS/SSL ― 通信を暗号化する と 3.4 実装例: 自己署名証明書でHTTPSサーバを立てる を読み、証明書チェーンと信頼ストアの関係を説明できる
> - `openssl version` が 3.x 系を返す環境がある
> - `node:https` の createServer に key と cert を渡してサーバを起動できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `openssl req -x509` で秘密鍵と自己署名証明書を生成し、subjectAltName に `DNS:localhost` と `IP:127.0.0.1` を含めている
> - [ ] 生成した秘密鍵のパーミッションを 600 に絞っている
> - [ ] HTTPSサーバが 3443 番で起動し、`curl -k https://localhost:3443/` がJSONを返す
> - [ ] `-k` なしのcurlが証明書検証エラーで失敗することを確認し、その理由を書いている
> - [ ] `curl --cacert <証明書>` を使い、検証を無効にせずに成功させる方法を確認している
> - [ ] `openssl s_client -connect localhost:3443` でハンドシェイクのログと証明書のSubject/SANを確認している
>
> **期待出力**
>
> - `openssl x509 -in <cert> -noout -subject -issuer -dates -ext subjectAltName` の subject と issuer がどちらも `CN=localhost` になる (自己署名の証拠)
> - サーバ起動時に `HTTPS server: https://localhost:3443` が出力される
> - `curl -k https://localhost:3443/` が `{"message":"Hello over TLS","protocol":"https"}` を返す
> - `-k` なしのcurlは `SSL certificate problem: self-signed certificate` を含むエラーで終了する
> - `openssl s_client` の出力に `Verify return code: 18 (self signed certificate)` と選択された Cipher が現れる
>
> **観察項目**
>
> - subjectAltName から `DNS:localhost` を外して再生成し、ブラウザ (Chrome / Edge / Safari) で開くと `ERR_CERT_COMMON_NAME_INVALID` になることを確認する。ブラウザは2017年以降 CN を見ない。一方 curl や Node.js は、ビルドに使った TLS ライブラリによっては CN へフォールバックして接続に成功することがあるため、CLI だけで確かめると逆の結論になる
> - `openssl s_client` の Protocol 行と Cipher 行を見て、サーバ側の `minVersion` 指定がどのバージョンを許すかを確認する
> - `https://127.0.0.1:3443/` と `https://localhost:3443/` の両方を叩き、SANのDNS名とIPのどちらに一致したかで結果が変わることを確認する
> - 証明書の notAfter を過ぎた状態で接続し、期限切れが検証エラーとして現れることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch03/cert-gen.solution.sh certs` を実行し、`certs/localhost-key.pem` と `certs/localhost-cert.pem` が生成され SAN が表示されれば準備完了とする
> 2. `rm -rf /tmp/ch03 && tsc -p code/ch03/tsconfig.json --outDir /tmp/ch03 && TLS_KEY=certs/localhost-key.pem TLS_CERT=certs/localhost-cert.pem node /tmp/ch03/https-server.solution.js` でサーバを起動し、別ターミナルの `curl -k https://localhost:3443/` がJSONを返せば合格とする
> 3. `curl https://localhost:3443/` が失敗し、`curl --cacert certs/localhost-cert.pem https://localhost:3443/` が成功することを両方確認する
> 4. `openssl s_client -connect localhost:3443 -servername localhost </dev/null` の出力に証明書チェーンと Verify return code が出ることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 手順を「鍵と証明書を作る」「サーバへ読み込ませる」「クライアントに信頼させる」の3段に分ける。失敗したときどの段の問題かを切り分けられるようにする。
> 2. **構造**: `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'` の1コマンドで生成できる。サーバ側は `https.createServer({ key: readFileSync(...), cert: readFileSync(...) }, handler)` へ渡すだけでよい。
> 3. **実装の要点**: `-k` なしで通したい場合は検証を切るのではなく `curl --cacert cert.pem` で「この証明書を信頼する」と明示する。接続に使うホスト名は証明書のSANに含まれる必要があり、`https://127.0.0.1:3443` を使うなら SAN に `IP:127.0.0.1` が要る。
>
> **本番利用時の警告**
>
> - `curl -k` や `rejectUnauthorized: false` は証明書検証そのものを無効にし、中間者攻撃を検出できなくする。デバッグ時の一時措置に限り、アプリケーションのコードや設定へ残さない
> - 生成した秘密鍵をリポジトリへコミットしない。教材用の鍵でも使い回すと、漏えい時の影響範囲が広がる
> - 自己署名証明書は失効確認 (CRL/OCSP) も自動更新も持たない。公開環境では信頼されたCAの発行と更新の自動化が前提になる
>
> **導線**
>
> - 開始地点: `code/ch03/cert-gen.sh`、`code/ch03/starter.md`
> - 模範解答: `code/ch03/cert-gen.solution.sh`、`code/ch03/https-server.solution.ts`、`code/ch03/solution.md`
>
> **推定時間の内訳**: 証明書生成とSANの調整に25分、HTTPSサーバ起動と接続確認に20分、-kあり/なしの比較と原因の記述に25分、s_clientでのハンドシェイク観察に20分
<!-- handbook:exercise:end -->

**手順**:
1. OpenSSL で秘密鍵を生成
2. 自己署名証明書を作成 (Subject Alternative Name (SAN) を `localhost` に)
3. Node.js の `https` モジュールでサーバを起動
4. `curl -k https://localhost:3443/` で接続確認
5. `openssl s_client -connect localhost:3443` で TLS handshake を観察

**スクリプト**: `code/ch03/cert-gen.sh` で証明書生成、`code/ch03/https-server.solution.ts` でサーバ起動。

**問題**: なぜ `curl` でも `-k` フラグなしだと失敗するか? どうすれば成功させられるか?

模範解答: `code/ch03/solution.md`

#### 課題3.4: TLS handshake を可視化 (★★★)

**目的**: TLS 1.2 vs TLS 1.3 のハンドシェイクの違いを実際に見る。

<!-- handbook:exercise:start {"id":"3.4"} -->
> **演習カード 課題3.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: OpenSSL/TLS
>
> **前提**
>
> - 3.3 TLS/SSL ― 通信を暗号化する を読み、ClientHello から Finished までの各メッセージの目的を説明できる
> - `openssl s_client` の `-tls1_2` `-tls1_3` `-state` `-msg` オプションを使える
> - 発展課題を行う場合は、Wireshark か tcpdump でキャプチャできる環境がある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] TLS 1.2 と TLS 1.3 の両方でハンドシェイクのログをファイルへ保存している
> - [ ] 各ログから ClientHello / ServerHello / Certificate / Finished / NewSessionTicket の出現順を抜き出し、2バージョンを並べた表を作っている
> - [ ] 選択された Cipher と ALPN プロトコルを両バージョンについて記録している
> - [ ] `time` の real 値を各5回以上取り、単発値ではなく中央値で比較している
> - [ ] 往復数 (RTT) の違いと実測時間の違いを分けて記述している
>
> **期待出力**
>
> - TLS 1.2 のログに `SSL_connect:SSLv3/TLS write client hello` などの state 行と、`Cipher is ECDHE-RSA-AES128-GCM-SHA256` の形式の行が現れる
> - TLS 1.3 のログでは Cipher が `TLS_AES_256_GCM_SHA384` などの命名になり、NewSessionTicket がハンドシェイク完了後に現れる
> - ハンドシェイクの各段階を `grep -c ClientHello tls12.log` のように数えると、ClientHello・ServerHello・Certificate・Finished が両ログで1件以上ヒットする。NewSessionTicket は TLS 1.2 のログには出るが、TLS 1.3 で `</dev/null` を使って即座に切ると0件になる (チケットがハンドシェイク完了後に送られるため)
> - `time` の real はネットワーク遅延に支配され、TLS 1.3 が常に速いとは限らない結果になることがある
>
> **観察項目**
>
> - TLS 1.2 では Certificate が平文で流れるのに対し、TLS 1.3 では ServerHello 以降が暗号化され `-msg` の表示内容が変わることを確認する
> - `-servername` を外して実行し、SNIなしでは共有ホスティング先から意図しない証明書が返る場合があることを確認する
> - `ALPN protocol` の行を見て、HTTP/2 を使うかどうかがTLSハンドシェイクの中で決まっていることを確認する
> - 2回目以降の接続でセッション再開が起きると往復が減ることを、実測時間の分布から読み取る
>
> **テスト方法 (自己採点手順)**
>
> 1. `{ time openssl s_client -tls1_2 -state -msg -connect example.com:443 -servername example.com </dev/null; } > tls12.log 2>&1` を実行し、ログに `Cipher is` の行が含まれていれば取得成功とする
> 2. 同じ手順を `-tls1_3` で行い、`grep -c ServerHello tls13.log` が1以上を返すことを確認する。NewSessionTicket も数えたい場合は `</dev/null` を外し、代わりに `-sess_out ticket.pem` を付けて数秒待ってから切る。TLS 1.3 のチケットはハンドシェイク完了後に別途送られるため、即座に切断すると受け取れない
> 3. 作成した比較表が `code/ch03/tls-trace.solution.md` の5項目 (Hello、証明書とFinishedの順序、Cipher、ALPN、実測時間) をすべて埋めていれば合格とする
> 4. 5回分の計測値を並べ、中央値で比較していれば単発測定の一般化を避けられている
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず比較条件を固定する。接続先、SNI、ネットワーク、時間帯を揃えないと、バージョン差ではなく回線差を測ることになる。
> 2. **構造**: `openssl s_client -state -msg` で状態遷移とメッセージの両方を出す。`</dev/null` を付けて標準入力を閉じないとコマンドが終わらず、`time` の値が取れない。
> 3. **実装の要点**: TLS 1.3 では Certificate 以降が暗号化されるため、平文でメッセージ名を追えるのは ClientHello と ServerHello までである。中身まで見たい場合は Wireshark と鍵ログ (`SSLKEYLOGFILE`) の併用が必要になる。
>
> **本番利用時の警告**
>
> - `SSLKEYLOGFILE` は通信内容を平文へ戻せる鍵素材を書き出す。実運用のブラウザや業務端末で有効にしたまま放置しない
> - 第三者のホストへ繰り返しハンドシェイクを張ると接続元制限やブロックの対象になる。反復計測は自分が管理するサーバか、課題3.3で立てた localhost のサーバで行う
> - パケットキャプチャは同一ネットワーク上の他者の通信も取得しうる。許可のないネットワークでキャプチャしない
>
> **導線**
>
> - 開始地点: `code/ch03/tls-trace.md`
> - 模範解答: `code/ch03/tls-trace.solution.md`
>
> **推定時間の内訳**: 2バージョンのログ取得に30分、メッセージ順序の抽出と表の作成に40分、5回ずつの時間計測に40分、Wiresharkでの発展観察に40分
<!-- handbook:exercise:end -->

**手順**:
1. `openssl s_client -tls1_2 -connect example.com:443` でログを取る
2. `openssl s_client -tls1_3 -connect example.com:443` で同様に
3. 各フェーズ (ClientHello、ServerHello、Certificate、Finished など) の順序と RTT 数を記録
4. `time` コマンドで両者の所要時間を比較

**発展課題**: Wireshark でTLS handshake をキャプチャし、各メッセージの中身 (Cipher Suite ネゴシエーション、SNI、ALPN) を観察する。

模範解答: `code/ch03/tls-trace.solution.md`

#### 課題3.5: 「URLを入力してから画面表示まで」のすべてを観察 (★★★)

**目的**: 本章のまとめ。1つの URL に対して、すべてのフェーズの所要時間を計測する。

<!-- handbook:exercise:start {"id":"3.5"} -->
> **演習カード 課題3.5** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ) を読み、DNS→TCP→TLS→HTTPの順序を説明できる
> - 課題3.2と課題3.3で DNS と TLS を個別に観察済みである
> - `https.request` の socket イベントと、ソケットの lookup / connect / secureConnect イベントを扱える
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] URLを引数に取り、DNS・TCP・TLS・TTFB・ボディ受信の5区間をミリ秒で表示する
> - [ ] 解決されたIPアドレス、HTTPバージョン、TLSプロトコル名、Cipher名を出力に含める
> - [ ] 受信バイト数と、HTML内のサブリソース参照数を数えて表示する
> - [ ] 合計時間と、DNS+TCP+TLS+TTFB がその何パーセントかを表示する
> - [ ] `http://` のURLを渡したときにエラーとして拒否する
> - [ ] 15秒程度のタイムアウトを設定し、無応答のホストで待ち続けない
>
> **期待出力**
>
> - 出力が `[DNS]` `[TCP]` `[TLS]` `[HTTP]` `[Body]` `[Parse]` の6行に続き、`Total:` と `Critical path estimate:` の2行で終わる
> - `[TLS]` 行に `TLSv1.3` と `TLS_AES_128_GCM_SHA256` のようなプロトコル名とCipher名が入る
> - `[HTTP]` 行にHTTPバージョン、ステータスコード、TTFBが出る
> - 5区間の合計が Total とおおむね一致し、Critical path estimate の割合が0〜100%の範囲に収まる
> - `[Parse]` のサブリソース数は正規表現による概算であり、実際の読み込み数とは一致しない
>
> **観察項目**
>
> - 同じURLを2回続けて実行し、DNSキャッシュとTLSセッション再開により2回目のDNS区間とTLS区間が短くなることを確認する
> - example.com と github.com を比べ、ボディサイズとサブリソース数の差が Total のどの区間に効くかを確認する
> - ブラウザのNetworkタブの Waterfall と自分のツールの5区間を並べ、ブラウザ側にはサブリソース取得とレンダリングの時間が加わることを確認する
> - `[Parse]` の概算値をNetworkタブの実リクエスト数と比べ、正規表現によるHTML解析の限界を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `tsx code/ch03/url-trace.solution.ts https://example.com` を実行し、8行の出力がそろって Total が正の値になれば合格とする
> 2. `pnpm --filter @handbook/ch03 run test` を実行し、第3章のテストと教材ファイル検証が通ることを確認する
> 3. `tsx code/ch03/url-trace.solution.ts http://example.com` を実行し、`this exercise traces https:// URLs only` のエラーで終了することを確認する
> 4. 自分のツールのDNSとTLSの値を、課題3.2のツールおよび `curl -w '%{time_namelookup} %{time_appconnect}'` の値と突き合わせ、同じオーダーなら計測点の取り方が正しい
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 計測点は「イベントが発火した時刻を記録する」だけにして、区間の計算は最後にまとめて行う。先に引き算を始めると順序の前提が崩れやすい。
> 2. **構造**: `https.request(target, ...)` の socket イベントで得たソケットに対し、lookup・connect・secureConnect の3イベントで `performance.now()` を記録する。レスポンス到着時刻がTTFB、`end` の時刻がボディ完了時刻になる。
> 3. **実装の要点**: secureConnect の中で `socket.getProtocol()` と `socket.getCipher().name` を取るとTLS情報が得られる。リダイレクトを追わない設計なら、301/302 を受けたときに何を計測しているのかを出力へ明示しないと読み誤りやすい。
>
> **本番利用時の警告**
>
> - このツールはリダイレクト追跡、HTTP/2の多重化、サブリソースの実取得、レンダリング時間を含まない。体感速度の指標として提示すると誤解を生む
> - 公開サイトが対象でも、短時間の反復実行はレート制限や遮断の対象になる。連続実行では間隔を空け、負荷試験として第三者のサイトへ向けない
>
> **導線**
>
> - 開始地点: `code/ch03/url-trace.ts`
> - 模範解答: `code/ch03/url-trace.solution.ts`
>
> **推定時間の内訳**: 計測点のイベント配線に40分、5区間と合計の算出に30分、TLS情報とサブリソース数の追加に30分、複数サイトでの反復計測とブラウザとの突き合わせに50分
<!-- handbook:exercise:end -->

**要件**: 引数の URL に対して以下を表示するツール:

```text
$ tsx url-trace.ts https://github.com

[DNS]      github.com → 140.82.112.3 (12 ms)
[TCP]      Connected to 140.82.112.3:443 (45 ms, total: 57 ms)
[TLS]      Handshake completed (118 ms, total: 175 ms)
           Protocol: TLSv1.3, Cipher: TLS_AES_256_GCM_SHA384
[HTTP]     GET / HTTP/2 → 200 OK (89 ms, total: 264 ms)
[Body]     Received 245 KB (33 ms, total: 297 ms)
[Parse]    HTML contains 47 sub-resources

Total: 297 ms
Critical Rendering Path: DNS + TCP + TLS + TTFB = 264 ms (89% of total)
```

**ヒント**: `https.request` の `socket` イベントとイベントから各フェーズの時刻を取れる。

模範解答: `code/ch03/url-trace.solution.ts`

---

### コード集の構成

```text
code/ch03/
├── package.json
├── README.md
├── url-parser.ts             # 課題3.1 スケルトン
├── url-parser.solution.ts    # 課題3.1 解答
├── dns-resolver.ts           # 課題3.2 スケルトン
├── dns-resolver.solution.ts
├── cert-gen.sh               # 課題3.3 証明書生成 スケルトン
├── cert-gen.solution.sh      # 課題3.3 解答
├── https-server.solution.ts  # 課題3.3 解答
├── url-trace.ts              # 課題3.5 スケルトン
├── url-trace.solution.ts
├── starter.md                # 観察結果の記録用
├── solution.md               # 各課題の補足
├── tls-trace.md              # 課題3.4 解説 スケルトン
├── tls-trace.solution.md     # 課題3.4 解答
└── solutions.test.ts         # 章の模範解答テスト
```

ここまでで、要求を送る相手を見つけ、安全な通信路を作り、HTTPで表現を受け取れるようになった。次に残るのは、その表現が利用者の目に見える画面と操作へどう変換されるかという問いである。

---

<a id="chapter-4"></a>
## 第4章 HTML/CSS/JavaScriptの設計思想

第3章までで、ブラウザがサーバへ到達し、安全な通信路の上でHTTPメッセージを交換するところまで追った。ここで得られるのは、まだHTMLやCSSやJavaScriptというバイト列にすぎない。利用者が見る画面や操作可能なUIになるには、ブラウザがそれらを解析し、状態を持つ内部表現へ変え、描画とスクリプト実行を調停しなければならない。

本章では、通信の終点からフロントエンドの出発点へ視点を移す。DOM (Document Object Model)、CSSOM、レンダリングパイプライン、イベントループ、モジュールは独立した雑学ではない。受け取った文書を継続的に更新できるアプリケーションへ変えるために、ブラウザが責務を分けた結果として理解する。

<!-- handbook:chapter-guide:start {"chapter":4} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 表示崩れ、入力遅延、メモリリーク、DOM更新競合を、ブラウザのレンダリングとJavaScript実行モデルから分析する。
>
> **到達目標**
> - DOM・CSSOM・Layout・Paint・Compositeの流れを説明できる。
> - イベントループとタスク/マイクロタスクが描画へ与える影響を説明できる。
> - フレームワークなしで状態とDOM更新を接続できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [1.4 「Webアプリケーション」とは何か](#section-1-4) ― Webアプリケーションの構成
> - [2.1 HTTPメッセージの構造](#section-2-1) ― HTTPで文書が届くまで
>
> **中核概念**  
> [4.1 ブラウザのレンダリングパイプライン](#section-4-1)、[4.3 DOMの中身](#section-4-3)、[4.5 JavaScriptランタイムとイベントループ](#section-4-5)、[4.6 モジュールシステムの進化](#section-4-6)
>
> **最小実装**  
> [4.7 実装例: 純粋なDOM APIでTodoアプリを作る](#section-4-7) (実務選択)、[4.9 実装課題 ― ブラウザの内側を覗く](#section-4-9) (実務選択)
>
> **本番実装との差分**
> - 教材のDOM実装は差分更新、アクセシビリティ、入力保持、エラー境界、複雑な状態同期を省略している。
>
> **典型的な失敗**
> - レイアウト情報の読み書きを交互に行う。
> - 長い同期処理でメインスレッドを占有する。
> - DOMを唯一の状態置き場にする。
>
> **診断・デバッグ方法**
> - PerformanceパネルでLong Task、Layout、Paintを確認する。
> - MutationObserverやイベントログで意図しないDOM変更を追う。
>
> **意思決定チェックリスト**
> - DOMを直接操作すべきか、宣言的UIが必要か。
> - 処理を分割するかWorkerへ移すべきか。
>
> **演習と評価基準**  
> 対象: [4.9 実装課題 ― ブラウザの内側を覗く](#section-4-9) (実務選択)
> - Todo実装の状態更新経路を説明し、不要な再描画を特定できる。
>
> **一次資料・発展資料**
> - HTML Living Standard
> - CSS specifications
> - ECMAScript specification
> - WHATWG DOM
<!-- handbook:chapter-guide:end -->

<a id="section-4-1"></a>
### 4.1 ブラウザのレンダリングパイプライン
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"C","term":"Critical Rendering Path"} -->
<!-- handbook:index {"group":"ら行","term":"レンダリングパイプライン"} -->

<!-- handbook:narrative-bridge {"section":"4.1"} -->

HTTPレスポンスとしてHTMLを受け取った時点では、まだ画面は存在しない。ブラウザは文書、スタイル、スクリプトを別々に解析し、それらを描画可能な内部表現へ統合する。まず、この変換の全体工程を追う。

ブラウザがHTMLを受け取ってから画面に表示するまで、ざっくり以下のステージを経る。

```text
[HTML]          [CSS]
  │              │
  ▼              ▼
[DOM]         [CSSOM]      ← [JS] はこの2つを変更する
  │              │
  └──────┬───────┘
         ▼
   [Render Tree]
         │
         ▼
 [Layout (Reflow)]
         │
         ▼
      [Paint]
         │
         ▼
    [Composite]
         │
         ▼
   [画面に表示]
```

各ステージを詳しく見る。

**1. パース → DOM構築**

HTMLバイト列を字句解析 (トークナイズ) し、文法木 (DOM) を作る。`<html>` を親に、`<head>` `<body>` がぶら下がる木構造だ。途中で `<script>` に出会うと、HTMLパースを止めてスクリプトを実行する (`async` や `defer` 属性で挙動が変わる、後述)。

**2. CSSパース → CSSOM構築**

CSSは解析され、スタイル計算に利用される。通常の外部スタイルシートは初回描画をブロックし得るが、`media` 条件、読み込み方式、ブラウザ実装によって挙動は異なる。「すべてのCSSが常に画面描画を止める」とは限らない。

**3. レンダーツリー構築**

DOMとCSSOMを結合して、「画面に何をどう表示するか」のツリーを作る。`display: none` の要素はここで除外される (一方 `visibility: hidden` は残る、領域は確保される)。

**4. レイアウト (リフロー)**

各要素の位置と大きさを計算する。ビューポートサイズ、フォントサイズ、テキストの折り返しなどを考慮。これは**重い処理**で、要素を追加したりサイズを変更するたびに発生する。

**5. ペイント**

各要素のピクセルを実際に描画する (テキスト、色、画像、影など)。レイアウトより軽い場合が多いが、複雑なボックスシャドウや大きな画像では重くなる。

**6. コンポジット**

ペイント済みのレイヤーを合成する。`transform` や `opacity` のアニメーションは、ブラウザが対象を独立レイヤーへ昇格できれば、レイアウトや再ペイントを避けて合成だけで更新できる場合がある。ただしレイヤー化は実装判断であり、常に高速になる保証はない。DevToolsで実測する。

<a id="section-4-2"></a>
### 4.2 リフローとリペイントを抑える
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"ら行","term":"リフロー"} -->
<!-- handbook:index {"group":"ら行","term":"リペイント"} -->

<!-- handbook:narrative-bridge {"section":"4.2"} -->

レンダリング工程が分かると、DOMやスタイルの変更がすべて同じ費用ではないことが分かる。レイアウト計算をやり直す変更と、既存レイヤを合成するだけの変更を区別することが、UI性能改善の出発点になる。

実務でよく出くわすパフォーマンス問題の多くは、不要なリフローが原因だ。

**リフローを起こすJavaScriptコード:**

```javascript
const el = document.getElementById('box');

// BAD: 読み書きを交互にすると、ブラウザは毎回レイアウトを再計算する
el.style.width = '100px';
console.log(el.offsetHeight); // 強制リフロー
el.style.height = '200px';
console.log(el.offsetWidth);  // 再び強制リフロー

// GOOD: 読みと書きをバッチ化
const w = el.offsetWidth;
const h = el.offsetHeight;
el.style.width = '100px';
el.style.height = '200px';
```

`offsetHeight` のような幾何プロパティを読むと、ブラウザは正しい値を返すために、保留中のスタイル変更を全て適用しレイアウトを実行する。これを**強制同期レイアウト (forced synchronous layout)** と呼び、パフォーマンスキラーになる。

**安いプロパティを使う:**

- リフロー回避: `transform`、`opacity` でアニメーション (GPUで処理)
- ペイント回避: 影や半透明は控えめに、`will-change` で事前ヒント

<a id="section-4-3"></a>
### 4.3 DOMの中身
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"D","term":"DOM"} -->

<!-- handbook:narrative-bridge {"section":"4.3"} -->

不要な再計算を避けるには、JavaScriptが何を変更しているかを正確に捉える必要がある。操作対象となるDOMはHTML文字列そのものではなく、文書をノードと関係へ変換した生きたオブジェクトモデルである。

DOMは単なるデータ構造ではなく、操作可能なAPIだ。

```typescript
// 要素の取得
const el = document.querySelector('.user-name');
const all = document.querySelectorAll('button');

// 属性とプロパティの区別
const input = document.querySelector('input') as HTMLInputElement;
input.getAttribute('value'); // HTMLに書かれた初期値
input.value;                 // 現在のユーザー入力値 (これらは別物!)

// イベントリスナー
el?.addEventListener('click', (event: MouseEvent) => {
  event.preventDefault();  // デフォルト動作を抑止
  event.stopPropagation(); // 伝播を止める
}, { once: true, passive: false });

// ミューテーション監視
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    console.log(m.type, m.addedNodes, m.removedNodes);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

**Shadow DOM:**

Web Componentsの基盤。要素にカプセル化されたDOMツリーを作れる。通常のセレクタは境界を越えにくいが、継承プロパティ、CSSカスタムプロパティ、`::part`、`::slotted`、`:host` など、明示的に境界をまたぐ仕組みもある。

```typescript
class UserCard extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    // 構造だけを innerHTML で作り、外から来る値は textContent で入れる。
    // 属性値をテンプレートリテラルで innerHTML へ挿すと、その時点で DOM ベース XSS が成立する。
    // Shadow DOM は「スタイルと id の境界」であって、サニタイザではない
    shadow.innerHTML = `
      <style>
        .name { color: blue; font-weight: bold; }
      </style>
      <div class="name"></div>
    `;
    shadow.querySelector('.name')!.textContent = this.getAttribute('name') ?? '';
  }
}
customElements.define('user-card', UserCard);
// HTMLで <user-card name="Alice"></user-card> として使える
```

<a id="section-4-4"></a>
### 4.4 CSSの仕組み
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"4.4"} -->

DOMは文書の構造を表すが、どの見た目を最終的に採用するかは決めない。複数のスタイル規則が同じ要素へ届くため、ブラウザには競合を解決してCSSOMを作る仕組みが必要になる。

**カスケードの優先順位 (高い順):**

1. `!important` (避けるべき)
2. インラインスタイル (`style="..."`)
3. IDセレクタ
4. クラス・属性・擬似クラス
5. 要素セレクタ
6. 全称セレクタ (`*`)

同じ詳細度なら**後から書かれたもの**が勝つ。

**ボックスモデル:**

```text
┌────────────────────────────────────┐
│ margin                             │
│  ┌──────────────────────────────┐  │
│  │ border                       │  │
│  │  ┌────────────────────────┐  │  │
│  │  │ padding                │  │  │
│  │  │  ┌──────────────────┐  │  │  │
│  │  │  │ content          │  │  │  │
│  │  │  └──────────────────┘  │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

`box-sizing: border-box` を全要素に設定するのが現代の慣習 ― `width` が border 込みになり、計算が直感的になる。

```css
*, *::before, *::after {
  box-sizing: border-box;
}
```

**レイアウト技術:**

- **Flexbox**: 1次元レイアウト (横並びまたは縦並び)
- **Grid**: 2次元レイアウト (本格的なグリッドシステム)
- **Container Queries**: 親要素のサイズに応じたスタイル (`@container`)。主要ブラウザは2023年に対応した
- **Logical Properties**: `margin-inline-start` など、書字方向に依存しない (国際化に有用)

<a id="section-4-5"></a>
### 4.5 JavaScriptランタイムとイベントループ
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"J","term":"JIT コンパイル"} -->
<!-- handbook:index {"group":"あ行","term":"イベントループ"} -->

<!-- handbook:narrative-bridge {"section":"4.5"} -->

HTMLとCSSは画面の構造と見た目を宣言できるが、ユーザー操作、通信完了、タイマーのように時刻の異なる出来事を調停するには実行モデルが必要になる。JavaScriptのイベントループは、単一の実行スタックと非同期な外部処理を接続する。

ブラウザの各JavaScriptエージェントでは、1つの実行スタック上でジョブが順番に処理される。メインスレッドのJavaScriptが同時に2つの処理を実行するわけではないが、ネットワークやタイマーはホスト環境が処理し、Web Workersを使えば別エージェントで並行実行できる。非同期コールバックを調停する中心が**イベントループ**である。

```text
┌──────────────────────────────────────────────┐
│              Call Stack (実行中)               │
└──────────────────────────────────────────────┘
              ▲              │
              │ 実行         │ Web APIへ委譲
              │              ▼
┌──────────────┐         ┌────────────────────┐
│ Microtask Q  │         │  Web APIs           │
│ (Promise)    │         │ (setTimeout, fetch) │
└──────────────┘         └────────────────────┘
       ▲                          │ 完了
       │優先処理                  ▼
       │                  ┌────────────────────┐
       └──────────────────│   Task Queue        │
                          │   (Macrotask)       │
                          └────────────────────┘
```

**概念化した処理順:**

1. イベントループが実行可能なタスクを1つ選ぶ
2. そのタスクのJavaScript実行が終了する
3. **マイクロタスクチェックポイント**で、キューが空になるまでPromise反応や`queueMicrotask`を処理する
4. ブラウザが必要と判断したタイミングで描画更新を行う
5. 次のタスクへ進む

これは理解用の単純化である。タスクソースの選択、I/O、描画機会の詳細はホスト環境と仕様上の手続きに依存する [WHATWG HTML, 2026]。

**この区別が分かるテストコード:**

```typescript
console.log('1');

setTimeout(() => console.log('2'), 0);  // macrotask

Promise.resolve().then(() => console.log('3'));  // microtask

queueMicrotask(() => console.log('4'));  // microtask

console.log('5');

// 出力順: 1, 5, 3, 4, 2
```

`setTimeout(fn, 0)` はマクロタスクなので、全てのマイクロタスクが終わってから実行される。

**注意**:

マイクロタスクを再帰的に追加し続けると、次のタスクや描画機会を長時間遅らせることがある。短い処理ならタスクへ分割できるが、`setTimeout` や`requestIdleCallback`はCPU処理を別スレッドへ移すものではない。重い計算は処理量を減らすか、Web Workerへ移すことを検討する。

<a id="section-4-6"></a>
### 4.6 モジュールシステムの進化
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"4.6"} -->

イベントループ上で扱うコードが増えると、関数や変数を一つの大域空間へ置く方法では依存関係を管理できない。モジュールは、実行順序と名前の衝突という問題を、明示的な公開・参照関係へ変える。

JavaScriptには複数のモジュールシステムが存在し、混乱の元になっている。

| 形式 | 環境 | 構文 |
|---|---|---|
| **IIFE** | 古いブラウザ | `(function(){...})()` |
| **CommonJS (CJS)** | Node.js (旧来) | `require()` / `module.exports` |
| **AMD** | RequireJS等 | `define([deps], fn)` (歴史的) |
| **UMD** | ライブラリ配布 | CJSとAMD両対応 |
| **ESM (ES Modules)** | 現代の標準 | `import` / `export` |

新規のブラウザ向けコードではES Modules (ESM) が標準的な選択肢であり、ブラウザとNode.jsの双方で利用できる。一方、既存のNode.jsパッケージ、設定ファイル、レガシー資産ではCommonJSが残るため、相互運用と配布先を確認する。

**ESMの基本:**

```typescript
// math.ts (名前付きエクスポート)
export function add(a: number, b: number): number {
  return a + b;
}
export const PI = 3.14159;

// utils.ts (デフォルトエクスポート)
export default function formatDate(d: Date): string {
  return d.toISOString();
}

// app.ts
import formatDate from './utils.js';
import { add, PI } from './math.js';
import * as math from './math.js';  // 名前空間インポート

// 動的インポート (コード分割の基盤)
const module = await import('./heavy.js');
```

**ESMとCJSの相互運用問題:**

Node.jsは長らくCJSが標準だったため、ESMへの移行で多くの混乱が生じている。

- `package.json` に `"type": "module"` で全体をESMにできる
- ESMから CJSモジュールは `import` 可能だが、デフォルトエクスポートとして扱われる
- CJSからESMは、Node.js `22.12` (および `20.19`) 以降であれば `require()` でそのまま読める。トップレベル `await` を含むESMだけは同期的に読めないため、その場合は `await import()` を使う。それより前の版では常に `await import()` が必要だった
- 拡張子省略はESMでは原則NG (`./math` ではなく `./math.js`)

**Top-Level Await:**

ESMでは関数の外で `await` が使える。

```typescript
// initialize.ts
const config = await fetch('/api/config').then(r => r.json());
export default config;
```

これはCJSにはない機能で、初期化処理を簡潔に書ける。

<a id="section-4-7"></a>
### 4.7 実装例: 純粋なDOM APIでTodoアプリを作る
<!-- handbook:learning {"level":"practical","minutes":30} -->

<!-- handbook:narrative-bridge {"section":"4.7"} -->

ここまでDOM、CSS、イベントループ、モジュールを個別に見てきた。小さなTodoアプリへ統合すると、状態の変更とDOMの差分を手作業で同期する負担が見える。この負担が、次の部でフレームワークを必要とする理由になる。

フレームワークの恩恵を理解するため、まず**ライブラリゼロ**でTodoアプリを書く。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Vanilla Todo</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 1rem; }
    .todo-list { list-style: none; padding: 0; }
    .todo-item { display: flex; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #eee; }
    .todo-item.done .todo-text { text-decoration: line-through; color: #888; }
    input[type="text"] { flex: 1; padding: 0.5rem; }
    button { padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Todo</h1>
  <form id="todo-form">
    <input type="text" id="todo-input" placeholder="やることを入力..." required>
    <button type="submit">追加</button>
  </form>
  <ul class="todo-list" id="todo-list"></ul>
  <!-- ブラウザは TypeScript をそのまま読めない。tsc でビルドした .js を指す -->
  <script type="module" src="./todo.js"></script>
</body>
</html>
```

```typescript
// todo.ts
type Todo = { id: string; text: string; done: boolean };

// 状態
let todos: Todo[] = JSON.parse(localStorage.getItem('todos') ?? '[]');

const $form = document.getElementById('todo-form') as HTMLFormElement;
const $input = document.getElementById('todo-input') as HTMLInputElement;
const $list = document.getElementById('todo-list') as HTMLUListElement;

// 状態 → DOM 反映 (全描画。差分検出はしない)
function render() {
  // DocumentFragment で一括追加 (リフロー削減)
  const fragment = document.createDocumentFragment();
  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = `todo-item${todo.done ? ' done' : ''}`;
    li.dataset.id = todo.id;
    li.innerHTML = `
      <input type="checkbox" ${todo.done ? 'checked' : ''}>
      <span class="todo-text"></span>
      <button class="delete">削除</button>
    `;
    // textContent で代入 (XSS 防止: innerHTML だと <script> が実行されうる)
    li.querySelector('.todo-text')!.textContent = todo.text;
    fragment.appendChild(li);
  }
  $list.replaceChildren(fragment);
}

// 永続化
function save() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// 追加
$form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $input.value.trim();
  if (!text) return;
  todos.push({ id: crypto.randomUUID(), text, done: false });
  $input.value = '';
  save();
  render();
});

// チェック・削除 (イベント委譲 ― 親要素で一括処理)
$list.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const li = target.closest('.todo-item') as HTMLLIElement | null;
  if (!li) return;
  const id = li.dataset.id;
  if (target.matches('input[type="checkbox"]')) {
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  } else if (target.matches('.delete')) {
    todos = todos.filter(t => t.id !== id);
  } else {
    return;
  }
  save();
  render();
});

render();
```

**学べるポイント:**

- **イベント委譲**: 各 `<li>` にリスナーを付けず、親 `<ul>` に1つだけ付けて `e.target` で判定。Todo が1万件あってもリスナーは1個
- **`textContent` vs `innerHTML`**: プレーンテキストとして表示する値には`textContent`を使う。URL、属性、HTMLとして扱う必要がある場合は、出力先の文脈に応じた検証・エスケープ・安全なAPIが別途必要
- **`DocumentFragment`**: 複数要素をDOMに追加するとき、フラグメントに集めてから一度で挿入することでリフロー回数を減らす
- **`replaceChildren`**: 子要素を全置換する。引数にノードを渡すため、`innerHTML` のように文字列を経由しない
- **状態と表示の分離**: `todos` 配列 (状態) と `render()` (表示) を分けている。これがReactの「状態 → UI」モデルの原点

このアプリには大きな問題がある: 状態が変わるたびに**全部描画し直している**。1万件あったら毎クリックで1万要素を作り直すことになる。これを解決するのがReactの仮想DOMだ (第6章)。

<a id="section-4-8"></a>
### 4.8 Web標準APIの広がり
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"4.8"} -->

フレームワークへ進む前に、ブラウザ自身がすでに提供している能力の範囲を確認しておく必要がある。標準APIを知れば、ライブラリが本当に必要な部分と、薄いラッパーにすぎない部分を区別できる。

ブラウザには多くの標準APIが組み込まれている。フレームワークに頼る前に、標準で何ができるかを知っておくと選択肢が増える。代表例:

- **Fetch API**: HTTPリクエスト (`fetch()`)
- **Streams API**: ストリーミング処理
- **Web Workers**: マルチスレッド (重い計算を別スレッドで)
- **Service Workers**: オフライン対応、プッシュ通知の基盤
- **WebSocket**: 全二重通信
- **WebRTC**: P2Pビデオ通話
- **WebGL / WebGPU**: GPU を使った描画
- **WebAssembly**: 他言語のコードを高速実行
- **IndexedDB**: クライアント側のNoSQL DB
- **Intl API**: 国際化 (日付、数値、文字列フォーマット)
- **Crypto API**: 暗号処理 (`crypto.subtle`)
- **Intersection Observer**: 要素の可視性検知 (遅延読み込みの基盤)
- **Resize Observer**: 要素のサイズ変化検知

これらは第II部で実際に使いながら掘り下げる。

<a id="section-4-9"></a>
### 4.9 実装課題 ― ブラウザの内側を覗く
<!-- handbook:learning {"level":"practical","minutes":215} -->

<!-- handbook:narrative-bridge {"section":"4.9"} -->

第I部の最後は、通信で届いた文書が画面と操作へ変わるまでを実測する。レンダリング、DOM更新、タスク順序、モジュール境界を自分で観察することで、次部の抽象化を「便利だから」ではなく「どの負担を引き受けるか」で評価できる。

第4章ではブラウザがHTML/CSS/JavaScriptをどう処理するかを見た。本節では、実際にコードを書いてブラウザの動きを観察し、自分でも近いものを実装する。所要時間: 演習カードの推定時間の合計で7時間。

#### 課題4.1: レンダリングパイプラインを計測する (★)

**目的**: 「リフロー」「リペイント」が実際にいつ起きているかを計測で確認する。

<!-- handbook:exercise:start {"id":"4.1"} -->
> **演習カード 課題4.1** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: Chrome
>
> **前提**
>
> - 4.1 ブラウザのレンダリングパイプライン と 4.2 リフローとリペイントを抑える を読み、Layout・Paint・Composite を区別できる
> - Chrome の DevTools の Performance タブで記録・停止・区間選択ができる
> - `code/ch04/render-bench/starter/index.html` をローカルの HTTP サーバで配信し、ブラウザで開ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] Bad / Better / Best の3方式をそれぞれ実行し、画面の output に表示される所要ミリ秒を記録している
> - [ ] Performance の記録から Recalculate Style と Layout の発生回数を3方式それぞれについて数えている
> - [ ] Best と Bad の所要時間の倍率を計算している
> - [ ] Bad が遅い理由を、style書き込みと `offsetLeft` 読み取りの交互実行による強制同期レイアウトとして説明している
> - [ ] 測定に使った端末・ブラウザ版・要素数 (1000) を記録に残している
>
> **期待出力**
>
> - ページ読み込み時に `#stage` へ1000個の `.item` 要素が生成される
> - ボタン押下後に output へ `bad: NN.NN ms` の形式で方式名と経過時間が表示される
> - Performance のメインスレッド上で、Bad では Layout が多数並び、Best では Composite Layers 中心のフレームになる
> - Best は `requestAnimationFrame` のコールバック内で実行されるため、計測終了が次フレームまでずれる
>
> **観察項目**
>
> - Bad の実行中に Performance の Summary で Rendering の占有時間が跳ね上がることを確認する
> - Better では `display: none` の間の変更がレイアウトを起こさず、再表示時に1回だけ計算されることを確認する
> - Best では transform を使うためレイアウトが走らず、`will-change: transform` によりレイヤが分離されていることを Layers パネルで確認する
> - 同じ操作を DevTools を閉じた状態で行い、計測オーバーヘッドで絶対値が変わることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `python3 -m http.server --directory code/ch04/render-bench 8000` を起動し、http://localhost:8000/index.solution.html を開いて3つのボタンすべてで output にミリ秒が表示されれば計測が成立している
> 2. Performance を記録した状態で Bad を実行し、Layout イベントが1件以上記録されていれば計測点が正しい
> 3. 記録表が `code/ch04/solution.md` の4列 (方式、JavaScript区間、Layout回数、Paint回数) を3方式分埋めていれば合格とする
> 4. 倍率を単一の固定値で結論づけず、端末名とブラウザ版を併記していることを自己チェックする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に何を数えるかを決める。JavaScript の実行時間と、ブラウザがレイアウトへ使った時間は別物なので、`performance.measure` の値と Performance パネルの値を混ぜない。
> 2. **構造**: Bad は `el.style.left` の書き込み直後に `el.offsetLeft` を読むことで強制同期レイアウトを起こしている。Better は `stage.style.display='none'` で一時的に描画木から外す。Best は `requestAnimationFrame` の中で transform だけを変える。
> 3. **実装の要点**: Best の計測は非同期になるため、終了マークを `requestAnimationFrame` のコールバック内で打たないと 0 ms に近い誤った値が出る。3方式の間で要素を作り直し、初期状態を揃えてから比較する。
>
> **本番利用時の警告**
>
> - 得られたミリ秒は端末・ブラウザ版・拡張機能・DevToolsの有無で数倍変わる。「transform は N 倍速い」と固定倍率で社内へ共有しない
> - `will-change: transform` を広い範囲の要素へ付けるとレイヤが増えてGPUメモリを消費し、かえって遅くなる。本番では対象を限定する
>
> **導線**
>
> - 開始地点: `code/ch04/render-bench/starter/README.md`、`code/ch04/starter.md`
> - 模範解答: `code/ch04/render-bench/index.solution.html`、`code/ch04/render-bench/solution/README.md`、`code/ch04/solution.md`
>
> **推定時間の内訳**: 3方式の実行と数値記録に15分、Performanceパネルでの回数計測に20分、原因の記述に10分
<!-- handbook:exercise:end -->

**手順**:
1. `code/ch04/render-bench/` の HTML を開く
2. 3つのボタン (各 1000 要素のDOM操作) があるので順次クリック:
   - **Bad**: 1要素ごとに`style.left`を変える (1000回リフロー)
   - **Better**: `display: none`にしてから一括変更 → 再表示 (2回リフロー)
   - **Best**: `transform`で `requestAnimationFrame` 内に変更 (GPUコンポジット、リフローなし)
3. Chrome DevTools の Performance タブで記録し、各方式の総時間を比較

**問題**:
- それぞれ何 ms かかったか
- DevTools の Performance タブで `Recalculate Style` と `Layout` がそれぞれ何回起きたか
- Best 方式が他とどれくらい速いか (倍率)

模範解答: `code/ch04/render-bench/index.solution.html` + `code/ch04/solution.md`

#### 課題4.2: 純粋なDOM APIでTodoアプリ (★★)

**目的**: フレームワークなしでも、設計次第で読みやすく保守しやすいUIが書けることを確認する。

<!-- handbook:exercise:start {"id":"4.2"} -->
> **演習カード 課題4.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 4.3 DOMの中身 と 4.7 実装例: 純粋なDOM APIでTodoアプリを作る を読み、状態と描画を分ける構成を把握している
> - TypeScript を tsc でコンパイルし、ブラウザからESモジュールとして読み込める
> - `code/ch04/todo-vanilla/starter/index.html` と `starter/app.ts` を開始点にできる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 追加・削除・完了切替の3操作が動き、localStorage に保存されてリロード後も復元される
> - [ ] All / Active / Completed の3フィルタが切り替わり、選択中のボタンに `aria-pressed="true"` が付く
> - [ ] Enter で追加、Esc で入力欄クリア、Cmd/Ctrl+Enter で全件完了のキーボード操作が動く
> - [ ] 未完了件数が `aria-live="polite"` の領域に表示され、操作のたびに更新される
> - [ ] 状態が配列として1か所に保持され、DOMを状態の保管場所にしていない
> - [ ] チェックボックスと削除ボタンに、対象のTodo文言を含む `aria-label` が付いている
>
> **期待出力**
>
> - 入力して Enter を押すと `#todo-list` に li が1件追加され、`#status` が `N件が未完了` に更新される
> - 完了にすると li に `completed` クラスが付き、テキストに打ち消し線が入る
> - Active フィルタでは完了済みの li が一覧から消え、Completed では逆になる
> - リロード後も localStorage のキー `handbook-ch04-todos` から同じ一覧が復元される
> - localStorage の値が壊れていても例外で停止せず、空リストとして起動する
>
> **観察項目**
>
> - Elements パネルで1件追加したときにDOMのどの範囲が更新されるかを見て、全件再構築か差分更新かを判断する
> - Application パネルの Local Storage で `handbook-ch04-todos` のJSONを直接編集し、状態の単一の情報源がどこにあるかを確かめる
> - キーボードだけで追加・完了・削除まで到達できるか、Tab のフォーカス順を確認する
> - 削除後に入力欄へフォーカスが戻ることを確認し、フォーカス管理がない場合の操作の止まり方と比べる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch04 run test` を実行し、第4章のテストと教材ファイル検証が通ることを確認する
> 2. `rm -rf /tmp/ch04 && tsc -p code/ch04/tsconfig.json --outDir /tmp/ch04` でコンパイルし、`cp code/ch04/todo-vanilla/solution/index.html /tmp/ch04/todo-vanilla/solution/` の後に `/tmp/ch04` でHTTPサーバを起動して開き、追加・完了・削除・フィルタの4操作が動けば合格とする
> 3. DevTools のコンソールで `localStorage.setItem('handbook-ch04-todos', 'not json')` を実行してから再読み込みし、画面が白くならず空リストで起動することを確認する
> 4. マウスを使わずキーボードのみで1件追加してから全件完了まで操作できることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 状態 (Todoの配列とフィルタ) を先に決め、状態を変える関数と状態から画面を作る関数に分ける。イベントハンドラは状態を変えて再描画を呼ぶだけにする。
> 2. **構造**: 描画は `list.replaceChildren(...)` へ要素配列を渡す形にすると、差分計算を持たずに表示の一貫性を保てる。要素は `document.createElement` で作り、文字は `textContent` へ入れる。保存は `localStorage.setItem(key, JSON.stringify(todos))` で足りる。
> 3. **実装の要点**: localStorage のJSONは他のタブや手動編集で壊れうるため、`JSON.parse` を try で囲み、配列でなければ空配列へ落とす。文字列を `innerHTML` へ入れると入力がHTMLとして解釈されるので `textContent` を使う。
>
> **本番利用時の警告**
>
> - Todoの文字列を `innerHTML` で挿入する実装にすると、入力がそのままスクリプトとして実行される保存型XSSになる。`textContent` を使い、フレームワーク導入後も同じ原則を守る
> - localStorage は同一オリジンのどのスクリプトからも読める平文の保存領域で、暗号化も容量保証もない。認証トークンや個人情報を置かない
> - この実装は差分更新を持たず全件を再構築するため、数千件規模では操作のたびに再描画コストが線形に増える
>
> **導線**
>
> - 開始地点: `code/ch04/todo-vanilla/starter/index.html`、`code/ch04/todo-vanilla/starter/app.ts`、`code/ch04/todo-vanilla/starter/README.md`
> - 模範解答: `code/ch04/todo-vanilla/solution/index.html`、`code/ch04/todo-vanilla/solution/app.ts`、`code/ch04/todo-vanilla/solution/README.md`
>
> **推定時間の内訳**: 状態と描画の分離の設計に20分、追加削除完了とフィルタの実装に35分、localStorageとキーボード操作に20分、アクセシビリティ確認に15分
<!-- handbook:exercise:end -->

**要件**: vanilla TypeScript で以下の機能を持つTodoアプリを作る。
- 追加、削除、完了切替
- フィルタリング (All / Active / Completed)
- ローカルストレージ保存
- キーボードショートカット (Enter で追加、Esc でキャンセル、Cmd/Ctrl+Enter で全完了)
- アクセシビリティ対応 (セマンティックHTML、`aria-*`、フォーカス管理)

**評価基準**:
- 100行程度の TypeScript で書けるか
- 表示の一貫性を保ったまま、DOM を更新する回数を説明できるか (この演習では `replaceChildren` による全件再構築を採る。差分更新は第6章で仮想DOMとして扱う)
- 状態が UI と分離されているか

模範解答: `code/ch04/todo-vanilla/`(HTML + TypeScript)

#### 課題4.3: 最小限のイベントループを自作 (★★★)

**目的**: JavaScript のイベントループ・マイクロタスク・マクロタスクを実装して、挙動を完全に理解する。

<!-- handbook:exercise:start {"id":"4.3"} -->
> **演習カード 課題4.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 4.5 JavaScriptランタイムとイベントループ を読み、タスクとマイクロタスクのチェックポイントを説明できる
> - Promise と `queueMicrotask` の実行順序を実際のNode.jsで確認した経験がある
> - `code/ch04/event-loop/event-loop.ts` を開始点に TypeScript のクラスを書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] MiniEventLoop クラスが addMicrotask / addMacrotask / setTimeout / requestAnimationFrame の4つの登録APIを持つ
> - [ ] `run()` がキューが空になるまで回り、マクロタスクを1件処理するたびにマイクロタスクキューを空にする
> - [ ] 本文の例で `3. initial micro` → `1. macro` → `2. micro from macro` の順に出力される
> - [ ] マクロタスクの実行中に追加されたマイクロタスクが、次のマクロタスクより先に実行される
> - [ ] setTimeout が遅延の小さい順に発火し、同じ遅延なら登録順を保つ
> - [ ] タスクを無限に追加し続けるコードで停止するよう、実行ステップ数の上限を持つ
>
> **期待出力**
>
> - 本文のテストコードの出力が `3. initial micro` `1. macro` `2. micro from macro` の3行になる
> - 20ms と 10ms の順で setTimeout を登録しても、10ms 側が先に実行される
> - requestAnimationFrame へ登録した関数が、そのフレームのマクロタスク処理後にまとめて実行される
> - 上限を超えるタスク追加で `event loop exceeded maxSteps` の例外が投げられる
> - 負の遅延や非有限の遅延を渡すと例外になる
>
> **観察項目**
>
> - 同じ順序の実験を本物のNode.js (`setTimeout` と `queueMicrotask`) で書いて出力を比べ、自作ループが実挙動と一致しているか確認する
> - マイクロタスクの排出を1件ずつに変えると出力順がどう崩れるかを試し、チェックポイントの意味を確認する
> - requestAnimationFrame の処理をマイクロタスク排出の前に置くと順序が変わることを確認する
> - 仮想時刻を進める位置を変えると、タイマーの発火順が変わることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch04 run test` を実行し、`mini event loop drains initial and nested microtasks at checkpoints` がパスすることを確認する
> 2. `tsx code/ch04/event-loop/event-loop.solution.ts` を実行し、`3. initial micro` `1. macro` `2. micro from macro` の3行がこの順で出れば合格とする
> 3. 自分の実装で本文のテストコードを走らせ、出力順が3行とも一致することを確認する
> 4. タスクを無限に追加するケースを試し、プロセスが固まらず例外で終了することを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: キューを何本持つか、どのタイミングでマイクロタスクを空にするかを先に紙に書く。実装より先に、期待する出力順を数パターン列挙しておく。
> 2. **構造**: マイクロタスク・マクロタスク・アニメーションフレーム・タイマーの4本の配列を持つ。`run()` は最初にマイクロタスクを空にし、以後は「期限の来たタイマーをマクロタスクへ移す」「マクロタスクを1件実行」「マイクロタスクを空にする」を繰り返す。
> 3. **実装の要点**: 落とし穴はマイクロタスクの排出条件で、`while (queue.length)` にしないと実行中に追加された分が同じチェックポイントで処理されない。`for` で長さを固定してはいけない。タイマーは期限と登録順の2キーで安定ソートする。
>
> **本番利用時の警告**
>
> - この実装は仮想時刻で動くため、実時間のI/O完了、Node.jsのフェーズ (timers / poll / check)、`process.nextTick` の優先順位を再現しない。実行順の議論をこのモデルだけで結論づけない
> - 本物のイベントループの代替として業務コードのスケジューラへ転用すると、I/Oの飢餓や優先度逆転を招く。学習用のモデルにとどめる
>
> **導線**
>
> - 開始地点: `code/ch04/event-loop/event-loop.ts`
> - 模範解答: `code/ch04/event-loop/event-loop.solution.ts`
>
> **推定時間の内訳**: キュー構成の設計に25分、run() のチェックポイント実装に45分、タイマーとrAFの追加に35分、期待順序の検証と本物との比較に45分
<!-- handbook:exercise:end -->

**要件**: 純粋な JavaScript(Node.js でも可) で以下を持つ MiniEventLoop を実装。
- マイクロタスクキューとマクロタスクキュー
- `addMacrotask(fn)`, `addMicrotask(fn)`, `setTimeout(fn, ms)`, `requestAnimationFrame(fn)` 相当
- `run()` で実際にループを回す
- 各タスクの実行順序が**実ブラウザと同じになる**

**テスト**:
```javascript
const loop = new MiniEventLoop();
loop.addMacrotask(() => {
  console.log('1. macro');
  loop.addMicrotask(() => console.log('2. micro from macro'));
});
loop.addMicrotask(() => console.log('3. initial micro'));
loop.run();
// 期待される出力順:
// 3. initial micro
// 1. macro
// 2. micro from macro
```

**ヒント**: マイクロタスクは「現在のタスク完了時点で全部実行」、マクロタスクは「1個ずつ」。

模範解答: `code/ch04/event-loop/event-loop.solution.ts`

#### 課題4.4: CSS の Cascade を解析するツール (★★)

**目的**: CSS の「カスケード」が複雑な選択子ルールで成り立っていることを実装で理解する。

<!-- handbook:exercise:start {"id":"4.4"} -->
> **演習カード 課題4.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 4.4 CSSの仕組み を読み、詳細度が inline / id / class / type の4つ組で比較されることを説明できる
> - 正規表現でセレクタ文字列からトークンを抜き出せる
> - `code/ch04/css-specificity.ts` を開始点に TypeScript の関数を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `calculateSpecificity(selector)` が inline / id / class / type の4カウンタを返す
> - [ ] `#header .nav li:hover a` に対して id=1、class=2、type=2 を返す
> - [ ] 属性セレクタと疑似クラスを class と同じ桁で数え、疑似要素を type と同じ桁で数える
> - [ ] 全称セレクタ `*` と結合子 (`>` `+` `~`) を詳細度へ加算しない
> - [ ] 2つの詳細度を比較する関数と、セレクタ配列を優先度の降順に並べる関数を提供する
> - [ ] `!important` を検出し、比較時に他のどの桁よりも優先する
>
> **期待出力**
>
> - `calculateSpecificity('#header .nav li:hover a')` が `{ inline: 0, id: 1, class: 2, type: 2, important: false }` を返す
> - `calculateSpecificity(':where(#ignored) article')` が id=0、type=1 を返す (`:where` は詳細度0)
> - `:is(.a, #b)` は引数のうち最も強い `#b` を採用し、`.a` 単独より強くなる
> - `sortSelectors(['p', '.x', '#id'])` が `['#id', '.x', 'p']` を返す
> - コマンドラインでセレクタを渡すと、セレクタ文字列と4つ組が1行で出力される
>
> **観察項目**
>
> - DevTools の Styles パネルで打ち消されたルールに取り消し線が付く様子を見て、自分の計算結果と一致するか確認する
> - `:not(.a)` と `:where(.a)` を比べ、前者は引数の詳細度を持ち後者は0になることを確認する
> - 同じ詳細度のルールを2つ書き、後に書かれた方が勝つことを確認して、詳細度だけでは適用が決まらないと理解する
> - インラインスタイルと `!important` を組み合わせ、優先順位の最上位がどこにあるかを実際のブラウザで確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch04 run test` を実行し、`CSS specificity matches the chapter example` と `:where has zero specificity and :is uses the strongest argument` の2件がパスすることを確認する
> 2. `tsx code/ch04/css-specificity.solution.ts '#header .nav li:hover a'` を実行し、id=1・class=2・type=2 の4つ組が表示されれば合格とする
> 3. 自分の実装へ `*`、`div > p`、`a::before`、`[data-x]` の4つを入力し、順に type=0、type=2、type=2でclass=0、class=1 になることを確認する
> 4. 比較関数へ同じ詳細度を2つ渡して 0 が返り、ソートが安定していることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 数える前に消す方が楽になる。強い順に id、class相当、type相当とマッチさせ、マッチした部分をセレクタ文字列から削っていくと二重計上を防げる。
> 2. **構造**: `:where(...)` は中身ごと削除し、`:is(...)` `:not(...)` `:has(...)` は引数をカンマで分割して再帰的に計算し最大値を足す。疑似要素は `::` の2文字で先に判定し、残った `:` を疑似クラスとして扱う。
> 3. **実装の要点**: 詰まりやすいのは疑似要素と疑似クラスの取り違えで、`::before` を先に取り除かないと class 側へ数えてしまう。比較は important・inline・id・class・type の順に並べた配列を先頭から見て、最初に差が出た桁で決める。
>
> **本番利用時の警告**
>
> - この実装は正規表現によるセレクタ解析であり、CSSの完全な文法 (エスケープ、ネスト、条件付きルール) を扱わない。実際のスタイル適用の根拠として使うとDevToolsの表示とずれる
> - 詳細度の競合を `!important` で解決する運用は、後から上書きする手段が無くなり保守を難しくする。詳細度を上げずに済む構造を選ぶ
>
> **導線**
>
> - 開始地点: `code/ch04/css-specificity.ts`
> - 模範解答: `code/ch04/css-specificity.solution.ts`
>
> **推定時間の内訳**: カウント関数の実装に35分、:is / :not / :where の再帰処理に25分、比較とソートに15分、境界ケースの検証に15分
<!-- handbook:exercise:end -->

**要件**: 以下のような CSS のセレクタの specificity (詳細度) を計算する関数を実装:

```typescript
calculateSpecificity('#header .nav li:hover a');
// → { inline: 0, id: 1, class: 2, type: 2 }  → 0,1,2,2
//   #header = id 1個
//   .nav, :hover = class 2個
//   li, a = type 2個
```

**評価基準**:
- ID/class/疑似クラス/型セレクタ/疑似要素を正しく数える
- 比較関数を提供して、複数セレクタを優先度順にソートできる
- `!important` の扱いも (発展)

模範解答: `code/ch04/css-specificity.solution.ts`

#### 課題4.5: ESM と CommonJS の混在問題を再現 (★)

**目的**: Node.js の `require` / `import` の違いを実演し、なぜ問題が起きるか理解する。

<!-- handbook:exercise:start {"id":"4.5"} -->
> **演習カード 課題4.5** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 4.6 モジュールシステムの進化 を読み、CommonJSの実行時解決とESMの静的解析の違いを説明できる
> - Node.js 24 系が入っており、`node <ファイル>` で `.js` `.mjs` `.cjs` を実行できる
> - `package.json` の `type` フィールドが拡張子の解釈を変えることを知っている
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `"type": "module"` のディレクトリと `"type": "commonjs"` のディレクトリを別々に用意して比較している
> - [ ] ESM から import した場合が成功し、ESM 内でグローバル `require` を呼ぶと失敗することを実行結果で示している
> - [ ] CJS から require した場合が成功し、`.cjs` の中で静的 import を書くと構文エラーになることを示している
> - [ ] ESM から CJS を default import すると `module.exports` 全体が渡ることを確認している
> - [ ] 4つ以上の組み合わせについて、成功か失敗かとエラーの種類 (ReferenceError か SyntaxError か) を記録している
>
> **期待出力**
>
> - ESM の `import value, { foo } from './value.js'` が `esm default esm named` の1行を出力する
> - ESM 内で `require('./value.js')` を実行すると `ReferenceError: require is not defined in ES module scope` が出て非0で終了する
> - `.cjs` 内の静的 import は `SyntaxError: Cannot use import statement outside a module` になる
> - ESM から `.cjs` を default import すると `module.exports` のオブジェクトが渡り、そのプロパティを参照できる
> - スクリプトは失敗ケースでも停止せず `exit=N (expected failure for this case)` を出して次のケースへ進む
>
> **観察項目**
>
> - エラー種別が実行時の ReferenceError と解析時の SyntaxError に分かれることを見て、ESMの解決が実行前に行われることを確認する
> - CJS の名前付きエクスポートをESMから named import できる場合とできない場合を試し、Node.jsの静的解析による推測に依存すると分かる
> - `package.json` から `type` を削除して同じスクリプトを動かし、`MODULE_TYPELESS_PACKAGE_JSON` の警告が出たうえで ES module として解釈されることを確認する。Node.js は import/export の有無から構文を判定するようになったため、`type` を消しても CommonJS へは倒れない。CommonJS を明示するには `"type": "commonjs"` を書くか、拡張子を `.cjs` にする
> - ESM 内では `__dirname` と `require` が未定義であることを確認し、`import.meta.url` での代替を試す
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch04/esm-vs-cjs/solution/main.sh` を実行し、5つのケースが順に走って成功ケースの出力と失敗ケースの `exit=` 表示が出れば再現できている
> 2. 出力に `ReferenceError: require is not defined` と `Cannot use import statement outside a module` の両方が含まれることを確認する
> 3. `pnpm --filter @handbook/ch04 run test` を実行し、第4章の教材ファイル検証が通ることを確認する
> 4. 自分の記録が本文の3つの問い (CJSがimportを使う、ESMがrequireを使う、`module.exports = { foo }` と `export const foo` の互換性) すべてに答えていれば合格とする
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 再現は一時ディレクトリで行う。既存プロジェクトの `package.json` を書き換えると他の課題まで壊れるので、`mktemp -d` で作った場所へ小さな2つのパッケージを置く。
> 2. **構造**: esm 側に `{"type":"module"}`、cjs 側に `{"type":"commonjs"}` を書き、両方に同じ意味のモジュールを `export const` と `module.exports` で用意する。呼び出し側を4通り作り、`node` で順に実行する。
> 3. **実装の要点**: 失敗するケースがあるためスクリプトを `set -e` のままにすると途中で止まる。各実行をラッパー関数で包み、非0終了でも終了コードを表示して次のケースへ進むようにする。ESMからCJSを読むときは named import ではなく default import から始めると挙動が安定する。
>
> **本番利用時の警告**
>
> - Node.jsのバージョンによってCJSとESMの相互運用の挙動 (ESMをrequireできるか、named exportの推測精度) が変わる。ここで観察した結果を全バージョン共通の仕様として扱わない
> - 拡張子や `type` を明示せず暗黙の判定に頼ったまま公開パッケージを配ると、利用側の環境でだけ壊れる。配布時は `exports` フィールドで入口を明示する
>
> **導線**
>
> - 開始地点: `code/ch04/esm-vs-cjs/starter/main.sh`
> - 模範解答: `code/ch04/esm-vs-cjs/solution/main.sh`、`code/ch04/esm-vs-cjs/solution.md`
>
> **推定時間の内訳**: 一時ディレクトリと2パッケージの用意に15分、4通りの組み合わせの実行に15分、エラー種別の記録と説明に15分
<!-- handbook:exercise:end -->

**手順**:
1. `code/ch04/esm-vs-cjs/` に CJS と ESM の両方のモジュールを用意した
2. それぞれから相互に参照すると何が起きるか試す
3. 「default export」と「named export」の差を観察
4. `package.json` の `"type": "module"` の効果を確認

**問題**: 以下の各組み合わせで何が起こるか説明せよ:
- CJS ファイルが `import` 文を使う
- ESM ファイルが `require()` を使う
- 同じ実体を CJS の `module.exports = { foo }` と ESM の `export const foo` で書いた時の互換性

模範解答: `code/ch04/esm-vs-cjs/solution.md`

---

<!-- handbook:code-usage:start {"chapter":4} -->
### 第4章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第4章の模範解答をまとめて検証する
pnpm --filter @handbook/ch04 run test

# 模範解答を個別に実行する
open code/ch04/render-bench/index.solution.html                          # 課題4.1
open code/ch04/todo-vanilla/solution/index.html                          # 課題4.2
pnpm --filter @handbook/ch04 exec tsx event-loop/event-loop.solution.ts  # 課題4.3
pnpm --filter @handbook/ch04 exec tsx css-specificity.solution.ts        # 課題4.4
bash code/ch04/esm-vs-cjs/solution/main.sh                               # 課題4.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch04/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。

`open` は macOS のコマンドである。Linux では `xdg-open`、Windows では `start` を使う。
<!-- handbook:code-usage:end -->


---

## まとめ ― 第I部の総括

第I部の出発点では、ブラウザにページが表示される現象を一つの出来事として見ていた。ここまで進むと、その出来事を役割の異なる連鎖として説明できる。

1. URIとURLが、利用者の求めるリソースを構造化された名前で指し示す。
2. DNSが、その名前を現在接続できるネットワーク上の宛先へ変換する。
3. TCPとTLSが、メッセージを運び、必要な相手認証・機密性・完全性を与える。
4. HTTPが、要求の意図、処理結果、表現形式、キャッシュや認証の条件を共有する。
5. ブラウザがHTML・CSS・JavaScriptをDOM、CSSOM、タスクへ変換し、レイアウト、ペイント、コンポジットを経て画面を更新する。

この分解は、障害調査の順序でもある。画面が遅いときに、DNSなのか、接続なのか、TTFBなのか、JavaScriptなのか、レイアウトなのかを順に観測できる。各層は独立しているのではなく、前の層が作った条件を受け取り、次の層へ結果を渡している。

一方、純粋なDOM APIでTodoアプリを作ると、別の問題が見えてくる。ブラウザの原理が分かっても、状態が増えるたびにDOMとの差分、非同期処理、依存モジュールを人手で同期するのは難しい。第II部では、この複雑さをどのような抽象化で引き受けるかという問いから、JavaScriptとTypeScriptの中核機構、フレームワーク、状態管理、ビルド、レンダリング戦略へ進む。

