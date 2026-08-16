-- Preserva a ficha técnica e a origem de peças da Comunidade que não existem
-- no catálogo oficial. Nenhum vínculo existente é removido.
ALTER TABLE "builds_comunidade_componentes"
  ADD COLUMN "origem" VARCHAR(30),
  ADD COLUMN "especificacoes" JSONB,
  ADD COLUMN "fonte_dados_url" VARCHAR(500),
  ADD COLUMN "modelo_3d_url" VARCHAR(500);
