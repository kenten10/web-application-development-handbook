# コード教材の標準ツールチェーン

基準日: 2026-07-29

この文書は、全30章のサンプルコードを同じ入口からセットアップ・検証するための共通方針を定める。章固有のフレームワークや外部サービスは各章の `README.md` と `package.json` で追加する。

## 1. 保証バージョン

| ツール | 固定バージョン | 方針 |
|---|---:|---|
| Node.js | 24.18.0 | LTS系統の24.xを保証対象とし、`.node-version` と `.nvmrc` は検証済みパッチへ固定する |
| pnpm | 11.15.1 | `packageManager` とlockfileで固定する |
| TypeScript | 6.0.3 | Vue、Svelte、Astro等を含む広い教材互換性を優先する |
| `@types/node` | 24.12.1 | Node.js 24系に合わせる |
| `tsx` | 4.23.1 | TypeScript教材の直接実行に使う章だけが宣言する |

Node.js 26はCurrentであり、教材の標準環境には採用しない。TypeScript 7は正式リリース済みだが、7.0時点では安定したコンパイラAPIを提供せず、埋め込み型ツールの一部はTypeScript 6の継続利用が推奨されている。このためv1.0ではTypeScript 6.0.3を標準とし、TypeScript 7の検証は章別の明示的な実験に限定する。

一次資料:

- https://nodejs.org/en/about/previous-releases
- https://pnpm.io/installation
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

## 2. 初回セットアップ

### 2.1 Node.js

`mise`、`asdf`、`nvm`、`fnm`等を利用して `.node-version` または `.nvmrc` のバージョンを導入する。

```bash
node --version
# v24.18.0
```

### 2.2 pnpm

Node.js同梱のCorepackを利用する場合も、署名情報の更新を受けるためCorepack自体を先に更新する。

```bash
npm install --global corepack@latest
corepack enable pnpm
corepack prepare pnpm@11.15.1 --activate
pnpm --version
# 11.15.1
```

Corepackを使わない場合:

```bash
npm install --global pnpm@11.15.1
```

### 2.3 依存関係

```bash
pnpm install
pnpm run validate:workspace
```

初回の `pnpm install` で共有 `pnpm-lock.yaml` を生成する。KEN-54で全章の依存関係を確定した後にlockfileをコミットし、KEN-55のCIでは `pnpm install --frozen-lockfile` を使用する。

## 3. 統一コマンド

| コマンド | 内容 |
|---|---|
| `pnpm install` | ルートから全workspaceの依存関係を再現する |
| `pnpm run lint` | 各章のlintを実行する。未対応章は例外台帳へ理由を残す |
| `pnpm run typecheck` | 各章の型検査を実行する |
| `pnpm run test` | 原稿生成スクリプトの回帰テストと各章テストを実行する |
| `pnpm run build` | ビルドを必要とする章を検証する |
| `pnpm run check:workspace` | workspace構成と上記4検査をまとめて実行する |
| `pnpm run check:handbook` | 本文・目次・索引・学習メタデータを検証する |

スクリプトが存在しない章を黙って無視しない。暫定的に対象外とする場合は `config/workspace-exceptions.json` にLinear issue、理由、対象タスクを記録する。

## 4. ルートと章別package.jsonの責務

### 4.1 ルート

ルートが管理するもの:

- Node.js、pnpm、TypeScript等の標準バージョン
- `pnpm-workspace.yaml` と共有lockfile
- TypeScript共通設定
- 全章を横断する統一コマンド
- 章別例外の台帳
- 原稿の生成・検証スクリプト

ルートへ章固有の実行時依存を追加しない。React、Zod、Express、データベースドライバ等は利用する章が宣言する。

### 4.2 `code/chXX/package.json`

各章が管理するもの:

- `@handbook/chXX` 形式の一意なpackage名
- `private: true`
- 章固有のdependenciesとdevDependencies
- 実際に実行できる `lint`、`typecheck`、`test`、`build`
- 演習実行用の補助コマンド
- Node.js以外のランタイム条件や外部サービス条件

共通ツールのバージョンは `pnpm-workspace.yaml` のcatalogを参照する。

## 5. TypeScript共通設定

`tsconfig.base.json` はNode.js向け教材の安全な既定値を提供する。各章は次のように継承する。

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

ブラウザ、React、Vue、Svelte、Bundler、CommonJS等の章は `lib`、`jsx`、`moduleResolution`、`types`を章側で明示的に上書きする。

## 6. Dockerを使う基準

Dockerは次のいずれかを満たす章だけで使う。

- PostgreSQL、Redis、Kafka等の外部サービスが必要
- Linuxカーネル、namespace、cgroup、ネットワーク分離を観察する
- 脆弱コードや攻撃再現をホストから隔離する
- OS差分を排除しないと再現性が得られない

純粋なJavaScript・TypeScript、ブラウザAPI、アルゴリズムだけの演習ではDockerを必須にしない。Docker利用章はイメージのタグまたはdigest、公開ポート、永続データ、停止・削除手順をREADMEへ記載する。

## 7. 例外管理

`config/workspace-exceptions.json` は移行期間だけ使用する。各例外には以下が必要である。

- workspace package名
- 未対応タスク
- 解消を追跡するLinear issue
- 省略理由

KEN-54で全章の命名とREADMEを整備し、KEN-55でCIを構築した後、必須章の例外は0件にする。
