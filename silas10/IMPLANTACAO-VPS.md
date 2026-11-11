# Silas 10 — Implantação na VPS (Hostinger)

Guia para publicar o sistema de inscrições em **https://inscricoes.wmorente.com.br** na VPS da Hostinger, sem depender do ChatGPT Sites.

## O que mudou em relação ao ChatGPT Sites

| Item | ChatGPT Sites | VPS |
|---|---|---|
| Visual, formulário, gestão, QR Code, exportações, avisos | ✅ | ✅ igual |
| Login do organizador | Conta do ChatGPT | **E-mail + senha** (definidos no `.env`) |
| Login de convidados | Convite + senha | ✅ igual |
| Banco de dados e imagens | Nuvem da OpenAI | Volume Docker na VPS (`silas10-data`) |
| Backup | Automático da plataforma | **Script diário** (passo 7) |

> **Dados:** o banco começa **vazio**. As inscrições feitas no site do ChatGPT não vêm junto.

## Requisitos da VPS

- Ubuntu 22.04/24.04 com **Docker** e **Docker Compose** (`docker compose version`)
- **nginx** e **certbot** (ou outro proxy reverso já usado na VPS)
- ~2 GB livres em disco e ~400 MB de RAM para o sistema
- Portas 80 e 443 liberadas no firewall da Hostinger

## 1. DNS (painel da Hostinger)

**Domínios → wmorente.com.br → DNS / Nameservers → Registros DNS**

| Tipo | Nome | Aponta para | TTL |
|---|---|---|---|
| A | `inscricoes` | IP da VPS (VPS → Visão geral) | 3600 |

Apague antes qualquer registro existente com o nome `inscricoes`.

## 2. Enviar o código para a VPS

O repositório é privado. Para o `git clone` funcionar, use um token de acesso do GitHub (somente leitura) quando ele pedir a senha. A alternativa é baixar o ZIP pelo GitHub e enviar à VPS por SFTP.

```bash
sudo mkdir -p /opt/silas10 && sudo chown $USER /opt/silas10
git clone -b claude/practical-fermi-y6yde0 https://github.com/firmamentdigital/Firmament.git /tmp/firmament
cp -a /tmp/firmament/silas10/. /opt/silas10/ && rm -rf /tmp/firmament
cd /opt/silas10
```

## 3. Configurar (`.env`)

```bash
cp .env.example .env
nano .env        # preencha PUBLIC_HOST e OWNER_EMAIL
docker compose build
docker compose run --rm --no-deps app node scripts/owner-password.mjs
```

O último comando pede a senha do organizador (mínimo 10 caracteres) e imprime uma linha `OWNER_PASSWORD_HASH=...`. **Cole essa linha no `.env`**. A senha em si não fica salva em lugar nenhum.

```bash
chmod 600 .env
```

> Se a porta 8787 já estiver em uso na VPS, mude `PORT` no `.env` e a porta em `deploy/nginx-inscricoes.conf`.

## 4. Subir o sistema

```bash
docker compose up -d
docker compose logs -f app      # aguarde "Ready on http://0.0.0.0:8787" e saia com Ctrl+C
```

Na primeira subida as migrações do banco são aplicadas sozinhas. Nas próximas, só as novas.

## 5. Publicar com HTTPS (nginx + certbot)

```bash
sudo cp deploy/nginx-inscricoes.conf /etc/nginx/sites-available/inscricoes.wmorente.com.br
sudo ln -s /etc/nginx/sites-available/inscricoes.wmorente.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d inscricoes.wmorente.com.br --redirect
```

> Se a VPS usa outro proxy (Traefik, Caddy, EasyPanel, Coolify), aponte `inscricoes.wmorente.com.br` para `127.0.0.1:8787` repassando o cabeçalho `Host` original e, se possível, `CF-Connecting-IP` com o IP do visitante.

## 6. Testar

1. Abra `https://inscricoes.wmorente.com.br` pelo celular (dados móveis).
2. Faça uma inscrição de teste.
3. Entre em `/gestao` → **Sou o organizador** → e-mail e senha do `.env`.
4. Confira a inscrição, leia o QR Code e baixe o Excel e o PDF.
5. Em **Configurações**, convide os demais membros da equipe.
6. Exclua a inscrição de teste.

## 7. Backup diário (obrigatório)

```bash
bash scripts/vps-backup.sh                  # teste manual
crontab -e
```

Adicione a linha:

```
0 3 * * * cd /opt/silas10 && bash scripts/vps-backup.sh >> backups/backup.log 2>&1
```

Os backups ficam em `/opt/silas10/backups/` por 14 dias. **Copie periodicamente para fora da VPS** (Google Drive, outro servidor). Se a VPS for perdida, os backups locais também serão.

**Restaurar** (substitui os dados atuais e antes salva uma cópia de segurança `antes-de-restaurar-*`):

```bash
bash scripts/vps-restore.sh backups/silas10-AAAA-MM-DD_HHMMSS.tar.gz
```

## Operação do dia a dia

| Tarefa | Comando (em `/opt/silas10`) |
|---|---|
| Ver se está no ar | `docker compose ps` (status `healthy`) |
| Ver logs | `docker compose logs --tail 100 app` |
| Reiniciar | `docker compose restart app` |
| Trocar a senha do organizador | gerar novo hash (passo 3), trocar no `.env`, `docker compose up -d --force-recreate` (derruba as sessões abertas) |
| Trocar o e-mail do organizador | mudar `OWNER_EMAIL` no `.env`, `docker compose up -d --force-recreate` |
| Atualizar o código | `bash scripts/vps-backup.sh`, substituir os arquivos, `docker compose up -d --build` |

> Sempre que editar o `.env`, use `--force-recreate`: um simples `restart` pode continuar lendo a versão antiga do arquivo.

## Riscos e limitações

- **Servidor de execução:** o sistema roda no workerd (o mesmo runtime da Cloudflare) por meio do Wrangler em modo local, em um único processo. Atende com folga o volume de um evento (centenas de inscrições), mas não é feito para picos de milhares de acessos simultâneos.
- **Ponto único de falha:** se a VPS cair, o site cai. O Docker reinicia o sistema sozinho após quedas ou reinícios da VPS.
- **Envio de avisos:** continua manual pelo WhatsApp, como no original.
