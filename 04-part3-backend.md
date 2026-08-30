# 第III部 バックエンド編

第II部では、ブラウザ上の状態をUIへ反映し、必要な資産をビルドし、CSR・SSR・SSGを使い分けるところまで進んだ。しかし、画面だけでは注文の確定、権限のある操作、共有データの更新といった業務上の正本を保持できない。クライアントから届く要求を受け取り、同時実行を制御し、外部へ安定した契約を提供し、呼び出し主体を検証する実行境界が必要になる。

第III部では、その境界を内側から組み立てる。まずサーバランタイムが多数の要求をどう実行するかを比較し、次にルーティングや横断処理をフレームワークとして構成する。そこへクライアントとのAPI契約を与え、最後に認証と認可によって「誰が何をしてよいか」を保証する。バックエンド技術を製品名の一覧として覚えるのではなく、実行基盤、処理構造、通信契約、信頼境界という責務の積み重ねとして理解することが、この部の目標である。

---

<a id="chapter-10"></a>
## 第10章 サーバサイド言語とランタイム

第9章では、画面をブラウザとサーバのどちらで生成するかを選べるようになった。だが、サーバ側で処理すると決めても、同時に届く多数の要求をどのように待たせ、実行し、失敗から回復させるかは決まらない。I/O中心のAPIとCPU中心の変換処理では適した並行性モデルが異なり、型安全性、起動時間、ライブラリ、運用人材も選択へ影響する。

本章では、言語名の優劣比較から離れ、スレッド、イベントループ、軽量スレッドという実行モデルを起点にNode.js、Go、Rust、Python、Rubyなどを比較する。ランタイムが引き受ける責務と限界を理解することで、第11章では、その上に毎回現れるルーティングや横断処理をフレームワークとして共通化できるようになる。

<!-- handbook:chapter-guide:start {"chapter":10} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 言語の人気や単純ベンチマークだけでなく、並行性、レイテンシ、運用、採用、既存資産からバックエンドの実行基盤を選ぶ。
>
> **到達目標**
> - スレッド、イベントループ、コルーチンの違いを説明できる。
> - Node.js、Go、Rust、Python、Ruby等の強みと制約を条件付きで比較できる。
> - 再現可能なベンチマークを設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [5.4 非同期処理の進化](03-part2-frontend.md#section-5-4) ― 非同期処理
> - [18.1 プロセスとスレッド](06-part5-infrastructure.md#section-18-1) ― プロセスとスレッドを後で参照
>
> **中核概念**  
> [10.1 並行性モデルの3パターン](#section-10-1)、[10.2 Node.js ― イベントループの代表](#section-10-2)、[10.4 Go ― シンプルで速い](#section-10-4) (実務選択)、[10.5 Rust ― ゼロコスト抽象とメモリ安全](#section-10-5) (実務選択)、[10.6 Python ― データとAIの覇者](#section-10-6) (実務選択)、[10.9 ランタイム選択の判断軸 (まとめ)](#section-10-9)
>
> **最小実装**  
> [10.8 ベンチマーク比較 ― 1万コネクション echo サーバ](#section-10-8) (発展)、[10.10 実装課題 ― 並行性モデルを実測で理解](#section-10-10) (発展)
>
> **本番実装との差分**
> - echoサーバの測定は業務ロジック、DB、TLS、GC、デプロイ方式を代表しない。本番選定では実ワークロードとチーム条件を測る。
>
> **典型的な失敗**
> - req/sだけで選ぶ。
> - CPU処理とI/O処理を同じ並行性モデルで評価する。
> - ランタイム更新と依存互換性を無視する。
>
> **診断・デバッグ方法**
> - CPU profile、event-loop delay、GC、メモリ、p95/p99を同時に観測する。
> - 同一ハードウェアと負荷生成条件を固定する。
>
> **意思決定チェックリスト**
> - ワークロードはCPU中心かI/O中心か。
> - 採用・保守・ライブラリ・起動時間の制約は何か。
>
> **演習と評価基準**  
> 対象: [10.10 実装課題 ― 並行性モデルを実測で理解](#section-10-10) (発展)
> - ベンチマーク条件を記録し、結果の一般化可能範囲を説明できる。
>
> **一次資料・発展資料**
> - Node.js documentation
> - Go specification
> - Rust reference
> - Python documentation
> - Ruby documentation
<!-- handbook:chapter-guide:end -->

<a id="section-10-1"></a>
### 10.1 並行性モデルの3パターン
<!-- handbook:learning {"level":"required","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"10.1"} -->
クライアントから届く要求を処理するには、単に処理を一度実行できるだけでは足りない。多数の接続がI/O待ちと計算を異なる割合で含むため、まず「待っている仕事」と「CPUを使う仕事」をどの単位で並行に進めるかを整理する必要がある。

サーバが「同時に複数のリクエストを捌く」方法には3つの基本アプローチがある。

**1. スレッドベース (Java、C#、Ruby (旧)、PHP-FPM):**

リクエストをOSスレッドまたはプロセス上で処理するモデル。直感的だが、スレッドごとのスタックやランタイム管理情報、コンテキストスイッチのコストがある。実際の同時実行数は、スタック設定、処理時間、I/O待ち、メモリ上限、ランタイムの実装によって大きく変わる。

```text
リクエスト1 → スレッド1 → 処理
リクエスト2 → スレッド2 → 処理
リクエスト3 → スレッド3 → 処理
...
```

**2. イベントループ (Node.js、Deno、Bun):**

通常は1つのイベントループ上でJavaScriptコールバックを実行し、I/O待ちの間に別の処理を進める。Node.js系ランタイムも、内部のI/O処理、ワーカープール、`worker_threads`、複数プロセスを利用できるため、プロセス全体が常に単一スレッドという意味ではない。長時間の同期CPU処理をイベントループ上で実行すると、他のリクエストを遅延させる。

```text
イベントループ:
  リクエスト1: DB問い合わせ送信 → 待ち
  リクエスト2: ファイル読み込み開始 → 待ち
  リクエスト3: 計算実行 (即座に完了)
  リクエスト1のDB応答到着 → 続き
  ...
```

**3. グリーンスレッド (Go、Erlang/Elixir、Rust async、Java 21 以降の仮想スレッド):**

言語ランタイムが軽量スレッド (ゴルーチン、ファイバ) を提供し、それを少数のOSスレッドに多重化する。スレッドの書き心地で、イベントループの効率を得られる。

```go
// Go: 1リクエスト = 1ゴルーチン
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    // 多数のリクエストをゴルーチンとして並行に扱える
    result := slowOperation()
    fmt.Fprint(w, result)
})
```

ゴルーチンのスタックは小さく開始して必要に応じて伸縮し、GoランタイムがOSスレッドへ多重化する。そのためOSスレッドをリクエスト数だけ作るより多数の並行処理を扱いやすいが、実用上の上限はメモリ、ゴルーチンが保持するデータ、外部接続数、スケジューリング負荷で決まる。コードは同期処理に近い形で記述できる。

<a id="section-10-2"></a>
### 10.2 Node.js ― イベントループの代表
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"J","term":"JIT コンパイル"} -->
<!-- handbook:index {"group":"N","term":"Node.js"} -->
<!-- handbook:index {"group":"あ行","term":"イベントループ"} -->

<!-- handbook:narrative-bridge {"section":"10.2"} -->
3つの並行性モデルを区別すると、同じJavaScriptでもブラウザとは異なるサーバ負荷をどう扱うかを具体的に検討できる。Node.jsはイベントループを中心に、I/O完了通知とワーカープールを組み合わせる代表例である。

Node.js (2009年〜) は Chrome の V8 エンジンを使った JavaScript ランタイムだ。設計の核心は libuv によるイベントループ。

**Node.js のイベントループ (簡略):**

```text
   ┌───────────────────────────┐
┌─→│           timers          │ ← setTimeout, setInterval
│  ├───────────────────────────┤
│  │     pending callbacks     │
│  ├───────────────────────────┤
│  │       idle, prepare       │
│  ├───────────────────────────┤
│  │           poll            │ ← I/O 完了の取得
│  ├───────────────────────────┤
│  │           check           │ ← setImmediate
│  ├───────────────────────────┤
│  │      close callbacks      │
│  └───────────────────────────┘
        ↓ 各フェーズの最後で
   マイクロタスク (Promise.then) を処理
```

実は第4章で見たブラウザのイベントループとは細部が違う。Node.js には複数のフェーズがあり、各フェーズで `setTimeout` や `setImmediate` のコールバックが消費される。

**Node.js の強みと弱み:**

| 強み | 弱み |
|---|---|
| フロントと言語が同じ (TypeScript統一) | イベントループ上の同期CPU処理は他の要求を遅延させる |
| 巨大なエコシステム (npm) | パッケージ品質のばらつき |
| 起動が速い | 標準ライブラリが薄い |
| ストリーミング処理に強い | TypeScriptは型除去のみの実行で、型検査は別途必要 |

<a id="section-10-3"></a>
### 10.3 Deno と Bun ― Node.js への挑戦
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"G","term":"Go (言語)"} -->

<!-- handbook:narrative-bridge {"section":"10.3"} -->
Node.jsのイベントループはI/O中心の処理に適する一方、互換性、権限、起動速度、統合ツールへの要求まで一つの設計で満たすとは限らない。DenoとBunはJavaScript資産を保ちながら、Node.jsが積み残した開発体験や実行境界を別の優先順位で組み直している。

**Deno** (2018年〜、Node.js 作者 Ryan Dahl が再設計):

- TypeScriptを直接実行できる開発体験。ただし実行時には型情報を利用せず、内部で変換・型除去が行われる
- セキュリティが厳格 (ファイル/ネットワーク アクセスは明示的許可)
- Web 標準 API 重視 (`fetch`、`Request`、`Response` などブラウザと同じ)
- 標準ライブラリが充実
- 単一バイナリ配布

```typescript
// Deno: TypeScript をそのまま実行
import { serve } from 'jsr:@std/http';

serve((req) => new Response('Hello'));

// 実行
// deno run --allow-net server.ts
```

**Bun** (2022年〜):

- Zigで実装され、起動時間や一部のワークロードで高性能を狙う
- Node.js互換性を広く提供するが、ネイティブアドオン、実装差、未対応APIは導入前に検証する
- 内蔵バンドラ、テストランナー、パッケージマネージャ
- TypeScript・JSX ネイティブ

```typescript
// Bun: 起動と実行が極めて速い
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello from Bun');
  },
});
```

実務での選択:

- **Node.js**: 成熟したエコシステム、既存資産、運用実績を重視する場合
- **Deno**: 権限モデル、Web標準API、単一ツールチェーンを評価したい場合
- **Bun**: 起動・ビルド・パッケージ管理を含む統合開発体験を評価したい場合

互換性と性能はバージョン、依存パッケージ、ワークロードで変わる。採用前に実アプリのテスト、監視、障害時の運用手順まで確認する。

<a id="section-10-4"></a>
### 10.4 Go ― シンプルで速い
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"R","term":"Rust"} -->

<!-- handbook:narrative-bridge {"section":"10.4"} -->
JavaScriptランタイム同士の差を理解しても、CPU負荷を含むサービスや単一バイナリ配布では別の選択肢が有利になる。Goは軽量スレッドと小さな言語仕様を組み合わせ、並行処理を同期的な記述へ近づける。

Goは2009年にGoogleが公開。Google内部の大規模システム向けに設計された。

特徴:

- **コンパイル言語**: 多くの場合、単一実行ファイルとして配布しやすい。CGO、動的ライブラリ、CA証明書、タイムゾーンデータなど外部依存が残る場合はある
- **シンプル**: 言語仕様が小さい、覚えることが少ない
- **ゴルーチン**: 軽量並行処理
- **強い静的型**: 実行時エラーが減る
- **gofmt**: 公式フォーマッタ、スタイル論争が起きない

```go
// Go の HTTP サーバ
package main

import (
    "encoding/json"
    "log"
    "net/http"
)

type Response struct {
    Message string `json:"message"`
}

func main() {
    http.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(Response{Message: "Hello, Go"})
    })

    log.Fatal(http.ListenAndServe(":3000", nil))
}
```

Goは特に以下の用途で強い:

- **マイクロサービス**: バイナリで配布、起動が速い、リソース消費が少ない
- **CLI ツール**: Docker、kubectl、Terraform などGo製
- **ネットワークサービス**: 公式gRPC実装が提供され、並行処理モデルと組み合わせやすい
- **DevOpsツール**: 単一バイナリで配布できる利点

<a id="section-10-5"></a>
### 10.5 Rust ― ゼロコスト抽象とメモリ安全
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"G","term":"GIL (Global Interpreter Lock)"} -->

<!-- handbook:narrative-bridge {"section":"10.5"} -->
Goは運用と並行処理を単純化するが、メモリ配置やデータ競合をより厳密に制御したい処理では、実行時管理だけに任せたくない場合がある。Rustは所有権と型検査によって、低水準の制御と安全性をコンパイル時に結び付ける。

Rust (2010年〜) はMozilla発祥、現在は Rust Foundation が管理。

特徴:

- **メモリ安全 (Garbage Collector なし)**: 借用チェッカーがコンパイル時に保証
- **ゼロコスト抽象化**: 抽象化のための実行時コストを原則として追加しない設計を目指す。性能はアルゴリズム、最適化設定、割り当て、I/Oによって決まる
- **並行処理の安全性**: データ競合をコンパイル時に検出
- **学習コストが高い**: 所有権・借用・ライフタイムの概念

```rust
// Axum (Rust の Web フレームワーク)
use axum::{routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct Response {
    message: String,
}

async fn hello() -> Json<Response> {
    Json(Response { message: "Hello, Rust".into() })
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/hello", get(hello));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

実務での Rust:

- **CLI ツール**: `ripgrep`、`bat`、`fd` などRust製
- **ビルドツール**: SWC、Turbopack、Rolldown、Biome ― 第II部で見たJavaScript界の高速ツールがRustで書かれている
- **WebAssembly**: Rustは有力な選択肢の一つ。C/C++、Go、AssemblyScriptなど他のツールチェーンもあり、JavaScriptとの境界コストやバイナリサイズを測定して選ぶ
- **インフラの基盤**: Cloudflare Workers (V8)、Polkadot などのブロックチェーン

Webアプリ全体をRustで書くのはまだ少数派だが、特定領域 (パフォーマンスクリティカル、システムプログラミング) では強力な選択肢だ。

<a id="section-10-6"></a>
### 10.6 Python ― データとAIの覇者
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"10.6"} -->
Rustは高い制御性を与える代わりに、所有権や非同期実装の学習と開発コストを要求する。データ処理、機械学習、短い開発サイクルを優先する場面では、豊富なライブラリと表現速度を持つPythonが別の最適点になる。

Python (1991年〜) はWeb開発というよりデータサイエンス・機械学習で圧倒的シェアを持つ。

特徴:

- **シンプルな文法**: 読みやすさ重視
- **データ系エコシステム**: NumPy、Pandas、PyTorch、Scikit-learn
- **AI/MLとの統合**: LLM、画像処理、データパイプライン
- **実行モデルに注意**: 標準のCPythonビルドではGILにより、同一インタプリタ内のPythonバイトコードを複数スレッドで同時実行できない。I/O並行性、複数プロセス、C拡張は利用でき、Python 3.14ではGILを無効化できるfree-threadedビルドも正式サポートされるが、デフォルトではない

```python
# FastAPI
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Response(BaseModel):
    message: str

@app.get("/hello", response_model=Response)
async def hello():
    return Response(message="Hello, Python")
```

実務でPythonを選ぶケース:

- **データパイプライン**: ETL、バッチ処理
- **AI/MLバックエンド**: モデル推論サーバ
- **科学計算**: 数値シミュレーション
- **既存資産がある**: チームが既にPython得意

Web APIでNode.jsとPythonのどちらを選ぶかは、既存資産、チーム経験、依存ライブラリ、データ処理との近さ、運用基盤で決める。TypeScriptによるフロントとの型・言語統一はNode.jsの利点だが、Pythonも型注釈、スキーマ生成、成熟したWebフレームワークを利用できる。

<a id="section-10-7"></a>
### 10.7 Ruby ― 表現力と Rails
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"10.7"} -->
PythonのエコシステムはデータとAI連携に強いが、業務ルールを素早く表現し、規約によってWebアプリ全体を組み立てたい組織では別の生産性が求められる。RubyとRailsは、コードの表現力と統合された開発規約へ重心を置く。

Ruby (1995年〜、まつもとゆきひろ作) は「プログラマの幸せ」を設計目標にした言語。Web開発で爆発的に普及したのは Rails (2004年〜) の登場による。

特徴:

- **DSL に強い**: メタプログラミングで宣言的な記述
- **Rails の規約**: 「設定より規約」で大量のボイラープレートを省ける
- **MINASWAN**: コミュニティ文化

```ruby
# Rails のコントローラ
class UsersController < ApplicationController
  def show
    @user = User.find(params[:id])
    render json: @user
  end
end
```

実務で Ruby/Rails:

- **スタートアップのMVP**: 高速プロトタイピング
- **既存資産**: Shopify、GitHub、Airbnb 等で稼働
- **モノリス志向のチーム**: マイクロサービスより一体型を選ぶ場合

Rails は2026年現在も健在だが、新規プロジェクトでの採用は減少傾向。理由は静的型 (Sorbet、RBS) が後付けのため、Node.js + TypeScript ほど型恩恵が得られにくいこと。

<a id="section-10-8"></a>
### 10.8 ベンチマーク比較 ― 1万コネクション echo サーバ
<!-- handbook:learning {"level":"advanced","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"10.8"} -->
各言語の設計思想を比較しても、自分たちの要求に対するレイテンシ、メモリ、起動時間は推測だけでは決められない。選択候補を同じ条件で測り、何を省略した測定なのかも含めて結果を読む必要がある。

> **測定上の注意**: 以下の数値は言語の普遍的な順位ではない。OS、CPU、TLS、HTTPサーバ、ランタイムとフレームワークのバージョン、接続再利用、レスポンスサイズ、GC設定、計測ツールで結果が変わる。教材では数値そのものではなく、同一条件で再現可能なベンチマークを作る手順を学ぶ。

実装言語によってパフォーマンスはどれだけ違うか。シンプルな「echo サーバ」(POSTされたデータをそのまま返す) を各言語で実装し、`wrk` で負荷をかけた場合の傾向 (※環境やバージョンに大きく依存するので、あくまで「桁感」の目安)。

| 言語/ランタイム | リクエスト/秒の傾向 | メモリ使用 |
|---|---|---|
| Rust (Axum / Hyper) | 最速級 | 数MB |
| Go (net/http) | 高速 | 数十MB |
| Bun (Node互換) | 高速 | 数十MB |
| Node.js (Express) | 中速 | 数十〜100MB |
| Python (FastAPI + uvicorn) | 中速 | 数十MB |
| Ruby (Rails + Puma) | 遅め | 100MB+ |

実Webアプリでは、DBアクセス、外部API、シリアライズ、ネットワーク、キャッシュ、アプリケーションコードのいずれもボトルネックになりうる。N+1の解消が言語変更より大きな効果を持つ場面も多いが、推測ではなくプロファイラと本番相当負荷で確認する。ベンチマーク順位だけでなく、チーム熟練度、エコシステム、運用性を総合判断する。

<a id="section-10-9"></a>
### 10.9 ランタイム選択の判断軸 (まとめ)
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"10.9"} -->
ベンチマークは選択の一材料にすぎず、最速の結果が保守可能な実装を意味するわけではない。ワークロード、既存資産、採用、障害対応まで含めて、ランタイムが組織へ与える制約を判断軸として統合する。

| 求めるもの | 選択 |
|---|---|
| フロントと統一、エコシステム | **Node.js + TypeScript** |
| 性能と簡潔さの両立 | **Go** |
| 最高性能・WebAssembly | **Rust** |
| データ/AI連携が重要 | **Python (FastAPI)** |
| 高速プロトタイプ・スタートアップ | **Ruby (Rails)** または **Node.js + Next.js** |
| Web標準APIへの準拠を重視 | **Deno** |
| 開発体験の良さ・速度 | **Bun** |

本書のコード例は宣言通り Node.js + TypeScript を主軸にする。

<a id="section-10-10"></a>
### 10.10 実装課題 ― 並行性モデルを実測で理解
<!-- handbook:learning {"level":"advanced","minutes":225} -->

<!-- handbook:narrative-bridge {"section":"10.10"} -->
選択軸を言葉で理解した後は、並行性モデルの差を自分の観測結果へ結び付ける必要がある。echoサーバとスケジューラを実装し、スループットだけでなく待ち時間や処理の詰まり方を比較する。

第10章では並行性モデルの3パターン (スレッド/イベントループ/グリーンスレッド) を見た。本節では各モデルを実装またはベンチマークし、得意・不得意を体感する。所要時間: 演習カードの推定時間の合計で7時間15分。

#### 課題10.1: シンプル echo サーバのベンチマーク (★★)

**目的**: 同じ仕様の echo サーバを Node.js で書いて、`wrk` や `autocannon` で性能計測する。

<!-- handbook:exercise:start {"id":"10.1"} -->
> **演習カード 課題10.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: localhost
>
> **前提**
>
> - 10.2 Node.js ― イベントループの代表 を読み、イベントループがI/O待ちとCPU処理をどう扱うか把握する
> - 10.8 ベンチマーク比較 ― 1万コネクション echo サーバ を読み、測定条件を固定する意味を確認する
> - Node.js 24 系と curl が PATH にあり、`node --version` が 24.x を返す
> - `net.createServer` と `http.createServer` でポートを listen するコードを書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `code/ch10/echo-server.ts` に `startEchoServers()` を実装し、TCPポートとHTTPポートの2つを同時に listen して両方のポート番号を返す
> - [ ] TCPポートへ hello を送ると同じ hello がそのまま返る
> - [ ] `POST /echo` が 200 とリクエストボディと同一のバイト列を返し、`content-length` が本文長と一致する
> - [ ] `/echo` 以外のパスへの要求が 404 と error キーを持つJSONを返す
> - [ ] `code/ch10/bench.sh` が総リクエスト数と同時実行数を受け取り、経過時間と概算rpsを1行で出力する
> - [ ] クエリ `?work=500000` を付けた要求で応答時間が明確に伸びることを計測値で示せる
>
> **期待出力**
>
> - サーバ起動時に tcpPort と httpPort を含む1行のJSONが標準出力される
> - benchスクリプトが `requests=100 concurrency=10 elapsed_ms=... approx_rps=...` の形式で1行出力する
> - 最後に `cpu_block_probe=` に続けて echo 応答本文が表示され、work付き要求の往復が確認できる
> - 同時実行数を10から100へ上げると elapsed_ms は伸びるが approx_rps は頭打ちになる
>
> **観察項目**
>
> - `curl -i` でレスポンスヘッダ `x-work-checksum` の値を見て、CPU処理が実際に実行されたことを確認する
> - work を 0 と 500000 で切り替え、elapsed_ms の差からイベントループ占有時間を読む
> - 重い要求を1本流しながら別ターミナルで軽い `/echo` を叩き、軽い方まで遅延することを確認する
> - 環境変数 CONCURRENCY を 10 / 50 / 200 と変えたときの approx_rps の飽和点を記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch10 run test` を実行し、テスト `TCP and HTTP echo return the request body` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch10 exec tsx echo-server.solution.ts` でサーバを起動し、表示された httpPort に対して `REQUESTS=200 CONCURRENCY=20 bash code/ch10/bench.solution.sh http://127.0.0.1:PORT/echo` を実行して計測1行が出れば合格
> 3. `nc 127.0.0.1 TCPPORT` を実行して hello と入力し、同じ hello がそのまま返ればTCP echoは合格
> 4. `curl -i -X POST --data hello 'http://127.0.0.1:PORT/echo?work=500000'` の応答に 200 と x-work-checksum が含まれることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: TCPとHTTPを1プロセスで同時に立てる方針にする。ポート0で listen して実際のポートを取り出す設計にすると、テストとベンチの両方から同じ関数を使い回せる。
> 2. **構造**: TCP側は接続コールバックで `socket.pipe(socket)` の1行で足りる。HTTP側は request の data と end でチャンクを溜め、`Buffer.concat` してから `response.writeHead(200, ...)` で返す。起動待ちは `once(server, 'listening')` を使う。
> 3. **実装の要点**: CPU負荷は無制限ループにせず `Math.min(iterations, 2_000_000)` のように上限を設ける。上限が無いと work に巨大値を渡された瞬間にプロセスが応答を返さなくなり、ベンチが完走しない。
>
> **本番利用時の警告**
>
> - クエリで同期CPU処理量をクライアントに決めさせる設計は、そのまま公開すると1リクエストでイベントループを止められるDoSになる。本番では処理量をサーバ側で固定し、重い処理は worker_threads やジョブキューへ逃がす。
> - この echo サーバはボディ長上限、リクエストタイムアウト、逆流制御を持たないため、巨大ボディや接続を保持し続ける攻撃でメモリと接続枠を食い潰される。
> - 負荷試験は必ず自分の localhost に対してのみ行う。bench.sh を第三者のホストへ向けるとDoS行為にあたる。
>
> **導線**
>
> - 開始地点: `code/ch10/bench.sh`、`code/ch10/echo-server.ts`
> - 模範解答: `code/ch10/bench.solution.sh`、`code/ch10/echo-server.solution.ts`
>
> **推定時間の内訳**: TCP/HTTP echo 2種の実装40分、bench.sh の作成と実行25分、work付き要求でのブロック観察と記録25分
<!-- handbook:exercise:end -->

**要件**:
- TCP echo サーバ (受け取った文字列をそのまま返す)
- HTTP echo サーバ
- 同時 1000 接続でスループット計測
- イベントループのブロック耐性を確認 (CPU 重い処理を混ぜると?)

```bash
# autocannon でベンチマーク
npx autocannon -c 1000 -d 30 http://localhost:3000/echo
```

**問題**:
- 純粋な I/O 待ちのみ (echo) の場合、Node.js のスループットは?
- CPU を 100ms 食う処理を 1% 混ぜると全体のレイテンシはどうなる?
- なぜ Node.js は CPU 重い処理が苦手なのか?

模範解答: `code/ch10/echo-server.solution.ts` + `code/ch10/bench.sh`

#### 課題10.2: スレッドプール vs イベントループ (★★★)

**目的**: 「**スレッドプール**」と「**イベントループ**」のスケーリング特性を実測で比較する。

<!-- handbook:exercise:start {"id":"10.2"} -->
> **演習カード 課題10.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 10.1 並行性モデルの3パターン を読み、スレッド・イベントループ・グリーンスレッドの区別を言えるようにする
> - 10.2 Node.js ― イベントループの代表 を読み、libuv のスレッドプールが担当する処理を把握する
> - `promisify` した `crypto.pbkdf2` を非同期に呼べる
> - 環境変数 UV_THREADPOOL_SIZE を付けてコマンドを起動できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] I/O相当タスク (setTimeout 待ち) とCPU相当タスク (crypto.pbkdf2) を同じ並列数で実行し、経過時間を比較するスクリプトを書く
> - [ ] 並列数を 16 / 100 / 500 / 1000 と変えて、両ワークロードの経過時間を表として記録する
> - [ ] I/O側は並列数を上げても総経過時間がほぼ一定であることを数値で示す
> - [ ] CPU側は UV_THREADPOOL_SIZE の値で経過時間が階段状に変わることを数値で示す
> - [ ] 出力に label / count / elapsedMs の3列が含まれる
>
> **期待出力**
>
> - event-loop-io と libuv-thread-pool の2行を持つ表が出力され、各行に count と elapsedMs が入る
> - 並列16では event-loop-io の elapsedMs が数十ミリ秒、libuv-thread-pool は数百ミリ秒以上と桁が異なる
> - UV_THREADPOOL_SIZE=1 にすると libuv-thread-pool の elapsedMs がデフォルト値のときの数倍になる
> - 実行の最後に観察内容を述べたコメント行が1行表示される
>
> **観察項目**
>
> - UV_THREADPOOL_SIZE を 1 / 4 / 8 と変え、CPU側 elapsedMs がプール数にほぼ反比例することを確認する
> - 並列数を16から256へ増やしたとき、I/O側の elapsedMs がほとんど変わらないことを表で比べる
> - CPU側の実行中に OS のCPU使用率を見て、物理コア数を超えては上がらないことを確認する
> - pbkdf2 の反復数を増減させ、待ち行列の伸び方が線形かを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `node code/ch10/thread-vs-event/solution/main.mjs 32` を実行し、2行の表と elapsedMs が表示されれば実行環境は正常
> 2. `UV_THREADPOOL_SIZE=1 node code/ch10/thread-vs-event/solution/main.mjs 32` とデフォルト値の結果を並べ、CPU行の elapsedMs が明確に増えていれば合格
> 3. `pnpm --filter @handbook/ch10 run test` を実行し、章の検証が通ることを確認する。この課題自体の自動テストは無いため、記録した数値表で自己採点する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 測る対象を「待つだけのタスク」と「CPUを実際に使うタスク」の2つに絞る。同じ関数で並列実行して経過時間だけを返す形にすると比較が単純になる。
> 2. **構造**: `performance.now()` で開始時刻を取り、`Promise.all(tasks.map(t => t()))` を待って差分を返す runConcurrent(label, tasks) を用意する。I/O側は setTimeout を包んだ Promise、CPU側は promisify した pbkdf2 を使う。
> 3. **実装の要点**: pbkdf2 は同期版ではなく非同期版を使うこと。同期版だとイベントループ自体が止まり、スレッドプールの飽和ではなく単なる直列実行を測ってしまう。UV_THREADPOOL_SIZE はプロセス起動時にしか反映されない。
>
> **本番利用時の警告**
>
> - 測定値はCPU、電源設定、Node.jsのバージョンに強く依存する。この数値を他マシンの容量計画へ流用してはいけない。
> - UV_THREADPOOL_SIZE を大きくすると pbkdf2 だけでなくDNS解決やファイルI/Oも同じプールを奪い合う。本番で無闇に上げるとI/O遅延が悪化する。
>
> **導線**
>
> - 開始地点: `code/ch10/thread-vs-event/starter/README.md`
> - 模範解答: `code/ch10/thread-vs-event/solution/main.mjs`、`code/ch10/thread-vs-event/solution/README.md`
>
> **推定時間の内訳**: 計測スクリプトの実装50分、並列数と UV_THREADPOOL_SIZE を変えた測定60分、結果表の作成と考察40分
<!-- handbook:exercise:end -->

**要件**: 同じ動作をする2サーバを作る:
1. **スレッドプール風**: 各リクエストを worker_threads にディスパッチ
2. **イベントループ**: シングルスレッドで非同期処理

ワークロードを2種類試す:
- **I/O 重視**: `setTimeout(100ms)` を模擬
- **CPU 重視**: 重い計算 (フィボナッチ等)

接続数 100, 500, 1000, 5000 と増やして、レイテンシ p99 とスループットを記録。

**期待される観察**:
- I/O 重視: イベントループが圧勝 (スレッド作成のオーバヘッドなし)
- CPU 重視: スレッドプールがマシ (複数 CPU コア活用)
- 接続数増加: イベントループは滑らかにスケール、スレッドプールはコンテキストスイッチで頭打ち

模範解答: `code/ch10/thread-vs-event/`

#### 課題10.3: グリーンスレッド風スケジューラを自作 (★★★)

**目的**: Go の goroutine、Erlang のプロセスのような「軽量スレッド」がどう実装されているか理解する。

<!-- handbook:exercise:start {"id":"10.3"} -->
> **演習カード 課題10.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 10.1 並行性モデルの3パターン のグリーンスレッドの説明を読む
> - 10.4 Go ― シンプルで速い を読み、goroutine が協調的に切り替わる前提を確認する
> - JavaScript の Generator (function* と yield) で実行を中断・再開できる
> - Node.js 24 系と tsx で TypeScript を直接実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] Scheduler クラスに spawn(factory) と run(maxSteps) を実装する
> - [ ] 2つのタスクを spawn すると出力が A step 0 / B step 0 / A step 1 / B step 1 の順に交互になる
> - [ ] run() が steps と errors を返し、正常終了時に errors の件数が 0 になる
> - [ ] タスク内で例外が起きても他タスクは走り続け、例外は errors に蓄積される
> - [ ] maxSteps を超えると `Scheduler exceeded maxSteps=100000` を投げて無限ループを止める
> - [ ] 1000個のタスクを spawn しても1プロセス内で完走する
>
> **期待出力**
>
> - A step 0 から B step 2 までの6行が交互に並び、最後に `steps=6 errors=0` が表示される
> - 無限ループするタスクを混ぜると maxSteps 超過の例外で停止する
> - 例外を投げるタスクを混ぜても他タスクの出力は最後まで続き、errors の件数が1になる
>
> **観察項目**
>
> - 出力順を見て、1タスクが完了してから次ではなく1ステップごとに切り替わっていることを確認する
> - yield を消したタスクを混ぜ、他タスクが飢餓状態になることを再現する
> - タスク数を10から10000へ増やし、`process.memoryUsage().heapUsed` の増分が1タスクあたり数百バイト程度に収まることを見る
> - run() が返す steps が、タスク数と yield 回数から計算した値と一致するか数える
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch10 run test` を実行し、テスト `green scheduler interleaves cooperative tasks` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch10 exec tsx green-threads.solution.ts` を実行し、6行の交互出力と `steps=6 errors=0` が出れば合格
> 3. 意図的に throw するタスクを spawn し、他タスクの出力が続き errors の件数が1になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: スケジューラの本体はキュー1本で足りる。先頭のタスクを1ステップだけ進め、終わっていなければ末尾へ戻す、を繰り返せばラウンドロビンになる。
> 2. **構造**: タスクは Generator オブジェクトとして保持し、`task.next()` の戻り値の done を見る。done が false ならキューへ push、true なら捨てる。spawn は Generator を作るファクトリ関数を受け取る形にする。
> 3. **実装の要点**: `next()` の例外を try/catch で拾わないと、1タスクの失敗でスケジューラ全体が停止する。また無限ループするタスクに備えて総ステップ数の上限を持たせる。
>
> **本番利用時の警告**
>
> - この協調的スケジューラはプリエンプションを持たないため、yield しないタスクが1つあるだけで他タスクは永久に動かない。本番のワーカーには実行時間の上限と強制中断が要る。
> - Generator ベースのタスクは同一スレッド上で切り替わるだけで並列実行ではない。CPU負荷の分散を狙って本番へ持ち込むとコアを1つしか使えず処理が詰まる。
>
> **導線**
>
> - 開始地点: `code/ch10/green-threads.ts`
> - 模範解答: `code/ch10/green-threads.solution.ts`
>
> **推定時間の内訳**: Scheduler本体の実装50分、sleep相当とチャンネル受信相当の拡張および例外処理50分、タスク数を増やしたメモリ観察と記録50分
<!-- handbook:exercise:end -->

**要件**: JavaScript の Generator を使って、協調的マルチタスクを実装。

```typescript
const scheduler = new Scheduler();

scheduler.spawn(function* worker(name: string) {
  for (let i = 0; i < 3; i++) {
    console.log(`${name} step ${i}`);
    yield;  // 制御を他のタスクに譲る
  }
});

scheduler.spawn(/* 別タスク */);
scheduler.run();
// 出力 (協調的に切り替わる):
// A step 0
// B step 0
// A step 1
// B step 1
// ...
```

機能追加:
- `yield sleep(100)` 相当 (タイマー待ち)
- `yield receive(channel)` 相当 (チャンネル受信)
- 数千個のタスクが同時に動く (メモリ効率)

模範解答: `code/ch10/green-threads.solution.ts`

#### 課題10.4: 言語間 HTTP サーバ性能比較 (★)

**目的**: 同じ機能の HTTP サーバを Node.js、Go、Python で書いて性能を比較する (Go/Python は環境があれば)。

<!-- handbook:exercise:start {"id":"10.4"} -->
> **演習カード 課題10.4** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 10.9 ランタイム選択の判断軸 (まとめ) を読み、req/s以外の判断軸を確認する
> - 10.4 Go ― シンプルで速い と 10.6 Python ― データとAIの覇者 に目を通す
> - node と curl が使える。go と python3 は無ければスキップでよい
> - bash スクリプトからバックグラウンドプロセスを起動し kill できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] GET で ok を返す最小サーバを Node.js で起動し、指定回数の逐次リクエストで経過時間を測るスクリプトを書く
> - [ ] python3 と go がある場合は同等サーバも測り、無い場合は `python: skipped (not installed)` のように表示して続行する
> - [ ] 各ランタイムについて requests / elapsed_ms / approx_rps の3項目を1行で出力する
> - [ ] スクリプト終了時に起動したサーバプロセスと一時ディレクトリが残らない
> - [ ] 測定値の一般化可能範囲についての注意書きを1行出力する
>
> **期待出力**
>
> - `node: requests=30 elapsed_ms=... approx_rps=...` の形式の行が、実行できたランタイムの数だけ出力される
> - 未インストールのランタイムは skipped と1行だけ表示される
> - 最後に、この数値は同一マシン・同一実行内でのみ比較できる旨の注意が1行出る
> - 逐次curl測定のため、本文の表にあるような桁違いの差までは開かない
>
> **観察項目**
>
> - 逐次curlではプロセス起動と接続確立のコストが支配的で、本文の表ほど差が開かないことを確認する
> - 各サーバが listen を完了するまでのヘルスチェック回数の違いを見る
> - ps や top で各サーバプロセスの常駐メモリを比べる
> - 同じスクリプトを2回続けて実行し、approx_rps がどれだけぶれるかを記録する
>
> **テスト方法 (自己採点手順)**
>
> 1. `bash code/ch10/lang-comparison/solution/main.sh` を実行し、少なくとも node: の行が出力されれば合格
> 2. `REQUESTS=100 PORT_BASE=39200 bash code/ch10/lang-comparison/solution/main.sh` のように環境変数を変えて再実行し、出力形式が変わらないことを確認する
> 3. `pnpm --filter @handbook/ch10 run test` を実行し、章全体の検証が通ることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 3言語分の最小サーバをリポジトリへ置かず、スクリプト内のヒアドキュメントで一時ディレクトリへ書き出すと、環境差の切り分けが楽になる。
> 2. **構造**: benchmark 名前・起動コマンド・ポート を受け取る関数を1つ作り、起動、ヘルスチェックのポーリング、計測ループ、kill の順に並べる。時刻取得は python3 の perf_counter_ns で全言語分を揃える。
> 3. **実装の要点**: listen 完了を固定時間の sleep で待つと計測が不安定になる。`curl -sf` が成功するまでポーリングし、trap で必ずプロセスと一時ディレクトリを片付ける。
>
> **本番利用時の警告**
>
> - この逐次curl測定はプロセス起動と接続確立のコストを含むため、ランタイム選定の根拠として社外へ出す数値には使えない。
> - ここで使う Python の http.server は開発用でシングルスレッドかつ堅牢性の考慮が無いため、本番のHTTPサーバとして公開してはいけない。
>
> **導線**
>
> - 開始地点: `code/ch10/lang-comparison/starter/main.sh`
> - 模範解答: `code/ch10/lang-comparison/solution/main.sh`
>
> **推定時間の内訳**: 起動スクリプトの作成20分、node/python/goの測定15分、結果の記録と偏りの考察10分
<!-- handbook:exercise:end -->

**仕様**: `GET /hello/:name` で `Hello, {name}!` を返すだけのサーバ。各 1000 接続で同時アクセス。

**期待される結果**(典型値、ハードウェア依存):

| ランタイム | スループット | p99 レイテンシ | メモリ |
|---|---|---|---|
| Node.js | 30k req/s | 30ms | 80MB |
| Go (net/http) | 100k+ req/s | 5ms | 30MB |
| Python (FastAPI + uvicorn) | 15k req/s | 50ms | 70MB |
| Bun | 80k req/s | 8ms | 50MB |
| Rust (Actix) | 200k+ req/s | 3ms | 20MB |

「実装の質」「ベンチマーク方法」で結果は変わるが、**桁違いの差はある**ことを実感する。

模範解答: `code/ch10/lang-comparison/`(Node.js は完成、他はテンプレートのみ)

---

<!-- handbook:code-usage:start {"chapter":10} -->
### 第10章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第10章の模範解答をまとめて検証する
pnpm --filter @handbook/ch10 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch10 exec tsx echo-server.solution.ts    # 課題10.1
node code/ch10/thread-vs-event/solution/main.mjs                 # 課題10.2
pnpm --filter @handbook/ch10 exec tsx green-threads.solution.ts  # 課題10.3
bash code/ch10/lang-comparison/solution/main.sh                  # 課題10.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch10/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-11"></a>
## 第11章 Webフレームワーク設計論

第10章で、ランタイムが接続待ち、I/O、CPU処理をどのように実行するかを比較した。しかし、生のHTTPサーバだけで業務APIを作ると、URLの照合、入力の解釈、認証、ログ、例外処理をエンドポイントごとに書くことになる。実行性能を選べても、リクエスト処理の構造がばらばらでは変更と検証に耐えない。

本章では、繰り返し現れる処理をルーティング、ミドルウェア、依存性注入という抽象へ分ける。Express風の最小実装からFastify、Hono、NestJSまでを同じ責務の組み合わせとして読むことで、フレームワーク固有のAPIに依存せず設計判断を説明できるようにする。その処理構造を外部利用者と安定して接続するには、次にAPI契約を設計する必要がある。

<!-- handbook:chapter-guide:start {"chapter":11} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> フレームワークの魔法に依存せず、ルーティング、ミドルウェア、DI、エラー処理の責務を理解して拡張可能なサーバを作る。
>
> **到達目標**
> - ミドルウェアチェーンとOnionモデルを説明できる。
> - ルーティング、入力検証、エラー処理、DIの境界を設計できる。
> - フレームワーク選択を要件と組織条件から説明できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [2.8 実装例: Node.jsで生のHTTPサーバを書く](02-part1-foundations.md#section-2-8) (実務選択) ― 生のHTTPサーバ
> - [10.1 並行性モデルの3パターン](#section-10-1) ― 並行性モデル
>
> **中核概念**  
> [11.1 「ミドルウェア」というアイディア](#section-11-1)、[11.2 100行で作る Express 風フレームワーク](#section-11-2) (発展)、[11.6 ミドルウェアの仕組み ― Onion vs Chain](#section-11-6)、[11.7 依存性注入 (DI) とテスタビリティ](#section-11-7)、[11.8 フレームワーク選択の指針](#section-11-8)
>
> **最小実装**  
> [11.2 100行で作る Express 風フレームワーク](#section-11-2) (発展)、[11.9 実装課題 ― フレームワークの中核を作る](#section-11-9) (実務選択)
>
> **本番実装との差分**
> - 自作フレームワークはHTTP準拠、セキュリティ、ストリーミング、プラグイン互換、運用機能を省略する。
>
> **典型的な失敗**
> - ミドルウェアの順序を暗黙にする。
> - 例外をレスポンスへ変換する場所が複数ある。
> - DIコンテナで依存関係を隠す。
>
> **診断・デバッグ方法**
> - 各ミドルウェアの開始・終了・例外をrequest ID付きで記録する。
> - ルート表と依存グラフを可視化する。
>
> **意思決定チェックリスト**
> - 薄いフレームワークと統合型のどちらがチームに合うか。
> - 横断関心事をどの層で扱うか。
>
> **演習と評価基準**  
> 対象: [11.9 実装課題 ― フレームワークの中核を作る](#section-11-9) (実務選択)
> - ミニフレームワークで順序、例外、非同期処理を検証できる。
>
> **一次資料・発展資料**
> - Express documentation
> - Fastify documentation
> - Hono documentation
> - NestJS documentation
<!-- handbook:chapter-guide:end -->

<a id="section-11-1"></a>
### 11.1 「ミドルウェア」というアイディア
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"11.1"} -->
ランタイムを選べばHTTP要求を受け取れるが、実務の処理は本体ロジックだけではない。認証、ログ、CORS、例外変換のように多くのルートへ共通する責務を重複させず、順序を明示して合成するためにミドルウェアが必要になる。

最初期のWebサーバは1関数で「リクエストを受けてレスポンスを返す」だけだった。しかし実務では、認証チェック、ロギング、CORS処理、レート制限など、複数の処理を組み合わせたい。これを綺麗に書くために生まれた抽象が**ミドルウェアパターン**だ。

Expressに代表されるミドルウェアパターン:

```typescript
// Express スタイル
app.use(loggerMiddleware);
app.use(corsMiddleware);
app.use(authMiddleware);
app.get('/api/users', handler);

// 各ミドルウェアは (req, res, next) のシグネチャ
function loggerMiddleware(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();  // 次のミドルウェアへ
}
```

これは関数の合成 (function composition) の応用だ。リクエストは関数のパイプラインを順に通り抜け、最終的にレスポンスが返る。

<a id="section-11-2"></a>
### 11.2 100行で作る Express 風フレームワーク
<!-- handbook:learning {"level":"advanced","minutes":25} -->
<!-- handbook:index {"group":"E","term":"Express (自作)"} -->

<!-- handbook:narrative-bridge {"section":"11.2"} -->
ミドルウェアを関数の列として使えることは分かったが、その列をどのように登録し、URLへ対応付け、非同期に実行するかを理解しなければフレームワークの挙動は追えない。最小実装を作り、抽象の境界をコードで確かめる。

ミドルウェアパターンを理解するため、自作してみる。

```typescript
// mini-express.ts
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

type Req = IncomingMessage & {
  params: Record<string, string>;
  query: URLSearchParams;
  body?: any;
};
type Res = ServerResponse & {
  json: (data: any, status?: number) => void;
  status: (code: number) => Res;
};
type Next = (err?: Error) => void;
type Handler = (req: Req, res: Res, next: Next) => void | Promise<void>;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

class MiniExpress {
  private middlewares: Handler[] = [];
  private routes: Route[] = [];

  use(handler: Handler) {
    this.middlewares.push(handler);
    return this;
  }

  private addRoute(method: string, path: string, handler: Handler) {
    // /users/:id → 正規表現 + key 配列に変換
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/:([\w]+)/g, (_m, key) => {
          keys.push(key);
          return '([^/]+)';
        }) +
        '/?$'
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get(path: string, handler: Handler)    { return this.addRoute('GET', path, handler); }
  post(path: string, handler: Handler)   { return this.addRoute('POST', path, handler); }
  put(path: string, handler: Handler)    { return this.addRoute('PUT', path, handler); }
  delete(path: string, handler: Handler) { return this.addRoute('DELETE', path, handler); }

  // ミドルウェアと最終ハンドラを順に実行
  private async run(req: Req, res: Res, handlers: Handler[]) {
    let idx = 0;
    const next: Next = async (err) => {
      if (err) {
        // エラーハンドラがあればそこへ
        res.status(500).json({ error: err.message });
        return;
      }
      const h = handlers[idx++];
      if (!h) return;
      try {
        await h(req, res, next);
      } catch (e) {
        next(e as Error);
      }
    };
    await next();
  }

  listen(port: number, cb?: () => void) {
    const server = createServer(async (rawReq, rawRes) => {
      const url = new URL(rawReq.url ?? '/', `http://${rawReq.headers.host}`);
      const req = rawReq as Req;
      req.query = url.searchParams;
      req.params = {};

      // ボディ収集 (POST/PUT/PATCH のJSONを想定)
      if (['POST', 'PUT', 'PATCH'].includes(req.method ?? '')) {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const text = Buffer.concat(chunks).toString('utf-8');
        try { req.body = text ? JSON.parse(text) : {}; }
        catch { req.body = text; }
      }

      // res の拡張
      const res = rawRes as Res;
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (data: any, status = 200) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(data));
      };

      // マッチするルートを探す
      const route = this.routes.find(r =>
        r.method === req.method && r.pattern.test(url.pathname)
      );

      if (!route) {
        // ミドルウェアだけ実行し、404
        await this.run(req, res, [
          ...this.middlewares,
          (_req, res) => res.status(404).json({ error: 'Not Found' }),
        ]);
        return;
      }

      // パラメータ抽出
      const match = url.pathname.match(route.pattern)!;
      route.keys.forEach((key, i) => { req.params[key] = match[i + 1]; });

      // ミドルウェア → ハンドラ
      await this.run(req, res, [...this.middlewares, route.handler]);
    });
    server.listen(port, cb);
    return server;
  }
}

// 使ってみる
const app = new MiniExpress();

app.use(async (req, res, next) => {
  const start = Date.now();
  await next();
  console.log(`${req.method} ${req.url} - ${Date.now() - start}ms`);
});

app.use(async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (req.url?.startsWith('/protected') && auth !== 'Bearer secret') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await next();
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Alice' });
});

app.post('/users', (req, res) => {
  res.json({ created: req.body }, 201);
});

app.get('/protected/data', (req, res) => {
  res.json({ secret: 42 });
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

このわずかなコードで、Express の核心 ― ミドルウェアチェーン、ルーティング、URL パラメータ、JSON (JavaScript Object Notation) ボディ ― が動く。実物の Express はエラー処理 (4引数のミドルウェア)、Router (サブルータ)、テンプレートエンジン連携などを持つが、骨格は同じだ。

<a id="section-11-3"></a>
### 11.3 Fastify ― パフォーマンス志向の現代版
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"11.3"} -->
最小フレームワークは処理の骨格を示すが、本番では入力検証、シリアライズ、プラグイン管理が性能と安全性へ直結する。Fastifyはこれらをスキーマ中心に統合し、薄い抽象のまま高負荷へ対応する設計例である。

Fastify (2017年〜) は、スキーマ駆動と低オーバーヘッドを重視するフレームワーク。

- **性能志向**: ルーティングに find-my-way (radix tree) を使用。実際の性能差はルート数、プラグイン、バリデーション、ログ、レスポンス処理を含むワークロードで測定する
- **スキーマベース**: JSON Schema でリクエスト/レスポンスのバリデーションと型生成
- **プラグインシステム**: Express のミドルウェアより構造化
- **公式 TypeScript サポート**

```typescript
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

const userSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
  },
};

fastify.post('/users', {
  schema: {
    body: userSchema,
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  handler: async (request, reply) => {
    const { name, email } = request.body as { name: string; email: string };
    const user = { id: crypto.randomUUID(), name, email };
    reply.code(201).send(user);
  },
});

fastify.listen({ port: 3000 });
```

スキーマを定義すれば自動でバリデーションされ、レスポンスもスキーマに従ってシリアライズされる (これが高速化に効く)。

<a id="section-11-4"></a>
### 11.4 Hono ― エッジとマルチランタイム
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"ま行","term":"ミドルウェア"} -->

<!-- handbook:narrative-bridge {"section":"11.4"} -->
高性能な単一サーバを作れても、エッジランタイムや複数のJavaScript環境へ同じ処理を配置する場合、Node.js固有APIへの依存が移植性を下げる。HonoはWeb標準のRequestとResponseを共通境界にして、実行場所を差し替えやすくする。

Hono (2022年〜) は注目すべき新しい選択肢。

- **複数ランタイム対応**: Node.js、Deno、Bun、Cloudflare Workers、Vercel Edge など同じコードで動く
- **超軽量**: 数十KB
- **Web 標準 API ベース**: `Request`、`Response` を使う

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ id, name: 'Alice' });
});

app.post('/users', async (c) => {
  const body = await c.req.json();
  return c.json({ created: body }, 201);
});

// Node, Deno, Bun, Workers 等、ランタイムに応じた起動
export default app;
```

エッジコンピューティング (CDN ノードで動く軽量実行環境) では、起動が速く・サイズが小さい必要があり、Express は重すぎる。Hono はこの領域で標準的になりつつある。

<a id="section-11-5"></a>
### 11.5 NestJS ― エンタープライズ志向
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"11.5"} -->
薄く移植可能なフレームワークは自由度を与えるが、大規模チームではモジュール境界、依存関係、検証方法を各案件で決める負担が残る。NestJSは規約とDIを前面に出し、その設計判断を組織全体で共有する方向を選ぶ。

NestJS (2017年〜) はAngular風の構造を Node.js に持ち込んだ。

- **モジュール、コントローラ、サービス**の三層構造
- **依存性注入 (DI)** の本格サポート
- **デコレータ**でメタデータ宣言
- **GraphQL、WebSocket、マイクロサービス**の統合
- **TypeORM、Prisma などの統合**

```typescript
// users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string; email: string }) {
    return this.usersService.create(body);
  }
}

// users.service.ts
@Injectable()
export class UsersService {
  findOne(id: string) { /* ... */ }
  create(data: { name: string; email: string }) { /* ... */ }
}
```

NestJSはボイラープレートが多いが、大規模チームでは「**構造を強制してくれる**」のが利点になる。Spring (Java)、Rails の哲学に近い。

<a id="section-11-6"></a>
### 11.6 ミドルウェアの仕組み ― Onion vs Chain
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"ま行","term":"ミドルウェア"} -->

<!-- handbook:narrative-bridge {"section":"11.6"} -->
各フレームワークの機能一覧だけでは、同じミドルウェアでも処理前後の実行順や例外の伝播がなぜ異なるかを説明できない。ChainとOnionの制御構造を比較し、ログやトランザクションの配置へどう影響するかを確認する。

ミドルウェアパターンには2種類ある。

**Chain (Express 風)**:

```text
リクエスト → MW1 → MW2 → Handler → レスポンス
             (next)  (next)   (res.send)

ハンドラから戻ったあとに MW2 や MW1 の続きは自動では実行されない
```

各ミドルウェアは `next()` を呼んで次へ渡す。制御は前へ進むだけで、ハンドラの処理が終わっても呼び出し元のミドルウェアへは戻らない。だから「処理の前後を挟む」ことが素直には書けない。ハンドラの後で何かしたい場合は、`next()` を `await` して戻りを待つか、レスポンスの送信イベントを購読する必要がある。

**Onion (Koa、NestJSのインターセプター)**:

```text
       ↓ before    ↑ after
   ┌─────────────────┐
   │   ┌───────────┐ │
   │   │   ┌─────┐ │ │
   │   │   │ MW3 │ │ │
   │   │   └─────┘ │ │
   │   │    MW2    │ │
   │   └───────────┘ │
   │        MW1      │
   └─────────────────┘
```

Koa の例:

```typescript
import Koa from 'koa';
const app = new Koa();

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();           // 内側のミドルウェアを実行
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

app.use(async (ctx) => {
  ctx.body = 'Hello';
});

app.listen(3000);
```

Onion モデルの利点は、`await next()` の前後で「リクエスト前」「レスポンス後」の処理を自然に書けること。

<a id="section-11-7"></a>
### 11.7 依存性注入 (DI) とテスタビリティ
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"D","term":"Dependency Injection"} -->

<!-- handbook:narrative-bridge {"section":"11.7"} -->
処理をミドルウェアとハンドラへ分割すると、今度はそれぞれがDB、設定、外部APIクライアントをどこで取得するかが問題になる。依存性注入は生成と利用を分離してテスト可能にするが、依存グラフを隠さない設計が必要である。

依存性注入は「**コンポーネントが依存するものを外から渡す**」設計パターン。テストしやすさ、置き換えやすさ、結合度の低さに直結する。

**DIなし (悪い例):**

```typescript
class UserService {
  async getUser(id: string) {
    // データベースに直接結合している
    const db = new PostgresClient(process.env.DATABASE_URL);
    return db.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}

// テストできない: DB が起動していないと動かない
```

**DIあり (良い例):**

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
}

class PostgresUserRepository implements UserRepository {
  constructor(private db: PostgresClient) {}
  findById(id: string) { /* ... */ }
}

class UserService {
  constructor(private repo: UserRepository) {}
  getUser(id: string) {
    return this.repo.findById(id);
  }
}

// テスト時はモックを渡せる
const mockRepo: UserRepository = {
  findById: async (id) => ({ id, name: 'Test' }),
};
const service = new UserService(mockRepo);
```

NestJSのような DI コンテナは、これを自動でやってくれる (どのインタフェースに何を割り当てるかを宣言)。

DIコンテナを使わない場合でも、コンストラクタで依存を受け取る設計にしておけば、テストとリプレースが容易になる。これは言語・フレームワークによらない普遍的な設計原則だ。

<a id="section-11-8"></a>
### 11.8 フレームワーク選択の指針
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"11.8"} -->
ルーティング、ミドルウェア、DIの役割が分かれば、フレームワークを機能数や流行だけで選ぶ必要はなくなる。チーム規模、実行環境、規約の強さ、拡張点を照合し、どの判断をフレームワークへ委ねるかを決める。

| 状況 | 選択 |
|---|---|
| 成熟したミドルウェア資産、既存Express知識 | Express |
| スキーマ駆動、性能測定を重視 | Fastify |
| Web標準API、複数ランタイム、エッジ | Hono |
| DIと規約による大規模チームの構造化 | NestJS |
| 小さなコアとOnionモデル | Koa |

これは開始点であり、採用前に保守状況、セキュリティ更新、プラグイン互換性、デプロイ先、観測性を確認する。
| Next.js のAPI Routes | (内蔵、シンプル用途のみ) |

新規プロジェクトで迷うなら、規模に応じて Hono (小〜中) または NestJS (大) が現代的な選択だ。

<a id="section-11-9"></a>
### 11.9 実装課題 ― フレームワークの中核を作る
<!-- handbook:learning {"level":"practical","minutes":250} -->

<!-- handbook:narrative-bridge {"section":"11.9"} -->
抽象の比較を実務判断へ変えるには、登録、照合、合成、依存解決を自分で実装して失敗経路を観測するのが有効である。最小フレームワークを通じて、製品ごとのAPIの背後にある共通構造を確認する。

第11章では Express 風のミニフレームワーク (11.2) を実装した。本節ではそれを発展させ、現代フレームワークの主要機能をすべて実装する。所要時間: 演習カードの推定時間の合計で8時間。

#### 課題11.1: Express風APIの最小サブセットを持つフレームワーク (★★★)

**目的**: 本書 11.2 のミニ Express を拡張して、実プロダクトで使える完成度にする。

<!-- handbook:exercise:start {"id":"11.1"} -->
> **演習カード 課題11.1** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 11.2 100行で作る Express 風フレームワーク を読み、ルータ・ミドルウェア・レスポンス送出の責務分担を確認する
> - 2.8 実装例: Node.jsで生のHTTPサーバを書く を読み、http.createServer のリクエストとレスポンスを扱えるようにする
> - 課題11.2 と 課題11.4 を先に終え、runOnion と TrieRouter を利用できる状態にする
> - TypeScript の async 関数と for await ... of でリクエストストリームを読める
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `app.get(path, handler)` と `app.post(path, handler)` でルートを登録でき、`/users/:id` の値が params から取れる
> - [ ] `app.use(middleware)` で登録したミドルウェアが登録順に実行され、next() の後の処理も走る
> - [ ] content-type が application/json のPOSTでボディがパースされ、ハンドラから参照できる
> - [ ] 未登録パスへの要求が 404 と error キーを持つJSONを返す
> - [ ] ハンドラが投げた例外がエラーハンドラへ渡り、レスポンスが 500 と error キーのJSONになる
> - [ ] listen(0) が実際に割り当てられたポート番号と close() を返す
>
> **期待出力**
>
> - `GET /users/7` が 200 と id に 7 を持つJSONを返し、content-type が application/json; charset=utf-8 になる
> - ミドルウェアで設定したカスタムヘッダ (例 x-middleware) がレスポンスに現れる
> - `POST /echo` にJSONを送ると同じJSONがそのまま返る
> - 存在しないパスは HTTP 404 を返す
>
> **観察項目**
>
> - ミドルウェアの `await next()` の前後にログを置き、外側から内側、内側から外側の順に出力されることを確認する
> - ハンドラの戻り値が文字列・Buffer・オブジェクトの場合で content-type の付き方が変わることを見る
> - ボディサイズ上限を小さくして大きなJSONを送り、body_too_large が例外経路へ流れることを確認する
> - 同じミドルウェアで next() を2回呼び、二重呼び出しが検出されることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `MiniExpress handles middleware, JSON body, routes, and 404` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch11 run typecheck` を実行し、型エラーが0件であることを確認する
> 3. サーバを起動して `curl -i -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:PORT/echo` を実行し、200 とJSONが返れば合格
> 4. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:PORT/missing` が 404 を返すことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 1リクエストにつき1つのコンテキストオブジェクトを作り、ルータもミドルウェアも「コンテキストを書き換える関数」に統一する。そうするとレスポンス送出を1か所へまとめられる。
> 2. **構造**: ミドルウェア列の末尾にルーティング用の関数を足し、runOnion を1回呼ぶ構成にする。ボディパースは for await でチャンクを集めて JSON.parse する。ポート待ちは once(server, 'listening') を使う。
> 3. **実装の要点**: レスポンスを書くのは res.writableEnded が false のときだけにする。エラーハンドラと通常経路の双方が書き込むと ERR_STREAM_WRITE_AFTER_END になる。ボディ読み取りには必ずバイト数上限を設ける。
>
> **本番利用時の警告**
>
> - この自作フレームワークは HEAD/OPTIONS、Expect: 100-continue、圧縮、Keep-Alive調整、リクエストタイムアウトを実装していない。そのまま公開すると仕様非準拠とハングした接続の滞留を招く。
> - 静的ファイル配信を足すときはパス正規化を必ず行う。`..` を含むパスをそのまま結合すると、ディレクトリトラバーサルで公開ディレクトリ外のファイルが読み出される。
> - エラー時に例外オブジェクトをそのままJSONへ入れると、スタックトレースと内部パスが外部へ漏れる。本番ではrequest IDだけ返し、詳細はログ側に残す。
>
> **導線**
>
> - 開始地点: `code/ch11/mini-express.ts`
> - 模範解答: `code/ch11/mini-express.solution.ts`
>
> **推定時間の内訳**: ルータとミドルウェア統合の実装60分、ボディパースとエラー処理40分、静的配信と非同期例外の自動キャッチ30分、テストと手動確認20分
<!-- handbook:exercise:end -->

**機能要件**:
- ✓ メソッド別ルーティング (`app.get`、`app.post`、…)
- ✓ パスパラメータ (`/users/:id` → `req.params.id`)
- ✓ クエリパース (`req.query`)
- ✓ JSON ボディパース (`req.body`)
- ✓ ミドルウェアチェイン (`app.use(fn)`)
- ✓ エラー処理 (`(err, req, res, next) => {}`)
- ✓ Router(`const router = new Router()`、`app.use('/api', router)`)
- ✓ 静的ファイル配信 (`app.use(serveStatic('./public'))`)

**追加課題**: 
- async ハンドラの例外を自動キャッチ (express-async-errors 相当)
- 型安全なパスパラメータ (`/users/:id<number>` → `req.params.id: number`)

模範解答: `code/ch11/mini-express.solution.ts`(約 200 行)

#### 課題11.2: ミドルウェアパターンの比較実装 (★★)

**目的**: Onion(Koa 風) と Chain(Express 風) の違いを実装で理解する。

<!-- handbook:exercise:start {"id":"11.2"} -->
> **演習カード 課題11.2** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 11.6 ミドルウェアの仕組み ― Onion vs Chain を読み、2方式の実行順の違いを確認する
> - 11.1 「ミドルウェア」というアイディア を読み、横断関心事をどこへ置くかの前提を持つ
> - async/await と Promise の解決順を追える
> - Node.js 24 系と tsx で TypeScript を直接実行できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] runChain(middlewares, context) と runOnion(middlewares, context) の2関数を実装する
> - [ ] Chain版は同期の next()、Onion版は await next() を受け取る型定義になっている
> - [ ] Onion版の実行ログが 1 before / 2 before / 2 after / 1 after の順になる
> - [ ] 同じミドルウェア内で next() を2回呼ぶと `next() called more than once` が投げられる
> - [ ] 所要時間計測ミドルウェアを Onion で書き、await next() の直後に下流全体の経過時間が取れる
>
> **期待出力**
>
> - Chain の実行ログが a-before / b / a-after の3要素配列になる
> - Onion の実行ログが a-before / b-before / b-after / a-after の4要素配列になる
> - middleware-patterns.solution.ts を直接実行すると chainLog と onionLog を含むオブジェクトが1回出力される
>
> **観察項目**
>
> - Chain版で next() の後に非同期処理を置き、下流の完了を待たずに実行されてしまうことを確認する
> - 計測ミドルウェアを Chain と Onion の両方で書き、Chain では下流の非同期完了時刻を取れないことを見る
> - 二重呼び出し検出を外して next() を2回呼び、下流が2度実行されることを再現する
> - ミドルウェアの登録順を入れ替え、ログの入れ子構造が対応して変わることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `chain and onion execution orders are observable` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch11 exec tsx middleware-patterns.solution.ts` を実行し、chainLog が3要素、onionLog が4要素で出力されれば合格
> 3. 下流で50ms待つハンドラを置いた計測ミドルウェアを Onion に追加し、記録値が50ms以上になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: どちらの方式も「i番目を呼ぶ関数」を再帰的に組み立てるだけで書ける。違いは next() が Promise を返して待てるかどうかだけ、という点に注目する。
> 2. **構造**: dispatch(i) を定義し、i番目のミドルウェアへ `() => dispatch(i + 1)` を渡す。Onion版は dispatch を async にして await する。呼び出し済みの位置を変数へ記録しておく。
> 3. **実装の要点**: 二重呼び出しの検出は「今回の位置が記録済み位置以下なら throw」の1行で足りる。これが無いと next() を2回呼んだミドルウェアが下流を2度実行し、レスポンスを二重送信する。
>
> **本番利用時の警告**
>
> - この最小実装は例外がどのミドルウェアで発生したかを記録しない。そのまま運用に載せると障害時の切り分けができないため、本番ではrequest IDと各段の開始・終了・例外をログに残す。
> - Onion 方式は await next() の後にも処理が続くため、レスポンス送出後の後処理で失敗しても利用者へは伝わらない。後処理の例外を握り潰さない設計が要る。
>
> **導線**
>
> - 開始地点: `code/ch11/middleware-patterns.ts`
> - 模範解答: `code/ch11/middleware-patterns.solution.ts`
>
> **推定時間の内訳**: Chain版とOnion版の実装40分、実行順ログの比較と計測ミドルウェア追加30分、二重呼び出しなど失敗系の確認20分
<!-- handbook:exercise:end -->

**Express 風 (Chain)**:
```typescript
app.use((req, res, next) => {
  console.log('1 before');
  next();
  console.log('1 after');  // 下流が同期なら実行される。下流が非同期だと完了を待たずに実行される
});
app.use((req, res, next) => {
  console.log('2 before');
  res.end('done');
});
// 出力: "1 before", "2 before", "1 after"
// ※ 下流が非同期の場合、"1 after" は下流の完了前に出る。これが Chain の限界である
```

**Koa 風 (Onion)**:
```typescript
app.use(async (ctx, next) => {
  console.log('1 before');
  await next();
  console.log('1 after');
});
app.use(async (ctx, next) => {
  console.log('2 before');
  ctx.body = 'done';
  await next();
  console.log('2 after');
});
// 出力: "1 before", "2 before", "2 after", "1 after"
```

**要件**: 両方を実装して、計測ミドルウェア (リクエスト時間記録) を Onion で書きやすいことを確認する。

```typescript
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  // ↑ ここで全処理が完了している
  console.log(`${ctx.path}: ${Date.now() - start}ms`);
});
```

模範解答: `code/ch11/middleware-patterns.solution.ts`

#### 課題11.3: DI コンテナを自作 (★★★)

**目的**: NestJS や Angular で使われる DI コンテナの中身を実装する。

<!-- handbook:exercise:start {"id":"11.3"} -->
> **演習カード 課題11.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 11.7 依存性注入 (DI) とテスタビリティ を読み、生成と利用を分離する目的を確認する
> - 11.5 NestJS ― エンタープライズ志向 を読み、provider、token、scope の語彙を把握する
> - TypeScript のクラス、static プロパティ、ジェネリクスを読み書きできる
> - Map を使ったレジストリと再帰的な解決処理を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `container.bind(Klass)` で登録し `container.get(Klass)` でインスタンスを取得できる
> - [ ] 依存を宣言したクラスがコンストラクタ引数として自動注入される
> - [ ] 同じトークンを2回 get すると同一インスタンスが返る
> - [ ] useValue / useFactory / useClass の3種類の provider を受け付ける
> - [ ] 循環依存を検出し、解決経路を矢印で連結した `Circular dependency:` の例外を投げる
> - [ ] 未登録トークンの get で `No provider for ...` を投げる
>
> **期待出力**
>
> - 依存先のメソッド呼び出し結果 (例 Alice を含む配列) が注入先から取得できる
> - `container.get(Service) === container.get(Service)` が true になる
> - 循環依存を作ると、解決経路を含む例外メッセージが表示される
> - 未登録トークンでは例外メッセージにトークン名が含まれる
>
> **観察項目**
>
> - clear() の前後で get が返すインスタンスを比較し、シングルトンキャッシュの寿命を確認する
> - useValue でモックへ差し替え、本体コードを変えずにテストが通ることを見る
> - 解決中トークンの一覧を出力し、深い依存グラフでの解決順を追う
> - 依存宣言を書き忘れたクラスを get したときのエラー文言が原因特定に足りるかを評価する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `DI container resolves explicit dependencies and detects cycles` がパスすることを確認する
> 2. 互いを依存に持つ2クラスを登録して get を呼び、Circular dependency の例外が投げられれば合格
> 3. `pnpm --filter @handbook/ch11 run typecheck` を実行し、bind と get の型パラメータが崩れていないことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: コンテナは「トークンから生成方法へのMap」と「トークンから生成済み値へのMap」の2枚で表せる。まず値を返すだけの provider を通し、その後にクラス生成を足す。
> 2. **構造**: provider を useValue / useFactory / useClass の判別可能なユニオンにし、get の中で in 演算子で分岐する。依存一覧は static inject か deps から取り、map した結果を new へ展開する。
> 3. **実装の要点**: TypeScript は emitDecoratorMetadata 無しでは実行時にコンストラクタ引数の型を取れないため、依存は static inject などで明示する。解決中トークンは finally で必ず取り除かないと、例外後に偽の循環依存が報告される。
>
> **本番利用時の警告**
>
> - このコンテナは全バインディングを暗黙にシングルトンとして保持する。リクエストごとの状態を持つクラスを登録すると、利用者間でデータが混ざり別ユーザーの情報が見える。
> - 文字列トークンでの束縛はタイプミスを実行時まで検出できない。DIで依存を隠すほど、起動時に落ちるべき設定ミスがリクエスト時の500へ変わる。
>
> **導線**
>
> - 開始地点: `code/ch11/di-container.ts`
> - 模範解答: `code/ch11/di-container.solution.ts`
>
> **推定時間の内訳**: Container本体の実装50分、provider3種とスコープの追加40分、循環依存検出とモック差し替えのテスト40分、型パラメータの整理20分
<!-- handbook:exercise:end -->

**要件**:

```typescript
// サービスを宣言
class UserRepository {
  findAll() { return [{ id: 1, name: 'Alice' }]; }
}

class UserService {
  constructor(private repo: UserRepository) {}
  getAll() { return this.repo.findAll(); }
}

// DI コンテナにバインド
const container = new Container();
container.bind(UserRepository).toSelf();
container.bind(UserService).toSelf();

// 解決(依存も自動で注入)
const service = container.get(UserService);
console.log(service.getAll());
```

**機能**:
- ✓ コンストラクタ引数の自動解決
- ✓ シングルトン vs 都度新規 (scope)
- ✓ インタフェース → 実装の binding
- ✓ テスト用のモック差し替え

ヒント: TypeScript の `reflect-metadata` で型情報を保持。デコレータ `@Injectable()`。

模範解答: `code/ch11/di-container.solution.ts`

#### 課題11.4: ルーティングの Trie ベース実装 (★★)

**目的**: ルートを登録順に線形探索する実装と、パスセグメントをTrie/Radix Treeで共有する実装を比較する。探索量は実装により、前者は最悪時に登録ルート数、後者は主にパス長・分岐数に依存する。

<!-- handbook:exercise:start {"id":"11.4"} -->
> **演習カード 課題11.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 11.2 100行で作る Express 風フレームワーク の正規表現ベースのルーティングを読む
> - 11.4 Hono ― エッジとマルチランタイム を読み、高速ルータが何を前提に速いのかを確認する
> - Map と再帰関数でツリー構造を構築・探索できる
> - performance.now() で処理時間を計測できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `router.add(method, pattern, handler)` で `/users/:id/posts/:postId` のようなパターンを登録できる
> - [ ] `router.match('GET', '/users/42/posts/9')` が handler と id=42、postId=9 のパラメータを返す
> - [ ] `/assets/*path` のワイルドカードが残りのパス全体を1つのパラメータへ入れる
> - [ ] ワイルドカードを末尾以外に置くと `Wildcard must be the final segment` を投げる
> - [ ] 1000ルート登録・10000回ルックアップのベンチで、線形走査版と所要時間を比較した数値が出る
> - [ ] 未登録のメソッドやパスでは null が返る
>
> **期待出力**
>
> - マッチ結果が handler と params の2つを持ち、params のキーがパターンの :名前 と一致する
> - `/assets/js/app.js` のマッチで path パラメータが js/app.js になる
> - ベンチ出力で、登録ルート数を増やしたときTrie版のルックアップ時間の伸びが線形走査版より緩いことが読み取れる
> - パーセントエンコードされたセグメントがデコード済みでパラメータに入る
>
> **観察項目**
>
> - 登録ルート数を10、100、1000と増やし、線形走査版が線形に遅くなるのに対しTrie版がほぼ横ばいであることを確認する
> - `/users/new` と `/users/:id` を同時に登録し、静的セグメントが優先されることを見る
> - バックトラックが起きるパターン (`/a/:b/c` と `/a/x/:d`) を登録し、探索が別枝へ戻る様子をログで追う
> - 末尾スラッシュや連続スラッシュを与えたときのセグメント分割結果を確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch11 run test` を実行し、テスト `Trie router extracts parameters and wildcard` がパスすることを確認する
> 2. 1000ルートを登録するスクリプトを書き、performance.now() でTrie版と線形走査版の10000回ルックアップを測って両方の数値が出れば合格
> 3. `router.add('GET', '/a/*x/b', handler)` を呼び、Wildcard must be the final segment の例外が出ることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: パスを / で分割したセグメント列を木の階層に対応させる。各ノードに「静的な子のMap」「パラメータの子」「ワイルドカードの子」の3種の出口を持たせればよい。
> 2. **構造**: ノードは staticChildren、parameter、wildcard、handlers の4フィールドで表し、handlers はメソッド名をキーにする。match は再帰関数にして、静的一致、パラメータ一致、ワイルドカードの順に試す。
> 3. **実装の要点**: 静的一致を先に試して失敗したらパラメータへ戻る、というバックトラックを実装しないと、`/users/new` と `/users/:id` を同時登録したときに片方が到達不能になる。パラメータ値には decodeURIComponent を掛ける。
>
> **本番利用時の警告**
>
> - このルータはパス長やセグメント数の上限を持たないため、極端に深いパスで再帰が深くなりスタックを消費する。公開前にURL長とセグメント数を入口で制限する。
> - ワイルドカードで受けた値をそのままファイルパスへ結合すると、`../` を含む入力でディレクトリトラバーサルが成立する。静的配信に使うなら正規化と配信ルート外の拒否を必ず入れる。
>
> **導線**
>
> - 開始地点: `code/ch11/trie-router.ts`
> - 模範解答: `code/ch11/trie-router.solution.ts`
>
> **推定時間の内訳**: Trie構築とmatchの実装40分、ワイルドカードとバックトラックの対応25分、1000ルートのベンチ作成と比較25分
<!-- handbook:exercise:end -->

**要件**:

```typescript
const router = new TrieRouter();
router.add('GET', '/users/:id', userHandler);
router.add('GET', '/users/:id/posts', postsHandler);
router.add('GET', '/users/:id/posts/:postId', postHandler);
router.add('POST', '/users', createHandler);

// ルックアップ
const match = router.match('GET', '/users/42/posts/123');
// → { handler: postHandler, params: { id: '42', postId: '123' } }
```

**評価基準**:
- 1000 ルート登録、10000 リクエストのベンチで正規表現版より速い
- パラメータ抽出が正しい
- ワイルドカード (`*`) も対応

模範解答: `code/ch11/trie-router.solution.ts`

---

<!-- handbook:code-usage:start {"chapter":11} -->
### 第11章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第11章の模範解答をまとめて検証する
pnpm --filter @handbook/ch11 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch11 exec tsx mini-express.solution.ts         # 課題11.1
pnpm --filter @handbook/ch11 exec tsx middleware-patterns.solution.ts  # 課題11.2
pnpm --filter @handbook/ch11 exec tsx di-container.solution.ts         # 課題11.3
pnpm --filter @handbook/ch11 exec tsx trie-router.solution.ts          # 課題11.4
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch11/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-12"></a>
## 第12章 API設計

第11章で、サーバ内部のリクエスト処理をルートとミドルウェアへ分解できるようになった。だが、内部構造が整っていても、URI、入力、成功結果、失敗形式、互換性が利用者ごとに変われば、クライアントは安定して接続できない。また、要求応答、双方向通信、大量データ転送では必要な通信特性も異なる。

本章では、APIを実装関数の公開ではなく、独立して変更されるシステム間の契約として設計する。RESTの制約から出発し、OpenAPI、GraphQL、gRPC、tRPC、WebSocket、SSE (Server-Sent Events) がどの結合を強め、どの問題を解くかを比較する。さらに、JSONの往復では収まらない2つの契約 ― 大きなバイト列を運ぶファイル転送と、自分から相手のサーバへ通知するWebhook ― も、失敗を前提にした形で設計する。契約が定まった後も、呼び出した主体が誰で、その操作を許可できるかは未解決であり、第13章では信頼境界を加える。

<!-- handbook:chapter-guide:start {"chapter":12} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> クライアント追加、仕様変更、エラー処理、リアルタイム通信で破綻しない契約を設計する。
>
> **到達目標**
> - リソース指向APIと操作指向APIの使い分けを説明できる。
> - ページネーション、エラー、バージョニング、スキーマを一貫して設計できる。
> - REST、GraphQL、gRPC、WebSocket、SSEを要件で比較できる。
> - ファイル転送とWebhookを、失敗を前提にした契約として設計できる。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [2.2 メソッドの意味論](02-part1-foundations.md#section-2-2) ― HTTPメソッドの意味論
> - [11.1 「ミドルウェア」というアイディア](#section-11-1) ― ミドルウェア
>
> **中核概念**  
> [12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す](#section-12-1)、[12.3 リソース指向設計の実践](#section-12-3)、[12.4 ページネーション、フィルタ、ソート](#section-12-4)、[12.5 エラーレスポンスの設計](#section-12-5)、[12.6 OpenAPI ― API設計の標準仕様](#section-12-6)、[12.12 API方式選択の指針](#section-12-12)、[12.13 ファイルアップロードの転送方式 ― multipart と presigned URL](#section-12-13) (実務選択)、[12.15 Webhook の設計 ― イベント契約と署名](#section-12-15) (実務選択)
>
> **最小実装**  
> [12.16 実装課題 ― API設計の核を実装する](#section-12-16) (実務選択)
>
> **本番実装との差分**
> - 最小API例は認証、認可、レート制限、監査、後方互換、部分障害を省略する。
> - 転送方式の例はウイルススキャン、検疫、配信オリジンの分離を省略する。内容の検証は23.26が扱う。
>
> **典型的な失敗**
> - URIへ動詞を乱用する。
> - オフセットページングを大規模更新データへ無条件適用する。
> - エラー形式をエンドポイントごとに変える。
> - サイズ上限や種別を仕様書だけに書き、署名条件へ入れない。
> - Webhookの再送でイベントIDを振り直し、受信側の重複排除を不可能にする。
>
> **診断・デバッグ方法**
> - 契約テストとOpenAPI差分で破壊的変更を検出する。
> - request ID、入力、状態コード、依存先時間を記録する。
> - アップロードは PENDING と実体の有無を突き合わせ、孤児オブジェクトを数える。
> - Webhookは配送試行、応答コード、署名検証失敗数を配送先ごとに記録する。
>
> **意思決定チェックリスト**
> - 利用者は誰で、更新頻度と互換期間は。
> - 要求は要求応答、ストリーム、双方向のどれか。
> - バイト列をアプリケーションサーバへ通す価値があるか。
> - Webhookで保証しないこと (重複・順序・遅延・欠落) を明示したか。
>
> **演習と評価基準**  
> 対象: [12.16 実装課題 ― API設計の核を実装する](#section-12-16) (実務選択)
> - 同じユースケースを複数API方式で比較し、選定理由を説明できる。
> - 転送方式の選択理由と、上限を強制している場所を指し示せる。
>
> **一次資料・発展資料**
> - Fielding dissertation
> - OpenAPI 3.2 specification
> - GraphQL specification
> - gRPC documentation
> - RFC 7578 multipart/form-data
> - tus resumable upload protocol
> - Standard Webhooks
<!-- handbook:chapter-guide:end -->

<a id="section-12-1"></a>
### 12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"F","term":"Fielding, Roy"} -->
<!-- handbook:index {"group":"R","term":"REST"} -->
<!-- handbook:index {"group":"ら行","term":"リソース指向 (REST)"} -->

<!-- handbook:narrative-bridge {"section":"12.1"} -->
フレームワークによってサーバ内部の処理順は整ったが、外部クライアントには内部関数ではなく長期間維持される通信契約を見せる必要がある。RESTはHTTPの性質を活用しながら、その契約を疎結合に保つ制約の組として理解する。

REST (Representational State Transfer) は Roy Fielding の博士論文 [Fielding, 2000] で定義されたアーキテクチャスタイル。「API は HTTP に従って素直に書け」と曲解されがちだが、本来は6つの制約からなる思想だ。

1. **クライアント/サーバ**: 関心の分離
2. **ステートレス**: サーバはリクエスト間で状態を持たない
3. **キャッシュ可能**: レスポンスはキャッシュ可否を明示
4. **統一インタフェース**: リソース指向、HATEOAS
5. **階層化システム**: 中継 (プロキシ、ゲートウェイ) を許容
6. **コードオンデマンド (オプション)**: クライアントに実行コードを返す

<a id="section-12-2"></a>
### 12.2 Richardson Maturity Model
<!-- handbook:learning {"level":"practical","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"12.2"} -->
RESTの制約は設計原則を示すが、現実のAPIがどこまでその性質を利用しているかには段階がある。Richardson Maturity Modelで、単なるHTTPトンネルから統一インタフェースへ何が加わるかを確認する。

「自分のAPIは本当にRESTか?」を測る指標。

**Level 0**: HTTPをトンネルとして使う。`POST /api` に全部送る (XML-RPC (Remote Procedure Call)、SOAP)
**Level 1**: 複数のリソース URI を持つ (`/users`、`/posts`)
**Level 2**: HTTPメソッドを正しく使う (GET/POST/PUT/DELETE)、ステータスコードも適切
**Level 3**: HATEOAS。レスポンスにリソース間のリンクを含める

```json
// Level 3 のレスポンス例
{
  "id": "42",
  "name": "Alice",
  "_links": {
    "self":   { "href": "/users/42" },
    "orders": { "href": "/users/42/orders" },
    "edit":   { "href": "/users/42", "method": "PUT" }
  }
}
```

実務のほとんどのRESTは Level 2 だ。Level 3 (HATEOAS) は理想だが、コストの割に得るものが少なく、普及していない。

<a id="section-12-3"></a>
### 12.3 リソース指向設計の実践
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"C","term":"CORS"} -->
<!-- handbook:index {"group":"O","term":"OpenAPI"} -->

<!-- handbook:narrative-bridge {"section":"12.3"} -->
成熟度を分類できても、実際の業務概念をどのURIと表現へ割り当てるかは自動的には決まらない。操作名を並べる前に、識別され、取得され、状態遷移する対象をリソースとして切り出す。

RESTの肝は「**動詞ではなく名詞で考える**」こと。

#### CORS ― ブラウザが別オリジンへの要求を制限する仕組み

APIを設計すると、すぐに「ブラウザから別のオリジンのAPIを叩く」場面に出会う。ここで効いてくるのが **CORS (Cross-Origin Resource Sharing)** である。

ブラウザには同一オリジンポリシーがあり、`https://app.example.com` のページから `https://api.example.com` への要求は、デフォルトでは応答を読めない。CORSは、**サーバ側が「このオリジンには読ませてよい」と宣言する**ための仕組みである (2.4 で挙げたヘッダ群)。

- `Access-Control-Allow-Origin`: 応答を読ませるオリジン。`*` は資格情報つきの要求では使えない
- `Access-Control-Allow-Credentials: true`: Cookie や `Authorization` を伴う要求を許す。このとき Origin は具体的な値で返す
- `Access-Control-Allow-Methods` / `-Headers`: プリフライトへの応答で、許すメソッドとヘッダを列挙する
- `Access-Control-Max-Age`: プリフライトの結果をブラウザがキャッシュする秒数

`GET` と、フォームで送れる形の `POST` は**単純要求**として、プリフライトなしで送られる。`Content-Type: application/json` を付けた要求や、独自ヘッダを足した要求は単純要求から外れ、ブラウザは先に `OPTIONS` の**プリフライト**を送って許可を確かめる。

誤解しやすいのは次の2点である。

1. **CORSはサーバを守る仕組みではない。** 制限しているのはブラウザであり、`curl` やサーバ間の通信には効かない。認可は別に必要である (13章)
2. **要求が届かないのではなく、応答が読めない。** 単純要求はプリフライトなしでサーバへ到達し、副作用も起きる。だから CORS を CSRF 対策の代わりにはできない (23.4)

許可するオリジンは、環境変数などから読んだ許可リストと照合して返す。要求の `Origin` をそのまま反射すると、任意のサイトへ応答を読ませることになる。

**よくない設計 (動詞ベース)**:

```text
POST /createUser
POST /getUserList
POST /deleteUser?id=42
```

**良い設計 (リソースベース)**:

```text
POST   /users           # 作成
GET    /users           # 一覧
GET    /users/42        # 取得
PUT    /users/42        # 全置換
PATCH  /users/42        # 部分更新
DELETE /users/42        # 削除
```

**ネストしたリソース**:

```text
GET    /users/42/orders         # ユーザー42の注文一覧
POST   /users/42/orders         # ユーザー42に注文を作成
GET    /orders/abc              # 注文 abc を取得
DELETE /users/42/orders/abc     # 注文を削除
```

**動詞が必要な場合 (アクション)**:

純粋なCRUDで表現できないアクション (公開、承認、リセットなど) は、サブリソースとして表現する。

```text
POST /posts/42/publish         # 投稿を公開
POST /password-reset-requests  # リセットリクエストを作成
```

<a id="section-12-4"></a>
### 12.4 ページネーション、フィルタ、ソート
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"12.4"} -->
単一リソースの形が決まると、次は件数が増え続けるコレクションを安全に返す必要がある。全件返却を避けながら更新中の順序と再取得を扱うため、ページネーション、フィルタ、ソートを契約として設計する。

GET一覧API は単純に「全件返す」では実用にならない。

**ページネーション (2方式):**

```text
# オフセットベース (簡単だが大規模で破綻、ページずれ問題)
GET /users?page=2&per_page=20

# カーソルベース (推奨)
GET /users?after=eyJpZCI6MTAwfQ&limit=20
```

カーソルベースは、最後の項目のID等をエンコードした「カーソル」を次のクエリに渡す方式。データが追加されても重複や抜けが起きにくい。

**フィルタとソート:**

```text
GET /users?status=active&role=admin&sort=-created_at,name
```

`-created_at` で「降順」を表現する慣例。

**部分レスポンス (フィールド選択):**

```text
GET /users/42?fields=id,name,email
```

通信量削減に有効。GraphQL の主要な利点はこれだが、RESTでも実装できる。

<a id="section-12-5"></a>
### 12.5 エラーレスポンスの設計
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"12.5"} -->
正常系の表現を揃えても、入力不備、競合、依存障害がエンドポイントごとに別形式で返れば、クライアントは共通の回復処理を書けない。失敗もAPIの一部として、機械判定できる構造と人が調査できる情報へ分ける。

エラー時にどんなレスポンスを返すかは、APIのUXに直結する。

```json
// RFC 9457 (Problem Details for HTTP APIs) 準拠
{
  "type": "https://example.com/probs/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body has validation errors.",
  "instance": "/users",
  "errors": [
    { "field": "email", "code": "format", "message": "invalid email format" },
    { "field": "password", "code": "min_length", "message": "must be at least 8 characters" }
  ]
}
```

ポイント:

- **HTTPステータスは正しく**: 4xx か 5xx か
- **マシンが分かる識別子**: フロントが分岐できるよう、`type` や `code` を文字列で
- **人間が分かるメッセージ**: `detail`、`message` で日本語表示等に使える
- **エラーが複数なら配列で**: バリデーションは典型例

<a id="section-12-6"></a>
### 12.6 OpenAPI ― API設計の標準仕様
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"N","term":"N+1問題"} -->

<!-- handbook:narrative-bridge {"section":"12.6"} -->
成功と失敗の形式を文章だけで共有すると、実装変更とドキュメントが徐々にずれる。OpenAPIは入出力、状態コード、認証方式を機械可読なスキーマへ置き、検証、生成、差分検出を同じ契約から行えるようにする。

OpenAPI (旧 Swagger) は REST API を YAML/JSON で記述する標準仕様。コード生成、ドキュメント自動化、テスト連携の基盤になる。

```yaml
openapi: 3.2.0
info:
  title: User API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: ユーザー取得
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          $ref: '#/components/responses/NotFound'
components:
  schemas:
    User:
      type: object
      required: [id, name]
      properties:
        id:    { type: string }
        name:  { type: string }
        email: { type: string, format: email }
```

このスキーマから:

- ドキュメント (Swagger UI、Redoc) 自動生成
- クライアントSDK 自動生成 (TypeScript、Pythonなど)
- サーバスタブ生成
- バリデーションコード生成

設計を先に書く「API-first」開発が可能になる。OpenAPI 3.2.0は2025年に公開されたが、コード生成・ゲートウェイ・ドキュメントツールの対応には差があるため、採用バージョンは利用ツール一式で検証する。

<a id="section-12-7"></a>
### 12.7 GraphQL ― クライアント主導のクエリ
<!-- handbook:learning {"level":"practical","minutes":15} -->
<!-- handbook:index {"group":"G","term":"GraphQL"} -->
<!-- handbook:index {"group":"M","term":"mTLS (Mutual TLS)"} -->
<!-- handbook:index {"group":"P","term":"Protobuf"} -->

<!-- handbook:narrative-bridge {"section":"12.7"} -->
固定されたRESTエンドポイントは分かりやすいが、画面ごとに必要な項目や関連が異なると、過剰取得と追加エンドポイントが増える。GraphQLは取得形状をクライアントへ委ねる代わりに、実行コストと認可をクエリ単位で管理する。

GraphQL (Facebook、2015年) は「**クライアントが必要なフィールドだけを取得する**」発想。

**問題意識:**

RESTで「ユーザー情報と最近の投稿5件と所属組織」を取得するなら、3つのエンドポイントを叩く必要がある (Under-fetching)。または、巨大な複合エンドポイントを作ってフィールドの99%を捨てる (Over-fetching)。

**GraphQL のアプローチ:**

```graphql
query {
  user(id: "42") {
    id
    name
    recentPosts(limit: 5) {
      id
      title
    }
    organization {
      name
    }
  }
}
```

1リクエストで、欲しいフィールドだけを取得できる。

**スキーマ定義:**

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  recentPosts(limit: Int = 10): [Post!]!
  organization: Organization
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
}

type Query {
  user(id: ID!): User
  posts(limit: Int = 20): [Post!]!
}

type Mutation {
  createPost(title: String!, body: String!): Post!
}
```

**サーバ実装 (Apollo Server):**

```typescript
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const typeDefs = `
  type User { id: ID!, name: String! }
  type Query { user(id: ID!): User }
`;

const resolvers = {
  Query: {
    user: (_parent: unknown, { id }: { id: string }) => ({ id, name: 'Alice' }),
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
```

**GraphQL の落とし穴 ― N+1問題:**

`users { posts { author { name } } }` のようなクエリを素朴に実装すると、users 取得 → 各 user に対して posts 取得 → 各 post に対して author 取得 ― となり、クエリ数が 1+N+N×M へ増える。

解決策は **DataLoader**:

```typescript
import DataLoader from 'dataloader';

// 同じ tick の中で複数のIDが要求されたら、まとめて1クエリにする
const userLoader = new DataLoader<string, User>(async (ids) => {
  const users = await db.user.findMany({ where: { id: { in: [...ids] } } });
  // ids の順序で並べ直す
  return ids.map(id => users.find(u => u.id === id)!);
});

const resolvers = {
  Post: {
    author: (post) => userLoader.load(post.authorId),
  },
};
```

これにより、同じバッチ境界内の複数要求を少数の一括クエリへまとめられる。必ず1クエリになるとは限らず、リクエストスコープ、最大バッチサイズ、複数データソース、キャッシュ方針で分割される。DataLoaderは代表的な対策だが、クエリ複雑度制限、深さ制限、認可、タイムアウトも別途必要になる。

**GraphQL の利点と欠点:**

| 利点 | 欠点 |
|---|---|
| 過不足ない取得 | キャッシュが難しい (URLで一意でない) |
| 1リクエストで複数リソース | クエリの複雑度がサーバ負荷を読みにくくする |
| 強い型システム | エンドポイントが1つ (CDN/中継がキャッシュしづらい) |
| スキーマがドキュメント | 学習コスト、ライブラリ依存 |
| Federation で分散可能 | エラー処理が特殊 (HTTPは200だが中身がエラー) |

<a id="section-12-8"></a>
### 12.8 gRPC ― バイナリ高速通信
<!-- handbook:learning {"level":"practical","minutes":5} -->
<!-- handbook:index {"group":"G","term":"gRPC"} -->
<!-- handbook:index {"group":"T","term":"tRPC"} -->

<!-- handbook:narrative-bridge {"section":"12.8"} -->
GraphQLはクライアントごとの取得形状に柔軟だが、内部サービス間で厳密な型、低レイテンシ、ストリーミングを優先する場合は別の契約が適する。gRPCはIDLとバイナリプロトコルを使い、言語をまたぐ呼び出しを生成コードへ落とす。

gRPC (Google、2016年) は **Protocol Buffers** を使う高性能RPCフレームワーク。

**スキーマ (.proto):**

```protobuf
syntax = "proto3";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc StreamUsers(stream UserFilter) returns (stream User);
}

message GetUserRequest {
  string id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

このスキーマから各言語のコードが生成される。クライアントとサーバが言語違いでも、強い型で通信できる。

**特徴:**

- **バイナリ転送**: JSON より高速・コンパクト
- **HTTP/2 ベース**: ストリーミング、多重化
- **双方向ストリーミング**: クライアント・サーバ両方から送れる
- **ブラウザでは方式が異なる**: ブラウザAPIだけでネイティブgRPCを直接実装できないため、gRPC-WebやConnectと、対応サーバまたはプロキシを使う。ストリーミングやメタデータ機能には差がある

実務では、**マイクロサービス間の内部通信に gRPC、外向きAPIには REST/GraphQL** という組み合わせが多い。

<a id="section-12-9"></a>
### 12.9 tRPC ― TypeScript ネイティブ
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"S","term":"SSE (Server-Sent Events)"} -->
<!-- handbook:index {"group":"W","term":"WebSocket"} -->

<!-- handbook:narrative-bridge {"section":"12.9"} -->
IDLによる型共有は強力だが、クライアントとサーバが同じTypeScriptコードベースで動く場合、別言語向け生成基盤が過剰になることもある。tRPCはTypeScriptの型を直接境界へ伝播させ、限定された組織内で契約作成を軽量化する。

tRPC (2020年〜) は、同一TypeScriptコードベースでサーバの型からクライアント型を推論するRPCフレームワーク。スキーマ定義の重複を減らせるが、この型安全性はコンパイル時の開発体験である。ネットワーク境界の入力検証、認可、旧クライアントとの互換性、TypeScript以外の利用者向け契約は別途必要になる。

```typescript
// server.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return { id: input.id, name: 'Alice' };
    }),

  createPost: t.procedure
    .input(z.object({ title: z.string(), body: z.string() }))
    .mutation(async ({ input }) => {
      return { id: '123', ...input };
    }),
});

// 型のエクスポート (実体はバンドルされない)
export type AppRouter = typeof appRouter;
```

```typescript
// client.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/server';

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
});

// 完全な型補完が効く ↓
const user = await client.getUser.query({ id: '42' });
//    ^? { id: string; name: string }

const post = await client.createPost.mutate({ title: 'Hello', body: '...' });
```

**tRPC の利点:**

- **OpenAPI/GraphQL スキーマ不要**: TypeScript の型がそのまま契約
- **完全な型補完**: 入力・出力・エラーまで型付き
- **軽量**: 追加スキーマレイヤーがない

**欠点:**

- TypeScript 専用 (他言語からは使いにくい)
- 公開APIには向かない (フロント・バックを同じチームが書く前提)

社内利用やフルスタックTypeScriptプロジェクトでは絶大な威力を発揮する。

<a id="section-12-10"></a>
### 12.10 WebSocket ― 全二重リアルタイム通信
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"12.10"} -->
REST、GraphQL、RPCはいずれも基本的に要求を起点とするため、サーバ側で発生した変化を即時に双方向へ届けたい処理には不足する。WebSocketは一度確立した接続上で双方がメッセージを送れる通信路を提供する。

HTTPはクライアント主導の片方向通信だ。サーバから能動的にプッシュできない (ロングポーリングで擬似的にできるが効率悪い)。

**WebSocket** はHTTPでアップグレード後、TCP上で全二重通信を行う。

```typescript
// サーバ (ws ライブラリ)
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('client connected');

  ws.on('message', (data) => {
    console.log('received:', data.toString());
    // 全員にブロードキャスト
    wss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(data.toString());
      }
    });
  });

  ws.send('Welcome!');
});
```

```typescript
// クライアント
const ws = new WebSocket('ws://localhost:8080');

ws.addEventListener('open', () => {
  ws.send('Hello from client');
});

ws.addEventListener('message', (e) => {
  console.log('received:', e.data);
});
```

WebSocketの用途:

- チャット、コラボレーション
- リアルタイム通知
- 株価、ゲーム
- ライブストリーミング (映像の双方向伝送はWebRTCの守備範囲)

実務では生WebSocketよりも **Socket.IO**(再接続、ルーム、フォールバック) や **GraphQL Subscription** を使うことが多い。

<a id="section-12-11"></a>
### 12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ
<!-- handbook:learning {"level":"practical","minutes":10} -->

<!-- handbook:narrative-bridge {"section":"12.11"} -->
双方向通信は柔軟だが、通知や進捗のようにサーバからクライアントへの一方向配信だけなら、再接続、プロキシ互換、実装負担が過剰になる。SSEはHTTP上の単方向ストリームとして、この限定された要求を簡潔に満たす。

サーバ→クライアントの片方向プッシュなら、SSEはWebSocketより構成を単純にできる場合がある。`EventSource`は切断時に再接続するが、欠落イベントを再送するにはサーバが`id`を付け、`Last-Event-ID`を扱い、保持期間と重複処理を設計する必要がある。

```typescript
// サーバ (Node.js)
import { createServer } from 'node:http';

createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // 1秒ごとにイベント送信
    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`);
    }, 1000);

    req.on('close', () => clearInterval(interval));
  }
}).listen(3000);
```

```typescript
// クライアント
const es = new EventSource('/events');
es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log('received:', data);
};
```

通知、株価、進行状況などサーバ → クライアント単方向で十分なら、SSEで足りる。LLMのストリーミング応答にも使われる (トークンを届いた順に表示する用途)。

<a id="section-12-12"></a>
### 12.12 API方式選択の指針
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"12.12"} -->
各方式が解く問題を個別に見た後は、データ形状、呼び出し主体、遅延、ストリーム方向、互換期間を同じ軸で比較する。複数方式を併用する場合も、境界ごとの理由を説明できることが重要である。

| 用途 | 推奨 |
|---|---|
| 公開API、Webhook、HTTPキャッシュを活かす | REST + OpenAPIを検討 |
| クライアントごとに取得形状が大きく異なる | GraphQLを検討 |
| 厳密なスキーマを持つ内部RPC・ストリーミング | gRPCを検討 |
| 単一TypeScriptコードベースの内部利用 | tRPCを検討 |
| リアルタイム双方向通信 | WebSocketを検討 |
| サーバ→クライアントの単方向ストリーム | SSEを検討 |

方式は組織境界、クライアント言語、互換性期間、プロキシ/CDN、ストリーミング要件、運用ツールを含めて選ぶ。

<a id="section-12-13"></a>
### 12.13 ファイルアップロードの転送方式 ― multipart と presigned URL
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"M","term":"multipart/form-data"} -->
<!-- handbook:index {"group":"P","term":"presigned URL"} -->
<!-- handbook:index {"group":"P","term":"POST policy (オブジェクトストレージ)"} -->
<!-- handbook:index {"group":"は行","term":"ファイル転送方式"} -->
<!-- handbook:index {"group":"か行","term":"孤児オブジェクト"} -->

<!-- handbook:narrative-bridge {"section":"12.13"} -->
12.1 から 12.12 で設計してきたのは、数キロバイトの構造化データをやり取りする契約だった。ファイルはこの前提を3か所で破る。本文の大きさに上限がなく、転送の途中で切れ、そして最終的な置き場所がアプリケーションサーバではない。本節では、バイト列をどの経路で運ぶかという、API設計の最初の分岐を扱う。

ファイルのやり取りを「`POST /files` に本文を載せるだけ」と考えると、本番で3つの形で壊れる。アプリケーションサーバのメモリと帯域を1リクエストが占有し、リバースプロキシの本文サイズ上限や読み取りタイムアウトに当たり、そして受け取ったバイト列を保存する先が結局は別のシステム (オブジェクトストレージ) になる。転送方式の選択は、この3つのどれを引き受けるかの選択である。

#### 3つの経路

| 経路 | 通る場所 | 上限の強制 | クライアント要件 | 向く場面 |
|---|---|---|---|---|
| サーバ経由 (`multipart/form-data`) | クライアント → アプリ → ストレージ | アプリで自由に強制できる | フォーム送信だけで完結する | 数MB以下、アップロード時に同期処理が要る、社内向け |
| 署名付きPUT (presigned PUT) | クライアント → ストレージ | 署名条件に入れた項目だけ | `PUT` と CORS が必要 | 数十MB〜、単純な1オブジェクト |
| 署名付きPOST (POST policy) | クライアント → ストレージ | ポリシー条件で範囲指定できる | `multipart/form-data` の `POST` | HTMLフォームのみ、サイズ範囲を強制したい |

判断の軸は「アプリケーションサーバにバイト列を通す価値があるか」に尽きる。同期的にサムネイルを返す、その場で内容を検査して受理・拒否を返す、といった要求があるならサーバ経由が素直である。そうでなければ、アプリケーションは**許可証を発行する係**に徹し、バイト列はストレージへ直接流すほうが、帯域もメモリもタイムアウトも問題にならない。

#### multipart/form-data の中身

サーバ経由を選ぶなら、`multipart/form-data` [RFC 7578] の構造を知っておく必要がある。本文は境界文字列 (boundary) で区切られたパートの列であり、各パートが独自のヘッダを持つ。

```text
POST /uploads HTTP/1.1
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="projectId"

prj_a1
------X
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

%PDF-1.7 ...(バイト列)...
------X--
```

ここで実装上重要になるのは次の3点である。

1. **`filename` はクライアントが書いた任意の文字列である。** RFC 7578 は、受信側がこの値をファイルシステムのパスとして解釈しないよう明示的に注意している。`../../etc/passwd`、`a.pdf.exe`、制御文字、100文字を超える名前はすべて到着しうる。保存名は必ずサーバ側で生成し、`filename` は表示用のメタデータとしてだけ持つ。
2. **パートの順序に意味がある。** ストリームとして処理する実装では、ファイルより後ろに置かれたフィールド (たとえば `projectId`) は、ファイルを書き終わるまで読めない。認可判断に必要な値は必ずファイルより前に置くよう、APIの契約として決めておく。
3. **パーサはバッファリングするか、ストリームするかを選べる。** 全体をメモリに載せる実装は、上限を強制しないかぎり容易に枯渇する。

```typescript
import Busboy from 'busboy';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function handleUpload(req: IncomingMessage, res: ServerResponse): void {
  // 上限はパーサへ渡す。読み切ってから判定すると、その時点で帯域は使い切っている。
  const bb = Busboy({
    headers: req.headers,
    limits: { files: 1, fileSize: MAX_FILE_BYTES, fields: 8, fieldSize: 4 * 1024 },
  });

  const fields = new Map<string, string>();
  bb.on('field', (name, value) => fields.set(name, value));

  bb.on('file', (name, stream, info) => {
    // info.filename はクライアント由来。保存名には使わない。
    const key = `uploads/${crypto.randomUUID()}`;
    stream.on('limit', () => {
      // 上限に達した時点で読み捨てる。ここで 413 を返し、接続を閉じる。
      res.writeHead(413, { 'Content-Type': 'application/problem+json' });
      res.end(JSON.stringify({ title: 'Payload too large', maxBytes: MAX_FILE_BYTES }));
      req.destroy();
    });
    void storage.putStream(key, stream, { declaredType: info.mimeType });
  });

  bb.on('close', () => { /* 受理応答 */ });
  req.pipe(bb);
}
```

上限に達したあとの応答は、実際には届かないことがある。クライアントが本文を送り終える前にサーバが応答して接続を閉じると、TCPの実装によってはクライアント側で「接続がリセットされた」としか見えない。413 を確実に見せたい場合は、後述する事前申告 (init API) を併用する。

#### presigned URL は何に署名しているのか

署名付きURLは、URLそのものが**期限つきの権限**になっている仕組みである。オブジェクトストレージ側は、クエリ文字列に含まれる署名を、リクエストのメソッド・パス・一部のヘッダ・有効期限から再計算して照合する。照合が通れば、呼び出し元が誰かは問わない。

ここから2つの帰結が出る。

- **URLが漏れれば権限が漏れる。** ログ、リファラ、共有されたスクリーンショット、ブラウザ履歴のいずれからも流出しうる。有効期限は用途に足りる最短にする。書き込み用なら数分から15分程度が目安になる。
- **署名に含めなかった条件は強制されない。** `Content-Length` を署名に含めなければ、クライアントは何バイトでも書き込める。「アップロードの上限は100MBです」とAPI仕様に書いても、それは仕様書の記述であって強制ではない。

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({});

export async function issueUploadUrl(scope: TenantScope, input: {
  declaredType: string; declaredBytes: number;
}) {
  if (!ALLOWED_TYPES.has(input.declaredType)) throw new UnsupportedMediaTypeError();
  if (input.declaredBytes > MAX_FILE_BYTES) throw new PayloadTooLargeError();

  const objectId = crypto.randomUUID();
  const key = `uploads/${scope.tenantId}/${objectId}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      // ここに書いた値だけが署名に入り、実際の書き込みを縛る。
      ContentType: input.declaredType,
      ContentLength: input.declaredBytes,
      ChecksumAlgorithm: 'SHA256',
    }),
    { expiresIn: 300 },
  );
  await db.upload.create({ data: { id: objectId, key, tenantId: scope.tenantId, status: 'PENDING' } });
  return { objectId, url };
}
```

`ContentLength` を署名条件に入れる方式は、送信バイト数を1つの値に固定する。事前に正確なサイズが分かるブラウザからのアップロードでは問題ないが、生成しながら送る用途では使えない。範囲で縛りたい場合は POST policy 形式を使う。

```json
{
  "expiration": "2026-09-01T00:15:00Z",
  "conditions": [
    { "bucket": "app-uploads" },
    ["starts-with", "$key", "uploads/ten_a/"],
    { "x-amz-server-side-encryption": "aws:kms" },
    ["content-length-range", 1, 20971520],
    ["eq", "$Content-Type", "application/pdf"]
  ]
}
```

`starts-with` による接頭辞の固定は、テナント境界をストレージ側にも宣言する意味を持つ (13.24)。これがないと、署名を得たテナントが `key` を書き換えて他テナントの領域へ書き込めてしまう。

#### 事前申告と完了通知 ― 状態機械にする

直接アップロードでは、アプリケーションはバイト列を見ていない。したがって「アップロードが終わったこと」を自分では知らない。ここを状態機械として設計しないと、DBには存在するがストレージにはない行や、ストレージにあるがDBにはない**孤児オブジェクト**が溜まっていく。

```text
PENDING ──(完了通知 + HEAD検証)──> UPLOADED ──(後処理)──> READY
   │                                    │
   │(期限切れ)                          │(検証失敗・検疫)
   ▼                                    ▼
EXPIRED ─(ストレージ側のライフサイクルで削除)  REJECTED
```

完了通知を受けたときは、必ずストレージ側の実体を確認する。クライアントの「終わりました」は申告にすぎない。

```typescript
export async function completeUpload(scope: TenantScope, objectId: string) {
  const row = await db.upload.findFirst({ where: { id: objectId, tenantId: scope.tenantId } });
  if (!row || row.status !== 'PENDING') throw new NotFoundError();

  const head = await storage.head(row.key);            // 実在とサイズを取る
  if (!head) throw new BadRequestError('not uploaded');
  if (head.contentLength > MAX_FILE_BYTES) {           // 署名条件を通っていても再確認する
    await storage.remove(row.key);
    return db.upload.update({ where: { id: objectId }, data: { status: 'REJECTED' } });
  }
  await db.upload.update({
    where: { id: objectId },
    data: { status: 'UPLOADED', bytes: head.contentLength, checksum: head.checksumSha256 },
  });
  await queue.add('inspect-upload', { objectId });     // 内容の検査は非同期 (23.26)
}
```

完了通知は届かないことがある。ブラウザが閉じられ、回線が切れ、あるいはユーザーが途中でやめる。対策は2つを併用する。第一に、オブジェクトストレージ側のライフサイクル規則で、一定期間以上 `PENDING` の接頭辞を自動削除する。第二に、定期ジョブでDBの `PENDING` 行を走査し、実体があれば完了扱いに、なければ期限切れにする。前者だけではDBの行が残り、後者だけではストレージが太る。

#### ブラウザから直接書き込むときのCORS

署名付きURLへブラウザから `PUT` すると、`Content-Type` が単純リクエストの範囲を超えるためプリフライトが発生する。ストレージ側のCORS設定で `PUT` と必要なヘッダを許可し、アップロード後に `ETag` を読みたい場合は公開ヘッダにも加える。ここを忘れると、開発時のサーバ経由アップロードでは動き、本番の直接アップロードだけがブラウザのコンソールで失敗する。

```json
[{
  "AllowedOrigins": ["https://app.example.com"],
  "AllowedMethods": ["PUT", "POST", "HEAD"],
  "AllowedHeaders": ["content-type", "content-length", "x-amz-checksum-sha256"],
  "ExposeHeaders": ["ETag", "x-amz-checksum-sha256"],
  "MaxAgeSeconds": 3000
}]
```

#### 取得側 ― 配信URLの設計

読み出しも同じ考え方になる。アプリケーションが認可を判定し、署名付きGET URLへリダイレクトする形が基本である。ただし2点を決めておく。

- **有効期限とキャッシュの関係。** 署名付きURLはクエリ文字列が毎回変わるため、CDNのキャッシュキーが分散する。長期間変わらない公開ファイルは、署名ではなく別の経路 (CDNの署名付きCookie、あるいは公開バケット) を使うほうが安く済む。
- **`Content-Disposition` を発行側で固定する。** ブラウザ上で開かせたくない種別 (HTML、SVG、およびSVGを埋め込みうる SVGZ や一部の PDF) は `attachment` を強制する。この判断の根拠は 23.26 で扱う。

なお、「URLを渡すと取り込む」形のアップロード (import from URL) を提供する場合、サーバが任意のURLへリクエストを出すことになる。これは SSRF (Server-Side Request Forgery) そのものであり、23.5 の対策をそのまま適用する必要がある。

#### つまずく箇所 ― ファイル転送方式

- **上限を仕様書にだけ書く**: 署名条件、リバースプロキシ、パーサのいずれかに数値として入っていなければ、上限は存在しない。3か所の値がずれていると、どこで落ちたか分からない 413 が出る。
- **`filename` を保存名に使う**: パス区切り、拡張子の重ね、長さ、文字コードのすべてが攻撃面になる。保存名は生成し、元の名前は表示専用の列に持つ。
- **署名付きURLの期限を長くする**: 「途中で切れると困るから24時間」は、URLが漏れたときの被害を24時間に伸ばしているだけである。切れる問題は 12.14 の再開可能アップロードで解く。
- **完了通知だけを信じる**: 通知が来ないケースと、通知は来たが実体がないケースの両方が起きる。`HEAD` による確認と、定期的な照合の両方を置く。
- **アップロードの成否を同期応答だけで表す**: 内容の検査 (23.26) には時間がかかる。受理と安全確認は別の状態であり、利用者にも別の状態として見せる。

<a id="section-12-14"></a>
### 12.14 大容量アップロードと再開可能プロトコル
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"M","term":"Multipart Upload (オブジェクトストレージ)"} -->
<!-- handbook:index {"group":"T","term":"tus (再開可能アップロード)"} -->
<!-- handbook:index {"group":"さ行","term":"再開可能アップロード"} -->
<!-- handbook:index {"group":"た行","term":"チャンク分割転送"} -->

<!-- handbook:narrative-bridge {"section":"12.14"} -->
12.13 の署名付きURLは、1回のリクエストが最後まで通ることを前提にしている。ファイルが数百MBを超えると、この前提そのものが成り立たなくなる。本節では、転送が途中で切れることを前提にした契約の作り方を扱う。

1GBのファイルを1本のリクエストで送ると、途中で切れる確率は無視できない。モバイル回線の切り替え、ロードバランサのアイドルタイムアウト、プロキシの本文サイズ上限、ブラウザのタブの休止 ― どれか1つに当たれば、90%まで進んだ転送が最初からやり直しになる。解決の方向は2つあり、性質が違う。

| 方式 | 分割の主体 | 再開の単位 | サーバの状態 | 代表 |
|---|---|---|---|---|
| 分割アップロード | クライアントが等分し、並列に送る | パート単位 | ストレージが未完了セッションを保持 | S3 Multipart Upload |
| 再開可能アップロード | 逐次に送り、切れたら続きから | バイトオフセット単位 | サーバが受信済みオフセットを保持 | tus |

前者は速度が目的である。パートを並列に送るため、帯域を使い切りやすい。後者は継続が目的である。オフセットを問い合わせられることが本質で、並列性は副次的である。両方が必要なら、両方を実装することになる。

#### 分割アップロードの流れと後始末

オブジェクトストレージの分割アップロードは、3つの操作で構成される。

```text
1. CreateMultipartUpload  → uploadId を得る
2. UploadPart(partNumber, body) を N 回  → 各パートの ETag を得る
3. CompleteMultipartUpload([{partNumber, eTag}, ...])  → 1つのオブジェクトになる
```

実務で問題になるのは3番目に到達しなかった場合である。未完了の分割アップロードは、ストレージ上に**見えない形で残り、容量として課金され続ける**。バケット一覧には現れないため、請求額が説明できなくなるまで気づかないことが多い。ライフサイクル規則で「N日経過した未完了の分割アップロードを中止する」を必ず設定する。

パート番号とサイズには実装上の制約がある。よく使われるS3互換のAPIでは、パート数の上限とパートの最小サイズ (最終パートを除く) が決まっている。クライアント側のチャンクサイズを固定値にすると、巨大なファイルでパート数の上限に当たる。ファイルサイズからチャンクサイズを決める形にしておく。

```typescript
const MAX_PARTS = 10_000;
const MIN_PART_BYTES = 5 * 1024 * 1024;

export function chooseChunkSize(totalBytes: number): number {
  const needed = Math.ceil(totalBytes / MAX_PARTS);
  // 5MiB 単位へ切り上げる。最終パートだけは下限を下回ってよい。
  return Math.max(MIN_PART_BYTES, Math.ceil(needed / MIN_PART_BYTES) * MIN_PART_BYTES);
}
```

各パートには個別にチェックサムを付けられる。付けておくと、転送中に壊れたパートをその場で検出でき、そのパートだけ再送できる。付けない場合、破損は完了後の全体ハッシュで初めて分かり、やり直しは全体になる。

#### 再開可能アップロードの最小要件

再開可能にするために本当に必要なのは、たった1つの機能である。**サーバが「あなたのアップロードは今どこまで受け取ったか」に答えられること。** これさえあれば、クライアントは切れた地点を問い合わせ、続きから送れる。

tus プロトコル [tus 1.0.0] は、この最小要件をHTTPの語彙で表現している。

| 操作 | メソッド | 主なヘッダ | 意味 |
|---|---|---|---|
| 作成 | `POST` | `Upload-Length`、`Upload-Metadata` | 転送先URLを作る (creation 拡張) |
| 状況照会 | `HEAD` | 応答に `Upload-Offset`、`Upload-Length` | 受信済みバイト数を返す |
| 送信 | `PATCH` | `Content-Type: application/offset+octet-stream`、`Upload-Offset` | 指定オフセットから追記する |

`PATCH` の要点は、**オフセットを条件として書き込むこと**にある。クライアントが送ってきた `Upload-Offset` がサーバの持つ値と一致しなければ 409 を返して書き込まない。これにより、同じ `PATCH` が二重に届いても、2回目は不一致で弾かれる。オフセットが条件付き書き込みの条件になっており、再送が安全になっている。

```typescript
type UploadSession = {
  id: string;
  tenantId: string;
  totalBytes: number;
  receivedBytes: number;
  expiresAt: Date;
};

export async function patchUpload(session: UploadSession, clientOffset: number, chunk: Buffer) {
  // 1. オフセットの一致を条件にする。ここが冪等性の要。
  if (clientOffset !== session.receivedBytes) {
    throw new ConflictError(`offset mismatch: server=${session.receivedBytes} client=${clientOffset}`);
  }
  // 2. 宣言した総量を超える書き込みを拒否する。
  if (clientOffset + chunk.byteLength > session.totalBytes) {
    throw new PayloadTooLargeError('exceeds Upload-Length');
  }
  // 3. 追記とオフセット更新を1つの原子的操作にする。
  //    先に追記してから更新が落ちると、再送で同じ範囲が二重に書かれる。
  const next = await store.appendAtomically(session.id, clientOffset, chunk);
  return { uploadOffset: next.receivedBytes, complete: next.receivedBytes === session.totalBytes };
}
```

3番目のコメントが実装の分かれ目になる。追記とオフセットの更新が別々の操作だと、その間で落ちたときにサーバの状態が壊れる。オフセットを「ファイルの実サイズから毎回読み直す」設計にすると、この不整合は原理的に起きない。逆に、オフセットをメモリやキャッシュだけに持つと、プロセスの再起動やロードバランサによる別ノードへの割り振りで、再開できなくなる。

#### 再開できなくなる典型パターン

| パターン | 症状 | 対処 |
|---|---|---|
| セッション状態がプロセスメモリにある | 再デプロイ後に全アップロードが最初から | 状態を共有ストア (DB・オブジェクトストレージ) へ置く |
| ロードバランサが別ノードへ振る | 断続的に 404 や 409 が出る | 状態を共有するか、アップロードIDでの一貫ハッシュを使う |
| 一時ファイルの寿命が短い | 数時間空けて再開すると失敗 | `Upload-Expires` を返し、期限を契約として宣言する |
| クライアントがオフセットを憶えている | 再送で 409 が続く | 再開時は必ず `HEAD` で問い合わせる。記憶した値は捨てる |
| 中断分が回収されない | ストレージ費用が単調増加する | 期限切れセッションのGCを定期実行し、件数を監視する |

最後の行は運用上の見落としが多い。中断したアップロードは、成功したアップロードより多いことすらある。GCの実行結果 (回収件数・回収バイト数) をメトリクスとして出しておくと、クライアント側の不具合にも早く気づける。

#### 完全性の確認

分割して送る以上、「全部届いたか」と「壊れていないか」は別に確かめる必要がある。前者はオフセットまたはパート数で分かるが、後者はハッシュでしか分からない。

- **パート単位のチェックサム**: 壊れたチャンクだけを再送できる。tus には checksum 拡張がある。
- **全体のダイジェスト**: クライアントが計算した値を作成時に宣言させ、完了時にサーバ側で照合する。これが一致して初めて `READY` へ進める。
- **ただしダイジェストは真正性を示さない。** クライアントは値もバイト列も自由に作れる。ダイジェストが保証するのは「転送で壊れていないこと」であって、「内容が安全であること」ではない。内容の検査は 23.26 の役割である。

#### ダウンロードの再開との違い

混同されやすいが、ダウンロードの再開は別の仕組みで足りる。HTTPには範囲リクエストがあり、`Range: bytes=1048576-` を送れば途中から取得できる [RFC 9110 §14]。これはサーバが状態を持たない。「サーバは完成したオブジェクトをすでに持っている」ためである。アップロードの再開に状態が要るのは、**まだ完成していないものを扱う**からで、この非対称性が設計の難しさの根にある。

#### つまずく箇所 ― 大容量アップロード

- **チャンクサイズを固定値で決め打つ**: 小さすぎるとパート数の上限に当たり、大きすぎると1チャンクの再送コストが上がる。総サイズから決める。
- **並列送信でオフセットを競合させる**: 再開可能プロトコルの `PATCH` は逐次が前提である。並列化したいなら、分割アップロード方式か、tus の連結 (concatenation) 拡張のように独立した領域へ書く形にする。
- **未完了セッションを消さない**: ストレージ費用と、`PENDING` 行の滞留の両方が増える。期限とGCを最初から設計に含める。
- **再開時にクライアントの記憶を信じる**: 必ずサーバへ問い合わせる。サーバ側でGCが走っていれば、記憶したオフセットは無効になっている。
- **進捗率をユーザー体験の中心に置く**: 進捗は送信済みバイト数であって、処理完了ではない。100%表示の後に検査と後処理が続くことを画面でも表す。

<a id="section-12-15"></a>
### 12.15 Webhook の設計 ― イベント契約と署名
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"W","term":"Webhook 契約"} -->
<!-- handbook:index {"group":"W","term":"Webhook 署名ヘッダ"} -->
<!-- handbook:index {"group":"S","term":"Standard Webhooks"} -->
<!-- handbook:index {"group":"ら行","term":"リプレイ攻撃 (Webhook)"} -->

<!-- handbook:narrative-bridge {"section":"12.15"} -->
12.13 と 12.14 では、クライアントが送ってくるものをどう受けるかを設計した。Webhook は向きが逆で、自分のサーバが、管理下にない相手のサーバへ HTTP を投げる。相手が落ちていても、遅くても、二重に受け取っても壊れない契約が要る。本節では送信側が定める契約と署名を扱い、受信側の実装は 17.13 で扱う。

Webhook は「イベントが起きたら、登録されたURLへHTTPで通知する」仕組みである。API提供側から見ると、これは**自分が信頼できないクライアントになる**という珍しい状況を作る。相手のサーバは自分の管理下になく、いつ落ちるか、どれだけ遅いか、同じ通知を何回受け付けるかを制御できない。したがって Webhook の設計とは、大部分が**保証しないことの明示**である。

#### イベントの封筒を先に決める

本文の中身 (どのリソースがどう変わったか) より先に、すべてのイベントに共通する封筒 (envelope) を決める。後から足せない項目がここに集中している。

```json
{
  "id": "evt_01J8Z9Q0M3RJ2S",
  "type": "invoice.payment_failed",
  "api_version": "2026-06-01",
  "created_at": "2026-08-30T04:15:22.481Z",
  "sequence": 148213,
  "data": { "object": { "id": "in_1P...", "status": "past_due" } }
}
```

| 項目 | なぜ必要か |
|---|---|
| `id` | 受信側が重複を判定する唯一の鍵になる。再送でも同じ値を使う |
| `type` | 受信側の分岐。名前空間を切り、`.` 区切りで階層にしておくと購読の絞り込みが楽になる |
| `api_version` | 本文の形が変わったことを受信側が検出できる。無いと壊れ方が静かになる |
| `created_at` | 遅延の測定と、順序の推定に使う。到着時刻とは別に必要 |
| `sequence` | 順序逆転の検出に使う。リソース単位の版番号でもよい |

`id` は**再送しても変わらない**ことが契約の核心である。ネットワーク障害で再送したときに新しい `id` を振ると、受信側は重複排除ができず、二重処理を防ぐ手段を失う。

#### 保証しないことを文書に書く

Webhook のドキュメントに次の4つを明記していないと、受信側は暗黙に「1回だけ、順番どおり、すぐ届く」と期待する。そして期待は必ず裏切られる。

- **配送は at-least-once である。** 同じイベントが2回以上届きうる。受信側は冪等に実装する必要がある。
- **順序は保証しない。** 再送とネットワークの都合で、後のイベントが先に着く。
- **遅延しうる。** 秒で届く保証はない。UIの整合を Webhook の到着に依存させない。
- **欠落しうる。** 再送を尽くしても届かないことがある。突合のための一覧APIを別に提供する。

この4つは「品質が低い」のではなく、分散システムで達成可能な範囲を正直に書いたものである。むしろ、これを書かずに暗黙の期待を持たせるほうが事故を生む。

#### 署名 ― 何を、どう署名するか

受信側が「この通知が本当に自分たちから来たか」を確かめられなければ、Webhook のエンドポイントは誰でも叩ける公開APIになる。署名は共有秘密鍵によるHMAC (13.14) が最も普及している。

署名の対象には、本文だけでなく**イベントIDとタイムスタンプを含める**。本文だけに署名すると、攻撃者は過去に観測した正当なリクエストをそのまま再送でき (リプレイ)、受信側はそれを区別できない。

```typescript
import crypto from 'node:crypto';

/** 送信側: 署名対象は "id.timestamp.rawBody" とし、生バイト列に対して計算する。 */
export function signPayload(secret: Buffer, eventId: string, timestamp: number, rawBody: Buffer) {
  const signedContent = Buffer.concat([
    Buffer.from(`${eventId}.${timestamp}.`, 'utf8'),
    rawBody,
  ]);
  return crypto.createHmac('sha256', secret).update(signedContent).digest('base64');
}

export function buildHeaders(secrets: Array<{ id: string; key: Buffer }>, event: Event, rawBody: Buffer) {
  const timestamp = Math.floor(Date.now() / 1000);
  // 鍵ローテーション中は複数の署名を空白区切りで併記する。
  // 受信側はどれか1つが一致すれば受理でき、切り替え時に配送が落ちない。
  const signatures = secrets
    .map(({ id, key }) => `${id},${signPayload(key, event.id, timestamp, rawBody)}`)
    .join(' ');
  return {
    'webhook-id': event.id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': signatures,
    'content-type': 'application/json',
  };
}
```

このヘッダ名と署名対象の組み立ては、Standard Webhooks が提案している形に沿っている。仕様として広く合意されたものではないが、複数の事業者が近い形を採っているため、受信側の実装を使い回しやすいという実利がある。

共有秘密鍵ではなく公開鍵署名 (Ed25519 など、13.15) を使う選択肢もある。利点は、受信側に秘密を渡さずに済むこと、鍵の配布が公開鍵の公表で済むことである。欠点は、受信側の実装コストがわずかに上がることと、対応していないライブラリがあることになる。

#### 再送方針を数字で公表する

再送の仕様は、受信側が自分のシステムを設計するための入力になる。次の4項目を数字で公表する。

| 項目 | 例 | 受信側への意味 |
|---|---|---|
| 成功と見なす応答 | 2xx のみ。リダイレクトは追わない | 3xx を返すエンドポイントは失敗扱いになる |
| タイムアウト | 応答まで5秒 | 重い処理は受理後にキューへ回す必要がある (17.13) |
| 再送間隔 | 指数バックオフ、5秒 → 3日、最大14回 | 一時的な障害はどこまで許されるか |
| 打ち切り | 3日以上失敗が続くとエンドポイントを自動停止 | 復旧後に取りこぼしを突合する手段が要る |

自動停止は受信側の事故を防ぐ一方、停止に気づかせる手段 (通知メール、管理画面の警告、一覧API) を必ず併設する。停止したことを誰も知らない状態が、最も損害が大きい。

#### 送信先URLは攻撃面である

受信URLは利用者が入力する。つまり、自分のサーバに「任意のURLへリクエストを出させる」機能を提供することになる。これは SSRF (23.5) そのものである。

- 登録時と送信時の両方で、解決先IPが内部レンジでないことを確認する。DNSは登録後に書き換えられる。
- リダイレクトを追わない。追う設計にすると、外部URLから内部URLへ誘導できる。
- 送信元を専用のネットワーク経路 (egress プロキシ) に寄せ、そこからは内部サービスへ到達できないようにする。
- 応答本文を利用者へそのまま見せない。見せると、内部サービスの応答を読み出す経路になる。

#### 版の進め方

イベントの本文は必ず変わる。破壊的にならない変更と、なる変更を区別しておく。

- **互換とみなせる変更**: 新しいイベント種別の追加、本文への項目の追加。受信側は未知の項目と未知の種別を無視できるよう実装する、と契約に書いておく。
- **破壊的な変更**: 項目の削除、意味の変更、型の変更。`api_version` を上げ、購読ごとに版を固定し、移行期間を設ける。

購読ごとに版を固定する設計は、送信側に複数版の生成コードを抱えさせる。それでも、全利用者を同時に動かす移行より安全である。12.6 の OpenAPI と同様に、イベントの形もスキーマとして公開し、差分を機械的に検出できるようにしておくとよい。

#### つまずく箇所 ― Webhook の設計

- **再送時にイベントIDを振り直す**: 受信側の重複排除が原理的に不可能になる。`id` はイベントに固定し、配送試行のIDは別ヘッダで持つ。
- **署名対象にタイムスタンプを入れない**: リプレイを検出できない。許容差 (たとえば5分) の宣言もあわせて公表する。
- **鍵を1つしか持てない設計にする**: ローテーションのたびに配送が落ちる。複数署名の併記を最初から仕様に入れておく。
- **受信側の遅さを送信側で吸収しようとする**: タイムアウトを伸ばすと、送信キューが詰まって全利用者へ影響する。タイムアウトは短く固定し、重い処理は受信側の責務だと明記する。
- **順序を保証すると書いてしまう**: 一度書くと、再送の実装が極端に難しくなる。順序が本当に必要な相手には、`sequence` と再取得APIを提供して自力で並べ替えてもらうほうが現実的である。

<a id="section-12-16"></a>
### 12.16 実装課題 ― API設計の核を実装する
<!-- handbook:learning {"level":"practical","minutes":420} -->

<!-- handbook:narrative-bridge {"section":"12.16"} -->
選択基準を理解しただけでは、スキーマと実装のずれ、N+1、型伝播、接続切断時の挙動までは身に付かない。生成、Resolver、RPC、WebSocket、SSEを最小実装し、各方式が負う運用責務を観測する。

第12章では REST、GraphQL、gRPC、tRPC、WebSocket、SSE と多様な API 方式を見た。本節では各方式の核となる仕組みを実装する。所要時間: 演習カードの推定時間の合計で11時間15分。

#### 課題12.1: OpenAPI からサーバスタブを生成 (★★)

**目的**: OpenAPI 仕様を読み込んで、TypeScript のサーバスケルトンを自動生成する仕組みを作る。

<!-- handbook:exercise:start {"id":"12.1"} -->
> **演習カード 課題12.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 12.6 OpenAPI ― API設計の標準仕様 を読み、paths、components、$ref の構造を確認する
> - 12.3 リソース指向設計の実践 を読み、パスとリソースの対応を把握する
> - Zod のスキーマ表記 (z.object、z.coerce.number など) を読める
> - Node.js の fs でファイルを読み、標準出力へ文字列を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] OpenAPI ドキュメントを読み込み、components.schemas の各定義を Zod のスキーマ定数と型エイリアスへ変換して出力する
> - [ ] path とメソッドの組ごとに Params 用スキーマを出力し、required でないパラメータには optional を付ける
> - [ ] requestBody を持つ操作は Body 用スキーマも出力する
> - [ ] 生成される関数が export async function の形で、本体が未実装を示す例外を投げる
> - [ ] $ref が指すスキーマ名へ解決され、参照先が z.unknown() へフォールバックしない
> - [ ] string / integer / number / boolean / array / object のいずれの type でも対応する式を出力する
>
> **期待出力**
>
> - 生成物の先頭行が zod の import 文になる
> - User スキーマから UserSchema の定義と User 型エイリアスの2行が出力される
> - getUser 操作から getUserParamsSchema と getUser 関数が出力される
> - 未実装の本体が `GET /users/{id} is not implemented` の形式のメッセージで例外を投げる
>
> **観察項目**
>
> - required に含まれないプロパティへ optional が付くことを生成物で確認する
> - パスパラメータの integer が z.coerce.number().int() へ変換される理由 (URLからは常に文字列で届く) を確認する
> - operationId を消したとき、メソッド名とパスから識別子が組み立てられることを見る
> - 同じスキーマを2つの操作で参照し、$ref が重複定義ではなく共有名として出力されることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `OpenAPI generator emits Zod schemas and typed handler` がパスすることを確認する
> 2. JSON構文の OpenAPI ファイルを用意し `pnpm --filter @handbook/ch12 exec tsx openapi-codegen/solution/main.ts 入力ファイル` を実行して、標準出力に Zod 定義と関数が並べば合格
> 3. 第2引数に出力先を渡して .ts を生成し、`grep -c 'z.object' 出力ファイル` が1以上を返すことを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 生成器は「スキーマから文字列を作る再帰関数」を1つ決めれば骨格が固まる。まず type が string だけの版で出力を確認し、そこへ object と array を足す。
> 2. **構造**: schemaExpression(schema) を $ref、プリミティブ、array、object の順に分岐させる。操作名は operationId があればそれ、無ければメソッドとパスから記号を除いてキャメルケース化する。出力は行の配列へ push して最後に連結する。
> 3. **実装の要点**: $ref の値は `#/components/schemas/User` の形なので、スラッシュで分割した末尾だけを取ってスキーマ名へ変換する。この解決を忘れると全ての参照が z.unknown() に落ち、生成コードは通るのに検証が効かない。
>
> **本番利用時の警告**
>
> - 生成したスタブは認証・認可・レート制限・共通エラー形式を一切含まない。仕様に書かれた型だけを信じて公開すると、入力検証は通るが権限のない操作が実行される。
> - この例は依存を持たないためJSON構文のYAMLしか読めず、アンカーや複数ドキュメントを含む実仕様書では失敗する。本番では実績のあるYAMLパーサとコード生成ツールを使う。
> - 仕様と実装のずれを検知する仕組みが無いため、仕様更新後に再生成しない限り古い検証が残り続ける。CIで生成物の差分を検査する必要がある。
>
> **導線**
>
> - 開始地点: `code/ch12/openapi-codegen/starter/main.ts`
> - 模範解答: `code/ch12/openapi-codegen/solution/main.ts`
>
> **推定時間の内訳**: スキーマ変換関数の実装35分、操作ごとの出力組み立て30分、$refとoptionalの対応および生成物の確認25分
<!-- handbook:exercise:end -->

**要件**:
- `openapi.yaml` を入力
- 各エンドポイントに対する型付きハンドラ関数のテンプレートを出力
- リクエストボディ、レスポンス、パラメータの型を Zod スキーマに変換
- 「**スキーマ → 型 + 検証**」の流れを体験

```typescript
// 入力 (openapi.yaml):
// paths:
//   /users/{id}:
//     get:
//       parameters: [{ name: id, in: path, schema: { type: integer } }]
//       responses:
//         '200':
//           content:
//             application/json:
//               schema:
//                 $ref: '#/components/schemas/User'

// 生成されるコード:
const getUserSchema = z.object({ id: z.coerce.number() });
export async function getUser(params: z.infer<typeof getUserSchema>): Promise<User> {
  // TODO: implement
  throw new Error('Not implemented');
}
```

模範解答: `code/ch12/openapi-codegen/`

#### 課題12.2: GraphQL Resolver の N+1 を解決 ― DataLoader 自作 (★★★)

**目的**: GraphQL の最大の罠「N+1 問題」を、DataLoader パターンで解決する。

<!-- handbook:exercise:start {"id":"12.2"} -->
> **演習カード 課題12.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 12.7 GraphQL ― クライアント主導のクエリ を読み、Resolver がフィールド単位で呼ばれることを確認する
> - JavaScript のマイクロタスク (queueMicrotask と Promise の解決順) を説明できる
> - Promise を外から解決する (resolve と reject を保持する) 書き方ができる
> - Map によるキャッシュと配列によるキュー操作を書ける
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] load(key) が Promise を返し、同一マイクロタスク内の複数呼び出しが1回のバッチ関数呼び出しにまとまる
> - [ ] 同じキーで2回 load してもバッチへ渡されるキーは1件だけになる
> - [ ] loadMany(keys) が配列を返し、内部では同じバッチへ合流する
> - [ ] clear(key) と clearAll() でキャッシュを破棄でき、次の load で再びバッチが走る
> - [ ] バッチ関数の戻り値の件数がキー件数と異なる場合に例外を投げる
> - [ ] バッチ関数が失敗したとき待機中の全 Promise が reject され、失敗キーがキャッシュに残らない
>
> **期待出力**
>
> - load(1)、load(2)、load(1) を同時に発行すると結果は3件だが、バッチ関数の呼び出し履歴はキー2件の1回だけになる
> - clear(1) の後に load(1) すると、バッチ呼び出し履歴が2回になる
> - 件数不一致のとき `Batch loader returned N values for M keys` の形式の例外が出る
> - N+1 の再現側でクエリ回数が 1+N から 1+1 へ減る
>
> **観察項目**
>
> - N+1 再現コードでSQL相当の呼び出し回数をカウントし、11回から2回へ減ることを数値で確認する
> - queueMicrotask を setTimeout へ置き換え、バッチ境界が広がって別リクエスト分まで混ざりうることを確認する
> - キャッシュを有効にしたまま更新処理を挟み、古い値が返ることを再現する
> - バッチ関数が返す配列の順序を入れ替え、キー順に対応付けないと結果が入れ替わることを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `DataLoader batches within a tick, caches, and clears` がパスすることを確認する
> 2. バッチ関数の受け取ったキーを記録するテストを自分で追加し、10件の load が1回のバッチにまとまることを確認する
> 3. バッチ関数を意図的に reject させ、待機中の全 load が reject し、その後の load で再度バッチが走ることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 呼ばれた瞬間には実行せず、いったんキューへ積むのが核。積んだ後にマイクロタスクを1つだけ予約し、そのタイミングで溜まったキーをまとめて渡す。
> 2. **構造**: キューは key と resolve と reject を持つ要素の配列にする。load の中で new Promise を作って resolve と reject をキューへ入れ、初回だけ queueMicrotask で dispatch を予約する。キャッシュは値ではなく Promise を保持する Map にする。
> 3. **実装の要点**: dispatch の先頭でキューを空配列へ差し替え、予約フラグを戻すこと。忘れるとバッチ実行中に来た load が同じ配列へ混ざり二重解決になる。失敗時はキャッシュからキーを削除しないと、以後ずっと失敗した Promise が返る。
>
> **本番利用時の警告**
>
> - DataLoader のキャッシュはリクエスト単位で捨てる前提の設計であり、アプリ全体で1インスタンスを共有すると別ユーザーの認可済みデータをそのまま返す情報漏洩になる。
> - バッチはキー件数の上限を持たないため、1クエリから数万件のキーが集まるとIN句が巨大化してDBを圧迫する。本番では最大バッチサイズと同時実行数を制限する。
>
> **導線**
>
> - 開始地点: `code/ch12/dataloader.ts`
> - 模範解答: `code/ch12/dataloader.solution.ts`
>
> **推定時間の内訳**: バッチキューとマイクロタスク予約の実装50分、キャッシュとloadManyの追加40分、N+1再現と失敗系テストの作成60分
<!-- handbook:exercise:end -->

**問題の再現**:

```typescript
// users と各 user.posts を解決するクエリ
const resolvers = {
  Query: {
    users: () => db.user.findMany(), // 1 回 (10 users)
  },
  User: {
    posts: (user) => db.post.findMany({ where: { userId: user.id } }), // ★ 10 回!
  },
};
// 結果: 1 + 10 = 11 SQL クエリ → N+1 問題
```

**DataLoader による解決**:

```typescript
const postLoader = new DataLoader<number, Post[]>(async (userIds) => {
  // 1 クエリで全ユーザー分の posts を取得
  const posts = await db.post.findMany({ where: { userId: { in: userIds } } });
  // userIds の順序に合わせて返す
  const byUser = new Map<number, Post[]>();
  for (const p of posts) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId)!.push(p);
  }
  return userIds.map((id) => byUser.get(id) ?? []);
});

// resolvers
const resolvers = {
  User: {
    posts: (user) => postLoader.load(user.id),  // バッチ + キャッシュ
  },
};
// 結果: 1 + 1 = 2 SQL クエリ
```

**要件**:
- 同じ tick 内の `load()` を**自動的にバッチング**
- 同じキーで複数回 load しても**ネットワーク呼び出しは1回**(キャッシュ)
- `loadMany([ids])` で複数キー一括
- リクエスト終了でキャッシュクリア

模範解答: `code/ch12/dataloader.solution.ts`

#### 課題12.3: 型安全 RPC (tRPC 風) を自作 (★★★)

**目的**: tRPC の魔法「**スキーマ言語なしでサーバとクライアントが型共有**」の仕組みを実装する。

<!-- handbook:exercise:start {"id":"12.3"} -->
> **演習カード 課題12.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: localhost
>
> **前提**
>
> - 12.9 tRPC ― TypeScript ネイティブ を読み、スキーマ定義から型が伝播する仕組みを確認する
> - 12.1 RESTの設計思想 ― Roy Fielding の博士論文を読み返す を読み、RPCとリソース指向の違いを言えるようにする
> - TypeScript の条件型 (infer) とマップ型を読み書きできる
> - Proxy と fetch でHTTP呼び出しを組み立てられる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] input、output、handler を持つ procedure を定義でき、input と output に検証関数を渡せる
> - [ ] サーバがポートを listen し、POST でパス名を手続き名として該当 handler を実行する
> - [ ] createClient の戻り値から `client.getUser({ id: '7' })` のように型付きで呼べる
> - [ ] 入力が型に合わない場合、サーバが 400 と error キーのJSONを返す
> - [ ] 未定義の手続き名やGETメソッドは 404 を返す
> - [ ] 誤った型の引数を書くと typecheck がエラーになる
>
> **期待出力**
>
> - `client.getUser({ id: '7' })` が id と name を持つオブジェクトを返す
> - 型不一致の入力ではクライアント側で Expected string を含むエラーが throw される
> - 成功応答に content-type: application/json が付く
> - エラー時の本文が error キー1つを持つJSONになる
>
> **観察項目**
>
> - curl で同じエンドポイントを叩き、RPCが普通のHTTP POSTの上に乗っているだけであることを確認する
> - output スキーマの検証を外し、handler が返した余計なフィールドがそのまま外部へ出ることを確認する
> - エディタ上で client の補完を出し、router の型から手続き名と引数が推論されることを見る
> - 存在しない手続き名を呼んだときのステータスと、入力検証失敗のステータスの違いを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `typed RPC validates input and output over HTTP` がパスすることを確認する
> 2. `pnpm --filter @handbook/ch12 run typecheck` を実行し、型エラーが0件であることを確認する
> 3. サーバ起動中に `curl -s -X POST -H 'content-type: application/json' --data '{}' http://127.0.0.1:PORT/getUser` を実行し、400 と error を含むJSONが返れば合格
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: サーバ側はURLのパス名を手続き名として router から引くだけで足りる。難しいのは型の受け渡しなので、スキーマ型から入力型を取り出す条件型を先に決めると全体が固まる。
> 2. **構造**: Schema<T> を parse(value: unknown): T を持つ形で定義し、Infer<S> を `S extends Schema<infer T> ? T : never` で書く。クライアントは Proxy の get トラップで手続き名を拾い、fetch へ流す。
> 3. **実装の要点**: handler の戻り値も output の parse に通すこと。入力だけ検証して出力を素通しにすると、内部の余計なフィールドが外部へ漏れる。応答が ok でないときは本文の error を読み直して throw する。
>
> **本番利用時の警告**
>
> - この最小RPCは認証、CSRF対策、レート制限、リクエストサイズ上限を持たない。そのまま公開すると誰でも全手続きを呼び出せる。
> - エラーメッセージに検証器の内部文言をそのまま返しているため、公開すると内部のフィールド名や構造が推測される。本番ではエラーコードへ丸める。
> - 手続き名をパスからそのままオブジェクトのキーとして引くため、プロトタイプ由来のプロパティへ到達しうる。router を Object.create(null) で作るか、手続き名の許可リストで弾く。
>
> **導線**
>
> - 開始地点: `code/ch12/typed-rpc/starter/main.ts`
> - 模範解答: `code/ch12/typed-rpc/solution/main.ts`
>
> **推定時間の内訳**: スキーマと型推論の設計40分、HTTPサーバとProxyクライアントの実装50分、検証失敗と型エラーの確認40分、curlでの手動確認20分
<!-- handbook:exercise:end -->

**要件**: サーバ側で procedure を定義し、クライアント側で型安全に呼び出す。

```typescript
// server.ts
const procedures = {
  getUser: defineProcedure({
    input: z.object({ id: z.string() }),
    output: z.object({ id: z.string(), name: z.string() }),
    handler: async ({ input }) => {
      return { id: input.id, name: `User ${input.id}` };
    },
  }),
  createPost: defineProcedure({
    input: z.object({ title: z.string(), body: z.string() }),
    output: z.object({ id: z.string() }),
    handler: async ({ input }) => {
      return { id: 'post-' + Date.now() };
    },
  }),
};

const router = createRouter(procedures);
type Router = typeof router;
// HTTP 経由で公開

// client.ts
const client = createClient<Router>('http://localhost:3000');
const user = await client.getUser({ id: '1' });
// user の型は { id: string; name: string } と推論される
```

**評価基準**:
- 型推論が完全に効く (`createPost({ title: 1 })` でコンパイルエラー)
- ランタイム検証 (Zod) も同時に行われる
- HTTP の上に乗っている (普通の REST でも呼べる)

模範解答: `code/ch12/typed-rpc/`

#### 課題12.4: WebSocket でリアルタイム pub/sub (★★)

**目的**: WebSocket の生 API でチャット風アプリを作る。ハートビート・再接続・型安全メッセージング。

<!-- handbook:exercise:start {"id":"12.4"} -->
> **演習カード 課題12.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 12.10 WebSocket ― 全二重リアルタイム通信 を読み、HTTP Upgrade とフレーム構造を確認する
> - 2.4 ヘッダ ― HTTPの真の主役 を読み、Upgrade と Connection ヘッダの役割を把握する
> - Node.js の Buffer でビット演算とXORを扱える
> - 判別可能なユニオン型でメッセージを定義できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] メッセージ検証関数が join / leave / message / ping / pong の5種を判別し、必須フィールドが欠けた入力で TypeError を投げる
> - [ ] テキストフレーム生成関数がFIN付きテキストフレーム (先頭バイト 0x81) を返し、126バイト以上のペイロードを明示的に拒否する
> - [ ] クライアントフレーム復号関数がマスクビットを確認し、4バイトのマスクキーでXORを解いて文字列を返す
> - [ ] ルーム管理の join が入室通知を配信し、戻り値の関数を呼ぶと退室通知が飛ぶ
> - [ ] 同じルームへの publish が全メンバーへ届き、別ルームには届かない
> - [ ] 再接続待ち時間が指数的に増え、上限10000ミリ秒で頭打ちになる
>
> **期待出力**
>
> - 文字列 hi のフレームの16進表現が 81026869 になる
> - マスク済みクライアントフレームを復号すると元の文字列が返る
> - 1人が join したルームで publish すると、その購読者が join と message の2件を受け取る
> - 再接続待ち時間が attempt 3 で 2000 になる
>
> **観察項目**
>
> - 生成したフレームの先頭2バイトを16進で見て、FINビット、opcode 1、マスク無しの構成を確認する
> - クライアントからサーバへのフレームだけがマスクされる仕様を、マスクビットを落としたフレームが拒否されることで確認する
> - ルームのメンバー数を退室前後で比べ、最後の1人が抜けたときにルーム自体が消えることを見る
> - 再接続待ち時間を attempt 0 から 10 まで出力し、上限に達する回数を数える
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 run test` を実行し、テスト `WebSocket educational primitives frame text and publish by room` がパスすることを確認する
> 2. 126バイト以上の文字列をフレーム生成関数へ渡し、`Educational frame encoder supports payloads under 126 bytes` の例外が出れば境界処理は合格
> 3. マスクなしのフレームを復号関数へ渡し、`Invalid educational client frame` が投げられることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 配信の仕組みとフレームの符号化を分けて考える。ルームは「ルーム名からメンバーの送信関数への二段Map」で表せ、購読解除は join の戻り値の関数で行うと後始末を忘れにくい。
> 2. **構造**: テキストフレームは先頭バイトが 0x81 (FIN と opcode 1)、2バイト目が長さ。クライアント側フレームは長さの最上位ビットがマスクフラグで、続く4バイトがマスクキー。復号は payload[i] = data[6 + i] とマスク[i % 4] のXOR。
> 3. **実装の要点**: ペイロード長が126以上になると長さフィールドが2バイトまたは8バイトの拡張形式へ変わる。教材実装では126未満に限定して明示的に例外を投げないと、長いメッセージで壊れたフレームを送ってしまう。
>
> **本番利用時の警告**
>
> - この教材実装は Sec-WebSocket-Accept のハンドシェイク検証、Origin検証、認証、フラグメント化フレーム、close frame の処理を持たない。そのまま公開すると任意のサイトから接続され、ルームのメッセージを読まれる。
> - ペイロード長と接続数に上限が無く、ping/pong によるアイドル接続の切断も未実装のため、接続を張り続けるだけでメモリとファイルディスクリプタを消費させられる。本番では実績のあるWebSocketライブラリで上限とタイムアウトを設定する。
> - 履歴100件をプロセスのメモリに持つ実装は再起動と水平スケールで消える。複数インスタンスへ広げるにはRedisなど外部のpub/subと永続化が要る。
>
> **導線**
>
> - 開始地点: `code/ch12/websocket-chat/starter/main.ts`
> - 模範解答: `code/ch12/websocket-chat/solution/main.ts`
>
> **推定時間の内訳**: メッセージ型と検証の実装25分、フレーム符号化と復号30分、ルーム配信と再接続遅延20分、境界条件のテスト15分
<!-- handbook:exercise:end -->

**機能** (★ は模範解答が実装済み、それ以外は読者の実装範囲):
- ★ ルーム制 (`/rooms/general`、`/rooms/dev`)
- ★ メッセージブロードキャスト
- ★ 入退室通知
- 切断検知 (30秒間 ping なしで切断)
- 再接続時に過去 100 メッセージを送信

**サーバ**:
```typescript
type Message =
  | { type: 'join'; room: string; user: string }
  | { type: 'leave'; room: string; user: string }
  | { type: 'message'; room: string; user: string; text: string }
  | { type: 'history'; messages: Message[] };
```

模範解答: `code/ch12/websocket-chat/`

#### 課題12.5: SSE でサーバプッシュ通知 (★)

**目的**: WebSocket より軽量な SSE で「サーバから一方向プッシュ」を実装。

<!-- handbook:exercise:start {"id":"12.5"} -->
> **演習カード 課題12.5** ― 難易度 ★ ／ 推定時間 45分 ／ 必要サービス: なし
>
> **前提**
>
> - 12.11 SSE (Server-Sent Events) ― シンプルな単方向プッシュ を読み、イベントストリームの行形式を確認する
> - `curl --no-buffer` でストリーミング応答を読める
> - Node.js の http.createServer でヘッダを書いてから本文を追記できる
> - bash でバックグラウンド起動したサーバのポートを受け取り、trap で後始末できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `/events` が content-type: text/event-stream と cache-control: no-cache を付けて 200 を返す
> - [ ] `/events` 以外のパスは 404 を返す
> - [ ] stock-update、user-online、notification の3種を event 行で送り分ける
> - [ ] 各イベントに id 行を付け、Last-Event-ID ヘッダの値の次から採番する
> - [ ] data 行が1行のJSONで、イベント間が空行で区切られる
> - [ ] サーバ起動時に待ち受けポート番号が標準出力へ1行出る
>
> **期待出力**
>
> - Last-Event-ID に 40 を指定して要求すると最初のイベントのIDが 41 になる
> - 応答本文に event: stock-update、event: user-online、event: notification の3行が現れる
> - data 行に symbol と price を含むJSONが1行で入る
> - 1イベントが id 行、event 行、data 行の3行と空行1つで構成される
>
> **観察項目**
>
> - `curl -N` の出力を見て、イベントの区切りが空行1つであることを確認する
> - Last-Event-ID の値を変えて再要求し、採番が続きから始まることを確認する
> - ブラウザの EventSource で接続し、サーバが接続を閉じた後に自動再接続が起きることを DevTools の Network タブで見る
> - content-type を text/plain に変えると EventSource が受け付けないことを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 run test` を実行する。テストスクリプトが sse-push/solution/main.sh を実行するため、SSE応答の検査も同時に走る
> 2. `bash code/ch12/sse-push/solution/main.sh` を単独実行し、id: 41 と3種の event 行がすべて見つかれば合格 (1つでも欠けると grep が失敗して非0終了する)
> 3. `curl -N -H 'Last-Event-ID: 0' http://127.0.0.1:PORT/events` を実行し、id: 1 から始まる3イベントが表示されることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: SSEは特別なプロトコルではなく、text/event-stream を宣言したHTTP応答へ行を書き足していくだけ。まず固定の3イベントを書いて終了する版を作り、そこへID採番を足す。
> 2. **構造**: ヘッダは content-type: text/event-stream、cache-control: no-cache、connection: keep-alive の3つ。1イベントは id 行、event 行、data 行に空行1つを続ける形式で、再開位置は last-event-id ヘッダから取る。
> 3. **実装の要点**: 行の区切りは改行1つ、イベントの終端は空行1つ (つまり改行2つ)。ここを1つ間違えると、接続は成功するのにクライアントはイベントを1つも受け取れない。
>
> **本番利用時の警告**
>
> - この実装は3件送って接続を閉じるだけで、イベントの永続化も切断中に発生した分の再送も持たない。欠落が許されない用途ではIDに紐づくイベントストアと再送が要る。
> - 接続を保持するSSEは1接続でソケットを1つ占有する。上限を設けないと同時接続数でファイルディスクリプタを使い切る。プロキシのアイドルタイムアウトによる切断も前提に、ハートビートのコメント行を送る設計が必要になる。
>
> **導線**
>
> - 開始地点: `code/ch12/sse-push/starter/main.sh`
> - 模範解答: `code/ch12/sse-push/solution/main.sh`、`code/ch12/sse-push/solution/server.mjs`
>
> **推定時間の内訳**: SSEサーバの実装20分、Last-Event-IDによる採番15分、curlとブラウザでの確認10分
<!-- handbook:exercise:end -->

**要件**:
- `/events` エンドポイントが接続を保持
- イベントタイプ (stock-update、user-online、notification)
- 自動再接続 (ブラウザ標準)
- ID で再開 (Last-Event-ID ヘッダ)

模範解答: `code/ch12/sse-push/`

---

#### 課題12.6: 再開可能アップロードの中断を再現して直す (★★★)

**目的**: 12.13 と 12.14 で挙げたアップロードの失敗を、回線を切る模擬の上で実際に再現し、署名条件・オフセット条件・回収の3つで消えることを確かめる。

<!-- handbook:exercise:start {"id":"12.6"} -->
> **演習カード 課題12.6** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 12.13 ファイルアップロードの転送方式 ― multipart と presigned URL を読み、署名条件に入れた項目だけが強制されることを確認する
> - 12.14 大容量アップロードと再開可能プロトコル を読み、HEAD で受信済みオフセットを返す仕組みと PATCH の条件付き書き込みを押さえる
> - 23.26 アップロードされたファイルの検証 を読み、受理と内容検査が別の段階であることを確認する
> - `code/ch12` で pnpm install 済みで、`pnpm --filter @handbook/ch12 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `issueGrant` が発行する許可証に上限バイト数が含まれ、`FakeStorage` が超過書き込みを拒否する
> - [ ] `headSession` が保存済みバイト列の実長からオフセットを返し、`restart` の後も同じ値を返す
> - [ ] `patchChunk` が `offset !== received` のとき書き込まずに ConflictError を投げる
> - [ ] `collectExpired` が期限切れセッションと確保済みバイト列の両方を消し、件数と回収バイト数を返す
> - [ ] `runFindings` が期待値を直書きせず、naive と fixed の戻り値とストレージ状態の差から判定する
> - [ ] `pnpm --filter @handbook/ch12 exec tsx resumable-upload/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `naive server: 4/4 failures reproduced` が出る
> - U1 の行が `naive stored=31457280 / fixed stored=4194304 (declared=5242880)` になる
> - U2 の行が `naive resent=12582912 / fixed resent=4194304 (minimum=4194304)` になる
> - U3 の行が `naive stored=12582912 / fixed stored=8388608 (sent=8388608)` になる
> - 最終行が `fixed server: 0/4 failures remaining` になり、U4 の fixed 側が `retained=0/0B` になる
>
> **観察項目**
>
> - `FIXTURES.resume.cutAfterBytes` を 4MiB へ変え、fixed 側の再送量が切断位置に連動して変わり、naive 側は毎回全量のままであることを確認する
> - `patchChunk` のオフセット一致検査を外し、U3 だけが再現に戻ることを確認する
> - `headSession` を保存長ではなくメモリ上の値から返すよう変え、再開時にオフセット不一致の ConflictError になって再開できなくなることを確認する
> - `issueGrant` の maxBytes と `patchChunk` の宣言長検査を両方外すと U1 だけが再現に戻り、片方だけでは戻らないことを確認する
> - `collectExpired` を空実装へ戻し、U4 だけが再現に戻ることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch12 exec tsx resumable-upload/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch12 run test` を実行し、resumable upload のテストが pass することを確認する
> 3. 自分の `resumable-upload/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch12 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に `headSession` を通す。残る3つの修正はすべて「サーバが受信済みオフセットを正しく答えられる」ことの上に載るため、ここが誤っていると原因の切り分けができなくなる。
> 2. **構造**: サーバの状態を2種類に分ける。セッションの台帳 (総バイト数、期限、上限) と、実際に書き込まれたバイト列である。オフセットは後者の長さから毎回導き、台帳には持たせない。この分け方にすると、再起動でオフセットが失われるという誤りが構造として起きなくなる。
> 3. **実装の要点**: `patchChunk` では、オフセットの一致検査、総バイト数の超過検査、追記とオフセット更新の原子性の3つを順に置く。追記してから台帳を更新する二段構えにすると、その間で落ちたときに二重書き込みが起きる。書き込み先の実長をそのまま真実として扱えば、更新という操作自体が要らなくなる。
>
> **本番利用時の警告**
>
> - この実装はメモリ上の `FakeStorage` を使っており、実際のオブジェクトストレージの整合性モデル、パート数の上限、課金体系を再現していない。本番では利用するストレージの分割アップロードAPIとライフサイクル規則を確認する。
> - `FlakyLink` は決まった位置で切れるだけで、部分的な書き込み、遅延、順序の入れ替えといった実際のネットワーク障害の多くを模していない。本番では想定する最大サイズで実回線を切る試験を別に行う。
> - この課題は転送の完全性だけを扱い、内容の安全性は扱わない。受理したバイト列は 23.26 の検証を通すまで配信してはならない。
>
> **導線**
>
> - 開始地点: `code/ch12/resumable-upload/starter/main.ts`
> - 模範解答: `code/ch12/resumable-upload/solution/main.ts`、`code/ch12/resumable-upload/solution/report.ts`
>
> **推定時間の内訳**: FakeStorage と許可証の実装30分、headSession と patchChunk の実装40分、collectExpired と runFindings の判定設計40分、切断位置と検査を外した観察40分
<!-- handbook:exercise:end -->

**題材**: 外部のオブジェクトストレージを使わず、`FakeStorage` (メモリ上のバイト列) と `Link` (決まった位置で必ず切れる回線の模擬) を使う。切れる位置も応答を落とす位置も、乱数ではなく固定表 (`FIXTURES`) から取るため、何度実行しても同じ結果になる。

**要件**: `code/ch12/resumable-upload/starter/main.ts` に次の4つを実装する。

1. `issueGrant(server, request)` ― 署名付きURLに相当する許可証を発行する。`naive` 版はサイズを台帳に記録するだけで許可証の条件に入れない。`fixed` 版は `maxBytes` を許可証自体へ含め、ストレージ側が超過を拒否する。
2. `headSession(server, sessionId)` ― 受信済みバイト数を返す。`naive` 版はプロセスのメモリだけに持ち、再起動を模した `restart()` の後に失う。`fixed` 版は保存済みバイト列の実長から毎回読み直す。
3. `patchChunk(server, sessionId, offset, chunk)` ― 追記する。`naive` 版はオフセットを見ずに末尾へ足す。`fixed` 版は `offset !== received` のとき `ConflictError` を投げて書き込まない。
4. `collectExpired(server, now)` ― 期限切れの未完了セッションを回収する。`naive` 版は何もしない。`fixed` 版はセッションと確保済みバイト列の両方を消し、件数と回収バイト数を返す。

再現する4件は次のとおりで、すべて `naive` 側の実装に含まれている。

| 番号 | 誤り | 再現される事象 |
|---|---|---|
| U1 `signed-size-ignored` | 上限を許可証の条件に入れていない | 申告 5MiB の許可証で 30MiB が書き込まれる |
| U2 `resume-restart` | 受信済みオフセットをプロセスメモリに持つ | 再起動後に再開できず、送信済みバイトを送り直す |
| U3 `duplicate-chunk` | 追記にオフセット条件がない | 応答を取りこぼして再送すると、同じ範囲が二重に書かれる |
| U4 `orphan-session` | 中断セッションを回収しない | 3件のセッションと確保済み容量が残り続ける |

**評価基準**:

- 同じ `runFindings` が、`naive` サーバでは 4/4、`fixed` サーバでは 0/4 になる
- U2 で、`fixed` 側の再送バイト数が「切れた位置以降」だけ (4MiB) に収まる
- U3 で、`fixed` 側の保存長が実際に送ったバイト数と一致する (宣言長 16MiB の上限ではなく、オフセット条件が止めている)
- U4 で、回収後の未完了セッション数が0になり、回収バイト数が確保量と一致する
- 判定に期待値を直書きせず、サーバの戻り値と `FakeStorage` の状態だけから導く

```text
naive server: 4/4 failures reproduced
  U1 signed-size-ignored: naive stored=31457280 / fixed stored=4194304 (declared=5242880)
  U2 resume-restart: naive resent=12582912 / fixed resent=4194304 (minimum=4194304)
  U3 duplicate-chunk: naive stored=12582912 / fixed stored=8388608 (sent=8388608)
  U4 orphan-session: naive retained=3/12582912B / fixed retained=0/0B (collected=3/12582912B)
fixed server: 0/4 failures remaining
```

模範解答: `code/ch12/resumable-upload/solution/`

<!-- handbook:code-usage:start {"chapter":12} -->
### 第12章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第12章の模範解答をまとめて検証する
pnpm --filter @handbook/ch12 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch12 exec tsx openapi-codegen/solution/main.ts   # 課題12.1
pnpm --filter @handbook/ch12 exec tsx dataloader.solution.ts             # 課題12.2
pnpm --filter @handbook/ch12 exec tsx typed-rpc/solution/main.ts         # 課題12.3
pnpm --filter @handbook/ch12 exec tsx websocket-chat/solution/main.ts    # 課題12.4
bash code/ch12/sse-push/solution/main.sh                                 # 課題12.5
pnpm --filter @handbook/ch12 exec tsx resumable-upload/solution/main.ts  # 課題12.6
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch12/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

<a id="chapter-13"></a>
## 第13章 認証と認可

第12章で、クライアントとサーバが交換するデータと通信方式を契約として定義した。しかし、正しい形式の要求であっても、送り手が申告どおりの人物か、その人物に対象リソースを操作する権限があるかはAPI仕様だけでは判断できない。ここを曖昧にすると、機能が正しく動くほど権限漏洩も一貫して実行されてしまう。

本章では、本人性を確かめる**認証**と、許可される操作を決める**認可**を別の責務として組み立てる。パスワードとセッションから始める。次に、署名付きトークンである JWT (JSON Web Token)、第三者への認可委譲である OAuth、その上に認証を載せた OIDC (OpenID Connect)、公開鍵認証の WebAuthn、組織をまたぐ SSO (Single Sign-On)、要素を重ねる MFA (Multi-Factor Authentication)、そして送信者制約へ進む。最後に、役割で判断する RBAC (Role-Based Access Control)、属性で判断する ABAC (Attribute-Based Access Control)、関係で判断する ReBAC を、中央化された判断へ接続する。最後に、複数の顧客が同じアプリケーションを共有するSaaSでは、権限判定の前に「どのテナントのデータか」という次元が加わることを扱う。ここで信頼された要求を作れるようになると、第IV部では、その要求による業務状態の更新を同時実行下でも正しく保存する問題へ進める。

<!-- handbook:chapter-guide:start {"chapter":13} -->
> **この章の学習ガイド**
>
> **解決する実務上の問題**  
> 本人確認、セッション維持、第三者認可、権限制御を混同せず、アカウント乗っ取りと権限漏洩を防ぐ。
>
> **到達目標**
> - 認証と認可、OAuthとOIDCを区別できる。
> - パスワード、セッション、JWT、WebAuthnの脅威と運用条件を説明できる。
> - RBAC/ABAC/ReBACと中央化された認可を設計できる。
> - マルチテナントのテナント境界を、認証・所属・権限の3段階として設計できる。
> - 正しい資格情報を使う攻撃 (Credential Stuffing、パスワードスプレー) を、試行の鍵と段階的な対応で扱える。
>
> 到達目標は章全体に対するものである。標準通読ルートは必修節だけを読むため、下の「中核概念」に (実務選択) (発展) (展望) と付いた節がある章では、その節を読むまで到達目標の一部が埋まらない。必修節を読み終えた時点で説明できない項目があれば、まず付記のある節へ進む。
>
> **前提知識**
> - [2.4 ヘッダ ― HTTPの真の主役](02-part1-foundations.md#section-2-4) ― HTTPヘッダとCookie
> - [3.3 TLS/SSL ― 通信を暗号化する](02-part1-foundations.md#section-3-3) ― TLS
>
> **中核概念**  
> [13.1 パスワード認証の基礎](#section-13-1)、[13.2 セッション vs トークン ― 状態管理の対立](#section-13-2)、[13.4 JWT (JSON Web Token) の構造と注意点](#section-13-4)、[13.6 CSRF 対策](#section-13-6)、[13.7 OAuth 2.0 ― 第三者認可](#section-13-7)、[13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証](#section-13-8)、[13.10 認可モデル ― RBAC、ABAC、ReBAC](#section-13-10)、[13.11 認可ロジックを「中央集権」にする](#section-13-11)、[13.24 マルチテナントの認可とテナント境界](#section-13-24) (実務選択)、[13.25 認証エンドポイントの濫用 ― Credential Stuffing とアカウント列挙](#section-13-25) (実務選択)
>
> **最小実装**  
> [13.3 セッション認証の実装](#section-13-3)、[13.13 OIDC 風の最小認証サーバ自作](#section-13-13) (発展)、[13.26 実装課題 ― 認証と認可の核を実装する](#section-13-26) (実務選択)
>
> **本番実装との差分**
> - 教材認証サーバは鍵管理、クライアント登録、同意、失効、監査、攻撃耐性を省略する。公開認証基盤として利用しない。
>
> **典型的な失敗**
> - JWTを暗号化済みと誤解する。
> - IDだけで認可しtenant境界を確認しない。
> - redirect URIやissuer/audience検証を省く。
> - アカウント単位の固定回数ロックだけを置き、分散した試行と締め出しDoSの両方に外す。
>
> **診断・デバッグ方法**
> - 認証イベント、token ID、issuer、audience、認可判断を機密情報を除いて記録する。
> - 失効、時刻ずれ、鍵ローテーションを故障注入する。
> - 2テナント以上のデータで、一覧以外の経路も含めて越境を検査する。
> - ログイン失敗率を、アカウント・送信元・ネットワーク・全体の4層で分けて観測する。
>
> **意思決定チェックリスト**
> - 誰が誰に何を委任するか。
> - セッション失効要求はどれほど強いか。
> - 権限変更をどこで即時反映するか。
> - テナントの存在を秘匿するか。403と404の使い分けは全経路で揃っているか。
> - しきい値を超えたとき、遅延・追加チャレンジ・追加要素・一時制限のどれから入るか。
>
> **演習と評価基準**  
> 対象: [13.26 実装課題 ― 認証と認可の核を実装する](#section-13-26) (実務選択)
> - 攻撃シナリオを再現し、どの検証が防いだか説明できる。
> - 正しい資格情報を使う攻撃を再現し、どの層の対策が止めたか説明できる。
>
> **一次資料・発展資料**
> - OAuth 2.0 Security BCP (RFC 9700)
> - OpenID Connect Core
> - WebAuthn specifications
> - JWT BCP (RFC 8725)
> - OWASP Credential Stuffing Prevention Cheat Sheet
<!-- handbook:chapter-guide:end -->

<a id="section-13-1"></a>
### 13.1 パスワード認証の基礎
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"A","term":"Argon2"} -->
<!-- handbook:index {"group":"B","term":"BCrypt"} -->
<!-- handbook:index {"group":"は行","term":"パスワード認証"} -->
<!-- handbook:index {"group":"ま行","term":"メールアドレス検証"} -->

<!-- handbook:narrative-bridge {"section":"13.1"} -->
APIが正しい形式で届いても、呼び出し主体が本人である保証はない。最も基本的な資格情報であるパスワードから、秘密そのものを保存せず照合するためのハッシュ、ソルト、コスト設計を確認する。

**ハッシュとソルト:**

DBに平文パスワードを保存するのは犯罪レベルの過失。必ずハッシュ化する。しかし単純なハッシュ (SHA-256) は不十分:

- 同じパスワード → 同じハッシュ → レインボーテーブル攻撃
- 高速ハッシュ → ブルートフォース攻撃

**どんなパスワードを受け付けるか:**

保存の仕方より前に、何を受け入れるかを決める必要がある。NIST SP 800-63B は、長年広まってきた慣行のいくつかを明確に否定している [NIST SP 800-63B]。

- **長さで守る**: 利用者が決める秘密は8文字以上を必須とし、15文字以上を推奨する。上限は64文字以上まで受け入れる
- **合成規則を課さない**: 「大文字・小文字・数字・記号を混ぜること」のような規則を**課してはならない**。利用者は `Password1!` のような予測しやすい形へ寄せるだけで、推測されにくさは上がらない
- **定期変更を強制しない**: 漏洩の兆候があるときにだけ変更を求める。定期変更は、末尾の数字を増やす運用を招く
- **漏洩済みの値を弾く**: 既知の漏洩リストと照合し、含まれていれば別の値を求める。これが合成規則よりはるかに効く
- **貼り付けを許す**: パスワード管理ソフトの利用を妨げない。文字種の制限や `paste` の禁止は逆効果である
- **Unicodeを受け入れる**: 空白や絵文字を含む値も、正規化したうえで受け付ける

つまり、守るのは**長さと漏洩チェック**であって、文字種の組み合わせではない。

正しいハッシュ関数:

- **Argon2id**: 新規設計で第一候補。メモリ量、反復回数、並列度を本番環境で計測して決める
- **scrypt**: メモリハードな選択肢。利用可能な実装と運用要件を確認する
- **bcrypt**: 広く実績があるが、入力長の扱いとコスト設定に注意する。既存システムとの互換用途で有力
- **PBKDF2**: 標準・規制・プラットフォーム互換性を優先するときの選択肢

どの方式でも、ライブラリのデフォルト値を盲信せず、認証サーバの許容レイテンシとDoS耐性を両立するパラメータをベンチマークする。

```typescript
import { hash, verify } from '@node-rs/argon2';

// ユーザー登録時
const passwordHash = await hash('user-input-password', {
  memoryCost: 19_456,    // 19 MiB
  timeCost: 2,
  parallelism: 1,
});
// DBには passwordHash だけ保存

// ログイン時
const isValid = await verify(passwordHash, 'user-input-password');
```

Argon2 はソルトを内部で生成・埋め込みする (アウトプット文字列にソルトが含まれる)。自分でソルトを管理する必要はない。

**ログイン制限:**

総当たり攻撃を防ぐため:

- アカウント、送信元IP/ネットワーク、端末・セッション、全体負荷を組み合わせたレート制限
- 固定回数での一律ロックではなく、指数的遅延、追加認証、リスクベース判定を組み合わせる。攻撃者が他人のアカウントをロックするDoSにも注意する (鍵の分け方と段階的な対応は 13.25 で扱う)
- CAPTCHAなどの追加チャレンジは、繰り返し失敗や高リスク時に限定する
- 多要素認証。SMS・メールは回復手段や低保証要素として扱い、可能ならTOTPまたはパスキーを検討する

<a id="section-13-2"></a>
### 13.2 セッション vs トークン ― 状態管理の対立
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"13.2"} -->
パスワードで一度本人確認できても、以後のすべての要求で再入力させるわけにはいかない。認証結果を複数要求へ引き継ぐ方法として、サーバ側セッションと自己完結トークンの状態配置を比較する。

ログイン後、ユーザーをどう識別し続けるか。2つのアプローチがある。

**セッション方式 (サーバ状態あり):**

```text
1. ログイン成功 → サーバが session_id を生成、内部 (Redis 等) に保存
2. session_id を Cookie でクライアントに渡す
3. 以降のリクエスト → Cookie の session_id でサーバが照合
```

利点: 即座に無効化できる (Redis から削除)、改ざん不可、内容を見られない
欠点: 複数サーバで同じセッションを扱うには共有ストア、スティッキーセッション、署名・暗号化Cookieなどの方式選択が必要。Redisは一例であり必須ではない

**トークン方式 (ステートレス):**

```text
1. ログイン成功 → サーバが JWT を発行 (ユーザーIDなどを含む、署名付き)
2. JWT をクライアント保存
3. 以降のリクエスト → JWT を Authorization ヘッダで送信
4. サーバは JWT の署名検証のみで認証完了 (DB問い合わせ不要)
```

利点: ステートレス、複数サーバで共有しやすい
欠点: 自己完結トークンだけで検証すると即時失効が難しい。短い有効期限、失効リスト、トークンバージョン、イントロスペクションなどを必要に応じて組み合わせる。暗号化していないJWTのペイロードは読める

<a id="section-13-3"></a>
### 13.3 セッション認証の実装
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"さ行","term":"セッション認証"} -->

<!-- handbook:narrative-bridge {"section":"13.3"} -->
セッションとトークンの違いを概念だけで比較すると、Cookie、識別子、保存先、失効がどこで結び付くかが見えにくい。まずサーバ側に状態を持つセッション認証を実装し、要求ごとの復元手順を追う。

```typescript
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

// 簡略化: in-memory のセッションストア (本番は Redis)
const sessions = new Map<string, { userId: string; expiresAt: number }>();

function createSession(userId: string): string {
  const sessionId = randomBytes(32).toString('base64url');
  sessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + 86400 * 1000,  // 24時間
  });
  return sessionId;
}

function getSession(sessionId: string): { userId: string } | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { userId: s.userId };
}

// ログインエンドポイント
function handleLogin(req: Req, res: Res) {
  const { email, password } = req.body;
  // ※実際は DB で検証
  if (email === 'alice@example.com' && password === 'correct') {
    // 認証に成功した瞬間に、それまでのセッションを破棄して新しいIDを発行する。
    // 使い回すと、攻撃者があらかじめ被害者のブラウザへ仕込んだIDが認証後も有効になり、
    // そのIDで被害者になりすませる (セッション固定攻撃)
    const previous = parseCookie(req.headers.cookie ?? '').session;
    if (previous) sessions.delete(previous);
    const sessionId = createSession('user-42');
    res.setHeader('Set-Cookie',
      `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`
    );
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
}

// 認証ミドルウェア
function requireAuth(req: Req, res: Res, next: () => void) {
  const cookies = parseCookie(req.headers.cookie ?? '');
  const session = getSession(cookies.session);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  (req as any).userId = session.userId;
  next();
}

function parseCookie(s: string): Record<string, string> {
  return Object.fromEntries(s.split('; ').map(p => p.split('=')));
}
```

**Cookie の必須属性:**

| 属性 | 役割 |
|---|---|
| `HttpOnly` | JavaScript から読めない (XSS でセッション盗難を防ぐ) |
| `Secure` | HTTPS でしか送らない |
| `SameSite=Lax`/`Strict` | CSRF 対策 |
| `Max-Age` / `Expires` | 有効期限 |
| `Path` | スコープ |
| `Domain` | サブドメインを跨ぐかどうか |

属性と同じくらい重要なのが、**セッションIDをいつ作り直すか**である。ログイン、権限の昇格、パスワード変更、多要素認証の完了のように、そのセッションが表す権限が変わる操作の直後には必ず新しいIDを発行し、古いIDを無効にする。作り直さないと、攻撃者が事前に被害者へ与えたIDが認証後も通用してしまう。ログアウト時も、Cookieを消すだけでなくサーバ側の記録を削除する。

これらを正しく付けないと、認証情報が漏洩する。

<a id="section-13-4"></a>
### 13.4 JWT (JSON Web Token) の構造と注意点
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"B","term":"Base64URL"} -->
<!-- handbook:index {"group":"J","term":"JSON Web Token (JWT)"} -->
<!-- handbook:index {"group":"は行","term":"ブラックリスト"} -->

<!-- handbook:narrative-bridge {"section":"13.4"} -->
セッションは即時失効と中央管理に向く一方、複数サービスや水平分割では共有ストアへの依存が増える。JWTは検証に必要な主張と署名をトークンへ含め、状態参照を減らす代わりに失効と情報露出の制約を引き受ける。

JWT は3部構成: `header.payload.signature`、各部Base64URL エンコード。

```text
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTQyIiwiZXhwIjoxNzQ4MDAwMDAwfQ.signature
```

デコードすると:

```json
// header
{ "alg": "HS256", "typ": "JWT" }

// payload (claim)
{
  "sub": "user-42",       // subject (userId)
  "iss": "example.com",   // issuer
  "iat": 1747000000,      // issued at
  "exp": 1748000000,      // expires
  "role": "admin"
}

// signature: HMAC_SHA256(secret, header.payload)
```

**実装例:**

```typescript
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

// 発行
const token = await new SignJWT({ role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('user-42')
  .setIssuer('https://example.com')
  .setAudience('example-api')
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(secret);

// 検証
try {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'https://example.com',
    audience: 'example-api',
  });
  console.log(payload.sub, payload.role);
} catch (e) {
  console.error('Invalid token');
}
```

**JWT の落とし穴:**

1. **即時失効が複雑**: 自己完結検証だけでは有効期限まで受理される。短い有効期限に加え、必要な脅威モデルでは失効リスト、ユーザー単位のトークンバージョン、イントロスペクションを使う
2. **`alg: none` 攻撃**: 古いライブラリは「アルゴリズムなし」を受け入れた。検証時に許可するアルゴリズムを必ず固定
3. **秘密鍵管理**: HS256 (対称鍵) は全サーバが秘密を持つ。多数サーバなら RS256 (非対称、公開鍵検証) を検討
4. **大きい**: Cookie より大きく、Header に積むと制限に当たる
5. **保存・送信方法ごとに脅威が異なる**: Cookieで自動送信すればCSRF対策が必要で、JavaScriptから読める保存領域はXSSによる窃取に弱い。ブラウザではサーバ管理セッションやBFFを第一候補とし、要件に応じてCookie属性、CSRF対策、CSP、トークン寿命を組み合わせる

実務の合意:

- **セッション方式を基本にする**: シンプルで安全、多くのケースで十分
- **JWT は API 連携・モバイル・マイクロサービス間で使う**: ステートレスの利点が活きる
- **両方の hybrid**: ブラウザ向けセッション + 内部 API は JWT、もよくある

<a id="section-13-5"></a>
### 13.5 リフレッシュトークン
<!-- handbook:learning {"level":"required","minutes":5} -->

<!-- handbook:narrative-bridge {"section":"13.5"} -->
JWTを含むアクセストークンを長期間有効にすると、盗難時の影響も長く続く。短命なアクセストークンと、再発行だけに使う更新資格情報を分け、利便性と失効可能性を両立するのがリフレッシュトークンである。

アクセストークンの有効期限を短く (15分) するなら、ユーザーは15分ごとにログインし直すのか? もちろん違う。**リフレッシュトークン**で更新する。

```text
ログイン成功:
  - access_token (15分有効、API リクエストに使う)
  - refresh_token (30日有効、トークン更新だけに使う)

access_token が期限切れ:
  → refresh_token で新しい access_token を取得
  → refresh_token もローテーション (古いものは無効化)
```

ブラウザでは、リフレッシュトークンをJavaScriptから読めない`HttpOnly` Cookieに置く構成が一般的だが、Cookieのスコープ、CSRF、ローテーション時の再利用検知を設計する。アクセストークンを`localStorage`へ長期保存すると XSS (Cross-Site Scripting) で窃取されるため、サーバ管理セッション/BFFまたは短期のメモリ保持を優先して検討する。

<a id="section-13-6"></a>
### 13.6 CSRF 対策
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"C","term":"CORS"} -->
<!-- handbook:index {"group":"C","term":"CSRF"} -->

<!-- handbook:narrative-bridge {"section":"13.6"} -->
Cookieでセッションや更新トークンを自動送信すると、ブラウザは要求を作ったページの正当性までは確認しない。別サイトから意図しない操作を送らせるCSRFに対し、送信元と意図を追加情報で検証する必要がある。

CSRF (Cross-Site Request Forgery) は「ログイン中のユーザーを罠サイトに誘導し、意図しないリクエストを送らせる」攻撃。

```html
<!-- 罠サイト attacker.com に仕込まれたフォーム -->
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker-account">
  <input name="amount" value="1000000">
</form>
<script>document.forms[0].submit();</script>
```

ユーザーが bank.com にログイン中なら、Cookie が自動送信されてしまう。これが CSRF。

**対策:**

1. **SameSite Cookie**: `Lax`または`Strict`は有力な防御だが、ブラウザ挙動、トップレベル遷移、サブドメイン構成、互換性に例外があるため単独では依存しない
2. **CSRF トークン**: Synchronizer Tokenまたは署名付きDouble-Submit Cookieを使い、Cookie以外の経路でも送らせる
3. **オリジン検証**: 状態変更要求で`Origin`を確認し、利用できない場合の`Referer`方針を定める
4. **操作の設計**: GETなど安全なメソッドで状態を変更しない。JSON APIでも、単純リクエストやCORS設定次第でCSRFが成立しうる

```typescript
// CSRF トークンの簡易実装
function setCsrfToken(res: Res): string {
  const token = randomBytes(32).toString('base64url');
  res.setHeader('Set-Cookie',
    `csrf=${token}; SameSite=Strict; Secure; Path=/`
  );
  return token;
}

function verifyCsrfToken(req: Req): boolean {
  const cookie = parseCookie(req.headers.cookie ?? '').csrf;
  const rawHeader = req.headers['x-csrf-token'];
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!cookie || !header) return false;

  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
// 本番ではセッションへバインドしたSynchronizer Token、またはHMAC署名した
// Double-Submit Tokenを採用し、Cookie注入や複数タブの要件も検討する。
```

クライアントはCookieの値を読み取り、リクエスト時に `X-CSRF-Token` ヘッダに同じ値を載せる。攻撃者のサイトからは Cookie の値が読めないため、ヘッダに正しい値を設定できない。

<a id="section-13-7"></a>
### 13.7 OAuth 2.0 ― 第三者認可
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"O","term":"OAuth 2.0"} -->
<!-- handbook:index {"group":"P","term":"PKCE"} -->

<!-- handbook:narrative-bridge {"section":"13.7"} -->
自分のサービス内のログインを守れても、別サービスへユーザーのパスワードを渡さず、限定した操作だけを委任したい場面がある。OAuth 2.0は、利用者、クライアント、認可サーバ、リソースサーバを分けて第三者認可を表現する。

「Twitterでログイン」「Googleでログイン」を実現するのが **OAuth 2.0** [Hardt, 2012]。注意: OAuth 2.0 は本来「認可」のためのフレームワークで、「認証」用ではない (これが後述のOIDC が必要な理由)。

**用語:**

- **Resource Owner**: ユーザー
- **Client**: あなたのアプリ (この場合 OAuth する側)
- **Authorization Server**: 認可サーバ (Google、Twitter等)
- **Resource Server**: ユーザーのデータを持つAPI (Google Drive API等)

**Authorization Code Flow + PKCE (Proof Key for Code Exchange):**

```text
1. ユーザーが「Googleでログイン」をクリック
   ↓
2. クライアントは PKCE の code_verifier を生成、code_challenge をハッシュで計算
   ユーザーを認可サーバに転送:
   https://accounts.google.com/o/oauth2/auth?
     client_id=xxx
     &redirect_uri=https://myapp.com/callback
     &response_type=code
     &scope=openid email
     &state=ランダム文字列
     &code_challenge=...
     &code_challenge_method=S256
   ↓
3. ユーザーが Google にログインし、許可を承認
   ↓
4. 認可サーバが redirect_uri にリダイレクト:
   https://myapp.com/callback?code=AUTH_CODE&state=...
   ↓
5. クライアントがバックエンド経由で認可サーバに直接リクエスト:
   POST /token
     code=AUTH_CODE
     redirect_uri=...
     client_id=...
     code_verifier=...  ← PKCEの元の値
   ↓
6. 認可サーバが access_token (とオプションでrefresh_token) を返す
   ↓
7. クライアントは access_token で Resource Server にアクセス
```

ポイント:

- **PKCE**はAuthorization Code横取り攻撃を防ぐ。OAuth 2.0 Security BCPでは公開クライアントに必須、機密クライアントにも推奨され、認可サーバは対応する必要がある
- **CSRF/応答注入対策**: PKCEを確実に使える構成ではPKCEが保護の一部を担う。`state`はアプリケーション状態の相関や、PKCE以外のCSRF対策が必要な構成で使用し、コールバック時に厳密に照合する。OIDCでは`nonce`も検証する
- **redirect_uri**は事前登録値と厳密一致させる。任意URLや曖昧な部分一致を許すとコード漏洩につながる

<a id="section-13-8"></a>
### 13.8 OIDC (OpenID Connect) ― OAuth の上に立つ認証
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"O","term":"OIDC (OpenID Connect)"} -->

<!-- handbook:narrative-bridge {"section":"13.8"} -->
OAuthが保証するのはアクセストークンによる権限委任であり、ログインした人物の属性をクライアントへ標準形式で伝える仕様ではない。OIDCはOAuthのフローへID TokenとUserInfoを加え、認証結果の検証方法を定める。

OAuth 2.0 はアクセストークンを返すが「**そのトークンの所有者が誰か**」は教えない。これを補うのが OIDC。

OIDC は OAuth 2.0 の拡張で、`scope=openid` を指定すると、access_token に加えて **id_token** (JWT) を返す。

```json
// id_token (JWT) のペイロード例
{
  "iss": "https://accounts.google.com",
  "sub": "1234567890",           // Google でのユーザーID
  "aud": "myapp-client-id",       // このトークンの宛先 (自分のアプリ)
  "exp": 1748000000,
  "iat": 1747999000,
  "email": "alice@example.com",
  "email_verified": true,
  "name": "Alice"
}
```

`id_token`では署名だけでなく、`iss`、`aud`、`exp`、必要に応じて`azp`と`nonce`を検証する。アカウントの不変識別子には通常`sub`を使い、メールアドレスは変更・再利用・検証状態を考慮する。

```typescript
// OIDC の id_token 検証 (Google の例)
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function verifyGoogleIdToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: 'https://accounts.google.com',
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return payload;  // { sub, email, name, ... }
}
```

Google が公開鍵を JWKS (JSON Web Key Set) で公開しているため、誰でも署名検証できる。秘密鍵は Google だけが持つので、偽造不可能。

<a id="section-13-9"></a>
### 13.9 パスキー (WebAuthn) ― パスワードレスの未来
<!-- handbook:learning {"level":"practical","minutes":10} -->
<!-- handbook:index {"group":"F","term":"FIDO2"} -->
<!-- handbook:index {"group":"P","term":"Passkey"} -->
<!-- handbook:index {"group":"W","term":"WebAuthn"} -->
<!-- handbook:index {"group":"は行","term":"パスキー"} -->

<!-- handbook:narrative-bridge {"section":"13.9"} -->
パスワードや外部IdPを安全に運用しても、共有秘密を入力する方式はフィッシングと資格情報再利用の影響を受ける。WebAuthnは端末上の秘密鍵とオリジンに結び付いた公開鍵認証で、秘密をサーバへ送らない。

パスキーはWebAuthnの公開鍵資格情報を、利用者が扱いやすい形で利用する認証方式。WebAuthn Level 2はW3C Recommendationであり、Level 3は2026年時点でCandidate Recommendation段階にある。パスキーには複数端末へ同期される資格情報と、特定デバイスに結び付く資格情報がある。

仕組み:

1. **登録時**: デバイス (スマホ、PC、YubiKey) が公開鍵/秘密鍵ペアを生成。公開鍵をサーバに送信
2. **ログイン時**: サーバはチャレンジ (ランダム値) を送信、デバイスが秘密鍵で署名、サーバが公開鍵で検証

**フィッシング耐性**: ドメインが署名の対象に含まれるため、偽サイトでは認証できない。これがパスワードに対する根本的な優位性だ。

```typescript
// SimpleWebAuthn ライブラリの使用例 (サーバ側)
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

// 登録チャレンジを生成
const options = await generateRegistrationOptions({
  rpName: 'My App',
  rpID: 'myapp.com',
  userID: new TextEncoder().encode(userId),
  userName: 'alice@example.com',
  attestationType: 'none',
});
// options をクライアントに送る、クライアントは navigator.credentials.create() を呼ぶ

// クライアントから返ってきた登録レスポンスを検証
const verification = await verifyRegistrationResponse({
  response: clientResponse,
  expectedChallenge: storedChallenge,
  expectedOrigin: 'https://myapp.com',
  expectedRPID: 'myapp.com',
});
// verification.registrationInfo に公開鍵が入っている → DB に保存
```

```typescript
// クライアント
const credentialOptions = await fetch('/auth/register-options').then(r => r.json());
const credential = await navigator.credentials.create({
  publicKey: credentialOptions,
});
await fetch('/auth/register-verify', {
  method: 'POST',
  body: JSON.stringify(credential),
});
```

新規設計ではパスキーを有力な選択肢として検討できる。ただし、端末紛失、同期アカウントへのアクセス不能、共有端末、利用できないブラウザや組織ポリシーを考え、複数資格情報の登録、回復手順、フォールバックの保証レベルを設計する。

<a id="section-13-10"></a>
### 13.10 認可モデル ― RBAC、ABAC、ReBAC
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"A","term":"ABAC (Attribute-Based Access Control)"} -->
<!-- handbook:index {"group":"R","term":"RBAC"} -->
<!-- handbook:index {"group":"R","term":"ReBAC"} -->
<!-- handbook:index {"group":"な行","term":"認可 (Authorization)"} -->
<!-- handbook:index {"group":"や行","term":"役割ベースアクセス制御 (RBAC)"} -->

<!-- handbook:narrative-bridge {"section":"13.10"} -->
本人性を確認できても、認証済みの利用者がすべてのデータへ同じ操作を行えるわけではない。役割、属性、関係のどれを判断材料にするかを分け、RBAC、ABAC、ReBACとして認可モデルを選ぶ。

認証で「誰か」が決まったら、次は「何ができるか」だ。設計パターンは3つある。

**RBAC (Role-Based Access Control):**

ユーザーに役割を割り当て、役割に権限を付与。

```typescript
type Role = 'admin' | 'editor' | 'viewer';
type Permission = 'post.read' | 'post.write' | 'post.delete' | 'user.manage';

const rolePermissions: Record<Role, Permission[]> = {
  admin:  ['post.read', 'post.write', 'post.delete', 'user.manage'],
  editor: ['post.read', 'post.write'],
  viewer: ['post.read'],
};

function canPerform(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
```

シンプルで、多くのアプリで十分。「組織管理」「コンテンツ管理」のような明確な権限ロールがあるケースに向く。

**ABAC (Attribute-Based Access Control):**

ユーザー、リソース、環境の**属性**で判定。

```typescript
function canEditPost(user: User, post: Post, env: { time: Date }): boolean {
  // 拒否の条件を先に書く。許可の条件より後ろへ置くと、先に return されて効かない。
  // 「業務時間外 (22時〜6時) は管理者のみ」を3番目に書くと、作者本人は
  // 深夜でも編集できてしまい、規則とコードが食い違う
  const hour = env.time.getHours();
  if ((hour >= 22 || hour < 6) && user.role !== 'admin') return false;

  // ここから許可の条件
  if (post.authorId === user.id) return true;                              // 作者本人
  if (user.orgId === post.orgId && user.role === 'editor') return true;    // 同じ組織のエディタ

  return false;
}
```

複雑な条件を表現できるが、ルールが増えると把握が困難になる。とくに、**この例のように許可と拒否が入り混じると、書いた順序が規則の意味を変えてしまう**。だから実務では「拒否が1つでもあれば拒否、なければ許可の有無で判定する」というように評価順を先に決め、条件を許可規則と拒否規則へ分けて置く。13.11 のポリシーエンジンが解こうとしているのは、まさにこの問題である。

**ReBAC (Relationship-Based Access Control):**

リソース間の**関係**で判定。Google の Zanzibar 論文 (2019年) で広く知られるようになった。

```text
組織A の管理者 → ドキュメント123 のオーナー
   ↓ 管理者は組織内のドキュメントを全て閲覧可能
組織A の メンバーB → 組織Aに所属
   ↓ メンバーは閲覧のみ可能
```

「**ユーザー X はリソース Y に対して権限 Z を持つか?**」をグラフ探索で判定。GitHub の組織・チーム・リポジトリの権限管理がこのモデル。

OSSの実装としては **OpenFGA** (Auth0開発) や **SpiceDB** (Authzed) がある。複雑な権限を持つアプリ (ドキュメント共有、ファイル管理、ソーシャル) では本格的に検討に値する。

<a id="section-13-11"></a>
### 13.11 認可ロジックを「中央集権」にする
<!-- handbook:learning {"level":"required","minutes":10} -->
<!-- handbook:index {"group":"な行","term":"認可 (Authorization)"} -->

<!-- handbook:narrative-bridge {"section":"13.11"} -->
認可モデルを選んでも、各ハンドラへ条件式を散らすと同じ規則が異なる形で複製され、監査や変更が難しくなる。ポリシー判断を中央化し、入力となる主体、操作、資源、文脈を明示する。

NGパターン: 各エンドポイントに個別の権限チェックを散らす。

```typescript
// BAD: あちこちで if 文
app.get('/posts/:id', async (req, res) => {
  const post = await db.post.findById(req.params.id);
  if (post.authorId !== req.userId && req.user.role !== 'admin') {
    return res.status(403).end();
  }
  res.json(post);
});

app.put('/posts/:id', async (req, res) => {
  // ↑ と似たチェックを書く (微妙にズレてバグになる)
});
```

GOOD パターン: 認可ロジックを1箇所に集約。

```typescript
// authz.ts
class Authz {
  async canViewPost(user: User, postId: string): Promise<boolean> {
    const post = await db.post.findById(postId);
    if (!post) return false;
    if (post.published) return true;
    if (post.authorId === user.id) return true;
    if (user.role === 'admin') return true;
    return false;
  }

  async canEditPost(user: User, postId: string): Promise<boolean> {
    const post = await db.post.findById(postId);
    if (!post) return false;
    if (post.authorId === user.id) return true;
    if (user.role === 'admin') return true;
    return false;
  }
}

// ハンドラ側はシンプルになる
app.get('/posts/:id', async (req, res) => {
  if (!await authz.canViewPost(req.user, req.params.id)) {
    return res.status(403).end();
  }
  res.json(await db.post.findById(req.params.id));
});
```

これによりテストもしやすく、権限ロジックの変更が一箇所で済む。大規模化したら OpenFGA などに移行する道も拓ける。

<a id="section-13-12"></a>
### 13.12 セキュリティの基本原則 (まとめ)
<!-- handbook:learning {"level":"required","minutes":5} -->
<!-- handbook:index {"group":"た行","term":"多層防御"} -->

<!-- handbook:narrative-bridge {"section":"13.12"} -->
個別の方式を正しく実装しても、秘密情報の最小化、デフォルト拒否、監査、失効といった原則が欠ければ別の経路から境界が破られる。ここで認証・認可の仕組みを共通の防御原則へ統合する。

- **多層防御 (Defense in depth)**: 単一の防御に依存しない
- **最小権限の原則**: 必要な権限だけを与える
- **失敗時はクローズ**: 判定不能なら拒否
- **監査ログ**: 認証失敗、権限変更、特権操作は必ず記録
- **シークレット管理**: コードに埋め込まず、環境変数 or KMS

<a id="section-13-13"></a>
### 13.13 OIDC 風の最小認証サーバ自作
<!-- handbook:learning {"level":"advanced","minutes":15} -->

<!-- handbook:narrative-bridge {"section":"13.13"} -->
原則と部品の関係を確かめるには、認可エンドポイント、トークン発行、鍵公開、検証を一つの小さなシステムとして接続する必要がある。OIDC風サーバを自作し、どの検証を省略すると信頼が崩れるかを観測する。

最後に、OIDC の仕組みを理解するための簡略実装。Express風に書く。

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const codeStore = new Map<string, { userId: string; redirectUri: string; expiresAt: number }>();

// /authorize: 認可エンドポイント
app.get('/authorize', async (req, res) => {
  const { client_id, redirect_uri, state, response_type } = req.query;
  if (response_type !== 'code') return res.status(400).end();

  // ※ 実際はここでユーザーのログイン確認、UIで「許可」確認

  // ユーザーが許可したと仮定
  const code = randomBytes(16).toString('base64url');
  codeStore.set(code, {
    userId: 'user-42',
    redirectUri: redirect_uri as string,
    expiresAt: Date.now() + 60_000,  // 1分
  });

  res.redirect(`${redirect_uri}?code=${code}&state=${state}`);
});

// /token: トークン発行エンドポイント
app.post('/token', async (req, res) => {
  const { code, redirect_uri, grant_type } = req.body;
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const entry = codeStore.get(code);
  if (!entry || entry.expiresAt < Date.now() || entry.redirectUri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  codeStore.delete(code);  // 1回限り

  // access_token (API アクセス用)
  const accessToken = await new SignJWT({ scope: 'openid email' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(entry.userId)
    .setExpirationTime('1h')
    .sign(SECRET);

  // id_token (本人確認用、OIDC)
  const idToken = await new SignJWT({
    email: 'alice@example.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(entry.userId)
    .setIssuer('https://myapp.com')
    .setAudience('client-app-id')
    .setExpirationTime('1h')
    .sign(SECRET);

  res.json({
    access_token: accessToken,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
});

// 保護されたリソース
app.get('/userinfo', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).end();
  try {
    const { payload } = await jwtVerify(auth.slice(7), SECRET);
    res.json({ sub: payload.sub, email: 'alice@example.com' });
  } catch {
    res.status(401).end();
  }
});
```

このコードは認可コードとJWT発行の流れを示す教材用スケルトンであり、OIDC適合実装ではない。PKCE、`nonce`、認可要求の保存、`redirect_uri` と事前登録値の完全一致照合、クライアント登録と認証、同意、Discovery、JWKS、鍵ローテーション、失効、監査、エラー仕様などが欠けている。とくに `redirect_uri` を照合せずにリダイレクトすると認可コードが第三者へ渡るため、この形のまま外部へ公開してはならない (13.7、13.20)。本番では適合試験と更新実績のあるIdPまたは認証ライブラリを採用し、自作範囲を最小化する。

<a id="section-13-14"></a>
### 13.14 HMAC-SHA256 ― 共有秘密鍵による署名
<!-- handbook:learning {"level":"advanced","minutes":30} -->
<!-- handbook:index {"group":"B","term":"Base64URL"} -->
<!-- handbook:index {"group":"H","term":"HMAC-SHA256"} -->
<!-- handbook:index {"group":"S","term":"S3 Pre-signed URL"} -->
<!-- handbook:index {"group":"T","term":"timingSafeEqual"} -->
<!-- handbook:index {"group":"W","term":"Webhook 署名"} -->

<!-- handbook:narrative-bridge {"section":"13.14"} -->
ブラウザやAPIトークンだけでなく、Webhookのようにサーバ同士が本文を送り合う場合も、送信元と改ざん有無を確認しなければならない。HMACは共有秘密鍵を用いて本文と時刻へ署名し、受信側で完全性を検証する。

これまで JWT で `HS256` 署名を使ってきた。この `HS` の正体は **HMAC-SHA256** だ。Webhook 検証、CSRFトークン、URL署名、API キーローテーションなど、対称鍵ベースの「**送信元と内容の改ざんを検知する**」用途で広く使われる。

#### HMAC とは何か

HMAC (Hash-based Message Authentication Code) は「**共有秘密鍵 + ハッシュ関数**」で構成される MAC (メッセージ認証コード) アルゴリズム [Krawczyk et al., 1997]。

「単純にハッシュすればいいのでは?」と思うかもしれないが、`SHA256(secret || message)` は **長さ拡張攻撃 (length extension attack)** に対して脆弱だ。攻撃者は元の `message` を知らなくても、`message || extra` の有効なハッシュを生成できてしまう。HMAC はこの問題を「**鍵を2回使う構造**」で防いでいる:

```text
HMAC(K, m) = H((K' XOR opad) || H((K' XOR ipad) || m))
```

- `K'`: 鍵を H のブロックサイズに調整したもの
- `ipad`: `0x36` の繰り返し
- `opad`: `0x5C` の繰り返し
- 内側ハッシュ → 外側ハッシュの二段構造で、内部状態を露出しない

実装する側は仕組みを知る必要はあるが、**自分でハッシュを組み合わせるのではなく、標準ライブラリの HMAC を必ず使う**。これが最大の教訓。

#### Webhook 署名の実装 (Stripe スタイル)

Stripe、GitHub、Slack などのSaaSは、Webhookに署名を付ける。受信側が「本当にStripeから来たメッセージか」を検証できる仕組みだ。

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!; // 共有秘密鍵
const TOLERANCE_SEC = 300; // 5分以内のリクエストのみ受け付け (リプレイ対策)

// === 送信側 ===
function signWebhook(payload: string): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  // 「タイムスタンプ + ペイロード」をまとめて署名 (タイムスタンプ単独・ペイロード単独ではなく)
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');
  return { signature, timestamp };
}

async function sendWebhook(url: string, event: object): Promise<void> {
  const payload = JSON.stringify(event);
  const { signature, timestamp } = signWebhook(payload);
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Stripe形式のヘッダ
      'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
    },
    body: payload,
  });
}

// === 受信側 (Express) ===
import express from 'express';

const app = express();

// 重要: 生のbody を取得する。JSON パースされた後では署名が変わってしまう
app.use('/webhooks/payment', express.raw({ type: 'application/json' }));

app.post('/webhooks/payment', (req, res) => {
  const sigHeader = req.headers['x-webhook-signature'] as string;
  if (!sigHeader) return res.status(401).send('Missing signature');

  // ヘッダをパース
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => kv.split('=') as [string, string])
  );
  const timestamp = parseInt(parts.t, 10);
  const sentSig = parts.v1;
  if (!timestamp || !sentSig) return res.status(401).send('Invalid signature format');

  // 1. タイムスタンプの新鮮度チェック (リプレイ攻撃対策)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > TOLERANCE_SEC) {
    return res.status(401).send('Timestamp too old');
  }

  // 2. 期待される署名を計算
  const rawBody = req.body as Buffer; // express.raw で Buffer のまま
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSig = createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  // 3. タイミング攻撃に耐性のある比較
  const sentBuf = Buffer.from(sentSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (sentBuf.length !== expectedBuf.length || !timingSafeEqual(sentBuf, expectedBuf)) {
    return res.status(401).send('Invalid signature');
  }

  // 4. 同じイベントを2度処理しない
  //    タイムスタンプの許容窓 (ここでは5分) の内側なら、傍受した正規のリクエストを
  //    そのまま送り直せる。署名の検証だけでは重複を止められない
  const event = JSON.parse(rawBody.toString('utf8'));
  const first = await markEventSeen(event.id, TOLERANCE_SEC * 2);
  if (!first) return res.status(200).send('duplicate');

  handleEvent(event); // 業務処理へ
  res.status(200).send('ok');
});

// イベントIDを一意キーに持つ表 (またはRedisのSET NX) へ記録する。
// 挿入できたときだけ true を返す。判定を SELECT で先に行うと、
// 同時に届いた2通が両方とも「未処理」と判定されて通ってしまう (17.2)
async function markEventSeen(eventId: string, ttlSec: number): Promise<boolean> {
  return redis.set(`webhook:seen:${eventId}`, '1', { NX: true, EX: ttlSec }) !== null;
}
```

実装上の重要ポイントは5つ:

1. **`raw body` を使う**: パースしたオブジェクトを `JSON.stringify` し直すと、キーの順番や空白で署名が変わる
2. **タイムスタンプを含めて署名**: ペイロード単独だと、攻撃者が同じリクエストを後で再送 (リプレイ) できる
3. **イベントIDで重複を弾く**: タイムスタンプの許容窓の内側では署名が有効なままなので、処理済みのIDを記録して2度目を捨てる。送信側は再送を前提に設計されており、正常系でも同じイベントが複数回届く
4. **`timingSafeEqual` を使う**: `===` でハッシュ比較するとタイミング攻撃の余地がある
5. **シークレットローテーション**: 2世代の鍵を並行運用する仕組みを最初から入れる

#### 鍵ローテーションの設計

```typescript
const SECRETS = {
  v2: process.env.WEBHOOK_SECRET_V2!, // 現在
  v1: process.env.WEBHOOK_SECRET_V1!, // 旧 (移行期間中)
};

function verifyAnyVersion(rawBody: Buffer, timestamp: number, sentSig: string): boolean {
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  // 全バージョンで試す(片方で一致すればOK)
  for (const secret of Object.values(SECRETS)) {
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
    const sentBuf = Buffer.from(sentSig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sentBuf.length === expectedBuf.length && timingSafeEqual(sentBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}
```

ローテーション手順: 新鍵を `v2` として配布開始 → 両側が両鍵を受け付ける期間を設ける → 全クライアントが新鍵に切り替わったら `v1` を削除。これを手順化していないと、本番で鍵が漏洩したときに**サービス停止覚悟**でしか回せなくなる。

#### URL 署名 (Pre-signed URL)

「**期限付きで一時的にリソースアクセスを許可する**」用途。S3 Pre-signed URL、画像変換 CDN、メール内のワンタイムリンクなどで使う。

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

const URL_SIGNING_SECRET = process.env.URL_SIGNING_SECRET!;

// 署名付き URL を発行 (例: 画像ダウンロード)
function signUrl(path: string, ttlSec = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const toSign = `${path}\n${expires}`;
  const sig = createHmac('sha256', URL_SIGNING_SECRET)
    .update(toSign)
    .digest('base64url');
  return `${path}?expires=${expires}&sig=${sig}`;
}

// 検証ミドルウェア
function verifySignedUrl(req: express.Request, res: express.Response, next: express.NextFunction) {
  const path = req.path;
  const { expires, sig } = req.query as { expires?: string; sig?: string };
  if (!expires || !sig) return res.status(403).send('Missing signature');

  const expiresNum = parseInt(expires, 10);
  if (!expiresNum || expiresNum < Math.floor(Date.now() / 1000)) {
    return res.status(403).send('URL expired');
  }

  const expected = createHmac('sha256', URL_SIGNING_SECRET)
    .update(`${path}\n${expiresNum}`)
    .digest('base64url');
  const sentBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expected, 'base64url');
  if (sentBuf.length !== expectedBuf.length || !timingSafeEqual(sentBuf, expectedBuf)) {
    return res.status(403).send('Invalid signature');
  }
  next();
}

app.get('/downloads/*', verifySignedUrl, (req, res) => {
  // ファイル配信
  res.sendFile(`/storage${req.path}`);
});
```

これで「**サーバの認可ロジックを通さずに、URL を持っているだけで一時的アクセス可能**」な仕組みが作れる。ファイル配信を CDN にオフロードできるのが大きな利点。

<a id="section-13-15"></a>
### 13.15 公開鍵暗号による電子署名 ― Ed25519 / ECDSA
<!-- handbook:learning {"level":"advanced","minutes":30} -->
<!-- handbook:index {"group":"E","term":"ECDSA"} -->
<!-- handbook:index {"group":"E","term":"Ed25519"} -->
<!-- handbook:index {"group":"J","term":"JWKS"} -->
<!-- handbook:index {"group":"か行","term":"公開鍵暗号"} -->
<!-- handbook:index {"group":"た行","term":"電子署名"} -->

<!-- handbook:narrative-bridge {"section":"13.15"} -->
HMACは二者間では単純だが、検証者が増えるほど秘密鍵を全員へ配る必要があり、一つの漏洩で署名生成権限まで失われる。公開鍵署名は秘密鍵を発行者だけに残し、検証用の公開鍵を安全に配布できる。

HMAC は対称鍵 ― **送信者と受信者が同じ秘密鍵を共有する**。これには問題がある:

- 鍵を持つ全員が署名を**生成**できる (受信者が偽造可能)
- 第三者が「これは本当にAさんが署名した」と検証できない
- 鍵を多数の受信者に配布すると漏洩リスクが指数的に増える

これらを解決するのが**公開鍵暗号による電子署名**だ。秘密鍵で署名し、対応する公開鍵で検証する。秘密鍵は署名者だけが持ち、公開鍵は誰でも検証に使える。

#### Ed25519 vs ECDSA vs RSA

電子署名アルゴリズムは複数あるが、Webの認証・認可で実際に選択肢になるものを比較する。

| アルゴリズム | 鍵サイズ | 署名サイズ | 速度 | セキュリティ | 用途 |
|---|---|---|---|---|---|
| **Ed25519** | 32 byte | 64 byte | 高速 | 高 (128-bit) | 新規実装の第一選択 |
| **ECDSA (P-256)** | 32 byte | 64-72 byte | 高速 | 高 (128-bit) | JWT `ES256`、レガシー互換 |
| **RSA-2048** | 256 byte | 256 byte | 低速 | 中 (112-bit) | レガシー (TLS 証明書等) |
| **RSA-4096** | 512 byte | 512 byte | 非常に低速 | 高 (140-bit) | 高セキュリティ要件 |

**Ed25519** (エドワーズ曲線デジタル署名アルゴリズム) は2011年に発表され [Bernstein et al., 2011]、SSH、TLS 1.3、Signal、Tor などモダンなプロトコルで採用が進んでいる。署名速度・検証速度・コード単純さ・サイドチャネル耐性のいずれも他より優れる。

**ECDSA** はビットコインや既存の JWT エコシステムで広く使われる。Nonce 生成にバグがあると秘密鍵が漏洩するという落とし穴があるが、`RFC 6979`(決定的 ECDSA) で大幅に改善された。

実務での選択基準: **新規ならEd25519、既存システムとの互換性が必要ならECDSA、レガシーシステムとの相互運用が必要ならRSA**。

#### Ed25519 での署名・検証実装

```typescript
import { generateKeyPairSync, sign, verify, createPrivateKey, createPublicKey } from 'node:crypto';

// === 鍵ペア生成 (一回だけ、結果を安全に保管) ===
function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }) as string,
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  };
}

// 例: 一度だけ実行して秘密鍵を金庫(KMS/Vault)に、公開鍵を配布
// const keys = generateKeyPair();
// console.log(keys.publicKeyPem);
// console.log(keys.privateKeyPem);  // ← 絶対に Git に入れない

// === 署名 ===
function signMessage(message: Buffer | string, privateKeyPem: string): string {
  const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });
  const msgBuf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
  // Ed25519 は SHA を内部で行うので 2nd 引数は null
  const sig = sign(null, msgBuf, privateKey);
  return sig.toString('base64url');
}

// === 検証 ===
function verifyMessage(
  message: Buffer | string,
  signatureB64: string,
  publicKeyPem: string,
): boolean {
  const publicKey = createPublicKey({ key: publicKeyPem, format: 'pem' });
  const msgBuf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
  const sigBuf = Buffer.from(signatureB64, 'base64url');
  return verify(null, msgBuf, publicKey, sigBuf);
}

// === 利用例 ===
const PRIVATE_KEY = process.env.SIGNING_PRIVATE_KEY!; // KMS/Vault から取得
const PUBLIC_KEY = process.env.SIGNING_PUBLIC_KEY!;   // 公開してOK

const event = JSON.stringify({
  eventId: 'evt_abc123',
  type: 'payment.completed',
  amount: 5000,
  currency: 'JPY',
  timestamp: '2026-05-20T12:34:56Z',
});

const signature = signMessage(event, PRIVATE_KEY);

// 受信側で
const isValid = verifyMessage(event, signature, PUBLIC_KEY);
console.log(isValid); // true
```

#### ECDSA での実装 (JWT `ES256` 互換)

JWT のヘッダで `alg: ES256` を見たら ECDSA over P-256 だ。

```typescript
import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import { generateKeyPairSync } from 'node:crypto';

// 鍵ペア生成 (P-256 / secp256r1)
function generateEcdsaKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }) as string,
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
  };
}

// 署名 (JWT 発行)
async function issueJwt(payload: object, privateKeyPem: string): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('https://myapp.com')
    .sign(privateKey);
}

// 検証
async function verifyJwt(token: string, publicKeyPem: string): Promise<object> {
  const publicKey = await importSPKI(publicKeyPem, 'ES256');
  const { payload } = await jwtVerify(token, publicKey, { issuer: 'https://myapp.com' });
  return payload;
}
```

これで「**秘密鍵は認証サーバだけが持ち、公開鍵をマイクロサービス全体に配布**」という構成が組める。各サービスは公開鍵だけで JWT を検証でき、秘密鍵の保管リスクが認証サーバ1箇所に集約される。

#### JWKS (JSON Web Key Set) ― 公開鍵配布の標準

複数の公開鍵を配布する標準フォーマットがJWKS。OIDCではDiscovery文書の`jwks_uri`から取得先を知る。`/.well-known/jwks.json`は慣例的な例にすぎず、固定パスとして仮定しない。

```typescript
import { createPublicKey } from 'node:crypto';

// 公開鍵を JWK 形式で公開
app.get('/.well-known/jwks.json', (req, res) => {
  const publicKey = createPublicKey({ key: PUBLIC_KEY_PEM, format: 'pem' });
  const jwk = publicKey.export({ format: 'jwk' });
  res.json({
    keys: [
      {
        ...jwk,
        kid: 'key-2026-05',     // Key ID (ローテーション時に複数並べる)
        use: 'sig',             // 署名用
        alg: 'ES256',
      },
      // ローテーション期間中は旧鍵も並べる
      {
        ...oldJwk,
        kid: 'key-2026-01',
        use: 'sig',
        alg: 'ES256',
      },
    ],
  });
});
```

受信側は JWT ヘッダの `kid` を見て、JWKS から該当する公開鍵を取得して検証する。これにより鍵ローテーションが**サービス側のコード変更なしに**実現できる。

#### HMAC と公開鍵署名の使い分け

| 用途 | 推奨 | 理由 |
|---|---|---|
| Webhook (二者間) | HMAC | シンプル、十分 |
| マイクロサービス間 | Ed25519 / ECDSA | 鍵配布の安全性 |
| JWT (内部APIのみ) | HMAC (HS256) | シンプル、速い |
| JWT (外部公開) | ECDSA (ES256) / Ed25519 (EdDSA) | 検証側に公開鍵だけ配布 |
| ソフトウェア配布署名 | Ed25519 / RSA | 改ざん検知 |
| ブロックチェーン | ECDSA / Ed25519 | 主要チェーンが採用 |
| 短期 URL 署名 | HMAC | 検証は同一サービス内で完結 |

「**鍵を共有して大丈夫な範囲**」が判断軸だ。受信者が完全に信頼できるなら HMAC、信頼の輪が広がるなら公開鍵。

<a id="section-13-16"></a>
### 13.16 OAuth 1.0 ― 署名ベース認可の祖先
<!-- handbook:learning {"level":"advanced","minutes":35} -->
<!-- handbook:index {"group":"O","term":"OAuth 1.0"} -->
<!-- handbook:index {"group":"ま行","term":"文字列正準化 (OAuth 1.0)"} -->

<!-- handbook:narrative-bridge {"section":"13.16"} -->
現在のOAuth 2.0はBearer Tokenを中心に委任を簡潔化したが、旧来のOAuth 1.0は要求ごとの署名と正準化によって通信を保護した。歴史的方式を追うことで、署名対象の表現を一致させる難しさと現行方式の設計判断を理解する。

13.7 で見た OAuth 2.0 には、それ以前の OAuth 1.0(と改訂版 1.0a) という前史がある [Hammer-Lahav, 2010]。現在の新規実装で OAuth 1.0 を選ぶ理由はほぼないが、**設計判断の歴史**として、また**レガシーAPI(Twitter API v1.x、WordPress、Yahoo!、Flickr など) との連携**で出会うことがあるため、押さえておく価値がある。

#### OAuth 1.0 と 2.0 の根本的な違い

| | OAuth 1.0 (RFC 5849) | OAuth 2.0 (RFC 6749) |
|---|---|---|
| トークン | 署名鍵つき (token + token_secret) | Bearer (持っていれば誰でも使える) |
| リクエスト保護 | **各リクエストを署名** | HTTPS による通信路保護のみ |
| 通信路要件 | HTTPS 任意 (署名で改ざん検知できるため) | HTTPS 必須 |
| 暗号 | クライアント側で署名生成 | サーバ側で発行・検証 |
| 実装難度 | 高 (正準化と署名計算) | 低 |
| 仕様の明確さ | 厳格 (1つの方式) | 柔軟 (複数フロー、拡張多数) |

OAuth 1.0 の核心は「**各リクエストにHMAC-SHA1署名を付ける**」こと。トークンを盗まれても、それと対になる token_secret がなければ署名できないため、リクエストは作れない。Bearer Token(2.0) は「持っているだけで使える」ため、漏洩したら即アウト ― ここが哲学の違いだ。

#### 3-Legged Flow ― 3者間の認可フロー

OAuth 1.0 の標準フローは「3-legged(3本足)」と呼ばれる:

```text
1. Consumer (アプリ) → Service Provider (サーバ)
   POST /oauth/request_token
   ↓
   Service Provider → Consumer
   Request Token (一時クレデンシャル): oauth_token + oauth_token_secret

2. Consumer → User (ブラウザ経由)
   redirect to: https://provider/authorize?oauth_token=...
   ↓
   User がログイン・承認
   ↓
   Service Provider → User
   redirect to: callback?oauth_token=...&oauth_verifier=...

3. Consumer → Service Provider
   POST /oauth/access_token
   送信: oauth_token + oauth_verifier + 署名
   ↓
   Service Provider → Consumer
   Access Token (長期クレデンシャル): oauth_token + oauth_token_secret
```

ステップ2の `oauth_verifier`(検証コード) は **1.0a 改訂で追加された**もので、初版にあったセッション固定攻撃の対策。RFC 5849 はこの改訂版を標準化している。

#### 署名の作り方 ― 正準化が最大の難所

OAuth 1.0 の署名は「**HTTP メソッド + URL + 全パラメータ**」を決定的な順序で結合した「**Signature Base String**」に対する HMAC-SHA1。手順:

1. **パラメータ収集**: OAuth パラメータ + クエリ文字列 + form-encoded ボディの全てを集める (`oauth_signature` 自身は除く)
2. **パーセントエンコード**: 各キー・値を RFC 3986 形式で URL エンコード
3. **ソート**: キーで辞書順、同名キーは値でソート
4. **連結**: `key=value` を `&` で繋ぐ
5. **Base String 構築**: `METHOD&URL&PARAMS` (各部分を再度URLエンコードして結合)
6. **HMAC-SHA1**: 鍵は `consumer_secret&token_secret` (両方を & で連結)、メッセージは Base String
7. **Base64 化**: 結果を `oauth_signature` として添付

```typescript
import { createHmac } from 'node:crypto';

interface OAuth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

function rfc3986Encode(s: string): string {
  // encodeURIComponent は ! * ( ) ' を残すので追加処理
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>,
): string {
  // 1. パラメータをエンコードしてソート
  const encoded: Array<[string, string]> = Object.entries(params)
    .map(([k, v]) => [rfc3986Encode(k), rfc3986Encode(v)] as [string, string])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  // 2. key=value を & で連結
  const paramString = encoded.map(([k, v]) => `${k}=${v}`).join('&');

  // 3. METHOD&URL&PARAMS の3要素をそれぞれ再エンコードして結合
  return [method.toUpperCase(), rfc3986Encode(url), rfc3986Encode(paramString)].join('&');
}

function signRequest(
  method: string,
  url: string,
  extraParams: Record<string, string>,
  creds: OAuth1Credentials,
): Record<string, string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
  };
  if (creds.token) oauthParams.oauth_token = creds.token;

  // OAuth params + extra params 全てを署名対象に
  const allParams = { ...oauthParams, ...extraParams };
  const baseString = buildSignatureBaseString(method, url, allParams);

  // 鍵: consumer_secret & token_secret(token_secret が無い場合も & を残す)
  const signingKey = `${rfc3986Encode(creds.consumerSecret)}&${rfc3986Encode(creds.tokenSecret ?? '')}`;

  // HMAC-SHA1 で署名
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;

  return oauthParams;
}

// 利用例: 認証済みリクエスト
async function callApi(creds: OAuth1Credentials) {
  const url = 'https://api.example.com/account/verify_credentials.json';
  const method = 'GET';
  const oauthParams = signRequest(method, url, {}, creds);

  // Authorization ヘッダにまとめる
  const authHeader = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${rfc3986Encode(k)}="${rfc3986Encode(v)}"`)
    .join(', ');

  const res = await fetch(url, { method, headers: { Authorization: authHeader } });
  return res.json();
}
```

#### 検証側の実装

```typescript
async function verifyOAuth1Request(req: Request): Promise<{ ok: boolean; userId?: string }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('OAuth ')) return { ok: false };

  // ヘッダをパース
  const params: Record<string, string> = {};
  for (const part of authHeader.slice(6).split(',')) {
    const trimmed = part.trim();
    const at = trimmed.indexOf('=');  // 署名値の Base64 パディング (=) で切らないよう1回だけ分割する
    const k = trimmed.slice(0, at);
    const v = trimmed.slice(at + 1);
    params[k] = decodeURIComponent(v.replace(/^"|"$/g, ''));
  }

  // 1. nonce + timestamp で replay 攻撃を防ぐ
  const ts = parseInt(params.oauth_timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return { ok: false };  // 5分以上ズレてたら拒否

  const seen = await redis.set(
    `oauth1_nonce:${params.oauth_consumer_key}:${params.oauth_nonce}`,
    '1',
    { NX: true, EX: 600 },
  );
  if (!seen) return { ok: false };  // 過去に使われた nonce

  // 2. consumer と token を DB から引き、それぞれの secret を取得
  const consumer = await db.oauthConsumer.findUnique({ where: { key: params.oauth_consumer_key } });
  const token = await db.oauthToken.findUnique({ where: { key: params.oauth_token } });
  if (!consumer || !token) return { ok: false };

  // 3. 期待される署名を再計算
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const queryParams = Object.fromEntries(url.searchParams);

  // クライアントから送られた oauth_signature を除いて再計算
  const { oauth_signature: sentSig, ...withoutSig } = params;
  const allParams = { ...withoutSig, ...queryParams };
  const baseString = buildSignatureBaseString(req.method, baseUrl, allParams);

  const signingKey = `${rfc3986Encode(consumer.secret)}&${rfc3986Encode(token.secret)}`;
  const expected = createHmac('sha1', signingKey).update(baseString).digest('base64');

  // 4. タイミング攻撃に耐性のある比較。長さが違うと timingSafeEqual は例外を投げるので先に確認する
  const sentBuf = Buffer.from(sentSig);
  const expectedBuf = Buffer.from(expected);
  if (sentBuf.length !== expectedBuf.length || !timingSafeEqual(sentBuf, expectedBuf)) {
    return { ok: false };
  }

  return { ok: true, userId: token.userId };
}
```

#### 実装上の罠

- **正準化が極めて厳密**: スペース1つ、エンコードの差で署名が変わる。デバッグが地獄
- **アルゴリズムと互換性**: OAuth 1.0で広く使われたHMAC-SHA1を新規設計の根拠にしない。レガシー連携では相手の仕様とライブラリ実装を固定して検証する
- **TLSは必要**: リクエスト署名は機密性を提供せず、URL、ヘッダ、本文の漏洩を防げない。HTTPSを必須とする
- **リプレイ対策が必要**: nonceとtimestampを検証し、受理済みnonceを有効期間中保持する。共有ストアの障害時にfail-openしない

#### なぜ OAuth 2.0 に置き換わったか

OAuth 1.0 の **「実装が難しい」** という評価が決定打になった。署名計算のバグで動かない、デバッグできない、モバイルアプリで秘密鍵を保持できない…これらの問題から、Eran Hammer-Lahav(OAuth 1.0a の編集者) を含む策定陣は「**もっと単純な仕様**」として OAuth 2.0 を出した。

ただし「Bearer Token = 持っていれば誰でも使える」という単純化は、**新たな脆弱性のクラス**を生んだ (トークン漏洩、リダイレクト URI 偽装など)。これに対応するため、現代では PKCE [RFC 7636]、DPoP [RFC 9449]、mTLS sender-constrained token などが追加されている。皮肉なことに、これらは OAuth 1.0 の「**送信者制約トークン**」のアイデアを再発明したとも言える。

OAuth 1.0 から学べる教訓: **単純化はトレードオフを伴う**。「シンプル」と「セキュリティ」は別の軸であり、どちらかを優先すれば他方を補強する仕組みが必要になる。

<a id="section-13-17"></a>
### 13.17 Shared Signals Framework (SSF) ― 継続的セキュリティ評価
<!-- handbook:learning {"level":"outlook","minutes":45} -->
<!-- handbook:index {"group":"C","term":"CAEP (Continuous Access Evaluation Profile)"} -->
<!-- handbook:index {"group":"R","term":"Receiver (SSF)"} -->
<!-- handbook:index {"group":"R","term":"RISC (Risk Incident Sharing and Coordination)"} -->
<!-- handbook:index {"group":"S","term":"SET (Security Event Token)"} -->
<!-- handbook:index {"group":"S","term":"SSF (Shared Signals Framework)"} -->
<!-- handbook:index {"group":"T","term":"Transmitter (SSF)"} -->
<!-- handbook:index {"group":"Z","term":"Zero Trust"} -->
<!-- handbook:index {"group":"さ行","term":"セキュリティイベント共有"} -->
<!-- handbook:index {"group":"さ行","term":"セッション取り消しイベント"} -->
<!-- handbook:index {"group":"か行","term":"継続的アクセス評価"} -->
<!-- handbook:index {"group":"な行","term":"認証情報変更イベント"} -->

<!-- handbook:narrative-bridge {"section":"13.17"} -->
ログイン時点で安全と判断しても、端末侵害、アカウント停止、権限変更はセッション中に発生する。Shared Signals Frameworkは認証を一度の判定で終わらせず、状態変化を継続的に伝えて再評価する。

ここまで見た認証技術は「**ログイン時に検証する**」モデルだった。ユーザーが認証され、トークンが発行されたら、そのトークンの有効期限まで信頼する。だが現実には:

- ユーザーのパスワードが他社で漏洩した
- 端末が紛失された
- ログイン後にマルウェア感染が検出された
- 退職に伴い別システムで権限が剥奪された

これらが発生したとき、**現在発行済みのセッション・トークン**はどうなる? 多くのシステムでは何もできず、トークン有効期限まで攻撃者が活動できてしまう。

**Shared Signals Framework (SSF)** [OpenID SSF, 2025] は、この問題を「**システム間でリアルタイムにセキュリティイベントを共有する**」ことで解決する OpenID Foundation の標準だ。2025年9月に最終仕様が承認された比較的新しい標準で、Google、Microsoft、Apple、Okta などの大手 IdP が採用している。

#### 何が解決されるか ― Zero Trust の実装基盤

SSF が描く世界:

```text
[Google (IdP)] ── 「user_x のパスワードが侵害された」 ──→ [Slack]
                                                      ── [GitHub]
                                                      ── [自社アプリ]
                                                      ── [Salesforce]
                  ↓ 各サービスが即座に該当ユーザーのセッションを無効化
```

これにより、伝統的な「**1回認証してずっと信頼**」モデルから「**継続的に再評価**」モデルへ移行できる。これが Zero Trust アーキテクチャの中核要件。

#### SSF の2つのプロファイル

SSF はフレームワークで、その上に**2つの用途特化プロファイル**が定義されている:

- **CAEP (Continuous Access Evaluation Profile)**: セッション関連の変化を伝える
  - セッション取り消し、認証要求変更、デバイス信頼度変更、IP 変更など
- **RISC (Risk Incident Sharing and Coordination)**: アカウント関連の変化を伝える
  - アカウント侵害、認証情報変更、アカウント無効化など

#### 技術スタック

SSF は既存標準の組み合わせで構築されている:

| 役割 | 標準 |
|---|---|
| イベント形式 | SET (Security Event Token) [RFC 8417] ― JWT の特殊版 |
| イベント識別子 | Subject Identifiers for SET [RFC 9493] |
| 配信 (Push) | HTTP-based Push [RFC 8935] |
| 配信 (Poll) | HTTP-based Poll [RFC 8936] |
| 受信側設定 | OpenID Shared Signals Framework 1.0 |

#### Transmitter と Receiver

SSF の登場人物:

- **Transmitter (送信者)**: イベントを発行する側 (通常は IdP: Okta、Google、Microsoft Entra 等)
- **Receiver (受信者)**: イベントを受け取り、自社のセッション無効化などを行う側
- **Stream**: 両者間の論理的な通信路。Receiver ごと、用途ごとに独立して作る

#### Security Event Token (SET) の構造

SET は JWT の特殊形式。`events` クレームに具体的なセキュリティイベントが入る:

```json
{
  "iss": "https://idp.example.com",
  "iat": 1716212345,
  "jti": "1234-5678-9abc",
  "aud": "https://receiver.example.org",
  "events": {
    "https://schemas.openid.net/secevent/caep/event-type/session-revoked": {
      "subject": {
        "format": "iss_sub",
        "iss": "https://idp.example.com",
        "sub": "user-42"
      },
      "initiating_entity": "policy",
      "reason_admin": {
        "en": "Password compromised in third-party breach"
      },
      "event_timestamp": 1716212340
    }
  }
}
```

JWT と同じく、SET も電子署名 (13.15で扱った Ed25519/ECDSA の応用) で完全性が保証される。

#### Receiver 側の実装

```typescript
import express from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const app = express();

// Transmitter の JWKS を取得 (公開鍵で署名検証)
const jwks = createRemoteJWKSet(new URL('https://idp.example.com/.well-known/jwks.json'));

// SSF Push エンドポイント
app.post('/ssf/events', express.text({ type: 'application/secevent+jwt' }), async (req, res) => {
  try {
    // 1. SET (JWT) を検証
    const { payload } = await jwtVerify(req.body, jwks, {
      issuer: 'https://idp.example.com',
      audience: 'https://myapp.example.org',
    });

    const events = payload.events as Record<string, any>;
    if (!events) return res.status(400).end();

    // 2. 各イベントを処理
    for (const [eventType, eventData] of Object.entries(events)) {
      await handleSecurityEvent(eventType, eventData);
    }

    // 3. 202 Accepted で確認(SSFの仕様)
    res.status(202).end();
  } catch (e) {
    // 署名検証失敗など
    res.status(400).json({ err: 'invalid_request', description: (e as Error).message });
  }
});

async function handleSecurityEvent(eventType: string, data: any) {
  const subject = data.subject;
  // subject の format は iss_sub、email、phone、opaque などがある
  const userId = await resolveUser(subject);
  if (!userId) return;

  switch (eventType) {
    case 'https://schemas.openid.net/secevent/caep/event-type/session-revoked':
      // 該当ユーザーの全セッションを破棄。DEL はグロブを解釈しないので、
      // ユーザーごとのセッションID集合を引いてから消す
      await revokeAllSessions(userId);  // SMEMBERS user_sessions:<id> → UNLINK
      await db.session.deleteMany({ where: { userId } });
      await logSecurityEvent(userId, 'session_revoked_by_idp', data.reason_admin);
      break;

    case 'https://schemas.openid.net/secevent/caep/event-type/credential-change':
      // 認証情報変更: 全セッションリフレッシュを強制
      await db.session.updateMany({
        where: { userId },
        data: { requireReauth: true },
      });
      break;

    case 'https://schemas.openid.net/secevent/risc/event-type/account-disabled':
      // アカウント無効化: ユーザーをロック
      await db.user.update({ where: { id: userId }, data: { status: 'LOCKED' } });
      await revokeAllSessions(userId);
      break;

    case 'https://schemas.openid.net/secevent/risc/event-type/identifier-changed':
      // メールアドレス変更など: ユーザー識別子を更新
      await updateUserIdentifier(userId, data);
      break;
  }
}

async function resolveUser(subject: any): Promise<string | null> {
  if (subject.format === 'iss_sub') {
    // sub はOIDCで連携時に保存しておいた IdP のユーザーID
    const link = await db.externalIdentity.findFirst({
      where: { issuer: subject.iss, sub: subject.sub },
    });
    return link?.userId ?? null;
  }
  if (subject.format === 'email') {
    const user = await db.user.findUnique({ where: { email: subject.email } });
    return user?.id ?? null;
  }
  return null;
}
```

#### Transmitter (発行側) の実装概要

自分が SaaS で IdP 役を担う場合、SSF Transmitter を実装することになる:

```typescript
// 1. Stream 管理エンドポイント (Receiver が購読/設定を行う)
app.post('/ssf/streams', authenticate, async (req, res) => {
  const { delivery, events_requested } = req.body;
  const stream = await db.ssfStream.create({
    data: {
      receiverId: req.client.id,
      pushEndpoint: delivery.endpoint_url,
      eventsRequested: events_requested,
    },
  });
  res.json({ stream_id: stream.id, ...stream });
});

// 2. イベント発生時の発行ロジック
async function publishSessionRevoked(userId: string, reason: string) {
  const streams = await db.ssfStream.findMany({
    where: {
      eventsRequested: { has: 'session-revoked' },
      // Receiver と関係のあるユーザーだけにフィルタ
      receiver: { users: { some: { id: userId } } },
    },
  });

  for (const stream of streams) {
    const externalIdentity = await db.externalIdentity.findFirst({
      where: { userId, issuer: ISSUER_URL, clientId: stream.receiverId },
    });
    if (!externalIdentity) continue;

    // SET を作成・署名
    const set = await new SignJWT({
      jti: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
      aud: stream.audience,
      events: {
        'https://schemas.openid.net/secevent/caep/event-type/session-revoked': {
          subject: {
            format: 'iss_sub',
            iss: ISSUER_URL,
            sub: externalIdentity.sub,
          },
          reason_admin: { en: reason },
          event_timestamp: Math.floor(Date.now() / 1000),
        },
      },
    })
      .setProtectedHeader({ alg: 'ES256', kid: SIGNING_KEY_ID, typ: 'secevent+jwt' })
      .setIssuer(ISSUER_URL)
      .sign(privateKey);

    // Push (HTTP POST)、失敗時はリトライ用キューへ
    try {
      await fetch(stream.pushEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/secevent+jwt' },
        body: set,
      });
    } catch {
      await queue.add('ssf-retry', { streamId: stream.id, set });
    }
  }
}
```

#### Pull モデル (Polling) のサポート

ファイアウォール越しの Receiver 等、Push を受けられない環境のために Poll モデルも用意されている [RFC 8936]:

```typescript
// Receiver 側が定期的に GET でイベントを取りに来る
app.get('/ssf/poll', authenticate, async (req, res) => {
  const stream = await db.ssfStream.findFirst({ where: { receiverId: req.client.id } });
  const events = await db.ssfPendingEvent.findMany({
    where: { streamId: stream.id, deliveredAt: null },
    take: 100,
  });

  res.json({
    sets: Object.fromEntries(events.map((e) => [e.jti, e.setJwt])),
    more_available: events.length === 100,
  });
});

// Receiver が受信確認を返す
app.post('/ssf/poll/ack', authenticate, async (req, res) => {
  const { acks } = req.body;
  await db.ssfPendingEvent.updateMany({
    where: { jti: { in: acks } },
    data: { deliveredAt: new Date() },
  });
  res.status(204).end();
});
```

#### 採用時の判断ポイント

SSF を採用すべきケース:

- **エンタープライズ SaaS**: 顧客が IdP からのアカウント無効化を即座に反映してほしい
- **Zero Trust アーキテクチャ**: 継続的な信頼評価が要件
- **コンプライアンス**: SOC 2、ISO 27001 等で「即時アクセス取り消し」が要求される
- **複数システム間で同じユーザーを扱う**: 1箇所の侵害情報を全システムに伝播

不要なケース:

- 単一サービス内で完結している
- ユーザー数が少ない・閉じた利用環境
- IdP との連携自体がない

#### Receiver から見た優先度

「**まず IdP として有名な Okta、Microsoft Entra、Google Workspace の Push を受け取る**」を実装するだけでも、企業ユーザーから見て大きな価値がある。フルスペック実装は段階的で良い。具体的には:

1. RISC の `account-disabled` だけまず実装 (退職者対応)
2. CAEP の `session-revoked` を追加 (パスワード侵害対応)
3. その他のイベント型を順次追加

#### 関連標準との位置づけ

- **OIDC** (13.8) は認証の **一回性** を扱う
- **OAuth 2.0** (13.7) はアクセス権の **委譲** を扱う
- **SSF** は認証・認可の **継続的な再評価** を扱う

3者は補完関係にある。SSF だけでは認証はできない。SSF が役立つのは「すでに OIDC で連携している先」とのリアルタイム同期だ。

#### 学び ― 認証は「一度きり」から「継続的」へ

10年前の標準的な認証は「ログインしたら8時間信頼」だった。SSF はその前提を覆し、「**信頼は秒単位で変わりうる、検知したら即座に伝える**」という新しい時代を作っている。これは**認証における Reactive から Proactive へのパラダイム転換**であり、Zero Trust アーキテクチャの実装基盤となる。

今後 5〜10 年で、エンタープライズアプリの認証実装の常識として SSF の対応が求められるようになる可能性が高い。早期に概念だけでも理解しておくと差がつく。

<a id="section-13-18"></a>
### 13.18 SAML ― エンタープライズSSOの実質標準
<!-- handbook:learning {"level":"practical","minutes":65} -->
<!-- handbook:index {"group":"I","term":"Identity Provider (IdP)"} -->
<!-- handbook:index {"group":"J","term":"JIT Provisioning (SAML)"} -->
<!-- handbook:index {"group":"S","term":"SAML (Security Assertion Markup Language)"} -->
<!-- handbook:index {"group":"S","term":"SAML Assertion"} -->
<!-- handbook:index {"group":"S","term":"Service Provider (SP)"} -->
<!-- handbook:index {"group":"S","term":"Single Logout (SLO)"} -->
<!-- handbook:index {"group":"S","term":"SSO (Single Sign-On)"} -->
<!-- handbook:index {"group":"X","term":"XML Signature Wrapping (XSW)"} -->
<!-- handbook:index {"group":"Z","term":"Zero Trust"} -->
<!-- handbook:index {"group":"あ行","term":"アサーション (SAML)"} -->
<!-- handbook:index {"group":"あ行","term":"エンタープライズ SSO"} -->
<!-- handbook:index {"group":"ま行","term":"マルチテナント認証"} -->

<!-- handbook:narrative-bridge {"section":"13.18"} -->
OIDCは現代的なWebやモバイルに適するが、企業の既存IdPとSaaSを接続する現場では SAML (Security Assertion Markup Language) を避けられないことがある。XML署名、ブラウザリダイレクト、企業プロビジョニングという異なる前提を持つSSO境界を理解する。

ここまでOAuth 2.0/OIDCを扱ってきたが、エンタープライズSSOではSAML 2.0も広く利用されている [OASIS SAML, 2005]。新規統合でOIDCを選べる場合もあれば、顧客の既存IdPや契約要件によりSAMLが必要な場合もある。

主要なIdPはSAMLとOIDCの両方を提供することが多い。「OktaでSSOしたい」という要求だけでは方式を決めず、顧客テナントが利用できるプロトコル、IdPメタデータ、プロビジョニング、ログアウト、証明書ローテーションの要件を確認する。

B2B SaaSではSAML対応が商談要件になることがある一方、対象市場によってはOIDCのみで開始できる。標準対応の優先順位は、想定顧客と実際の要件調査で決める。

#### SAML と OIDC の根本的な違い

| | SAML 2.0 | OIDC (1.0) |
|---|---|---|
| 公開年 | 2005 | 2014 |
| データ形式 | XML | JSON |
| 署名 | XML Signature (XML-DSig) | JWT (JWS) |
| 暗号化 | XML Encryption | JWE |
| トランスポート | HTTP POST (Form)、Redirect | HTTP Redirect |
| トークン | SAML Assertion | ID Token + Access Token |
| 対象 | Webブラウザ・サーバ間 | Webブラウザ、モバイル、SPA、IoT |
| 主用途 | エンタープライズ SSO | 一般 Web、ソーシャルログイン |
| 仕様の複雑度 | 高 (数百ページ) | 中 |
| デバッグの容易性 | 低 (XML、巨大なリクエスト) | 高 (JSONをデコードして読める) |
| モバイル適性 | 低 | 高 |

新規の認証基盤ではOIDCを第一候補にしつつ、既存エンタープライズ環境との連携要件がある場合にSAMLを追加する、という段階的な判断が現実的だ。

#### SAML の登場人物

- **Identity Provider (IdP)**: ユーザーを認証する側 (Okta、Entra ID、Google Workspace 等)
- **Service Provider (SP)**: ユーザーがアクセスしたいアプリ (自社SaaS)
- **User Agent**: 通常はブラウザ
- **Assertion**: 主体、認証コンテキスト、属性、条件などを表すXML要素。JWTと似た用途を持つ場合はあるが、XML Signature、参照URI、Conditionsなど検証モデルが異なる

OIDC の「Client = RP (Relying Party)」「OP (OpenID Provider) = IdP」と概念は同じだが、用語が違う。

#### SP-Initiated SSO フロー (最も一般的)

```text
1. User → SP: アプリにアクセス試行
2. SP → User: ブラウザに AuthnRequest (Base64エンコード) を含むHTMLフォームを返す
              <form action="https://idp.example.com/sso" method="POST">
                <input name="SAMLRequest" value="PHNhbWxwOk..." />
                <input name="RelayState" value="/original/url" />
              </form>
              → JavaScript で自動 submit
3. User → IdP: AuthnRequest を POST
4. IdP: 既にログイン済みなら省略、未ログインなら認証画面表示
5. IdP → User: SAMLResponse (Base64エンコードのXML、署名付き) を含むHTMLフォーム
              <form action="https://sp.example.com/saml/acs" method="POST">
                <input name="SAMLResponse" value="PHNhbWxwOl..." />
                <input name="RelayState" value="/original/url" />
              </form>
              → 自動 submit (ACS = Assertion Consumer Service)
6. SP: SAMLResponse の署名検証 → Assertion から属性取得 → セッション作成 → RelayState で元のURLへリダイレクト
```

SAMLには複数の標準Bindingがある。SPからIdPへのAuthnRequestではHTTP-Redirect、IdPからSPのACSへのResponseではHTTP-POSTがよく使われる。メッセージサイズ、署名方式、IdP/SP製品の対応に合わせて選ぶ。HTTP-Redirectは単に「古い方式」ではない。

#### IdP-Initiated SSO

ユーザーが IdP のポータル (Okta ダッシュボード等) から「自社SaaSのアイコン」をクリックして開始する方式。流れは似ているが、ステップ1〜3が省略される。

**セキュリティ上の注意**: IdP-InitiatedではSP側の認証要求との`InResponseTo`相関がないため、login CSRFや意図しないアカウントへのセッション切替を防ぐ設計が難しくなる。署名検証に加え、Issuer、Audience、Destination、Recipient、時刻条件、RelayStateの許可先、重複Assertion IDを検証する。要件がなければSP-Initiatedを優先する。

#### SAMLResponse の中身

```xml
<samlp:Response ID="_abc123" Version="2.0"
                IssueInstant="2026-05-20T12:00:00Z"
                Destination="https://sp.example.com/saml/acs"
                xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
  <saml:Issuer>https://idp.example.com</saml:Issuer>

  <!-- ResponseとAssertionの両方が署名されることが多い -->
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="#_abc123">
        <ds:DigestValue>...</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>...</ds:SignatureValue>
    <ds:KeyInfo>...</ds:KeyInfo>
  </ds:Signature>

  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>

  <saml:Assertion ID="_xyz789" Version="2.0"
                  IssueInstant="2026-05-20T12:00:00Z">
    <saml:Issuer>https://idp.example.com</saml:Issuer>

    <!-- 認証された主体 -->
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
        alice@example.com
      </saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData
          NotOnOrAfter="2026-05-20T12:05:00Z"
          Recipient="https://sp.example.com/saml/acs"
          InResponseTo="_request-id-123"/>
      </saml:SubjectConfirmation>
    </saml:Subject>

    <!-- 有効期限 -->
    <saml:Conditions NotBefore="2026-05-20T11:59:00Z"
                     NotOnOrAfter="2026-05-20T12:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://sp.example.com</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>

    <!-- 認証方法 -->
    <saml:AuthnStatement AuthnInstant="2026-05-20T12:00:00Z"
                         SessionIndex="_session-456">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>
          urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
        </saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>

    <!-- ユーザー属性 -->
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>alice@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue>Alice</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName">
        <saml:AttributeValue>Smith</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>admin</saml:AttributeValue>
        <saml:AttributeValue>engineering</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
```

JWT と比べると XML の分だけ大きくなるが、本質は同じ ― 「**署名された認証結果**」に「**ユーザー属性**」が乗っている。

#### SP 側の実装

SAML を自前パースするのは罠が多いので、ライブラリを使う。Node.js では `@node-saml/node-saml` や `samlify` が定番。

```typescript
import { SAML } from '@node-saml/node-saml';
import express from 'express';

const samlClient = new SAML({
  // SP (自分) の設定
  issuer: 'https://sp.example.com',
  callbackUrl: 'https://sp.example.com/saml/acs',
  privateKey: process.env.SP_PRIVATE_KEY,           // SAMLRequest 署名用
  decryptionPvk: process.env.SP_DECRYPTION_KEY,     // 暗号化Assertion復号用

  // IdP の設定
  entryPoint: 'https://idp.example.com/sso',        // IdPのログインURL
  logoutUrl: 'https://idp.example.com/slo',         // ログアウトURL
  idpCert: process.env.IDP_CERT,                    // IdPの公開鍵証明書

  // セキュリティ設定
  signatureAlgorithm: 'sha256',
  wantAssertionsSigned: true,                       // Assertion署名要求
  wantAuthnResponseSigned: true,                    // Response署名要求
  acceptedClockSkewMs: 5000,                        // 時刻ズレ許容
});

const app = express();
app.use(express.urlencoded({ extended: true }));

// 1. SP-Initiated SSO 開始
app.get('/auth/saml/login', async (req, res) => {
  const url = await samlClient.getAuthorizeUrlAsync(req.query.returnTo as string, undefined, {});
  res.redirect(url);
});

// 2. Assertion Consumer Service (IdP からのコールバック)
app.post('/saml/acs', async (req, res) => {
  try {
    const { profile } = await samlClient.validatePostResponseAsync(req.body);

    if (!profile) {
      return res.status(401).send('No profile returned');
    }

    // Just-In-Time (JIT) Provisioning
    // 初回ログインのユーザーは自動的にDB作成
    const user = await db.user.upsert({
      where: { email: profile.email as string },
      create: {
        email: profile.email as string,
        firstName: profile.firstName as string,
        lastName: profile.lastName as string,
        ssoProvider: profile.issuer,
        ssoSubject: profile.nameID,
      },
      update: {
        firstName: profile.firstName as string,
        lastName: profile.lastName as string,
        lastLoginAt: new Date(),
      },
    });

    // グループ属性からロール反映
    const groups = (Array.isArray(profile.groups) ? profile.groups : [profile.groups])
      .filter(Boolean) as string[];
    await syncUserRoles(user.id, groups);

    // セッション作成(13.3 と同じ)
    req.session.userId = user.id;
    req.session.samlSessionIndex = profile.sessionIndex;  // SLO で使う

    const returnTo = (req.body.RelayState as string) ?? '/dashboard';
    res.redirect(returnTo);
  } catch (err) {
    console.error('SAML validation failed:', err);
    res.status(401).send('Authentication failed');
  }
});

// 3. Single Logout (SLO)
app.get('/auth/saml/logout', async (req, res) => {
  const url = await samlClient.getLogoutUrlAsync({
    nameID: req.user.ssoSubject,
    nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    sessionIndex: req.session.samlSessionIndex,
  });
  req.session.destroy(() => res.redirect(url));
});

// 4. SP メタデータ提供(IdP に登録するため)
app.get('/saml/metadata', (req, res) => {
  res.type('application/xml');
  res.send(samlClient.generateServiceProviderMetadata(
    process.env.SP_DECRYPTION_CERT!,
    process.env.SP_SIGNING_CERT!,
  ));
});
```

#### Just-In-Time (JIT) Provisioning

SAML の重要なパターン: **初回ログイン時にユーザーレコードを自動作成**する。SCIM (System for Cross-domain Identity Management、次節 13.19 で扱う) による事前プロビジョニングが理想だが、JIT で済むケースも多い。

```typescript
// 初回ログイン時の自動アカウント作成
async function jitProvisionUser(profile: SAMLProfile, organizationId: string) {
  return await db.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      organizationId,
      authProvider: 'saml',
      authProviderSubject: profile.nameID,
      // パスワードは設定しない(SAMLでしかログインできない)
      passwordHash: null,
    },
    update: {
      lastLoginAt: new Date(),
    },
  });
}
```

#### マルチテナント B2B SaaS での実装

複数の顧客企業が独自の IdP を持つ場合、テナントごとに SAML 設定を持つ必要がある。

```typescript
// テナントごとの SAML 設定 (DB)
interface OrganizationSAMLConfig {
  organizationId: string;
  enabled: boolean;
  entryPoint: string;      // IdPのSSO URL
  issuer: string;          // IdPのEntity ID
  idpCert: string;         // IdPの公開鍵証明書
  attributeMapping: {
    email: string;         // 例: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    firstName: string;
    lastName: string;
    groups: string;
  };
}

// メールドメインから組織を判定
async function startSamlLogin(email: string, res: Response) {
  const domain = email.split('@')[1];
  const org = await db.organization.findFirst({
    where: { emailDomain: domain, samlConfig: { enabled: true } },
    include: { samlConfig: true },
  });

  if (!org) return res.redirect('/login?error=no_sso');

  const samlClient = createSamlClient(org.samlConfig);
  const url = await samlClient.getAuthorizeUrlAsync('/', undefined, {});
  res.redirect(url);
}

// ACS はテナント別に分ける(URLでテナント特定)
app.post('/saml/acs/:orgSlug', async (req, res) => {
  const org = await db.organization.findUnique({
    where: { slug: req.params.orgSlug },
    include: { samlConfig: true },
  });
  if (!org?.samlConfig) return res.status(404).end();

  const samlClient = createSamlClient(org.samlConfig);
  const { profile } = await samlClient.validatePostResponseAsync(req.body);
  // ... JIT provisioning + セッション作成
});
```

これが Frontegg、WorkOS、Auth0 Enterprise が解決する複雑性だ。「**1顧客あたり1セットアップ**」が必要なので、Self-Serve(顧客が自分で設定できる UI) も用意する。

#### SAML の落とし穴

実装上の罠を列挙しておく:

**1. XML Signature Wrapping (XSW) 攻撃**

XML 署名の検証は「**署名対象を特定する**」ロジックが複雑で、攻撃者が**署名検証された要素と、実際に処理される要素を分離**する攻撃が知られている [Somorovsky et al., 2012]。自前実装は危険。実績あるライブラリを使う。

**2. 時計ズレ**

`NotOnOrAfter` で有効期限が厳格に決まる。サーバの時計が数秒ズレるだけで全認証失敗。NTP 同期必須。`acceptedClockSkewMs` でわずかな許容を設定。

**3. 証明書ローテーション**

IdP が証明書を更新すると、すべての SP で更新作業が必要。Okta などは「**前バージョンと新バージョンを並行運用する期間**」を提供する。SP 側もこれをサポートしてマルチ証明書を許容すべき。

**4. グループ属性の罠**

「グループ = ロール」と短絡的にマッピングすると、IdP 側でグループ名を変えただけで認可が崩れる。グループ名 → ロールのマッピングを SP 側で持ち、ローテーションに耐えるように設計する。

**5. デバッグ困難**

SAMLResponse は Base64 化された巨大なXMLで、人間が読める形ではない。デバッグツールとして以下が必須:

- **Chrome 拡張 SAML-tracer**: ブラウザ通信を可視化
- **samltool.com**: SAMLResponse をデコード・整形
- **xmlsec ライブラリ**: 署名検証を手動で実行できる

**6. RelayState の不適切な扱い**

ユーザーがアクセスしようとした元 URL を `RelayState` に入れて IdP に渡し、認証後に戻すパターン。**この値を信用してリダイレクトすると、オープンリダイレクト脆弱性** (23.8) が発生する。自社ドメイン内のパスのみ許可する。

#### SAML 認証はいつ自前実装すべきか

ほぼ「絶対に自前実装するな」が答えだ。理由:

- 仕様が膨大 (SAML Core、Bindings、Profiles、Metadata、…)
- セキュリティの罠が多い (XSW、SignatureBypass、…)
- 顧客の IdP の癖が多い (Microsoft、Okta、Google、One Login で微妙な違い)

**推奨される選択肢:**

1. **自社で実装する場合**: `@node-saml/node-saml`、`samlify`(Node.js)、`python3-saml`(Python)、`ruby-saml`(Ruby)、`onelogin-java-saml`(Java) などの実績あるOSSライブラリを使う

2. **SaaS に委譲**: WorkOS、Frontegg、Auth0 などが SAML を含む「エンタープライズ SSO」機能を提供。1顧客あたり数千円〜 / 月。実装の数ヶ月を1日に短縮できる

3. **完全マネージド IdP**: 自社が IdP 側を作る必要があるなら、Keycloak、Auth0、ORY Hydra など

#### SAML vs OIDC ― 結局どちらを使うべきか

| シナリオ | 推奨 |
|---|---|
| 一般消費者向けアプリ | OIDC 一択 |
| モバイルアプリ | OIDC (SAMLはモバイル不向き) |
| 新規 B2B SaaS、エンタープライズ未対応 | OIDC で始める |
| エンタープライズ顧客が必要な B2B SaaS | **SAML 必須**、OIDC も並行サポート |
| 既存のエンタープライズ環境への追加 | SAML 中心 |
| 内部マイクロサービス間 | OIDC (mTLS、JWT) |

「**新規実装は OIDC、エンタープライズ顧客対応で SAML を後付け**」 ― これがプラグマティックな戦略だ。

#### B2B SaaS の悲しい現実

技術的に OIDC のほうが優れているのは事実だが、**営業上の現実**として:

- 顧客の情シス担当「うちはOktaなんですが、SAML対応してますか?」
- 営業「(対応してません…)」 → 失注
- 営業「対応してます」 → 受注成功 → 開発が3ヶ月かけて SAML 実装 → 顧客は満足

これが新規 B2B SaaS が成長期に直面する「**SAML 課題**」だ。WorkOS が「**B2B SaaS が SAML 対応で失注しない**」を売り文句にできたのは、この市場が大きいことの証拠だ。

#### 学び ― レガシー標準と上手く付き合う

技術が新しい (OIDC) からと言って、古い標準 (SAML) が消えるわけではない。**エンタープライズの世界は10年単位で動く**。2026年でも、2035年でも、SAMLは生き続けるだろう。

新しい技術を学ぶことと同じくらい、**広く使われているレガシー標準を理解する**ことが、現実のプロダクト開発では価値を持つ。13.16 の OAuth 1.0 と同じ ― 「過去から学ぶ」姿勢が、現代の技術選定を正確にする。

<a id="section-13-19"></a>
### 13.19 IAM の全体像 ― CIAM と EIAM の使い分け
<!-- handbook:learning {"level":"practical","minutes":40} -->
<!-- handbook:index {"group":"C","term":"CIAM (Customer Identity and Access Management)"} -->
<!-- handbook:index {"group":"E","term":"EIAM (Enterprise Identity and Access Management)"} -->
<!-- handbook:index {"group":"I","term":"IAM (Identity and Access Management)"} -->
<!-- handbook:index {"group":"I","term":"Identity Provider (IdP)"} -->
<!-- handbook:index {"group":"N","term":"NIST SP 800-207"} -->
<!-- handbook:index {"group":"S","term":"SCIM (System for Cross-domain Identity Management)"} -->
<!-- handbook:index {"group":"S","term":"SSO (Single Sign-On)"} -->
<!-- handbook:index {"group":"W","term":"Workforce IAM"} -->
<!-- handbook:index {"group":"Z","term":"Zero Trust"} -->
<!-- handbook:index {"group":"あ行","term":"アイデンティティ管理"} -->
<!-- handbook:index {"group":"あ行","term":"アクセスレビュー"} -->
<!-- handbook:index {"group":"さ行","term":"ソーシャルログイン"} -->
<!-- handbook:index {"group":"は行","term":"プログレッシブプロファイリング"} -->
<!-- handbook:index {"group":"は行","term":"プロビジョニング (SCIM)"} -->
<!-- handbook:index {"group":"ま行","term":"マルチテナント認証"} -->
<!-- handbook:index {"group":"ら行","term":"リスクベース認証"} -->
<!-- handbook:index {"group":"か行","term":"顧客 ID 管理 (CIAM)"} -->
<!-- handbook:index {"group":"さ行","term":"従業員 ID 管理 (EIAM)"} -->
<!-- handbook:index {"group":"た行","term":"同意管理"} -->

<!-- handbook:narrative-bridge {"section":"13.19"} -->
SAML、OIDC、WebAuthnを個別に知っても、顧客向けIDと従業員向けIDではライフサイクル、管理者、規模、規制が異なる。IAMをCIAMとEIAMへ分け、どの機能を自社で持たず基盤へ委ねるかを判断する。

ここまでパスワード、セッション、JWT、OAuth、OIDC、パスキー、RBAC/ABAC/ReBAC、Webhook 署名、SSF と、認証・認可に関する個別技術を見てきた。最後に、これらを統合する上位概念 **IAM (Identity and Access Management)** を整理し、その2大カテゴリ ― **EIAM** と **CIAM** の違いと選び方を扱う。

#### IAM とは何か

IAM は「**誰が、何に、どうやって、いつアクセスできるか**」を管理する仕組みの総称だ。構成要素は4つに整理できる:

| 構成要素 | 含まれる機能 | 本書での扱い |
|---|---|---|
| **Identity (アイデンティティ)** | アカウント、属性、プロファイル、ライフサイクル (作成→更新→削除) | 13.1, 13.3 |
| **Authentication (認証)** | パスワード、MFA、パスキー、生体、SSO | 13.1, 13.4, 13.8, 13.9 |
| **Authorization (認可)** | 権限、ロール、属性、ポリシー、リソースアクセス制御 | 13.10, 13.11 |
| **Audit (監査)** | アクセスログ、変更履歴、コンプライアンスレポート、SSF イベント | 13.17, 22.3, 23.12 |

本書ではこの4要素で IAM を整理する。製品ごとに名称や境界は異なるので、比較するときは4要素のどれをどこまで担うかで見る。

#### IAM が解決する根本問題

ユーザー数とアプリケーション数が増えると、管理は組み合わせ爆発を起こす。

```text
ユーザー10万人 × アプリ50個 × 権限種類20 = 1億のアクセス制御エントリ
```

これを各アプリが独自に管理すると:

- 同じパスワードを使い回す/別のパスワードで覚えきれない
- 退職時に全アプリの権限を漏れなく剥奪できない
- 監査要件 (誰が何にアクセスしているか) を出せない
- セキュリティポリシー変更が全アプリに伝播しない

IAM はこれを**集中管理**で解決する。「アイデンティティの単一の真実の源 (Single Source of Truth)」を作り、全アプリがそれを参照する。

#### 2つの世界 ― EIAM と CIAM

IAM は**誰のアイデンティティを管理するか**で2つの世界に分かれる:

| | EIAM (Workforce IAM) | CIAM (Customer IAM) |
|---|---|---|
| 別称 | Workforce Identity、Enterprise IAM | Consumer IAM、Customer Identity |
| 対象 | 従業員、業務委託、パートナー | エンドユーザー、消費者 |
| 規模 | 数百〜数万 | 数千〜数億 |
| ライフサイクル | IT 管理 (入社→異動→退職) | ユーザー自己管理 (登録→利用→解約) |
| アカウント作成 | 管理者によるプロビジョニング | セルフサインアップ |
| ID プロバイダ | 通常1〜2個 (社内 IdP) | 多数 (Google、Apple、Facebook、LINE...) |
| パスワードポリシー | 厳格 (企業ポリシー強制可) | 緩やか (ユーザー負担を最小化) |
| MFA | 強制可能 | 任意 (必要時のみリスクベース) |
| UX 優先度 | セキュリティ > UX | UX > セキュリティ (ただし両立必須) |
| カスタマイズ | 統一テーマ | ブランドごとに自由 |
| 主要規制 | SOC 2、ISO 27001、HIPAA | GDPR、CCPA、APPI |
| 商用例 | Okta Workforce、Microsoft Entra ID、Ping | Auth0、Stytch、Frontegg、AWS Cognito |

業界では「EIAM」より「**Workforce IAM**」のほうがよく使われる (EIAM は発音しづらいため) が、本書では明確化のため EIAM と表記する。

両者は表面的には似た機能 (認証・認可) を持つが、**最適化される指標が真逆**だ。EIAM は「**IT 統制を最大化**」する方向、CIAM は「**摩擦を最小化**」する方向に進化している。

#### EIAM の典型機能

EIAM は「組織が IT 資産にアクセスするユーザー (従業員) を統制する」基盤として進化してきた。中核機能:

**1. SSO (Single Sign-On)**: 1回のログインで全アプリにアクセス。SAML 2.0、OIDC で実現。

**2. プロビジョニング**: HR システムからの自動アカウント作成・削除。SCIM (System for Cross-domain Identity Management) [RFC 7644] が標準。

```typescript
// SCIM 2.0 でのユーザー作成
POST /scim/v2/Users
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "alice@company.com",
  "name": { "givenName": "Alice", "familyName": "Smith" },
  "active": true,
  "emails": [{ "value": "alice@company.com", "primary": true }]
}
// → 全SaaSにこのユーザーを自動展開
```

**3. ロール管理**: 部門・役職に応じたロール自動付与。

**4. アクセスレビュー**: 「Aliceは経理アプリへの管理者権限が本当に必要か?」を定期的に上司が承認するワークフロー。SOC 2 や ISO 27001 の要件。

**5. PAM (Privileged Access Management)**: 管理者権限への一時的アクセス、JIT (Just-in-Time) 権限付与、セッション録画。

**6. 条件付きアクセス**: 「日本IPからのみ許可」「会社デバイスからのみ許可」「金曜は財務システムアクセス禁止」など、コンテキスト依存のポリシー。

**EIAM 製品の例:**

- **Okta Workforce Identity Cloud**: シェア最大、独立ベンダ
- **Microsoft Entra ID** (旧 Azure AD): Microsoft 365 と統合、エンタープライズ標準
- **Ping Identity**: 金融・政府で強い
- **OneLogin**: 中堅向け
- **JumpCloud**: クラウドネイティブな小〜中規模向け

#### CIAM の典型機能

CIAM は「**消費者が自社サービスに登録・利用する**」体験を最適化する。中核機能:

**1. セルフサインアップ**: メール、Google、Apple、SNS等でユーザーが自分でアカウント作成。

**2. ソーシャルログイン**: 「Googleで続行」「Appleでサインイン」「LINE でログイン」。OIDC ベース。

**3. プログレッシブプロファイリング**: 「最初は最小限の情報、必要になったら段階的に追加」。

```typescript
// 初回登録: メールとパスワードのみ
// 商品購入時: 配送先住所を追加
// プレミアム加入時: 電話番号を追加(MFA用)
// → ユーザーは「全部入力させられる」感がなく、離脱率が下がる
```

**4. リスクベース認証**: 「いつもの環境ならパスワードだけ、新しいデバイスならMFA」。

**5. パスワードレス**: マジックリンク (メール内リンク)、パスキー、SMS OTP。

**6. 同意管理 (Consent Management)**: GDPR (General Data Protection Regulation)・CCPA・APPI 対応。「マーケティングメールに同意」「行動データの分析に同意」を粒度細かく管理、撤回も可能。

**7. プライバシー機能**: 「**忘れられる権利**」によるデータ削除、データポータビリティ (他社サービスへのエクスポート)。

**8. B2B2C (組織) 対応**: 「Acme社の従業員として、自社のSaaSにログイン」。テナント・ワークスペース概念。

**CIAM 製品の例:**

- **Auth0** (Okta傘下): 開発者向けのSDKとテナント設定が厚く、CIAM用途に寄せた製品
- **Stytch**: パスワードレス特化、開発者UX重視
- **Frontegg**: B2B SaaS向け、テナント・組織機能が強い
- **AWS Cognito**: AWS統合、安価だがUXに改善余地
- **Firebase Authentication**: モバイルアプリ向け、Google統合
- **Clerk**: 新興、React/Next.js統合が秀逸
- **Supabase Auth**: OSS、PostgreSQL と統合
- **WorkOS**: SSO/SCIM を「エンタープライズ向け CIAM」として提供

#### 一見似ているが選択を誤りやすい例

**ケース1: B2B SaaS スタートアップ**

❌ 誤り: 「自社の従業員管理用に IAM 入れたから、同じ製品で顧客ログインも作ろう」
→ EIAM 製品は顧客100万人スケールで破綻、UX もブランディングも不足

✅ 正解: 従業員管理は Microsoft Entra ID(社内Microsoft 365利用なら無料枠で十分)、顧客ログインは Auth0 や WorkOS で分離

**ケース2: 大企業の社内システム**

❌ 誤り: 「Auth0 が便利と聞いたので、社員のログインもそれで」
→ SCIM での HR システム連携、アクセスレビュー機能、PAM 等が不足

✅ 正解: EIAM (Okta / Entra ID) を中核に、特殊な顧客向けポータルだけ CIAM を別途導入

**ケース3: 既存サービスのリプレース**

❌ 誤り: 「全部自前で実装するのが最も柔軟」
→ MFA、ソーシャルログイン、リスクベース認証、GDPR 対応… を全部自前で書くと、機能完成までに何年もかかる

✅ 正解: コア機能は SaaS の IAM 製品に任せ、ビジネスロジックに集中

#### B2B2C のジレンマ ― SaaS で最も難しい問題

多くの B2B SaaS は「**顧客企業の従業員**」をユーザーとして持つ。これは EIAM でも CIAM でもなく、両者の交差領域だ。

```text
あなたのSaaS (例: Slack風アプリ)
   ├── 顧客企業A
   │     ├── 従業員1 (アカウント)
   │     ├── 従業員2 (アカウント)
   │     └── 従業員3 (アカウント)
   ├── 顧客企業B (独自SAML SSO要求)
   └── 顧客企業C (Okta連携要求)
```

要件:

- 顧客企業ごとに独立した認証 (企業AのアカウントBで企業のリソースは見えない)
- 各企業は自社のIdP(Okta、Entra ID、Auth0) を持ち、SAML/OIDCで連携したい
- SCIM での自動プロビジョニング (従業員入社で自動アカウント作成、退職で自動削除)
- 監査ログを顧客企業に提供 (誰が何をしたか)

これを正しく実装するには:

- **マルチテナント設計** (13.24 で扱い、30.3 で題材へ適用する): 全データに `organization_id` を持たせる
- **テナントごとの認証設定**: ユーザーのメールドメインから所属を判定、対応する IdP にリダイレクト
- **SAML/SCIM 対応**: 標準実装で複数 IdP に対応

```typescript
// メールドメインからテナントの認証方式を判定
async function startLogin(email: string, res: Response) {
  const domain = email.split('@')[1];
  const org = await db.organization.findFirst({ where: { emailDomain: domain } });

  if (org?.ssoConfig?.type === 'saml') {
    // SAML SSO へリダイレクト
    return res.redirect(buildSamlRequest(org.ssoConfig));
  }
  if (org?.ssoConfig?.type === 'oidc') {
    // OIDC へリダイレクト
    return res.redirect(buildOidcAuthUrl(org.ssoConfig));
  }
  // デフォルトはパスワード/パスキーログイン
  return res.render('login-password', { email });
}
```

WorkOS や Frontegg はこの「**B2B2C を簡単に実装する**」ことに特化した CIAM だ。自前実装は SAML パーサのバグや SCIM プロビジョニングのエッジケースで沼にハマる。

#### 「IAM を自前実装する」べきか

過去30年間、IAM は「自前実装→ライブラリ→SaaS」と進化してきた。2026年現在、新規プロジェクトでの判断指針:

| 規模・要件 | 推奨 |
|---|---|
| プロトタイプ・個人開発 | Better Auth、Lucia 等の OSS ライブラリ |
| 小〜中規模 SaaS (顧客 < 1万) | Clerk、Supabase Auth、Auth0 (Free Tier) |
| 中〜大規模 SaaS | Auth0、Stytch、WorkOS |
| エンタープライズ B2B SaaS | WorkOS、Frontegg(SAML/SCIM対応) |
| 大企業の社内 | Okta、Microsoft Entra ID |
| 完全な自前 (コンプライアンス・法令) | Keycloak、ORY Hydra/Kratos(OSS) |
| 規制業界 (銀行・医療・政府) | 国産・専用製品 + 専門家のレビュー必須 |

「**認証は自作しないが、自作できる理解はある**」が再掲の指針 (13.13で扱った)。本書で扱った技術 ― JWT、OAuth、OIDC、HMAC、Ed25519、SSF ― は全て、これらの製品の内部で動いている。**製品を選ぶときも、内部を理解していると判断が変わる**。

#### Zero Trust と IAM の未来

「ネットワーク境界の内側は信頼、外側は信用しない」という伝統的なモデルは崩壊した。リモートワーク、クラウド、SaaS の時代、**境界そのものが存在しない**。

**Zero Trust の原則:**

1. **Never trust, always verify**: 全アクセスを毎回検証
2. **Least privilege**: 必要最小限の権限のみ
3. **Assume breach**: 侵害されている前提で設計

これを実装する上で IAM は中核基盤になる。SSF (13.17)、ABAC/ReBAC (13.10)、パスキー (13.9) はすべて Zero Trust への流れを構成する技術だ。

NIST が出している **Zero Trust Architecture** ガイドライン [NIST SP 800-207, 2020] は、現代の IAM 設計の事実上のフレームワークになっている。

#### 学び ― IAM は「インフラ」である

CIAM と EIAM を統合した IAM は、いまや「**アプリケーションのインフラ**」と同じ重要度を持つ。データベース、CDN、決済と同列に、IAM をスタックの中核として設計する時代だ。

これまでの章で扱った個々の技術 (OIDC、JWT、HMAC、SSF、…) は、それぞれが IAM プラットフォームの**部品**として動いている。本書で得た知識を統合すれば、IAM 製品を**ブラックボックスとして使う**のではなく、**選定・統合・カスタマイズ**まで判断できる開発者になれる。これが現代の認証・認可の腕の見せ所だ。

<a id="section-13-20"></a>
### 13.20 PKCE ― OAuth/OIDC のクライアント側保護
<!-- handbook:learning {"level":"required","minutes":30} -->
<!-- handbook:index {"group":"O","term":"OAuth 2.1"} -->
<!-- handbook:index {"group":"P","term":"PKCE"} -->

<!-- handbook:narrative-bridge {"section":"13.20"} -->
OAuthの認可コードフローでは、公開クライアントがクライアント秘密を安全に保持できず、途中でコードを奪われる危険が残る。PKCEは要求時に作った一時秘密とトークン交換を結び付け、盗まれたコードだけでは利用できなくする。

13.7 では PKCE を「Authorization Code 横取り攻撃を防ぐ拡張」として名前だけ挙げた。ここでその中身を扱う。**PKCE (Proof Key for Code Exchange、ピクシーと読む)** は RFC 7636 で標準化された OAuth 2.0 の拡張である。RFC 7636 自身は公開クライアント向けの仕様である。その後、OAuth 2.1 は **Authorization Code Flow を使うすべてのクライアントで必須**とし、Security BCP (RFC 9700) は公開クライアントに必須 (MUST)、機密クライアントには推奨 (RECOMMENDED) と段階を分けている [RFC 7636] [RFC 9700] [IETF OAuth 2.1]。段階の差はあるが、新規実装で PKCE を外す理由はない。

#### 何を防ぐのか ― Authorization Code Interception 攻撃

OAuth 2.0 Authorization Code Flow には根本的な弱点があった。

```text
1. ブラウザ → IdP: 認可リクエスト
2. ユーザー承認
3. IdP → ブラウザ: ?code=ABC123 (URLパラメータ)
4. ブラウザ → クライアント (リダイレクト): code 渡す
5. クライアント → IdP: code + client_secret → access_token
```

ステップ3-4 でブラウザが受け取った `code` を、別のアプリ (マルウェア、悪意のあるブラウザ拡張) が**横取りできる**問題があった。特にモバイルアプリのカスタムURIスキーム (`myapp://callback?code=...`) では、別のアプリが同じスキームを登録しておけば横取り可能。

さらに **public client**(モバイル/SPA など、秘密鍵を保持できないクライアント) では `client_secret` が使えない。`code` だけで `access_token` に交換できてしまう。

#### PKCE の仕組み

クライアントが「動的な秘密」を作って、リクエストとトークン交換の両方でそれを照合する:

```text
1. クライアント: code_verifier をランダム生成 (43-128文字)
   code_verifier = "M25iVXpKU3puUjFaYWg3T1NDTDQtcW1ROUY5YXlwalNoc0hhakxifmZHag"

2. クライアント: code_challenge = BASE64URL(SHA256(code_verifier))
   code_challenge = "qjrzSW9gMiUgpUvqgEPE4_-8swvyCtfOVvg55o5S_es"

3. ブラウザ → IdP: 認可リクエストに code_challenge と code_challenge_method=S256 を含める

4. IdP: code_challenge を記憶しつつ、code を発行

5. クライアント → IdP: トークン交換時に code_verifier (生の値) を送る

6. IdP: SHA256(code_verifier) が記憶していた code_challenge と一致するか検証
   → 一致しなければ拒否
```

これにより、`code` を横取りした攻撃者がいても、**ハッシュ前の `code_verifier` を知らない限りトークン交換できない**。

#### 実装

```typescript
import { createHash, randomBytes } from 'node:crypto';

function generateCodeVerifier(): string {
  // RFC 7636: 43-128文字、unreserved characters
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ステップ1-3: 認可リクエスト
async function startOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');

  // verifier と state をセッションに保存(後でコールバックで使う)。
  // sessionStorage の値は同一オリジンのスクリプトから読めるため、XSS があれば
  // code_verifier も奪われ、PKCE の保護は失われる。BFF 構成 (13.4) では
  // verifier をブラウザへ置かず、サーバ側のセッションに保持する
  sessionStorage.setItem('pkce_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://idp.example.com/authorize?${params}`;
}

// ステップ5-6: コールバック → トークン交換
async function handleCallback(code: string, state: string) {
  // CSRF対策: state検証
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) throw new Error('Invalid state');

  const codeVerifier = sessionStorage.getItem('pkce_verifier');
  if (!codeVerifier) throw new Error('No PKCE verifier');

  // トークン交換(client_secret は不要、code_verifier で代替)
  const res = await fetch('https://idp.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('oauth_state');

  return res.json();  // { access_token, id_token, refresh_token, ... }
}
```

#### S256 vs plain

仕様上 `code_challenge_method` には `S256` と `plain` がある:

- **S256**: SHA256ハッシュ。**現代では必須**
- **plain**: ハッシュなし、`code_challenge = code_verifier`。レガシー互換用

`plain` は実質的に「PKCEなし」と同じセキュリティレベルなので、新規実装では使わない。RFC 7636 は `plain` も定義しているため、対応していること自体は仕様違反ではない。OAuth 2.1 と Security BCP は `S256` のみを受け付ける設定を求めている。

#### サーバ側 (IdP) の実装

ここから先は、**認可サーバ側が何を検証しているか**を読み解くための説明である。認可サーバを自作するための手順ではない。クライアントを実装する立場では、以下のコードは「相手が何を確かめているか」を知るために読めばよい。自作の是非については 13.13 も参照してほしい。

```typescript
// 認可エンドポイント: code_challenge を保存
app.get('/authorize', async (req, res) => {
  const { client_id, redirect_uri, code_challenge, code_challenge_method, state } = req.query;

  // redirect_uri は事前登録値との完全一致で照合する。照合を省くと、細工した認可URLを
  // 踏ませるだけで認可コードが攻撃者へ渡る (13.7)。照合前にリダイレクトしてはならず、
  // 不一致のときは自サイト上でエラーを表示する
  const client = await clients.findById(client_id);
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Unregistered redirect_uri' });
  }

  // code_challenge_method を省略したときの既定は plain である (RFC 7636 4.3)。
  // 「未指定なら検証しない」ではなく「S256 の明示がなければ拒否」にしないと、
  // パラメータを外すだけで PKCE を無効化できてしまう
  if (!code_challenge || code_challenge_method !== 'S256') {
    return res.status(400).json({ error: 'invalid_request', error_description: 'S256 code_challenge required' });
  }

  // ユーザー認証・承認後、コードを発行
  const code = randomBytes(32).toString('base64url');
  await redis.set(`oauth_code:${code}`, JSON.stringify({
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    userId: req.user.id,
  }), { EX: 60 });  // 1分有効

  // 文字列連結だと state に & や # が入ったときにパラメータを差し込まれる
  const location = new URL(redirect_uri);
  location.searchParams.set('code', code);
  if (typeof state === 'string') location.searchParams.set('state', state);
  res.redirect(location.toString());
});

// トークンエンドポイント: code_verifier を検証
app.post('/token', async (req, res) => {
  const { grant_type, code, code_verifier, client_id, redirect_uri } = req.body;
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const stored = await redis.get(`oauth_code:${code}`);
  if (!stored) return res.status(400).json({ error: 'invalid_grant' });
  await redis.del(`oauth_code:${code}`);  // 1回限り

  const data = JSON.parse(stored);
  if (data.client_id !== client_id || data.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }

  // PKCE 検証。code_challenge の有無で分岐すると、challenge を送らないだけで検証を飛ばせる。
  // /authorize 側で S256 を必須にしてあるので、ここでは無条件に検証する
  if (!code_verifier) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required' });
  }
  const computed = createHash('sha256').update(code_verifier).digest('base64url');
  if (computed !== data.code_challenge) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE mismatch' });
  }

  // アクセストークン発行
  const accessToken = await signAccessToken(data.userId);
  res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600 });
});
```

> **本番実装との差分**: このコードは PKCE の検証経路を示すための最小構成である。本番の認可サーバには、少なくとも `/token` でのクライアント認証 (client_secret_basic または private_key_jwt)、認可コードとクライアントの束縛および再利用検知、同意画面とスコープの検証、リフレッシュトークンの回転、監査ログが要る。認可サーバは自作せず、実績のある実装かマネージドサービスを使う。ここに載せたのは、既存の実装が何を検証しているかを読み解くための骨格である。

#### Confidential Client でも PKCE を使うべき

PKCE は「public client 専用」と誤解されがちだが、OAuth 2.1 [IETF OAuth 2.1] では**全てのクライアントで PKCE 必須**となっている。confidential client(client_secret を保持できるサーバ) でも、code 横取り攻撃のリスクはゼロではない。PKCE を追加するコストはほぼゼロなので、常に使うのが現代のベストプラクティス。

#### OAuth 2.1 の意義

OAuth 2.1 は「OAuth 2.0 のベストプラクティスを統合した整理版」だ:

- PKCE 必須化 (public/confidential 問わず)
- Implicit Flow 廃止 (セキュリティ上の問題)
- Resource Owner Password Credentials Flow 廃止
- リダイレクト URI の厳密な完全一致
- Bearer Token の URL クエリでの送信禁止

新規実装は OAuth 2.0 ではなく **OAuth 2.1 準拠**を目指すべき。Auth0、Okta、Microsoft Entra などの主要 IdP はすでに 2.1 のベストプラクティスをデフォルトで適用している。

<a id="section-13-21"></a>
### 13.21 MFA と TOTP ― 多要素認証の実装
<!-- handbook:learning {"level":"practical","minutes":30} -->
<!-- handbook:index {"group":"H","term":"HTOP"} -->
<!-- handbook:index {"group":"M","term":"MFA (Multi-Factor Authentication)"} -->
<!-- handbook:index {"group":"T","term":"TOTP (Time-based One-Time Password)"} -->
<!-- handbook:index {"group":"た行","term":"多要素認証 (MFA)"} -->

<!-- handbook:narrative-bridge {"section":"13.21"} -->
フィッシング耐性を高めても、重要操作を一つの認証要素だけで許可すると、その要素の侵害が直ちにアカウント侵害になる。MFAは異なる種類の証拠を組み合わせ、TOTPやリカバリ手順を含む運用全体で強度を作る。

「**何かを知っている (パスワード) + 何かを持っている (デバイス)**」の2要素を組み合わせるのが MFA (Multi-Factor Authentication)。パスワード単独より遥かに強い。

#### 認証要素の3分類

伝統的に3つに分類される:

1. **Knowledge factor (知識)**: パスワード、PIN、秘密の質問
2. **Possession factor (所有)**: スマートフォン、ハードウェアトークン、メール/SMS で届くコード
3. **Inherence factor (本人)**: 指紋、顔、声 (バイオメトリクス)

これらのうち**2つ以上**を要求するのが MFA。同じ分類内の2つ (パスワード + PIN) は MFA とは呼ばない。

#### MFA の選択肢と強度

| 方式 | 強度 | UX | コメント |
|---|---|---|---|
| SMS OTP | 低 | 中 | SIM スワッピング攻撃に弱い。米NIST は非推奨だが普及度高 |
| メール OTP | 低〜中 | 中 | メール侵害があれば突破される |
| TOTP (アプリ) | 中 | 中 | Google Authenticator、Authy。最も普及 |
| Push 通知 | 中〜高 | 高 | プッシュ承認 (Duo、Okta Verify) |
| ハードウェアキー | 高 | 中 | YubiKey、Titan。フィッシング耐性 |
| パスキー (13.9) | 最高 | 高 | 単独で MFA 相当 (所有 + 本人) |

「**新規実装ならパスキー第一、TOTP は補完**」が2026年の指針。SMS は後方互換でしか使わない。

#### TOTP の仕組み

**TOTP (Time-based One-Time Password)** は RFC 6238 で標準化された OTP アルゴリズム [RFC 6238]。

```text
1. 登録時:
   サーバとクライアント(認証アプリ)で共通のシード(秘密鍵) を共有
   QRコードで秘密鍵を渡すのが一般的

2. 認証時:
   サーバとクライアントが「現在時刻」と「秘密鍵」から
   同じアルゴリズムで6桁のコードを生成
   通常30秒ごとに新しいコードに更新
```

数式:

```text
T = floor((現在のUnix時間 - T0) / X)
  ※ T0 = 0、X = 30秒 がデフォルト
TOTP = HOTP(秘密鍵, T)
  ※ HOTP は HMAC-SHA1 ベースのアルゴリズム (RFC 4226)
6桁の数値に変換
```

時計ズレ問題があるため、サーバは「前後1分」程度を許容する実装が一般的。

#### TOTP の実装

```typescript
import { createHmac, randomBytes } from 'node:crypto';
import { base32encode, base32decode } from './base32';  // 別途実装または npm: thirty-two

// 秘密鍵の生成と URI 化
function generateTotpSecret(): { secret: string; otpauthUrl: (label: string, issuer: string) => string } {
  const buf = randomBytes(20);  // 160ビット推奨 (RFC 4226)
  const secret = base32encode(buf).replace(/=/g, '');  // Base32、パディング無し

  return {
    secret,
    otpauthUrl: (label, issuer) =>
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
  };
}

// HOTP 計算 (RFC 4226)
function hotp(secret: Buffer, counter: bigint): string {
  // カウンタを 8 バイト big-endian に
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  // HMAC-SHA1
  const hmac = createHmac('sha1', secret).update(counterBuf).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  // 6桁に
  return (binary % 1_000_000).toString().padStart(6, '0');
}

// TOTP = 時刻ベースの HOTP
function totp(secretBase32: string, time = Date.now()): string {
  const secret = base32decode(secretBase32);
  const counter = BigInt(Math.floor(time / 1000 / 30));
  return hotp(secret, counter);
}

// 検証 (時計ズレ ±1 ステップ許容)
function verifyTotp(secretBase32: string, code: string, time = Date.now()): boolean {
  const counter = BigInt(Math.floor(time / 1000 / 30));
  const secret = base32decode(secretBase32);

  for (const offset of [0n, -1n, 1n]) {
    if (hotp(secret, counter + offset) === code) return true;
  }
  return false;
}
```

#### サインアップフロー (QRコードで秘密鍵を渡す)

```typescript
import QRCode from 'qrcode';

// 1. TOTP 設定開始
app.post('/account/mfa/totp/setup', authenticate, async (req, res) => {
  const { secret, otpauthUrl } = generateTotpSecret();
  // まだ DB には保存しない。検証成功してから保存
  await redis.set(`totp_pending:${req.user.id}`, secret, { EX: 600 });

  const qrDataUrl = await QRCode.toDataURL(
    otpauthUrl(req.user.email, 'MyApp'),
  );
  res.json({ qrCode: qrDataUrl, secret });  // secret はバックアップ表示用
});

// 2. ユーザーがアプリで設定 → 6桁コードで確認
app.post('/account/mfa/totp/verify', authenticate, async (req, res) => {
  const pending = await redis.get(`totp_pending:${req.user.id}`);
  if (!pending) return res.status(400).json({ error: 'No pending setup' });

  if (!verifyTotp(pending, req.body.code)) {
    return res.status(400).json({ error: 'Invalid code' });
  }

  // 検証 OK → DB に保存
  await db.user.update({
    where: { id: req.user.id },
    data: { totpSecret: encrypt(pending) },  // 暗号化して保存
  });
  await redis.del(`totp_pending:${req.user.id}`);

  // バックアップコードも生成
  const backupCodes = Array.from({ length: 10 }, () => randomBytes(6).toString('hex'));
  await db.backupCode.createMany({
    data: backupCodes.map((code) => ({ userId: req.user.id, codeHash: hash(code) })),
  });

  res.json({ backupCodes });
});

// 3. ログイン時の MFA チェック
app.post('/login/mfa', async (req, res) => {
  const session = await redis.get(`mfa_pending:${req.body.sessionId}`);
  if (!session) return res.status(401).end();

  const user = await db.user.findUnique({ where: { id: JSON.parse(session).userId } });
  if (!user?.totpSecret) return res.status(400).end();

  const secret = decrypt(user.totpSecret);
  if (!verifyTotp(secret, req.body.code)) {
    // バックアップコードでも試す
    const valid = await tryBackupCode(user.id, req.body.code);
    if (!valid) return res.status(401).json({ error: 'Invalid code' });
  }

  // セッション昇格(MFA 完了状態に)
  req.session.userId = user.id;
  req.session.mfaCompleted = true;
  await redis.del(`mfa_pending:${req.body.sessionId}`);
  res.json({ ok: true });
});
```

#### バックアップコード

スマホを紛失したらユーザーがロックアウトされる。バックアップコード (使い捨ての10個程度のコード) を発行しておくのが定石。

- 生成時に1度だけ平文表示、以後はハッシュのみ保存
- 1コード = 1回利用、使用後は削除
- 残数が少なくなったら警告

#### Recovery Code Resilience

MFA を有効化しているユーザーが「スマホ壊れた、バックアップコードもなくした」となる事態への備え:

- 別のメールでの本人確認
- 過去のログイン IP/デバイス情報による本人確認
- カスタマーサポートでの身元確認 (KYC)

これらの「MFA リセット手順」自体が攻撃面になりやすいので、慎重に設計する。**MFA リセット = MFA を実質バイパス**できる経路なので、リセット自体に高い検証ハードルを設ける。

#### MFA は誰に必須にすべきか

組織で MFA を導入する際の段階的な戦略:

1. **管理者 (admin、staff) は MFA 必須**
2. **支払い情報を持つユーザーには MFA 推奨**
3. **新規登録時に MFA 設定を促す** (オンボーディング)
4. **重要操作のたびに再認証** (Step-up Auth、後述)

「全ユーザー強制」は離脱率を上げるリスクがあるため、リスクに応じた段階適用が現実解。

#### Step-up Authentication

「**通常はパスワードだけ、重要操作のときだけ MFA を追加要求**」する設計。

```typescript
async function transferMoney(req: Request) {
  // 通常のセッション認証は通過済み
  if (!req.session.mfaRecentlyVerified) {
    return { needsStepUp: true, action: 'transfer_money' };
  }
  // 重要操作実行
  await executeTransfer(req.body);
}

// MFA 確認エンドポイント
app.post('/account/verify-mfa', authenticate, async (req, res) => {
  const valid = verifyTotp(decrypt(req.user.totpSecret), req.body.code);
  if (!valid) return res.status(401).end();

  // 直近5分間は Step-up 不要。タイマーで消すのではなく時刻を保存し、
  // 判定側で経過時間を見る (リクエスト終了後の参照書き換えはストアへ反映されない)
  req.session.mfaVerifiedAt = Date.now();

  res.json({ ok: true });
});
```

OIDC で `acr_values=urn:mace:incommon:iap:silver` などの **Authentication Context** を要求する標準的な手段もある。

<a id="section-13-22"></a>
### 13.22 DPoP と mTLS ― 送信者制約トークン
<!-- handbook:learning {"level":"advanced","minutes":35} -->
<!-- handbook:index {"group":"D","term":"DPoP (Demonstrating Proof of Possession)"} -->
<!-- handbook:index {"group":"F","term":"FAPI (Financial-grade API)"} -->
<!-- handbook:index {"group":"M","term":"mTLS (Mutual TLS)"} -->
<!-- handbook:index {"group":"さ行","term":"送信者制約 (DPoP/mTLS)"} -->
<!-- handbook:index {"group":"あ行","term":"送信者制約トークン"} -->

<!-- handbook:narrative-bridge {"section":"13.22"} -->
多要素で発行時の本人性を高めても、Bearer Tokenは入手した者がそのまま使用できる。DPoPとmTLSはトークンをクライアントの鍵または証明書へ結び付け、盗難後の再利用を制限する。

Bearer Token (OAuth 2.0、JWT) の根本的弱点は「**持っていれば誰でも使える**」こと。漏洩=即終了。これを改善するのが **送信者制約トークン (Sender-Constrained Token)**。トークンを発行された当人だけが使えるようにする。代表的な2つを扱う。

#### DPoP (Demonstrating Proof-of-Possession)

DPoP は RFC 9449 で標準化された比較的新しい仕組み [RFC 9449]。各リクエストに「**クライアントの秘密鍵で署名した JWT**」を添付することで、「自分が確かにこのトークンの発行先である」ことを証明する。

```text
1. クライアント: 鍵ペアをローカル生成 (例: ECDSA P-256)
   秘密鍵はブラウザの IndexedDB やネイティブのキーチェーンに保存

2. クライアント → IdP: トークン要求時に DPoP-Proof JWT を添付
   Authorization Code Flow + PKCE + DPoP

3. IdP: アクセストークンに「この公開鍵に紐付ける」情報を埋め込む
   (JWT なら cnf クレーム = "confirmation")
   access_token: { ..., cnf: { jkt: <hash of public key> } }

4. クライアント → リソースサーバ: API リクエストごとに新しい DPoP JWT を生成
   ヘッダ:
     Authorization: DPoP <access_token>
     DPoP: <signed JWT containing HTTP method, URL, timestamp, jti>

5. リソースサーバ:
   - access_token を検証
   - DPoP JWT を公開鍵で検証
   - access_token の cnf.jkt と DPoP の公開鍵が一致するか確認
   - HTTP メソッド・URL が一致するか確認
   - jti のリプレイ防止(短期間内に同じ jti は拒否)
```

これで「**access_token を漏洩しても、対応する秘密鍵がなければ使えない**」状態になる。

#### DPoP-Proof JWT の構造

```json
{
  "typ": "dpop+jwt",
  "alg": "ES256",
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "...",
    "y": "..."
  }
}
.
{
  "jti": "ランダムな一意ID",
  "htm": "GET",
  "htu": "https://api.example.com/resource",
  "iat": 1716212345,
  "ath": "ハッシュ(access_token)"  // バインディング強化
}
.
署名
```

#### クライアント側の実装

```typescript
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { createHash } from 'node:crypto';

// 鍵ペアを1度だけ生成、IndexedDB等に保存
let dpopKey: { privateKey: CryptoKey; publicJwk: JsonWebKey } | null = null;

async function getDpopKey() {
  if (dpopKey) return dpopKey;
  const stored = await idb.get('dpop-key');
  if (stored) {
    dpopKey = stored;
    return dpopKey;
  }
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  dpopKey = { privateKey, publicJwk };
  await idb.set('dpop-key', dpopKey);
  return dpopKey;
}

async function createDpopProof(method: string, url: string, accessToken?: string): Promise<string> {
  const { privateKey, publicJwk } = await getDpopKey();

  const payload: any = {
    jti: crypto.randomUUID(),
    htm: method.toUpperCase(),
    htu: url,
    iat: Math.floor(Date.now() / 1000),
  };

  // access_token をリクエストに含む場合、そのハッシュも入れる
  if (accessToken) {
    const hash = createHash('sha256').update(accessToken).digest();
    payload.ath = Buffer.from(hash).toString('base64url');
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: publicJwk })
    .sign(privateKey);
}

// API 呼び出し
async function fetchWithDpop(url: string, options: RequestInit = {}) {
  const accessToken = getStoredAccessToken();
  const dpopProof = await createDpopProof(options.method ?? 'GET', url, accessToken);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `DPoP ${accessToken}`,
      DPoP: dpopProof,
    },
  });
}
```

#### リソースサーバ側の検証

```typescript
import { jwtVerify, decodeJwt, importJWK, calculateJwkThumbprint } from 'jose';

async function validateDpop(req: Request, accessToken: string): Promise<boolean> {
  const dpopHeader = req.headers.get('dpop');
  if (!dpopHeader) return false;

  // 1. DPoP JWT のヘッダから公開鍵を取得
  const { jwk } = JSON.parse(
    Buffer.from(dpopHeader.split('.')[0], 'base64url').toString('utf8'),
  );
  const publicKey = await importJWK(jwk, 'ES256');

  // 2. 署名を検証
  const { payload } = await jwtVerify(dpopHeader, publicKey, {
    typ: 'dpop+jwt',
    maxTokenAge: '60s',  // タイムスタンプは1分以内
  });

  // 3. HTTPメソッド・URL の一致確認
  const requestUrl = `${req.protocol}://${req.get('host')}${req.path}`;
  if (payload.htm !== req.method || payload.htu !== requestUrl) return false;

  // 4. access_token の cnf.jkt とこの公開鍵の thumbprint が一致するか
  const accessPayload = decodeJwt(accessToken);
  const expectedThumbprint = (accessPayload.cnf as any)?.jkt;
  const actualThumbprint = await calculateJwkThumbprint(jwk);
  if (expectedThumbprint !== actualThumbprint) return false;

  // 5. jti リプレイ防止(Redis でデデュープ)
  const jtiKey = `dpop_jti:${payload.jti}`;
  const seen = await redis.set(jtiKey, '1', { NX: true, EX: 300 });
  if (!seen) return false;  // 過去5分以内に使用済み

  return true;
}
```

#### mTLS (Mutual TLS) によるクライアント認証

DPoP と並ぶ送信者制約の手法が **mTLS**。TLS のクライアント証明書を使って「**通信路レベル**」で送信者を制約する。

通常のTLS:
```text
クライアント ← サーバ証明書 ← サーバ
(サーバの本人確認のみ)
```

mTLS:
```text
クライアント ⇄ 互いに証明書を提示 ⇄ サーバ
(双方の本人確認)
```

OAuth 2.0 への適用は RFC 8705 で標準化されている [RFC 8705]:

```text
1. クライアント証明書を IdP に事前登録 (または OAuth Client 設定で公開鍵を登録)

2. クライアント → IdP: トークン要求 (mTLS 接続)
   IdP がクライアント証明書を検証

3. IdP: access_token に cnf.x5t#S256 (証明書のハッシュ) を埋め込む

4. クライアント → リソースサーバ: mTLS 接続で API 呼び出し
   リソースサーバが access_token の cnf と接続中の証明書を照合
```

#### mTLS の実装 (Node.js + Express)

```typescript
import https from 'node:https';
import { readFileSync } from 'node:fs';
import express from 'express';

const app = express();

const server = https.createServer(
  {
    key: readFileSync('server.key'),
    cert: readFileSync('server.crt'),
    ca: readFileSync('ca-bundle.crt'),  // 信頼するCA
    requestCert: true,  // クライアント証明書を要求
    // この行はピア証明書の検証を無効にする。**下の手動検証とセットでのみ成立する。**
    // 手動検証を書かないままこの設定だけを持ち込むと、任意の証明書を受け入れる、
    // つまり中間者攻撃に無防備な状態になる。通常は ca を渡して既定 (true) のままにする
    rejectUnauthorized: false,
  },
  app,
);

app.use((req, res, next) => {
  const cert = (req as any).socket.getPeerCertificate();
  if (!cert || !Object.keys(cert).length) {
    return res.status(401).json({ error: 'Client certificate required' });
  }

  // 証明書のフィンガープリント
  (req as any).clientCert = {
    subject: cert.subject,
    fingerprint: cert.fingerprint256,  // SHA-256
  };
  next();
});

app.get('/api/resource', async (req, res) => {
  const accessToken = req.headers.authorization?.replace('Bearer ', '');
  if (!accessToken) return res.status(401).end();

  const payload = await verifyAccessToken(accessToken);

  // cnf.x5t#S256 = 証明書 SHA-256 ハッシュの Base64URL
  const expectedCertHash = (payload.cnf as any)?.['x5t#S256'];
  const actualHash = (req as any).clientCert.fingerprint.replace(/:/g, '');
  const actualHashB64 = Buffer.from(actualHash, 'hex').toString('base64url');

  if (expectedCertHash !== actualHashB64) {
    return res.status(401).json({ error: 'Certificate binding mismatch' });
  }

  // 検証OK
  res.json({ data: 'secret stuff' });
});

server.listen(3000);
```

#### DPoP vs mTLS の使い分け

| | DPoP | mTLS |
|---|---|---|
| 鍵管理 | アプリケーションレベル | OS / インフラレベル |
| 実装場所 | アプリコード | TLS 終端 (LB/nginx) |
| ブラウザ対応 | ◯(IndexedDB に鍵保存) | △(クライアント証明書のUXが悪い) |
| モバイル対応 | ◯(Secure Enclave/Keystore) | ◯(端末プロビジョニング次第) |
| 適合用途 | SPA、モバイル、SaaS | サーバ間通信、金融API、政府系 |
| デバッグ容易性 | 中 | 低 |
| 仕様の新しさ | 新 (2023年、RFC 9449) | 古 (TLS 1.0 から存在) |

**実務的指針:**

- **コンシューマー向け SPA / モバイル**: DPoP(ブラウザに優しい)
- **金融・医療・政府の API**: mTLS(コンプライアンス要件)
- **マイクロサービス間**: mTLS(Service Mesh で自動化、後述)
- **公共 API、サードパーティ開発者向け**: Bearer Token + PKCE(導入ハードル低)

#### FAPI (Financial-grade API)

OpenID Foundation が定める「金融機関向けの強化された OAuth/OIDC プロファイル」が **FAPI** [OpenID FAPI, 2021]。PKCE 必須、mTLS または DPoP 必須、署名済みリクエストオブジェクト、Pushed Authorization Requests (PAR) などを組み合わせる。日本・英国・オーストラリアのオープンバンキング規制で採用されている。

<a id="section-13-23"></a>
### 13.23 JWS / JWE / JWA ― JWT の構成要素
<!-- handbook:learning {"level":"advanced","minutes":25} -->
<!-- handbook:index {"group":"J","term":"JWA (JSON Web Algorithms)"} -->
<!-- handbook:index {"group":"J","term":"JWE (JSON Web Encryption)"} -->
<!-- handbook:index {"group":"J","term":"JWK (JSON Web Key)"} -->
<!-- handbook:index {"group":"J","term":"JWS (JSON Web Signature)"} -->

<!-- handbook:narrative-bridge {"section":"13.23"} -->
JWTという名前の下には、署名、暗号化、利用可能アルゴリズム、鍵表現という別々の仕様が重なっている。JWS、JWE、JWA、JWKを分けて理解し、署名済みと暗号化済みを混同しないための地図を作る。

13.4 で JWT を扱った際、内部の分類には触れなかった。JWT は実は「**3つの仕様の組み合わせ**」だ:

- **JWS (JSON Web Signature) [RFC 7515]**: 署名つきトークン
- **JWE (JSON Web Encryption) [RFC 7516]**: 暗号化トークン
- **JWA (JSON Web Algorithms) [RFC 7518]**: 使えるアルゴリズムの定義
- **JWK (JSON Web Key) [RFC 7517]**: 鍵のJSON表現
- **JWT (JSON Web Token) [RFC 7519]**: 上記を使った認証トークンのプロファイル

「JWT」と呼んでいるものの大半は実は **JWS の特殊例**(署名つき、ペイロードがクレームの JSON) だ。

#### JWS ― 実務で単に「JWT」と呼ばれているもの

```text
[Header].[Payload].[Signature]
```

- Header: アルゴリズム (`alg`)、トークンタイプ (`typ`)
- Payload: 任意の JSON(クレーム)
- Signature: HMAC または公開鍵署名

Base64URL でエンコードされ、ドットで連結される。ペイロードは**読める**(暗号化されていない)。

```typescript
import { SignJWT, jwtVerify } from 'jose';

// 署名 (JWS = 普通の JWT)
const signedJwt = await new SignJWT({ userId: '42' })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(SECRET));

// 中身は誰でも見える
console.log(decodeJwtPayload(signedJwt));  // { userId: '42', exp: ... }
```

#### JWE ― 暗号化トークン

JWS が「**改ざんを防ぐ**」のに対し、JWE は「**内容を秘匿する**」。ペイロードを暗号化するため、トークンを目視しても中身は見えない。

```text
[Header].[EncryptedKey].[IV].[Ciphertext].[AuthTag]
```

5パートに増える。鍵管理 (JWE は対称鍵を非対称鍵で暗号化する2段構成) が複雑になる。

```typescript
import { EncryptJWT, jwtDecrypt, generateKeyPair, exportJWK } from 'jose';

// 暗号化
const encryptedJwt = await new EncryptJWT({ sensitive: 'data' })
  .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
  .setExpirationTime('1h')
  .encrypt(publicKey);

// 復号
const { payload } = await jwtDecrypt(encryptedJwt, privateKey);
```

`alg` は鍵交換アルゴリズム、`enc` は実際のコンテンツ暗号化アルゴリズム。

#### JWE が必要なケース

JWS で十分なケースが大半だが、以下では JWE が必要:

- **トークン内に PII (個人情報) を含む**: メール、電話番号、社員ID 等
- **トークン内に医療情報、金融情報**: HIPAA、PCI DSS 等の規制
- **トークン内に内部識別子**: 漏洩すると攻撃のヒントになる ID

ただし「JWE する前に、そもそもそんな情報を JWT に入れない」のが原則。**Opaque Token (ランダム文字列) + サーバサイドのセッションストア**で済むなら、それが最もシンプル。

#### JWA ― 使えるアルゴリズムカタログ

JWA で定義される `alg` 値の例:

**JWS 用 (署名):**

- `HS256`、`HS384`、`HS512`: HMAC-SHA-2 (対称鍵)
- `RS256`、`RS384`、`RS512`: RSA-PKCS1-v1.5
- `PS256`、`PS384`、`PS512`: RSA-PSS
- `ES256`、`ES384`、`ES512`: ECDSA (P-256、P-384、P-521)
- `EdDSA`: Ed25519、Ed448
- `none`: 署名なし (**絶対に使うな**、後述)

**JWE 用 (鍵交換):**

- `RSA-OAEP-256`、`RSA-OAEP`: RSA OAEP
- `ECDH-ES`、`ECDH-ES+A256KW`: 楕円曲線 Diffie-Hellman
- `A256KW`、`A256GCMKW`: AES Key Wrap

**JWE 用 (コンテンツ暗号):**

- `A128GCM`、`A192GCM`、`A256GCM`: AES-GCM
- `A128CBC-HS256`、`A256CBC-HS512`: AES-CBC + HMAC

#### `alg: none` 脆弱性 ― JWT の歴史的最大事故

JWT 仕様には「署名なし」を表す `alg: none` がある。「**Header の alg を見て検証アルゴリズムを決める**」素朴な実装をすると:

```typescript
// 脆弱な実装
function verifyJwt(token: string) {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  // ↓ ここが問題: クライアントが alg を指定できる
  if (header.alg === 'none') {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString());  // 検証スキップ
  }
  // ... 通常の検証
}
```

攻撃者が `{"alg":"none"}` をヘッダにした JWT を作れば、署名なしで通過する。2015年に主要ライブラリで相次いで報告された事故である [McLean, 2015]。

**対策:**

```typescript
import { jwtVerify } from 'jose';

// 期待するアルゴリズムを明示的に指定
const { payload } = await jwtVerify(token, secret, {
  algorithms: ['HS256'],  // ← これ以外は受け入れない
});
```

すべての JWT ライブラリで「期待する `alg` をホワイトリスト指定」が必須。デフォルトでは何も受け入れない設計のライブラリ (jose 等) を選ぶ。

#### Confused Deputy 攻撃 ― `alg` 切り替え

別パターンの攻撃: サーバが HS256 と RS256 の両方を受け入れる場合、攻撃者は「公開鍵を HMAC の秘密鍵として使う」JWT を作れる。

```text
本来:
  検証: RSA公開鍵で署名検証
  
攻撃:
  攻撃者の手順:
  1. サーバの RSA 公開鍵を入手 (公開されている)
  2. それを HMAC-SHA256 の秘密鍵として使って JWT 署名
  3. header.alg を "HS256" に変更して送る
  
  サーバ側の問題:
  - "HS256" だと判断
  - HMAC 用の秘密鍵として何を使う? → "RSA 公開鍵を使う" 実装になっていると突破
```

これも `algorithms: ['RS256']` で明示すれば防げる。

#### JWK ― 鍵の標準JSON表現

```json
{
  "kty": "EC",
  "crv": "P-256",
  "x": "...",
  "y": "...",
  "kid": "key-2026-05",
  "use": "sig",
  "alg": "ES256"
}
```

JWKS (JSON Web Key Set) はこれの配列。13.15 で扱った。

#### まとめ ― JWT 関連仕様の地図

```text
JWT (使い方の仕様)
 └─ JWS (署名つき) ← 普段の「JWT」はこれ
 └─ JWE (暗号化) ← 機密データを含む時のみ
 
JWA (使えるアルゴリズム)
 └─ HS256、RS256、ES256、EdDSA など

JWK (鍵のJSON表現)
 └─ JWKS = JWK の集まり、公開鍵配布で使う
```

JWT を「ただのトークン形式」と思っていたかもしれないが、実は5つの RFC にまたがる仕様群だ。各部品の役割を理解すると、ライブラリの API も読みやすくなる。

<a id="section-13-24"></a>
### 13.24 マルチテナントの認可とテナント境界
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"た行","term":"テナント境界"} -->
<!-- handbook:index {"group":"た行","term":"テナントコンテキスト"} -->
<!-- handbook:index {"group":"ま行","term":"マルチテナント認可"} -->
<!-- handbook:index {"group":"I","term":"Impersonation (代理ログイン)"} -->

<!-- handbook:narrative-bridge {"section":"13.24"} -->
13.10 と 13.11 では「この主体はこの操作をしてよいか」を判定する仕組みを整えた。しかし複数の顧客企業が同じアプリケーションを共有するSaaSでは、その判定の前にもう一つの次元がある。対象データがそもそも要求元の顧客のものかという問いであり、ここが破れると権限設計の正しさは意味を失う。本節では、その境界をどこで定義し、どの経路から破れるかを扱う。

SaaSでは、1つのアプリケーションと1つのデータベースを複数の顧客企業が共有する。顧客企業に相当する単位を**テナント** (tenant) と呼ぶ。本書のSaaS題材 (第30章) では組織 (Organization) がテナントにあたる。

RBACの設計が正しくても、テナント境界が破れれば「別会社の従業員が、正しいロールで、他社のデータを操作できる」状態になる。ロール判定は成功しているため、認可ログを見ても異常に見えない。これがテナント境界の事故が発見されにくい理由である。

#### テナント識別子をどこから受け取るか

最初の判断は、リクエストのどの部分をテナントの根拠にするかである。選択肢によって信頼度が変わる。

| 入手経路 | 例 | 改ざん可能性 | 用途 |
|---|---|---|---|
| サブドメイン | `acme.example.com` | 誰でも指定できる | 画面の切り替え、ログインヒント |
| パスパラメータ | `/orgs/acme/tasks` | 誰でも指定できる | ルーティング、リンクの共有 |
| リクエストボディ | `{"orgId": "..."}` | 誰でも指定できる | 使わない |
| セッション/トークンのクレーム | `org_id` クレーム | サーバが署名済み | 認可判定の入力 |
| サーバ側の所属テーブル | `memberships` | 改ざん不可 | 最終的な根拠 |

原則は次の2つになる。

1. URLやボディに現れるテナント識別子は**要求 (request)** であって根拠ではない。
2. 認可の根拠は、認証済み主体と要求されたテナントの組み合わせが所属テーブルに存在することである。

トークンに `org_id` を埋め込む設計は便利だが、所属の取り消しがトークンの有効期限まで反映されない。13.5 のリフレッシュトークンと同じ問題であり、退職や契約解除の反映が遅れて困る場合は、所属だけは毎リクエストで参照するか、13.17 のイベント通知で失効させる。

#### 3段階の判定に分ける

テナント境界の判定は、認証・所属・権限の3段階に分けると、どこで落ちたかが説明できるようになる。

```text
リクエスト
  │
  ├─ (1) 認証: このリクエストの主体は誰か        → 失敗なら 401
  │
  ├─ (2) 所属: その主体は要求テナントの一員か    → 失敗なら 404 (または 403)
  │
  └─ (3) 権限: その一員はこの操作をしてよいか    → 失敗なら 403
        └─ 対象資源が要求テナントに属するかの検査を含む
```

(2) を 403 で返すか 404 で返すかは、テナント識別子が推測可能かどうかで決める。`acme` のような組織スラグは推測できるため、403 を返すと「Acme社がこのサービスを使っている」という事実が外部へ漏れる。存在自体を秘密にしたい場合は 404 を返す。逆に、自社の管理者が権限不足に気づけないと問い合わせが増えるため、社内向け機能では 403 と理由を返すほうが運用しやすい。どちらを選んでも、選んだ理由を書き残す。

#### テナント境界が破れる典型経路

事故の大半は、認可モデルの選択ミスではなく、境界を通らない経路が1つ残ったことで起きる。

| 経路 | 症状 | 対策 |
|---|---|---|
| 主キー直接参照 | `GET /tasks/:id` が所有者を検査しない | 資源の取得を必ずテナント条件つきで行う (23.7 のIDOR) |
| 親の付け替え | タスクを他テナントのプロジェクトへ移動できる | 移動先資源にも同じ検査を適用する |
| 検索経路 | 全文検索やベクトル検索が索引を先に引き、フィルタが後段 | 索引にテナント識別子を持たせ、検索条件に含める (16.5) |
| 集計・レポート | 一覧APIは絞るが、集計クエリが全テーブルを走る | 集計もテナント条件つきのビューを経由する |
| キャッシュ | キャッシュキーにテナント識別子がない | 鍵の生成をテナント込みの1関数へ集約する (24.5) |
| 非同期処理 | ジョブやWebhook処理でテナント文脈が失われる | ジョブのペイロードにテナント識別子を必須項目として持たせる (17.6) |
| 管理・運用経路 | 管理画面、CSVエクスポート、サポートツールが例外扱い | 同じ認可層を通し、越境は明示的な昇格として記録する |
| エラーと採番 | 連番IDや一意制約違反から他テナントの存在を推測できる | 識別子を推測不能にし、衝突検査をテナント内に閉じる |

このうち「主キー直接参照」と「親の付け替え」は、1つのリポジトリ関数に検査を集めても防げない。取得と更新で別の関数を通るためである。

```typescript
// 危険: 対象タスクは検査しているが、移動先プロジェクトを検査していない
async function moveTask(ctx: TenantContext, taskId: string, toProjectId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, project: { orgId: ctx.orgId } },   // ここは正しい
  });
  if (!task) throw new NotFoundError();
  // 移動先が他テナントのプロジェクトでも通ってしまう。
  // 実行後、このタスクは他テナントから見えるようになる。
  return db.task.update({ where: { id: taskId }, data: { projectId: toProjectId } });
}
```

書き込みでは、**入力に現れるすべての資源識別子**が検査対象になる。関係を張り替える操作 (移動、割り当て、親子付け替え、共有) は、この漏れが起きやすい。

#### テナント文脈を型で強制する

検査の書き忘れを人の注意力で防ぐのは難しい。データアクセス層の入口を1つに絞り、テナント文脈なしでは呼べない形にすると、漏れがコンパイル時か起動時に現れる。

```typescript
// テナント識別子を裸の string と混同させないための branded type
declare const brand: unique symbol;
export type TenantId = string & { readonly [brand]: 'TenantId' };

export type TenantScope = {
  readonly tenantId: TenantId;
  /** 所属の確認が済んでいることを示す。生成できるのは authorize() だけ。 */
  readonly verified: true;
};

/** 所属テーブルを引いた場合にだけ TenantScope を作れる。 */
export async function authorize(userId: string, requested: string): Promise<TenantScope> {
  const membership = await db.membership.findUnique({
    where: { userId_orgId: { userId, orgId: requested } },
  });
  if (!membership) throw new NotFoundError('organization not found');
  return { tenantId: requested as TenantId, verified: true };
}

/** リポジトリは TenantScope を必須引数にする。省略は型エラーになる。 */
export class TaskRepository {
  async findById(scope: TenantScope, id: string) {
    return db.task.findFirst({ where: { id, project: { orgId: scope.tenantId } } });
  }
  async move(scope: TenantScope, id: string, toProjectId: string) {
    const [task, project] = await Promise.all([
      this.findById(scope, id),
      db.project.findFirst({ where: { id: toProjectId, orgId: scope.tenantId } }),
    ]);
    if (!task || !project) throw new NotFoundError();
    return db.task.update({ where: { id }, data: { projectId: project.id } });
  }
}
```

この形の利点は、新しいクエリを書く人が「テナント条件を思い出す」必要がない点にある。引数を埋めないとコンパイルが通らないため、思い出す作業が型検査へ移る。

暗黙の文脈 (Node.js の `AsyncLocalStorage`、スレッドローカル変数) でテナント識別子を運ぶ設計もある。引数が減って読みやすいが、文脈が設定されていない経路 (起動時の初期化、キュー処理、テストコード) で静かに `undefined` になりうる。暗黙の文脈を使う場合は、未設定時にデフォルト値へフォールバックせず例外にする。

#### 正当な越境をどう扱うか

境界を絶対に越えられない設計は、実際には運用が回らない。次の3つは越境が必要になる。

- **サポートによる代理ログイン (impersonation)**: 顧客の画面を再現して問題を調べる。
- **テナント間共有**: 親会社と子会社、あるいは取引先とのプロジェクト共有。
- **横断的な運用処理**: 課金の締め、利用統計、法令に基づく開示。

いずれも「例外的にフィルタを外す」実装にしてはならない。越境そのものを1つの権限として表現し、記録を残す。

```typescript
type Elevation = {
  actorId: string;          // 越境した運用者
  tenantId: TenantId;       // 対象テナント
  reason: string;           // チケット番号など、後から検証できる根拠
  approvedBy: string;       // 承認者 (自己承認を許さない)
  expiresAt: Date;          // 期限つき。既定は短く保つ
};

export async function elevate(request: Elevation): Promise<TenantScope> {
  if (request.approvedBy === request.actorId) throw new ForbiddenError('self-approval');
  await auditLog.write({ type: 'tenant.elevation.granted', ...request });
  return { tenantId: request.tenantId, verified: true };
}
```

代理ログイン中は、UIに常時表示を出す、書き込みを禁止する、監査イベントに `impersonatedBy` を付けるといった運用上の制約を併せて決める。28.14 で扱う規制対応では、この記録の有無が説明責任の分かれ目になる。

#### アプリケーションの外側にもう一枚置く

ここまでの対策はすべてアプリケーションコードの中にある。コードは変更され、新しい経路が増え、いつか1か所が抜ける。データベース側にも同じ境界を宣言しておくと、抜けた経路が漏洩ではなく0行の結果として現れる。PostgreSQLのRow-Level Securityがその手段であり、ポリシーの書き方、所有者バイパス、接続プールとの相性は 14.20 で扱う。

アプリケーション側の検査とデータベース側のポリシーは、どちらか一方で足りるものではない。アプリケーション側だけでは経路の追加に弱く、データベース側だけでは「見えないから0件」と「本当に0件」を区別できずデバッグが難しくなる。役割は、前者が意味のある応答を返すこと、後者が最悪の場合の被害を止めることである。

#### つまずく箇所 ― テナント境界

- **一覧APIだけを点検して安心する**: 事故は詳細取得、更新、検索、集計、エクスポート、非同期処理から起きる。点検対象はエンドポイントではなく、データへ到達する経路の集合である。
- **テストが単一テナントで書かれている**: テナントAのデータしか存在しないテスト環境では、境界の抜けは絶対に検出できない。すべての結合テストに、少なくとも2つのテナントと、互いの資源を指す識別子を用意する。
- **`404` と `403` を場当たりで選ぶ**: 同じ製品の中で混在すると、応答の差そのものが情報になる。テナント存在の秘匿方針を先に決め、全エンドポイントで揃える。
- **ロール検査で満足する**: `role === 'ADMIN'` はテナント内の権限であって、どのテナントの管理者かを含まない。ロールを見る前にテナント文脈を確定させる。

<a id="section-13-25"></a>
### 13.25 認証エンドポイントの濫用 ― Credential Stuffing とアカウント列挙
<!-- handbook:learning {"level":"practical","minutes":25} -->
<!-- handbook:index {"group":"C","term":"Credential Stuffing"} -->
<!-- handbook:index {"group":"は行","term":"パスワードスプレー"} -->
<!-- handbook:index {"group":"あ行","term":"アカウント列挙"} -->
<!-- handbook:index {"group":"あ行","term":"アカウント乗っ取り (ATO)"} -->
<!-- handbook:index {"group":"ら行","term":"ロックアウト"} -->

<!-- handbook:narrative-bridge {"section":"13.25"} -->
13.24 までに設計してきたのは、正しい資格情報を持つ主体を、正しい範囲へ通す仕組みである。しかし攻撃者は、その仕組みを壊すのではなく**正面から使う**。他所で漏れたパスワードで順番に試し、成功したものだけを使う。この攻撃に対しては、13.1 のハッシュ強度も 13.10 の認可モデルも効かない。効くのは、試行そのものの扱い方である。

13.1 は「アカウント、送信元、端末、全体負荷を組み合わせたレート制限」と「固定回数での一律ロックは避ける」という方針を挙げた。23.6 は最小の実装例を示した。本節では、その方針が具体的に何を意味するかを扱う。攻撃側の道具立てと、bot 全般への対処は 23.27 にある。

#### 4つの攻撃は、必要な対策が違う

「ログイン試行を制限する」と一括りにされがちだが、攻撃の形によって効く対策が違う。

| 攻撃 | やること | 特徴 | 効く対策 |
|---|---|---|---|
| ブルートフォース | 1アカウントに多数のパスワード | アカウント単位で試行が集中する | アカウント単位の試行制限 |
| パスワードスプレー | 多数のアカウントに、よくあるパスワードを少数 | **1アカウントあたり数回**しか試さない | 全体・ネットワーク単位の観測、よくあるパスワードの禁止 |
| Credential Stuffing | 他所で漏れた「メール＋パスワード」の組を大量に試す | 1組につき1回。成功率は低いが件数が多い | 漏洩資格情報の照合、成功時の追加確認、全体の異常検出 |
| ロックアウトDoS | わざと失敗させて他人を締め出す | 攻撃者は成功を狙っていない | 固定ロックを使わない設計 |

**アカウント単位の試行制限だけでは、2番目と3番目に効かない。** 1アカウントあたり1〜3回しか試さない攻撃は、どんなしきい値の下でも通過する。逆に、しきい値を厳しくするほど4番目が容易になる。23.6 の実装例 (メールアドレスを鍵に5回でロック) は、ブルートフォースには効くが、この2点では不十分である。13.1 が「固定回数での一律ロックではなく」と書いているのは、この矛盾を指している。

#### 鍵は1つではなく、層として置く

対処は、**異なる粒度のカウンタを同時に持つ**ことである。どれか1つが超えたら段階的な対応に入る。

| 層 | 鍵 | 何を捉えるか | 目安の考え方 |
|---|---|---|---|
| アカウント | 正規化したメールアドレス／ユーザーID | 1人を狙う集中攻撃 | 短時間で数回。ただしロックはしない |
| 送信元 | IPアドレス | 1か所からの大量試行 | 共有IPを考慮して緩めに |
| ネットワーク | IPの上位ブロック、自律システム番号 | IPを分散させた攻撃 | 正規利用者の分布を見て決める |
| 端末・セッション | 端末に紐づく識別子、Cookie | 同一クライアントの繰り返し | 消されうるため補助的に使う |
| 全体 | サービス全体の失敗率 | 大規模な攻撃の開始 | 平常時の失敗率からの乖離 |

最後の「全体」が重要である。個別の鍵はすべてしきい値以下なのに、**サービス全体のログイン失敗率が平常の数十倍になっている**という状態は、分散した Credential Stuffing の典型的な兆候である。個別の制限だけを見ていると、この状態を検出できない。

```typescript
type Signal = { key: string; window: number; limit: number };

// 同じ試行を、複数の鍵で同時に数える
export function signalsFor(req: LoginRequest): Signal[] {
  return [
    { key: `login:acct:${normalizeEmail(req.email)}`, window: 900, limit: 10 },
    { key: `login:ip:${req.ip}`,                      window: 900, limit: 50 },
    { key: `login:net:${networkOf(req.ip)}`,          window: 900, limit: 300 },
    { key: `login:global`,                            window: 60,  limit: 5_000 },
  ];
}
```

正規化を忘れないこと。`User@Example.com` と `user@example.com` を別の鍵として数えると、大文字小文字を変えるだけで制限を回避される。

#### ロックではなく、段階的に費用を上げる

しきい値を超えたときの対応を「ロック」の一択にすると、必ずロックアウトDoS が成立する。段階を持たせる。

```text
失敗が続く
  │
  ├─ 第1段: 応答を遅らせる（指数的に、ただし上限を決める）
  ├─ 第2段: 追加のチャレンジを求める（23.27）
  ├─ 第3段: 追加の要素を要求する（13.21 の MFA、既知の端末以外は必ず）
  └─ 第4段: 一時的な制限。ただし解除の手段を本人が持つこと
```

- **遅延は攻撃者の費用を上げ、正規利用者の体験をほぼ損なわない。** 3回目の失敗で1秒、4回目で2秒、というだけで、自動化された大量試行の効率は大きく落ちる。上限を置かないと、自分たちのサーバ側で待機中の接続が溜まる (26.11)。
- **追加チャレンジは「疑わしいときだけ」にする。** 常時出すと、正規利用者の離脱とアクセシビリティの問題を生む (23.27)。
- **一時的な制限を課す場合も、本人が解除できる経路を残す。** メールの確認リンク、追加要素での認証など。攻撃者が他人を締め出せる状態にしない。
- **成功したらカウンタを消す。** ただし、成功したこと自体が正当性の証明にはならない (次項)。

#### 成功したときこそ疑う

Credential Stuffing の恐ろしいところは、**成功したログインが正規のログインと区別できない**点である。パスワードは正しいのだから、認証機構としては通す以外にない。したがって、成功後に確認を挟む。

| 合図 | 例 |
|---|---|
| 初めての端末・ブラウザ | 端末に紐づく識別子が既知の一覧に無い |
| 普段と違う場所 | 地理的な距離と経過時間が現実的でない |
| 直前に失敗が集中している | そのアカウントに対する試行が急増していた |
| 全体が攻撃を受けている | サービス全体の失敗率が異常 |

合図が立ったときの対応は、追加要素の要求、本人への通知、重要操作 (パスワード変更、メールアドレス変更、決済手段の追加) の一時的な保留である。**すべてを拒否する必要はない。読むことは許し、変更を保留する**という段階的な扱いが実務では扱いやすい。

**漏洩した資格情報との照合**も有効である [OWASP Credential Stuffing]。公開されている漏洩パスワードの集合と突き合わせ、一致した場合に変更を促す。照合は、パスワードそのものを外部へ送らずに行える方式が知られている。パスワードのハッシュの**先頭数文字だけ**を問い合わせ、返ってきた候補の中で自分たちが持つ完全なハッシュと突き合わせる (k-匿名性を利用した方式)。この場合でも、外部サービスへ何を送っているかは把握しておく。

照合の時機は3つある。新規登録時 (弱い資格情報を最初から入れない)、パスワード変更時、そしてログイン成功時 (すでに使われているものを検出する)。ログイン成功時に照合してその場で拒否すると、正規利用者が突然入れなくなる。**警告と変更の要求に留め、次回以降で強制する**形が一般的である。

#### アカウント列挙を防ぐには、全部の経路を揃える必要がある

23.6 が述べるとおり、ログイン失敗のメッセージを揃えるのは重要である。しかし、揃えるべき経路はログインだけではない。**1か所でも差があれば、そこから列挙される。**

| 経路 | 漏れる差 | 対処 |
|---|---|---|
| ログイン | メッセージの差、処理時間の差 | メッセージを統一し、存在しない場合もハッシュ検証と同等の時間をかける |
| 新規登録 | 「このメールアドレスは登録済みです」 | 登録済みでも成功したように見せ、**そのアドレスへ「登録の試みがあった」旨を通知する** |
| パスワード再設定 | 「該当するアカウントがありません」 | 常に「送信しました」と応答する |
| メールアドレス変更 | 変更先が既存かどうかの差 | 登録と同じ扱いにする |
| 招待・共有 | 「そのユーザーは存在しません」 | 存在の有無を返さない、または招待メールに寄せる |
| レート制限の応答 | 存在するアカウントだけ制限がかかる | 存在しないアカウントでも同じ制限を適用する |

**処理時間の差**は見落とされやすい。アカウントが存在しない場合にパスワードハッシュの検証を省略すると、応答が明確に速くなる。23.6 の固定ダミーハッシュは、この差を潰すための実装である。ただし、ダミーのハッシュ計算パラメータが実際の利用者のものと異なると、そこにまた差が生まれる。**現在の設定と同じパラメータで生成したダミー**を使う。

列挙を完全に防げるとは限らない。既に登録済みのアドレスへ通知メールが飛ぶ、という副作用は、攻撃者にとって別の嫌がらせの手段にもなる。**どこまで秘匿するかは、サービスの性質によって判断する。** 実名での利用が前提の業務システムと、匿名性が重要なサービスとでは、適切な水準が違う。方針を決め、13.24 が述べたとおり**全エンドポイントで揃える**ことが、個々の対策より重要である。

#### 乗っ取られたあとに何をするか

対策をすべて実施しても、乗っ取り (ATO) は起きる。起きたときに実行する手順を、あらかじめ機能として持っておく。

- **セッションを全失効させる。** 13.2 のセッション方式なら保存側を消せばよいが、13.4 の JWT では有効期限まで生き続ける。失効の仕組み (短い有効期限とリフレッシュ、失効リストの照会) が無いと、事故の当日に困る。
- **リフレッシュトークンを無効化する。** 13.5 の回転を実装していれば、盗まれたトークンの再利用を検出できる。
- **連携しているクライアントの認可を見直す。** OAuth (13.7) で発行済みのトークンも失効させる。
- **利用者へ通知する。** 何が起きて、何をしたか、次に何をすべきか。
- **変更の履歴を残す。** メールアドレス、パスワード、決済手段、通知先が攻撃者によって変更されると、正規の利用者は回復手段を失う。重要な変更は、変更前の連絡先にも通知する。

これらは、事故が起きてから作れるものではない。13.17 が扱う継続的な評価の仕組みも、この延長にある。

#### つまずく箇所 ― 認証エンドポイントの濫用

- **アカウント単位の試行制限だけを置く**: パスワードスプレーと Credential Stuffing は1アカウントあたり数回しか試さないため素通りする。
- **メールアドレスを鍵に固定回数でロックする**: 攻撃者が他人を締め出せる。段階的な費用の引き上げに置き換える。
- **鍵を正規化しない**: 大文字小文字や別名の付いたアドレスで制限を回避される。
- **全体の失敗率を見ていない**: 分散した攻撃は、個別のしきい値をすべて下回ったまま進行する。
- **成功したログインを無条件に信じる**: 正しいパスワードで入る攻撃には、成功後の合図でしか気づけない。
- **列挙対策をログインだけに施す**: 登録、再設定、招待、変更のどれか1つに差があれば、そこから列挙される。
- **ダミーハッシュのパラメータが実データと違う**: 処理時間に差が残り、対策が効かない。
- **失効の仕組みを持たない**: 乗っ取りが判明しても、当日中に締め出せない。

<a id="section-13-26"></a>
### 13.26 実装課題 ― 認証と認可の核を実装する
<!-- handbook:learning {"level":"practical","minutes":870} -->

<!-- handbook:narrative-bridge {"section":"13.26"} -->
ここまでの方式は、秘密の保存、署名、期限、委任、追加要素、認可判断という異なる責務を持つ。最小実装と攻撃シナリオを通じて、各検証がどの脅威を遮断し、どの限界を残すかを確認する。

第13章では認証・認可の広い世界を見た。本節では、特に重要な仕組みを自作することで、各ライブラリの中身を理解する。所要時間: 演習カードの推定時間の合計で14時間30分。

#### 課題13.1: パスワードハッシュ ― ソルト + 反復 ハッシュ自作 (★★)

**目的**: 「**なぜソルトと反復が必要か**」を実装で確認。

<!-- handbook:exercise:start {"id":"13.1"} -->
> **演習カード 課題13.1** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.1 パスワード認証の基礎 を読み、ソルトと反復が防ぐ攻撃を確認する
> - node:crypto から pbkdf2、randomBytes、timingSafeEqual を呼べる
> - promisify でコールバック型APIをPromise化できる
> - base64url エンコードとバイト列の扱いを理解している
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] hashPassword(password) が反復数、ソルト、ハッシュを1つの文字列へ連結して返す
> - [ ] 同じパスワードを2回ハッシュすると異なる文字列になる
> - [ ] verifyPassword が正しいパスワードで true、誤りで false を返す
> - [ ] 保存文字列の形式が壊れている入力に対し、例外ではなく false を返す
> - [ ] 比較に crypto.timingSafeEqual を使い、長さが違う場合は比較前に false を返す
> - [ ] 反復数10万での1回のハッシュ計算時間を計測して記録している
>
> **期待出力**
>
> - 保存文字列が pbkdf2、ダイジェスト名、反復数、base64urlソルト、base64urlハッシュ をドル記号で連結した5要素になる
> - 同一パスワードの2回のハッシュ値が一致しない
> - 1文字違いのパスワードでは検証が false になる
> - 反復数10万のハッシュ計算が一般的なノートPCで数十から百数十ミリ秒かかる
>
> **観察項目**
>
> - ソルトを固定した版と乱数版で、同じパスワードのハッシュ値が一致するかを比べ、事前計算表が効く条件を確認する
> - 反復数を1万、10万、100万と変え、計算時間がほぼ線形に伸びることを計測する
> - timingSafeEqual を通常の等値比較へ置き換え、先頭が違う場合と末尾だけ違う場合の比較時間差を測る
> - 保存文字列に反復数を含めることで、後から反復数を引き上げても既存ユーザーが検証できることを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `password hashing uses random salt and verifies safely` がパスすることを確認する
> 2. 小さなスクリプトを `pnpm --filter @handbook/ch13 exec tsx スクリプト名` で実行し、hashPassword の戻り値がドル記号で4回区切られていることを確認する
> 3. 保存文字列の末尾1文字を書き換えて verifyPassword に渡し、例外で落ちずに false が返ることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 保存するのはハッシュだけではない。検証時に同じ計算を再現するために必要な情報 (アルゴリズム、反復数、ソルト) を一緒に持たせる、という発想から保存形式を決める。
> 2. **構造**: promisify した pbkdf2 に password、salt、iterations、keyLength、digest を渡す。randomBytes(16) のソルトと結果を base64url へ変換し、ドル記号で連結する。検証は分解して同じパラメータで再計算する。
> 3. **実装の要点**: timingSafeEqual は長さが違うと例外を投げるため、比較前に長さ一致を確認する。反復数は保存文字列から来るので、整数チェックと上下限の検証を入れないと、改ざんされた保存値で反復数を極端に下げられる。
>
> **本番利用時の警告**
>
> - この自作PBKDF2実装を本番のパスワード保存に使わない。PBKDF2はGPUによる並列化に弱く、現在の推奨はArgon2idやbcrypt、scryptといったメモリ困難な関数である。
> - パラメータをユーザー由来の保存文字列から読む設計は、DBへ書き込める攻撃者に反復数を下げられる余地を残す。本番では最小反復数をコード側で強制し、下回る保存値は再ハッシュ対象にする。
> - この演習にはアカウントロック、レート制限、漏洩パスワードリストとの照合が無い。これらが無いと総当たりとクレデンシャルスタッフィングは防げない。
>
> **導線**
>
> - 開始地点: `code/ch13/password-hash.ts`
> - 模範解答: `code/ch13/password-hash.solution.ts`
>
> **推定時間の内訳**: hashPasswordとverifyPasswordの実装30分、ソルト固定版との比較実験25分、反復数と計算時間の計測20分、改ざん入力の失敗系確認15分
<!-- handbook:exercise:end -->

**要件**: 自作ハッシュ関数 (教育用なので bcrypt / Argon2 は使わない)。

```typescript
const hashed = await hashPassword('mypassword');
// 結果: "100000$base64salt$base64hash"
//        反復数 $ ソルト $ ハッシュ

const ok = await verifyPassword('mypassword', hashed);  // true
const bad = await verifyPassword('wrong', hashed);      // false
```

要件:
- ✓ ソルトはリクエストごとに生成 (`crypto.randomBytes(16)`)
- ✓ PBKDF2-HMAC-SHA256 で 100,000 回反復 (`crypto.pbkdf2`)。この回数は演習を待たずに回すための値であり、本番の水準ではない。PBKDF2-HMAC-SHA256 を本番で使うなら OWASP の現行推奨は 600,000 回以上である [OWASP Password Storage]。そもそも新規実装では Argon2id を選ぶ (13.1)
- ✓ ハッシュ + ソルト + 反復数を 1 文字列に
- ✓ 比較は **タイミング攻撃対策**で `crypto.timingSafeEqual`

**問題**:
- なぜ平文比較ではダメか?
- なぜソルトをハッシュと同じ文字列に保存するのか?
- bcrypt / Argon2 を使う場合との違いは?(自作版の限界)

模範解答: `code/ch13/password-hash.solution.ts`

#### 課題13.2: JWT 完全自作 ― HS256 と RS256 (★★★)

**目的**: JWT が「Base64URL エンコードされた3つの JSON + 署名」であることを実装で確認。

<!-- handbook:exercise:start {"id":"13.2"} -->
> **演習カード 課題13.2** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.4 JWT (JSON Web Token) の構造と注意点 を読み、header、payload、signature の3分割を確認する
> - 13.23 JWS / JWE / JWA ― JWT の構成要素 を読み、署名と暗号化が別物であることを把握する
> - node:crypto の createHmac、createSign、createVerify、generateKeyPairSync を使える
> - base64url と base64 の違い (記号2文字とパディング無し) を説明できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] signJwt が HS256 でヘッダ、ペイロード、署名をドットで連結した文字列を返す
> - [ ] RS256 でRSA秘密鍵により署名し、対応する公開鍵で検証できる
> - [ ] verifyJwt が許可アルゴリズム一覧を引数で受け取り、一覧外の alg を拒否する
> - [ ] alg が none のトークンが Unsupported algorithm で拒否される
> - [ ] exp を過ぎたトークンが Token expired で拒否され、nbf 前のトークンも拒否される
> - [ ] ペイロードを1文字改ざんしたトークンが Invalid signature で拒否される
>
> **期待出力**
>
> - HS256トークンをドットで分割すると3要素になり、先頭要素をbase64urlデコードすると alg と typ を持つJSONになる
> - 検証成功時にペイロードのオブジェクトが返る
> - alg none のトークンは署名部が空で末尾がドットになる
> - 失敗系の例外メッセージが Unsupported algorithm、Algorithm is not allowed、Invalid signature、Token expired のいずれかになる
>
> **観察項目**
>
> - 生成したトークンのペイロード部をbase64urlデコードし、暗号化されておらず誰でも読めることを確認する
> - alg を none に書き換えたトークンと、RS256をHS256と偽ったトークンの両方を検証へ通し、どこで弾かれるかを追う
> - 署名比較を timingSafeEqual から通常の等値比較へ変えても機能テストは通ることを確認し、テストで守れない性質があることを見る
> - exp を現在時刻ちょうどに設定し、境界の比較演算子でどちらへ転ぶかを確認する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `JWT supports HS256 and RS256 and rejects none/expired` がパスすることを確認する
> 2. alg none のトークンを生成して verifyJwt へ渡し、例外が投げられることを確認する (検証を通ってしまえば不合格)
> 3. 生成したHS256トークンのペイロード部を1文字書き換えて verifyJwt へ渡し、Invalid signature になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: JWTは暗号ではなく、base64urlで連結した2つのJSONにその連結文字列への署名を付けたもの。まず署名なしで3部構成を組み立て、後から署名だけを差し替えられる形にする。
> 2. **構造**: 署名対象はヘッダとペイロードをドットで繋いだ文字列。HS256は createHmac('sha256', key) の digest、RS256は createSign('RSA-SHA256') の sign を使い、検証は同じ入力から再計算して比較する。
> 3. **実装の要点**: 検証関数は必ず呼び出し側が許可したアルゴリズム一覧を引数で受け取り、トークンの alg を信用して分岐しないこと。alg に従って鍵の使い方を決めると、HS256を名乗って公開鍵を共有鍵として使わせる鍵取り違え攻撃が成立する。
>
> **本番利用時の警告**
>
> - この自作JWT検証を本番へ持ち込まない。kid による鍵選択、鍵ローテーション、JWKS取得、iss と aud の検証、時刻ずれの許容を持たないため、別発行者のトークンや別サービス向けのトークンをそのまま受け入れてしまう。
> - JWTは署名されているだけで暗号化されていない。ペイロードへ機微情報を入れると、Cookieやアクセスログから誰でも読める。
> - 失効の仕組みが無いため、ログアウトや権限剥奪をしても exp までトークンは有効なままになる。即時失効が要るなら jti のブロックリストか、短命トークンとリフレッシュトークンの組み合わせが必要になる。
>
> **導線**
>
> - 開始地点: `code/ch13/jwt.ts`
> - 模範解答: `code/ch13/jwt.solution.ts`
>
> **推定時間の内訳**: sign/decode/verifyの実装50分、RS256の鍵生成と検証40分、alg:noneと改ざん・期限切れの攻撃デモ40分、境界条件の確認20分
<!-- handbook:exercise:end -->

**要件**:
- HS256(共有秘密鍵) と RS256(RSA 公開鍵) 両方
- エンコード / デコード / 検証
- `exp`(期限切れ) チェック
- `alg: none` 攻撃の脆弱性デモ → 修正版

```typescript
// 発行
const token = signJwt({ userId: '42', exp: Math.floor(Date.now()/1000) + 3600 }, 'secret', 'HS256');
console.log(token);  // header.payload.signature

// 検証(成功)
const payload = verifyJwt(token, 'secret');  // → { userId: '42', exp: ... }

// 検証(失敗:改ざん)
verifyJwt('eyJ...tampered...', 'secret');  // → throws InvalidSignatureError

// 検証(失敗:alg: none 攻撃)
const evilToken = createNoneAlgToken({ userId: 'admin' });
verifyJwt(evilToken, 'secret');  // → throws (alg:none を拒否すべき)
```

模範解答: `code/ch13/jwt.solution.ts`

#### 課題13.3: OAuth 2.0 Authorization Code + PKCE フロー自作 (★★★)

**目的**: OAuth プロバイダ (IdP) とクライアントの両方を実装し、PKCE の役割を理解する。

<!-- handbook:exercise:start {"id":"13.3"} -->
> **演習カード 課題13.3** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.7 OAuth 2.0 ― 第三者認可 を読み、認可コードフローの登場人物と往復を確認する
> - 13.20 PKCE ― OAuth/OIDC のクライアント側保護 を読み、code_verifier と code_challenge の関係を把握する
> - node:crypto の randomBytes と createHash('sha256') で base64url 文字列を作れる
> - URL オブジェクトでクエリパラメータを組み立て・読み取りできる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 登録済み redirect URI と完全一致しない要求を Invalid redirect_uri で拒否する
> - [ ] 認可要求が短寿命 (60秒) で一度きりの認可コードを発行し、redirect URI に code と state を付けたURLを返す
> - [ ] トークン交換が code_verifier のSHA-256と保存済み code_challenge の一致を検証し、不一致を PKCE verification failed で拒否する
> - [ ] 同じコードを2回交換しようとすると Invalid or expired authorization code で拒否される
> - [ ] クライアント側が callback の state を自分が生成した値と照合し、不一致で中断する
> - [ ] 交換に成功するとアクセストークンと Bearer が返り、introspect で subject を引ける
>
> **期待出力**
>
> - クライアントフローの戻り値がアクセストークンと tokenType: Bearer になる
> - introspect が有効トークンで active: true と subject を返し、未知のトークンでは active: false を返す
> - code_challenge が43文字から128文字のbase64url文字列で、形式外は Invalid PKCE challenge で拒否される
> - コード再利用、redirect URI 不一致、client_id 不一致はいずれも例外になる
>
> **観察項目**
>
> - 認可要求のパラメータに code_verifier そのものが含まれないことを確認し、コードを盗んだだけでは交換できない理由を説明する
> - code_challenge を平文方式にした場合、傍受した challenge をそのまま verifier として送れることを再現する
> - コードの有効期限を過去に設定し、期限切れコードが拒否されることを確認する
> - state を照合しない版を作り、攻撃者が用意したコードを被害者のセッションへ結び付けられることを追う
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `PKCE binds code to verifier, client, redirect, and one-time use` がパスすることを確認する
> 2. 誤った codeVerifier で交換を呼び、PKCE verification failed が投げられることを確認する
> 3. 同じ code で交換を2回呼び、2回目が Invalid or expired authorization code になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 認可サーバの状態は3つのMapで表せる。登録済みクライアント、発行済みコード、発行済みトークン。コードには誰に、どのredirectへ、どのchallengeで出したかを一緒に保存するのが要点。
> 2. **構造**: code_verifier は randomBytes(32) の base64url、code_challenge は createHash('sha256') の digest を base64url にしたもの。交換時は受け取った verifier から challenge を再計算して保存済みの値と比較する。
> 3. **実装の要点**: コードレコードに used フラグと有効期限を必ず持たせ、交換成功時に used を立てる。忘れると盗まれたコードが何度でも交換でき、PKCEを入れた意味が薄れる。
>
> **本番利用時の警告**
>
> - この教材IdPはユーザー認証そのもの (ログイン画面とパスワード検証) を持たず、subject を呼び出し側が自由に指定できる。誰にでもなりすませるため、隔離した localhost 以外で起動しない。
> - アクセストークンをメモリ上のMapへ平文で保持し、失効、スコープ、有効期限、監査ログを持たない。本番の認可サーバは既存のOAuth/OIDC製品を使い、自作しない。
> - redirect URI の検証を前方一致や部分一致へ緩めると、攻撃者が制御するパスへ認可コードを送らせるオープンリダイレクトになる。完全一致以外は採用しない。
>
> **導線**
>
> - 開始地点: `code/ch13/oauth-pkce/starter/README.md`
> - 模範解答: `code/ch13/oauth-pkce/solution/pkce.ts`、`code/ch13/oauth-pkce/solution/README.md`
>
> **推定時間の内訳**: IdPの認可・トークン交換の実装60分、PKCE計算とstate照合を含むクライアント実装40分、コード再利用・redirect不一致・期限切れの検証50分
<!-- handbook:exercise:end -->

**実装範囲**:
- 最小限の IdP サーバ (認可エンドポイント + トークンエンドポイント)
- クライアント側スクリプト
- PKCE(code_verifier / code_challenge)

```text
Client → IdP:    /authorize?client_id=...&code_challenge=...&state=...
IdP   → User:   (ログイン画面、ここはモック)
User  → IdP:    (同意)
IdP   → Client: redirect with ?code=AUTH_CODE&state=...
Client → IdP:   POST /token with code + code_verifier
IdP   → Client: { access_token, id_token }
```

模範解答: `code/ch13/oauth-pkce/`

#### 課題13.4: HMAC-SHA256 Webhook 署名検証 (★★)

**目的**: Stripe / GitHub の Webhook 署名検証ロジックを自作。

<!-- handbook:exercise:start {"id":"13.4"} -->
> **演習カード 課題13.4** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.14 HMAC-SHA256 ― 共有秘密鍵による署名 を読み、HMACが満たす性質を確認する
> - 13.6 CSRF 対策 を読み、リプレイと意図しない再送が別問題であることを把握する
> - node:crypto の createHmac と timingSafeEqual を使える
> - UNIX時刻の秒表現で時刻差を計算できる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] 署名生成が `v1,t=秒,sig=base64url` 形式の1ヘッダを返す
> - [ ] 署名対象がタイムスタンプと本文の連結であり、タイムスタンプを含まない署名では検証が失敗する
> - [ ] 現在時刻との差が許容秒数 (デフォルト300秒) を超えるヘッダを Webhook timestamp outside tolerance で拒否する
> - [ ] 署名不一致を Invalid webhook signature で拒否し、比較に timingSafeEqual を使う
> - [ ] 同一のタイムスタンプと署名の組を2回目に受け取ると Webhook replay detected で拒否する
> - [ ] ヘッダ形式が壊れている場合に Malformed signature header を投げる
>
> **期待出力**
>
> - 正しいヘッダと本文の組で検証関数が true を返す
> - 同じヘッダを同じリプレイ検出器で2回検証すると2回目が例外になる
> - 301秒ずらした時刻で検証すると許容範囲外の例外になる
> - ヘッダ値がバージョン、t、sig の3フィールドで構成される
>
> **観察項目**
>
> - 本文の1バイトだけを変えて検証し、HMACが本文全体に依存することを確認する
> - タイムスタンプを署名対象から外すと、古い正当なリクエストをそのまま再送できることを再現する
> - リプレイ検出器の期限切れ掃除を止め、記録が無限に増えてメモリが伸びることを確認する
> - 許容秒数を極端に短くし、送受信間の時計ずれで正当な配信が落ちる境界を測る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `webhook signature checks age, constant-time signature, and replay` がパスすることを確認する
> 2. 検証関数へ現在時刻としてタイムスタンプ+301秒を渡し、tolerance を含むメッセージの例外になることを確認する
> 3. 署名の末尾1文字を書き換えたヘッダで検証し、Invalid webhook signature が投げられることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 署名対象を本文だけにすると、正当なリクエストをそのまま撃ち返すリプレイを防げない。何を署名対象に含めれば再送を見分けられるかから設計する。
> 2. **構造**: createHmac('sha256', secret) にタイムスタンプとドットと本文を連結した文字列を update し、digest を base64url にする。ヘッダはカンマ区切りで組み立て、検証側はカンマと等号で分解する。
> 3. **実装の要点**: 比較は必ず Buffer 化して長さ一致を確認してから timingSafeEqual を使う。文字列の等値比較だと短絡評価で先頭一致長が漏れ、署名を1バイトずつ推測される余地が残る。
>
> **本番利用時の警告**
>
> - リプレイ検出はプロセス内のMapであり、再起動と水平スケールで記録が消える。複数インスタンスで受ける本番では、共有ストアへイベントIDを記録する必要がある。
> - 受信ボディをJSONパースして再シリアライズしてから検証すると、空白やキー順の差で検証が壊れる。必ず受け取った生のバイト列に対して検証する。
> - 秘密鍵をコードやログへ残さない。ヘッダと本文をそのままログ出力すると、署名と本文の組が漏れて解析材料を与える。
>
> **導線**
>
> - 開始地点: `code/ch13/webhook-signing.ts`
> - 模範解答: `code/ch13/webhook-signing.solution.ts`
>
> **推定時間の内訳**: 署名生成と検証の実装35分、リプレイ検出の追加25分、時刻ずれと改ざんの失敗系テスト30分
<!-- handbook:exercise:end -->

**要件**:
- 送信側: `body` + `timestamp` を秘密鍵で HMAC 署名
- 受信側: 検証 (タイミング安全比較、timestamp 5分以内チェック)
- リプレイ攻撃対策

```typescript
// 送信側
const headers = signWebhook(secret, JSON.stringify(payload));
// → { 'webhook-signature': 'v1,t=1716000000,sig=base64...' }

// 受信側
verifyWebhook(secret, body, headers);  // → true | throws
```

模範解答: `code/ch13/webhook-signing.solution.ts`

#### 課題13.5: TOTP (Time-based OTP) 実装 (★★)

**目的**: Google Authenticator が動く仕組みを RFC 6238 から実装する。

<!-- handbook:exercise:start {"id":"13.5"} -->
> **演習カード 課題13.5** ― 難易度 ★★ ／ 推定時間 90分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.21 MFA と TOTP ― 多要素認証の実装 を読み、HOTPからTOTPへの拡張を確認する
> - 13.14 HMAC-SHA256 ― 共有秘密鍵による署名 を読み、HMACの入力と出力を把握する
> - Base32のアルファベットと8バイトのビッグエンディアン整数を扱える
> - node:crypto の createHmac と randomBytes を使える
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] Base32のエンコードとデコードが往復して元のバイト列へ戻る
> - [ ] generateSecret() が Base32 文字列を返す
> - [ ] generateTotp(secret) が30秒ごとに変わる6桁の数字文字列を返し、先頭が0でも6桁を保つ
> - [ ] RFC 6238 のテストベクタ (SHA-1、秘密鍵 12345678901234567890、時刻59秒、8桁) で 94287082 が得られる
> - [ ] verifyTotp が前後1ウィンドウを許容し、比較に timingSafeEqual を使う
> - [ ] otpauth URL に secret、issuer、period、digits のクエリが含まれる
>
> **期待出力**
>
> - 6桁のコードが文字列として返り、30秒境界をまたぐと値が変わる
> - RFC 6238 のベクタで8桁 94287082 が一致する
> - 時刻を30秒ずらした検証が window=1 で true、90秒ずらすと false になる
> - otpauth URL が otpauth://totp/ で始まる
>
> **観察項目**
>
> - 同じ秘密鍵で連続してコードを生成し、30秒の境界をまたいだ瞬間だけ値が変わることを確認する
> - window を0にして、時計が数秒ずれた端末のコードが弾かれることを再現する
> - 動的切り捨てのオフセット値を出力し、毎回異なる位置から4バイトを読んでいることを確認する
> - 生成した otpauth URL をQRコードにして認証アプリへ登録し、アプリの表示と自作コードが一致することを見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `TOTP matches RFC 6238 SHA1 vector and window verification` がパスすることを確認する
> 2. 時刻59秒・8桁の条件で生成したコードが 94287082 になれば、Base32デコードからHOTPまでの経路は合格
> 3. 現在時刻から90秒後の時刻で window=1 の検証を行い、false になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: TOTPはHOTPのカウンタを時刻を30で割った値へ置き換えただけ。まず固定カウンタでHMACから6桁を取り出す部分を作り、その後に時刻からカウンタを求める。
> 2. **構造**: カウンタは8バイトのバッファへビッグエンディアンで書く。HMACのダイジェスト末尾バイトの下位4ビットをオフセットとし、そこから4バイトを読んで最上位ビットを落とし、桁数に応じた10のべき乗で剰余を取ってゼロ埋めする。
> 3. **実装の要点**: 秘密鍵をBase32文字列のまま createHmac へ渡してはいけない。必ずデコードしたバイト列を鍵にする。ここを間違えると自作コード同士では一貫して動くのに、認証アプリの表示と一致しない。
>
> **本番利用時の警告**
>
> - TOTPの秘密鍵は共有秘密であり、サーバ側に平文で保管すると漏洩時に全ユーザーの第2要素が即座に突破される。本番では鍵管理サービスや暗号化保管を使う。
> - この実装は使用済みコードの記録を持たないため、30秒以内なら同じコードを何度でも使える。フィッシングで抜かれたコードのリプレイを防ぐには、成功したカウンタをユーザーごとに記録して再利用を拒否する必要がある。
> - 検証回数の制限が無いと6桁は総当たりで突破されうる。ログイン試行と同様にレート制限とロックアウトを併用する。
>
> **導線**
>
> - 開始地点: `code/ch13/totp.ts`
> - 模範解答: `code/ch13/totp.solution.ts`
>
> **推定時間の内訳**: Base32の実装と往復テスト30分、HOTP/TOTP計算の実装30分、RFCベクタ照合とウィンドウ検証20分、otpauth URLと認証アプリでの確認10分
<!-- handbook:exercise:end -->

**要件**:
- 秘密鍵から TOTP コードを生成 (30秒ごとに変わる)
- 検証 (時計のズレを許容して前後 1 ウィンドウ受け入れ)
- otpauth:// URL の生成 (QR コード化のもと)

```typescript
const secret = generateSecret();
const code = generateTotp(secret);
// 表示用: 6桁の数字 (例: '123456')

verifyTotp(secret, '123456');  // true if 現在 ±1 window 内
```

模範解答: `code/ch13/totp.solution.ts`

#### 課題13.6: ポリシーエンジン ― 中央集権認可 (★★★)

**目的**: 13.11 で扱った「認可ロジックの中央集権化」を実装する。

<!-- handbook:exercise:start {"id":"13.6"} -->
> **演習カード 課題13.6** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.11 認可ロジックを「中央集権」にする を読み、判断点を1か所へ集める狙いを確認する
> - 13.10 認可モデル ― RBAC、ABAC、ReBAC を読み、ロールと属性による判定の違いを把握する
> - TypeScript のジェネリクスと述語関数を書ける
> - 課題13.2 または 課題13.3 で得た subject (誰か) の情報を入力として渡せる
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] define で effect、action、任意の roles、任意の condition を持つポリシーを登録できる
> - [ ] can(subject, action, resource) が真偽値を返し、一致するポリシーが0件ならデフォルト拒否で false になる
> - [ ] アスタリスク単独と接頭辞付きのワイルドカードがアクション一致に使える
> - [ ] roles を指定したポリシーが、subject の role または roles に含まれるときだけ一致する
> - [ ] condition による属性判定 (自分の投稿かどうかなど) が動く
> - [ ] deny が allow より優先され、両方一致する場合は false になる
>
> **期待出力**
>
> - 自分の投稿への post.edit が true、他人の投稿では false になる
> - role が admin の subject はワイルドカードのポリシーにより user.delete が true になる
> - 機密リソースに対する deny 条件に該当すると、admin でも false になる
> - 未登録アクションはデフォルト拒否で false になる
>
> **観察項目**
>
> - ポリシーの登録順を入れ替えても結果が変わらないことを確認し、順序非依存の設計であることを見る
> - deny優先を外して allow優先にすると、admin が機密リソースへ到達できてしまうことを再現する
> - デフォルトを allow に変え、書き忘れたアクションが素通りすることを確認する
> - condition の中で例外が起きた場合の挙動を確認し、判定不能時に拒否へ倒れるかを検証する
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 run test` を実行し、テスト `policy engine combines RBAC, ABAC, wildcard, and deny precedence` がパスすることを確認する
> 2. 未定義のアクション (例 post.delete) を can へ渡し、例外ではなく false が返ることを確認する
> 3. deny ポリシーと allow ポリシーの両方に一致する入力を作り、必ず false になることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 判定を「一致するポリシーを集める」と「集めた中に deny があれば拒否、なければ allow の有無を見る」の2段に分けると、登録順に依存しない実装になる。
> 2. **構造**: アクション一致はアスタリスク単独、接頭辞付き、完全一致の3パターンを判定する小さな関数へ切り出す。subject のロールは role と roles を1つの Set にまとめてから照合する。
> 3. **実装の要点**: デフォルトは必ず拒否にすること。最後を「allow が1件以上あるか」で判定すれば一致0件で自動的に false になる。ここを「deny が無いか」で書くと、ポリシー未定義のアクションが全許可になる。
>
> **本番利用時の警告**
>
> - このエンジンはテナント境界や所有関係をデータ側から取得せず、渡された resource を信じて判定する。呼び出し側がIDだけでオブジェクトを組み立てると、他テナントのリソースを自分のものとして判定させられる。
> - 監査ログ、ポリシーのバージョン管理、判定結果のキャッシュ無効化を持たないため、権限剥奪が即座に反映されない構成になりやすい。本番では判定の入力と結果を記録し、いつ誰が何を許可されたか追跡できるようにする。
> - condition に任意の関数を書けるため、外部入力からポリシーを組み立てる設計にすると任意コード実行に近い危険がある。ポリシーはコードとしてレビューし、実行時に外部から注入しない。
>
> **導線**
>
> - 開始地点: `code/ch13/policy-engine.ts`
> - 模範解答: `code/ch13/policy-engine.solution.ts`
>
> **推定時間の内訳**: ポリシー定義とcanの実装50分、ワイルドカードとロール照合40分、deny優先とデフォルト拒否の検証40分、テストケース作成20分
<!-- handbook:exercise:end -->

**要件**:
- ポリシーは宣言的に記述 (JavaScript オブジェクト)
- `can(subject, action, resource)` で判定
- RBAC + ABAC のハイブリッド

```typescript
const engine = new PolicyEngine();
engine.define({
  // user は自分のpost を編集できる
  effect: 'allow',
  action: 'post.edit',
  condition: ({ subject, resource }) => subject.id === resource.authorId,
});
engine.define({
  // admin は何でもできる
  effect: 'allow',
  action: '*',
  condition: ({ subject }) => subject.role === 'admin',
});

engine.can({ id: 'u1' }, 'post.edit', { authorId: 'u1' });  // true
engine.can({ id: 'u1' }, 'post.edit', { authorId: 'u2' });  // false
engine.can({ id: 'admin', role: 'admin' }, 'post.delete', {}); // true
```

模範解答: `code/ch13/policy-engine.solution.ts`

#### 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★)

**目的**: 13.24 で挙げた「テナント境界が破れる典型経路」を、動くコードとして再現し、塞ぐ。

<!-- handbook:exercise:start {"id":"13.7"} -->
> **演習カード 課題13.7** ― 難易度 ★★★ ／ 推定時間 150分 ／ 必要サービス: なし
>
> **前提**
>
> - 13.24 マルチテナントの認可とテナント境界 を読み、境界が破れる典型経路の表を手元に用意する
> - 13.11 認可ロジックを「中央集権」にする を読み、判断点を1か所へ集める狙いを確認する
> - 14.20 テナント分離モデルと Row-Level Security を読み、USING と WITH CHECK の役割の違いを押さえる
> - 14.19 Connection Pooler ― DB接続管理の必須インフラ を読み、SET と SET LOCAL の差が事故になる理由を確認する
> - `code/ch13` で pnpm install 済みで、`pnpm --filter @handbook/ch13 run typecheck` が通る状態にする
>
> **完成条件 (自己採点用チェックリスト)**
>
> - [ ] `probeLeaks` が L1 から L4 の4経路を試し、漏洩の有無を API の戻り値だけから判定する
> - [ ] 境界の抜けた `createUnsafeApi` に対して 4件すべてが leaked=true になる
> - [ ] `tenantPolicy` が using と withCheck の両方を持ち、tenantId が未設定のセッションを通さない
> - [ ] `PolicyEngine` が force=false のとき所有者セッションを素通りさせ、force=true のとき素通りさせない
> - [ ] `createGuardedApi` を通した同じ `probeLeaks` が 4件すべて leaked=false になる
> - [ ] `probePoolReset` が、SET LOCAL 相当なしのときだけ前テナントの文脈を観測する
> - [ ] `pnpm --filter @handbook/ch13 exec tsx tenant-isolation/starter/report.ts` が6行の要約を出力する
>
> **期待出力**
>
> - 1行目に `unguarded api: 4/4 leaks reproduced` が出る
> - L1 の詳細が `read tsk_a1 of ten_a` になり、他テナントのタスクを読めたことが分かる
> - L3 の詳細が、境界の抜けた実装では `moved into prj_a1 of ten_a`、ポリシー層では `NotFoundError` になる
> - `guarded api: 0/4 leaks reproduced` に続く4行がすべて leaked=false になる
> - 最後の2行が `owner bypass: without force=true / with force=false` と `session pool: without SET LOCAL=true / with SET LOCAL=false` になる
>
> **観察項目**
>
> - `createGuardedApi` の listTasksCached のキーからセッションのテナント識別子を外し、L4 だけが再び leaked=true になることを確認する
> - moveTask から移動先プロジェクトの visible 検査だけを外すと L3 は assertWritable で止まり、assertWritable も外すと L3 だけが leaked=true に戻ることを確認する
> - `PolicyEngine` を force=false で作り、owner=true のセッションで probeLeaks を実行して、ポリシーを書いても4件すべてが leaked=true に戻ることを確認する
> - `withPooledSession` の setLocal を false にしたまま、貸し出し順を B から A へ入れ替えて、観測されるテナントが変わることを確認する
> - searchIndex のキーをテナント込みに変える案と、索引はそのままでポリシー層で絞る案を比べ、返る件数と実装量の差を見る
>
> **テスト方法 (自己採点手順)**
>
> 1. `pnpm --filter @handbook/ch13 exec tsx tenant-isolation/solution/report.ts` を実行し、6行の要約が出力されることを確認する
> 2. `pnpm --filter @handbook/ch13 run test` を実行し、tenant boundary leaks・WITH CHECK・owner bypass の3つのテストが pass することを確認する
> 3. 自分の `tenant-isolation/starter/report.ts` を実行し、solution と同じ出力になるかで自己採点する
> 4. `pnpm --filter @handbook/ch13 run typecheck` が 0 エラーで終わることを確認する
>
> **段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)
>
> 1. **方針**: 先に probeLeaks だけを書き、境界の抜けた実装で 4/4 が出る状態を作る。塞ぐ側から書き始めると、何を検出できていないのかが分からなくなる。
> 2. **構造**: ポリシーは行の述語2つ、エンジンは述語を配列と単一行へ適用する2メソッド、APIはエンジンを呼ぶだけ、という3層に分ける。API側に条件式を書き始めたら、それはポリシーへ移すべき判断である。
> 3. **実装の要点**: probeLeaks の各経路で createStore() を呼び直す。L3 はストアを書き換えるため、同じストアを使い回すと後続の経路の結果が変わる。moveTask では移動先プロジェクトを visible で取り出し、移動後の行を assertWritable へ通す。visible だけでは、他テナントへ書き出す経路が残る。
>
> **本番利用時の警告**
>
> - このポリシー層はアプリケーションのプロセス内にあるため、同じデータベースへ別経路で接続されれば無力である。本番では PostgreSQL の Row-Level Security のように、データストア側で宣言する必要がある。
> - SessionPool は単一スレッドの逐次実行を前提にしており、実際のコネクションプールが持つ待ち行列、タイムアウト、切断検知を持たない。接続の使い回しによる文脈残留の再現だけを目的としている。
> - 認可の判定はテナント境界だけを扱い、ロールによる操作権限を含めていない。実際の設計では 13.10 の認可モデルと組み合わせる必要がある。
>
> **導線**
>
> - 開始地点: `code/ch13/tenant-isolation/starter/main.ts`
> - 模範解答: `code/ch13/tenant-isolation/solution/main.ts`、`code/ch13/tenant-isolation/solution/report.ts`
>
> **推定時間の内訳**: 4経路の probe 実装に40分、ポリシー層とガード付きAPIの実装に50分、所有者バイパスと接続使い回しの再現に30分、観察項目の書き換え比較に30分。
<!-- handbook:exercise:end -->

**題材**: 2つのテナント (`ten_a`、`ten_b`) がプロジェクトとタスクを共有するメモリ上のデータストアを使う。データベースを起動せず、境界の有無だけを取り出して観察する。

**要件**: `code/ch13/tenant-isolation/starter/main.ts` に次の4つを実装する。

1. `probeLeaks(build)` ― テナントB の立場から、テナントA の資源へ到達できるかを4経路で試し、`Leak[]` を返す。`build` はストア・テナント識別子・共有キャッシュから API を作る関数で、境界の抜けた実装とポリシー層つき実装を同じ探索へ差し替えられるようにする。期待値をコードへ直書きせず、APIの戻り値だけから漏洩を判定する。
2. `PolicyEngine` ― 14.20 の `USING` と `WITH CHECK` に対応する2つの述語を持つポリシー層。`force` が偽のとき、所有者セッションはポリシーを迂回する。
3. `createGuardedApi` ― 4つのAPIすべてをポリシー層へ通す実装。キャッシュキーにもセッションのテナントを含める。
4. `withPooledSession` / `probePoolReset` ― 同じ物理接続を2回貸し出し、`SET LOCAL` 相当の有無で前のテナントの文脈が残るかどうかを観測する。

再現する4経路は次のとおりで、いずれも `createUnsafeApi` に仕込んである。

| 経路 | 抜けている検査 |
|---|---|
| L1 `direct-id-read` | 主キーで取得したタスクの所有テナントを確認していない |
| L2 `search-index` | 全文検索の索引を先に引き、テナント条件が後段にない |
| L3 `parent-reassign` | 移動先プロジェクトの所有テナントを確認していない |
| L4 `cache-key` | 一覧のキャッシュキーにテナント識別子が入っていない |

**評価基準**:

- 同じ `probeLeaks` が、境界の抜けた実装では 4/4、ポリシー層つき実装では 0/4 になる
- L3 で、他テナントのプロジェクトへの移動が拒否される (`WITH CHECK` 相当)
- 所有者セッションが `force` の有無で挙動を変える
- 接続の使い回しで、`SET LOCAL` 相当がないときだけ前テナントの文脈が残る

```text
unguarded api: 4/4 leaks reproduced
  L1 direct-id-read: leaked=true (read tsk_a1 of ten_a)
  L2 search-index: leaked=true (foreign hits=1)
  L3 parent-reassign: leaked=true (moved into prj_a1 of ten_a)
  L4 cache-key: leaked=true (foreign rows=2)
guarded api: 0/4 leaks reproduced
  L1 direct-id-read: leaked=false (not found)
  L2 search-index: leaked=false (foreign hits=0)
  L3 parent-reassign: leaked=false (NotFoundError)
  L4 cache-key: leaked=false (foreign rows=0)
owner bypass: without force=true / with force=false
session pool: without SET LOCAL=true / with SET LOCAL=false
```

模範解答: `code/ch13/tenant-isolation/solution/`

---

<!-- handbook:code-usage:start {"chapter":13} -->
### 第13章のコード集の使い方

<!-- handbook:generated; do not edit -->

コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、章ごとの操作は `--filter` でワークスペースを指定する。

```bash
# 初回のみ。リポジトリ最上位で実行する
pnpm install

# 第13章の模範解答をまとめて検証する
pnpm --filter @handbook/ch13 run test

# 模範解答を個別に実行する
pnpm --filter @handbook/ch13 exec tsx password-hash.solution.ts          # 課題13.1
pnpm --filter @handbook/ch13 exec tsx jwt.solution.ts                    # 課題13.2
pnpm --filter @handbook/ch13 exec tsx oauth-pkce/solution/pkce.ts        # 課題13.3
pnpm --filter @handbook/ch13 exec tsx webhook-signing.solution.ts        # 課題13.4
pnpm --filter @handbook/ch13 exec tsx totp.solution.ts                   # 課題13.5
pnpm --filter @handbook/ch13 exec tsx policy-engine.solution.ts          # 課題13.6
pnpm --filter @handbook/ch13 exec tsx tenant-isolation/solution/main.ts  # 課題13.7
```

開始地点は模範解答と同じ場所に置いてある (`<name>.ts` と `<name>.solution.ts`、またはディレクトリ課題の `starter/` と `solution/`)。課題ごとの完成条件と採点手順は本節の演習カードと `code/ch13/README.md` にある。模範解答の多くは関数を export するだけで、実行して意味のある出力が出るかどうかは課題によって異なる。まず `run test` で通し、個別実行は演習カードのテスト方法に従う。
<!-- handbook:code-usage:end -->


---

## まとめ ― 第III部の総括

第III部では、フロントエンドから届く一つの要求を、信頼できる業務処理へ変えるまでの境界を組み立てた。最初にランタイムの並行性モデルを選び、その上でルーティング、ミドルウェア、依存関係をフレームワークとして構成した。次に、内部処理をREST、GraphQL、RPC、ストリームなどのAPI契約として外部へ公開し、最後に認証、認可、署名、SSOを加えて呼び出し主体と許可範囲を検証した。

障害を調べるときも、この順序は診断の地図になる。要求が届かないなら接続とランタイム、処理順が不正ならルートとミドルウェア、クライアントとの解釈がずれるならAPI契約、正しい形式なのに拒否または漏洩するなら認証・認可の判断を確認する。各層は独立した製品ではなく、前段の出力を次段が追加の保証とともに受け取る関係にある。

ここまでで「誰からのどの要求を、どの処理へ通してよいか」は決められるようになった。しかし、複数の正当な要求が同じ業務状態を同時に更新したとき、値を失わず、制約を守り、後から条件に応じて取り出す方法はまだ扱っていない。第IV部では、認証済みの処理結果を永続化するため、トランザクション、インデックス、データモデル、検索、メッセージングへ進む。

