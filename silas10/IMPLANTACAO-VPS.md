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

## Deploy automático

Depois de instalado, **toda alteração enviada ao GitHub na branch de deploy entra no ar sozinha em até 2 minutos.** Não é preciso acessar a VPS.

Como funciona (`scripts/vps-autodeploy.sh`, rodando pelo cron a cada 2 minutos):

1. Consulta a branch de deploy no GitHub. Sem novidade, sai em silêncio.
2. Se a novidade não mexe na pasta `silas10/`, só atualiza o código, sem reiniciar.
3. Monta a nova versão **com a atual ainda no ar**. Se a montagem falhar, nada muda no site.
4. Faz backup dos dados e troca a versão (alguns segundos de reinício).
5. Confere a saúde. Se a nova versão cair ou não responder, **volta sozinha para a anterior** (cerca de 10 segundos fora do ar).
6. Uma versão que falhou não é tentada de novo; o próximo commit é tentado normalmente.

Estrutura na VPS após a instalação:

| Caminho | Conteúdo |
|---|---|
| `/opt/firmament` | Repositório gerenciado pelo git |
| `/opt/silas10` | Atalho para `/opt/firmament/silas10` (`.env` e `backups/` ficam aqui, fora do git) |
| `/var/log/silas10-autodeploy.log` | Histórico dos deploys |

### Instalação (uma vez)

```bash
rm -rf /tmp/fm && git clone -q -b claude/practical-fermi-y6yde0 https://github.com/firmamentdigital/Firmament.git /tmp/fm && bash /tmp/fm/silas10/scripts/vps-autodeploy-install.sh
```

Na primeira execução o instalador cria uma **chave somente leitura** e para, mostrando-a. Cadastre-a no GitHub em **Firmament → Settings → Deploy keys → Add deploy key** (sem marcar "Allow write access") e rode o mesmo comando de novo. A chave continua funcionando mesmo com o repositório privado.

### Acompanhar e controlar

```bash
tail -n 30 /var/log/silas10-autodeploy.log                 # últimos deploys
crontab -l | grep vps-autodeploy                            # agendamento ativo
crontab -l | grep -v vps-autodeploy | crontab -             # PAUSAR o deploy automático
```

Para reativar depois de pausar, rode o instalador de novo. Em caso de falha, os detalhes ficam em `/tmp/silas10-build.log` (montagem) ou `/tmp/silas10-falha.log` (inicialização).

## Atualização manual (sem deploy automático)

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
