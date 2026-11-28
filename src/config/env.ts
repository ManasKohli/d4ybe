import { z } from 'zod';

/**
 * Every environment variable the API reads, checked once at startup.
 * The app refuses to start if anything is missing or malformed.
 * Add new variables here (and to .env.example) as features need them.
 */
const envSchema = z.object({
  // Defaults to production so a missing NODE_ENV never loads dev-only packages (pino-pretty).
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .url({ protocol: /^https?$/ })
          // Browsers send a bare origin (no path, no trailing slash); anything else would never match.
          .refine((value) => URL.canParse(value) && new URL(value).origin === value, {
            message: 'Must be a bare origin like https://app.example.com (no path or trailing slash)',
          }),
      ),
    ),
  // Supabase shared pooler, transaction mode (port 6543). Never logged.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Project URL (https://<ref>.supabase.co, or http://127.0.0.1:54321 locally). Token issuer and
  // JWKS endpoint are derived from it (section 2, token check).
  SUPABASE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((value) => URL.canParse(value) && new URL(value).origin === value, {
      message: 'Must be a bare origin like https://abc.supabase.co (no path or trailing slash)',
    }),
  // PEM of Supabase's root CA (Dashboard → Database → SSL). When set, the pooler's certificate is
  // verified; otherwise the connection is still encrypted but the server isn't authenticated.
  DATABASE_CA_CERT: z
    .string()
    .refine((value) => value.includes('-----BEGIN CERTIFICATE-----'), { message: 'Must be a PEM certificate' })
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
