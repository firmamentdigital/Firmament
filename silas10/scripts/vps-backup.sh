#!/usr/bin/env bash
# Backup do Silas 10 na VPS: banco (inscrições, acessos, avisos) + imagens enviadas.
# Uso (na pasta do docker-compose.yml): bash scripts/vps-backup.sh
# Agendar diariamente às 3h:  crontab -e  →  0 3 * * * cd /opt/silas10 && bash scripts/vps-backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
PREFIX="${BACKUP_PREFIX:-silas10}"
DEST="backups"
WORK="$DEST/.tmp-$STAMP"
OUT="$DEST/$PREFIX-$STAMP.tar.gz"
mkdir -p "$DEST"
[ ! -e "$OUT" ] || { echo "Já existe $OUT. Aguarde um segundo e tente de novo."; exit 1; }

# 1) Cópia consistente do banco e das imagens dentro do container.
docker compose exec -T app node scripts/vps-snapshot.mjs /tmp/snapshot

# 2) Traz a cópia para a VPS, compacta e limpa.
docker compose cp app:/tmp/snapshot "$WORK" >/dev/null
tar -czf "$OUT" -C "$WORK" .
rm -rf -- "$WORK"
docker compose exec -T app rm -rf /tmp/snapshot

# 3) Mantém só os últimos KEEP_DAYS dias.
find "$DEST" -maxdepth 1 -name "$PREFIX-*.tar.gz" -mtime +"$KEEP_DAYS" -delete

echo "Backup criado: $OUT ($(du -h "$OUT" | cut -f1))"
