# 第19章 コンテナとオーケストレーション — コード教材

## 前提環境

- Node.js 24.18.0 LTS
- pnpm 11.15.1
- TypeScript 6.0.3

## 共通コマンド

```bash
pnpm install
pnpm --filter @handbook/ch19 run lint
pnpm --filter @handbook/ch19 run typecheck
pnpm --filter @handbook/ch19 run test
pnpm --filter @handbook/ch19 run build
```

> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。

## 課題一覧

| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |
|---|---|---|---:|---:|---|
| 19.1 課題19.1: Dockerfile 最適化を計測 (★★) | `dockerfile-optimization/starter/main.sh` | `dockerfile-optimization/solution/main.sh` | ★★ | 190分 | Docker |
| 19.2 課題19.2: K8s manifest 検証ツール (★★★) | `manifest-validator/starter/main.ts` | `manifest-validator/solution/main.ts` | ★★★ | 150分 | なし |
| 19.3 課題19.3: ローリングアップデート シミュレーション (★★) | `rollout-simulator.ts` | `rollout-simulator.solution.ts` | ★★ | 90分 | なし |
| 19.4 課題19.4: 簡易 PID 1 init プロセス (★★) | `mini-init.ts` | `mini-init.solution.ts` | ★★ | 90分 | Docker |

## 課題詳細

### 19.1 課題19.1: Dockerfile 最適化を計測 (★★)

**目的**: 「レイヤキャッシュ」「マルチステージビルド」の効果を実測。

**難易度**: ★★

**推定時間**: 190分 (計測対象アプリと3種の Dockerfile 作成に50分、ベースイメージの初回取得 (約1.9GB) に25分、初回と再ビルドの時間計測に45分、`docker history` と `docker run` での確認に40分、サイズとレイヤの比較記録に30分)

**必要サービス**: Docker

**前提**

- 19.2 Dockerfile のベストプラクティス を読み、レイヤキャッシュとマルチステージビルドの狙いを押さえる
- 19.3 .dockerignore の重要性 を読み、ビルドコンテキストに何が送られるかを把握する
- `docker build` と `docker images` が実行できる Docker Engine が動作している (未導入でも main.sh の静的解析部分は動く)
- 計測対象になる小さな Node.js アプリ (package.json と src) を用意できる

**完成条件 (自己採点用チェックリスト)**

- [ ] naive と cached と multi-stage の3つの Dockerfile を用意し、`docker images` のサイズを3件とも記録する
- [ ] ソースを1行だけ変更した後の再ビルド時間を3種類で計測し、cached と multi では依存インストール層が CACHED になることをログで確認する
- [ ] solution/main.sh が naive_mutating_layers と optimized_stages の2値を出力し、optimized_stages が 3 になる
- [ ] multi-stage 版の最終イメージにビルド専用の中間生成物が含まれないことを `docker run --rm app:multi ls /app` で確認する
- [ ] COPY の順序を入れ替えた版を作り、キャッシュが効かなくなることを再ビルド時間で示す

**期待出力**

- `bash code/ch19/dockerfile-optimization/solution/main.sh` が naive_mutating_layers=3、optimized_stages=3、workdir=(生成先)、docker_benchmark=skipped の4行を出力する。`RUN_DOCKER_BENCH=1` を付けて Docker のある環境で実行すると、naive と cached と multi の3イメージを実際に build し、初回ビルド時間・ソース1行変更後の再ビルド時間・イメージサイズを行ごとに出力して docker_benchmark=done で終わる
- Docker がある環境では multi-stage 版が naive の 1/5 前後になる。絶対値はベースイメージのCPUアーキテクチャで変わるため (実測例: amd64 で naive 401MB / multi 81MB、arm64 で naive 1.62GB / multi 348MB)、固定値ではなく倍率で比較する
- コード1行変更後の再ビルドで、naive は依存インストールからやり直し、cached は数秒で完了する

**観察項目**

- `docker build --progress=plain` の出力で CACHED と表示される行がどこまで続くかを、3つの Dockerfile で比較する
- `docker history app:multi` で各レイヤのサイズを見て、どの命令が容量を占めているか確認する
- package.json だけを変更した場合と src だけを変更した場合で、キャッシュが壊れる位置が変わることを確認する
- runtime ステージのベースを bookworm から bookworm-slim へ変えたときのサイズ差を記録する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch19 run test` を実行し、Dockerfile optimization script emits both strategies が通ることを確認する
2. `bash code/ch19/dockerfile-optimization/solution/main.sh /tmp/dockerfile-bench` を実行し、生成された naive/Dockerfile と optimized/Dockerfile を目視で比較する
3. Docker のある環境で `RUN_DOCKER_BENCH=1 bash code/ch19/dockerfile-optimization/solution/main.sh` を実行し、skipped 行が出ないことを確認する
4. `docker images` の出力で multi タグのサイズが3つの中で最小なら合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 先に「何を測るか」を決める。イメージサイズ、初回ビルド時間、1行変更後の再ビルド時間の3指標に絞れば Dockerfile の差が数字で出る
2. 構造: optimized 版は deps と build と runtime の3ステージに分け、deps では package.json とロックファイルだけを COPY してから install する。runtime へは COPY --from=build で成果物だけを持ち込む
3. 実装の要点: キャッシュが効くかどうかは COPY の粒度で決まる。COPY . . を install より前に置いた瞬間、どのファイルを触っても install がやり直しになる。計測時に --no-cache 付きと通常ビルドを取り違えないこと

**本番利用時の警告**

- この比較用 Dockerfile はベースイメージをタグ (node:24-bookworm) で指定しており digest を固定していない。本番では同じタグでも中身が入れ替わり、再ビルドで別のイメージができて再現性を失うため digest のピン留めが必要
- 計測のために大量のイメージとビルドキャッシュが残る。終了後は `docker rmi app:naive app:cached app:multi` と `docker builder prune -f` で、この演習が作ったものだけを消す。`docker system prune -a` はホスト上の未使用イメージを**すべて**削除するため、他のプロジェクトのイメージまで巻き込む。共有CIランナー上で計測するとディスクを埋めて他ジョブを止める

**導線**

- 開始地点: `dockerfile-optimization/starter/main.sh`
- 模範解答: `dockerfile-optimization/solution/main.sh`

### 19.2 課題19.2: K8s manifest 検証ツール (★★★)

**目的**: Kubernetes の YAML マニフェストを静的解析する社内ツールを書く。実プロダクトで kube-score、polaris、kubeval 等が果たす役割を自作する。

**難易度**: ★★★

**推定時間**: 150分 (簡易YAMLパーサの実装に55分、6ルールの実装と issue 型の整理に50分、良い例と悪い例での検証および既製ツール比較に45分)

**必要サービス**: なし

**前提**

- 19.6 Kubernetes の YAML を読み、Deployment の spec.template.spec.containers の階層を把握する
- 19.7 Probes ― Liveness と Readiness を読み、readinessProbe が無い場合の影響を押さえる
- TypeScript で再帰的にオブジェクトを走査する関数を書ける
- 検証対象となる Deployment マニフェストを、良い例と悪い例の2つ以上用意できる

**完成条件 (自己採点用チェックリスト)**

- [ ] parseSimpleYaml が入れ子のマップをインデントから復元し、true/false/null/数値をスカラーとして型変換する
- [ ] ManifestValidator.validate が severity と rule と message と path の4キーを持つ配列を返す
- [ ] image が latest タグまたはタグ無しの場合に rule=no-latest-tag の warning を返す
- [ ] resources と readinessProbe の欠落でそれぞれ require-resources と require-readiness-probe の warning を返す
- [ ] securityContext.privileged が true の場合に severity=error の no-privileged を返す
- [ ] kind が無いマニフェストで required-kind の error を返す

**期待出力**

- 問題だらけの Deployment に対して no-latest-tag、require-resources、require-readiness-probe、no-privileged を含む4件以上の issue が返る
- すべての項目を満たしたマニフェストでは空配列が返る
- 各 issue の path が spec.template.spec.containers[].image のような指摘位置の文字列になっている

**観察項目**

- 同じマニフェストを kube-score や kubeval にも掛け、自作の指摘と既製ツールの指摘の差分を数える
- インデントだけを変えたYAMLを食わせ、簡易パーサが行頭ハイフンの配列を無視することによる検出漏れを確認する
- privileged: true を securityContext の外側に置いた場合でも再帰探索が拾ってしまう (位置を見ていない) ことを確認する
- replicas を1にした場合と3にした場合で、可用性ルールを足したときの出力差を比較する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch19 run test` を実行し、manifest validator finds operational and security issues が通ることを確認する
2. code/ch19 で `tsx --test solutions.test.ts` を実行し、parseSimpleYaml の kind が Deployment、issues に no-latest-tag と no-privileged が含まれることを確認する
3. 手元の実マニフェストを validate に掛け、既知の問題 (latest タグなど) が検出されれば合格

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「YAMLを読む」と「ルールを当てる」を完全に分ける。パースは辞書を返すだけにし、ルールはその辞書に対する述語として書く
2. 構造: パーサはインデント量をキーにしたスタックで親を辿る。ルール側は path 文字列を分割して辿る取り出しと、キー名で再帰探索する取り出しの2種類を用意する
3. 実装の要点: 行頭ハイフンの配列まで扱うと一気に複雑になるので、まずマップだけ対応して割り切る。その場合 containers 配下を path で辿れないため、image のようなキーは再帰探索で拾う必要がある

**本番利用時の警告**

- この簡易パーサは配列、アンカー、区切り線による複数ドキュメント、複数行文字列を扱えない。実運用のマニフェストへ適用すると検出漏れを正常と誤認するため、CIのゲートに使うなら kubeval や kube-score のような本物のスキーマ検証を併用する
- privileged の検出はキー名の再帰探索であり階層を見ていない。無関係な位置の同名キーで誤検知し、配列内の2つ目のコンテナは見落とす。ポリシーの強制は Kyverno や Gatekeeper のような Admission Controller 側で行う

**導線**

- 開始地点: `manifest-validator/starter/main.ts`
- 模範解答: `manifest-validator/solution/main.ts`

### 19.3 課題19.3: ローリングアップデート シミュレーション (★★)

**目的**: Kubernetes の maxSurge / maxUnavailable 設定が実際にどう動くか観察。

**難易度**: ★★

**推定時間**: 90分 (surge と unavailable の計算式の設計と実装に40分、ステップ出力と収束確認に25分、失敗率と極端な設定値での挙動比較に25分)

**必要サービス**: なし

**前提**

- 19.5 Kubernetes ― 大規模なオーケストレーション を読み、Deployment が ReplicaSet を通じて Pod 数を収束させる流れを押さえる
- 19.7 Probes ― Liveness と Readiness を読み、Ready でない Pod が Service から外れることを把握する
- maxSurge と maxUnavailable が replicas に対する比率であることを理解している

**完成条件 (自己採点用チェックリスト)**

- [ ] replicas=10、maxSurge=0.25、maxUnavailable=0.25 の execute() が状態の配列を返し、最終要素の newReady が 10 になる
- [ ] 全ステップで total(旧と新の合計) が replicas + maxSurge の上限である 13 を超えない
- [ ] 各ステップで step と oldReady と newReady と unavailable と total の5フィールドが記録される
- [ ] newPodFailureRate を 1 にすると進行不能となり rollout cannot make progress が投げられる
- [ ] random を固定関数で注入すると、同じ入力から同じ状態列が再現できる

**期待出力**

- `tsx rollout-simulator.solution.ts` が1ステップ1行のJSONを出力し、step/oldReady/newReady/unavailable/total の5キーを持つ
- maxSurge が 25% の設定では total の最大が 13、最終行が oldReady=0 かつ newReady=10 になる
- newPodFailureRate を上げるとステップ数が増え、失敗率1.0では例外で終了する

**観察項目**

- maxSurge=0 かつ maxUnavailable=0 を渡し、どちらも動かせないため実装が最低1へクランプしていることを確認する
- maxSurge=1.0 かつ maxUnavailable=0 にすると総 Pod 数が一時的に 20 まで増える Blue-Green 相当の挙動になることを確認する
- unavailable の推移を見て、maxUnavailable が「同時に何台まで落としてよいか」に対応していることを確認する
- newPodFailureRate を 0.3 にして複数回実行し、収束までのステップ数のばらつきを記録する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch19 run test` を実行し、rollout respects surge and converges が通ることを確認する
2. `tsx code/ch19/rollout-simulator.solution.ts` を実行し、最終行の newReady が 10 かつ全行の total が 13 以下なら合格
3. 固定乱数を注入した2回の実行で出力が完全に一致することを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: 「1ステップで何台作れて何台消せるか」を先に式にする。作れる数は replicas + maxSurge から現在の総数を引いた値、消せる数は現在の総数から replicas - maxUnavailable を引いた値
2. 構造: 状態は oldReady と newReady の2変数で足りる。ループ条件を newReady < replicas とし、1ステップごとに状態を配列へ push して後から検証できるようにする
3. 実装の要点: maxSurge も maxUnavailable も 0 になると1台も動かせず無限ループになる。最低1へクランプするか、進行不能を検知して例外にする分岐を必ず入れる

**本番利用時の警告**

- このシミュレータは Pod の起動時間、readinessProbe の待ち、PodDisruptionBudget、ノード容量をすべて無視している。実クラスタで同じ設定を使うと、起動の遅いアプリでは Ready 待ちの間に旧 Pod が先に消え、一時的な容量不足で 5xx が出る
- 失敗した新 Pod を「リトライすれば成功しうる」と単純化しているため、イメージ取得失敗のような恒久的失敗をロールバックできない。本番では progressDeadlineSeconds と自動ロールバックの設定が必要

**導線**

- 開始地点: `rollout-simulator.ts`
- 模範解答: `rollout-simulator.solution.ts`

### 19.4 課題19.4: 簡易 PID 1 init プロセス (★★)

**目的**: コンテナで PID 1 として動くプロセスの役割 (ゾンビ回収、シグナル伝搬) を理解。

**難易度**: ★★

**推定時間**: 90分 (spawn と exit 待ちの実装に25分、4シグナルの転送とハンドラ解除に35分、docker --init の有無の比較とゾンビ観察に30分)

**必要サービス**: Docker

**前提**

- 19.1 コンテナの仕組み を読み、コンテナ内の PID 1 が特別扱いされることを押さえる
- 18.3 シグナル ― プロセス間通信の基礎 を読み、シグナルのデフォルト動作と PID 1 の例外を把握する
- node:child_process の spawn と exit イベントを扱える
- `docker run --init` の有無を切り替えて検証できる Docker 環境がある

**完成条件 (自己採点用チェックリスト)**

- [ ] runInit(command, args) が子プロセスを spawn し、終了コードで解決する Promise を返す
- [ ] runInit で process.exit(7) する子を起動すると 7 が返る
- [ ] SIGTERM と SIGINT と SIGHUP と SIGQUIT の4シグナルを親が受けたら子へ転送する
- [ ] 子がシグナルで終了した場合に 128 とシグナル番号の和 (SIGTERM なら 143) を返す
- [ ] 子の exit 後にシグナルハンドラを解除し、ハンドラが積み上がらない

**期待出力**

- `tsx mini-init.solution.ts sleep 30` を起動して別端末から `kill -TERM <pid>` を送ると、sleep も同時に終了し親が 143 で終わる
- 引数なしで起動すると usage 行を標準エラーへ出し、終了コード 64 で終わる
- 子の終了コードがそのまま親の終了コードに伝わる

**観察項目**

- init を使わずにアプリを直接 PID 1 にして `time docker stop` を計測し、10秒待って SIGKILL になることを確認する
- `ps -o pid,ppid,stat,comm` で子の親が init プロセスであること、終了直後に STAT が Z(ゾンビ) になるかを確認する
- `docker run --init` を付けた場合、PID 1 が docker-init になり自作 init が PID 2 になることを確認する
- 孫プロセスを作ってから親を殺し、孤児が PID 1 に引き取られる様子を確認する

**テスト方法 (自己採点手順)**

1. `pnpm --filter @handbook/ch19 run test` を実行し、mini init returns child exit code が通ることを確認する
2. `tsx code/ch19/mini-init.solution.ts sleep 30` を起動し、SIGTERM 後に `ps aux` で sleep が残っていなければ合格
3. `tsx code/ch19/mini-init.solution.ts node -e 'process.exit(3)'` の後に `echo $?` が 3 を返すことを確認する

**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)

1. 方針: init の仕事は「起動する」「シグナルを中継する」「終了コードを返す」の3つ。まず spawn して exit を待つだけの版を作り、そこへシグナル転送を足す
2. 構造: spawn は stdio を inherit にして子の出力をそのまま流す。転送したいシグナルの配列をループして process.on でハンドラを登録し、exit 時に process.off で必ず外す
3. 実装の要点: 終了コードの扱いが落とし穴。exit イベントの第2引数が非 null のときは code が null になるため、128 とシグナル番号の和へ変換しないとシェルから見た終了コードが化ける

**本番利用時の警告**

- Node.js の spawn では POSIX の waitpid を直接扱えず、引き取った孤児プロセスを刈り取る本来のゾンビ回収はできない。コンテナで本気で PID 1 を務めるなら tini や dumb-init、あるいは `docker run --init` を使う
- この init は親が先に落ちると子が孤児として残る。CI やコンテナで多重起動すると sleep や node のプロセスが積み上がりホストのプロセステーブルを消費するので、実験後は `pgrep -af mini-init` で対象を確かめてから `kill` する。`pkill -f` はコマンドライン全体への一致で消すため、同じ文字列を含む無関係なプロセス (エディタの検索など) まで巻き込む

**導線**

- 開始地点: `mini-init.ts`
- 模範解答: `mini-init.solution.ts`

## 評価方法

1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。
2. 期待出力・観察項目を記録する。
3. 完成条件のチェックリストで自己採点し、未達項目を残す。
4. solutionとの差分を説明する。
5. `pnpm --filter @handbook/ch19 run test` を実行する。

## 安全上の注意

- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。
- 教材用の簡略実装をそのまま本番へ投入しないでください。
- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。

## 配布対象外

`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。
