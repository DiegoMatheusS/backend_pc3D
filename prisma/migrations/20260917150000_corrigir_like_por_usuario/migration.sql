-- Garante que o Like seja único por produto + usuário.
-- Remove índices/constraints legados que possam ter deixado o produto inteiro
-- com apenas um Like, independentemente da conta que clicou.

ALTER TABLE "produto_likes"
  DROP CONSTRAINT IF EXISTS "produto_likes_produto_id_key";

DROP INDEX IF EXISTS "produto_likes_produto_id_key";
DROP INDEX IF EXISTS "produto_likes_produto_id_unique";
DROP INDEX IF EXISTS "produto_likes_produto_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "produto_likes_produto_id_usuario_id_key"
  ON "produto_likes"("produto_id", "usuario_id");
