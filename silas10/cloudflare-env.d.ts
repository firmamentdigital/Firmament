declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    OWNER_EMAIL?: string;
    MASTER_LOGIN?: string;
    MASTER_PASSWORD_HASH?: string;
    BUCKET?: R2Bucket;
  }
}
