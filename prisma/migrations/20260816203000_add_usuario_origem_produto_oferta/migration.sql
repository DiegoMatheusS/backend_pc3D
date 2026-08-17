-- Preserva o usuário que originou uma oferta enviada pela comunidade.
ALTER TABLE "produtos"
ADD COLUMN "usuario_origem_id" INTEGER;

ALTER TABLE "ofertas"
ADD COLUMN "usuario_origem_id" INTEGER;

CREATE INDEX "produtos_usuario_origem_id_idx"
ON "produtos"("usuario_origem_id");

CREATE INDEX "ofertas_usuario_origem_id_idx"
ON "ofertas"("usuario_origem_id");

ALTER TABLE "produtos"
ADD CONSTRAINT "produtos_usuario_origem_id_fkey"
FOREIGN KEY ("usuario_origem_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ofertas"
ADD CONSTRAINT "ofertas_usuario_origem_id_fkey"
FOREIGN KEY ("usuario_origem_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
