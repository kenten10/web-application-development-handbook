#!/usr/bin/env bash
set -euo pipefail

# Starter for 12.5 課題12.5: SSE でサーバプッシュ通知 (★)
# Purpose: WebSocket より軽量な SSE で「サーバから一方向プッシュ」を実装。
# TODO:
# - /events エンドポイントが接続を保持
# - イベントタイプ(stock-update、user-online、notification)
# - 自動再接続(ブラウザ標準)
# - ID で再開(Last-Event-ID ヘッダ)
# TODO: implement the exercise.
