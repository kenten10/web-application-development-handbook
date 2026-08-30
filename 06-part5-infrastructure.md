# 第V部 インフラ・運用編

正しく実装したWebアプリも、OS資源が枯渇し、配置が環境ごとに異なり、変更手順が人に依存し、障害時の情報が残らなければ、利用者へ安定して価値を届けられない。第IV部で扱ったDB、検索エンジン、メッセージブローカーも、最終的にはプロセス、ファイル、ネットワークとして実行されるため、アプリケーションの論理だけでは本番の振る舞いを説明できない。

第V部では、運用責任を下から順に積み上げる。まずLinuxとネットワークで実行中の資源と通信を観測し、次にコンテナとKubernetesで配置と回復を宣言可能にする。クラウドと IaC (Infrastructure as Code) で環境全体を再現し、CI/CDで変更を安全に流し、可観測性で結果を利用者影響から追跡する。個別製品の操作ではなく、資源、配置、環境、変更、観測という五つの責任を一つの運用モデルとして理解することが、この部の目標である。

---

<a id="chapter-18"></a>
## 第18章 Linuxとネットワーク

第IV部までで、アプリケーション内部では整合性、検索、非同期処理を設計できるようになった。しかし、それらはCPU時間、メモリ、ファイルディスクリプタ、ソケットを消費するプロセスとして動く。コード上の処理が正しくても、FD枯渇、シグナル処理の欠落、TCP再送、カーネル待ちが起きれば、遅延や停止の原因はアプリケーションロジックだけからは見えない。

本章では、プロセスとスレッドを起点に、FD、シグナル、cgroupsとnamespace、ネットワークスタック、負荷分散までを一つの実行経路として追う。OSの仕組みを覚えることではなく、症状をアプリ、プロセス、カーネル、ネットワークの境界へ切り分ける力を得る。その上で第19章では、この実行環境を毎回同じ形で配布し、複数の実行単位を回復可能に管理する方法へ進む。

<!-- handbook:chapter-guide:start {"chapter":18} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 高負荷、接続枯渇、プロセス停止、ネットワーク遅延を、OSのプロセス・FD・TCP・シグナルから切り分ける。
>
> **到達目標**
> - プロセス、スレッド、FD、シグナルの関係を説明できる。
> - TCP接続とフロー/輻輳制御を運用指標へ結び付けられる。
> - L4/L7負荷分散、nginx、WebRTC/WebTransport/eBPFの位置付けを説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [3.5 ブラウザがURLを叩いてからHTMLを受け取るまで (まとめ)](02-part1-foundations.md#section-3-5) ― URLからHTMLまで
> - [10.1 並行性モデルの3パターン](04-part3-backend.md#section-10-1) ― 並行性モデル
>
> **中核概念**  
> [18.1 プロセスとスレッド](#section-18-1)、[18.2 ファイルディスクリプタ ― 全ては「ファイル」](#section-18-2)、[18.3 シグナル ― プロセス間通信の基礎](#section-18-3) (実務選択)、[18.5 ネットワークスタック](#section-18-5)、[18.6 TCP のフロー制御と輻輳制御](#section-18-6)、[18.7 ロードバランサ ― L4 vs L7](#section-18-7)、[18.9 トラブルシュート用コマンド集](#section-18-9)
>
> **最小実装**  
> [18.12 実装課題 ― Linux の仕組みを実装する](#section-18-12) (発展)
>
> **本番実装との差分**
> - 低レベル演習は隔離環境で行い、カーネル設定、raw socket、eBPF権限を本番へ無検証で適用しない。
>
> **典型的な失敗**
> - FD上限と接続数を混同する。
> - SIGTERMを処理せず停止時に処理を失う。
> - pingだけでアプリ経路を正常と判断する。
>
> **診断・デバッグ方法**
> - ss、lsof、ps、strace、tcpdumpを症状に応じて使い分ける。
> - 接続状態、再送、queue、CPU待ちを時系列で確認する。
>
> **意思決定チェックリスト**
> - 問題はアプリ、OS、ネットワーク、依存先のどの境界か。
> - L4とL7のどちらで判断が必要か。
>
> **演習と評価基準**  
> 対象: [18.12 実装課題 ― Linux の仕組みを実装する](#section-18-12) (発展)
> - FDまたはTCPの障害を再現し、コマンド出力から原因を説明できる。
>
> **一次資料・発展資料**
> - Linux man-pages
> - RFC 9293
> - nginx documentation
> - eBPF documentation
<!-- handbook:chapter-guide:end -->

<a id="section-18-1"></a>
### 18.1 プロセスとスレッド
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"プロセス"} -->

<!-- handbook:narrative-bridge {"section":"18.1"} -->
第IV部のサービスやワーカーは、最終的にはOSが管理する実行単位としてCPUとメモリを使う。まずプロセスとスレッドの境界を押さえなければ、並行処理の停止や資源競合を、アプリケーションの状態だけから説明できない。

**プロセス**: 独立したメモリ空間を持つ実行単位
**スレッド**: 同じメモリ空間を共有する軽量実行単位

Node.js は1プロセス1スレッド (主に) で動く。Go は1プロセスに多数のゴルーチンを多重化する。Pythonは GIL のため1スレッドしか同時にCPUを使えない (ただし I/O 待ち中は他スレッドが動ける)。

**fork と exec:**

Linux でプロセスを作る基本は2段階:
- `fork()`: 自分の複製を作る (親と子)
- `exec()`: 自分のメモリを別のプログラムで置き換える

シェルが `ls` を実行する流れ: `fork()` で子プロセスを作り、子の中で `exec("/bin/ls")` する。

<a id="section-18-2"></a>
### 18.2 ファイルディスクリプタ ― 全ては「ファイル」
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"は行","term":"ファイルディスクリプタ"} -->

<!-- handbook:narrative-bridge {"section":"18.2"} -->
プロセスとスレッドが実行単位を説明しても、外部との入出力をいくつ保持できるかは分からない。ソケット、ファイル、パイプを共通の番号で扱うファイルディスクリプタを理解すると、接続枯渇や閉じ忘れをOS資源の問題として追える。

Linux の「全てはファイル」哲学。プロセスが扱うリソースは**ファイルディスクリプタ (fd)** という整数で識別される。

- 標準入力 = fd 0
- 標準出力 = fd 1
- 標準エラー = fd 2
- それ以降は、open したファイル、ソケット、パイプ等

```bash
# プロセスが開いているファイルディスクリプタを見る
$ ls -l /proc/$PID/fd
0 -> /dev/pts/0
1 -> /dev/pts/0
2 -> /dev/pts/0
3 -> socket:[12345]    # TCP接続
4 -> /var/log/app.log
```

**fd上限の罠:**

OSとプロセスにはfd数の上限がある。デフォルトは1024または4096。WebサーバはTCP接続もfdを使うため、大量の同時接続を捌くにはこれを上げる必要がある。

```bash
ulimit -n           # 現在の上限
ulimit -n 65536     # セッションで増やす

# 永続的に上げる場合は /etc/security/limits.conf
```

「`EMFILE: too many open files`」エラーが出たら、まずこれを疑う。

<a id="section-18-3"></a>
### 18.3 シグナル ― プロセス間通信の基礎
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"18.3"} -->
FDを開いて通信できても、プロセスをいつ停止し、設定を再読込し、子プロセスの終了をどう伝えるかが残る。シグナルは通常のリクエスト経路とは別にライフサイクルを制御し、グレースフルシャットダウンの入口になる。

シグナルは「**プロセスへの非同期な通知**」。

| シグナル | 番号 | 意味 |
|---|---|---|
| SIGTERM | 15 | 終了要求 (graceful) |
| SIGKILL | 9 | 強制終了 (キャッチ不可) |
| SIGINT | 2 | 割り込み (Ctrl+C) |
| SIGHUP | 1 | 端末切断、リロードに転用されることが多い |
| SIGUSR1/2 | 10/12 | アプリケーション定義 |

**Graceful shutdown の実装:**

```typescript
const server = app.listen(3000);

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // 1. 新規リクエストを受け付けない
  server.close(() => console.log('Server closed'));

  // 2. 既存リクエストの完了を待つ (タイムアウト付き)
  const timeout = setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 30_000);

  // 3. DB接続などのクリーンアップ
  await db.disconnect();
  await redis.quit();

  clearTimeout(timeout);
  process.exit(0);
});
```

Kubernetes はPod終了時にまずSIGTERMを送り、デフォルトで30秒待っても終了しなければSIGKILLを送る。アプリがこれに対応していないと、進行中のリクエストが中断される。

<a id="section-18-4"></a>
### 18.4 cgroups と namespace ― コンテナの正体
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"C","term":"cgroups"} -->
<!-- handbook:index {"group":"な行","term":"名前空間 (namespace)"} -->

<!-- handbook:narrative-bridge {"section":"18.4"} -->
シグナルで個々のプロセスを制御できても、他プロセスから見える資源と使用上限は共有されたままである。namespaceで見える世界を分け、cgroupsで消費量を制限することで、後のコンテナが成立する隔離境界を作れる。

Docker などのコンテナ技術は、Linux の以下2機能の組み合わせだ。

**Namespace (名前空間)**: プロセスから見える資源を隔離

- **PID namespace**: プロセスIDの空間 (コンテナ内ではPID 1が自分)
- **Network namespace**: ネットワーク (独自のインタフェース、ルーティング)
- **Mount namespace**: ファイルシステム
- **UTS namespace**: ホスト名
- **User namespace**: UID/GID
- **IPC namespace**: プロセス間通信

**cgroups (Control Groups)**: 資源の使用量制限

- CPU、メモリ、I/O、ネットワーク帯域を制限・計測

```bash
# コンテナの中で見える PID
$ docker run --rm alpine ps
PID   USER     COMMAND
1     root     ps

# ホスト側では同じプロセスが別のPIDで見える
$ ps aux | grep alpine
root     12345  ...  ps
```

Docker や Kubernetes も結局はこれを操作しているだけだ。仕組みを知っていれば、`docker exec` で入って `cat /proc/cgroups` を覗いてリソース制限を確認するなどができる。

<a id="section-18-5"></a>
### 18.5 ネットワークスタック
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"T","term":"TCP"} -->
<!-- handbook:index {"group":"な行","term":"ネットワークスタック"} -->

<!-- handbook:narrative-bridge {"section":"18.5"} -->
プロセスを隔離しても、利用者からのバイト列はNICからソケットまで複数の層を通る。ネットワークスタックを追うことで、アプリが遅いという症状を、名前解決、経路、TCP、ソケット待ちへ分解できる。

WebアプリのリクエストはOSのネットワークスタックを通る。

```text
[アプリケーション]
       ↓
[ソケット API]
       ↓
[TCP / UDP]   ← L4
       ↓
[IP]          ← L3
       ↓
[Ethernet]    ← L2
       ↓
[NIC]         ← 物理層
```

層が分かれているのは、**それぞれが別の問題を解いているから**である。上から順に、何を決めて何を決めないかを押さえる。

| 層 | 決めること | 決めないこと |
|---|---|---|
| ソケットAPI | どのプロセスのどの通信路か (ファイル記述子) | 相手までの経路、届いたかどうか |
| TCP / UDP | どのアプリケーションか (ポート番号)。TCPは到達確認・順序・再送・流量調整まで担う。UDPは何も保証しない | 相手のホストまでどう行くか |
| IP | どのホストか (IPアドレス)、次にどこへ渡すか (経路表) | 届いたかどうか、順序、重複の有無 |
| Ethernet | 同じネットワーク内のどの機器か (MACアドレス) | ネットワークをまたぐ経路 |
| NIC・物理層 | 電気信号や電波としてどう送るか | 中身の意味 |

この分担から、症状の切り分け方が決まる。

- 名前が引けない → DNS の問題であって、TCP や IP ではない (3.2)
- 名前は引けるが接続できない → 経路 (IP) かフィルタ (ファイアウォール、セキュリティグループ) を疑う
- 接続はできるが遅い → TCP の再送や輻輳制御か、その上のアプリの処理時間を分けて測る (18.6)
- 特定の相手だけ遅い → 経路上のどこかで詰まっている。`traceroute` で経路を、`ss -ti` で TCP の状態を見る

「アプリが遅い」という報告は、この表のどの層で時間を使っているかへ分解して初めて調べられる。第20章でクラウドのネットワークを扱うときも、セキュリティグループが L3/L4、ロードバランサが L4/L7、というように、どの層の道具かで役割が決まる。

<a id="section-18-6"></a>
### 18.6 TCP のフロー制御と輻輳制御
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"T","term":"TCP"} -->
<!-- handbook:index {"group":"は行","term":"輻輳制御"} -->
<!-- handbook:index {"group":"は行","term":"フロー制御"} -->

<!-- handbook:narrative-bridge {"section":"18.6"} -->
TCPで信頼できるバイト列を受け取れても、送信側が受信側やネットワークの処理能力を超えれば、遅延と再送が増える。フロー制御と輻輳制御は、正しさを保ちながら送信量を調整する二つの異なるフィードバック機構である。

TCP は信頼性のあるストリーミング通信を提供する。

**フロー制御**: 受信側の処理能力を超えて送らない (ウィンドウサイズ)
**輻輳制御**: ネットワーク全体の混雑を考慮する (Slow Start、Congestion Avoidance、Fast Recovery)

これらは普段意識する必要がないが、レイテンシ問題のときに知識が役立つ:

- **TCP Slow Start**: 接続開始直後は送信量を抑え、徐々に増やす → 短いHTTP接続を多数作るとオーバーヘッドが大きい
- **TCP の3-way handshake**: 接続確立に1 RTT → Keep-Alive で再利用
- **TIME_WAIT**: 接続終了後もしばらく状態を保持 → 大量短時間接続で枯渇問題

<a id="section-18-7"></a>
### 18.7 ロードバランサ ― L4 vs L7
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CDN"} -->
<!-- handbook:index {"group":"E","term":"Envoy"} -->
<!-- handbook:index {"group":"L","term":"Load Balancer"} -->
<!-- handbook:index {"group":"ら行","term":"ロードバランサ"} -->

<!-- handbook:narrative-bridge {"section":"18.7"} -->
一つの接続を安定させても、一台のサーバにはCPU、FD、保守時間の上限がある。ロードバランサは複数の実行先へ接続を分配し、L4とL7のどの情報で判断するかを選ぶ境界になる。

ロードバランサ (LB) は複数のサーバにリクエストを振り分ける装置。動作層で分類される。

**L4 ロードバランサ (TCP/UDP レベル):**

- IPとポートだけ見て分散
- 高速、軽量
- HTTPの中身は見えない
- 例: AWS NLB、HAProxy (TCPモード)、LVS

**L7 ロードバランサ (HTTP レベル):**

- HTTPヘッダ、URL、Cookieを見て分散
- パスベースルーティング (`/api` → APIサーバ、`/` → Webサーバ)
- TLS 終端、HTTP/2、gRPC 対応
- 例: nginx、Envoy、AWS ALB、Cloudflare

**振り分けアルゴリズム:**

- **Round Robin**: 順番に
- **Least Connections**: 接続数最少
- **IP Hash**: クライアントIPでハッシュ → 同じユーザーは同じサーバ
- **Weighted**: サーバごとの重み付け

<a id="section-18-8"></a>
### 18.8 リバースプロキシとしての nginx
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"N","term":"nginx"} -->
<!-- handbook:index {"group":"は行","term":"プロキシ (リバース)"} -->

<!-- handbook:narrative-bridge {"section":"18.8"} -->
負荷分散の原理が分かっても、TLS終端、静的ファイル、圧縮、キャッシュ、上流への転送を毎回アプリへ実装するのは重複が大きい。nginxはHTTP境界の共通処理をリバースプロキシへ集約する代表例である。

nginx は採用例の多いリバースプロキシである。

```nginx
upstream app_backend {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl;
    http2 on;                    # nginx 1.25.1 以降。listen の http2 パラメータは非推奨
    server_name example.com;

    ssl_certificate     /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    # 静的ファイルは Nginx が直接返す (高速)
    location /static/ {
        root /var/www;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API はバックエンドへ
    location /api/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";   # これが無いと upstream の keepalive が使われない
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # タイムアウト
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

}

# HTTP を受けて HTTPS へ寄せる。443 の server 内では $scheme が常に https なので、
# 同じ server ブロックに if を置いても発火しない
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

**X-Forwarded-For の罠:**

アプリでクライアントIPを取得するとき、プロキシ経由なら `req.ip` ではなく `X-Forwarded-For` を見る。ただし**信頼できるプロキシからのヘッダのみ**信用する。攻撃者が偽の `X-Forwarded-For` を送ってきても、信頼境界の外なら無視すべき。

```typescript
// Express の場合
app.set('trust proxy', '127.0.0.1');  // ローカルのプロキシのみ信頼
app.get('/ip', (req, res) => res.send(req.ip));
```

<a id="section-18-9"></a>
### 18.9 トラブルシュート用コマンド集
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"18.9"} -->
プロセス、FD、TCP、プロキシの仕組みを知っても、本番障害ではどの層を疑うかを短時間で決めなければならない。診断コマンドを症状と対応づけ、観測結果から次の仮説を選ぶ手順へ落とし込む。

```bash
# 開いているポートを見る
ss -tlnp
netstat -tlnp           # 旧コマンド

# 特定ポートを使っているプロセス
lsof -i:3000

# 接続状態
ss -tn state established
ss -tn state time-wait | wc -l

# DNS確認
dig example.com
nslookup example.com

# ルーティング
traceroute example.com
mtr example.com         # 連続実行版

# パケットキャプチャ
# 注意: キャプチャした内容には Cookie、Authorization ヘッダ、個人データ、決済情報が
# 平文で含まれる。多くの法域でこれは個人データの処理にあたる (14.25)。本番で採る場合は
# 対象ホスト・ポート・件数を絞り (-c で上限、BPFフィルタで対象限定)、pcap は暗号化領域に置き、
# 調査が終わったら削除する。取得と閲覧を監査記録に残す
tcpdump -i any -c 100 -A 'port 80 and host 203.0.113.10'
tcpdump -i any -c 1000 -w capture.pcap 'host example.com'

# プロセスの状況
top
htop
ps auxf

# システムコール追跡
strace -p $PID
strace -e openat,read,write -p $PID

# I/O 統計
iostat -x 1
iotop

# メモリ
free -h
cat /proc/meminfo

# CPU
mpstat -P ALL 1
vmstat 1

# 接続性能テスト
ab -n 1000 -c 10 http://localhost:3000/    # Apache Bench
wrk -t10 -c100 -d30s http://localhost:3000/

# ファイル記述子
ls /proc/$PID/fd | wc -l
```

これらのツールは**全部覚える必要はない**。「困ったらどれを使うか分かる」程度で十分。

<a id="section-18-10"></a>
### 18.10 WebRTC と WebTransport ― ブラウザの新しい通信プロトコル
<!-- handbook:learning {"level":"outlook","minutes":15} -->
<!-- handbook:index {"group":"W","term":"WebRTC"} -->
<!-- handbook:index {"group":"W","term":"WebTransport"} -->

<!-- handbook:narrative-bridge {"section":"18.10"} -->
HTTPの要求応答や通常のWebSocketだけでは、リアルタイム音声映像や低遅延の双方向データに必要な経路選択と輻輳制御を十分に表せない。WebRTCとWebTransportは、ブラウザ通信を別の遅延・信頼性要件へ拡張する。

HTTP/WebSocket 以外にも、ブラウザは複数の通信プロトコルをサポートする。それぞれに適した用途がある。

#### WebRTC ― ブラウザ間の P2P 通信

**WebRTC (Web Real-Time Communication)** は2011年に Google が発表、現在は W3C 標準。本来は「**ブラウザ同士で直接ビデオ通話・音声通話**」を実現するための技術。

```text
[ブラウザA] ⇄ STUN/TURN サーバ (NAT 越え)
     ↕
[ブラウザB]
```

ブラウザ A と B が**直接通信**(中継サーバなし、または最小限)。レイテンシが極めて低い。

主要 API:

- **MediaStream**: カメラ・マイク・スクリーン共有
- **RTCPeerConnection**: ピア間通信
- **RTCDataChannel**: 任意データの送受信 (TCP/UDP 風)

```typescript
// 最小例: 2つのブラウザ間でデータ送受信
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

const dataChannel = pc.createDataChannel('chat');
dataChannel.onmessage = (e) => console.log('Received:', e.data);

// オファー生成・送信(シグナリングサーバ経由)
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
signaling.send({ type: 'offer', offer });

// 相手側で answer 生成
signaling.on('offer', async (offer) => {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  signaling.send({ type: 'answer', answer });
});

dataChannel.send('Hello from peer A');
```

**シグナリングサーバ**(WebSocket 等で実装、最初の接続確立だけに使う) が必要だが、確立後は P2P で通信する。

**用途:**

- ビデオ通話 (Google Meet、Zoom Web 版、Discord)
- 画面共有
- 低レイテンシゲーム
- ファイル共有 (WebTorrent)
- リアルタイムコラボ

**課題:**

- NAT 越えが必要 (TURN サーバ運用が必要なケースも多い)
- ブラウザ実装の差異
- 設定の複雑さ
- 自前運用は難易度高い → **Daily.co**、**LiveKit**、**Twilio Video** などの SaaS が便利

#### WebTransport ― HTTP/3 ベースの新世代通信

**WebTransport** は HTTP/3 (QUIC) 上で動く、WebSocket の後継候補。2024年頃から主要ブラウザで利用可能に。

**WebSocket との比較:**

| | WebSocket | WebTransport |
|---|---|---|
| 基盤 | TCP/HTTP/1.1 アップグレード | HTTP/3 (QUIC over UDP) |
| メッセージング | 1本の順序付きストリーム | 複数の独立ストリーム + データグラム |
| 順序保証 | 必ず順序通り | ストリームごとに順序、データグラムは順不同 |
| ヘッドオブラインブロッキング | あり | なし |
| 信頼性 | 必ず到達 | ストリームは到達保証、データグラムは到達非保証 |
| ブラウザ対応 | 全主要ブラウザ | Chrome、Firefox、Safari(2024〜) |

#### WebTransport の実装

```typescript
// クライアント側
const transport = new WebTransport('https://example.com:4433/path');
await transport.ready;

// 双方向ストリーム
const stream = await transport.createBidirectionalStream();
const writer = stream.writable.getWriter();
await writer.write(new TextEncoder().encode('Hello'));

const reader = stream.readable.getReader();
const { value, done } = await reader.read();
console.log(new TextDecoder().decode(value));

// データグラム(低レイテンシ、到達非保証)
const datagramWriter = transport.datagrams.writable.getWriter();
await datagramWriter.write(new Uint8Array([1, 2, 3]));
```

**用途とメリット:**

- リアルタイムゲーム (FPS、レーシング ― データグラムが向く)
- 動画配信 (Twitch などが採用検討)
- IoT センサーデータの集約
- WebSocket の置き換え (ヘッドオブラインブロッキングを避けたい場合)

**現状:**

WebSocket はまだ広く使われ続けるが、要件次第で WebTransport を選ぶ価値が出てきた。「**速度命のゲーム/動画は WebTransport、それ以外は WebSocket**」が現在の判断軸。

<a id="section-18-11"></a>
### 18.11 eBPF ― Linux カーネルを動的に拡張する革命
<!-- handbook:learning {"level":"advanced","minutes":10} -->
<!-- handbook:index {"group":"C","term":"Cilium (eBPF)"} -->
<!-- handbook:index {"group":"E","term":"eBPF"} -->

<!-- handbook:narrative-bridge {"section":"18.11"} -->
既存コマンドで観測できる範囲を超え、カーネル内部の特定イベントを本番中に追いたい場合がある。eBPFはカーネルを再ビルドせず安全制約付きプログラムを差し込み、ネットワークとOSの観測点を動的に増やす。

**eBPF (extended Berkeley Packet Filter)** は2014年頃から発展した Linux カーネル機能。「**カーネル内で安全にプログラムを実行する**」仕組みで、ネットワーク・観測性・セキュリティの基盤として急速に普及している。

#### 従来の手段と何が違うか

従来、カーネルの挙動を変えるには:

- カーネルモジュール (C で書く、バグるとシステム停止)
- カーネル本体のパッチ (配布が困難)

eBPF はこれを根本から変えた:

- **ユーザー空間からプログラムを投入**
- **カーネル内のVerifier が安全性を検証**(無限ループ、メモリ不正アクセス等を拒否)
- **JIT コンパイル**で高速実行
- **再起動なしで動的にロード**

#### 主な用途

**1. ネットワーク**

- **Cilium**: Kubernetes CNI、iptables を完全置換、L3-L7 ロードバランシング、ネットワークポリシー
- **Katran**: Facebook の L4 LB
- **XDP (eXpress Data Path)**: NIC レベルで超高速パケット処理

**2. 観測性**

- **Pixie**: Kubernetes アプリの自動計装 (コード変更なしでトレース取得)
- **Falco**: ランタイムセキュリティ監視
- **bpftrace**: シェル感覚で カーネルトレース

**3. プロファイリング**

- **Parca**: 継続的プロファイリング
- **Pyroscope**: マルチ言語プロファイリング

#### bpftrace の例

```bash
# プロセスの open() システムコールをトレース
bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s: %s\n", comm, str(args->filename)); }'

# TCP 接続の遅延を測る
bpftrace -e 'kprobe:tcp_connect { @start[tid] = nsecs; }
            kretprobe:tcp_connect /@start[tid]/ {
              @latency = hist((nsecs - @start[tid]) / 1000);
              delete(@start[tid]);
            }'
```

`bcc`、`bpftrace`、`Cilium`、`Tetragon` などのツール経由で使うことが多く、生の eBPF プログラムを書く機会はあまりない。

#### Cilium で見る eBPF の威力

Kubernetes の CNI として Cilium を使うと:

- **iptables 不要**: Pod 数が増えても性能劣化しない
- **L7 (HTTP) ポリシー**: 「特定の URL パスだけアクセス可」のような細かい制御
- **可観測性内蔵**: Hubble UI でフローを可視化
- **Service Mesh as a Sidecar-less**: Envoy sidecar なしで Service Mesh 相当を実現

GKE の Dataplane V2 は Cilium を採用しており、EKS と AKS でも選択肢として提供されている (デフォルトはそれぞれ Amazon VPC CNI と Azure CNI)。

#### 学ぶ価値

実装は深いが、**「eBPF とは何か、何ができるか」を知っているだけでも価値がある**。問題に直面したとき「これは eBPF で解けるかも」と引き出しが増える。

Brendan Gregg(Netflix のパフォーマンスエンジニア) の著作 [Gregg, 2019] は eBPF の決定版だ。

<a id="section-18-12"></a>
### 18.12 実装課題 ― Linux の仕組みを実装する
<!-- handbook:learning {"level":"advanced","minutes":270} -->

<!-- handbook:narrative-bridge {"section":"18.12"} -->
ここまでの概念を用語として知るだけでは、FD枯渇や停止処理、負荷分散の挙動を診断できない。実装課題では小さな再現系を作り、症状、OS状態、修正の因果関係を自分で確かめる。

第18章ではプロセス、FD、シグナル、cgroups、ネットワークスタックを見た。本節では Linux の挙動を観察・実装するツールを書く。所要時間: 演習カードの推定時間の合計で8時間45分。

**注**: 一部のコードは Linux 環境 (macOS では一部機能制限あり) を想定。

#### 課題18.1: 高並行 TCP サーバ (epoll 風) を自作 (★★★)

**目的**: Node.js のイベントループの裏側 ― epoll/kqueue による非同期 I/O を体感。

<!-- handbook:exercise:start {"id":"18.1"} -->
> **演習カード 課題18.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 18.5 ネットワークスタック を読み、TCP接続の確立とソケットバッファの役割を把握する
> - 18.1 プロセスとスレッド を読み、1スレッドのイベントループが複数接続を多重化する意味を押さえる
> - Node.js の net モジュールで createServer と createConnection を書ける
> - `ulimit -n` で自環境の同時オープン上限を確認し、必要なら一時的に引き上げられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] createMultiplexedEchoServer が socket の data イベントごとに transform を適用し、metrics の connections と messages と bytes を加算する
> - [ ] echoRoundTrip(port, 'a') が 'A' を返し、3クライアント同時実行で3件とも正しい応答が返る
> - [ ] await でブロックする素朴版と data イベント版の2実装を用意し、同じ負荷で総所要時間とRSSを表として記録する
> - [ ] 接続クローズ時に内部の Set からソケットが削除され、server.close() 後に残存ソケットが destroy される
> - [ ] 同時1000接続以上でも接続確立エラー (EMFILE や ECONNREFUSED) を出さずに完走する
>
> **期待出力**
>
> - 計測スクリプトが 接続数 / 総メッセージ数 / 総バイト数 / 経過ms / RSSバイト を出力し、ブロック版と多重化版で経過msが数倍違う
> - echo サーバ起動時に echo server on 127.0.0.1:3001 の1行が出る
> - metrics オブジェクトは connections、messages、bytes の3キーを持つ数値レコードになる
>
> **観察項目**
>
> - ブロック版では1接続の処理中に他接続の応答が止まるため、クライアント側の往復時間の分布が階段状になることを確認する
> - `ss -tan state established` の行数を数え、サーバ側の同時接続数と一致するか確認する
> - process.memoryUsage().rss を接続数100/1000/10000で記録し、1接続あたりのメモリ増分を算出する
> - 接続数を増やしていくと EMFILE が出る境界と `ulimit -n` の値の関係を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch18 run test` を実行し、multiplexed echo server handles concurrent clients が通ることを確認する
> 2. code/ch18 で `tsx --test solutions.test.ts` を実行し、3並列の応答が A、B、C になり metrics.messages が 3 になることを確認する
> 3. `PORT=3001 tsx epoll-style-server.solution.ts` を起動し、別端末の `nc 127.0.0.1 3001` から hi を送って HI が返れば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず「1接続を await で占有する版」と「data イベントで即応答する版」を別関数に分け、同じベンチマーク関数から呼べる形にする。計測対象は経過時間とRSSの2つに絞る
> 2. **構造**: net.createServer のコールバックで socket.on('data') を登録し、Set<Socket> へ登録して close と error で削除する。メトリクスは connections/messages/bytes の3カウンタを持つオブジェクトを共有参照で返す
> 3. **実装の要点**: data イベントの chunk は型上 string になり得るので Buffer.isBuffer で正規化してから length を加算する。クライアント側は socket.once('data') で受けたあと end() しないと接続が残りFDを食う
>
> **本番利用時の警告**
>
> - 10,000接続のベンチは自分のマシンの localhost に対してのみ行う。第三者のホストや共有の検証環境へ同じ負荷をかけると帯域とFDを奪うDoSになり、不正アクセスとして扱われる
> - この echo サーバは受信バイト長の上限も接続数上限もタイムアウトも持たないため、公開すると1接続の巨大送信でメモリを食い尽くされ、接続を握ったまま放置する Slowloris 型の攻撃で停止する。本番では maxConnections、requestTimeout、backpressure 処理を持つ実装を使う
>
> **導線**
>
> - 開始地点: `code/ch18/epoll-style-server.ts`
> - 模範解答: `code/ch18/epoll-style-server.solution.ts`
>
> **推定時間の内訳**: 多重化版とブロック版の2実装に60分、10,000接続のベンチスクリプトと ulimit 調整に50分、メモリとスループットの記録と考察に40分
<!-- handbook:exercise:end -->

**要件**: Node.js の標準 `net` モジュールを使うが、**1接続=1関数呼び出し** の素朴な実装と、**ストリーミング処理** の効率比較を行う。

```typescript
// Bad: 各接続を await でブロック
server.on('connection', async (socket) => {
  for await (const chunk of socket) {
    socket.write(processSync(chunk)); // 処理中、このソケットは止まる
  }
});

// Good: 全接続を 1 イベントループで多重化
server.on('connection', (socket) => {
  socket.on('data', (chunk) => {
    socket.write(processFast(chunk));
  });
});
```

ベンチマーク:
- 10,000 接続を同時にオープン
- 各接続で 100 バイトの echo を 100 回往復
- メモリ消費とスループットを記録

模範解答: `code/ch18/epoll-style-server.solution.ts`

#### 課題18.2: ファイルディスクリプタとリーク検出 (★★)

**目的**: 「FD を閉じ忘れる」とどうなるか、`ulimit -n` まで使い切る実演。

<!-- handbook:exercise:start {"id":"18.2"} -->
> **演習カード 課題18.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 18.2 ファイルディスクリプタ ― 全ては「ファイル」 を読み、プロセスごとのFDテーブルと ulimit の関係を把握する
> - node:fs/promises の open が返す FileHandle と close の対応を書ける
> - Linux 環境 (またはLinuxコンテナ) で /proc/self/fd を読める。macOS では `lsof -p $$` の行数で代替する
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] openMany(1000) が1000個の FileHandle を返し、その間 countOpenFileDescriptors() の値が開く前より約1000増える
> - [ ] closeAll(handles) 後に countOpenFileDescriptors() が開く前の水準へ戻る
> - [ ] openMany(count, true) の close 込み版と close しない版でFD数の推移を数値として比較・記録する
> - [ ] `ulimit -n` を 64 などへ下げた状態で openMany を回し、EMFILE が発生する件数を記録する
> - [ ] countOpenFileDescriptors() が /proc の無い環境で undefined を返し、テストが失敗せずスキップ相当になる
>
> **期待出力**
>
> - `tsx fd-leak.solution.ts 100` が count / before / during / after の4キーを持つJSONを1行出力し、during が before より約100大きく after が before と同程度に戻る
> - Linux 以外では before/during/after が undefined となり、その値がJSONに現れない
> - 上限を超えた場合は EMFILE: too many open files のエラーで停止する
>
> **観察項目**
>
> - `ls /proc/self/fd` の件数を open 前・open 中・close 後の3回数え、増減を確認する
> - `lsof -p <pid>` の出力を handbook-fd-demo.txt で絞り、同じファイルに対して独立したFDが count 個できていることを確認する
> - `ulimit -n` の soft limit と、実際に EMFILE が出た件数の差 (標準入出力など既存FD分) を確認する
> - close 忘れ版を放置し、GC が走ってもFD数が減らない (FileHandle への参照が生きている限り解放されない) ことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch18 run test` を実行し、file handles can be observed and closed が通ることを確認する
> 2. `bash -c 'ulimit -n 64; tsx fd-leak.solution.ts 200'` を実行し、EMFILE で落ちれば上限到達の再現に成功
> 3. `tsx fd-leak.solution.ts 500` の出力で during から before を引いた値が500前後、after が before と一致すれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: まず「FD数を数える関数」を先に作る。数えられないと増減が観測できない。/proc/self/fd の readdir を try/catch で包み、無い環境では undefined を返す方針にする
> 2. **構造**: open(path, 'a+') を count 回ループして FileHandle の配列へ貯める関数と、全件 close する関数の2つに分ける。close の途中失敗で残りを閉じ損ねないよう Promise.all ではなく allSettled を使う
> 3. **実装の要点**: 同じパスを何度 open してもFDは毎回新規に割り当てられる点が肝。tmpdir() 配下の1ファイルで十分で、before/during/after は必ず await を挟んだ後に取得しないと close が反映されない
>
> **本番利用時の警告**
>
> - FDを意図的に枯渇させる実験は使い捨てのコンテナかVMで行う。共有サーバで ulimit 近くまで開くと、同じユーザーで動く他プロセスが accept や open に失敗して巻き添えで停止する
> - 実サービスで FileHandle を close せず貯めると、数時間後に EMFILE で新規接続を一切受けられなくなり再起動以外に復旧手段がなくなる。本番では try/finally か using 宣言で必ず解放する
>
> **導線**
>
> - 開始地点: `code/ch18/fd-leak.ts`
> - 模範解答: `code/ch18/fd-leak.solution.ts`
>
> **推定時間の内訳**: 計測関数と open/close 版の実装に30分、ulimit を下げた枯渇再現と EMFILE 観察に35分、/proc と lsof の突き合わせ記録に25分
<!-- handbook:exercise:end -->

**要件**:
- 1000ファイルを意図的に開きっぱなしにする
- `/proc/self/fd/` で実際の FD 数を確認 (Linux)
- 適切な close 処理を入れた版と比較

```bash
# 開く前と後で FD 数を確認
ls /proc/self/fd | wc -l
```

模範解答: `code/ch18/fd-leak.solution.ts`

#### 課題18.3: シグナルハンドリングとグレースフルシャットダウン (★★)

**目的**: SIGTERM を受けたときに「進行中のリクエストを完了 → 新規拒否 → 終了」する実装。

<!-- handbook:exercise:start {"id":"18.3"} -->
> **演習カード 課題18.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: localhost
>
> **前提**
>
> - 18.3 シグナル ― プロセス間通信の基礎 を読み、SIGTERM と SIGKILL の違いを押さえる
> - 18.1 プロセスとスレッド を読み、プロセス終了時に何が破棄されるかを把握する
> - node:http の createServer と server.close() の挙動 (既存接続は残る) を知っている
> - `kill -TERM <pid>` で任意のプロセスへシグナルを送れる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] GracefulHttpServer が shutdown 開始後の新規リクエストへ 503 と connection: close を返す
> - [ ] shutdown(timeoutMs) が処理中リクエストの完了を待って drained を返し、待ち切れない場合に timeout を返す
> - [ ] activeRequests が処理中は1以上、完了後は0になる
> - [ ] timeout 到達時に server.closeAllConnections() が呼ばれ、プロセスが確実に終了する
> - [ ] SIGTERM ハンドラから shutdown() を呼び、進行中の1件が 200 で完了してからプロセスが終了コード0で終わる
>
> **期待出力**
>
> - shutdown 中に投げたリクエストは 503 と本文 shutting down を返す
> - shutdown 前に開始したリクエストは 200 と本文 ok を返し、shutdown() の戻り値が drained になる
> - SIGTERM を送ると標準出力に drained または timeout の1語が出てから終了する
>
> **観察項目**
>
> - `curl -sv http://127.0.0.1:3002/` の直後に `kill -TERM <pid>` を送り、進行中の1件が完走してから終了することを確認する
> - SIGTERM 直後に `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/` を実行し 503 が返ることを確認する
> - handler の待ち時間をタイムアウトより長くして timeout 側の経路に入れ、closeAllConnections により curl が接続断エラーになることを確認する
> - SIGTERM ハンドラを外した版と比較し、処理中レスポンスが途中で切れて curl が Empty reply from server になることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch18 run test` を実行し、graceful shutdown drains active requests が通ることを確認する
> 2. `PORT=3002 tsx graceful-shutdown.solution.ts` を起動し、`kill -TERM $(pgrep -f graceful-shutdown)` の後に終了コードが 0 なら合格
> 3. shutdown 中の新規が 503、既存が 200 の2点が揃えばグレースフル成立と判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「新規を止める」「進行中を数える」「待つ」の3つに分けて考える。まず処理中リクエスト数のカウンタを増減させるところから作る
> 2. **構造**: http.createServer のハンドラを try/finally で包み finally でカウンタを減らす。shutdown() では shuttingDown フラグを立てて server.close() を呼び、カウンタが0になるまで短い間隔でポーリングする
> 3. **実装の要点**: Node.js 19 以降の server.close() は、listener を止めると同時にアイドルな keep-alive 接続も切る。停止処理の冒頭で呼ぶと、停止中に届いた要求は 503 ではなく接続拒否になり、完成条件1を満たせない。順序は「停止フラグを立てる → 処理中の要求が終わるまで待つ → close() と closeAllConnections()」にすること
>
> **本番利用時の警告**
>
> - このサーバは待機中の新規接続へ 503 を返すだけで、ロードバランサからの切り離しは行わない。本番では readiness を先に落とし、LBが対象から外すまでの数秒を待ってから close しないと、切替の隙間でエラーを利用者に返す
> - Kubernetes の terminationGracePeriodSeconds より長い待ち時間を設定すると SIGKILL で強制終了され、進行中の処理が中断されて書きかけのデータが残る。タイムアウトは必ず猶予期間より短くする
>
> **導線**
>
> - 開始地点: `code/ch18/graceful-shutdown.ts`
> - 模範解答: `code/ch18/graceful-shutdown.solution.ts`
>
> **推定時間の内訳**: サーバとカウンタの実装に30分、SIGTERM を送ってのドレイン確認と503確認に30分、タイムアウト経路と未対応版の比較に30分
<!-- handbook:exercise:end -->

**要件**:
- HTTP サーバ
- SIGTERM で:
  1. health check を unhealthy に
  2. 新規接続を拒否
  3. 進行中のリクエストの完了を待つ (タイムアウト 30秒)
  4. それでも残れば強制終了

```typescript
process.on('SIGTERM', async () => {
  console.log('Graceful shutdown initiated');
  server.close(); // 新規接続停止
  await Promise.race([
    waitForActiveConnections(),
    sleep(30000),
  ]);
  process.exit(0);
});
```

Kubernetes の preStop hook と組み合わせる場面で必須。

模範解答: `code/ch18/graceful-shutdown.solution.ts`

#### 課題18.4: 自作 L7 ロードバランサ (★★★)

**目的**: nginx のような L7 ロードバランサを Node.js で実装し、ロードバランシング戦略を試す。

<!-- handbook:exercise:start {"id":"18.4"} -->
> **演習カード 課題18.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 18.7 ロードバランサ ― L4 vs L7 を読み、L7が中身を見て振り分ける意味を押さえる
> - 18.8 リバースプロキシとしての nginx を読み、X-Forwarded-For などの転送ヘッダの役割を把握する
> - node:http の http.request でリクエストを転送し、pipe でストリームをつなげる
> - バックエンド用の簡易HTTPサーバを2つ以上、別ポートで起動できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] LoadBalancer が round-robin と least-conn と random の3戦略を options.strategy で切り替えられる
> - [ ] round-robin で2バックエンドへ交互に振り分けられ、連続2リクエストの応答が a、b の順になる
> - [ ] markHealthy(index,false) で除外したバックエンドへ振り分けられず、全滅時は 503 と本文 no healthy backends を返す
> - [ ] 転送先へ host ヘッダをバックエンドのホストへ書き換え、x-forwarded-for に元クライアントIPを載せる
> - [ ] バックエンドが落ちている場合に upstream の error で 502 bad gateway を返し、そのバックエンドの healthy が false になる
>
> **期待出力**
>
> - round-robin で2回 GET すると本文が a、b の順で返る
> - least-conn では active 数が最小のバックエンドが選ばれ、同数なら先頭が選ばれる
> - 全バックエンドを unhealthy にすると HTTP 503 と本文 no healthy backends が返る
> - バックエンド側に届くヘッダの x-forwarded-for が 127.0.0.1 になる
>
> **観察項目**
>
> - 各バックエンドが受けた件数を数え、3戦略それぞれの分布 (交互、偏り、ランダム) を比較する
> - 1つのバックエンドを長時間レスポンスにして least-conn を回し、active が増えた側が選ばれなくなることを確認する
> - `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/` をバックエンド停止の前後で実行し、200 から 502 へ変わる瞬間を確認する
> - バックエンド側で受信ヘッダをダンプし、host が書き換わり x-forwarded-for が付与されていることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch18 run test` を実行し、round robin load balancer distributes requests が通ることを確認する
> 2. code/ch18 で `tsx --test solutions.test.ts` を実行し、2回のGET結果が a と b の順になることを確認する
> 3. strategy を least-conn と random に変えて同じ2回GETを行い、round-robin と分布が変わることを目視で確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「バックエンド選択」と「プロキシ転送」を別メソッドに分ける。選択側を healthy なものだけを対象にした関数として書くと、3戦略の差が1行ずつで表現できる
> 2. **構造**: バックエンドは url と active と healthy の3フィールドを持つ配列で持つ。round-robin は cursor を件数で剰余、least-conn は reduce で active 最小、random は乱数関数を注入可能にするとテストできる
> 3. **実装の要点**: 転送では headers の host を必ずバックエンドの host へ書き換える (元のままだと仮想ホストが誤動作する)。active カウンタは upstream の close イベントで減らさないと、error 時に減らし忘れて偏る
>
> **本番利用時の警告**
>
> - この LB は x-forwarded-for を上書きするだけで既存値を検証しないため、公開するとクライアントが偽のIPを送ってIP制限やレート制限を回避できる。本番では信頼できるプロキシからの値だけを採用する
> - ヘルスチェックは upstream エラー時に healthy を false にするだけで復帰処理が無い。一度落ちたバックエンドは永久に外れ、全滅すると全リクエストが 503 になる。本番では定期的な能動ヘルスチェックと復帰判定が必須
> - リクエストサイズ上限もタイムアウトも無いため、そのまま公開すると巨大ボディや遅延接続でLBプロセス自体が枯渇する
>
> **導線**
>
> - 開始地点: `code/ch18/load-balancer.ts`
> - 模範解答: `code/ch18/load-balancer.solution.ts`
>
> **推定時間の内訳**: 選択ロジックと転送処理の実装に55分、3戦略の切替と分布計測に40分、ヘルスチェック除外と502経路の確認に35分、ヘッダ転送の確認に20分
<!-- handbook:exercise:end -->

**要件**:
- 複数バックエンドへの振り分け
- 3つの戦略: Round-Robin、Least Connections、Random
- ヘルスチェック (失敗したバックエンドを除外)
- リクエストヘッダ転送 (X-Forwarded-For 等)

```typescript
const lb = new LoadBalancer({
  strategy: 'least-conn',
  backends: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  healthCheck: { interval: 5000, path: '/health' },
});
lb.listen(8080);
```

模範解答: `code/ch18/load-balancer.solution.ts`

#### 課題18.5: ネットワークデバッグツール (mini-tcpdump) (★)

**目的**: 生のソケットでパケットの内容を覗く (教育用、Linux で実行)。

<!-- handbook:exercise:start {"id":"18.5"} -->
> **演習カード 課題18.5** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 18.5 ネットワークスタック を読み、TCPペイロードとアプリケーションデータの関係を押さえる
> - 18.9 トラブルシュート用コマンド集 を読み、tcpdump が何を表示しているかを把握する
> - Buffer から16進文字列とASCII表現を作れる (toString(16) と padStart)
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] hexDump(buffer) が 1行16バイト、4桁16進のオフセット + 16進列 + ASCII列 の形式で出力する
> - [ ] 非印字バイト (32未満と127以上) がASCII列でドットに置換される
> - [ ] httpPreview(buffer) が GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS で始まる場合だけ先頭4行を返し、それ以外は undefined を返す
> - [ ] createCapturingProxy が listenPort で待ち受け、targetPort へ中継しつつ onCapture へダンプを渡す
> - [ ] プロキシ経由の `curl http://127.0.0.1:<listenPort>/` が本来のレスポンスを取得できる (中継が壊れていない)
>
> **期待出力**
>
> - GET リクエストのダンプ1行目が 0000 で始まり 47 45 54 20 2f の並びを含み、右端のASCII列に GET / HTTP/1.1 が読める
> - httpPreview がリクエストラインと Host ヘッダを含む数行の文字列を返す
> - HTTPでないバイナリデータでは httpPreview が undefined になり、16進ダンプだけが出る
>
> **観察項目**
>
> - 同じリクエストを `tcpdump -i lo0 -A port 3001` や Wireshark と並べ、自作ダンプと同じバイト列が見えることを確認する
> - curl に -H でヘッダを追加し、増えたバイト数がダンプの行数増加と一致することを確認する
> - keep-alive で2回リクエストすると、1本の接続に対して onCapture が2回呼ばれることを確認する
> - HTTPS の通信を同じプロキシに通し、TLSレコードのため中身が読めず先頭が 16 03 になることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch18 run test` を実行し、hex dump and HTTP preview expose packet contents が通ることを確認する
> 2. code/ch18 で `tsx --test solutions.test.ts` を実行し、hexDump の出力が 47 45 54 を含み httpPreview が Host を含むことを確認する
> 3. createCapturingProxy を起動して `curl -s http://127.0.0.1:9999/` を叩き、標準出力にダンプが出つつレスポンスも返れば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 16進ダンプは「16バイトずつ切って3列 (オフセット、16進、ASCII) に整形する」だけの文字列処理。ネットワークと切り離し Buffer.from('GET / HTTP/1.1') で先に完成させる
> 2. **構造**: subarray で width バイト取り出し、padStart(2,'0') で16進化、padEnd で桁揃え、32以上127未満だけを文字にする。傍受は net.createServer と net.createConnection の双方向 write で作る
> 3. **実装の要点**: 最終行は16バイト未満になるため padEnd を忘れるとASCII列がずれる。HTTP判定はメソッド名と空白の先頭一致にし、本文中に現れる同じ文字列に反応しないようにする
>
> **本番利用時の警告**
>
> - この傍受プロキシは自分で立てた localhost のサーバ宛の通信にだけ使う。第三者や社内の他人のトラフィックを同じ手法で覗くと、通信の秘密の侵害および不正アクセスにあたる
> - 傍受したダンプにはリクエストの Cookie や Authorization ヘッダが平文で含まれる。ログとして保存したりチケットへ貼ると認証情報の漏洩になるため、実験後は必ず破棄する
>
> **導線**
>
> - 開始地点: `code/ch18/mini-tcpdump.ts`
> - 模範解答: `code/ch18/mini-tcpdump.solution.ts`
>
> **推定時間の内訳**: hexDump と httpPreview の実装に20分、中継プロキシの配線に15分、curl での確認と非HTTPデータの比較に10分
<!-- handbook:exercise:end -->

**要件**:
- 指定ポートへのトラフィックを傍受 (Node.js の `net` ベース)
- 受信したバイトを 16進ダンプ
- HTTP リクエストなら最初の数行を表示

模範解答: `code/ch18/mini-tcpdump.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":18} -->
### 第18章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第18章の模範解答をまとめて検証する
pnpm --filter @handbook/ch18 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch18 exec tsx epoll-style-server.solution.ts  # 課題18.1
pnpm --filter @handbook/ch18 exec tsx fd-leak.solution.ts             # 課題18.2
pnpm --filter @handbook/ch18 exec tsx graceful-shutdown.solution.ts   # 課題18.3
pnpm --filter @handbook/ch18 exec tsx load-balancer.solution.ts       # 課題18.4
pnpm --filter @handbook/ch18 exec tsx mini-tcpdump.solution.ts        # 課題18.5
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch18/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

ここまでで、OS上の資源と通信を症状から診断できるようになった。しかし、同じ実行条件を別の開発者やホストで再現し、障害時に自動で置き換える仕組みはまだない。第19章では、namespaceとcgroupsを配布可能なコンテナへまとめ、Kubernetesの制御ループで配置と回復を管理する。

<a id="chapter-19"></a>
## 第19章 コンテナとオーケストレーション

第18章で、アプリケーションがLinuxのプロセス、namespace、cgroups、ネットワーク上で動くことを確認した。だが、必要なライブラリ、設定、ユーザー、起動方法を人手でそろえる限り、同じコードでも環境ごとに振る舞いが変わる。また、一つのプロセスを隔離できても、障害時の再起動、複製、配置、段階更新を多数のホストで続ける責任は残る。

本章では、実行に必要なファイルと設定をコンテナイメージへ固定し、Composeで複数サービスのローカル構成を再現する。さらにKubernetesへ進み、望ましい配置、ヘルス状態、設定、入口を宣言し、制御ループに現実との差を埋めさせる。第20章では、このクラスタを含むネットワーク、ストレージ、権限、マネージドサービス全体を、クラウド上でどう選び再現するかを扱う。

<!-- handbook:chapter-guide:start {"chapter":19} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 「自分の環境では動く」を減らし、イメージ供給、設定、ヘルスチェック、ロールアウトを再現可能にする。
>
> **到達目標**
> - namespace/cgroupsとコンテナイメージの役割を説明できる。
> - 安全で小さいDockerfileとローカルCompose環境を作れる。
> - KubernetesのDeployment、Service、Probe、Config/Secret、Ingress/Gatewayを説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [18.4 cgroups と namespace ― コンテナの正体](#section-18-4) (実務選択) ― cgroupsとnamespace
> - [18.7 ロードバランサ ― L4 vs L7](#section-18-7) ― ロードバランサ
>
> **中核概念**  
> [19.1 コンテナの仕組み](#section-19-1)、[19.2 Dockerfile のベストプラクティス](#section-19-2)、[19.4 docker-compose ― ローカル開発](#section-19-4)、[19.5 Kubernetes ― 大規模なオーケストレーション](#section-19-5) (実務選択)、[19.6 Kubernetes の YAML](#section-19-6) (実務選択)、[19.7 Probes ― Liveness と Readiness](#section-19-7) (実務選択)、[19.8 ConfigMap と Secret](#section-19-8) (実務選択)
>
> **最小実装**  
> [19.12 実装課題 ― コンテナとオーケストレーションの内側](#section-19-12) (発展)
>
> **本番実装との差分**
> - 教材マニフェストはRBAC、NetworkPolicy、Pod Security、バックアップ、容量計画、マルチAZを省略する。
>
> **典型的な失敗**
> - latestタグで再現性を失う。
> - livenessを依存先チェックにして再起動ループを起こす。
> - Secretを暗号化済みと誤解する。
>
> **診断・デバッグ方法**
> - image digest、イベント、Probe結果、Podログ、resource usageを確認する。
> - ローカルとクラスタの環境変数・volume差を比較する。
>
> **意思決定チェックリスト**
> - 本当にKubernetesが必要な規模か。
> - イメージ、設定、秘密、永続データの責務を分けたか。
>
> **演習と評価基準**  
> 対象: [19.12 実装課題 ― コンテナとオーケストレーションの内側](#section-19-12) (発展)
> - 同じイメージをローカルとクラスタで起動し、失敗したProbeを診断できる。
>
> **一次資料・発展資料**
> - OCI Image Specification
> - Docker documentation
> - Kubernetes documentation
> - Gateway API specification
<!-- handbook:chapter-guide:end -->

<a id="section-19-1"></a>
### 19.1 コンテナの仕組み
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"D","term":"Docker"} -->
<!-- handbook:index {"group":"か行","term":"コンテナ"} -->

<!-- handbook:narrative-bridge {"section":"19.1"} -->
第18章でnamespaceとcgroupsがプロセスの見える範囲と資源量を分けることを確認した。コンテナはその隔離に、実行ファイルと依存物を固定したイメージを組み合わせ、同じ実行単位を配布可能にする。

コンテナは、Linuxカーネルの2つの機能の組み合わせでできている。**namespace** はプロセスから見える範囲 (プロセス一覧、ファイルシステム、ネットワーク、ホスト名) を分け、他のコンテナが見えないようにする。**cgroups** は使える資源量 (CPU、メモリ、I/O) に上限を掛ける。どちらもホストのカーネルの機能であり、コンテナ用に別のカーネルが動くわけではない (詳細は 18.4)。

この成り立ちから、VM (仮想マシン) との違いが導ける。

| | VM | コンテナ |
|---|---|---|
| 起動時間 | 数十秒〜数分 | ミリ秒〜秒 |
| サイズ | GB級 | MB級 |
| 隔離 | ハードウェアレベル | プロセスレベル |
| カーネル | 各VMが独自 | ホストと共有 |
| オーバーヘッド | 高い | ほぼゼロ |

コンテナは**プロセスをパッケージ化してどこでも同じように動かす**仕組み。OSは共有するため軽量。

<a id="section-19-2"></a>
### 19.2 Dockerfile のベストプラクティス
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"D","term":"Docker"} -->
<!-- handbook:index {"group":"D","term":"Dockerfile"} -->

<!-- handbook:narrative-bridge {"section":"19.2"} -->
隔離されたコンテナでも、イメージに不要なツールや秘密を含め、更新不能な依存を積めば再現性と安全性を失う。Dockerfileは単なる起動手順ではなく、供給物の最小性、キャッシュ、権限、再構築性を決める設計書である。

```dockerfile
# Bad な Dockerfile
FROM node:latest
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]
```

問題:

1. `latest` タグ → 再現性なし (将来別バージョンになりうる)
2. 全ファイルをコピーしてから install → ソース変更でキャッシュが無効化される
3. dev依存も含まれる
4. root で動く → セキュリティリスク
5. イメージサイズが大きい

```dockerfile
# Good な Dockerfile (マルチステージ)
FROM node:24.18.0-alpine AS builder
WORKDIR /app

# 依存関係だけ先にコピーしてインストール (キャッシュ効率)
COPY package.json package-lock.json ./
RUN npm ci

# ソース全体をコピーしてビルド
COPY . .
RUN npm run build

# 本番イメージ
FROM node:24.18.0-alpine AS runtime
WORKDIR /app

# プロダクション依存のみ
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ビルド成果物をコピー
COPY --from=builder /app/dist ./dist

# 非rootユーザー
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

# プロセスシグナルを正しく扱う
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
```

**キャッシュレイヤの理解:**

Docker は各 `RUN`、`COPY` をレイヤとしてキャッシュする。**変更頻度が低いものを上に、頻繁に変わるものを下に**書くと、ビルドが速くなる。

```dockerfile
# 良い順序
COPY package.json package-lock.json ./   # 滅多に変わらない
RUN npm ci                                # ↑ が変わらなければキャッシュ
COPY . .                                  # 頻繁に変わる
RUN npm run build
```

<a id="section-19-3"></a>
### 19.3 .dockerignore の重要性
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"19.3"} -->
Dockerfileを最適化しても、ビルドコンテキストへ巨大な成果物や秘密が送られれば、時間、キャッシュ、安全性が悪化する。.dockerignoreはイメージに入れない設定ではなく、ビルダーへ渡す入力そのものを制限する。

```text
node_modules
dist
.git
.env
.env.local
*.log
coverage
.DS_Store
```

これがないと、`COPY . .` で巨大な node_modules までイメージに入り、ビルドが遅く、イメージが肥大化する。

<a id="section-19-4"></a>
### 19.4 docker-compose ― ローカル開発
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"D","term":"docker-compose"} -->

<!-- handbook:narrative-bridge {"section":"19.4"} -->
一つのイメージを再現できても、Web、DB、キャッシュなど複数サービスの接続順序と設定を各開発者が手でそろえる問題は残る。Composeはローカル環境のサービス関係を宣言し、統合動作を同じ手順で再現する。

複数コンテナをまとめて起動するなら docker-compose (現在は `docker compose`)。

```yaml
# docker-compose.yml
# Compose v2 では version キーは不要 (指定すると obsolete 警告が出る)

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/myapp
      REDIS_URL: redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules  # ホストのnode_modulesで上書きしない
    command: npm run dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  db-data:
  redis-data:
```

```bash
docker compose up -d         # バックグラウンド起動
docker compose logs -f app   # ログ追従
docker compose exec app sh   # コンテナに入る
docker compose down          # 停止。volumes: で宣言したデータは残る
docker compose down -v       # 停止 + ボリューム削除。db-data と redis-data が消え、
                             # ローカル開発DBの中身が失われる。作り直したいときだけ使う
```

新規メンバーがプロジェクトに参加したとき、`docker compose up` だけで全環境が立ち上がる ― これがコンテナの真価。

<a id="section-19-5"></a>
### 19.5 Kubernetes ― 大規模なオーケストレーション
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"K","term":"Kubernetes"} -->

<!-- handbook:narrative-bridge {"section":"19.5"} -->
Composeは一台の環境で複数コンテナを起動できるが、ホスト障害、複製、段階更新、容量変化を継続的に調整しない。Kubernetesは望ましい状態を宣言し、制御ループが現在との差を埋め続けるオーケストレーションを提供する。

Docker は単一ホストの話。複数ホストにまたがる運用では **Kubernetes (K8s)** が最も広く使われている (CNCF の 2023 年調査でも本番採用率が最多)。

**主要概念:**

- **Pod**: コンテナの最小単位 (通常1コンテナ、まれに複数)
- **Deployment**: Pod のレプリカを管理 (自動再起動、ローリングアップデート)
- **Service**: Pod へのネットワーク抽象 (内部LB)
- **Ingress**: クラスタ外からのHTTP流入 (L7 LB)
- **ConfigMap / Secret**: 設定情報
- **Namespace**: 論理分離
- **HPA (Horizontal Pod Autoscaler)**: 自動スケール

<a id="section-19-6"></a>
### 19.6 Kubernetes の YAML
<!-- handbook:learning {"level":"practical","minutes":20} -->
<!-- handbook:index {"group":"K","term":"Kubernetes"} -->

<!-- handbook:narrative-bridge {"section":"19.6"} -->
Kubernetesの制御ループを利用するには、何を何個、どの入口と設定で動かすかを機械可読な宣言へ落とす必要がある。YAMLは書式そのものより、APIオブジェクトとして意図と責務を分離する点が重要である。

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # 常に全部稼働、新規追加してから古いを削除
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: app
        image: myregistry/web-app:v1.2.3
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:           # 最低限の保証
            cpu: 100m         # 0.1 CPU
            memory: 128Mi
          limits:             # 上限
            cpu: 500m
            memory: 512Mi
        livenessProbe:        # 死んでたら再起動
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:       # トラフィック受けられるか
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      # SIGTERM 後の猶予 (graceful shutdown 用)。
      # Pod 仕様のフィールドなので containers と同じ階層に置く
      terminationGracePeriodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: web-app
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  tls:
  - hosts: [example.com]
    secretName: example-com-tls
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app
            port:
              number: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

これでアプリが3〜50台で自動スケール、ローリングアップデート、自動再起動、TLS終端まで実現される。

<a id="section-19-7"></a>
### 19.7 Probes ― Liveness と Readiness
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"L","term":"Liveness Probe"} -->
<!-- handbook:index {"group":"R","term":"ReadinessProbe"} -->

<!-- handbook:narrative-bridge {"section":"19.7"} -->
Podが起動していることと、要求を受けられること、回復不能になっていることは同じではない。Readiness、Liveness、Startup Probeを分けることで、流量制御と再起動を異なる観測結果へ結び付ける。

混同しやすいが別物。

- **Liveness Probe**: 「**生きてるか?**」失敗で **再起動** される
- **Readiness Probe**: 「**トラフィック受けられるか?**」失敗で **Service から外れる** (再起動はしない)

```typescript
// アプリ側の実装
app.get('/health', (req, res) => {
  // プロセスが応答するか
  res.json({ status: 'ok' });
});

app.get('/ready', async (req, res) => {
  // 依存が使えるか
  try {
    await db.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
```

起動中のアプリは Liveness は通るが Readiness は失敗、という時間を意図的に設けることが重要。これがないと、起動完了前にトラフィックが来てエラーになる。

<a id="section-19-8"></a>
### 19.8 ConfigMap と Secret
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"C","term":"ConfigMap"} -->
<!-- handbook:index {"group":"S","term":"Secret 管理"} -->

<!-- handbook:narrative-bridge {"section":"19.8"} -->
同じイメージを環境ごとに再利用するには、設定値と秘密情報を実行物から分離しなければならない。ConfigMapとSecretは注入経路を標準化するが、Secretの保管と暗号化責任まで自動で消えるわけではない。

```yaml
# configmap.yaml (平文の設定)
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info
  FEATURE_X_ENABLED: "true"
---
# secret.yaml (パスワードなど)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:                # base64 自動エンコード
  url: postgres://user:pass@db:5432/myapp
  password: super-secret
```

**注意**: K8sのSecretは**Base64エンコードしてあるだけ**で、暗号化ではない。本番では SealedSecrets、External Secrets Operator、AWS Secrets Manager 等と組み合わせる。

<a id="section-19-9"></a>
### 19.9 マネージド Kubernetes と代替
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"19.9"} -->
Kubernetesは強力だが、制御面、アップグレード、ネットワーク、セキュリティを自前で持つほど運用責任も増える。マネージドKubernetesやPaaSを比較し、必要な制御と引き受けられる責任の釣り合いを判断する。

Kubernetes は強力だが、運用コストも高い。マネージドサービスを使うのが一般的。

- **AWS EKS** / **GKE** / **AKS**: 主要クラウドの K8s
- **Fly.io**、**Railway**、**Render**: K8sを隠した PaaS
- **AWS ECS**: AWS独自のオーケストレータ (K8sより簡単)

スタートアップ・小規模なら、K8s ではなく PaaS から始める方が現実的。スケールしたら Kubernetes へ。

<a id="section-19-10"></a>
### 19.10 Ingress Controller の比較 ― クラスタへの入り口
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"G","term":"Gateway API (Kubernetes)"} -->
<!-- handbook:index {"group":"H","term":"HAProxy Ingress"} -->
<!-- handbook:index {"group":"I","term":"Ingress Controller"} -->
<!-- handbook:index {"group":"N","term":"NGINX Ingress"} -->
<!-- handbook:index {"group":"T","term":"Traefik"} -->

<!-- handbook:narrative-bridge {"section":"19.10"} -->
クラスタ内部でサービスを発見できても、外部要求をどのホスト名・証明書・経路で各サービスへ届けるかが残る。Ingress ControllerとGateway APIは、L7入口の設定と実装を分け、クラスタ外から内への通信契約を作る。

19.6 で Ingress リソースを紹介したが、Ingress は「ルール定義」であり、それを実装する **Ingress Controller** が別途必要。複数の選択肢があり、性質が大きく異なる。

#### 主要 Ingress Controller

| 名前 | 基盤 | 特徴 | 適合用途 |
|---|---|---|---|
| **NGINX Ingress** | nginx | デフォルトの選択肢、安定 | 一般的な Web トラフィック |
| **Traefik** | Go ネイティブ | 設定簡単、自動 Let's Encrypt | スタートアップ、シンプル運用 |
| **HAProxy Ingress** | HAProxy | 高性能 L7 LB | 高負荷、複雑なルーティング |
| **Envoy** ベース | Envoy proxy | 細かい制御、Observability | Service Mesh と統合 |
| **Contour** | Envoy | VMware 製、CRD ベース | エンタープライズ Envoy |
| **Istio Gateway** | Envoy | Service Mesh 一部 | Service Mesh 採用時 |
| **AWS Load Balancer Controller** | AWS ALB | AWS ネイティブ | EKS、AWS WAF 統合 |
| **GKE Ingress** | GCP Load Balancer | GCP ネイティブ | GKE |

#### 機能比較の観点

**1. ルーティング機能**
- パスベース、ホスト名ベース ― 全 Controller 対応
- カナリーデプロイ ― nginx、Traefik、Istio 対応
- A/B テスト (ヘッダで分岐) ― Traefik、Istio が得意
- gRPC、WebSocket 対応

**2. 証明書管理**
- **cert-manager との統合**: nginx、Traefik 等で標準
- **Traefik 内蔵 Let's Encrypt**: 自動更新

**3. 可観測性**
- メトリクス (Prometheus 形式)
- 分散トレース統合
- アクセスログのカスタマイズ

**4. Web Application Firewall (WAF)**
- **ModSecurity 統合**: nginx で利用可
- **AWS WAF 統合**: AWS Load Balancer Controller で

#### 設定例の違い

```yaml
# 標準 Ingress (どの Controller でも動く基本)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    # アノテーションは Controller 固有
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [app.example.com]
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
```

```yaml
# Traefik IngressRoute (CRD ベース、より宣言的)
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: my-app
spec:
  entryPoints: [websecure]
  routes:
    - match: Host(`app.example.com`) && PathPrefix(`/api`)
      kind: Rule
      services:
        - name: api-service
          port: 80
      middlewares:
        - name: rate-limit
  tls:
    certResolver: letsencrypt
```

#### 選択指針

| シナリオ | 推奨 |
|---|---|
| 初めての K8s 導入 | NGINX Ingress(情報量、安定性) |
| 自動証明書、シンプル運用 | Traefik |
| AWS EKS | AWS Load Balancer Controller(統合性) |
| Service Mesh も導入予定 | Istio Gateway か Linkerd |
| 大規模、Observability 重視 | Envoy ベース (Contour、Istio Gateway) |
| エンタープライズ要件 | NGINX Plus、HAProxy Enterprise |

#### Gateway API ― Ingress の後継

Kubernetes の **Gateway API** (2023年 GA) は Ingress を置き換える新標準。「**Ingress では表現できなかった複雑なルーティングを CRD で標準化**」する。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-gateway
spec:
  gatewayClassName: istio
  listeners:
    - name: https
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs: [{ name: app-tls }]
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-app
spec:
  parentRefs: [{ name: my-gateway }]
  hostnames: [app.example.com]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /api }
      backendRefs:
        - name: api-service
          port: 80
```

Ingress と比べて柔軟性が高く、トラフィック分割 (カナリー)、ヘッダ操作などが標準化されている。新規プロジェクトなら Gateway API を検討する価値がある。

<a id="section-19-11"></a>
### 19.11 Service Mesh ― マイクロサービス間通信の抽象化
<!-- handbook:learning {"level":"advanced","minutes":15} -->
<!-- handbook:index {"group":"C","term":"Cilium (eBPF)"} -->
<!-- handbook:index {"group":"I","term":"Istio"} -->
<!-- handbook:index {"group":"L","term":"Linkerd"} -->
<!-- handbook:index {"group":"S","term":"Service Mesh"} -->
<!-- handbook:index {"group":"さ行","term":"サービスメッシュ"} -->
<!-- handbook:index {"group":"さ行","term":"サイドカーパターン"} -->

<!-- handbook:narrative-bridge {"section":"19.11"} -->
入口を統一しても、サービス間通信にはリトライ、TLS、可観測性、流量制御が各実装へ散らばる。Service Meshはこれらを通信基盤へ移せる一方、データプレーンと運用複雑性を追加するため、必要性を境界ごとに評価する。

「**100個のマイクロサービスを動かすと、認証・暗号化・リトライ・可観測性を各サービスで実装するのは現実的でない**」 ― これを解決するのが **Service Mesh**。

#### 何を提供するか

Service Mesh は「**サービス間通信のインフラ層**」として:

- **mTLS 自動化**: サービス間通信を自動暗号化 (13.22 で扱った)
- **可観測性**: メトリクス・トレース・ログを自動収集
- **トラフィック管理**: カナリー、A/B テスト、リトライ、サーキットブレーカ (26.6)
- **セキュリティ**: アクセス制御、認可ポリシー
- **障害注入**: Chaos Engineering (26.12) の基盤

#### Sidecar パターン

伝統的な Service Mesh はサービスごとに**サイドカー Proxy**(通常 Envoy) を配置:

```text
[Pod]
  ├── App Container (ビジネスロジック)
  └── Envoy Sidecar  ← 全通信がここを通る
        ↓
      [他の Pod の Envoy]
```

アプリ側はサービス名で通信するだけ。Envoy が裏で mTLS、リトライ、計測を行う。

#### 主要 Service Mesh

**1. Istio**: 最も機能豊富、コミュニティ最大、複雑

```yaml
# Istio で「v2 に 10% トラフィック振る」
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: my-app
spec:
  hosts: [my-app]
  http:
    - route:
        - destination:
            host: my-app
            subset: v1
          weight: 90
        - destination:
            host: my-app
            subset: v2
          weight: 10
```

**2. Linkerd**: シンプル、Rust 製で軽量、CNCF 卒業プロジェクト

**3. Consul Connect**: HashiCorp、Kubernetes 以外でも使える

**4. Cilium Service Mesh**: eBPF ベース、サイドカーレス

#### サイドカーレス Service Mesh の台頭

サイドカーは「アプリと同じ Pod に Envoy を入れる」ため:

- メモリオーバーヘッド (Pod ごとに 50〜200MB)
- レイテンシ増 (全通信が Envoy を経由)
- 複雑性 (Sidecar Injection、起動順序問題)

これを避けるアプローチが登場:

- **eBPF ベース** (Cilium): カーネルレベルで処理、サイドカー不要
- **Ambient Mesh** (Istio 2024〜): Node レベルの Proxy + 必要時のみセキュアトンネル

#### 採用判断

| 規模・要件 | 推奨 |
|---|---|
| 〜10サービス | Service Mesh 不要、ライブラリ実装で十分 |
| 10〜50サービス | Linkerd (シンプル、運用負荷小) |
| 50〜数百サービス | Istio (機能フル) または Cilium Service Mesh |
| パフォーマンス重視 | Cilium、Linkerd |
| マルチクラスタ、複雑な要件 | Istio |

「**サービス数が増えてから導入**」が原則。最初から Service Mesh を入れるのはオーバーエンジニアリングの典型。

#### Service Mesh は「インフラの責任」を変える

Service Mesh 導入は「**アプリ開発者がやっていたこと (リトライ、暗号化など) をインフラ層に移す**」変更だ。これにより、アプリは純粋なビジネスロジックに集中できる。逆に SRE/プラットフォームチームの責任範囲が広がる。

組織の規模・成熟度が見合っていないと、Service Mesh は使いこなせない。「**プラットフォームチームがいる**」が事実上の前提。

<a id="section-19-12"></a>
### 19.12 実装課題 ― コンテナとオーケストレーションの内側
<!-- handbook:learning {"level":"advanced","minutes":220} -->

<!-- handbook:narrative-bridge {"section":"19.12"} -->
宣言的な配置を理解しても、Probeやローリング更新、PID 1の振る舞いを誤れば停止時に要求を失う。実装課題で制御ループとプロセス管理を小さく再現し、Kubernetesが隠している責務を確かめる。

第19章ではコンテナの仕組み、Dockerfile、K8s、Probes、Service Mesh を見た。本節では仕組みを実装またはツール化することで、表面的な YAML 操作の裏側を理解する。所要時間: 演習カードの推定時間の合計で8時間40分。

#### 課題19.1: Dockerfile 最適化を計測 (★★)

**目的**: 「**レイヤキャッシュ**」「**マルチステージビルド**」の効果を実測。

<!-- handbook:exercise:start {"id":"19.1"} -->
> **演習カード 課題19.1** ― 難易度 ★★ ／ 推定時間 190分 ／ 必要サービス: Docker
>
> **前提**
>
> - 19.2 Dockerfile のベストプラクティス を読み、レイヤキャッシュとマルチステージビルドの狙いを押さえる
> - 19.3 .dockerignore の重要性 を読み、ビルドコンテキストに何が送られるかを把握する
> - `docker build` と `docker images` が実行できる Docker Engine が動作している (未導入でも main.sh の静的解析部分は動く)
> - 計測対象になる小さな Node.js アプリ (package.json と src) を用意できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] naive と cached と multi-stage の3つの Dockerfile を用意し、`docker images` のサイズを3件とも記録する
> - [ ] ソースを1行だけ変更した後の再ビルド時間を3種類で計測し、cached と multi では依存インストール層が CACHED になることをログで確認する
> - [ ] solution/main.sh が naive_mutating_layers と optimized_stages の2値を出力し、optimized_stages が 3 になる
> - [ ] multi-stage 版の最終イメージにビルド専用の中間生成物が含まれないことを `docker run --rm app:multi ls /app` で確認する
> - [ ] COPY の順序を入れ替えた版を作り、キャッシュが効かなくなることを再ビルド時間で示す
>
> **期待出力**
>
> - `bash code/ch19/dockerfile-optimization/solution/main.sh` が naive_mutating_layers=3、optimized_stages=3、workdir=(生成先)、docker_benchmark=skipped の4行を出力する。`RUN_DOCKER_BENCH=1` を付けて Docker のある環境で実行すると、naive と cached と multi の3イメージを実際に build し、初回ビルド時間・ソース1行変更後の再ビルド時間・イメージサイズを行ごとに出力して docker_benchmark=done で終わる
> - Docker がある環境では multi-stage 版が naive の 1/5 前後になる。絶対値はベースイメージのCPUアーキテクチャで変わるため (実測例: amd64 で naive 401MB / multi 81MB、arm64 で naive 1.62GB / multi 348MB)、固定値ではなく倍率で比較する
> - コード1行変更後の再ビルドで、naive は依存インストールからやり直し、cached は数秒で完了する
>
> **観察項目**
>
> - `docker build --progress=plain` の出力で CACHED と表示される行がどこまで続くかを、3つの Dockerfile で比較する
> - `docker history app:multi` で各レイヤのサイズを見て、どの命令が容量を占めているか確認する
> - package.json だけを変更した場合と src だけを変更した場合で、キャッシュが壊れる位置が変わることを確認する
> - runtime ステージのベースを bookworm から bookworm-slim へ変えたときのサイズ差を記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch19 run test` を実行し、Dockerfile optimization script emits both strategies が通ることを確認する
> 2. `bash code/ch19/dockerfile-optimization/solution/main.sh /tmp/dockerfile-bench` を実行し、生成された naive/Dockerfile と optimized/Dockerfile を目視で比較する
> 3. Docker のある環境で `RUN_DOCKER_BENCH=1 bash code/ch19/dockerfile-optimization/solution/main.sh` を実行し、skipped 行が出ないことを確認する
> 4. `docker images` の出力で multi タグのサイズが3つの中で最小なら合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に「何を測るか」を決める。イメージサイズ、初回ビルド時間、1行変更後の再ビルド時間の3指標に絞れば Dockerfile の差が数字で出る
> 2. **構造**: optimized 版は deps と build と runtime の3ステージに分け、deps では package.json とロックファイルだけを COPY してから install する。runtime へは COPY --from=build で成果物だけを持ち込む
> 3. **実装の要点**: キャッシュが効くかどうかは COPY の粒度で決まる。COPY . . を install より前に置いた瞬間、どのファイルを触っても install がやり直しになる。計測時に --no-cache 付きと通常ビルドを取り違えないこと
>
> **本番利用時の警告**
>
> - この比較用 Dockerfile はベースイメージをタグ (node:24-bookworm) で指定しており digest を固定していない。本番では同じタグでも中身が入れ替わり、再ビルドで別のイメージができて再現性を失うため digest のピン留めが必要
> - 計測のために大量のイメージとビルドキャッシュが残る。終了後は `docker rmi app:naive app:cached app:multi` と `docker builder prune -f` で、この演習が作ったものだけを消す。`docker system prune -a` はホスト上の未使用イメージを**すべて**削除するため、他のプロジェクトのイメージまで巻き込む。共有CIランナー上で計測するとディスクを埋めて他ジョブを止める
>
> **導線**
>
> - 開始地点: `code/ch19/dockerfile-optimization/starter/main.sh`
> - 模範解答: `code/ch19/dockerfile-optimization/solution/main.sh`
>
> **推定時間の内訳**: 計測対象アプリと3種の Dockerfile 作成に50分、ベースイメージの初回取得 (約1.9GB) に25分、初回と再ビルドの時間計測に45分、`docker history` と `docker run` での確認に40分、サイズとレイヤの比較記録に30分
<!-- handbook:exercise:end -->

**実験**: 同じ Node.js アプリを3つの Dockerfile で書く:

1. **Naive**: 全部 COPY → npm install → ビルド
2. **Cached**: package.json のみ COPY → npm install → コード COPY → ビルド
3. **Multi-stage**: builder stage で全部、runtime stage に成果物のみ

```bash
# 各 Dockerfile でビルド
docker build -f Dockerfile.naive -t app:naive .
docker build -f Dockerfile.cached -t app:cached .
docker build -f Dockerfile.multi -t app:multi .

# サイズ比較
docker images app
# 期待: naive 800MB, cached 800MB, multi 150MB

# キャッシュ効果の計測
echo "// comment" >> src/index.ts
time docker build -f Dockerfile.naive -t app:naive .   # 全部やり直し
time docker build -f Dockerfile.cached -t app:cached . # npm install スキップ
```

**問題**:
- multi-stage がなぜ小さくなるか?
- COPY の順序がキャッシュにどう影響するか?
- node_modules を COPY し忘れたらどうなる?

模範解答: `code/ch19/dockerfile-optimization/`(3つの Dockerfile + 計測スクリプト)

#### 課題19.2: K8s manifest 検証ツール (★★★)

**目的**: Kubernetes の YAML マニフェストを静的解析する社内ツールを書く。実プロダクトで `kube-score`、`polaris`、`kubeval` 等が果たす役割を自作する。

<!-- handbook:exercise:start {"id":"19.2"} -->
> **演習カード 課題19.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 19.6 Kubernetes の YAML を読み、Deployment の spec.template.spec.containers の階層を把握する
> - 19.7 Probes ― Liveness と Readiness を読み、readinessProbe が無い場合の影響を押さえる
> - TypeScript で再帰的にオブジェクトを走査する関数を書ける
> - 検証対象となる Deployment マニフェストを、良い例と悪い例の2つ以上用意できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] parseSimpleYaml が入れ子のマップをインデントから復元し、true/false/null/数値をスカラーとして型変換する
> - [ ] ManifestValidator.validate が severity と rule と message と path の4キーを持つ配列を返す
> - [ ] image が latest タグまたはタグ無しの場合に rule=no-latest-tag の warning を返す
> - [ ] resources と readinessProbe の欠落でそれぞれ require-resources と require-readiness-probe の warning を返す
> - [ ] securityContext.privileged が true の場合に severity=error の no-privileged を返す
> - [ ] kind が無いマニフェストで required-kind の error を返す
>
> **期待出力**
>
> - 問題だらけの Deployment に対して no-latest-tag、require-resources、require-readiness-probe、no-privileged を含む4件以上の issue が返る
> - すべての項目を満たしたマニフェストでは空配列が返る
> - 各 issue の path が spec.template.spec.containers[].image のような指摘位置の文字列になっている
>
> **観察項目**
>
> - 同じマニフェストを kube-score や kubeval にも掛け、自作の指摘と既製ツールの指摘の差分を数える
> - インデントだけを変えたYAMLを食わせ、簡易パーサが行頭ハイフンの配列を無視することによる検出漏れを確認する
> - privileged: true を securityContext の外側に置いた場合でも再帰探索が拾ってしまう (位置を見ていない) ことを確認する
> - replicas を1にした場合と3にした場合で、可用性ルールを足したときの出力差を比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch19 run test` を実行し、manifest validator finds operational and security issues が通ることを確認する
> 2. code/ch19 で `tsx --test solutions.test.ts` を実行し、parseSimpleYaml の kind が Deployment、issues に no-latest-tag と no-privileged が含まれることを確認する
> 3. 手元の実マニフェストを validate に掛け、既知の問題 (latest タグなど) が検出されれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「YAMLを読む」と「ルールを当てる」を完全に分ける。パースは辞書を返すだけにし、ルールはその辞書に対する述語として書く
> 2. **構造**: パーサはインデント量をキーにしたスタックで親を辿る。ルール側は path 文字列を分割して辿る取り出しと、キー名で再帰探索する取り出しの2種類を用意する
> 3. **実装の要点**: 行頭ハイフンの配列まで扱うと一気に複雑になるので、まずマップだけ対応して割り切る。その場合 containers 配下を path で辿れないため、image のようなキーは再帰探索で拾う必要がある
>
> **本番利用時の警告**
>
> - この簡易パーサは配列、アンカー、区切り線による複数ドキュメント、複数行文字列を扱えない。実運用のマニフェストへ適用すると検出漏れを正常と誤認するため、CIのゲートに使うなら kubeval や kube-score のような本物のスキーマ検証を併用する
> - privileged の検出はキー名の再帰探索であり階層を見ていない。無関係な位置の同名キーで誤検知し、配列内の2つ目のコンテナは見落とす。ポリシーの強制は Kyverno や Gatekeeper のような Admission Controller 側で行う
>
> **導線**
>
> - 開始地点: `code/ch19/manifest-validator/starter/main.ts`
> - 模範解答: `code/ch19/manifest-validator/solution/main.ts`
>
> **推定時間の内訳**: 簡易YAMLパーサの実装に55分、6ルールの実装と issue 型の整理に50分、良い例と悪い例での検証および既製ツール比較に45分
<!-- handbook:exercise:end -->

**チェック項目** (★ は模範解答が実装済み):
- ★ 必須フィールド: `resources.requests/limits` が設定されているか
- ★ `livenessProbe`、`readinessProbe` の有無
- ★ `securityContext.runAsNonRoot: true` が指定されているか
- ★ Image タグが `latest` でないか
- Pod が 2 つ以上のレプリカを持つか (可用性)
- HPA(HorizontalPodAutoscaler) が存在するか

模範解答の簡易YAMLパーサは配列を読み飛ばすため、最後の2項目は判定できない。複数マニフェストの走査と配列の解釈は読者の実装範囲とする。

```typescript
const validator = new ManifestValidator();
const issues = validator.validate(yamlContent);
// → [{ severity: 'warning', rule: 'no-latest-tag', message: '...' }, ...]
```

模範解答: `code/ch19/manifest-validator/`

#### 課題19.3: ローリングアップデート シミュレーション (★★)

**目的**: Kubernetes の `maxSurge` / `maxUnavailable` 設定が実際にどう動くか観察。

<!-- handbook:exercise:start {"id":"19.3"} -->
> **演習カード 課題19.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 19.5 Kubernetes ― 大規模なオーケストレーション を読み、Deployment が ReplicaSet を通じて Pod 数を収束させる流れを押さえる
> - 19.7 Probes ― Liveness と Readiness を読み、Ready でない Pod が Service から外れることを把握する
> - maxSurge と maxUnavailable が replicas に対する比率であることを理解している
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] replicas=10、maxSurge=0.25、maxUnavailable=0.25 の execute() が状態の配列を返し、最終要素の newReady が 10 になる
> - [ ] 全ステップで total(旧と新の合計) が replicas + maxSurge の上限である 13 を超えない
> - [ ] 各ステップで step と oldReady と newReady と unavailable と total の5フィールドが記録される
> - [ ] newPodFailureRate を 1 にすると進行不能となり rollout cannot make progress が投げられる
> - [ ] random を固定関数で注入すると、同じ入力から同じ状態列が再現できる
>
> **期待出力**
>
> - `tsx rollout-simulator.solution.ts` が1ステップ1行のJSONを出力し、step/oldReady/newReady/unavailable/total の5キーを持つ
> - maxSurge が 25% の設定では total の最大が 13、最終行が oldReady=0 かつ newReady=10 になる
> - newPodFailureRate を上げるとステップ数が増え、失敗率1.0では例外で終了する
>
> **観察項目**
>
> - maxSurge=0 かつ maxUnavailable=0 を渡し、どちらも動かせないため実装が最低1へクランプしていることを確認する
> - maxSurge=1.0 かつ maxUnavailable=0 にすると総 Pod 数が一時的に 20 まで増える Blue-Green 相当の挙動になることを確認する
> - unavailable の推移を見て、maxUnavailable が「同時に何台まで落としてよいか」に対応していることを確認する
> - newPodFailureRate を 0.3 にして複数回実行し、収束までのステップ数のばらつきを記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch19 run test` を実行し、rollout respects surge and converges が通ることを確認する
> 2. `tsx code/ch19/rollout-simulator.solution.ts` を実行し、最終行の newReady が 10 かつ全行の total が 13 以下なら合格
> 3. 固定乱数を注入した2回の実行で出力が完全に一致することを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「1ステップで何台作れて何台消せるか」を先に式にする。作れる数は replicas + maxSurge から現在の総数を引いた値、消せる数は現在の総数から replicas - maxUnavailable を引いた値
> 2. **構造**: 状態は oldReady と newReady の2変数で足りる。ループ条件を newReady < replicas とし、1ステップごとに状態を配列へ push して後から検証できるようにする
> 3. **実装の要点**: maxSurge も maxUnavailable も 0 になると1台も動かせず無限ループになる。最低1へクランプするか、進行不能を検知して例外にする分岐を必ず入れる
>
> **本番利用時の警告**
>
> - このシミュレータは Pod の起動時間、readinessProbe の待ち、PodDisruptionBudget、ノード容量をすべて無視している。実クラスタで同じ設定を使うと、起動の遅いアプリでは Ready 待ちの間に旧 Pod が先に消え、一時的な容量不足で 5xx が出る
> - 失敗した新 Pod を「リトライすれば成功しうる」と単純化しているため、イメージ取得失敗のような恒久的失敗をロールバックできない。本番では progressDeadlineSeconds と自動ロールバックの設定が必要
>
> **導線**
>
> - 開始地点: `code/ch19/rollout-simulator.ts`
> - 模範解答: `code/ch19/rollout-simulator.solution.ts`
>
> **推定時間の内訳**: surge と unavailable の計算式の設計と実装に40分、ステップ出力と収束確認に25分、失敗率と極端な設定値での挙動比較に25分
<!-- handbook:exercise:end -->

**要件**:
- 10 個の "Pod" を持つ Deployment
- 新バージョンへのローリング: `maxSurge=25%`, `maxUnavailable=25%`
- 各ステップで「Ready Pod 数 (旧/新)」「総 Pod 数」を表示
- ヘルスチェック失敗率を設定できる (失敗で再起動)

```typescript
const rollout = new Rollout({
  replicas: 10,
  oldVersion: 'v1.0',
  newVersion: 'v1.1',
  maxSurge: 0.25,
  maxUnavailable: 0.25,
  newPodFailureRate: 0,
});
await rollout.execute();
```

**問題**:
- `maxSurge=0%, maxUnavailable=0%` の組み合わせは何故ダメか?
- `maxSurge=100%, maxUnavailable=0%` は何を意味するか? (Blue-Green に近い)
- 新バージョンが起動失敗する場合、ロールバックはどう動く?

模範解答: `code/ch19/rollout-simulator.solution.ts`

#### 課題19.4: 簡易 PID 1 init プロセス (★★)

**目的**: コンテナで `PID 1` として動くプロセスの役割 (ゾンビ回収、シグナル伝搬) を理解。

<!-- handbook:exercise:start {"id":"19.4"} -->
> **演習カード 課題19.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: Docker
>
> **前提**
>
> - 19.1 コンテナの仕組み を読み、コンテナ内の PID 1 が特別扱いされることを押さえる
> - 18.3 シグナル ― プロセス間通信の基礎 を読み、シグナルのデフォルト動作と PID 1 の例外を把握する
> - node:child_process の spawn と exit イベントを扱える
> - `docker run --init` の有無を切り替えて検証できる Docker 環境がある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] runInit(command, args) が子プロセスを spawn し、終了コードで解決する Promise を返す
> - [ ] runInit で process.exit(7) する子を起動すると 7 が返る
> - [ ] SIGTERM と SIGINT と SIGHUP と SIGQUIT の4シグナルを親が受けたら子へ転送する
> - [ ] 子がシグナルで終了した場合に 128 とシグナル番号の和 (SIGTERM なら 143) を返す
> - [ ] 子の exit 後にシグナルハンドラを解除し、ハンドラが積み上がらない
>
> **期待出力**
>
> - `tsx mini-init.solution.ts sleep 30` を起動して別端末から `kill -TERM <pid>` を送ると、sleep も同時に終了し親が 143 で終わる
> - 引数なしで起動すると usage 行を標準エラーへ出し、終了コード 64 で終わる
> - 子の終了コードがそのまま親の終了コードに伝わる
>
> **観察項目**
>
> - init を使わずにアプリを直接 PID 1 にして `time docker stop` を計測し、10秒待って SIGKILL になることを確認する
> - `ps -o pid,ppid,stat,comm` で子の親が init プロセスであること、終了直後に STAT が Z(ゾンビ) になるかを確認する
> - `docker run --init` を付けた場合、PID 1 が docker-init になり自作 init が PID 2 になることを確認する
> - 孫プロセスを作ってから親を殺し、孤児が PID 1 に引き取られる様子を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch19 run test` を実行し、mini init returns child exit code が通ることを確認する
> 2. `tsx code/ch19/mini-init.solution.ts sleep 30` を起動し、SIGTERM 後に `ps aux` で sleep が残っていなければ合格
> 3. `tsx code/ch19/mini-init.solution.ts node -e 'process.exit(3)'` の後に `echo $?` が 3 を返すことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: init の仕事は「起動する」「シグナルを中継する」「終了コードを返す」の3つ。まず spawn して exit を待つだけの版を作り、そこへシグナル転送を足す
> 2. **構造**: spawn は stdio を inherit にして子の出力をそのまま流す。転送したいシグナルの配列をループして process.on でハンドラを登録し、exit 時に process.off で必ず外す
> 3. **実装の要点**: 終了コードの扱いが落とし穴。exit イベントの第2引数が非 null のときは code が null になるため、128 とシグナル番号の和へ変換しないとシェルから見た終了コードが化ける
>
> **本番利用時の警告**
>
> - Node.js の spawn では POSIX の waitpid を直接扱えず、引き取った孤児プロセスを刈り取る本来のゾンビ回収はできない。コンテナで本気で PID 1 を務めるなら tini や dumb-init、あるいは `docker run --init` を使う
> - この init は親が先に落ちると子が孤児として残る。CI やコンテナで多重起動すると sleep や node のプロセスが積み上がりホストのプロセステーブルを消費するので、実験後は `pgrep -af mini-init` で対象を確かめてから `kill` する。`pkill -f` はコマンドライン全体への一致で消すため、同じ文字列を含む無関係なプロセス (エディタの検索など) まで巻き込む
>
> **導線**
>
> - 開始地点: `code/ch19/mini-init.ts`
> - 模範解答: `code/ch19/mini-init.solution.ts`
>
> **推定時間の内訳**: spawn と exit 待ちの実装に25分、4シグナルの転送とハンドラ解除に35分、docker --init の有無の比較とゾンビ観察に30分
<!-- handbook:exercise:end -->

**要件**:
- 子プロセスを fork
- SIGTERM を受け取ったら子に転送 + 終了
- 子プロセスがゾンビ化したら `waitpid` で回収

```bash
# 起動
tsx init.ts node child-process.js

# シェルで kill すると、init が SIGTERM を子に転送して全員清算
```

**背景**: Docker の `--init` フラグ、`tini` の役割。Node.js を直接 PID 1 で動かすとゾンビ回収しないので問題。

模範解答: `code/ch19/mini-init.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":19} -->
### 第19章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第19章の模範解答をまとめて検証する
pnpm --filter @handbook/ch19 run test

# 模範解答を個別に実行する
bash code/ch19/dockerfile-optimization/solution/main.sh                    # 課題19.1
pnpm --filter @handbook/ch19 exec tsx manifest-validator/solution/main.ts  # 課題19.2
pnpm --filter @handbook/ch19 exec tsx rollout-simulator.solution.ts        # 課題19.3
pnpm --filter @handbook/ch19 exec tsx mini-init.solution.ts                # 課題19.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch19/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

ここまでで、アプリケーションをイメージとして固定し、クラスタへ宣言的に配置できるようになった。しかし、クラスタ外のネットワーク、ストレージ、権限、マネージドサービスは依然として手作業で作られうる。第20章では、管理責任をクラウドサービスへ割り振り、環境全体をIaCとして再現する。

<a id="chapter-20"></a>
## 第20章 クラウドとIaC

第19章で、アプリケーションの実行単位と配置をコンテナ、Kubernetesの宣言として扱えるようになった。しかし、クラスタそのもの、仮想ネットワーク、永続ストレージ、DNS、証明書、権限は依然として外側にあり、誰かが作成して維持しなければならない。管理画面の手操作に頼れば、環境差、変更履歴の欠落、削除不能な試験資源が再び生まれる。

本章では、クラウドサービスを責任分界の選択として整理し、VPC、サーバレス、エッジ、API Gatewayなどを要件から選ぶ。その構成をIaCとしてコード化し、plan、state、review、GitOpsによって変更可能なシステムとして管理する。第21章では、環境をコードで表せても、アプリとインフラの変更を安全な順序で継続的に届ける仕組みが必要になる。

<!-- handbook:chapter-guide:start {"chapter":20} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> クラウド構成を画面操作と担当者の記憶に依存させず、ネットワーク、権限、変更、復旧をコードとレビューで管理する。
>
> **到達目標**
> - IaaS/PaaS/SaaSと主要クラウドサービスの対応を説明できる。
> - VPC/CIDR、サーバレス、エッジ、API Gatewayの選択を説明できる。
> - Terraform/Pulumi/GitOpsの状態と変更フローを設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [18.5 ネットワークスタック](#section-18-5) ― ネットワークスタック
> - [19.1 コンテナの仕組み](#section-19-1) ― コンテナ
>
> **中核概念**  
> [20.1 クラウドの3層モデル](#section-20-1)、[20.2 AWSの主要サービス](#section-20-2)、[20.5 サーバレスの台頭](#section-20-5)、[20.7 IaC (Infrastructure as Code)](#section-20-7)、[20.8 Terraform の実例](#section-20-8) (実務選択)、[20.10 GitOps ― 宣言的な運用](#section-20-10) (実務選択)、[20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める](#section-20-11)
>
> **最小実装**  
> [20.14 実装課題 ― クラウドと IaC を自分の手で](#section-20-14) (実務選択)
>
> **本番実装との差分**
> - 教材IaCは組織ポリシー、state backend、秘密管理、import、drift、費用上限、災害復旧を簡略化する。
>
> **典型的な失敗**
> - コンソール変更とIaCを併用しdriftを放置する。
> - 広すぎるIAM権限を与える。
> - 削除計画を確認せずapplyする。
>
> **診断・デバッグ方法**
> - plan差分、クラウド監査ログ、state、実リソースを照合する。
> - タグとコスト配賦で予期しない増加を追う。
>
> **意思決定チェックリスト**
> - 管理責任を減らすサービスはどれか。
> - 可搬性の価値が複雑性を上回るか。
> - stateと秘密をどこで守るか。
>
> **演習と評価基準**  
> 対象: [20.14 実装課題 ― クラウドと IaC を自分の手で](#section-20-14) (実務選択)
> - IaCのplanをレビューし、変更・破壊・費用影響を説明できる。
>
> **一次資料・発展資料**
> - Terraform documentation
> - Pulumi documentation
> - AWS/GCP/Azure architecture frameworks
> - Twelve-Factor App
<!-- handbook:chapter-guide:end -->

<a id="section-20-1"></a>
### 20.1 クラウドの3層モデル
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"20.1"} -->
第19章でアプリケーションを配置する方法は得たが、計算資源、DB、ネットワークをどこまで自分で管理するかは未決定である。IaaS、PaaS、SaaSの層は製品分類ではなく、障害対応と変更責任をどこまで提供者へ渡すかを示す。

- **IaaS** (Infrastructure as a Service): 仮想マシン、ストレージ、ネットワーク (例: AWS EC2)
- **PaaS** (Platform as a Service): アプリ実行環境 (例: Heroku、AWS Elastic Beanstalk)
- **SaaS** (Software as a Service): 完成したサービス (例: Gmail、Slack)

更にFaaS (Function as a Service、Lambdaなど) や BaaS (Backend as a Service、Firebase) もある。

<a id="section-20-2"></a>
### 20.2 AWSの主要サービス
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"AWS RDS"} -->
<!-- handbook:index {"group":"A","term":"AWS S3"} -->
<!-- handbook:index {"group":"C","term":"CDN"} -->

<!-- handbook:narrative-bridge {"section":"20.2"} -->
責任分界を選ぶには、計算、保存、配信、権限、監視を具体的なサービスへ対応づける必要がある。AWSの主要サービスを例に、アーキテクチャ上の役割と管理責任の組合せを確認する。

AWS は最大のクラウドだが、サービス数は数百。Webアプリで主に使うのは:

**コンピュート:**

- **EC2**: 仮想マシン
- **ECS / Fargate**: コンテナ実行
- **EKS**: マネージド Kubernetes
- **Lambda**: サーバレス関数
- **App Runner**: 簡易コンテナホスティング

**ストレージ:**

- **S3**: オブジェクトストレージ (静的ファイル、画像、バックアップ)
- **EBS**: EC2 のブロックストレージ
- **EFS**: 共有ファイルシステム

**データベース:**

- **RDS**: マネージド RDBMS (PostgreSQL、MySQL、Aurora)
- **DynamoDB**: マネージド KV
- **ElastiCache**: マネージド Redis/Memcached
- **OpenSearch**: マネージド ES
- **Aurora**: AWS独自のRDB (PostgreSQL/MySQL互換、性能◎)

**ネットワーク:**

- **VPC**: 仮想ネットワーク
- **ALB / NLB**: ロードバランサ
- **CloudFront**: CDN
- **Route 53**: DNS

**メッセージング:**

- **SQS**: キュー
- **SNS**: PubSub
- **EventBridge**: イベントバス
- **MSK**: マネージド Kafka

**監視・運用:**

- **CloudWatch**: ログ・メトリクス
- **X-Ray**: 分散トレース
- **IAM**: 権限管理
- **Secrets Manager**: シークレット

<a id="section-20-3"></a>
### 20.3 GCP / Azure の対応関係
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"20.3"} -->
AWSの名称を覚えても、組織や要件によってGCPやAzureを選ぶ場合に設計意図を移せない。サービス名ではなく計算、オブジェクト保存、メッセージングなどの能力で対応関係を見ると、選択を比較可能にできる。

| AWS | GCP | Azure |
|---|---|---|
| EC2 | Compute Engine | Virtual Machines |
| Lambda | Cloud Functions | Functions |
| S3 | Cloud Storage | Blob Storage |
| RDS | Cloud SQL | Database |
| DynamoDB | Firestore / Spanner | Cosmos DB |
| Route 53 | Cloud DNS | DNS |
| CloudFront | Cloud CDN | CDN |
| SQS | Pub/Sub | Service Bus |
| CloudWatch | Cloud Monitoring | Monitor |
| IAM | IAM | Microsoft Entra ID (旧 Azure AD) |

3社で大きな差異はないが、特定領域では強み・弱みがある:

- **AWS**: 最大のシェア、サービス数、求人
- **GCP**: BigQuery (データ分析)、Kubernetes (GKEはK8sのリファレンス的存在)、AI/ML
- **Azure**: Microsoft 製品との統合 (Active Directory、Office 365)

<a id="section-20-4"></a>
### 20.4 マルチクラウドとベンダーロックイン
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"ま行","term":"マルチクラウド"} -->

<!-- handbook:narrative-bridge {"section":"20.4"} -->
クラウド間の対応が分かっても、複数社へ同時対応すれば障害回避になるとは限らず、最小公倍数の設計と運用負荷が増える。ロックインの種類と移行価値を分け、可搬性へ払う複雑性が妥当かを判断する。

「ベンダーロックインを避けるため、複数クラウドを使うべき」という主張は理想論。現実には:

- マルチクラウドは運用コストが高い
- 各クラウドの特性を活かせない
- 移植性のために最低公約数だけ使うと損する

「**1つのクラウドに本気でロックインする方が、結果的に安く速い**」というのが2026年現在の主流意見。コストはマルチクラウドへの移植性確保ではなく、最適化に投資すべき。

<a id="section-20-5"></a>
### 20.5 サーバレスの台頭
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"A","term":"AWS Lambda"} -->
<!-- handbook:index {"group":"さ行","term":"サーバレス"} -->

<!-- handbook:narrative-bridge {"section":"20.5"} -->
VMやクラスタを管理する構成では、低頻度処理にも常時稼働資源と更新責任が残る。サーバレスは実行単位を要求やイベントへ近づけ、容量管理を提供者へ渡す代わりに、制約、起動遅延、実行時間という新しい境界を持つ。

「サーバを意識しない」開発スタイル。

**AWS Lambda の例:**

```typescript
// handler.ts
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.id;
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  };
};
```

**Lambda の利点:**

- 自動スケール (1リクエストでも100万リクエストでも対応)
- 0実行 = 0コスト
- インフラ管理ゼロ

**欠点:**

- コールドスタート (初回起動が遅い、数百ms〜数秒)
- 実行時間制限 (15分まで)
- 永続接続が持てない (WebSocket、長いポーリング向き不向き)
- ローカル開発がしにくい

スタートアップのAPIや、不定期に動くバッチには非常に有効。常時高負荷のサービスではコンテナ (ECS/EKS) の方が安いことが多い。

<a id="section-20-6"></a>
### 20.6 エッジコンピューティング
<!-- handbook:learning {"level":"outlook","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"20.6"} -->
リージョン内のサーバレスでも、利用者から遠ければ往復遅延とデータ移動時間は消えない。エッジコンピューティングは処理を入口へ近づけるが、状態の配置、整合性、デバッグの難しさを伴う。

CDN の各ノードでコードが動く新しい潮流:

- **Cloudflare Workers**: V8 isolate 上で動く。Node.js ランタイムそのものではなく、互換レイヤ経由で一部 API を使う
- **Vercel Edge Functions**: Web標準API中心の実行環境。基盤は提供側の都合で変わるため、依存しない設計にする
- **Deno Deploy**: Deno ベース
- **AWS Lambda@Edge**: CloudFront連動

**利点:**

- ユーザーから物理的に近い (低レイテンシ)
- 自動グローバル分散
- 起動が速い (Lambda のコールドスタート問題が小さい)

**制約:**

- 実行時間が短い (50ms〜数十秒)
- メモリが小さい (128MB等)
- Node.js の一部APIが使えない
- DB直接接続が難しい (HTTPベースのDBアクセスが推奨)

LLM や認証チェック、A/Bテスト、画像変換などのエッジ用途で本領発揮。

<a id="section-20-7"></a>
### 20.7 IaC (Infrastructure as Code)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"I","term":"IaC (Infrastructure as Code)"} -->

<!-- handbook:narrative-bridge {"section":"20.7"} -->
サービスを適切に選んでも、画面操作で構成すれば再現性、レビュー、復旧手順が人の記憶へ戻る。IaCはインフラを宣言と状態として扱い、変更前に差分を検討できるようにする。

「ボタンをクリックしてインフラを構築」は再現性ゼロ。**インフラもコードで管理する**のがIaC。

**メリット:**

- 環境再現可能 (dev、staging、prodで同じ構成)
- 変更履歴が Git に残る
- レビュー可能 (PR で議論)
- ロールバック可能

**代表的なツール:**

- **Terraform** (HashiCorp): クラウド非依存、最大シェア
- **OpenTofu**: Terraform のフォーク (ライセンス変更に反発)
- **Pulumi**: 通常のプログラミング言語で書ける (TypeScript、Pythonなど)
- **AWS CDK**: AWS公式、TypeScript/Python等で書く
- **CloudFormation**: AWS純正、YAML/JSON

<a id="section-20-8"></a>
### 20.8 Terraform の実例
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"T","term":"Terraform"} -->

<!-- handbook:narrative-bridge {"section":"20.8"} -->
IaCの原則を実際の変更へ落とすには、設定、依存グラフ、state、plan、applyの関係を理解する必要がある。Terraformを通じて、宣言と実リソースの差をどのように計算し収束させるかを見る。

```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "my-tfstate"
    key    = "prod/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name = "main"
  }
}

# RDS
resource "aws_db_instance" "main" {
  identifier        = "myapp-prod"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t4g.medium"
  allocated_storage = 50

  db_name  = "myapp"
  username = "app"
  password = var.db_password  # 変数

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  skip_final_snapshot     = false
  final_snapshot_identifier = "myapp-final"

  tags = {
    Environment = "production"
  }
}

# 出力
output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
```

```bash
terraform init       # 初期化
terraform plan       # 変更内容を確認
terraform apply      # 適用
```

`terraform destroy` は、そのstateが管理しているリソースを**すべて削除する**。上のmain.tfはバックエンドのキーが `prod/terraform.tfstate`、識別子が `myapp-prod` で本番を指しているため、そのまま実行するとVPCとRDSが消える。RDSは削除時にスナップショットを取る設定でなければ復旧できない。試すときは、使い捨てのstateキーと専用のAWSアカウントを用意し、`terraform plan -destroy` で消える対象を1つずつ確認してから実行する。

**State の管理が重要:**

Terraform は現在のインフラの状態を `terraform.tfstate` に保持する。これを Git に入れてはいけない (秘密情報を含む、複数人で編集競合)。S3 などのリモートバックエンドに保存し、ロック (DynamoDB) で同時実行を防ぐ。

<a id="section-20-9"></a>
### 20.9 Pulumi ― プログラミング言語で書く IaC
<!-- handbook:learning {"level":"advanced","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"20.9"} -->
宣言DSLは差分計算に適する一方、複雑な生成や既存コードとの共有では表現が重くなることがある。Pulumiは汎用言語を使う選択肢を示すが、命令的に書けることと再現可能な状態管理は区別しなければならない。

```typescript
// index.ts
import * as aws from '@pulumi/aws';

const vpc = new aws.ec2.Vpc('main', {
  cidrBlock: '10.0.0.0/16',
  enableDnsHostnames: true,
});

const dbPassword = new aws.secretsmanager.Secret('db-password');
const config = new pulumi.Config();
const dbPasswordValue = new aws.secretsmanager.SecretVersion('db-password-v', {
  secretId: dbPassword.id,
  // 秘密をソースへ書かない。`pulumi config set --secret dbPassword <値>` で
  // 暗号化して保存した値を読む。直書きするとリポジトリの履歴に永久に残り、
  // 消すにはローテーションしかなくなる (23.9)
  secretString: config.requireSecret('dbPassword'),
});

const db = new aws.rds.Instance('main', {
  identifier: 'myapp-prod',
  engine: 'postgres',
  engineVersion: '16',
  instanceClass: 'db.t4g.medium',
  allocatedStorage: 50,
  dbName: 'myapp',
  username: 'app',
  password: dbPasswordValue.secretString,
  // ...
});

export const dbEndpoint = db.endpoint;
```

ループ、条件分岐、関数、テストが普通に書ける。Terraform の HCL では難しい複雑なロジックを表現できる。

<a id="section-20-10"></a>
### 20.10 GitOps ― 宣言的な運用
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"G","term":"GitOps"} -->

<!-- handbook:narrative-bridge {"section":"20.10"} -->
IaCファイルがあっても、誰かがローカルから直接applyすれば、レビュー済みの宣言と実環境がずれる。GitOpsはGit上の望ましい状態を正本とし、継続的な照合によって変更経路を一つにする。

「Git のリポジトリが**真実の源 (source of truth)**」とする運用思想。

```text
[コード変更] → [Push to Git] → [CI が build] → [ArgoCD が Kubernetes に適用]
```

ArgoCD や Flux が代表ツール。Kubernetes のマニフェストを Git に置き、ArgoCD が定期的に Git と Kubernetes の差分を検出して同期する。

**メリット:**

- 変更履歴と承認フローが Git で完結
- 手動操作がない (誰かが kubectl で勝手に変えても、ArgoCD が元に戻す)
- 監査と再現性

<a id="section-20-11"></a>
### 20.11 CIDR と VPC 設計 ― ネットワークの基礎を固める
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"C","term":"CIDR"} -->
<!-- handbook:index {"group":"I","term":"IPv6"} -->
<!-- handbook:index {"group":"V","term":"VPC"} -->
<!-- handbook:index {"group":"V","term":"VPC Peering"} -->

<!-- handbook:narrative-bridge {"section":"20.11"} -->
計算や配置を宣言できても、アドレス範囲を誤ればサービス接続、将来拡張、オンプレミス連携で衝突する。CIDRとVPC設計は、ネットワークを後付け配線ではなく、到達性と隔離の長期的な土台として扱う。

クラウドネットワークの設計には IP アドレスとサブネットの基礎理解が必須。

#### CIDR 記法

```text
192.168.0.0/24
└──────┘ └─┘
   IP    プレフィックス長
```

`/24` は「上位24ビットがネットワーク部、残り8ビットがホスト部」を意味する。

| CIDR | アドレス数 | 用途 |
|---|---|---|
| /32 | 1 | 単一ホスト |
| /28 | 16 | 小規模サブネット |
| /24 | 256 | 一般的なサブネット |
| /20 | 4,096 | 中規模 VPC |
| /16 | 65,536 | 大規模 VPC |
| /8 | 16,777,216 | 巨大ネットワーク (10.0.0.0/8) |

実際にホスト割り当て可能な数は、ネットワーク・ブロードキャスト用 2 つを除く (AWS では先頭・末尾の追加分含めて 5 つ予約)。

#### プライベート IP の範囲

[RFC 1918] で定義されたプライベート範囲 (インターネット上では使えない):

- `10.0.0.0/8` (16M アドレス)
- `172.16.0.0/12` (1M アドレス)
- `192.168.0.0/16` (65K アドレス)

#### VPC 設計の典型パターン

AWS VPC の例:

```text
VPC: 10.0.0.0/16 (65,536 アドレス)
├── AZ-a
│   ├── Public Subnet: 10.0.1.0/24   (256)  ← ALB、NAT GW
│   ├── Private Subnet: 10.0.11.0/24 (256)  ← アプリサーバ
│   └── DB Subnet: 10.0.21.0/24      (256)  ← RDS
├── AZ-b
│   ├── Public Subnet: 10.0.2.0/24
│   ├── Private Subnet: 10.0.12.0/24
│   └── DB Subnet: 10.0.22.0/24
└── AZ-c
    └── ... (同じパターン)
```

**設計指針:**

- **VPC は大きめに**: 後から拡張困難なので `/16` 推奨
- **3 AZ 構成**: 高可用性のため
- **3 層構造**: Public(LB)/ Private(App)/ DB(分離)
- **将来の拡張余地**: 半分以上は未使用で残しておく

#### VPC Peering

異なる VPC を相互接続する。**両 VPC の CIDR が重複していないこと**が必須。

```text
[VPC A: 10.0.0.0/16] ⇄ Peering ⇄ [VPC B: 10.1.0.0/16]
```

- **メリット**: プライベート接続、低レイテンシ
- **制限**: 非トランジティブ (A-B、B-C があっても A-C は直接通信できない)
- **代替**: AWS Transit Gateway(多数の VPC を中央接続)

#### IPv6 と Dual Stack

IPv4 アドレス枯渇 → IPv6 への移行は進みが遅いが、AWS/GCP は Dual Stack(両方有効) を推奨。新規設計では IPv6 対応を検討。

<a id="section-20-12"></a>
### 20.12 API Gateway パターン ― マイクロサービスの入り口
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"A","term":"API Gateway"} -->
<!-- handbook:index {"group":"B","term":"BFF (Backend for Frontend)"} -->

<!-- handbook:narrative-bridge {"section":"20.12"} -->
VPC内に多数のサービスを置くと、利用者やクライアントへ内部構成を直接公開できない。API Gatewayは認証、制限、経路選択を外部契約の入口へ集め、バックエンドの分割と公開面を切り離す。

マイクロサービスや SaaS の API では、**全リクエストが最初に通る一元的な入り口** を設けるのが定石。これが API Gateway パターン。

#### 役割

```text
[Client]
   ↓
[API Gateway]  ← ここで集中処理
   ├ 認証・認可
   ├ レート制限
   ├ リクエスト変換
   ├ レスポンスキャッシュ
   ├ ロギング・モニタリング
   └ ルーティング
   ↓
[Backend Services]
```

各バックエンドサービスが個別に実装するべきでない**横断的関心事**を集約する。

#### 代表的な実装

| | マネージド | OSS |
|---|---|---|
| AWS | API Gateway、AppSync | - |
| GCP | API Gateway、Apigee | - |
| Azure | API Management | - |
| 汎用 | - | Kong、Tyk、KrakenD、Express Gateway |
| Service Mesh統合 | - | Istio Gateway、Envoy |

#### Kong の例

```yaml
# Kong の宣言的設定
services:
  - name: orders-service
    url: http://orders.internal:8080
    routes:
      - paths: [/api/orders]
    plugins:
      - name: rate-limiting
        config:
          minute: 60
      - name: jwt
        config:
          claims_to_verify: [exp]
      - name: prometheus
```

#### API Gateway vs Ingress Controller

| | Ingress Controller | API Gateway |
|---|---|---|
| 主目的 | クラスタへの入り口 | API 管理 |
| 機能 | ルーティング、TLS、基本的なヘッダ操作 | + 認証、レート制限、課金、ドキュメント |
| ターゲット | 全 HTTP トラフィック | API 専用 |
| 開発者ポータル | なし | あり (Apigee 等) |

両者を併用するケースも多い:「Ingress でクラスタに入り、API Gateway で API 管理」。

#### BFF (Backend for Frontend)

API Gateway パターンの派生形が **BFF**。「**各クライアント (Web、iOS、Android) に専用の中間層**」を置く。

```text
[Web Client] ──→ [Web BFF]    ──┐
[iOS Client] ──→ [iOS BFF]    ──┼→ [Microservices]
[Android]    ──→ [Android BFF] ─┘
```

**メリット:**

- クライアントごとに最適化したレスポンス形状
- バックエンドの粒度に縛られない API 設計
- モバイル向けに帯域節約 (必要なフィールドだけ返す)

**デメリット:**

- BFF が増えると保守コスト増
- BFF にロジックが流出する誘惑

GraphQL を採用すれば BFF の役割を吸収できる (クライアントが必要なフィールドを指定)。BFF は GraphQL 採用前の解とも言える。

<a id="section-20-13"></a>
### 20.13 Twelve-Factor App ― クラウド時代の設計指針
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"T","term":"Twelve-Factor App"} -->

<!-- handbook:narrative-bridge {"section":"20.13"} -->
クラウド機能を組み合わせても、設定をコードへ埋め込み、ローカルディスクや手動管理へ依存すれば移動と自動化を妨げる。Twelve-Factor Appはアプリ側を環境非依存に保ち、配置基盤との責任境界を整える。

**Twelve-Factor App** [Wiggins, 2017] は Heroku 創業者が2011年に提唱し、2017年に改訂した SaaS アプリの設計原則12カ条である。コンテナやマネージド実行環境を前提とする構成の共通語彙として、いまも参照される。

| # | 原則 | 要点 |
|---|---|---|
| 1 | コードベース | 1アプリ1リポジトリ、複数環境にデプロイ |
| 2 | 依存関係 | 明示的に宣言、システムに頼らない |
| 3 | 設定 | 環境変数で管理、コードに含めない |
| 4 | バックエンドサービス | DB・キュー等は付け替え可能なリソース |
| 5 | ビルド・リリース・実行 | 3段階を分離 |
| 6 | プロセス | ステートレス、ローカルディスクに頼らない |
| 7 | ポートバインディング | 自分でポートを開く、コンテナの基本 |
| 8 | 並行性 | プロセスを増やしてスケール |
| 9 | 廃棄容易性 | 起動・停止が高速、SIGTERM で速やかに終了 |
| 10 | 開発/本番一致 | 環境差分を最小化 |
| 11 | ログ | イベントストリームとして stdout に出す |
| 12 | 管理プロセス | one-off タスクは同じコードベースで |

#### 守られていないと何が起きるか

- 設定をコードに書く → ステージング・本番の設定差し替えが大変
- ステートをディスクに → 水平スケール不可、Pod 再起動でデータロス
- ログをファイルに → Kubernetes でログ収集できない、ローテーション地獄
- 起動が遅い → スケールアウトに数分かかり、急増負荷に対応できない

#### 実装例: 設定の外部化

```typescript
// BAD: 設定をコードに
const dbUrl = 'postgres://prod-db.example.com:5432/mydb';

// GOOD: 環境変数から
const dbUrl = process.env.DATABASE_URL ?? throwError('DATABASE_URL required');

// GOOD: zod で型安全に
import { z } from 'zod';
const env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
}).parse(process.env);
```

#### Beyond Twelve-Factor

12-Factor は2011年に書かれた。**Kevin Hoffman の "Beyond the Twelve-Factor App" (2016)** は3つ追加:

13. API ファースト
14. テレメトリ (可観測性)
15. 認証と認可

現代的なクラウドネイティブ設計はこれらを含めて15因子と考えるとよい。

<a id="section-20-14"></a>
### 20.14 実装課題 ― クラウドと IaC を自分の手で
<!-- handbook:learning {"level":"practical","minutes":220} -->

<!-- handbook:narrative-bridge {"section":"20.14"} -->
クラウドとIaCの用語を理解しても、planが示す破壊変更、stateの役割、費用影響を読めなければ安全に運用できない。実装課題では差分計算と秘密・費用管理を再現し、宣言的運用の判断点を確認する。

第20章ではクラウド3層、IaC、Terraform、GitOps、CIDR/VPC、API Gateway、Twelve-Factor を見た。本節では IaC とクラウド運用の核を実装する。所要時間: 演習カードの推定時間の合計で7時間。

#### 課題20.1: ミニ Terraform(状態管理 + plan/apply) (★★★)

**目的**: Terraform の核「**desired state を宣言 → 現状と diff → 必要な操作だけ実行**」を理解。

<!-- handbook:exercise:start {"id":"20.1"} -->
> **演習カード 課題20.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 20.7 IaC (Infrastructure as Code) を読み、宣言的な desired state という考え方を押さえる
> - 20.8 Terraform の実例 を読み、plan と apply と state の3者の関係を把握する
> - Node.js の node:fs 同期APIでファイルとディレクトリを作成・削除できる
> - 使い捨ての作業ディレクトリを用意し、その中でだけスクリプトを実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] plan が差分だけを create file / update file / delete file / create dir / delete dir の記号付きで表示し、ファイルを一切変更しない
> - [ ] apply がファイルとディレクトリを作成し、.terraform.state.json に desired と appliedAt と fingerprint を保存する
> - [ ] 変更なしの状態で plan を再実行すると No changes. Infrastructure is up-to-date. だけが出る
> - [ ] resources.json から1エントリ削除して plan すると、state に残っている分が delete file として出る
> - [ ] update の plan 出力に変更前と変更後の内容が2行で表示される
>
> **期待出力**
>
> - 初回 plan で create 行が resources.json の件数分だけ出力される
> - apply の最後に Created N files, M directories の集計行と State saved to .terraform.state.json の2行が出る
> - 内容だけ変えて plan すると update file 行の下に旧内容と新内容がJSON文字列で並ぶ
>
> **観察項目**
>
> - apply 後に .terraform.state.json を開き、fingerprint が desired の SHA-256 になっていることを確認する
> - state ファイルを削除してから resources.json のエントリを減らして plan し、削除が検出できなくなる (state が無いと消すべき対象を知れない) ことを確認する
> - plan と apply を連続実行した場合と、間に手動でファイルを触った場合で apply が行う操作数が変わることを確認する
> - 本物の `terraform plan` の出力記号と自作の出力記号を並べ、表現が対応していることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch20 run test` を実行し、mini terraform plans/applies and persists state が通ることを確認する
> 2. 使い捨てディレクトリで `bash code/ch20/mini-terraform/solution/main.sh plan resources.json` を実行し、create 行が出るだけでファイルが作られないことを `ls` で確認する
> 3. 続けて `bash code/ch20/mini-terraform/solution/main.sh apply resources.json` を実行し、config/app.conf の中身が resources.json の content と一致すれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: plan と apply で「差分を計算する処理」を共有し、出力するか実行するかだけを切り替える。この分離ができていれば plan に出ない変更が apply で起きる事故を防げる
> 2. **構造**: desired の files と directories を Map と Set にし、実ファイルの存在と内容を突き合わせて 操作種別と名前と内容 を持つ変更リストを作る。削除の判定だけは前回の state を参照する
> 3. **実装の要点**: 削除対象は「前回の state にあって今回の desired に無いもの」であり、実ファイルの一覧から求めてはいけない (管理外のファイルまで消す)。apply 後の state には desired そのものを保存する
>
> **本番利用時の警告**
>
> - このツールは apply 時に確認プロンプトを持たず、いきなり削除を実行する。相対パスの名前をカレントディレクトリ基準で削除するため、リポジトリ直下で実行すると必要なファイルを消す。必ず使い捨てディレクトリで実行する
> - state ファイルにはリソースの中身が平文で入る。実際の Terraform でも state に接続文字列やパスワードが平文で残るため、リポジトリへコミットせず暗号化されたリモートバックエンドに置き、同時実行を防ぐロックを掛ける必要がある
>
> **導線**
>
> - 開始地点: `code/ch20/mini-terraform/starter/main.sh`
> - 模範解答: `code/ch20/mini-terraform/solution/main.sh`
>
> **推定時間の内訳**: 差分計算の設計と実装に60分、plan と apply の出力整形に40分、state 保存と削除検出の確認に30分、手動変更を挟んだ再現テストに20分
<!-- handbook:exercise:end -->

**要件**: JSON で「リソース宣言」を読み、対応するファイル操作を行うミニ IaC ツール。

```json
{
  "files": [
    { "name": "config/app.conf", "content": "port=8080\nworkers=4\n" },
    { "name": "config/db.conf", "content": "host=localhost\n" }
  ],
  "directories": [
    { "name": "logs" },
    { "name": "tmp" }
  ]
}
```

```bash
$ tsx mini-terraform.ts plan
+ create file:    config/app.conf
+ create file:    config/db.conf
+ create dir:     logs
+ create dir:     tmp

$ tsx mini-terraform.ts apply
Created 2 files, 2 directories. State saved to .terraform.state.json

# 設定変更
$ vim resources.json  # app.conf の content を変更

$ tsx mini-terraform.ts plan
~ update file:    config/app.conf
  - port=8080
  + port=9090

$ tsx mini-terraform.ts apply
Updated 1 file.

# リソース削除
$ tsx mini-terraform.ts plan
- delete file:    config/db.conf
```

模範解答: `code/ch20/mini-terraform/`

#### 課題20.2: IaC ドリフト検出ツール (★★)

**目的**: 「**コード (IaC) で記述した状態**」と「**実際のリソースの状態**」のズレ (drift) を検出。

<!-- handbook:exercise:start {"id":"20.2"} -->
> **演習カード 課題20.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 課題20.1 のミニ Terraform を先に完了し、apply 済みのファイル群と .terraform.state.json がある
> - 20.7 IaC (Infrastructure as Code) を読み、コードと実体が乖離する drift の意味を押さえる
> - 20.10 GitOps ― 宣言的な運用 を読み、乖離を検知して宣言へ戻す運用像を把握する
> - node:fs/promises の stat と readFile で ENOENT を判定できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] detectDrift(files, cwd) が missing と content-mismatch と type-mismatch の3種の kind を返し分ける
> - [ ] 内容が異なるファイルで path と kind と expected と actual の4フィールドを持つ結果が返る
> - [ ] ファイルが存在しない場合に missing、同名のディレクトリになっていた場合に type-mismatch が返る
> - [ ] ドリフトが無い場合に空配列が返り、formatDrifts が No drift detected. を返す
> - [ ] formatDrifts の出力が DRIFT DETECTED の見出しに続けて1件1行の形式で並ぶ
>
> **期待出力**
>
> - 手動で書き換えたファイルに対し DRIFT DETECTED の見出しと content mismatch の行、expected と actual の2行が出る
> - ドリフトなしでは No drift detected. の1行のみが出る
> - ENOENT 以外のI/Oエラー (権限不足など) は握り潰されずそのまま例外になる
>
> **観察項目**
>
> - apply 直後に検出を掛けて0件、`echo manually changed > config/app.conf` の後に1件になることを確認する
> - ファイルを消した場合と同名ディレクトリへ置き換えた場合で kind が missing と type-mismatch に分かれることを確認する
> - 末尾の改行だけを削った場合でも content-mismatch として検出される (バイト単位比較である) ことを確認する
> - 検出後に課題20.1 の apply を再実行し、drift が解消されて0件へ戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch20 run test` を実行し、drift detector reports changed files が通ることを確認する
> 2. 使い捨てディレクトリで apply 後に `echo manually changed > config/app.conf` してから検出を呼び、kind が content-mismatch なら合格
> 3. 何も変更していない状態で formatDrifts の出力が No drift detected. になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 検出は「期待値の一覧」と「実体」を1件ずつ突き合わせるだけ。まず内容不一致だけを検出し、後から欠損と種別違いを足す
> 2. **構造**: 1ファイルごとに stat して isFile() を確認し、そのうえで readFile して文字列比較する。エラーは code が ENOENT のときだけ missing に変換し、それ以外は再スローする
> 3. **実装の要点**: readFile の例外を全部 catch すると権限エラーを drift と誤報する。catch の中で必ず errno の code を見分けること
>
> **本番利用時の警告**
>
> - この検出器はファイル内容しか見ておらず、パーミッション、所有者、シンボリックリンクの変更を drift として扱わない。クラウド資源では security group の穴あけのような手動変更こそ検出対象なので、実運用では terraform plan -detailed-exitcode やプロバイダAPIによる実体取得が必要
> - expected と actual をそのまま出力するため、管理対象にAPIキーや接続文字列が含まれると差分ログへ平文で残る。CIのジョブログは広く閲覧されるので、秘密を含むリソースはマスクするか検出対象から外す
>
> **導線**
>
> - 開始地点: `code/ch20/mini-terraform/drift.ts`
> - 模範解答: `code/ch20/mini-terraform/drift.solution.ts`
>
> **推定時間の内訳**: 3種の kind を返す検出関数の実装に35分、手動変更を作っての検証に30分、出力整形とエラー分岐の確認に25分
<!-- handbook:exercise:end -->

**シナリオ**: 課題20.1 のミニ Terraform で管理しているファイル群。誰かが手動でファイルを編集 → ドリフト発生。検出ツールがこれを報告する。

```bash
# 一度 apply してから手動でファイルを変更
$ echo "manually changed" > config/app.conf

$ tsx drift-detect.ts
⚠ DRIFT DETECTED:
  - config/app.conf: content mismatch
    expected: "port=9090\n..."
    actual:   "manually changed\n"
```

模範解答: `code/ch20/mini-terraform/drift.solution.ts`

#### 課題20.3: Cost estimator(リソース→月額推定) (★★)

**目的**: AWS / GCP の主要リソース (EC2、RDS、S3) に対する月額コストを概算するツール。

<!-- handbook:exercise:start {"id":"20.3"} -->
> **演習カード 課題20.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 20.2 AWSの主要サービス を読み、EC2 と RDS と S3 の課金軸 (時間、ストレージ、リクエスト) を押さえる
> - 20.1 クラウドの3層モデル を読み、管理責任と料金の関係を把握する
> - TypeScript の判別可能ユニオン型 (type フィールドで分岐する型) を書ける
> - 月間稼働時間を730時間として計算する前提を理解している
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] estimateResource が ec2 と rds と s3 の3種を type で分岐し、label と monthlyUsd を持つ行を返す
> - [ ] estimate が lines 配列と total を返し、total が各行の合計と一致する
> - [ ] count 省略時に1、hours_per_month 省略時に730が適用される
> - [ ] rds の月額がインスタンス時間課金と storage_gb にストレージ単価を掛けた額の合計になる
> - [ ] formatEstimate の出力が 各行と区切り線と TOTAL 行 で構成され、金額が小数点以下2桁に揃う
>
> **期待出力**
>
> - t3.medium を730時間で1台計上すると 30.37 USD 前後になる
> - ec2 t3.medium 730時間と s3 100GB の合計が 32 から 33 USD の範囲に収まる
> - formatEstimate がラベルを35桁で左詰めした行を並べ、最後に48文字の区切り線と TOTAL 行を出す
>
> **観察項目**
>
> - 同じ構成を AWS Pricing Calculator に入力し、自作の概算との乖離率を計算する
> - 料金表の単価を1つ変えたときに total がどれだけ動くかを見て、この構成で支配的なコスト要因がEC2の時間課金であることを確認する
> - hours_per_month を730から300へ減らし、常時起動と間欠運用のコスト差を比較する
> - s3 の requests_per_month を100万にしたときの寄与が数十セントにとどまり、ストレージ課金と桁が違うことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch20 run test` を実行し、cost estimator calculates deterministic total が通ることを確認する
> 2. code/ch20 で `tsx --test solutions.test.ts` を実行し、estimate の total が 32 より大きく 33 未満になることを確認する
> 3. 自分で書いたリソース定義を formatEstimate に通し、TOTAL が各行の合計と一致することを検算する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: リソース種別ごとに「何に何を掛けるか」を先に表にする。EC2は時間、RDSは時間とGB、S3はGBとリクエスト千件、と課金軸が違う点が本質
> 2. **構造**: 単価は1つの定数オブジェクトへ集約し、estimateResource は type で分岐して1行分の結果を返す純関数にする。合計は reduce、整形は padEnd と toFixed(2) で行う
> 3. **実装の要点**: count は ec2 と rds にしかない任意フィールドなので、in 演算子による存在チェックを挟まないと型エラーになる。s3 は台数の概念が無いため掛けてはいけない
>
> **本番利用時の警告**
>
> - この見積りはオンデマンド単価の静的表であり、リージョン差、データ転送料、NAT Gateway、スナップショット、リザーブドや Savings Plans の割引を一切含まない。実際の請求は数倍になりうるため、予算判断には Cost Explorer と Budgets を併用する
> - 演習のために実際に EC2 や RDS を起動して検証する場合、停止と削除を忘れると t3.medium 1台でも月30ドル、RDS を足せば数十ドルが自動で課金され続ける。検証は必ずリソース削除まで行い、始める前に AWS Budgets で金額アラートを設定する
>
> **導線**
>
> - 開始地点: `code/ch20/cost-estimator.ts`
> - 模範解答: `code/ch20/cost-estimator.solution.ts`
>
> **推定時間の内訳**: 料金表と型定義の設計に25分、3リソースの計算関数の実装に35分、整形出力と実料金ツールとの突き合わせに30分
<!-- handbook:exercise:end -->

**要件**:
- リソース定義 (JSON) を読む
- 静的な料金表から計算
- 月額 (USD) を合計表示

```json
{
  "resources": [
    { "type": "ec2", "instance": "t3.medium", "hours_per_month": 730 },
    { "type": "ec2", "instance": "t3.small", "count": 3, "hours_per_month": 730 },
    { "type": "rds", "instance": "db.t3.small", "storage_gb": 50 },
    { "type": "s3", "storage_gb": 500, "requests_per_month": 1000000 }
  ]
}
```

```bash
$ tsx cost-estimator.ts resources.json
ec2 t3.medium x1                    $30.37
ec2 t3.small x3                     $45.55
rds db.t3.small x1                  $30.57
s3                                  $11.90
------------------------------------------------
TOTAL                               $118.39
```

`rds` の行は時間課金 (0.034ドル × 730時間) にストレージ50GB分 (0.115ドル × 50) を足した値、`s3` の行は保存500GB分にリクエスト100万件分 (0.0004ドル × 1000) を足した値である。

模範解答: `code/ch20/cost-estimator.solution.ts`

#### 課題20.4: Secrets ローテーション スクリプト (★★)

**目的**: Vault や AWS Secrets Manager 風の「**シークレットを定期的にローテーション**」する仕組みを実装。

<!-- handbook:exercise:start {"id":"20.4"} -->
> **演習カード 課題20.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 20.2 AWSの主要サービス を読み、Secrets Manager や Parameter Store が担う役割を押さえる
> - 20.13 Twelve-Factor App ― クラウド時代の設計指針 を読み、設定と秘密をコードから分離する原則を把握する
> - node:crypto の createCipheriv と AES-256-GCM の iv と authTag の役割を知っている
> - テストで時刻を進められるよう、現在時刻を関数として注入する設計に慣れている
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] SecretStore が AES-256-GCM でファイルを暗号化し、保存ファイルに平文の値が現れない
> - [ ] `set(name, { value, metadata: { rotationDays } })` で登録した秘密を `get(name)` で取り出せる
> - [ ] rotationDays を過ぎた時点で needsRotation(name) が true を返す
> - [ ] rotate(name, generate) 後に get(name) が新値、version に previous を指定すると旧値を返す
> - [ ] grace 期間 (デフォルト7日) を過ぎた previous を取得すると version expired で失敗する
> - [ ] audit() が set と get と rotate の操作履歴を時刻付きで返す
>
> **期待出力**
>
> - 保存ファイルの先頭4バイトが HSS1 で、以降に平文の秘密文字列がバイト列として含まれない
> - rotate 直後の get は新値、previous 指定は旧値を返す
> - audit() の配列に at と action と name の3キーを持つ要素が操作回数分並ぶ
>
> **観察項目**
>
> - `xxd secrets.enc` の先頭を見て、マジック4バイトと12バイトのIVと16バイトの認証タグが並ぶ構造を確認する
> - ファイルを1バイト書き換えてから読み込み、GCM の認証タグ検証が失敗して復号エラーになることを確認する
> - 同じ内容を2回保存してもIVが毎回変わるためファイルのバイト列が異なることを確認する
> - `ls -l secrets.enc` でパーミッションが 600 になっていることを確認する
> - get を呼ぶたびに監査ログが増えてファイルが書き換わる (読み取りが書き込みを伴う) 副作用に気づく
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch20 run test` を実行し、secret store encrypts, rotates, and retains previous version が通ることを確認する
> 2. code/ch20 で `tsx --test solutions.test.ts` を実行し、保存ファイルに旧値の文字列が含まれないアサーションが通ることを確認する
> 3. 注入した時刻を1か月進めた状態で needsRotation が true になり、rotate 後に previous が取得できれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「暗号化された1ファイルを毎回読んで書き戻す」だけの単純なストアでよい。まず平文JSONで set と get と rotate を作り、最後に暗号化層を挟む
> 2. **構造**: 鍵は scryptSync でマスターキーから32バイト導出し、暗号は createCipheriv の aes-256-gcm を使う。保存形式を マジック4バイト + IV12バイト + 認証タグ16バイト + 本体 と決めておくと復号側が subarray だけで書ける
> 3. **実装の要点**: GCM の認証タグは final() を終えた後でないと取得できないため、連結順序を間違えると復号が必ず失敗する。ローテーション時は previous に expiresAt を入れ、get 側で現在時刻と比較して期限切れを弾く
>
> **本番利用時の警告**
>
> - マスターキーを引数やソースへ直書きする設計のままでは、リポジトリやプロセス一覧の引数から鍵が漏れる。本番では KMS や Secrets Manager に鍵を預け、アプリには復号権限だけを IAM で与える
> - このストアはローテーション後に旧値を使っているアプリへ通知しないため、実サービスでそのまま切り替えると grace 期間を過ぎた瞬間に認証失敗が一斉に起きる。本番では新旧2値を同時に有効にし、利用側の切替完了を確認してから旧値を無効化する
> - 監査ログを同じファイルへ書き足しているためファイルが肥大化し、get のたびに全体を再暗号化する。改竄検知も外部転送も無く、監査要件は満たさない
>
> **導線**
>
> - 開始地点: `code/ch20/secrets-rotator.ts`
> - 模範解答: `code/ch20/secrets-rotator.solution.ts`
>
> **推定時間の内訳**: 暗号化と復号の実装に30分、set と get と rotate および previous 保持の実装に35分、時刻注入によるローテーション検証と監査ログ確認に25分
<!-- handbook:exercise:end -->

**要件**:
- シークレットストア (暗号化された JSON)
- ローテーション policy(N 日経過で更新)
- 古い値も一定期間保持 (N - 7 日前まで)
- アクセス監査ログ

```typescript
const store = new SecretStore('./secrets.enc', masterKey);
await store.set('db_password', { value: 'old-pass', metadata: { rotationDays: 30 } });
// 30日経過後にrotate
await store.rotate('db_password', async () => generateRandomPassword());
// 古いバージョンも取得可能(grace期間)
const oldVal = await store.get('db_password', { version: 'previous' });
```

模範解答: `code/ch20/secrets-rotator.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":20} -->
### 第20章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第20章の模範解答をまとめて検証する
pnpm --filter @handbook/ch20 run test

# 模範解答を個別に実行する
bash code/ch20/mini-terraform/solution/main.sh                          # 課題20.1
pnpm --filter @handbook/ch20 exec tsx mini-terraform/drift.solution.ts  # 課題20.2
pnpm --filter @handbook/ch20 exec tsx cost-estimator.solution.ts        # 課題20.3
pnpm --filter @handbook/ch20 exec tsx secrets-rotator.solution.ts       # 課題20.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch20/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

ここまでで、クラウド環境をコードと状態として管理できるようになった。しかし、変更の検証と適用を人がつなぐ限り、実行順序と確認範囲は揺れる。第21章では、コードとインフラの変更を小さく検証し、段階的に届けるCI/CDへ進む。

<a id="chapter-21"></a>
## 第21章 CI/CDとDevOps

第20章で、アプリケーションが動く環境をコードとして再現し、変更差分をレビューできるようになった。だが、ビルド、テスト、イメージ作成、IaC適用、ヘルス確認を担当者が手でつなぐ限り、同じ変更でも実行順序や確認範囲が揺れる。変更頻度を下げて事故を避けようとすると、一回の変更が大きくなり、かえって復旧を難しくする。

本章では、変更を小さく統合し、同じ検証を自動で反復し、段階的に本番へ運ぶCI/CDを扱う。GitHub Actionsの構造から、マトリクス検証、Rolling、Blue-Green、Canary、ロールバック、DORA指標までを、変更リスクを制御する一つの流れとして理解する。第22章では、パイプラインが成功した後の本番が実際に利用者へ価値を届けているかを、観測可能にする必要がある。

<!-- handbook:chapter-guide:start {"chapter":21} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 人手のビルド・テスト・デプロイによる差異と事故を減らし、小さな変更を検証可能な形で本番へ届ける。
>
> **到達目標**
> - CI、Continuous Delivery、Continuous Deploymentを区別できる。
> - 安全なGitHub Actionsとマトリクス検証を設計できる。
> - ロールアウト、ロールバック、DORA指標、バージョニングを運用へ結び付けられる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [8.1 バンドラの基本原理](03-part2-frontend.md#section-8-1) ― ビルド工程
> - [19.2 Dockerfile のベストプラクティス](#section-19-2) ― イメージ構築
>
> **中核概念**  
> [21.1 CI/CD の意味](#section-21-1)、[21.2 GitHub Actions](#section-21-2)、[21.4 デプロイ戦略 ― それぞれの実装と使い分け](#section-21-4)、[21.5 ロールバック戦略](#section-21-5)、[21.6 デプロイ頻度と DORA メトリクス](#section-21-6) (実務選択)、[21.7 セマンティックバージョニングと変更ログ](#section-21-7)
>
> **最小実装**  
> [21.8 実装課題 ― CI/CD の動作原理を実装する](#section-21-8) (実務選択)
>
> **本番実装との差分**
> - 教材CIは組織の承認、環境保護、署名、SBOM、秘密、fork境界、長時間ジョブを省略する。
>
> **典型的な失敗**
> - Actionsへ過大な権限を与える。
> - mutable tagや未固定Actionを使う。
> - ロールバック不能なDB変更を同時投入する。
>
> **診断・デバッグ方法**
> - workflow run、artifact、commit SHA、deployment eventを追跡する。
> - 失敗をbuild/test/deploy/health checkへ分解する。
>
> **意思決定チェックリスト**
> - 失敗をどこまで自動で止めるか。
> - ロールバックとroll-forwardのどちらが現実的か。
> - 本番権限を短命化できるか。
>
> **演習と評価基準**  
> 対象: [21.8 実装課題 ― CI/CD の動作原理を実装する](#section-21-8) (実務選択)
> - 意図的な失敗を入れ、パイプラインが適切な段階で停止することを示せる。
>
> **一次資料・発展資料**
> - GitHub Actions documentation
> - DORA research
> - Semantic Versioning
> - SLSA
<!-- handbook:chapter-guide:end -->

<a id="section-21-1"></a>
### 21.1 CI/CD の意味
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"21.1"} -->
環境をIaCで再現できても、変更を人が都度ビルドして適用すれば、検証の抜けと手順差が残る。CIと二つのCDを区別し、変更を小さく統合して常に配布可能に保つ流れを定義する。

- **CI (Continuous Integration)**: コードをマージするたびに自動でビルド・テスト
- **CD (Continuous Delivery)**: デプロイ可能な状態を常に維持 (本番展開は手動承認)
- **CD (Continuous Deployment)**: 本番にも自動デプロイ

3つを混同しがちだが、目的は同じ: **「マージから本番反映までの摩擦をなくし、頻繁に小さくデプロイする」**。

<a id="section-21-2"></a>
### 21.2 GitHub Actions
<!-- handbook:learning {"level":"required","minutes":15} -->
<!-- handbook:index {"group":"G","term":"GitHub Actions"} -->

<!-- handbook:narrative-bridge {"section":"21.2"} -->
CI/CDの考え方を実行するには、リポジトリ上のイベント、権限、ジョブ、成果物を機械的なワークフローへ変換する必要がある。GitHub Actionsを例に、変更と検証を同じ履歴へ結び付ける。

Git ホスティングと統合された CI/CD ツール。GitHub 上のリポジトリではデフォルトの選択肢になる。

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 5s

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test

      - uses: codecov/codecov-action@v4
        if: success()

# 上の例は読みやすさのために `@v4` のような可変タグで書いている。
# 可変タグは同じタグのまま中身が差し替わりうるため、供給元が侵害されると
# ビルド環境ごと乗っ取られる。本番のワークフローでは、この章の学習ガイドが
# 「典型的な失敗」に挙げているとおり、コミットSHAで固定する。
#   - uses: actions/checkout@8f4b7f84864484a7bf31766abe9204da3cbe65b3  # v4.2.1
# 固定した SHA の更新は Dependabot か Renovate に任せ、差分をレビューして上げる。

  build:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write        # OIDC で AWS の一時認証情報を受け取るために必要
    steps:
      - uses: actions/checkout@v4

      # 長期のアクセスキーをシークレットへ置かず、OIDC で一時認証情報を得る。
      # このステップが無いと次の ECR ログインは認証情報を見つけられず失敗する
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ${{ secrets.ECR_REGISTRY }}/myapp:${{ github.sha }}
            ${{ secrets.ECR_REGISTRY }}/myapp:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production    # 承認制御の設定可
    permissions:
      contents: write          # 既定トークンでマニフェストの変更を push するために必要
    steps:
      - uses: actions/checkout@v4

      - name: Update Kubernetes manifest
        run: |
          sed -i "s/IMAGE_TAG/${{ github.sha }}/" k8s/deployment.yaml
          # ArgoCD が Git の変更を検知して自動デプロイ
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          # [skip ci] を付けないと、この push が同じワークフローを再発火させて無限ループする。
          # 既定トークンで push するには permissions: contents: write が要る
          git commit -am "Deploy ${{ github.sha }} [skip ci]"
          git push
```

<a id="section-21-3"></a>
### 21.3 マトリクスビルド ― 複数環境で同時にテスト
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"21.3"} -->
一つのOSやランタイムだけで成功しても、利用者や本番の組合せで失敗する可能性が残る。マトリクスビルドは差異を並列に検証する一方、組合せ爆発を避ける代表値の選択が必要になる。

複数のNode.jsバージョンや OS で並行にテストを走らせるパターン。

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false           # 1つ失敗しても他を続行
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
        exclude:
          - os: windows-latest    # 特定組み合わせを除外
            node: 18
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test
```

これで 3 OS × 3 Node バージョンから exclude の1件を除いた8ジョブが並列実行され、互換性問題を早期発見できる。ライブラリ開発では特に重要。

<a id="section-21-4"></a>
### 21.4 デプロイ戦略 ― それぞれの実装と使い分け
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"B","term":"Blue/Green デプロイ"} -->
<!-- handbook:index {"group":"C","term":"Canary リリース"} -->
<!-- handbook:index {"group":"F","term":"Feature Flag"} -->
<!-- handbook:index {"group":"R","term":"Recreate (デプロイ)"} -->
<!-- handbook:index {"group":"R","term":"Rolling Update"} -->
<!-- handbook:index {"group":"は行","term":"フィーチャフラグ"} -->

<!-- handbook:narrative-bridge {"section":"21.4"} -->
成果物が検証済みでも、全利用者を一度に新バージョンへ切り替えれば、未知の不具合が全面障害になる。デプロイ戦略は新旧をどの割合と時間で共存させ、観測結果を次の判断へ使うかを決める。

デプロイ方式は4種類が代表的だ。まず全体像を押さえてから、それぞれの実装を見ていく。

| 方式 | 新旧の共存 | ダウンタイム | 切り戻しの速さ | 追加で要るもの |
|---|---|---|---|---|
| Recreate | しない | あり (数秒〜数分) | 再デプロイと同じ | なし |
| Rolling Update | する (置き換えながら) | なし | 数分 (逆向きに置き換え) | 新旧が同時に動ける互換性 |
| Blue/Green | する (2面を並べる) | なし | 数秒 (切り替えを戻すだけ) | 2倍のリソース |
| Canary | する (一部の利用者だけ) | なし | 数秒 (割合を0へ) | 割合制御と、判定するための指標 |

選ぶときの軸は3つある。

1. **切り戻しにかけられる時間**: 障害に気づいてから戻すまでが長いほど、被害が大きくなる。決済のように影響の大きい機能ほど Blue/Green か Canary を選ぶ
2. **新旧が同時に動けるか**: Rolling と Canary は、新旧が同じデータベースを同時に読み書きする。列の削除やフォーマットの変更を伴う移行では、先に両方が読める状態を作る段階が要る (28.5)
3. **判定できる指標があるか**: Canary は「一部へ流して様子を見る」方式なので、様子を見る手段 (エラー率、遅延、業務指標) が無ければ意味がない。指標が無いなら Blue/Green の方が正直である

どの方式でも、切り戻しの手順を先に用意し、実際に一度戻してみるまでが「デプロイ戦略を決めた」ということである。

#### 21.4.1 Recreate (停止 → 起動)
<!-- handbook:learning {"level":"practical","minutes":15} -->

最も単純。旧バージョンを止めてから新バージョンを起動する。

```yaml
# Kubernetes
spec:
  strategy:
    type: Recreate
```

- **メリット**: 実装が単純、状態を持つアプリ向き
- **デメリット**: ダウンタイムあり (数秒〜数分)
- **使いどころ**: 開発環境、メンテナンス時間が許される社内ツール

#### 21.4.2 Rolling Update
<!-- handbook:learning {"level":"practical","minutes":15} -->

新バージョンの Pod を少しずつ起動し、起動したぶんだけ旧バージョンを停止する。Kubernetes のデフォルト戦略。

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%         # 一度に追加できる Pod 数 (元の25%増し)
      maxUnavailable: 0     # 利用不可になっていい Pod 数 (0 = 常に全部稼働)
```

- **メリット**: ダウンタイムなし、Kubernetes 標準でリソース効率も良い
- **デメリット**: 中間状態で新旧両方のバージョンが稼働 → DB スキーマ変更などに注意
- **使いどころ**: 大多数のステートレス Web サービス

**DB マイグレーションとの両立:**

Rolling Update 中は新旧バージョンが同時にDBを使う。つまり「**前方互換**」「**後方互換**」の両方が必要だ。

```text
[Day 1] 旧コード v1 → DB スキーマ v1
[Day 2] DB スキーマ v2 (v1 と v2 両方のコードが動く中間状態)
[Day 3] 新コード v2 デプロイ (Rolling Update 中、v1 と v2 が混在)
[Day 4] 全Pod v2 になる
[Day 5] DB スキーマ v3 (v2 だけが使う構造に整理)
```

「カラム削除」を例に取ると、

- BAD: 同じデプロイで `DROP COLUMN` + 新コード → 中間状態で旧コードが落ちる
- GOOD: 「コード側で使わなくする」→「次のリリースで `DROP COLUMN`」と2段階に分ける

#### 21.4.3 Blue/Green デプロイ
<!-- handbook:learning {"level":"practical","minutes":15} -->

新バージョン (Green) の環境を**フルセット**用意し、ロードバランサで一気にトラフィックを切り替える。

```bash
# 切り替え前
# blue 環境: v1 が稼働、全トラフィックを受ける
# green 環境: v2 が稼働、トラフィックなし(動作確認のみ)

# 切り替え (LB のターゲットグループを green に変更)
aws elbv2 modify-listener \
  --listener-arn $LISTENER \
  --default-actions Type=forward,TargetGroupArn=$GREEN_TG

# 問題があれば即ロールバック
aws elbv2 modify-listener \
  --listener-arn $LISTENER \
  --default-actions Type=forward,TargetGroupArn=$BLUE_TG
```

- **メリット**: 即ロールバック可能、本番同等の環境で事前検証ができる
- **デメリット**: コストが2倍 (2環境並行運用)、データベース移行が難しい
- **使いどころ**: ミッションクリティカルなサービス、リリース時間が厳格に決まっているもの

#### 21.4.4 Canary リリース
<!-- handbook:learning {"level":"practical","minutes":15} -->

新バージョンに**少量のトラフィック**から流し、徐々に比率を上げる。

```yaml
# Argo Rollouts での Canary 設定例
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: web-app
spec:
  strategy:
    canary:
      steps:
      - setWeight: 5     # まず5%
      - pause: { duration: 10m }   # 10分待って観察
      - setWeight: 20    # 20%に増やす
      - pause: { duration: 10m }
      - setWeight: 50
      - pause: { duration: 10m }
      - setWeight: 100   # 全部
      analysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: web-app
```

各ステップで自動的に成功率・レイテンシを評価し、悪化していれば**自動ロールバック**する。

- **メリット**: 影響範囲を限定しながら段階的に展開、A/Bテスト的にも使える
- **デメリット**: 仕組みが複雑、メトリクス収集とアラートが整っている前提
- **使いどころ**: スケールの大きなサービス、リスクが高い変更

#### 21.4.5 Feature Flag
<!-- handbook:learning {"level":"practical","minutes":15} -->

デプロイと機能リリースを分離する。コードは本番にあるが、フラグで ON/OFF を切り替える。

```typescript
// LaunchDarkly、Statsig、Flagsmith などの SaaS、または自前実装
if (await featureFlag.isEnabled('new-checkout-flow', { userId: user.id, orgId: user.orgId })) {
  return renderNewCheckout();
}
return renderOldCheckout();
```

```typescript
// 自前実装の最小例 (Redis ベース)
class FeatureFlags {
  constructor(private redis: Redis) {}

  async isEnabled(flag: string, ctx: { userId?: string; orgId?: string }): Promise<boolean> {
    // 1. 完全 ON/OFF
    const global = await this.redis.get(`flag:${flag}:global`);
    if (global === 'off') return false;
    if (global === 'on') return true;

    // 2. 組織単位の許可リスト
    if (ctx.orgId && await this.redis.sismember(`flag:${flag}:orgs`, ctx.orgId)) {
      return true;
    }

    // 3. パーセンテージロールアウト (一貫したハッシュで判定)
    const rolloutPercent = parseInt(await this.redis.get(`flag:${flag}:rollout`) ?? '0');
    if (ctx.userId && rolloutPercent > 0) {
      const hash = crypto.createHash('sha256').update(`${flag}:${ctx.userId}`).digest();
      const bucket = hash.readUInt32BE(0) % 100;
      return bucket < rolloutPercent;
    }

    return false;
  }
}
```

利用例:

```bash
# 5% のユーザーで有効化
redis-cli set flag:new-checkout-flow:rollout 5

# 問題発生 → 即座に全停止
redis-cli set flag:new-checkout-flow:global off

# 特定の組織だけ先行公開
redis-cli sadd flag:new-checkout-flow:orgs org_abc
```

- **メリット**: デプロイ後でも切り替え可能、A/Bテスト、緊急停止、内部ユーザー先行公開
- **デメリット**: フラグが残り続けると技術的負債に → 定期的に削除する
- **使いどころ**: 影響範囲の予測が難しい機能、A/Bテストしたいもの

<a id="section-21-5"></a>
### 21.5 ロールバック戦略
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"ら行","term":"ロールバック"} -->

<!-- handbook:narrative-bridge {"section":"21.5"} -->
段階配布で影響を限定しても、異常を検出した後に安全な状態へ戻れるとは限らない。ロールバックはアプリだけでなくDBスキーマ、メッセージ形式、外部副作用を含むため、roll-forwardとの選択を事前に設計する。

「**3分で本番を元に戻せるか?**」 ― これが運用力の試金石だ。

**戦略1: 1つ前のイメージを再デプロイ**

```bash
# Kubernetes
kubectl rollout undo deployment/web-app

# 特定リビジョンへ
kubectl rollout history deployment/web-app
kubectl rollout undo deployment/web-app --to-revision=42
```

**戦略2: Blue/Green の切り戻し** (LB のターゲット変更だけ、最速)

**戦略3: Feature Flag を OFF**

DB マイグレーション後の機能 ON/OFF を Flag で分離していれば、コードを戻さなくても無効化できる。

**ロールバックが難しいケース:**

- **破壊的なDB変更**: `DROP TABLE` 後はロールバックしても元に戻らない
- **外部APIへの不可逆操作**: メール送信、決済 など
- **長時間動いてしまったバグ**: データが汚染されている

これらは「**Forward Fix**」(問題を直す新バージョンを当てる) で対処することが多い。だからこそ、**破壊的変更は最後に、可逆な変更を先に** が原則。

<a id="section-21-6"></a>
### 21.6 デプロイ頻度と DORA メトリクス
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"D","term":"DORA メトリクス"} -->
<!-- handbook:index {"group":"は行","term":"復旧時間 (MTTR)"} -->

<!-- handbook:narrative-bridge {"section":"21.6"} -->
安全策を追加しても、変更が遅く失敗復旧に時間がかかるなら、プロセス全体は改善していない。DORAメトリクスは速度と安定性を対立させず、変更の流れと回復能力を結果から測る。

DevOps の成熟度を測る4指標 (DORA: DevOps Research and Assessment) [Forsgren et al., 2018]:

| 指標 | Elite | High | Medium | Low |
|---|---|---|---|---|
| デプロイ頻度 | 1日複数回 | 週1〜月1 | 月1〜半年1 | 半年1未満 |
| リードタイム | 1時間未満 | 1日〜1週間 | 1週間〜1ヶ月 | 1ヶ月以上 |
| 変更失敗率 | 5%以下 | 10%以下 | 15%以下 | 16%以上 |
| 復旧時間 (MTTR) | 1時間未満 | 1日未満 | 1日〜1週間 | 1週間以上 |

調査では、Elite 組織はビジネス成果でも他組織を大きく上回ることが報告されている。

**頻度を上げるには:**

- 小さな変更を頻繁に出す (大物リリースを避ける)
- CI/CD パイプラインの整備
- テストの自動化と高速化
- ロールバック容易性 (Feature Flag、Blue/Green)
- 信頼できる監視・アラート

CI/CD と次章の Observability への投資は、これら指標に直結する。

<a id="section-21-7"></a>
### 21.7 セマンティックバージョニングと変更ログ
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"Conventional Commits"} -->
<!-- handbook:index {"group":"さ行","term":"セマンティックバージョニング"} -->

<!-- handbook:narrative-bridge {"section":"21.7"} -->
頻繁に届けるには、利用者と他チームが互換性や影響を判断できる変更情報が必要になる。セマンティックバージョニングと変更ログは、技術的差分を契約上の意味へ翻訳する。

```text
MAJOR.MINOR.PATCH
  ↓     ↓     ↓
  破壊  追加  修正
```

- **MAJOR**: 後方非互換の変更
- **MINOR**: 後方互換の機能追加
- **PATCH**: バグ修正

ライブラリでは厳密に守る必要がある。アプリでは緩やかに運用 (リリース日でバージョニングなど) でも構わない。

**Conventional Commits:**

```text
feat: add user profile page
fix: prevent duplicate signups
docs: update README
refactor: extract auth middleware
chore: bump dependencies
```

これに従うと、変更ログとバージョン番号を自動生成できる (`semantic-release`、`changesets` 等)。CI で commit メッセージから自動的にバージョンを上げ、CHANGELOG.md を更新し、GitHub Release を作成する一連のパイプラインが組める。

CI/CD と次章の Observability への投資はここに直結する。

<a id="section-21-8"></a>
### 21.8 実装課題 ― CI/CD の動作原理を実装する
<!-- handbook:learning {"level":"practical","minutes":280} -->

<!-- handbook:narrative-bridge {"section":"21.8"} -->
既成CIを設定するだけでは、失敗時にどの段階で何を止めるべきかが見えにくい。実装課題で配布戦略と自動ロールバックを再現し、観測値が制御判断へ変わる流れを確かめる。

第21章では CI/CD パイプライン、GitHub Actions、デプロイ戦略 (Rolling/Blue-Green/Canary)、DORA メトリクスを見た。本節ではそれらの**実装の中身**を作る。所要時間: 演習カードの推定時間の合計で9時間。

#### 課題21.1: Blue-Green デプロイ実装 (★★★)

**目的**: ロードバランサのターゲットを瞬間切り替える Blue-Green の挙動を、リアルなプロセス操作で実装。

<!-- handbook:exercise:start {"id":"21.1"} -->
> **演習カード 課題21.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 21.4 デプロイ戦略 ― それぞれの実装と使い分け を読み、Blue-Green が2系統を同時に維持する戦略であることを押さえる
> - 21.5 ロールバック戦略 を読み、切り戻しがLBの向き先を戻すだけで済む条件を把握する
> - 18.7 ロードバランサ ― L4 vs L7 を読み、切替の対象がどこかを理解している
> - bash から node を起動し、JSONの状態ファイルを読み書きできる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] status が Active と Idle の2行を color と port と status 付きで表示する
> - [ ] deploy green v2 で green の version と status が更新され、ヘルスチェック通過の行が出る
> - [ ] idle 側が healthy でない状態で switch すると非ゼロ終了し is not healthy のエラーになる
> - [ ] switch 成功時に Switching の行と Done. New traffic goes to green. の行が出て、状態ファイルの active が更新される
> - [ ] アクティブなカラーに対する stop が cannot stop active color で拒否される
> - [ ] request が現在のアクティブカラーの color と version と port をJSONで返す
>
> **期待出力**
>
> - 初期状態の status が Active: blue (port 4001) - healthy と Idle: green (port 4002) - stopped の2行になる
> - deploy 前の switch は終了コード非ゼロで終わり、標準エラーに green is not healthy が出る
> - switch 後の request が color=green のJSONを返す
>
> **観察項目**
>
> - 状態ファイルを switch の前後で diff し、active フィールドだけが変わることを確認する
> - switch の前後で request を連続実行し、切替が1リクエスト単位で瞬時に起きて段階が無いことを確認する
> - 旧カラーを stop せずに残した場合、ロールバックが switch 1回で済むことを確認する
> - green を deploy せず stop のままで switch を試み、ヘルスチェックがガードとして機能することを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch21 run test` を実行し、blue-green refuses unhealthy switch and switches after deploy が通ることを確認する
> 2. 使い捨てディレクトリで `bash code/ch21/blue-green/solution/main.sh status` の後に deploy green v2 と switch を順に実行し、blue から green への切替行が出れば合格
> 3. `BLUE_GREEN_STATE=/tmp/bg.json bash code/ch21/blue-green/solution/main.sh switch` を deploy 前に実行し、終了コードが 0 以外になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 実サーバを立てる前に状態遷移だけを作る。active と2色分の port と version と status を持つJSONを1つ置き、サブコマンドでそれを読み書きする設計にする
> 2. **構造**: status と deploy と switch と stop と request の5サブコマンドに分け、switch では必ず切替先の status を確認してから active を書き換える。異常時は例外を投げて非ゼロ終了させる
> 3. **実装の要点**: ガードの順序が肝心で、active を書き換えてからヘルスチェックすると不健全な側へ流れる。またアクティブなカラーの stop を禁止しないと、無停止のはずが全断になる
>
> **本番利用時の警告**
>
> - この実装はヘルスチェックの成功を決め打ちしており、実際に新カラーへHTTPリクエストを送っていない。本番でこの形のまま切り替えると、起動しただけで接続を受けられないプロセスへ全トラフィックを流して全断になる
> - Blue-Green は切替時にDBスキーマが両バージョンから同時に使われる点を扱っていない。後方互換の無いマイグレーションを同時に流すと、切り戻し時に旧バージョンがデータを読めずロールバック不能になる
> - 状態ファイルにロックが無いため、複数人が同時に switch すると状態が壊れ、active と実際の向き先が食い違う
>
> **導線**
>
> - 開始地点: `code/ch21/blue-green/starter/main.sh`
> - 模範解答: `code/ch21/blue-green/solution/main.sh`
>
> **推定時間の内訳**: 状態ファイル設計とサブコマンド実装に55分、ヘルスチェックのガードと異常系に40分、実バックエンド2台を立てての切替確認に35分、ロールバック手順の記録に20分
<!-- handbook:exercise:end -->

**要件**:
- 2バックエンドを別ポートで起動可能 (blue: 4001, green: 4002)
- LB(8080) が現在のアクティブカラーを保持
- `switch` コマンドで blue ↔ green を切り替え
- 切替前にヘルスチェックで新カラーが healthy か確認

```bash
# 初期状態: blue がアクティブ
$ tsx blue-green-controller.ts status
Active: blue (port 4001) - healthy
Idle:   green (port 4002) - stopped

# 新バージョンを green として起動
$ tsx blue-green-controller.ts deploy green v2.0
Starting green on port 4002...
Health check passed (3 consecutive OK)

# トラフィックを切り替え
$ tsx blue-green-controller.ts switch
Switching: blue → green
Done. New traffic goes to green.

# 旧 blue を停止
$ tsx blue-green-controller.ts stop blue
```

模範解答: `code/ch21/blue-green/`

#### 課題21.2: Canary デプロイ実装 (★★★)

**目的**: トラフィック比率を段階的に新バージョンに振る Canary の実装。

<!-- handbook:exercise:start {"id":"21.2"} -->
> **演習カード 課題21.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 21.4 デプロイ戦略 ― それぞれの実装と使い分け を読み、Canary が比率で段階的に流す戦略であることを押さえる
> - 21.6 デプロイ頻度と DORA メトリクス を読み、変更失敗率という指標を押さえる
> - 課題21.1 の Blue-Green を先に実装し、状態ファイルでデプロイ状態を持つ形に慣れている
> - bash と node で状態JSONの読み書きができる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] shift に渡す比率が 0 から 100 の範囲で更新され、範囲外は shift must be 0..100 で拒否される
> - [ ] route が リクエスト番号を100で割った余りと比率の比較で stable か canary を返し、選ばれた側の requests とレイテンシを加算する
> - [ ] record-error canary でエラーが計上され、evaluate が canary のエラー率5%超で rollback 行を出し比率を0へ戻す
> - [ ] エラー率が閾値以下なら evaluate が healthy 行を出し、比率を変更しない
> - [ ] promote で stable のバージョンが canary のバージョンへ置き換わり、metrics が初期化される
> - [ ] start と status が stable と canary の現在比率を1行で返す
>
> **期待出力**
>
> - shift 10 の後の status が stable: 90% / canary: 10% を出す
> - canary に6件のエラーを記録してから evaluate すると rollback: canary error rate 100.00% の行が出る
> - promote 後の出力が stable が canary を取り込み100%になった旨の1行になる
>
> **観察項目**
>
> - route を100回呼び、canary が選ばれた回数が設定比率とほぼ一致することを確認する
> - 比率が小さいほど、同じエラー率を検出するのに必要なリクエスト数が増えることを件数を変えて確認する
> - 状態ファイルの metrics を見て、stable と canary で総レイテンシをリクエスト数で割った平均がどう違うかを比較する
> - エラー0件のまま evaluate を実行し、requests が0でもエラー率0として healthy になる危うさを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch21 run test` を実行し、canary rolls back on high error rate が通ることを確認する
> 2. 使い捨てディレクトリで `bash code/ch21/canary/solution/main.sh shift 50` の後に record-error canary を6回実行し、`bash code/ch21/canary/solution/main.sh evaluate` が rollback を出せば合格
> 3. `CANARY_STATE=/tmp/canary.json bash code/ch21/canary/solution/main.sh route 7` を番号を変えて複数回実行し、比率どおりに分かれることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「比率で振り分ける」と「メトリクスで判定する」を別サブコマンドに分ける。判定は蓄積した requests と errors だけを見る計算にする
> 2. **構造**: 状態は比率と、stable と canary それぞれの requests と errors と総レイテンシを持つJSONで足りる。route はリクエスト番号を100で割った余りと比率の比較にすると決定的でテストしやすい
> 3. **実装の要点**: evaluate の閾値判定で requests が0のときのゼロ除算を避けること。またロールバック時に比率を0へ戻すだけでなく、記録済みメトリクスを残すか捨てるかを決めないと次の判定が汚染される
>
> **本番利用時の警告**
>
> - エラー率の判定に最小サンプル数を設けていないため、canary に数リクエストしか流れていない段階で1件のエラーが出ると即ロールバックし、逆に0件なら常に healthy と判定する。本番では最小観測数や SLO burn rate で判断する
> - 振り分けがリクエスト番号ベースのため同一ユーザーが stable と canary を行き来する。セッションやキャッシュの整合が崩れて利用者に断続的な不整合を見せるので、実運用ではユーザーIDのハッシュで固定する必要がある
> - canary が新しいマイグレーションを必要とする場合、stable と canary が同一DBを共有するため片方が壊れる。スキーマ変更は両バージョン互換にしてから流す
>
> **導線**
>
> - 開始地点: `code/ch21/canary/starter/main.sh`
> - 模範解答: `code/ch21/canary/solution/main.sh`
>
> **推定時間の内訳**: 状態設計と shift と route の実装に50分、メトリクス収集と evaluate の閾値判定に45分、promote とロールバック経路の検証に35分、比率の分布確認に20分
<!-- handbook:exercise:end -->

**要件**:
- 旧 (stable) と新 (canary) バックエンドを起動
- LB はリクエストごとに比率で振り分け
- メトリクス収集: 各バージョンのエラー率、レイテンシ
- エラー率上昇で自動ロールバック

```bash
$ tsx canary-controller.ts start
stable: 100% / canary: 0%

$ tsx canary-controller.ts shift 10
stable: 90% / canary: 10%
# 10分観察 → エラー率変化なし

$ tsx canary-controller.ts shift 50
stable: 50% / canary: 50%

$ tsx canary-controller.ts promote
stable ← canary (100% traffic)
```

模範解答: `code/ch21/canary/`

#### 課題21.3: GitHub Actions ワークフロー生成器 (★★)

**目的**: package.json / プロジェクト構成から GitHub Actions YAML を自動生成する CLI。

<!-- handbook:exercise:start {"id":"21.3"} -->
> **演習カード 課題21.3** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 21.2 GitHub Actions を読み、on と jobs と steps と uses の構造を押さえる
> - 21.3 マトリクスビルド ― 複数環境で同時にテスト を読み、strategy.matrix の展開を把握する
> - package.json の scripts を読み取って条件分岐する処理を書ける
> - 生成先の .github/workflows ディレクトリを作成できる権限がある
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] detectProject が package.json のあるディレクトリで node 種別と lint / test / build の有無を返す
> - [ ] pyproject.toml のみのディレクトリで python 種別を返し、どちらも無ければ Node.js or Python project not found を投げる
> - [ ] generateWorkflow の Node 版が strategy.matrix の node へ指定バージョン配列を展開する
> - [ ] scripts に lint が無いプロジェクトでは npm run lint の行が生成されない
> - [ ] writeWorkflow が .github/workflows/ci.yml を作成し、そのパスを返す
> - [ ] 生成したYAMLが actionlint もしくは GitHub 上で構文エラーにならない
>
> **期待出力**
>
> - lint と test と build を持つプロジェクトで node: [20, 22] の行と、npm ci / npm run lint / npm test / npm run build の4ステップが出力される
> - Python プロジェクトでは setup-python と ruff check と pytest を含むワークフローが返る
> - 出力されるYAMLが name: CI と on: [push, pull_request] で始まる
>
> **観察項目**
>
> - 生成したYAMLを実際のリポジトリへ置いて push し、Actions のジョブ一覧がマトリクスの数だけ並ぶことを確認する
> - cache 指定を外した場合と付けた場合で、依存インストールの所要時間の差を Actions のログで比較する
> - scripts から build を消して再生成し、生成されるステップ数が減ることを diff で確認する
> - actions のバージョン指定がタグであり、コミットSHAで固定されていないことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch21 run test` を実行し、workflow generator detects scripts and renders matrix が通ることを確認する
> 2. code/ch21 で `tsx --test solutions.test.ts` を実行し、生成YAMLが node: [20, 22] と npm run lint を含むことを確認する
> 3. `npx actionlint .github/workflows/ci.yml` を実行するか GitHub へ push してジョブが起動すれば構文として合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「検出」と「生成」を分ける。検出は小さな構造体を返すだけにし、生成はその構造体からテンプレート文字列を組み立てる純関数にする
> 2. **構造**: 検出は package.json を先に、次に pyproject.toml を stat して判定する。生成側は steps を配列で組み立ててから改行で結合すると、条件付きステップの追加が簡単になる
> 3. **実装の要点**: YAMLはインデントが意味を持つためテンプレート文字列内の空白数を揃えること。matrix 変数の参照はテンプレートリテラル内でドル記号をエスケープしないと、JavaScript の式として評価されてしまう
>
> **本番利用時の警告**
>
> - 生成されるワークフローは permissions を指定していないため、リポジトリデフォルトの広い GITHUB_TOKEN 権限で動く。pull_request トリガーと組み合わせるとフォークからのPRへ意図しない権限が渡る恐れがあるので、本番では contents: read を明示する
> - actions をタグで参照しているとタグは可変であり、上流が乗っ取られると任意コードがCIで実行される。実運用ではコミットSHAでピン留めし、Dependabot で更新する
> - 生成物を既存の .github/workflows/ci.yml へ無確認で上書きするため、手で調整したワークフローを失う。実行前に差分を確認する手順を挟む
>
> **導線**
>
> - 開始地点: `code/ch21/workflow-generator.ts`
> - 模範解答: `code/ch21/workflow-generator.solution.ts`
>
> **推定時間の内訳**: 検出ロジックの実装に25分、Node と Python の2種のテンプレート生成に35分、生成YAMLの構文検証と実リポジトリでの起動確認に30分
<!-- handbook:exercise:end -->

**要件**:
- Node.js プロジェクト / Python プロジェクトを検出
- テスト、ビルド、Linter のジョブを自動構成
- マトリクスビルド (Node 18, 20, 22) 対応
- 出力先: `.github/workflows/ci.yml`

```bash
$ tsx generate-workflow.ts ./my-project --node-versions 18,20,22
Generated .github/workflows/ci.yml:
  - install
  - lint
  - test (matrix)
  - build
```

模範解答: `code/ch21/workflow-generator.solution.ts`

#### 課題21.4: 自動ロールバック付きパイプライン (★★★)

**目的**: 「デプロイ → 監視 → エラー率上昇で自動ロールバック」の一連を実装。

<!-- handbook:exercise:start {"id":"21.4"} -->
> **演習カード 課題21.4** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 21.5 ロールバック戦略 を読み、自動切り戻しの判断材料と条件を押さえる
> - 21.6 デプロイ頻度と DORA メトリクス を読み、変更失敗率と平均復旧時間の関係を把握する
> - 課題21.1 または課題21.2 でデプロイ切替の操作を実装済みである
> - TypeScript の interface でアダプタを定義し、テスト用の実装へ差し替えられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] PipelineAdapter が currentVersion と deploy と rollback と metrics の4メソッドを持つ interface として定義されている
> - [ ] deploy がデプロイ前のバージョンを記録し、観測後の結果を status と errorRate と previous の3キーで返す
> - [ ] エラー率が閾値を超えたときに rollback が呼ばれ status が rolled-back になる
> - [ ] 閾値以下なら status が healthy となりロールバックが呼ばれない
> - [ ] requests が0のときにエラー率が0として扱われ、ゼロ除算しない
> - [ ] テスト用アダプタの history に deploy と rollback が実行順で記録される
>
> **期待出力**
>
> - requests=100 かつ errors=6 で閾値0.05のとき status が rolled-back、errorRate が 0.06、バージョンが v1 に戻る
> - requests=100 かつ errors=0 のとき status が healthy、errorRate が 0 でバージョンは v2 のまま
> - history 配列が deploy:v2 と rollback:v1 の順で並ぶ
>
> **観察項目**
>
> - 閾値をちょうど 0.06 にして、判定が「超えたら」か「以上なら」かで結果が変わることを確認する
> - 観測窓を短くして、窓が短いとノイズで誤ロールバックしやすくなることをエラーを散らしたメトリクスで確認する
> - rollback 自体が失敗した場合に例外が伝播し、パイプラインが不整合な状態で止まることを確認する
> - 課題21.1 の blue-green スクリプトをアダプタの実装として差し込み、実際に active カラーが戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch21 run test` を実行し、pipeline rolls back when threshold is exceeded が通ることを確認する
> 2. code/ch21 で `tsx --test solutions.test.ts` を実行し、requests=100 errors=6 で status が rolled-back、バージョンが v1 になることを確認する
> 3. errors を 4 に変えて同じ流れを実行し status が healthy になれば、境界判定が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 「デプロイする手段」と「判断するロジック」を分離する。判断側は数値しか見ないので、実デプロイをアダプタの裏に隠せばテストが一瞬で終わる
> 2. **構造**: アダプタに currentVersion と deploy と rollback と metrics を定義し、パイプラインはその4つを順に呼ぶだけにする。テスト用にメトリクスを固定で返すメモリ内実装を用意する
> 3. **実装の要点**: デプロイ前に previous を取得しておかないとロールバック先が分からなくなる。現在バージョン取得、デプロイ、観測、判定、必要なら rollback の順序を厳守する
>
> **本番利用時の警告**
>
> - 1回だけメトリクスを取って判定するため、デプロイ直後のウォームアップ由来のエラーを本物の障害と誤判定して不要なロールバックを起こす。本番では観測窓を複数回サンプリングし、連続超過で初めて発火させる
> - 自動ロールバックは「バージョンを戻せば復旧する」前提に立っている。破壊的なマイグレーションや外部への副作用 (メール送信、決済) を伴うデプロイでは戻しても復旧せず、状態が壊れたまま残る。ロールバック不能な変更は自動化の対象から外す
> - ロールバック処理自体の失敗を検知して通知する経路が無いため、切り戻しに失敗した障害が誰にも気づかれない
>
> **導線**
>
> - 開始地点: `code/ch21/auto-rollback.ts`
> - 模範解答: `code/ch21/auto-rollback.solution.ts`
>
> **推定時間の内訳**: アダプタ interface とパイプラインの実装に45分、閾値判定と境界テストに40分、メモリ内実装とテスト整備に35分、実デプロイ手段との接続確認に30分
<!-- handbook:exercise:end -->

**要件**:
- 簡易な「デプロイ + メトリクス監視」ループ
- 設定: error_rate_threshold = 5%、observation_window = 60s
- 閾値超え検知で旧バージョンに切り戻し

```typescript
const pipeline = new DeploymentPipeline({
  errorRateThreshold: 0.05,
  observationWindowSec: 60,
});

await pipeline.deploy('v2.1.0', async () => {
  // 実際のデプロイ処理(blue-green の switch 等)
});

// 監視 → エラー率閾値超 → 自動ロールバック
```

模範解答: `code/ch21/auto-rollback.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":21} -->
### 第21章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第21章の模範解答をまとめて検証する
pnpm --filter @handbook/ch21 run test

# 模範解答を個別に実行する
bash code/ch21/blue-green/solution/main.sh                            # 課題21.1
bash code/ch21/canary/solution/main.sh                                # 課題21.2
pnpm --filter @handbook/ch21 exec tsx workflow-generator.solution.ts  # 課題21.3
pnpm --filter @handbook/ch21 exec tsx auto-rollback.solution.ts       # 課題21.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch21/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

ここまでで、変更を同じパイプラインから段階的に届け、問題時に戻す仕組みを作った。しかし、デプロイ成功後の本番が利用者にとって正常かは、実行結果を観測しなければ判断できない。第22章では、利用者影響から個々の要求と実行事象へ辿る可観測性を扱う。

<a id="chapter-22"></a>
## 第22章 可観測性 (Observability)

第21章で、変更を検証し、段階的に配布し、問題があれば戻す仕組みを作った。しかし、デプロイが成功したという事実は、利用者の要求が速く正しく完了していることを保証しない。未知の組み合わせで障害が起きたとき、CPU率など事前に決めた監視項目だけでは、どの変更がどの要求を壊したかを説明できない。

本章では、ログ、メトリクス、トレースを別々のツールではなく、利用者影響から実行経路と具体的事象へ掘り下げる観測モデルとして扱う。SLI (Service Level Indicator) と SLO で正常の基準を定め、アラート、オンコール、ポストモーテムまでを改善ループへつなぐ。第VI部では、この運用フィードバックを使い、セキュリティ、性能、テスト、アーキテクチャという品質を設計段階から組み込む。

<!-- handbook:chapter-guide:start {"chapter":22} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 本番障害で「何が起きたか分からない」状態を避け、利用者影響から原因候補へ短時間で到達できる情報を設計する。
>
> **到達目標**
> - ログ、メトリクス、トレース、プロファイルの役割を説明できる。
> - SLI/SLOとアラートを利用者影響へ結び付けられる。
> - request IDとtrace contextでサービス横断調査ができる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [18.9 トラブルシュート用コマンド集](#section-18-9) ― OS/ネットワークの診断
> - [21.1 CI/CD の意味](#section-21-1) ― 変更の流れ
>
> **中核概念**  
> [22.1 Monitoring と Observability の違い](#section-22-1)、[22.2 Three Pillars of Observability](#section-22-2)、[22.3 構造化ログ (Structured Logging)](#section-22-3)、[22.6 メトリクス](#section-22-6)、[22.7 SLI / SLO / SLA](#section-22-7)、[22.8 分散トレース ― マイクロサービスを追う](#section-22-8) (実務選択)
>
> **最小実装**  
> [22.11 実装課題 ― 可観測性の3本柱を自作する](#section-22-11) (実務選択)
>
> **本番実装との差分**
> - 自作観測基盤は保存、sampling、cardinality制御、個人情報保護、可用性、費用管理を省略する。
>
> **典型的な失敗**
> - ログへ秘密情報を出す。
> - 高cardinalityラベルで費用と性能を悪化させる。
> - 原因指標だけをアラートし利用者影響を見ない。
>
> **診断・デバッグ方法**
> - 変更時刻、SLO、RED/USE指標、trace、ログを同じ時間軸で調べる。
> - 仮説ごとに追加観測を決める。
>
> **意思決定チェックリスト**
> - 利用者の成功を何で測るか。
> - どの情報を事後に問える必要があるか。
> - 保持期間と費用をどう制御するか。
>
> **演習と評価基準**  
> 対象: [22.11 実装課題 ― 可観測性の3本柱を自作する](#section-22-11) (実務選択)
> - 故障を注入し、メトリクスからtraceとログへ辿って原因を特定できる。
>
> **一次資料・発展資料**
> - OpenTelemetry specifications
> - Google SRE books
> - Prometheus documentation
<!-- handbook:chapter-guide:end -->

<a id="section-22-1"></a>
### 22.1 Monitoring と Observability の違い
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"22.1"} -->
CI/CDが正常終了しても、本番で未知の入力や依存障害が起きる可能性は残る。MonitoringとObservabilityを分けることで、既知条件の検出と、事後に新しい問いを立てて調査する能力を整理する。

- **Monitoring**: 既知の問題を**監視**する (CPU使用率がX%超えたらアラート)
- **Observability**: 未知の問題を**調査**できる状態 (任意の質問を後から問える)

両者は補完関係。Monitoring だけでは「想定外の問題」を発見できない。

<a id="section-22-2"></a>
### 22.2 Three Pillars of Observability
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"22.2"} -->
未知の問いへ答えるには、一種類の数値だけでなく、出来事、集計された傾向、要求の経路を対応づける必要がある。ログ、メトリクス、トレースの三本柱を、同じ事象を見る異なる解像度として扱う。

1. **Logs (ログ)**: 個別のイベント記録
2. **Metrics (メトリクス)**: 数値の時系列データ
3. **Traces (トレース)**: 1リクエストの処理経路

これに **Profiles** (CPU/メモリのプロファイル) を加えて4本目の柱として扱う実装もある。柱の数え方は製品や文献で揺れるので、名前より「何が事後に問えるか」で見るとよい。

<a id="section-22-3"></a>
### 22.3 構造化ログ (Structured Logging)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"か行","term":"構造化ログ"} -->

<!-- handbook:narrative-bridge {"section":"22.3"} -->
自由文ログは人には読めても、サービス横断検索や集計では項目を安定して取り出せない。構造化ログは時刻、主体、request ID、結果をフィールド化し、事象を機械的に関連づける。

```typescript
// BAD: パースできないテキストログ
console.log(`User 42 logged in from 192.168.1.1 at ${new Date()}`);

// GOOD: 構造化ログ (JSON)。IPとUAは原文のまま残さない
logger.info({
  event: 'user_login',
  userId: '42',
  ipPrefix: maskIp(req.ip),                          // 下位オクテットを落とす
  userAgentHash: hashUserAgent(req.headers['user-agent']),  // 鍵付きハッシュ
  timestamp: new Date().toISOString(),
});
```

JSON出力なら、ログ収集システムが各フィールドでフィルタ・集計できる。

この例が `ip` と `userAgent` を原文のまま持たないのには理由がある。IPアドレスとUser-Agentは、多くの法域で個人データとして扱われる。構造化されていることと、そのまま保存してよいことは別である。ログは出力先が増えやすく、放置すると個人データの複製装置になる (14.25)。出す項目は許可リストで決め、IPは下位オクテットを落とす、UAは鍵付きハッシュにするなど、障害調査に必要な粒度まで落としてから記録する。保持期間も同時に決める。調査のために完全なIPが要る場合は、対象と期間を限った別系統へ短期保持する。

```typescript
// pino (高速な Node.js logger)
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Express ミドルウェア
import pinoHttp from 'pino-http';
app.use(pinoHttp({ logger }));

app.get('/users/:id', (req, res) => {
  req.log.info({ userId: req.params.id }, 'Fetching user');
  // ...
});
```

<a id="section-22-4"></a>
### 22.4 ログレベル
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"ら行","term":"ログレベル"} -->

<!-- handbook:narrative-bridge {"section":"22.4"} -->
構造化しても、すべての詳細を常時出力すれば費用とノイズが増え、重大事象が埋もれる。ログレベルは事象の重要度と利用目的を契約化し、平常時と調査時の情報量を制御する。

- **TRACE**: 超詳細 (普段は無効)
- **DEBUG**: 開発時の詳細情報
- **INFO**: 通常の動作 (起動、リクエスト、重要イベント)
- **WARN**: 想定外だが致命的ではない
- **ERROR**: エラー (例外、失敗)
- **FATAL**: 致命的、即座に停止すべき

本番は INFO 以上、開発は DEBUG が標準。

<a id="section-22-5"></a>
### 22.5 集中ログ管理
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"さ行","term":"集中ログ管理"} -->

<!-- handbook:narrative-bridge {"section":"22.5"} -->
各ホストのログを個別に見る方式では、短命コンテナや複数サービスをまたぐ要求を時系列で追えない。集中ログ管理は収集、転送、索引、保持を共通化し、検索可能な履歴へ変える。

複数のサーバから集めて1箇所で検索。

- **ELK スタック**: Elasticsearch + Logstash + Kibana
- **EFK**: ES + Fluentd + Kibana
- **Loki + Grafana**: 軽量・低コスト
- **Datadog**: マネージド
- **CloudWatch Logs**: AWS純正

<a id="section-22-6"></a>
### 22.6 メトリクス
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"P","term":"Prometheus"} -->
<!-- handbook:index {"group":"U","term":"USE メソッド"} -->
<!-- handbook:index {"group":"は行","term":"ヒストグラム"} -->
<!-- handbook:index {"group":"ま行","term":"メトリクス"} -->

<!-- handbook:narrative-bridge {"section":"22.6"} -->
ログは具体的事象に強いが、全要求の傾向や変化点を低コストで把握するには不向きである。メトリクスは値を時間系列として集約し、率、分位点、飽和度から異常の広がりを捉える。

時系列の数値データ。収集と可視化には Prometheus と Grafana の組み合わせが広く使われる。

**メトリクスの4タイプ:**

- **Counter**: 単調増加 (リクエスト数、エラー数)
- **Gauge**: 上下する値 (CPU使用率、現在のコネクション数)
- **Histogram**: 分布 (レスポンスタイム、リクエストサイズ)
- **Summary**: 集約値 (パーセンタイル)

```typescript
// prom-client (Node.js)
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

// ミドルウェア
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path ?? 'unknown', status: res.statusCode });
  });
  next();
});

// Prometheus がスクレイプするエンドポイント
// 注意: /metrics は内部情報の塊である。プロセスの版と資源使用量、内部ルートの一覧、
// エラーの分布が読める。アプリの公開ポートへ無認証で生やすと、そのまま外部から読まれる。
// 別ポート (9100 など) でリッスンしてスクレイパからのみ到達できるようにするか、
// 公開ポートに置くならロードバランサの経路から除外し、bearer token か mTLS を要求する
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**RED メソッド (リクエストベースサービス向け):**

- **Rate**: 秒間リクエスト数
- **Errors**: 秒間エラー数
- **Duration**: レスポンスタイム分布

**USE メソッド (リソースベース向け):**

- **Utilization**: 使用率
- **Saturation**: キュー (待ち) の長さ
- **Errors**: エラー数

Webアプリは RED、インフラリソースは USE で見るのが定番。

<a id="section-22-7"></a>
### 22.7 SLI / SLO / SLA
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"S","term":"SLI/SLO/SLA"} -->
<!-- handbook:index {"group":"あ行","term":"エラーバジェット"} -->

<!-- handbook:narrative-bridge {"section":"22.7"} -->
メトリクスが多くても、どの値なら利用者にとって正常かを決めなければ、改善とアラートの基準にならない。SLI、SLO、SLA (Service Level Agreement) は観測値を期待品質、内部目標、外部契約へ段階的に結び付ける。

- **SLI (Service Level Indicator)**: 計測する指標 (可用性、レイテンシなど)
- **SLO (Service Level Objective)**: 内部目標 (99.9% など)
- **SLA (Service Level Agreement)**: 顧客との契約 (達成しないと返金など)

SLO は SLA より厳しく設定する (バッファを持つ)。

**エラーバジェット:**

「99.9% 可用性」は「0.1% のエラー (=月43分のダウン) は許容」を意味する。これを「**エラーバジェット**」と呼ぶ。バジェットを使い切ったら、新機能リリースを止めて安定化に専念する ― これがSREの本質。

<a id="section-22-8"></a>
### 22.8 分散トレース ― マイクロサービスを追う
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"O","term":"OpenTelemetry"} -->
<!-- handbook:index {"group":"は行","term":"分散トレース"} -->

<!-- handbook:narrative-bridge {"section":"22.8"} -->
SLO違反を検出しても、複数サービスのどこで時間や失敗が発生したかは集計値だけでは分からない。分散トレースは一つの要求をspanの因果関係として追い、サービス境界を越えた待ち時間と失敗位置を示す。

マイクロサービスでは、1リクエストが複数サービスを跨ぐ。どこが遅いか分からない。

```text
[Frontend] → [API Gateway] → [User Service] → [DB]
                            ↓
                          [Notification Service] → [Mail Server]
                            ↓
                          [Analytics Service] → [Queue]
```

**OpenTelemetry** は分散トレースのオープン標準。

```typescript
import { trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'user-service',
});
sdk.start();

// 任意の処理にスパンを追加
const tracer = trace.getTracer('user-service');

async function processOrder(orderId: string) {
  await tracer.startActiveSpan('processOrder', async (span) => {
    span.setAttribute('order.id', orderId);
    try {
      await chargePayment(orderId);
      await updateInventory(orderId);
      await sendConfirmation(orderId);
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });  // @opentelemetry/api から import する
      throw e;
    } finally {
      span.end();
    }
  });
}
```

可視化は Jaeger、Tempo、Datadog、Honeycomb など。1リクエストの処理経路がガントチャートで見える。

<a id="section-22-9"></a>
### 22.9 アラート設計
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"あ行","term":"アラート設計"} -->

<!-- handbook:narrative-bridge {"section":"22.9"} -->
観測データから異常を見つけられても、通知が多すぎれば無視され、少なすぎれば利用者影響を見逃す。アラートは原因候補ではなく行動可能な影響へ結び付け、時間窓とerror budgetで緊急度を決める。

**良いアラートの条件:**

- 行動可能 (起きたら何をすべきか明確)
- 緊急性がある (寝てる人を起こす価値がある)
- ノイズが少ない (誤検知が少ない)

**悪いアラート:**

- CPU 80% でアラート → 正常な高負荷でも飛ぶ
- HTTP 500 が1件発生でアラート → ノイズ過多

**SLO ベースのアラート (推奨):**

「エラーバジェットの消化が早すぎる」でアラート。

```text
Burn rate: 過去1時間のエラー率 / 許容エラー率
  → 2倍以上で WARN
  → 14.4倍以上 (30日分のバジェットを約2日で消費) で CRITICAL
```

これなら「ちょっと多めのエラー」では起きず、本当に異常なときだけ呼び出される。

<a id="section-22-10"></a>
### 22.10 オンコールとポストモーテム
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"あ行","term":"オンコール"} -->
<!-- handbook:index {"group":"は行","term":"ポストモーテム"} -->

<!-- handbook:narrative-bridge {"section":"22.10"} -->
適切なアラートでも、誰が受け、どう判断し、再発防止へ戻すかがなければ同じ障害を繰り返す。オンコールとポストモーテムは個人の注意力に依存せず、検知、対応、学習を組織的なループにする。

サービス運用には**オンコール**(待機当番) が必要。深夜2時に呼び出される。これを健全に運用するには:

- ローテーション (毎週交代)
- 適切な引き継ぎ
- アラートの厳選 (ノイズの撲滅)
- 振り返り (継続改善)

**ポストモーテム** (Post-mortem): 障害発生後の振り返り。Google SRE Book [Beyer et al., 2016] が普及させた文化。

**書く内容:**

- 何が起きたか (タイムライン)
- 影響範囲 (ユーザー数、期間、ビジネス影響)
- 根本原因
- なぜ早く気づけなかったか
- なぜ早く解決できなかったか
- 再発防止策

**Blameless (非難なし):**

「Aさんがミスした」ではなく「**この種類のミスが起きうる設計だった**」と書く。個人の責任にすると、次回隠す動機になる。

<a id="section-22-11"></a>
### 22.11 実装課題 ― 可観測性の3本柱を自作する
<!-- handbook:learning {"level":"practical","minutes":250} -->

<!-- handbook:narrative-bridge {"section":"22.11"} -->
ログ、メトリクス、トレースを別々に出すだけでは、同じ要求へ相互に辿れない。実装課題では共通コンテキストとSLO判定を組み込み、故障注入から原因特定までの観測経路を確認する。

第22章ではログ・メトリクス・トレース・アラート・ポストモーテムを見た。本節ではそれぞれを自作し、Prometheus / OpenTelemetry / Datadog 等のライブラリが裏で何をやっているかを理解する。所要時間: 演習カードの推定時間の合計で8時間。

#### 課題22.1: 構造化ログライブラリ自作 (★★)

**目的**: pino / winston 風のロガーを実装。JSON 出力、コンテキスト伝播、ログレベル制御。

<!-- handbook:exercise:start {"id":"22.1"} -->
> **演習カード 課題22.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 22.3 構造化ログ (Structured Logging) を読み、1行1JSONのログが検索でどう扱われるかを押さえる
> - 22.4 ログレベル を読み、debug と info と warn と error の使い分けを把握する
> - node:async_hooks の AsyncLocalStorage が非同期呼び出しをまたいで値を保持することを知っている
> - JSON.stringify が Error オブジェクトを空オブジェクトにしてしまう問題を知っている
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] createLogger が debug と info と warn と error と child の5メソッドを持つロガーを返す
> - [ ] 設定レベルより低い重みのログが出力関数へ渡らない (level=info のとき debug は0行)
> - [ ] child で作った子ロガーの出力に親から渡したフィールドが必ず含まれる
> - [ ] withContext で包んだ内側で出したログに traceId が自動付与される
> - [ ] fields に Error を渡すと name と message と stack の3キーへ展開されて出力される
> - [ ] 1回の呼び出しで出るのは改行を含まないJSON1行である
>
> **期待出力**
>
> - 出力JSONが timestamp と level と service と msg に加え、base と非同期コンテキストと呼び出し時 fields をこの順でマージした結果になる
> - level=info の設定で debug を呼ぶと出力関数が呼ばれず行数が増えない
> - error フィールドの stack に元の例外メッセージが含まれる
>
> **観察項目**
>
> - child を2段重ねて、親から孫までのフィールドが後勝ちでマージされる順序を確認する
> - 同名キーを base と withContext と fields の3か所に置き、どれが最終的に残るかで優先順位を確認する
> - await を挟む関数の中でログを出し、withContext のコンテキストが維持されることを確認する
> - 出力を `jq .level` へパイプし、全行が機械処理できるJSONになっていることを確認する
> - pino の出力と並べ、level が数値か文字列かなどフィールド設計の違いを比較する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch22 run test` を実行し、logger filters levels and merges child/async context が通ることを確認する
> 2. code/ch22 で `tsx --test solutions.test.ts` を実行し、出力1行に requestId と traceId が含まれ error.stack が例外メッセージを含むことを確認する
> 3. 自作の呼び出しスクリプトの出力を `jq .` へ通し、全行が妥当なJSONとしてパースできれば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: ログレベルは「数値の重み比較」に落とすと一撃で書ける。まずレベルフィルタとJSON1行出力だけを作り、コンテキストは後から足す
> 2. **構造**: レベルごとの重みを辞書で持ち、child は base フィールドをマージした新しいロガーを返す再帰的な生成関数にする。リクエストスコープは AsyncLocalStorage の run と getStore で受け渡す
> 3. **実装の要点**: Error は JSON.stringify で空オブジェクトになるため、fields を走査して instanceof Error のものだけ name と message と stack へ変換する。マージ順は base、非同期コンテキスト、呼び出し時 fields の順にしないとその場の指定が上書きされる
>
> **本番利用時の警告**
>
> - このロガーはフィールドを無検査でそのまま出力するため、リクエストボディやヘッダを渡すとパスワードや Cookie やトークンがログ基盤へ平文で流れ込む。本番では機密キーのマスク設定を必須にする
> - 出力が同期のため大量出力時にプロセスがI/O待ちでブロックする。出力量の上限もサンプリングも無くログ課金が跳ね上がるので、本番では pino のような非同期でバッファリングする実装を使う
> - 改行を含む文字列をそのまま入れると1行1JSONの前提が崩れ収集側のパーサが壊れる。値の長さ制限も併せて掛ける
>
> **導線**
>
> - 開始地点: `code/ch22/logger.ts`
> - 模範解答: `code/ch22/logger.solution.ts`
>
> **推定時間の内訳**: レベルフィルタとJSON出力の実装に25分、child と AsyncLocalStorage のマージ実装に35分、Error シリアライズと出力検証に30分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const logger = createLogger({ level: 'info', service: 'api' });

logger.info('user logged in', { userId: '123', ipPrefix: '1.2.3.0/24' });
// {"timestamp":"2026-05-22T...","level":"info","service":"api","msg":"user logged in","userId":"123","ipPrefix":"1.2.3.0/24"}

logger.error('db error', { error: new Error('connection refused') });

// 子ロガーでコンテキスト追加
const reqLogger = logger.child({ requestId: 'r-abc' });
reqLogger.info('processing');  // → requestId が自動で出る

// AsyncLocalStorage 経由のリクエストスコープ
withContext({ traceId: 't-xyz' }, () => {
  logger.info('downstream call');  // → traceId が自動付与
});
```

**評価基準**:
- ログレベル別の閾値制御
- 子ロガー (`.child()`) で親コンテキスト継承
- AsyncLocalStorage でリクエスト跨ぎコンテキスト
- エラーオブジェクトを stack trace 含めシリアライズ

模範解答: `code/ch22/logger.solution.ts`

#### 課題22.2: Prometheus 風メトリクスサーバ (★★★)

**目的**: Counter / Gauge / Histogram を自作し、`/metrics` HTTP エンドポイントで公開。

<!-- handbook:exercise:start {"id":"22.2"} -->
> **演習カード 課題22.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 22.6 メトリクス を読み、Counter と Gauge と Histogram の使い分けを押さえる
> - 22.2 Three Pillars of Observability を読み、メトリクスがログやトレースと何を分担するかを把握する
> - Prometheus のテキスト公開形式 (HELP 行、TYPE 行、名前とラベルと値の行) を見たことがある
> - node:http でHTTPサーバを立て、ポート0で空きポートを取得できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] MetricRegistry が counter と gauge と histogram の3ファクトリを持ち、登録したメトリクスを expose() でまとめて出力する
> - [ ] Counter の inc に負値を渡すと counter cannot decrease で例外になる
> - [ ] Gauge が set と inc と dec に対応し、ラベルごとに独立した値を保持する
> - [ ] Histogram が buckets を昇順に整列し、le ラベル付きの bucket 行と sum 行と count 行を出力する
> - [ ] expose() の出力が各メトリクスにつき HELP 行、TYPE 行、値行の順に並ぶ
> - [ ] serve() が起動し GET /metrics が text/plain で本文を返し、他のパスが 404 を返す
>
> **期待出力**
>
> - counter の出力行が `requests_total{method="GET"} 1` の形式になる
> - histogram では le ごとの bucket 行に加えて +Inf の行、sum 行、count 行が出て、+Inf の値と count が一致する
> - `curl -s http://127.0.0.1:9100/metrics` の本文に HELP と TYPE のコメント行が含まれ、Content-Type が text/plain になる
>
> **観察項目**
>
> - /metrics を2回叩き、Counter が単調増加し Gauge が上下することを確認する
> - 同じメトリクス名に異なるラベル組を与え、行数がラベルの組み合わせ数だけ増える (カーディナリティ爆発の入口) ことを確認する
> - バケット境界ちょうどの値を observe し、le が「以下」を意味する累積カウントであることを確認する
> - 出力を実際の Prometheus か promtool へ食わせ、形式が受け入れられることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch22 run test` を実行し、metrics exposes counter gauge histogram and serves endpoint が通ることを確認する
> 2. code/ch22 で `tsx --test solutions.test.ts` を実行し、expose() がラベル付き counter 行を含み /metrics の本文が bucket 行を含むことを確認する
> 3. serve() で起動して `curl -s http://127.0.0.1:9100/metrics` を叩き、HELP と TYPE と値の3種の行が揃えば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3種のメトリクスは「値の持ち方」だけが違う。共通の抽象へ name と help と expose() を置き、Counter は加算のみ、Gauge は代入可、Histogram は観測値の集計、と分けて考える
> 2. **構造**: ラベルはキーでソートして1本の文字列へ畳み、値を Map で保持する。expose() は HELP 行と TYPE 行を先頭に置き、値行を並べて改行で結合する
> 3. **実装の要点**: Histogram の bucket 行は累積 (le 以下の件数) であり各バケットの個数ではない。最後に必ず +Inf の行を出して count と一致させ、ラベル値は必ず引用符で囲むこと
>
> **本番利用時の警告**
>
> - ラベル値にユーザーIDやリクエストURLのような高カーディナリティの値を入れると時系列数が爆発し、Prometheus 側のメモリと保存費用が桁違いに膨らむ。本番ではラベル値を有限集合に限定する
> - この Histogram は観測値を全件配列に貯め続けるため、長時間動かすとメモリを際限なく消費する。本物の実装はバケットごとのカウンタだけを持つので、このまま常駐プロセスへ入れるとメモリ不足で落ちる
> - /metrics を認証なしで公開すると、内部のエンドポイント名やエラー数やキュー長といった攻撃者に有用な情報を渡すことになる。本番ではネットワークを分離するか認証を掛ける
>
> **導線**
>
> - 開始地点: `code/ch22/metrics.ts`
> - 模範解答: `code/ch22/metrics.solution.ts`
>
> **推定時間の内訳**: Counter と Gauge と Histogram の実装に60分、ラベル処理とテキスト形式出力に45分、/metrics サーバと curl 確認に25分、Prometheus 形式の検証に20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const registry = new MetricRegistry();

const httpRequests = registry.counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status'],
});
httpRequests.inc({ method: 'GET', status: '200' });

const queueDepth = registry.gauge({ name: 'queue_depth', help: 'Items in queue' });
queueDepth.set(42);

const requestDuration = registry.histogram({
  name: 'http_request_duration_seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
requestDuration.observe(0.123);

// Prometheus 形式で出力
console.log(registry.expose());
// # HELP http_requests_total Total HTTP requests
// # TYPE http_requests_total counter
// http_requests_total{method="GET",status="200"} 1
// ...
```

**機能**:
- Counter: 単調増加 (`inc()`)
- Gauge: 任意の値 (`set()`, `inc()`, `dec()`)
- Histogram: バケット集計 + sum/count
- Label による多次元
- Prometheus テキストフォーマット出力

模範解答: `code/ch22/metrics.solution.ts`

#### 課題22.3: OpenTelemetry 風 分散トレース (★★★)

**目的**: Span / Context propagation を実装。

<!-- handbook:exercise:start {"id":"22.3"} -->
> **演習カード 課題22.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 22.8 分散トレース ― マイクロサービスを追う を読み、traceId と spanId と親子関係の意味を押さえる
> - W3C Trace Context の traceparent が バージョン2桁、traceId 32桁、spanId 16桁、フラグ2桁 の形式であることを知っている
> - node:async_hooks の AsyncLocalStorage で暗黙のコンテキストを持ち回れる
> - 課題22.1 の構造化ログを実装済みで、traceId をログへ載せる流れが想像できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] startSpan が name と traceId と spanId と service と startTime を持つ Span を返す
> - [ ] 親 span から作った子 span が同じ traceId を引き継ぎ、parentSpanId に親の spanId を持つ
> - [ ] withSpan の中で startSpan した span が、親を明示指定しなくても親子関係になる
> - [ ] span.end() が endTime と durationMs を計算し、二重呼び出しでは何もしない
> - [ ] traceparent() が規定桁数の文字列を返し、parseTraceparent が不正な文字列で invalid traceparent を投げる
> - [ ] export() が終了済み span の配列を end した順で返す
>
> **期待出力**
>
> - root と child の2 span を end した後の export() が長さ2の配列を返し、先に終わる child が先頭に来る
> - child の parentSpanId が root の spanId と一致し、traceId は両者で同一になる
> - root の traceparent を解析した traceId が root の traceId と一致する
>
> **観察項目**
>
> - 各 span の durationMs を合計し、親の durationMs が子の合計以上になる (親が子を包含する) ことを確認する
> - withSpan を使わずに startSpan した場合、親子関係が切れて孤立した trace になることを確認する
> - sampleRate を 0.1 にして多数の span を出し、export() の件数がおよそ1割になることを確認する
> - traceparent をHTTPヘッダに載せて別プロセスへ渡し、受信側で同じ traceId の span が作られることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch22 run test` を実行し、tracer preserves parent relation and traceparent が通ることを確認する
> 2. code/ch22 で `tsx --test solutions.test.ts` を実行し、export() の長さが2で先頭 span の parentSpanId が root の spanId であることを確認する
> 3. 不正な文字列を parseTraceparent へ渡し invalid traceparent が投げられれば、形式検証が効いていると判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: trace は「木構造をフラットな配列で表現する」だけ。まず親子関係と duration を持つ span を配列へ貯める版を作り、暗黙の親と伝播は後から足す
> 2. **構造**: traceId は16バイト乱数の16進32桁、spanId は8バイト乱数の16桁。end() で performance.now() の差分を取り、tracer 側の finish で配列へ push する
> 3. **実装の要点**: 暗黙の親は AsyncLocalStorage の getStore で取るが、withSpan で run しないと store が空になり全 span が root になる。traceparent は桁数を正規表現で厳密に検証しないと、他システムからの不正な値で trace が分断される
>
> **本番利用時の警告**
>
> - サンプリング判定を span の終了時に行っているため、親が捨てられて子だけ残る不完全な trace が生まれる。本番の実装は trace 単位 (root で決めて子へ伝播) でサンプリングする
> - 属性にSQL文をそのまま入れると、バインド前の値や個人情報がトレース基盤へ送られる。実運用ではプレースホルダのまま送るか値をマスクする
> - export() が全 span をメモリに保持し続けるため常駐プロセスでは無限に増える。実際は OTLP エクスポータでバッチ送信し、送信済みを解放する必要がある
>
> **導線**
>
> - 開始地点: `code/ch22/tracer.ts`
> - 模範解答: `code/ch22/tracer.solution.ts`
>
> **推定時間の内訳**: Span と Tracer の基本実装に50分、AsyncLocalStorage による暗黙の親と withSpan の実装に40分、traceparent の生成と解析およびHTTP伝播の確認に40分、サンプリングと出力確認に20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const tracer = new Tracer({ service: 'api-gateway' });

// 最上位 span
const rootSpan = tracer.startSpan('handle-request');
rootSpan.setAttribute('http.method', 'GET');
rootSpan.setAttribute('http.path', '/users/123');

// 子 span
const dbSpan = tracer.startSpan('db.query', { parent: rootSpan });
dbSpan.setAttribute('db.statement', 'SELECT * FROM users WHERE id = ?');
await db.query(...);
dbSpan.end();

// 別 span
const cacheSpan = tracer.startSpan('cache.get', { parent: rootSpan });
cacheSpan.end();

rootSpan.end();

// 全 span をエクスポート(本来は OTLP で Collector へ)
console.log(tracer.export());
// → 親子関係 + duration + attributes が確認できる
```

**追加**:
- HTTP ヘッダ経由の trace context propagation(`traceparent` ヘッダ)
- AsyncLocalStorage で「現在の active span」を暗黙保持
- span sampling(全部送ると重い)

模範解答: `code/ch22/tracer.solution.ts`

#### 課題22.4: SLO Burn Rate アラート計算 (★★)

**目的**: 「**SLO の error budget を、現在の速度で食い尽くすまで何時間か**」を計算するロジックを実装。

<!-- handbook:exercise:start {"id":"22.4"} -->
> **演習カード 課題22.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 22.7 SLI / SLO / SLA を読み、error budget が 1 から target を引いた値であることを押さえる
> - 22.9 アラート設計 を読み、症状ベースのアラートと multi-window multi-burn-rate の考え方を把握する
> - burn rate が 実エラー率を許容エラー率で割った値であることを理解している
> - 課題22.2 のメトリクスからエラー率を取り出す流れが想像できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] SLOTracker が target を 0 より大きく 1 未満に制限し、範囲外で例外になる
> - [ ] record で観測を蓄積し、status(windowMin, now) が指定窓内のイベントだけを集計する
> - [ ] status が requests と currentErrorRate と burnRate と errorBudgetRemaining の4キーを返す
> - [ ] evaluateAlerts が burnRate が閾値以上のルールだけを返す
> - [ ] target=0.999 で1000件中20件失敗のとき burnRate が 19 を超える
> - [ ] hoursUntilBudgetExhausted が burnRate から残り時間を返し、エラー0件で無限大になる
>
> **期待出力**
>
> - 1000件中20件のエラー (エラー率2%) で、許容0.1%に対する burnRate が 20 前後になる
> - windowMin=60 かつ閾値14.4 の fast-burn ルールだけを渡した evaluateAlerts が長さ1の配列を返す
> - エラーが無い期間では currentErrorRate が0、burnRate が0、errorBudgetRemaining が1になる
>
> **観察項目**
>
> - 同じエラー率でも観測窓を60分と6時間に変えたとき、burnRate は同じでもサンプル数が変わることを確認する
> - fast-burn(14.4倍) と slow-burn(6倍) の両方を渡し、短期スパイクと継続的劣化で発火するルールが分かれる状況を作り分ける
> - burn rate 14.4 が「1時間で30日分の予算の2%を消費する速度」に対応することを windowDays と時間から検算する
> - hoursUntilBudgetExhausted の値と、実際に予算を使い切るまでイベントを流したときの時間を突き合わせる
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch22 run test` を実行し、SLO tracker computes burn-rate alerts が通ることを確認する
> 2. code/ch22 で `tsx --test solutions.test.ts` を実行し、status(60) の burnRate が 19 を超え evaluateAlerts の結果が1件になることを確認する
> 3. 閾値を 100 に上げた同じデータで evaluateAlerts が空配列を返せば、閾値判定が正しいと判定する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に用語を式にする。許容エラー率は 1 から target を引いた値、burn rate は実エラー率を許容エラー率で割った値。この2式が書ければ残りは窓で絞り込むだけ
> 2. **構造**: イベントを success と timestamp の配列で持ち、窓の絞り込みは timestamp が now から窓幅を引いた値以上かのフィルタで行う。evaluateAlerts はルール配列を map して status を計算し、閾値超えだけ filter する
> 3. **実装の要点**: イベント0件の窓でエラー率を計算するとゼロ除算になるため、requests が0なら0として扱う分岐が必要。burnRate の比較を「超えたら」にするか「以上なら」にするかで閾値ちょうどの挙動が変わる
>
> **本番利用時の警告**
>
> - 全イベントを配列へ貯め続けるため、30日窓の実トラフィックでは数千万件がメモリに載って破綻する。本番では Prometheus の rate() のように時間バケットへ集約済みのカウンタから burn rate を計算する
> - このトラッカーは成功と失敗の2値しか見ておらず、レイテンシSLOや部分的な劣化を表現できない。アラートの抑制や重複排除や通知先の振り分けも無いため、そのまま通知先へ接続すると同じ事象でオンコール担当を呼び続ける
> - ウィンドウ内にイベントが数件しか無いときも burn rate が巨大になり誤発火する。実運用では最小トラフィック量の条件を併記する
>
> **導線**
>
> - 開始地点: `code/ch22/slo-burn-rate.ts`
> - 模範解答: `code/ch22/slo-burn-rate.solution.ts`
>
> **推定時間の内訳**: burn rate と error budget の計算実装に30分、窓の絞り込みとアラート評価に35分、fast burn と slow burn の閾値検算と観察に25分
<!-- handbook:exercise:end -->

**背景**: Google SRE Book で広く知られる multi-window multi-burn-rate alerting。

```typescript
const slo = new SLOTracker({
  target: 0.999,            // 99.9% 成功率を目標
  windowDays: 30,           // 30日 ローリングウィンドウ
});

// イベント記録
for (let i = 0; i < 10000; i++) {
  slo.record({ success: Math.random() > 0.001, timestamp: ... });
}

// 現状
const status = slo.currentStatus();
// → { errorBudgetRemaining: 0.45, currentErrorRate: 0.0015, burnRate: 1.5x }

// アラート判定
const alerts = slo.evaluateAlerts([
  { name: 'fast-burn', windowMin: 60, burnRateThreshold: 14.4 },  // 2% 消費で1時間
  { name: 'slow-burn', windowMin: 6 * 60, burnRateThreshold: 6 }, // 5% 消費で6時間
]);
// fast-burn が発火 → PagerDuty
// slow-burn だけが発火 → Slack
```

模範解答: `code/ch22/slo-burn-rate.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":22} -->
### 第22章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第22章の模範解答をまとめて検証する
pnpm --filter @handbook/ch22 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch22 exec tsx logger.solution.ts         # 課題22.1
pnpm --filter @handbook/ch22 exec tsx metrics.solution.ts        # 課題22.2
pnpm --filter @handbook/ch22 exec tsx tracer.solution.ts         # 課題22.3
pnpm --filter @handbook/ch22 exec tsx slo-burn-rate.solution.ts  # 課題22.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch22/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

## まとめ ― 第V部の総括

第V部で更新した知識モデルは、「本番で動かす」を一つの作業ではなく、五つの連続する責任として捉えるものである。Linuxとネットワークは、アプリケーションが消費する資源と通信経路を観測可能にした。コンテナとKubernetesは、その実行条件と配置を宣言へ変えた。クラウドとIaCは、クラスタ外を含む環境全体へ再現性を広げた。CI/CDは変更を検証可能な小さな単位で流し、可観測性はその結果を利用者影響から実行事象まで追跡できるようにした。

この流れを使うと、本番障害を「サーバが悪い」と一括りにせず、資源不足、配置の不一致、環境差、変更起因、観測不足のどこで保証が切れたかを順に調べられる。一方、安定して運用できることは、攻撃に耐えること、十分に速いこと、変更後も振る舞いを保つこと、長期的に構造を変えられることまでは保証しない。

第VI部では、運用で得た観測と変更経路を土台に、セキュリティ、パフォーマンス、テスト、設計原則を扱う。品質をリリース直前の確認項目ではなく、信頼境界、資源予算、検証戦略、依存方向として設計へ組み込むことが次の課題である。
