#!/usr/bin/env bash
# Periodic Postgres dump -> gzip -> local retention + off-host S3 copy.
# Loops in-container (no host cron needed). Failures are loud but never kill the
# loop, so one bad night doesn't stop all future backups.
set -uo pipefail

INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP_LOCAL="${KEEP_LOCAL:-7}"
OUT_DIR=/backups

log() { echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "$OUT_DIR"
log "started: db=${PGDATABASE} host=${PGHOST} interval=${INTERVAL}s keep_local=${KEEP_LOCAL} s3=${S3_BUCKET:-<none>}"

while true; do
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  name="${PGDATABASE}-${ts}.sql.gz"
  tmp="/tmp/${name}"

  log "dumping ${PGDATABASE}..."
  if pg_dump --no-owner --no-privileges | gzip -9 > "$tmp"; then
    size="$(stat -c%s "$tmp" 2>/dev/null || echo 0)"
    if [ "$size" -lt 1000 ]; then
      log "ERROR: dump suspiciously small (${size} bytes) - keeping it but check the DB"
    fi
    log "dump ok (${size} bytes)"

    # Keep a local copy (fast restore) with simple retention.
    cp "$tmp" "$OUT_DIR/$name" && log "local copy -> $OUT_DIR/$name"
    # shellcheck disable=SC2012
    ls -1t "$OUT_DIR"/*.sql.gz 2>/dev/null | tail -n "+$((KEEP_LOCAL + 1))" | while read -r old; do
      rm -f "$old" && log "pruned old local backup $(basename "$old")"
    done

    # Off-host copy - this is what survives losing the VPS/disk.
    if [ -n "${S3_BUCKET:-}" ]; then
      ep=""
      [ -n "${S3_ENDPOINT_URL:-}" ] && ep="--endpoint-url ${S3_ENDPOINT_URL}"
      # shellcheck disable=SC2086
      if aws s3 cp $ep "$tmp" "s3://${S3_BUCKET}/backups/${name}"; then
        log "uploaded off-host -> s3://${S3_BUCKET}/backups/${name}"
      else
        log "ERROR: S3 upload FAILED - this backup is local-only!"
      fi
    else
      log "WARN: S3_BUCKET unset - local-only backup (a disk loss would still be fatal)"
    fi
  else
    log "ERROR: pg_dump FAILED"
  fi

  rm -f "$tmp"
  sleep "$INTERVAL"
done
