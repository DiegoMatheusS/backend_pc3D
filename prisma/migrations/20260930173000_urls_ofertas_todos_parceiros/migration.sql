-- Alteração global para links longos de produtos e afiliados.
-- Índice SHA-256 evita o limite de tamanho de entrada do B-tree em URLs extensas.
-- Executar o conjunto atomicamente: nenhuma coluna/índice pode ficar parcialmente migrado.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Confirmar que o índice antigo existe antes de substituí-lo, inclusive em
-- ambientes com migrações manuais anteriores.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'ofertas_produto_id_parceiro_id_url_original_key'
          AND relkind = 'i'
    ) THEN
        RAISE EXCEPTION 'Índice único original das ofertas não encontrado; revisar o esquema do banco antes da migração';
    END IF;
END
$$;

ALTER TABLE "ofertas"
    ALTER COLUMN "url_original" TYPE TEXT,
    ALTER COLUMN "url_afiliada" TYPE TEXT;

ALTER TABLE "sugestoes_ofertas"
    ALTER COLUMN "url_original" TYPE TEXT;

ALTER TABLE "chatbot_cadastro_tokens"
    ALTER COLUMN "url" TYPE TEXT;

-- digest(text, algorithm) do pgcrypto é IMMUTABLE e recebe diretamente o texto,
-- sem convert_to(), que o PostgreSQL marca como STABLE e proíbe em índices.
CREATE UNIQUE INDEX "ofertas_produto_id_parceiro_id_url_sha256_key"
    ON "ofertas" ("produto_id", "parceiro_id", digest("url_original", 'sha256'));

DROP INDEX "ofertas_produto_id_parceiro_id_url_original_key";
COMMIT;
