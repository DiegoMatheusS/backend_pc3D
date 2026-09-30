-- Links originais e de afiliado não podem ser truncados nem depender de um
-- índice B-tree contendo toda a URL (links grandes excedem o tamanho da chave).
-- Pré-requisito: sincronizar prisma/schema.prisma com esta migração ANTES do merge.

ALTER TABLE "ofertas"
    ALTER COLUMN "url_original" TYPE TEXT,
    ALTER COLUMN "url_afiliada" TYPE TEXT;

ALTER TABLE "sugestoes_ofertas"
    ALTER COLUMN "url_original" TYPE TEXT;

ALTER TABLE "chatbot_cadastro_tokens"
    ALTER COLUMN "url" TYPE TEXT;

-- SHA-256 é builtin em PostgreSQL 12+, sem extensão pgcrypto.
-- O hash binário tem sempre 32 bytes independentemente do tamanho do link.
CREATE UNIQUE INDEX "ofertas_produto_id_parceiro_id_url_sha256_key"
    ON "ofertas" ("produto_id", "parceiro_id", sha256(convert_to("url_original", 'UTF8')));

-- Não continuar com o índice antigo sobre texto arbitrariamente extenso.
-- Falhar explicitamente se o banco usa outro nome, em vez de manter índice
-- antigo que poderia provocar erro quando um link longo fosse inserido.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'ofertas_produto_id_parceiro_id_url_original_key'
          AND relkind = 'i'
    ) THEN
        RAISE EXCEPTION 'Índice único original das ofertas não encontrado; conferir migrações existentes antes de alterar';
    END IF;
END
$$;
DROP INDEX "ofertas_produto_id_parceiro_id_url_original_key";
