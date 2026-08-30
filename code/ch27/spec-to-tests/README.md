# 課題27.5: 曖昧な要望を検証可能な仕様へ変換する (★★★)

## 目的

1行の曖昧な要望を、業務ルール、状態遷移、受け入れ条件、API契約、非機能要件まで機械可読な仕様へ落とし、その仕様から受け入れテストを生成して実装を採点する。

## 開始地点

`starter/main.ts`（実行入口は `starter/report.ts`）

## 模範解答

`solution/main.ts`（実行入口は `solution/report.ts`）

## 実行・確認

```bash
pnpm --filter @handbook/ch27 exec tsx spec-to-tests/solution/report.ts
pnpm --filter @handbook/ch27 run test
```

章READMEのコマンドと本文の評価基準に従ってください。仕様データ（`buildInvitationSpec`）と実装（`createInvitationService`）と受け入れテスト（`runAcceptanceChecks`）が同じ1つの仕様を参照していることが、この課題の合否条件です。
