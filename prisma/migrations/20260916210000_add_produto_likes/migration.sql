-- Likes dos produtos da loja. Cada usuário pode registrar no máximo um like por produto.

CREATE TABLE "produto_likes" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "produto_likes_produto_id_usuario_id_key"
    ON "produto_likes"("produto_id", "usuario_id");

CREATE INDEX "produto_likes_produto_id_idx"
    ON "produto_likes"("produto_id");

CREATE INDEX "produto_likes_usuario_id_idx"
    ON "produto_likes"("usuario_id");

ALTER TABLE "produto_likes"
    ADD CONSTRAINT "produto_likes_produto_id_fkey"
    FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "produto_likes"
    ADD CONSTRAINT "produto_likes_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
