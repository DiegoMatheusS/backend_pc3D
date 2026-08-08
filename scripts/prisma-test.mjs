import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.test', override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.includes('/criabyte_test')) {
  console.error(
    'SEGURANÇA: .env.test precisa apontar exclusivamente para o banco criabyte_test.',
  );
  process.exit(1);
}

const acao = process.argv[2];
const comandosPermitidos = new Map([
  ['status', ['migrate', 'status']],
  ['migrate', ['migrate', 'deploy']],
  ['studio', ['studio']],
]);

const argumentos = comandosPermitidos.get(acao);

if (!argumentos) {
  console.error('Uso: node scripts/prisma-test.mjs <status|migrate|studio>');
  process.exit(1);
}

const executavel = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const resultado = spawnSync(executavel, ['prisma', ...argumentos], {
  env: process.env,
  stdio: 'inherit',
});

if (resultado.error) {
  console.error(resultado.error.message);
  process.exit(1);
}

process.exit(resultado.status ?? 1);
