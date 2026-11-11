# Silas 10 — código-fonte completo

Exportação da **versão 10**, publicada em 11/11/2026, do sistema de inscrições e presença do evento Silas 10 — Como realizar seu sonho / Da origem ao sucesso.

## Comece aqui

Este pacote permite entregar o projeto a um desenvolvedor. Inclui o formulário público, a gestão, as imagens e logomarcas do repositório, os scripts de criação do banco, as dependências travadas e os testes de integração.

O sistema utiliza **React + TypeScript + Vinext/Vite**, com servidor em **Cloudflare Workers**, banco **Cloudflare D1** e arquivos em **Cloudflare R2**. É uma aplicação com servidor e banco de dados. Copiar a pasta para uma hospedagem comum não ativa inscrições, gestão ou autenticação.

Foi desenvolvido para **ChatGPT Sites**. Uma implantação independente exige configurar o ambiente e adaptar a autenticação do proprietário. O serviço de login pelo ChatGPT da hospedagem original não acompanha o ZIP como serviço independente.

## Funcionalidades incluídas

- Fluxo de inscrição **Criança → Responsável → Confirmação**.
- Um responsável por criança, com várias crianças por responsável sem duplicação.
- Vínculo da criança com Sócio COD ou Escola de Atletismo.
- Digitação da data de nascimento, idade calculada e máscara de celular.
- Card de confirmação com participantes e QR Code.
- Gestão com permissões de proprietário e convidados.
- Convites individuais e troca obrigatória da senha no primeiro acesso.
- Consulta, cancelamento, reativação e exclusão conforme as permissões.
- Confirmação de presença individual ou por família, inclusive leitura do QR Code.
- Exportações em **XLSX** e **PDF**.
- Cadastro de realizadores e apoiadores.
- Preparação de avisos com texto/imagem e abertura do WhatsApp para envio manual. Não inclui disparo automático em massa ou serviço de envio de e-mail.

## Configuração necessária

| Recurso | Configuração |
| --- | --- |
| Servidor | Cloudflare Workers e build Vinext |
| Banco | Binding D1 `DB` e migrações de `drizzle/` em ordem |
| Arquivos | Binding R2 `BUCKET` |
| Proprietário | Variável `OWNER_EMAIL` com um único e-mail autorizado |
| Identidade | Integração confiável de autenticação do proprietário |
| Domínio | DNS e HTTPS na hospedagem escolhida |

`.openai/hosting.json` identifica o Site original. Preserve essa identidade apenas para manter o mesmo Site. Uma cópia independente precisa de novo ambiente e novos recursos de armazenamento.

### Autenticação ao migrar

`app/chatgpt-auth.ts` lê cabeçalhos de identidade inseridos pela plataforma original. Em outra hospedagem, esses cabeçalhos não podem ser aceitos diretamente do visitante: devem ser validados por uma camada confiável ou substituídos por uma sessão autenticada. Mantenha a gestão bloqueada até concluir essa integração.

Convidados precisam de autorização do proprietário. O primeiro acesso combina um link individual e senha inicial `123456`, seguido de troca obrigatória de senha. O pacote não contém convites, contas ou credenciais reais.

## Desenvolvimento local

Recomendado: **Node.js 24 LTS** e npm. O projeto aceita Node >= 22.13; os testes utilizam `node:sqlite` e foram executados com Node 24.

1. Extraia o ZIP e abra o terminal na pasta do projeto.
2. Instale as versões travadas das dependências:

```sh
npm run install:ci
```

3. Copie `.dev.vars.example` para `.dev.vars`. Para testar a gestão no perfil local portátil, use `OWNER_EMAIL="seedy@sites.test"`. Esse e-mail identifica uma simulação local; em produção configure o e-mail real autorizado.
4. Gere o build e a configuração do Worker local:

```sh
npm run build
```

5. Aplique cada arquivo `.sql` de `drizzle/` em ordem numérica em um banco local novo. Para cada arquivo, substitua `ARQUIVO.sql` no comando abaixo pelo nome exato. Não repita migrações já aplicadas:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/ARQUIVO.sql
```

Ordem dos arquivos:

1. `0000_silly_senator_kelly.sql`
2. `0001_child_guardian_limits.sql`
3. `0002_robust_roxanne_simpson.sql`
4. `0003_hard_franklin_storm.sql`
5. `0004_great_bulldozer.sql`
6. `0005_late_omega_red.sql`
7. `0006_clear_wither.sql`

6. Inicie o servidor:

```sh
npm run dev
```

Use a URL informada no terminal, normalmente `http://localhost:5173`. No perfil local portátil, abra `/signin-with-chatgpt?return_to=/gestao` nessa mesma origem para utilizar a identidade simulada de desenvolvimento.

## Verificações

```sh
npx tsc --noEmit
node tests/server.integration.mjs
```

Os testes usam banco em memória e geram arquivos temporários em `work/server-test/`. Não acessam as inscrições reais. `npm run build` gera os arquivos de implantação em `dist/`.

## Mapa do projeto

| Caminho | Conteúdo |
| --- | --- |
| `app/` | Páginas, formulário, confirmação, gestão e APIs |
| `lib/` | Regras, acesso, presença, avisos e exportações |
| `public/assets/` | Artes, fontes e logomarcas do repositório |
| `db/` | Esquema e integração D1/Drizzle |
| `drizzle/` | Sete migrações e histórico do esquema |
| `worker/` | Entrada do servidor |
| `scripts/` | Instalação, build e integrações locais |
| `tests/` | Testes de integração |
| `package.json` / `package-lock.json` | Dependências e versões |
| `README.md` | Documentação técnica original |
| `EXPORTACAO.json` | Identificação da versão exportada |
| `SHA256SUMS.txt` | Integridade dos arquivos |

## Conteúdo de produção

Este é um pacote de **código-fonte**, não um backup operacional. Não contém inscritos reais, dados pessoais dos participantes, senhas de usuários, sessões, chaves privadas, tokens, banco de produção nem uploads armazenados no R2. As artes incluídas são as presentes no repositório; apoiadores ou imagens enviados pela gestão em produção precisam de migração separada.

Não contém `node_modules`, builds, histórico Git ou configurações locais privadas. As dependências são instaladas pelo comando indicado acima.

As licenças de componentes e de arquivos de terceiros presentes no código foram preservadas. Este pacote não transfere direitos sobre marcas, fotos ou imagens de terceiros.

## Origem

- Versão: **10**.
- Commit: `74c8cf916ce449e111265200a284156f1cf096b8`.
- Exportação: **11/11/2026**.
- O código original foi preservado. Foram adicionados apenas este guia, um exemplo de configuração sem credenciais reais e os arquivos de identificação e integridade da exportação.
