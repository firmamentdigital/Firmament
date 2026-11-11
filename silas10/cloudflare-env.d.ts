declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    OWNER_EMAIL?: string;
    OWNER_PASSWORD_HASH?: string;
    BUCKET?: R2Bucket;
  }
}
