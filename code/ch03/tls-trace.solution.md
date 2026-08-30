# 模範解答 — 課題3.4 TLSハンドシェイクの比較

次のコマンドで、同じ接続先・同じネットワーク条件でログを保存します。

```bash
{ time openssl s_client -tls1_2 -state -msg -connect example.com:443 -servername example.com </dev/null; } \
  > tls12.log 2>&1
{ time openssl s_client -tls1_3 -state -msg -connect example.com:443 -servername example.com </dev/null; } \
  > tls13.log 2>&1

grep -E 'ClientHello|ServerHello|Certificate|Finished|NewSessionTicket|ALPN protocol' tls12.log
grep -E 'ClientHello|ServerHello|Certificate|Finished|NewSessionTicket|ALPN protocol' tls13.log
```

## 観察記録

| 項目 | TLS 1.2 | TLS 1.3 |
|---|---|---|
| ClientHello / ServerHello | 記録する | 記録する |
| 証明書・Finishedの順序 | ログから転記 | ログから転記 |
| 選択されたCipher | `Cipher is`を転記 | `Cipher is`を転記 |
| ALPN | `ALPN protocol`を転記 | `ALPN protocol`を転記 |
| 実測時間 | `time`のreal | `time`のreal |

TLS 1.3は通常、初回ハンドシェイクの往復数を削減しますが、実測時間はDNS、TCP、ネットワーク遅延、サーバ負荷、セッション再開の有無に左右されます。単一回の速度差を一般化せず、少なくとも5回実行して中央値を比較します。
