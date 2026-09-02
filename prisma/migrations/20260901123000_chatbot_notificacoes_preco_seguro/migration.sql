-- Atualização incremental e não destrutiva: notificações, confirmação do Chatbot Admin
-- e identificação opcional de ofertas por código de marketplace.

ALTER TABLE "ofertas"
ADD COLUMN IF NOT EXISTS "codigo_marketplace" VARCHAR(160);

CREATE INDEX IF NOT EXISTS "ofertas_codigo_marketplace_idx"
ON "ofertas"("codigo_marketplace");

CREATE TABLE IF NOT EXISTS "notificacoes" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "referencia_tipo" VARCHAR(80),
    "referencia_id" VARCHAR(100),
    "chave_dedupe" VARCHAR(180),
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lida_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notificacoes_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "notificacoes_chave_dedupe_key"
ON "notificacoes"("chave_dedupe");
CREATE INDEX IF NOT EXISTS "notificacoes_usuario_id_lida_criado_em_idx"
ON "notificacoes"("usuario_id", "lida", "criado_em");
CREATE INDEX IF NOT EXISTS "notificacoes_usuario_id_criado_em_idx"
ON "notificacoes"("usuario_id", "criado_em");

CREATE TABLE IF NOT EXISTS "chatbot_cadastro_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "acao" VARCHAR(40) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "categoria_esperada" VARCHAR(80),
    "resultado_normalizado" JSONB NOT NULL,
    "reconciliacao" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "resultado_final" JSONB,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "consumido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chatbot_cadastro_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chatbot_cadastro_tokens_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chatbot_cadastro_tokens_token_key"
ON "chatbot_cadastro_tokens"("token");
CREATE INDEX IF NOT EXISTS "chatbot_cadastro_tokens_usuario_id_status_expira_em_idx"
ON "chatbot_cadastro_tokens"("usuario_id", "status", "expira_em");
CREATE INDEX IF NOT EXISTS "chatbot_cadastro_tokens_expira_em_idx"
ON "chatbot_cadastro_tokens"("expira_em");
