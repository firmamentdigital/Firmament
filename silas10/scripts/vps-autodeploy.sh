#!/usr/bin/env bash
# Deploy automático do Silas 10 na VPS.
# Roda pelo cron a cada 2 minutos (instalado por scripts/vps-autodeploy-install.sh):
#   1. busca a branch de deploy no GitHub;
#   2. se houver versão nova na pasta silas10/: backup → monta → sobe → confere a saúde;
#   3. se a montagem falhar ou o sistema não ficar saudável, volta para a versão anterior.
# Log: /var/log/silas10-autodeploy.log
#
# Todo o corpo fica dentro de main(): o bash lê a função inteira antes de executar,
# então o próprio script pode ser atualizado pelo deploy sem quebrar a execução.

main() {
  set -euo pipefail
  exec 9>/var/lock/silas10-autodeploy.lock
  flock -n 9 || exit 0                       # já existe um deploy em andamento

  local app_dir repo_dir branch current target port
  app_dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
  repo_dir="$(git -C "$app_dir" rev-parse --show-toplevel)"
  branch="${DEPLOY_BRANCH:-$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD)}"
  log() { echo "[$(date '+%F %T')] $*"; }

  cd "$repo_dir"
  if ! git fetch -q origin "$branch" 2>/tmp/silas10-fetch.err; then
    log "ERRO ao consultar o GitHub: $(tr '\n' ' ' </tmp/silas10-fetch.err)"
    exit 1
  fi
  current="$(git rev-parse HEAD)"
  target="$(git rev-parse "origin/$branch")"
  [ "$current" = "$target" ] && exit 0      # nada novo: sai em silêncio
  local failed_file=/var/lib/silas10-autodeploy/falhou
  mkdir -p "$(dirname "$failed_file")"
  # Versão que já falhou: não tenta de novo até chegar um commit mais novo.
  [ "$(cat "$failed_file" 2>/dev/null)" = "$target" ] && exit 0

  if git diff --quiet "$current" "$target" -- silas10; then
    git reset -q --hard "$target"
    log "Commit ${target:0:7} sem mudanças no Silas 10. Código atualizado, sem reiniciar."
    exit 0
  fi

  log "Nova versão encontrada: ${current:0:7} → ${target:0:7} ($(git log -1 --format=%s "$target"))"
  cd "$app_dir"

  # Espera o sistema ficar saudável (até 3 minutos). Desiste na hora se o
  # container cair/reiniciar sozinho, para encurtar o tempo fora do ar.
  wait_healthy() {
    local port state restarts
    port="$(grep -E '^PORT=' .env | cut -d= -f2 || true)"; port="${port:-8787}"
    for _ in $(seq 1 90); do
      sleep 2
      state="$(docker inspect -f '{{.State.Status}}' silas10 2>/dev/null || echo ausente)"
      restarts="$(docker inspect -f '{{.RestartCount}}' silas10 2>/dev/null || echo 0)"
      if [ "$state" != running ] || [ "$restarts" -gt 0 ]; then return 1; fi
      if [ "$(docker inspect -f '{{.State.Health.Status}}' silas10 2>/dev/null)" = healthy ] \
         && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")" = 200 ]; then
        return 0
      fi
    done
    return 1
  }

  rollback() {
    log "Voltando para a versão anterior ${current:0:7}..."
    git -C "$repo_dir" reset -q --hard "$current"
    if docker compose up -d --build >/tmp/silas10-rollback.log 2>&1 && wait_healthy; then
      log "Versão anterior restaurada e no ar."
    else
      log "ATENÇÃO: a versão anterior não voltou saudável. Veja /tmp/silas10-rollback.log e 'docker compose logs app'."
    fi
  }

  git -C "$repo_dir" reset -q --hard "$target"
  chown 1000:1000 .env 2>/dev/null || true

  if ! docker compose build >/tmp/silas10-build.log 2>&1; then
    log "FALHA na montagem da nova versão (o site seguiu no ar com a versão anterior). Detalhes: /tmp/silas10-build.log"
    git -C "$repo_dir" reset -q --hard "$current"
    echo "$target" > "$failed_file"
    exit 1
  fi

  # Montagem ok: backup dos dados imediatamente antes de trocar a versão no ar.
  bash scripts/vps-backup.sh
  docker compose up -d >/dev/null 2>&1

  if ! wait_healthy; then
    log "FALHA: a nova versão não iniciou corretamente."
    docker compose logs --tail 40 app >/tmp/silas10-falha.log 2>&1 || true
    rollback
    echo "$target" > "$failed_file"
    exit 1
  fi
  rm -f "$failed_file"

  docker image prune -f >/dev/null 2>&1 || true
  log "OK: versão ${target:0:7} no ar."
}
main "$@"; exit $?
