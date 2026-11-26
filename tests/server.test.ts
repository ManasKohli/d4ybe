import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SERVER = fileURLToPath(new URL('../src/server.ts', import.meta.url));
const TSX = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url));

let blocker: Server | undefined;
afterEach(() => blocker?.close());

function run(env: Record<string, string>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(TSX, [SERVER], { env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'info', ...env } });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('exit', (code) => resolve({ code, output }));
  });
}

describe('server startup', () => {
  it('exits non-zero, without claiming to listen, when the port is taken', async () => {
    blocker = createServer();
    await new Promise<void>((r) => blocker!.listen(0, r));
    const address = blocker.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const { code, output } = await run({ PORT: String(port) });

    expect(code).toBe(1);
    expect(output).not.toContain('api listening');
    expect(output).toContain('failed to listen');
  }, 15_000);

  it('refuses to start on invalid env', async () => {
    const { code, output } = await run({ PORT: 'abc' });
    expect(code).not.toBe(0);
    expect(output).toContain('PORT');
  }, 15_000);
});
