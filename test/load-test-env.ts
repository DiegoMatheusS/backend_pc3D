import { config } from 'dotenv';

config({
  path: '.env.test',
  override: true,
  quiet: true,
});

if (!process.env.DATABASE_URL?.includes('/criabyte_test')) {
  throw new Error(
    'SEGURANÇA: os testes E2E devem usar exclusivamente o banco criabyte_test.',
  );
}

process.env.NODE_ENV = 'test';
