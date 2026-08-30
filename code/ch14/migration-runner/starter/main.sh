#!/usr/bin/env bash
set -euo pipefail

# Starter for 14.5 課題14.5: マイグレーション Runner 自作 (★★)
# Purpose: Flyway や Rails Migration の動作原理を自作する。
#
# 使い方 (このCLIの形に合わせて実装する):
#   bash main.sh status <migrations_dir> <sqlite_file>
#   bash main.sh up     <migrations_dir> <sqlite_file>
#   bash main.sh down   <migrations_dir> <sqlite_file>
#
# TODO:
# - ファイル名規則: 001_create_users.sql, 002_add_email_index.sql
#   (先頭の数字が版番号。昇順に適用する)
# - 各SQLファイルは「up の SQL」「-- +migrate Down」「down の SQL」の順に書く。
#   マーカーは大文字小文字まで一致させること
# - schema_migrations テーブルで適用済みの版番号を記録する
# - up で未適用のものだけを順番に適用、down で最後に適用した1件だけを巻き戻す
# - 適用済みを再適用しない (up を2回続けて実行したら2回目の出力は空)
# - 1ファイル1トランザクションで囲む
