# Silas 10 — Código-fonte completo · versão 15

Pacote da versão atual publicada em 12/11/2026. O código original foi preservado integralmente.

## Conteúdo

- Formulário em três etapas: Criança → Responsável → Confirmação.
- Um responsável por criança, com várias crianças vinculadas sem duplicação do responsável.
- Card de confirmação com participantes e QR Code, para baixar e compartilhar.
- Painel de gestão com tabelas, busca, filtros, presença e edição das inscrições.
- Exportações XLSX e PDF; avisos com texto/imagem e abertura do WhatsApp para envio manual.
- Acesso master por login e senha, opção de sessão persistente de até 30 dias e saída com revogação da sessão.
- Convidados por e-mail e senha, com permissões limitadas e troca de senha no primeiro acesso.
- Realização: Silas 10, COD e Escola de Atletismo. Apoiadores: BookFair e WMorente.
- Artes, fontes, logomarcas, scripts, migrações SQL, testes e versões travadas das dependências.

## Tecnologia

React, TypeScript, Vinext/Vite, Cloudflare Workers, Cloudflare D1 e Cloudflare R2.

É uma aplicação com servidor e banco: não basta enviar os arquivos a uma hospedagem estática. Para outra infraestrutura, configure um Worker compatível ou adapte as integrações de banco e armazenamento.

O acesso master por login e senha funciona independentemente do login do ChatGPT, quando as variáveis master estão configuradas. A compatibilidade com a autenticação original da plataforma continua no código; configure o acesso master antes de disponibilizar uma implantação independente.

## Configuração do servidor

| Recurso | Nome/configuração |
| --- | --- |
| Banco Cloudflare D1 | Binding `DB` |
| Arquivos Cloudflare R2 | Binding `BUCKET` |
| Proprietário | `OWNER_EMAIL` com um único e-mail autorizado |
| Login master | `MASTER_LOGIN` |
| Hash da senha master | `MASTER_PASSWORD_HASH` |

As credenciais reais são configuradas no ambiente da hospedagem e não acompanham este pacote. Gere o hash utilizando `hashPassword` de `lib/guest-password.ts` em um ambiente seguro e configure o resultado como segredo do servidor. Não use uma senha em texto puro em `MASTER_PASSWORD_HASH` e não publique arquivos com credenciais.

A alteração do login ou do hash invalida as sessões master anteriores. A opção de manter conectado emite uma sessão de até 30 dias. Sem essa opção, o cookie é de sessão e a validade do lado do servidor é de 8 horas.

`.openai/hosting.json` contém a identidade do Site original. Preserve-a para manter o mesmo Site; uma implantação independente precisa de projeto, banco e armazenamento próprios.

## Desenvolvimento local

Recomendado: Node.js 24 LTS e npm. O projeto declara Node >=22.13; os testes usam `node:sqlite` e foram executados com Node 24.

1. Extraia a pasta e abra um terminal nela.
2. Instale as versões travadas:

```sh
npm run install:ci
```

3. Copie `.dev.vars.example` para `.dev.vars` e configure os valores do seu ambiente, incluindo o hash da senha.
4. Gere o build e a configuração local do Worker:

```sh
npm run build
```

5. Em um banco local novo, aplique os arquivos SQL de `drizzle/` na ordem abaixo. Substitua `ARQUIVO.sql` pelo nome de cada arquivo no comando. Não repita migrações já aplicadas:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/ARQUIVO.sql
```

Ordem:

1. `0000_silly_senator_kelly.sql`
2. `0001_child_guardian_limits.sql`
3. `0002_robust_roxanne_simpson.sql`
4. `0003_hard_franklin_storm.sql`
5. `0004_great_bulldozer.sql`
6. `0005_late_omega_red.sql`
7. `0006_clear_wither.sql`
8. `0007_tan_jigsaw.sql`

6. Inicie o desenvolvimento:

```sh
npm run dev
```

Use a URL informada no terminal, normalmente `http://localhost:5173`. A área administrativa fica em `/gestao`.

## Verificação

```sh
npx tsc --noEmit
node tests/server.integration.mjs
npm run build
```

Os testes utilizam dados fictícios e banco em memória. Não acessam as inscrições reais. Os arquivos temporários de teste ficam em `work/` e os arquivos de build em `dist/`.

## Mapa do projeto

| Caminho | Finalidade |
| --- | --- |
| `app/` | Formulário, card, gestão, telas de acesso e APIs |
| `lib/` | Regras, autenticação, sessões, presença, marcas e exportações |
| `db/` | Esquema e integração com o banco |
| `drizzle/` | Oito migrações SQL e histórico do esquema |
| `public/assets/` | Artes, logomarcas e fontes |
| `worker/` | Entrada do servidor |
| `scripts/` | Instalação, build e integrações do ambiente |
| `tests/` | Testes de integração |
| `README.md` | Documentação técnica original do ambiente |
| `EXPORTACAO.json` | Versão e origem do código |
| `SHA256SUMS.txt` | Integridade dos arquivos, exceto o próprio arquivo de hashes |

## Limites do pacote

Este ZIP contém o código-fonte, não um backup da produção. Não inclui inscrições reais, dados pessoais de participantes, senhas de usuários, convites, sessões, chaves, banco de produção ou uploads feitos pelo painel e armazenados no R2. Inclui as artes e logomarcas presentes no repositório; os arquivos enviados pelo painel precisam de migração separada ao transferir o sistema.

`node_modules`, builds, histórico Git e configurações privadas locais não estão incluídos. Instale as dependências pelo arquivo de versões travadas.

Os avisos de WhatsApp são preparados pelo painel e enviados manualmente; o pacote não inclui um serviço de disparo automático em massa ou envio de e-mails. As licenças presentes no repositório foram preservadas.

Versão 15 · 12/11/2026 · commit `e13befb7265ec3e2b9c8b9b2b64a93cf0fa5550d`.
