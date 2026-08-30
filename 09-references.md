# 参考文献

本書で参照した文献および、各章の理解を深めるための推奨資料を、著者の姓のアルファベット順にまとめる。日本語訳がある書籍は併記した。

## 書籍

[Adzic, 2011] Adzic, G. (2011). *Specification by Example: How Successful Teams Deliver the Right Software*. Manning. ※例を仕様と自動テストの共通の情報源として扱う進め方。

[Beyer et al., 2016] Beyer, B., Jones, C., Petoff, J., Murphy, N. R. (2016). *Site Reliability Engineering: How Google Runs Production Systems*. O'Reilly Media. (邦訳: 『SRE サイトリライアビリティエンジニアリング — Googleの信頼性を支えるエンジニアリングチーム』 オライリー・ジャパン、2017)

[Brown, 2018] Brown, S. (2018). *The C4 Model for Software Architecture*. https://c4model.com/ ※C4 モデルの公式ガイド。

[Cockburn, 2000] Cockburn, A. (2000). *Writing Effective Use Cases*. Addison-Wesley. (邦訳: 『ユースケース実践ガイド ― 効果的なユースケースの書き方』 翔泳社、2001) ※ユースケースの粒度と拡張(例外)の書き方。

[Cohn, 2004] Cohn, M. (2004). *User Stories Applied: For Agile Software Development*. Addison-Wesley. ※ユーザーストーリーの記述形式と分割の指針。

[Cohn, 2009] Cohn, M. (2009). *Succeeding with Agile: Software Development Using Scrum*. Addison-Wesley. ※テストピラミッドの概念を提唱した書。

[Evans, 2003] Evans, E. (2003). *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley. (邦訳: 『エリック・エヴァンスのドメイン駆動設計』 翔泳社、2011)

[Feathers, 2004] Feathers, M. (2004). *Working Effectively with Legacy Code*. Prentice Hall. (邦訳: 『レガシーコード改善ガイド』 翔泳社、2009)

[Forsgren et al., 2018] Forsgren, N., Humble, J., Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps: Building and Scaling High Performing Technology Organizations*. IT Revolution Press. (邦訳: 『LeanとDevOpsの科学』 インプレス、2018) ※DORA メトリクスの根拠論文。

[Fowler, 2018] Fowler, M. (2018). *Refactoring: Improving the Design of Existing Code* (2nd ed.). Addison-Wesley. (邦訳: 『リファクタリング 既存のコードを安全に改善する 第2版』 オーム社、2019)

[Gregg, 2019] Gregg, B. (2019). *BPF Performance Tools*. Addison-Wesley. ※eBPF/BCC/bpftrace の決定版書籍。

[Hoffman, 2016] Hoffman, K. (2016). *Beyond the Twelve-Factor App*. O'Reilly Media. ※12-Factor App をクラウド時代に拡張した15因子。

[Kleppmann, 2017] Kleppmann, M. (2017). *Designing Data-Intensive Applications*. O'Reilly Media. (邦訳: 『データ指向アプリケーションデザイン』 オライリー・ジャパン、2019) ※第IV部全体の参考。レプリケーション、分散、ストリーミングの体系書。

[Martin, 2008] Martin, R. C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall. (邦訳: 『Clean Code アジャイルソフトウェア達人の技』 KADOKAWA、2017)

[Martin, 2017] Martin, R. C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall. (邦訳: 『Clean Architecture 達人に学ぶソフトウェアの構造と設計』 KADOKAWA、2018)

[Newman, 2021] Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems* (2nd ed.). O'Reilly Media. (邦訳: 『マイクロサービスアーキテクチャ 第2版』 オライリー・ジャパン、2022)

[McLean, 2015] McLean, T. (2015). "Critical Vulnerabilities in JSON Web Token Libraries." Auth0 Blog. https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/ ※`alg: none` と鍵取り違えによる署名回避の公表。

[Nygard, 2018] Nygard, M. T. (2018). *Release It!: Design and Deploy Production-Ready Software* (2nd ed.). Pragmatic Bookshelf. (邦訳: 『Release It! 本番用ソフトウェア製品の設計とデプロイのために』 オーム社、2009) ※Circuit Breaker、Bulkhead の出典。

[Schwartz et al., 2012] Schwartz, B., Zaitsev, P., Tkachenko, V. (2012). *High Performance MySQL: Optimization, Backups, and Replication* (3rd ed.). O'Reilly Media. (邦訳: 『実践ハイパフォーマンスMySQL 第3版』 オライリー・ジャパン、2013)

[Skelton & Pais, 2019] Skelton, M., Pais, M. (2019). *Team Topologies: Organizing Business and Technology Teams for Fast Flow*. IT Revolution Press. (邦訳: 『チームトポロジー 価値あるソフトウェアをすばやく届ける適応型組織設計』 日本能率協会マネジメントセンター、2021)

[Vernon, 2013] Vernon, V. (2013). *Implementing Domain-Driven Design*. Addison-Wesley. (邦訳: 『実践ドメイン駆動設計』 翔泳社、2015)

[ミック, 2016] ミック (2016). 『達人に学ぶ SQL徹底指南書 第2版』 翔泳社.

## 論文・技術レポート

[Abadi, 2012] Abadi, D. (2012). "Consistency Tradeoffs in Modern Distributed Database System Design: CAP is Only Part of the Story." *IEEE Computer*, 45(2), 37-42. ※PACELC定理の提唱論文。

[Basiri et al., 2016] Basiri, A., Behnam, N., de Rooij, R., Hochstein, L., Kosewski, L., Reynolds, J., Rosenthal, C. (2016). "Chaos Engineering." *IEEE Software*, 33(3), 35-41. ※Netflix のカオスエンジニアリング論文。

[Berners-Lee, 1989] Berners-Lee, T. (1989). *Information Management: A Proposal*. CERN. https://www.w3.org/History/1989/proposal.html

[Bernstein et al., 2011] Bernstein, D. J., Duif, N., Lange, T., Schwabe, P., Yang, B. Y. (2011). "High-Speed High-Security Signatures." *Journal of Cryptographic Engineering*, 2(2), 77-89. ※Ed25519 提案論文。

[Brewer, 2000] Brewer, E. (2000). "Towards Robust Distributed Systems." *PODC Keynote*. ※CAP定理の発端講演。

[Business Rules Group, 2003] The Business Rules Group (2003). *Business Rules Manifesto*, Version 2.0. https://www.businessrulesgroup.org/brmanifesto.htm ※業務ルールを制約・導出・反応へ分けて扱う原則。

[Codd, 1970] Codd, E. F. (1970). "A Relational Model of Data for Large Shared Data Banks." *Communications of the ACM*, 13(6), 377-387.

[Conway, 1968] Conway, M. E. (1968). "How Do Committees Invent?" *Datamation*, 14(4), 28-31. ※Conway's Law の原典。

[Fielding, 2000] Fielding, R. T. (2000). *Architectural Styles and the Design of Network-based Software Architectures*. PhD Dissertation, University of California, Irvine. ※REST の原典。

[Gilbert and Lynch, 2002] Gilbert, S., Lynch, N. (2002). "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services." *ACM SIGACT News*, 33(2), 51-59. ※CAP定理の形式的証明。

[Jeffries, 2001] Jeffries, R. (2001). "Essential XP: Card, Conversation, Confirmation." XProgramming. https://ronjeffries.com/xprog/articles/expcardconversationconfirmation/ ※ユーザーストーリーの3C。

[Lewis et al., 2020] Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W., Rocktäschel, T., Riedel, S., Kiela, D. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." *NeurIPS 2020*.

[Merkle, 1987] Merkle, R. C. (1987). "A Digital Signature Based on a Conventional Encryption Function." *CRYPTO '87*, LNCS 293, 369-378. ※Merkle Tree の原典。

[Nakamoto, 2008] Nakamoto, S. (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System*. https://bitcoin.org/bitcoin.pdf

[Newman et al., 2022] Newman, Z., Lorenz, J. K., Lewis, M., Newman, B. (2022). "Sigstore: Software Signing for Everybody." *ACM CCS 2022*.

[NIST PQC, 2024] National Institute of Standards and Technology (2024). *Post-Quantum Cryptography Standards*. FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA). https://csrc.nist.gov/projects/post-quantum-cryptography

[North, 2006] North, D. (2006). "Introducing BDD." *Better Software*. https://dannorth.net/introducing-bdd/ ※Given/When/Then による振る舞い記述の原典。

[Somorovsky et al., 2012] Somorovsky, J., Mayer, A., Schwenk, J., Kampmann, M., Jensen, M. (2012). "On Breaking SAML: Be Whoever You Want to Be." *21st USENIX Security Symposium*. ※XML Signature Wrapping 攻撃の代表論文。

[Trusted Types at Google, 2020] Akhawe, D. et al. (2020). "Trusted Types - How Google Mitigates DOM-based XSS." Google Security Blog. ※Trusted Types の実運用事例。

[Wake, 2003] Wake, B. (2003). "INVEST in Good Stories, and SMART Tasks." XP123. https://xp123.com/articles/invest-in-good-stories-and-smart-tasks/ ※ユーザーストーリーの品質基準 INVEST。

[Wood, 2014] Wood, G. (2014). *Ethereum: A Secure Decentralised Generalised Transaction Ledger*. Ethereum Yellow Paper. https://ethereum.github.io/yellowpaper/paper.pdf

[Wynne, 2015] Wynne, M. (2015). "Introducing Example Mapping." Cucumber Blog. https://cucumber.io/blog/bdd/example-mapping-introduction/ ※ストーリー・ルール・例・疑問を25分で並べる進め方。

## RFC・公式仕様

[Belshe et al., 2015] Belshe, M., Peon, R., Thomson, M. (Eds.) (2015). *Hypertext Transfer Protocol Version 2 (HTTP/2)*. RFC 7540. (現行は RFC 9113, 2022)

[ECMA-402] Ecma International (2025). *ECMAScript Internationalization API Specification*. ECMA-402, 12th edition. https://tc39.es/ecma402/ ※`Intl.DateTimeFormat` の `timeZone` オプションを含む、国際化の書式化仕様。

[Hardt, 2012] Hardt, D. (Ed.) (2012). *The OAuth 2.0 Authorization Framework*. RFC 6749.

[Hammer-Lahav, 2010] Hammer-Lahav, E. (Ed.) (2010). *The OAuth 1.0 Protocol*. RFC 5849. ※OAuth 1.0a の標準化文書。

[IETF OAuth 2.1] Hardt, D., Parecki, A., Lodderstedt, T. (Eds.) (Draft). *The OAuth 2.1 Authorization Framework*. draft-ietf-oauth-v2-1. ※OAuth 2.0 のベストプラクティス統合。PKCE 必須化、Implicit Flow 廃止など。

[ISO 4217] ISO (2015). *Codes for the representation of currencies*. ISO 4217:2015. https://www.iso.org/iso-4217-currency-codes.html ※通貨コードと、通貨ごとの小数桁 (minor unit) の一次資料。実際の桁数は維持機関が公表する表で確認する。

[ISO/IEC 25010:2023] ISO/IEC (2023). *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model*. ISO/IEC 25010:2023. https://www.iso.org/standard/78176.html ※製品品質モデル。2023年改訂で9つの品質特性を定義。

[JSON Schema, 2020] Wright, A., Andrews, H., Hutton, B., Dennis, G. (2020). *JSON Schema: A Media Type for Describing JSON Documents*. draft-bhutton-json-schema-00 (2020-12). https://json-schema.org/draft/2020-12/schema

[Krawczyk et al., 1997] Krawczyk, H., Bellare, M., Canetti, R. (1997). *HMAC: Keyed-Hashing for Message Authentication*. RFC 2104.

[NIST SP 800-207, 2020] Rose, S., Borchert, O., Mitchell, S., Connelly, S. (2020). *Zero Trust Architecture*. NIST Special Publication 800-207. https://doi.org/10.6028/NIST.SP.800-207 ※Zero Trust の標準ガイドライン。

[NIST SP 800-57 Part 1, 2020] Barker, E. (2020). *Recommendation for Key Management: Part 1 – General* (Revision 5). NIST Special Publication 800-57 Part 1 Rev. 5. https://doi.org/10.6028/NIST.SP.800-57pt1r5 ※鍵の階層、有効期間、ローテーションの指針。

[NIST SP 800-63B] National Institute of Standards and Technology. *Digital Identity Guidelines: Authentication and Authenticator Management*. NIST Special Publication 800-63B. https://pages.nist.gov/800-63-4/sp800-63b.html ※記憶シークレットの長さ要件、合成規則 (大小英数の混在強制) を課さないこと、定期変更を求めないことの一次資料。

[OMG, 2017] Object Management Group (2017). *OMG Unified Modeling Language (OMG UML), Version 2.5.1*. formal/2017-12-05. https://www.omg.org/spec/UML/2.5.1/ ※状態機械の記法。

[RFC 1918] Rekhter, Y., Moskowitz, B., Karrenberg, D., de Groot, G. J., Lear, E. (1996). *Address Allocation for Private Internets*. RFC 1918. ※プライベートIP範囲 (10/8、172.16/12、192.168/16)。

[RFC 3339] Klyne, G., Newman, C. (2002). *Date and Time on the Internet: Timestamps*. RFC 3339. ※インターネット上の日時表記。ISO 8601 のプロファイル。

[RFC 3464] Moore, K., Vaudreuil, G. (2003). *An Extensible Message Format for Delivery Status Notifications*. RFC 3464. ※バウンス通知 (DSN) の形式と、恒久・一時を区別するステータスコード。

[RFC 4226] M'Raihi, D., Bellare, M., Hoornaert, F., Naccache, D., Ranen, O. (2005). *HOTP: An HMAC-Based One-Time Password Algorithm*. RFC 4226.

[RFC 5849] Hammer-Lahav, E. (Ed.) (2010). *The OAuth 1.0 Protocol*. RFC 5849.

[RFC 5965] Shafranovich, Y., Levine, J., Kucherawy, M. (2010). *An Extensible Format for Email Feedback Reports*. RFC 5965. ※フィードバックループで使われる ARF 形式。迷惑メール報告の受け取りに用いる。

[RFC 6238] M'Raihi, D., Machani, S., Pei, M., Rydell, J. (2011). *TOTP: Time-Based One-Time Password Algorithm*. RFC 6238.

[RFC 6376] Crocker, D., Hansen, T., Kucherawy, M. (Eds.) (2011). *DomainKeys Identified Mail (DKIM) Signatures*. RFC 6376. ※メールのヘッダと本文への電子署名。公開鍵は `<selector>._domainkey.<domain>` の DNS に置く。

[RFC 6557] Lear, E., Eggert, P. (2012). *Procedures for Maintaining the Time Zone Database*. RFC 6557. ※IANA タイムゾーンデータベースの維持手続き。

[RFC 6585] Nottingham, M., Fielding, R. (2012). *Additional HTTP Status Codes*. RFC 6585. ※`429 Too Many Requests` と `Retry-After` の併用を定義した文書。

[RFC 6797] Hodges, J., Jackson, C., Barth, A. (2012). *HTTP Strict Transport Security (HSTS)*. RFC 6797.

[RFC 6962] Laurie, B., Langley, A., Kasper, E. (2013). *Certificate Transparency*. RFC 6962.

[RFC 6979] Pornin, T. (2013). *Deterministic Usage of the Digital Signature Algorithm (DSA) and Elliptic Curve Digital Signature Algorithm (ECDSA)*. RFC 6979.

[RFC 7208] Kitterman, S. (2014). *Sender Policy Framework (SPF) for Authorizing Use of Domains in Email, Version 1*. RFC 7208. ※エンベロープ From のドメインに対する送信元IPの認可。

[RFC 7489] Kucherawy, M., Zwicky, E. (Eds.) (2015). *Domain-based Message Authentication, Reporting, and Conformance (DMARC)*. RFC 7489. ※SPF/DKIM の整合 (alignment) とポリシー、集計レポートの宣言。

[RFC 7515] Jones, M., Bradley, J., Sakimura, N. (2015). *JSON Web Signature (JWS)*. RFC 7515.

[RFC 7516] Jones, M., Hildebrand, J. (2015). *JSON Web Encryption (JWE)*. RFC 7516.

[RFC 7517] Jones, M. (2015). *JSON Web Key (JWK)*. RFC 7517.

[RFC 7518] Jones, M. (2015). *JSON Web Algorithms (JWA)*. RFC 7518.

[RFC 7519] Jones, M., Bradley, J., Sakimura, N. (2015). *JSON Web Token (JWT)*. RFC 7519.

[RFC 7578] Masinter, L. (2015). *Returning Values from Forms: multipart/form-data*. RFC 7578. ※`filename` をファイルシステムのパスとして解釈しないよう注意を明記している。

[RFC 7636] Sakimura, N., Bradley, J., Agarwal, N. (2015). *Proof Key for Code Exchange by OAuth Public Clients (PKCE)*. RFC 7636.

[RFC 7643] Hunt, P., Grizzle, K., Wahlstroem, E., Mortimore, C. (2015). *System for Cross-domain Identity Management: Core Schema*. RFC 7643. ※SCIM 2.0 スキーマ。

[RFC 7644] Hunt, P., Grizzle, K., Ansari, M., Wahlstroem, E., Mortimore, C. (2015). *System for Cross-domain Identity Management: Protocol*. RFC 7644. ※SCIM 2.0 プロトコル。

[RFC 8058] Levine, J., Herkula, T. (2017). *Signaling One-Click Functionality for List Email Headers*. RFC 8058. ※`List-Unsubscribe-Post` によるワンクリック解除。

[RFC 8417] Hunt, P., Denniss, W., Ansari, M., Jones, M. (2018). *Security Event Token (SET)*. RFC 8417.

[RFC 8439] Nir, Y., Langley, A. (2018). *ChaCha20 and Poly1305 for IETF Protocols*. RFC 8439.

[RFC 8446] Rescorla, E. (2018). *The Transport Layer Security (TLS) Protocol Version 1.3*. RFC 8446.

[RFC 8705] Campbell, B., Bradley, J., Sakimura, N., Lodderstedt, T. (2020). *OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens*. RFC 8705.

[RFC 8725] Sheffer, Y., Hardt, D., Jones, M. (2020). *JSON Web Token Best Current Practices*. RFC 8725. ※`alg` の明示指定、対象者と発行者の検証、鍵の取り違え防止など、JWT を安全に扱うための必須事項。

[RFC 8935] Backman, A. (Ed.), Scurtescu, M., Jain, P. (2020). *Push-Based Security Event Token (SET) Delivery Using HTTP*. RFC 8935.

[RFC 8936] Backman, A. (Ed.), Jones, M., Scurtescu, M., Ansari, M., Nadalin, A. (2020). *Poll-Based Security Event Token (SET) Delivery Using HTTP*. RFC 8936.

[RFC 9110] Fielding, R., Nottingham, M., Reschke, J. (Eds.) (2022). *HTTP Semantics*. RFC 9110.

[RFC 9111] Fielding, R., Nottingham, M., Reschke, J. (Eds.) (2022). *HTTP Caching*. RFC 9111.

[RFC 9112] Fielding, R., Nottingham, M., Reschke, J. (Eds.) (2022). *HTTP/1.1*. RFC 9112.

[RFC 9114] Bishop, M. (Ed.) (2022). *HTTP/3*. RFC 9114.

[RFC 9449] Fett, D., Campbell, B., Bradley, J., Lodderstedt, T., Jones, M., Waite, D. (2023). *OAuth 2.0 Demonstrating Proof of Possession (DPoP)*. RFC 9449.

[RFC 9457] Nottingham, M., Wilde, E., Dalal, S. (2023). *Problem Details for HTTP APIs*. RFC 9457. ※HTTPエラー本文の標準形式。RFC 7807 を置き換えたもの。

[RFC 9493] Backman, A., Scurtescu, M., Jain, P. (2023). *Subject Identifiers for Security Event Tokens*. RFC 9493.

[RFC 9557] Sharma, U., Bormann, C. (2024). *Date and Time on the Internet: Timestamps with Additional Information*. RFC 9557. ※RFC 3339 を拡張し、タイムゾーンIDなどの注記を表記に加える形式。

[RFC 9700] Lodderstedt, T., Bradley, J., Labunets, A., Fett, D. (2025). *Best Current Practice for OAuth 2.0 Security*. RFC 9700. ※OAuth 2.0 Security BCP。`redirect_uri` の完全一致照合、公開クライアントでの PKCE 必須、Implicit Flow の非推奨を規定する。

[W3C SRI, 2016] W3C (2016). *Subresource Integrity*. https://www.w3.org/TR/SRI/

[W3C Trusted Types] W3C (Draft). *Trusted Types*. https://www.w3.org/TR/trusted-types/

[W3C ARIA, 2023] W3C (2023). *Accessible Rich Internet Applications (WAI-ARIA) 1.2*. https://www.w3.org/TR/wai-aria-1.2/ ※`role` と `aria-*` の定義、および ARIA の使用原則。

[W3C APG] W3C WAI (2026年8月時点). *ARIA Authoring Practices Guide (APG)*. https://www.w3.org/WAI/ARIA/apg/ ※複合ウィジェットのキー操作の慣習 (Tab はウィジェット間、矢印はウィジェット内)、ロービング tabindex、モーダルのフォーカス管理。

[W3C WCAG, 2018] W3C (2018). *Web Content Accessibility Guidelines (WCAG) 2.1*. https://www.w3.org/TR/WCAG21/

[W3C WCAG, 2024] W3C (2024). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/ ※レベルA / AA / AAA の達成基準。適合の表明が法的に何を意味するかは法域と調達要件で異なるため、専門家に確認する。

[W3C WebAuthn, 2021] W3C (2021). *Web Authentication: An API for accessing Public Key Credentials Level 2*. https://www.w3.org/TR/webauthn-2/

## オンラインリソース・標準

[AWS SaaS Lens, 2024] Amazon Web Services (2024). *SaaS Lens — AWS Well-Architected Framework*. https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/saas-lens.html ※テナント分離をサイロ・プール・ブリッジとして整理する語彙の出典。

[APPI/PPC] 個人情報保護委員会 (2026年8月時点). *個人情報の保護に関する法律についてのガイドライン*. https://www.ppc.go.jp/personalinfo/legal/ ※日本の個人情報保護法とその解釈を示す当局公表文書。適用の判断は法務へ確認する。

[Cucumber Gherkin Reference] Cucumber (2026年6月時点). *Gherkin Reference*. https://cucumber.io/docs/gherkin/reference/ ※Given/When/Then を含む Gherkin の構文定義。

[Deque axe-core] Deque Systems (2026年8月時点). *axe-core rule descriptions*. https://dequeuniversity.com/rules/axe/ ※自動検査が判定できる規則の一覧。判定できない項目との境界を確認する出典。

[Dodds, 2018] Dodds, K. C. (2018). "Write tests. Not too many. Mostly integration." https://kentcdodds.com/blog/write-tests ※テストトロフィー提唱記事。

[EU GDPR, 2016] European Union (2016). *Regulation (EU) 2016/679 (General Data Protection Regulation)*. Official Journal of the European Union. https://eur-lex.europa.eu/eli/reg/2016/679/oj ※条文の一次資料。適用範囲と要件の判断は法務へ確認する。

[Fowler, 2004] Fowler, M. (2004). "StranglerFigApplication." https://martinfowler.com/bliki/StranglerFigApplication.html

[IANA Time Zone Database] IANA (2026年8月時点). *Time Zone Database*. https://www.iana.org/time-zones ※タイムゾーン規則の一次データ。版番号つきで年に数回更新される。

[OASIS SAML, 2005] OASIS (2005). *Security Assertion Markup Language (SAML) V2.0 Technical Overview*. https://docs.oasis-open.org/security/saml/v2.0/ ※SAML 2.0 のコア仕様。Core、Bindings、Profiles、Metadata 等の複数文書から構成される。

[OWASP ATP] OWASP Foundation (2026年8月時点). *OWASP Automated Threats to Web Applications*. https://owasp.org/www-project-automated-threats-to-web-applications/ ※自動化された脅威 (OAT) の分類と語彙。

[OWASP Credential Stuffing] OWASP Foundation (2026年8月時点). *Credential Stuffing Prevention Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html ※多層防御、漏洩資格情報の照合、アカウント列挙の防止。

[OWASP File Upload] OWASP Foundation (2026年8月時点). *File Upload Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html ※受理・保存・配信の各段階での検証項目。

[OpenAPI, 2021] OpenAPI Initiative (2021). *OpenAPI Specification 3.1.0*. https://spec.openapis.org/oas/v3.1.0

[OpenID FAPI, 2021] OpenID Foundation (2021). *Financial-grade API Security Profile 1.0*. https://openid.net/specs/openid-financial-api-part-1-1_0.html ※金融機関向けの強化された OAuth/OIDC プロファイル。

[OpenID SSF, 2025] Tulshibagwale, A., Cappalli, T., Scurtescu, M., Backman, A., Bradley, J., Miel, S. (2025). *OpenID Shared Signals Framework Specification 1.0*. OpenID Foundation. https://openid.net/specs/openid-sharedsignals-framework-1_0.html ※2025年9月最終承認。

[OpenID CAEP, 2025] OpenID Foundation (2025). *OpenID Continuous Access Evaluation Profile (CAEP) 1.0*. https://openid.net/specs/openid-caep-1_0.html

[OpenID RISC, 2025] OpenID Foundation (2025). *OpenID RISC Profile Specification 1.0*. https://openid.github.io/sharedsignals/openid-risc-1_0.html

[OWASP, 2021] OWASP Foundation (2021). *OWASP Top 10:2021*. https://owasp.org/Top10/

[OWASP, 2025] OWASP Foundation (2025). *OWASP Top 10:2025*. https://owasp.org/Top10/2025/ ※現行版。A03 がサプライチェーンの失敗へ拡張され、A10 に例外処理の誤りが新設された。SSRF は独立カテゴリから外れ、A01 のアクセス制御へ統合された。

[OWASP ASVS] OWASP Foundation (2026年8月時点). *Application Security Verification Standard*. https://owasp.org/www-project-application-security-verification-standard/ ※検証レベル別のセキュリティ要件一覧。

[OWASP Password Storage] OWASP Foundation (2026年8月時点). *Password Storage Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html ※Argon2id / scrypt / bcrypt の推奨パラメータ。

[OWASP SSRF] OWASP Foundation (2026年8月時点). *Server Side Request Forgery Prevention Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html ※リダイレクト追従の禁止、許可リスト、ネットワーク側の分離。

[OWASP CSRF] OWASP Foundation (2026年8月時点). *Cross-Site Request Forgery Prevention Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html ※SameSite Cookie は多層防御の一部であり、トークンの代わりにはならないことを明記している。

[OWASP CSP] OWASP Foundation (2026年8月時点). *Content Security Policy Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html ※`object-src 'none'`、`base-uri 'none'`、`'strict-dynamic'` を含む推奨ポリシー。

[OWASP LLM, 2025] OWASP Foundation (2025). *OWASP Top 10 for LLM Applications 2025*. https://genai.owasp.org/llm-top-10/ ※LLM01 プロンプトインジェクションを含む、生成AI固有の脅威分類。

[PCI DSS] PCI Security Standards Council (2024). *Payment Card Industry Data Security Standard v4.0.1*. https://www.pcisecuritystandards.org/ ※カード会員データの取り扱いに関する業界標準。適用範囲と必要な対応は構成・取引量・契約によって異なるため、決済事業者および評価機関へ確認する。

[PostgreSQL Date/Time Types] PostgreSQL Global Development Group (2026年8月時点). *Date/Time Types*. https://www.postgresql.org/docs/current/datatype-datetime.html ※`timestamptz` が瞬間を保持し、タイムゾーンを保存しないことの一次資料。

[PostgreSQL Row Security Policies] PostgreSQL Global Development Group (2026年8月時点). *Row Security Policies*. https://www.postgresql.org/docs/current/ddl-rowsecurity.html ※RLS の `USING` / `WITH CHECK`、`FORCE ROW LEVEL SECURITY`、所有者バイパスの一次資料。

[Robinson, 2006] Robinson, I. (2006). "Consumer-Driven Contracts: A Service Evolution Pattern." martinfowler.com. https://martinfowler.com/articles/consumerDrivenContracts.html ※消費者駆動契約の原典。

[SLSA, 2023] OpenSSF (2023). *Supply-chain Levels for Software Artifacts (SLSA) v1.0*. https://slsa.dev/

[Spolsky, 2000] Spolsky, J. (2000). "Things You Should Never Do, Part I." *Joel on Software*. https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/

[Standard Webhooks] Standard Webhooks (2026年8月時点). *Standard Webhooks Specification*. https://www.standardwebhooks.com/ ※`webhook-id` / `webhook-timestamp` / `webhook-signature` と、複数署名の併記による鍵ローテーション。

[TC39 Temporal] TC39 (2026年8月時点). *Temporal proposal*. https://tc39.es/proposal-temporal/docs/ ※瞬間、ローカル日時、カレンダー日を別の型として扱う提案。実装状況は処理系ごとに異なる。

[Unicode CLDR] Unicode Consortium (2026年8月時点). *Common Locale Data Repository*. https://cldr.unicode.org/ ※地域ごとの日時書式データ。ICU と `Intl` の表記はここに由来する。

[tus 1.0.0] tus (2026年8月時点). *tus resumable upload protocol 1.0.0*. https://tus.io/protocols/resumable-upload ※`Upload-Offset` を条件とした `PATCH` による再開可能アップロード。

## 12-Factor App、Twelve-Factor 関連

[Wiggins, 2017] Wiggins, A. (2017). *The Twelve-Factor App*. https://12factor.net/ ※モダンWebアプリの設計原則。

## 一次資料 (Web、本文で年付きで引用したもの)

本文中で `[キー, 年]` の形で引用した、仕様・公式ドキュメントの参照先。年は本書が内容を確認した時点を示す。

[WHATWG HTML, 2026] WHATWG. *HTML Living Standard ― Event loops*. https://html.spec.whatwg.org/multipage/webappapis.html#event-loops ※タスクソース、マイクロタスク、描画機会の規定。

[WHATWG DOM, 2026] WHATWG. *DOM Living Standard*. https://dom.spec.whatwg.org/ ※ノード、イベント伝播、Shadow DOM の規定。

[WHATWG Fetch, 2026] WHATWG. *Fetch Living Standard*. https://fetch.spec.whatwg.org/ ※`redirect` の既定値が `follow` であること、および上書きできない禁止リクエストヘッダの一覧。

[W3C CSP3, 2026] W3C. *Content Security Policy Level 3*. https://www.w3.org/TR/CSP3/ ※ディレクティブの構文と、nonce・`strict-dynamic` の評価規則。

[CSS Cascade 5, 2026] W3C. *CSS Cascading and Inheritance Level 5*. https://www.w3.org/TR/css-cascade-5/ ※詳細度、カスケードレイヤ、継承の規定。

[ECMAScript, 2026] Ecma International. *ECMAScript Language Specification*. ECMA-262. https://tc39.es/ecma262/ ※値の受け渡し、等価性、実行コンテキストの規定。

[Vite 8, 2026] Vite. *Vite Documentation*. https://vite.dev/guide/ ※開発サーバと本番ビルドで使うバンドラの構成。

[WebAssembly JavaScript API, 2026] W3C. *WebAssembly JavaScript Interface*. https://webassembly.github.io/spec/js-api/ ※線形メモリと JavaScript の相互運用。

[WebAssembly Security, 2026] WebAssembly Community Group. *Security*. https://webassembly.org/docs/security/ ※サンドボックスの保証範囲と境界。

[React Server Functions, 2026] Meta. *Server Functions ― React*. https://react.dev/reference/rsc/server-functions ※サーバ側で実行される関数の境界と制約。

[React Suspense, 2026] Meta. *&lt;Suspense&gt; ― React*. https://react.dev/reference/react/Suspense ※Promise の読み取りと待機境界。

[React useTransition, 2026] Meta. *useTransition ― React*. https://react.dev/reference/react/useTransition ※更新の優先度分離。

[Storybook Test, 2026] Storybook. *Testing*. https://storybook.js.org/docs/writing-tests ※コンポーネント単位の相互作用テスト。

[SRE Workbook, 2018] Beyer, B., Murphy, N. R., Rensin, D. K., Kawahara, K., Thorne, S. (2018). *The Site Reliability Workbook*. O'Reilly Media. https://sre.google/workbook/alerting-on-slos/ ※第5章がバーンレートによる多重時間窓アラートの出典。SLO の残余予算に対する消費速度の対応表を含む。

[PostgreSQL Transaction Isolation, 2026] PostgreSQL Global Development Group. *Transaction Isolation*. https://www.postgresql.org/docs/current/transaction-iso.html ※各分離レベルで実際に防がれる現象と、PostgreSQL が標準とどう異なるかの一次資料。

[Prometheus Histograms, 2026] Prometheus Authors. *Histograms and summaries*. https://prometheus.io/docs/practices/histograms/ ※分位数がバケット境界からの補間であり、集計の順序に依存することの説明。

[OpenTelemetry, 2026] OpenTelemetry Authors. *OpenTelemetry Documentation*. https://opentelemetry.io/docs/ ※トレース・メトリクス・ログの共通データモデルと伝播仕様。

[Docker prune, 2026] Docker Inc. *docker system prune*. https://docs.docker.com/reference/cli/docker/system/prune/ ※`-a` が未使用イメージとビルドキャッシュをホスト全体で削除することの一次資料。

[Terraform Backend S3, 2026] HashiCorp. *Backend Type: s3*. https://developer.hashicorp.com/terraform/language/backend/s3 ※リモートstateとロックの構成。

[Kubernetes Probes, 2026] The Kubernetes Authors. *Configure Liveness, Readiness and Startup Probes*. https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ ※各プローブの役割と失敗時の挙動。

[cgroups(7), 2026] Linux man-pages project. *cgroups(7)*. https://man7.org/linux/man-pages/man7/cgroups.7.html ※コンテナの資源制限の基盤となる制御グループの一次資料。

[Node.js Releases, 2026] OpenJS Foundation. *Node.js Releases*. https://nodejs.org/en/about/previous-releases ※各メジャー版のサポート期限。本書が基準とする版の選定根拠。

[Stripe Idempotency, 2026] Stripe. *Idempotent requests*. https://docs.stripe.com/api/idempotent_requests ※成否によらず結果を保存すること、同じキーで異なるパラメータの要求を拒否することの一次資料。

## 公式ドキュメント (参照頻度の高いもの)

- React: https://react.dev/
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Node.js Docs: https://nodejs.org/docs/latest/api/
- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/docs/
- Kubernetes: https://kubernetes.io/docs/
- AWS: https://docs.aws.amazon.com/
- MDN Web Docs: https://developer.mozilla.org/ ※Web標準APIの最も信頼できる参考資料。

## 推薦するブログ・ニュースレター

- Martin Fowler's Blog (https://martinfowler.com/) ― アーキテクチャと設計
- High Scalability (http://highscalability.com/) ― 大規模システム設計事例
- AWS Architecture Blog (https://aws.amazon.com/blogs/architecture/) ― クラウドパターン
- Increment Magazine (https://increment.com/) ― 実務エンジニアリング深掘り
- The Pragmatic Engineer (https://www.pragmaticengineer.com/) ― 大企業の内部事情
- Hacker News (https://news.ycombinator.com/) ― 技術トレンドの定点観測


---

