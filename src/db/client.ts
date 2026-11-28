import postgres from 'postgres';

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

export interface DbOptions {
  url: string;
  /** PEM root CA. When set, the server certificate is verified (verify-full). */
  caCert?: string | undefined;
  /** Pool size per Cloud Run instance (section 11: about 5). */
  max?: number;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** TLS for every non-local host; certificate verification when a CA is configured. */
export function sslFor(url: string, caCert?: string): postgres.Options<Record<string, never>>['ssl'] {
  const { hostname } = new URL(url);
  if (LOCAL_HOSTS.has(hostname)) return false;
  if (caCert) return { ca: caCert, rejectUnauthorized: true };
  return 'require';
}

/**
 * The postgres.js pool (D9). Supabase's shared pooler runs in transaction mode, which can't
 * keep prepared statements between transactions, so `prepare: false` is required.
 * Every query is a tagged template, so values are always sent as parameters.
 */
export function createDb({ url, caCert, max = 5 }: DbOptions): Sql {
  return postgres(url, {
    max,
    prepare: false,
    ssl: sslFor(url, caCert),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    // Postgres NOTICEs (e.g. "relation already exists, skipping") are noise in Cloud Logging.
    onnotice: () => {},
    connection: { application_name: 'd4ybe' },
  });
}
