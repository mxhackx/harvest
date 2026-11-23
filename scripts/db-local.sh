#!/usr/bin/env bash
# Postgres local pour le dev : cluster privé dans ~/.local/share/harvest, port 54329.
# Usage : scripts/db-local.sh [start|stop|status|psql]
set -euo pipefail
BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
DIR=${HARVEST_PGDATA:-$HOME/.local/share/harvest/pgdata}
PORT=${HARVEST_PGPORT:-54329}
export PGPASSWORD=harvest

init() {
  [ -d "$DIR" ] && return
  mkdir -p "$DIR"; chmod 700 "$DIR"
  echo harvest > "$DIR.pw"
  "$BIN/initdb" -D "$DIR" -U harvest --pwfile="$DIR.pw" -A scram-sha-256 >/dev/null
  rm -f "$DIR.pw"
}
start() {
  init
  "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$DIR.log" -w start
  for db in harvest harvest_test; do
    "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U harvest -d postgres -tAc \
      "select 1 from pg_database where datname='$db'" | grep -q 1 \
      || "$BIN/createdb" -h 127.0.0.1 -p "$PORT" -U harvest "$db"
  done
  echo "Postgres prêt : postgres://harvest:harvest@localhost:$PORT/harvest"
}
case "${1:-start}" in
  start) start ;;
  stop) "$BIN/pg_ctl" -D "$DIR" stop -m fast ;;
  status) "$BIN/pg_ctl" -D "$DIR" status ;;
  psql) exec "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U harvest -d harvest ;;
  *) echo "usage: $0 [start|stop|status|psql]"; exit 1 ;;
esac
