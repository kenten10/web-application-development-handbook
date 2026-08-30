#!/usr/bin/env bash
set -euo pipefail

# Starter for 21.1 課題21.1: Blue-Green デプロイ実装 (★★★)
# Purpose: ロードバランサのターゲットを瞬間切り替える Blue-Green の挙動を、リアルなプロセス操作で実装。
# TODO:
# - 2バックエンドを別ポートで起動可能(blue: 4001, green: 4002)
# - LB(8080)が現在のアクティブカラーを保持
# - switch コマンドで blue ↔ green を切り替え
# - 切替前にヘルスチェックで新カラーが healthy か確認
# TODO: implement the exercise.
