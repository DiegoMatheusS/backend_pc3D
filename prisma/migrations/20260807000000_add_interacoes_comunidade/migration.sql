-- Avaliações e comentários das Builds da Comunidade.

-- CreateEnum
CREATE TYPE "StatusComentarioBuild" AS ENUM ('PUBLICADO', 'OCULTO', 'REMOVIDO');

-- CreateTable
CREATE TABLE "avaliacoes_builds_comunidade" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "avaliacoes_builds_comunidade_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "avaliacoes_builds_comunidade_nota_check" CHECK ("nota" BETWEEN 1 AND 5)
);

-- CreateTable
CREATE TABLE "comentarios_builds_comunidade" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "comentario_pai_id" INTEGER,
    "texto" VARCHAR(3000) NOT NULL,
    "status" "StatusComentarioBuild" NOT NULL DEFAULT 'PUBLICADO',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comentarios_builds_comunidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_builds_comunidade_build_id_usuario_id_key"
  ON "avaliacoes_builds_comunidade"("build_id", "usuario_id");
CREATE INDEX "avaliacoes_builds_comunidade_build_id_criado_em_idx"
  ON "avaliacoes_builds_comunidade"("build_id", "criado_em");
CREATE INDEX "avaliacoes_builds_comunidade_usuario_id_idx"
  ON "avaliacoes_builds_comunidade"("usuario_id");
CREATE INDEX "comentarios_builds_comunidade_build_id_status_criado_em_idx"
  ON "comentarios_builds_comunidade"("build_id", "status", "criado_em");
CREATE INDEX "comentarios_builds_comunidade_usuario_id_idx"
  ON "comentarios_builds_comunidade"("usuario_id");
CREATE INDEX "comentarios_builds_comunidade_comentario_pai_id_idx"
  ON "comentarios_builds_comunidade"("comentario_pai_id");

-- AddForeignKey
ALTER TABLE "avaliacoes_builds_comunidade"
  ADD CONSTRAINT "avaliacoes_builds_comunidade_build_id_fkey"
  FOREIGN KEY ("build_id") REFERENCES "builds_comunidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "avaliacoes_builds_comunidade"
  ADD CONSTRAINT "avaliacoes_builds_comunidade_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios_builds_comunidade"
  ADD CONSTRAINT "comentarios_builds_comunidade_build_id_fkey"
  FOREIGN KEY ("build_id") REFERENCES "builds_comunidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios_builds_comunidade"
  ADD CONSTRAINT "comentarios_builds_comunidade_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios_builds_comunidade"
  ADD CONSTRAINT "comentarios_builds_comunidade_comentario_pai_id_fkey"
  FOREIGN KEY ("comentario_pai_id") REFERENCES "comentarios_builds_comunidade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
