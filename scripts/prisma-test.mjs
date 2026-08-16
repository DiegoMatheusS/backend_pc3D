import { spawnSync } from 'node:child_process';
<<<<<<< HEAD
import { fileURLToPath } from 'node:url';
=======
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
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

<<<<<<< HEAD
const prismaCli = fileURLToPath(
  new URL('../node_modules/prisma/build/index.js', import.meta.url),
);

const resultado = spawnSync(process.execPath, [prismaCli, ...argumentos], {
=======
const executavel = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const resultado = spawnSync(executavel, ['prisma', ...argumentos], {
>>>>>>> d9293c50a8d5ea1d10010d1a809ec81b93c9397c
  env: process.env,
  stdio: 'inherit',
});

if (resultado.error) {
  console.error(resultado.error.message);
  process.exit(1);
}

process.exit(resultado.status ?? 1);
