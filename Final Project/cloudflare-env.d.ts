declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MICROSOFT_CLIENT_ID?:string;
    MICROSOFT_CLIENT_SECRET?:string;
    TOKEN_ENCRYPTION_KEY?:string;
    SITE_ORIGIN?:string;
  }
}
