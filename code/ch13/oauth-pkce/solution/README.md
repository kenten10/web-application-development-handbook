# 模範解答 — OAuth 2.0 Authorization Code + PKCE

`pkce.ts`は、登録済みredirect URI、state、短寿命かつ一度だけ使えるauthorization code、S256 code challengeを検証する最小IdPとクライアントを実装します。

```bash
node --test --import tsx code/ch13/solutions.test.ts
```

確認点:

- `code_verifier`自体は認可リクエストへ送らない
- token交換時に`SHA-256(verifier) = challenge`を検証する
- codeを再利用すると拒否される
- redirect URIを完全一致で検証する
- callbackのstateをクライアント側で照合する

教材実装であり、実サービスでは既存のOAuth/OIDCライブラリと認証基盤を使用してください。
