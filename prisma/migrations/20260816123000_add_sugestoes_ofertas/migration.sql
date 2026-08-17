-- Sugestões de ofertas enviadas por usuários.
-- Elas ficam isoladas das ofertas publicadas até a moderação administrativa.
CREATE TYPE "StatusSugestaoOferta" AS ENUM ('EM_ANALISE', 'APROVADA', 'REJEITADA');

CREATE TABLE "sugestoes_ofertas" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "produto_id" INTEGER,
    "parceiro_id" INTEGER,
    "oferta_id" INTEGER,
    "nome" VARCHAR(200) NOT NULL,
    "url_original" VARCHAR(500) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "preco_anterior" DECIMAL(10,2),
    "especificacoes" JSONB,
    "observacao_usuario" TEXT,
    "status" "StatusSugestaoOferta" NOT NULL DEFAULT 'EM_ANALISE',
    "analisado_por_id" INTEGER,
    "analisado_em" TIMESTAMPTZ(3),
    "motivo_analise" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sugestoes_ofertas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sugestoes_ofertas_oferta_id_key" ON "sugestoes_ofertas"("oferta_id");
CREATE INDEX "sugestoes_ofertas_usuario_id_criado_em_idx" ON "sugestoes_ofertas"("usuario_id", "criado_em");
CREATE INDEX "sugestoes_ofertas_status_criado_em_idx" ON "sugestoes_ofertas"("status", "criado_em");
CREATE INDEX "sugestoes_ofertas_categoria_status_idx" ON "sugestoes_ofertas"("categoria", "status");
CREATE INDEX "sugestoes_ofertas_produto_id_idx" ON "sugestoes_ofertas"("produto_id");
CREATE INDEX "sugestoes_ofertas_parceiro_id_idx" ON "sugestoes_ofertas"("parceiro_id");

ALTER TABLE "sugestoes_ofertas"
  ADD CONSTRAINT "sugestoes_ofertas_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sugestoes_ofertas"
  ADD CONSTRAINT "sugestoes_ofertas_analisado_por_id_fkey"
  FOREIGN KEY ("analisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sugestoes_ofertas"
  ADD CONSTRAINT "sugestoes_ofertas_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sugestoes_ofertas"
  ADD CONSTRAINT "sugestoes_ofertas_parceiro_id_fkey"
  FOREIGN KEY ("parceiro_id") REFERENCES "parceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sugestoes_ofertas"
  ADD CONSTRAINT "sugestoes_ofertas_oferta_id_fkey"
  FOREIGN KEY ("oferta_id") REFERENCES "ofertas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
