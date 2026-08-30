#!/usr/bin/env bash
set -euo pipefail

# Starter for 21.2 課題21.2: Canary デプロイ実装 (★★★)
# Purpose: トラフィック比率を段階的に新バージョンに振る Canary の実装。
# TODO:
# - 旧(stable)と新(canary)バックエンドを起動
# - LB はリクエストごとに比率で振り分け
# - メトリクス収集: 各バージョンのエラー率、レイテンシ
# - エラー率上昇で自動ロールバック
# TODO: implement the exercise.
