#!/usr/bin/env bash
set -euo pipefail

# Starter for 8.1 課題8.1: 最小バンドラを書く (★★★)
# Purpose: バンドラの本質は「依存グラフを辿って1ファイルにまとめる」こと。これを自作する。
# TODO:
# - 入力: エントリポイント .js ファイル
# - 出力: 全依存を含む単一の .js ファイル
# - ES Modules の import を解析
# - 各モジュールに ID を振り、ID で require できる関数を生成
# TODO: implement the exercise.
