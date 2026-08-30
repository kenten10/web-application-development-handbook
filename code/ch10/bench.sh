#!/usr/bin/env bash
set -euo pipefail

# Starter for 10.1 課題10.1: シンプル echo サーバのベンチマーク (★★)
# Purpose: 同じ仕様の echo サーバを Node.js で書いて、wrk や autocannon で性能計測する。
# TODO:
# - TCP echo サーバ(受け取った文字列をそのまま返す)
# - HTTP echo サーバ
# - 同時 1000 接続でスループット計測
# - イベントループのブロック耐性を確認(CPU 重い処理を混ぜると?)
# TODO: implement the exercise.
