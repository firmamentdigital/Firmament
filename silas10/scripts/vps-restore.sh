#!/usr/bin/env bash
# Restaura um backup gerado por scripts/vps-backup.sh.
# ATENÇÃO: substitui TODOS os dados atuais (inscrições, acessos, imagens) pelos do backup.
# Uso (na pasta do docker-compose.yml): bash scripts/vps-restore.sh backups/silas10-AAAA-MM-DD_HHMM.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?Informe o arquivo de backup. Ex.: bash scripts/vps-restore.sh backups/silas10-2026-11-20_0300.tar.gz}"
[ -f "$FILE" ] || { echo "Arquivo não encontrado: $FILE"; exit 1; }
CONTENTS="$(tar -tzf "$FILE")"
grep -q '^\./v3/d1/' <<< "$CONTENTS" || { echo "O arquivo não parece um backup do Silas 10."; exit 1; }

read -r -p "Isto substitui todos os dados atuais pelos do backup. Digite RESTAURAR para continuar: " ANSWER
[ "$ANSWER" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

# Trabalha sobre uma cópia, para que nada (nem o backup de segurança abaixo) altere o arquivo escolhido.
SOURCE="$(mktemp --suffix=.tar.gz)"
trap 'rm -f -- "$SOURCE"' EXIT
cp -- "$FILE" "$SOURCE"
chmod 644 "$SOURCE"

echo "Salvando os dados atuais antes de restaurar..."
BACKUP_PREFIX=antes-de-restaurar bash scripts/vps-backup.sh

docker compose stop app
docker compose run --rm --no-deps -T -v "$SOURCE:/restore.tar.gz:ro" app \
  sh -c 'rm -rf /data/v3 && mkdir -p /data && tar -xzf /restore.tar.gz -C /data'
docker compose up -d --no-build app
echo "Restauração concluída a partir de $FILE."
