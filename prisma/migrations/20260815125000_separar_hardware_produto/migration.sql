-- Hardware e Produto passam a ter ciclos de vida independentes.
-- A migração é aditiva: preserva produto_id existente e não remove dados.
ALTER TABLE "hardwares"
  ADD COLUMN "mpn" VARCHAR(150),
  ADD COLUMN "gtin" VARCHAR(32),
  ADD COLUMN "imagem_hover_url" VARCHAR(500);

-- Copia identificadores dos Produtos já vinculados para o Hardware técnico,
-- preservando o estado atual antes de separar os fluxos de criação/edição.
UPDATE "hardwares" AS h
SET
  "mpn" = p."mpn",
  "gtin" = p."gtin",
  "imagem_hover_url" = p."imagem_hover_url"
FROM "produtos" AS p
WHERE h."produto_id" = p."id";

CREATE UNIQUE INDEX "hardwares_mpn_key" ON "hardwares"("mpn");
CREATE UNIQUE INDEX "hardwares_gtin_key" ON "hardwares"("gtin");
