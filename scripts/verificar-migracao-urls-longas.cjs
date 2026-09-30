const assert = require('node:assert/strict');
const { Client } = require('pg');

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows: columns } = await db.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'ofertas' AND column_name IN ('url_original','url_afiliada'))
          OR (table_name = 'sugestoes_ofertas' AND column_name = 'url_original')
          OR (table_name = 'chatbot_cadastro_tokens' AND column_name = 'url'))`);
    assert.equal(columns.length, 4, `Esperadas quatro colunas de link: ${JSON.stringify(columns)}`);
    assert.ok(columns.every((row) => row.data_type === 'text'), 'Todas as colunas de link devem usar TEXT');

    const { rows: indexes } = await db.query(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ofertas'`);
    assert.ok(indexes.some((r) => r.indexdef.includes('UNIQUE INDEX') && r.indexdef.includes('digest(') && r.indexdef.includes('url_original')), 'Índice único SHA-256 não está presente');
    assert.ok(!indexes.some((r) => r.indexdef.includes('url_original') && !r.indexdef.includes('digest(') && r.indexdef.includes('UNIQUE INDEX')), 'Índice antigo sobre URL integral permaneceu');

    const url = `https://shopee.com.br/produto/ação?affiliate_id=${'abcXYZ'.repeat(1800)}&parceiro=teste`;
    await db.query('BEGIN');
    try {
      await db.query('CREATE TEMP TABLE url_index_probe (produto_id int, parceiro_id int, url_original text)');
      await db.query("CREATE UNIQUE INDEX url_index_probe_unique ON url_index_probe (produto_id, parceiro_id, digest(url_original, 'sha256'))");
      await db.query('INSERT INTO url_index_probe VALUES ($1, $2, $3)', [1, 1, url]);
      const { rows } = await db.query('SELECT url_original FROM url_index_probe WHERE produto_id = 1');
      assert.equal(rows[0].url_original, url, 'URL comprida foi alterada ou truncada');
      let rejected = false;
      try {
        await db.query('INSERT INTO url_index_probe VALUES ($1, $2, $3)', [1, 1, url]);
      } catch (error) {
        if (error.code !== '23505') throw error;
        rejected = true;
      }
      assert.ok(rejected, 'URL duplicada não foi rejeitada');
    } finally {
      await db.query('ROLLBACK');
    }
    console.log('Migração aprovada: 4 colunas TEXT, unicidade via digest SHA-256 e URLs >10 mil caracteres preservadas.');
  } finally {
    await db.end();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
