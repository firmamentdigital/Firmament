// Gera uma cópia consistente dos dados (banco D1 + imagens R2) em /tmp/snapshot,
// usando o backup nativo do SQLite (seguro com o sistema em funcionamento).
// Chamado por scripts/vps-backup.sh; não precisa ser executado manualmente.
import { backup, DatabaseSync } from "node:sqlite";
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const source = join(process.env.DATA_DIR || "/data", "v3");
const target = join(process.argv[2] || "/tmp/snapshot", "v3");
rmSync(dirname(target), { recursive: true, force: true });

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path); else yield path;
  }
}

let databases = 0, files = 0;
for (const path of walk(source)) {
  const rel = relative(source, path);
  if (rel.startsWith("cache/") || /\.sqlite-(wal|shm)$/.test(rel)) continue;
  const out = join(target, rel);
  mkdirSync(dirname(out), { recursive: true });
  if (rel.endsWith(".sqlite")) {
    const db = new DatabaseSync(path, { readOnly: true });
    await backup(db, out);
    db.close();
    databases++;
  } else {
    cpSync(path, out);
    files++;
  }
}
console.log(JSON.stringify({ databases, files }));
