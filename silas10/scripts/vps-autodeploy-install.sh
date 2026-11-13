#!/usr/bin/env bash
# Instala o deploy automático do Silas 10 na VPS (rodar UMA vez, como root).
#
# O que faz:
#   1. cria uma chave de acesso somente leitura ao GitHub (Deploy key), se ainda não existir;
#   2. clona o repositório em /opt/firmament (código gerenciado pelo git);
#   3. leva .env e backups da instalação atual para lá e aponta /opt/silas10 para a nova pasta;
#   4. sobe o sistema a partir da nova pasta (mesmo container, mesmo volume de dados);
#   5. agenda o deploy automático a cada 2 minutos no cron.
#
# Uso:   bash /opt/silas10/scripts/vps-autodeploy-install.sh
# Variáveis opcionais: DEPLOY_BRANCH, REPO_URL, REPO_DIR, APP_LINK
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-claude/practical-fermi-y6yde0}"
REPO_URL="${REPO_URL:-git@github.com:firmamentdigital/Firmament.git}"
REPO_DIR="${REPO_DIR:-/opt/firmament}"
APP_LINK="${APP_LINK:-/opt/silas10}"
KEY="/root/.ssh/silas10_deploy"
APP_DIR="$REPO_DIR/silas10"
say() { echo; echo "== $*"; }

[ "$(id -u)" = 0 ] || { echo "Rode como root."; exit 1; }

# 1. Chave de acesso ao GitHub (só para endereços SSH git@github.com).
if [[ "$REPO_URL" == git@github.com:* ]]; then
  if [ ! -f "$KEY" ]; then
    mkdir -p /root/.ssh && chmod 700 /root/.ssh
    ssh-keygen -q -t ed25519 -N "" -C "silas10-vps-deploy" -f "$KEY"
  fi
  export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  if ! $GIT_SSH_COMMAND -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    say "FALTA UM PASSO NO GITHUB"
    echo "Copie a chave abaixo (a linha inteira, começa com ssh-ed25519):"
    echo
    cat "$KEY.pub"
    echo
    echo "No GitHub: repositório Firmament → Settings → Deploy keys → Add deploy key"
    echo "  Title: VPS Silas 10    Key: cole a linha acima    NÃO marque 'Allow write access'"
    echo "Depois rode este instalador de novo."
    exit 2
  fi
fi

# 2. Repositório gerenciado pelo git.
say "Baixando o repositório em $REPO_DIR"
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone -q -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" fetch -q origin "$BRANCH"
  git -C "$REPO_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
fi
[ -n "${GIT_SSH_COMMAND:-}" ] && git -C "$REPO_DIR" config core.sshCommand "$GIT_SSH_COMMAND"

# 3. Configuração e backups da instalação atual.
if [ -L "$APP_LINK" ]; then
  say "$APP_LINK já aponta para o repositório: mantendo .env e backups atuais"
else
  [ -f "$APP_LINK/.env" ] || { echo "Não encontrei $APP_LINK/.env. Instalação atual ausente?"; exit 1; }
  say "Fazendo backup antes da migração"
  (cd "$APP_LINK" && bash scripts/vps-backup.sh)
  cp -a "$APP_LINK/.env" "$APP_DIR/.env"
  mkdir -p "$APP_DIR/backups" && cp -a "$APP_LINK/backups/." "$APP_DIR/backups/"
  chown 1000:1000 "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env"
  OLD="$APP_LINK-manual-$(date +%Y%m%d%H%M)"
  mv "$APP_LINK" "$OLD"
  ln -s "$APP_DIR" "$APP_LINK"
  echo "Instalação anterior guardada em $OLD"
fi

# 4. Sobe a partir da nova pasta (mesmo projeto Docker 'silas10' e mesmo volume).
say "Montando e subindo o sistema"
cd "$APP_DIR"
docker compose up -d --build
PORT="$(grep -E '^PORT=' .env | cut -d= -f2 || true)"; PORT="${PORT:-8787}"
for _ in $(seq 1 36); do
  sleep 5
  [ "$(docker inspect -f '{{.State.Health.Status}}' silas10 2>/dev/null)" = "healthy" ] && break
done
STATUS="$(docker inspect -f '{{.State.Health.Status}}' silas10 2>/dev/null || echo ausente)"
HTTP="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
echo "Saúde: $STATUS | HTTP: $HTTP"
[ "$STATUS" = healthy ] && [ "$HTTP" = 200 ] || { echo "O sistema não ficou saudável. Veja: docker compose logs --tail 50 app"; exit 1; }

# 5. Agenda o deploy automático (e mantém o backup diário apontando para $APP_LINK).
say "Agendando o deploy automático (a cada 2 minutos)"
chmod +x "$APP_DIR/scripts/vps-autodeploy.sh"
( crontab -l 2>/dev/null | grep -v "vps-autodeploy.sh" | grep -v "silas10/scripts/vps-backup" || true
  echo "0 3 * * * cd $APP_LINK && bash scripts/vps-backup.sh >> backups/backup.log 2>&1"
  echo "*/2 * * * * DEPLOY_BRANCH=$BRANCH bash $APP_LINK/scripts/vps-autodeploy.sh >> /var/log/silas10-autodeploy.log 2>&1"
) | crontab -
crontab -l | grep -E "vps-(backup|autodeploy)"

say "DEPLOY AUTOMÁTICO ATIVO"
echo "Branch acompanhada: $BRANCH  |  Versão no ar: $(git -C "$REPO_DIR" log -1 --format='%h %s')"
echo "Acompanhar:  tail -f /var/log/silas10-autodeploy.log"
