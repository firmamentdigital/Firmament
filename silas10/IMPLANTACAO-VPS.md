# Silas 10 — Implantação e atualização na VPS (Hostinger)

Sistema de inscrições publicado em **https://silas10.wmorente.com.br**, rodando na VPS da Hostinger, sem depender do ChatGPT Sites. O endereço antigo `inscricoes.wmorente.com.br` redireciona para o novo.

## Diferenças em relação ao ChatGPT Sites

| Item | ChatGPT Sites | VPS |
|---|---|---|
| Visual, formulário, gestão, QR Code, exportações, avisos | ✅ | ✅ igual |
| Acesso do proprietário | Conta do ChatGPT ou login master | **Somente login master** (`MASTER_LOGIN` + senha) |
| Convidados | Convite + senha | ✅ igual |
| Banco e imagens | Nuvem da OpenAI | Volume Docker `silas10_silas10-data` na VPS |
| Backup | Plataforma | Script diário (`scripts/vps-backup.sh`) |

### Ajustes feitos no código original para a VPS

1. `app/chatgpt-auth.ts`: os cabeçalhos `oai-authenticated-*` são **ignorados**. Fora do ChatGPT Sites qualquer visitante poderia enviá-los e se passar pelo proprietário.
2. `lib/master-auth.ts`: aceita o hash da senha também no formato `pbkdf2-sha256:100000:sal:hash`, porque arquivos `.env` expandem o caractere `$` do formato original.
3. Infraestrutura própria: `Dockerfile`, `docker-compose.yml`, `deploy/nginx-silas10.conf`, `scripts/vps-*.{mjs,sh}` e `scripts/owner-password.mjs`.

> **Ao receber uma nova versão do ChatGPT**, reaplique apenas os itens 1 e 2. Todo o resto do código vem da exportação original.

## Instalação nova (resumo)

Na VPS, como root:

```bash
mkdir -p /opt/silas10   # copie para cá o conteúdo da pasta silas10 do repositório
cd /opt/silas10
cp .env.example .env && nano .env              # PUBLIC_HOST, PORT, OWNER_EMAIL, MASTER_LOGIN
docker compose build
docker compose run --rm --no-deps app node scripts/owner-password.mjs   # cole a linha MASTER_PASSWORD_HASH=... no .env
chown 1000:1000 .env && chmod 600 .env
docker compose up -d
```

> **Permissão do `.env`:** o container roda com o usuário `node` (UID 1000). Se o arquivo pertencer só ao root, o sistema fica reiniciando com `EACCES: permission denied, open '/config/.env'`. Comandos como `sed -i` recriam o arquivo como root: **sempre repita o `chown` depois de editar.**

Publicação com HTTPS:

```bash
cp deploy/nginx-silas10.conf /etc/nginx/sites-available/silas10.wmorente.com.br.conf
ln -sf /etc/nginx/sites-available/silas10.wmorente.com.br.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d silas10.wmorente.com.br --redirect
```

DNS (Hostinger → Domínios → wmorente.com.br → Registros DNS): tipo **A**, nome `silas10`, apontando para o IP da VPS.

## Atualizar para uma nova versão do código

```bash
cd /opt/silas10
bash scripts/vps-backup.sh                       # 1. backup antes de tudo
# 2. substitua os arquivos do código (mantendo .env e backups/)
docker compose up -d --build                     # 3. monta e reinicia; migrações novas são aplicadas sozinhas
docker compose ps                                # 4. deve mostrar (healthy)
```

Se algo der errado, restaure o backup do passo 1 (ver abaixo) e volte os arquivos da versão anterior.

## Backup e restauração

- Agendado no `crontab` para todo dia às 3h UTC (meia-noite em Brasília), mantendo 14 dias em `/opt/silas10/backups/`.
- **Copie periodicamente para fora da VPS.** Se a VPS for perdida, os backups locais também serão.

```bash
bash scripts/vps-backup.sh                                            # backup manual
bash scripts/vps-restore.sh backups/silas10-AAAA-MM-DD_HHMMSS.tar.gz  # restauração (pede confirmação)
```

A restauração salva antes uma cópia `antes-de-restaurar-*` dos dados atuais.

## Operação do dia a dia

| Tarefa | Comando (em `/opt/silas10`) |
|---|---|
| Ver se está no ar | `docker compose ps` |
| Ver logs | `docker compose logs --tail 100 app` |
| Reiniciar | `docker compose restart app` |
| Trocar a senha master | gerar novo hash, trocar `MASTER_PASSWORD_HASH` no `.env`, `chown 1000:1000 .env`, `docker compose up -d --force-recreate` |
| Trocar o login master | mudar `MASTER_LOGIN`, `chown 1000:1000 .env`, `docker compose up -d --force-recreate` |

Trocar login ou senha master derruba as sessões abertas. Sempre que editar o `.env`, use `--force-recreate`.

## Riscos e limitações

- Roda no workerd (runtime da Cloudflare) via Wrangler em modo local, em um único processo: atende com folga um evento de centenas de inscrições, não picos de milhares de acessos simultâneos.
- Se a VPS cair, o site cai. O Docker reinicia o sistema sozinho após quedas ou reinícios da VPS.
- Avisos pelo WhatsApp continuam manuais, como no original.
