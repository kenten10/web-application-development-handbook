#!/usr/bin/env bash
set -euo pipefail
ACTION="${1:-up}"
MIGRATIONS_DIR="${2:-migrations}"
DATABASE="${3:-app.sqlite3}"
python3 - "$ACTION" "$MIGRATIONS_DIR" "$DATABASE" <<'PY'
import pathlib, re, sqlite3, sys, time
action, directory, database = sys.argv[1:]
root = pathlib.Path(directory)
if action not in {'up','down','status'}: raise SystemExit('Usage: main.sh up|down|status MIGRATIONS_DIR DATABASE')
pattern = re.compile(r'^(\d{3,})[_-].+\.sql$')
files = sorted((int(m.group(1)), path) for path in root.glob('*.sql') if (m := pattern.match(path.name)))
conn = sqlite3.connect(database)
conn.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, filename TEXT NOT NULL, applied_at INTEGER NOT NULL)')
applied = {row[0] for row in conn.execute('SELECT version FROM schema_migrations')}
def parts(path):
    text=path.read_text(); marker='-- +migrate Down'; return (text.split(marker,1)+[''])[:2]
if action == 'up':
    for version,path in files:
        if version in applied: continue
        up,_=parts(path)
        with conn:
            conn.executescript(up)
            conn.execute('INSERT INTO schema_migrations VALUES(?,?,?)',(version,path.name,int(time.time())))
        print(f'applied {path.name}')
elif action == 'down':
    row=conn.execute('SELECT version, filename FROM schema_migrations ORDER BY version DESC LIMIT 1').fetchone()
    if not row: print('nothing to rollback')
    else:
        version,filename=row; path=root/filename; _,down=parts(path)
        if not down.strip(): raise SystemExit(f'{filename} has no -- +migrate Down section')
        with conn:
            conn.executescript(down)
            conn.execute('DELETE FROM schema_migrations WHERE version=?',(version,))
        print(f'rolled back {filename}')
else:
    for version,path in files: print(f'{"up" if version in applied else "pending"}\t{path.name}')
PY
