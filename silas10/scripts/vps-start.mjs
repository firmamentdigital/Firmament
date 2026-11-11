// Inicia o Silas 10 na VPS (dentro do container Docker).
// 1) gera a configuração do Worker com a pasta de migrações;
// 2) aplica as migrações pendentes do banco (só as novas, com controle de versão);
// 3) sobe o servidor (workerd via Wrangler) em modo local, com dados persistidos em /data.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = process.env.DATA_DIR || "/data";
const envFile = process.env.ENV_FILE || "/config/.env";
const publicHost = (process.env.PUBLIC_HOST || "").trim();
const port = process.env.PORT || "8787";
const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");

if (!/^[a-z0-9.-]+$/i.test(publicHost)) {
  console.error("Defina PUBLIC_HOST no .env (ex.: inscricoes.wmorente.com.br).");
  process.exit(1);
}
if (!existsSync(envFile)) {
  console.error(`Arquivo de configuração não encontrado: ${envFile}`);
  process.exit(1);
}
const vars = readFileSync(envFile, "utf8");
for (const name of ["OWNER_EMAIL", "OWNER_PASSWORD_HASH"]) {
  if (!new RegExp(`^${name}=\\S+`, "m").test(vars)) {
    console.error(`Defina ${name} no .env. A gestão fica bloqueada sem ele.`);
    process.exit(1);
  }
}

const baseConfig = resolve(root, "dist/server/wrangler.json");
const vpsConfig = resolve(root, "dist/server/wrangler.vps.json");
const config = JSON.parse(readFileSync(baseConfig, "utf8"));
config.d1_databases = config.d1_databases.map(db => ({ ...db, migrations_dir: "../../drizzle" }));
config.observability = { enabled: false };
writeFileSync(vpsConfig, JSON.stringify(config));

const env = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" };
const migrate = spawnSync(process.execPath, [wrangler, "d1", "migrations", "apply", "DB", "--local", "--persist-to", dataDir, "--config", vpsConfig], { stdio: "inherit", env, cwd: root });
if (migrate.status !== 0) {
  console.error("Falha ao aplicar as migrações do banco. O servidor não foi iniciado.");
  process.exit(migrate.status ?? 1);
}

const server = spawn(process.execPath, [wrangler, "dev",
  "--config", vpsConfig, "--local", "--persist-to", dataDir,
  "--ip", "0.0.0.0", "--port", port,
  "--local-upstream", publicHost, "--upstream-protocol", "https",
  "--env-file", envFile, "--show-interactive-dev-session=false", "--log-level", "info",
], { stdio: "inherit", env, cwd: root });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", code => process.exit(code ?? 0));
