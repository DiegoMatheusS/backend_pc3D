-- Builds da Comunidade.
-- Mantém a Build comercial existente e cria uma estrutura separada para conteúdo dos usuários.

-- CreateEnum
CREATE TYPE "VisibilidadeBuildComunidade" AS ENUM ('PRIVADA', 'NAO_LISTADA', 'PUBLICA');
CREATE TYPE "StatusBuildComunidade" AS ENUM ('RASCUNHO', 'PUBLICADA', 'OCULTA', 'REMOVIDA');

-- CreateTable
CREATE TABLE "builds_comunidade" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "descricao" TEXT,
    "finalidade" VARCHAR(150),
    "resolucao" VARCHAR(80),
    "visibilidade" "VisibilidadeBuildComunidade" NOT NULL DEFAULT 'PRIVADA',
    "status" "StatusBuildComunidade" NOT NULL DEFAULT 'RASCUNHO',
    "preco_na_publicacao" DECIMAL(12,2),
    "consumo_na_publicacao" DOUBLE PRECISION,
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "quantidade_copias" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "publicado_em" TIMESTAMPTZ(3),

    CONSTRAINT "builds_comunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds_comunidade_componentes" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "categoria" "CategoriaHardware" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "posicao" VARCHAR(100),

    CONSTRAINT "builds_comunidade_componentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "builds_comunidade_slug_key" ON "builds_comunidade"("slug");
CREATE INDEX "builds_comunidade_status_visibilidade_publicado_em_idx"
  ON "builds_comunidade"("status", "visibilidade", "publicado_em");
CREATE INDEX "builds_comunidade_usuario_id_status_atualizado_em_idx"
  ON "builds_comunidade"("usuario_id", "status", "atualizado_em");
CREATE INDEX "builds_comunidade_finalidade_idx" ON "builds_comunidade"("finalidade");
CREATE INDEX "builds_comunidade_resolucao_idx" ON "builds_comunidade"("resolucao");
CREATE INDEX "builds_comunidade_componentes_build_id_idx"
  ON "builds_comunidade_componentes"("build_id");
CREATE INDEX "builds_comunidade_componentes_hardware_id_idx"
  ON "builds_comunidade_componentes"("hardware_id");
CREATE INDEX "builds_comunidade_componentes_categoria_idx"
  ON "builds_comunidade_componentes"("categoria");

-- AddForeignKey
ALTER TABLE "builds_comunidade"
  ADD CONSTRAINT "builds_comunidade_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "builds_comunidade_componentes"
  ADD CONSTRAINT "builds_comunidade_componentes_build_id_fkey"
  FOREIGN KEY ("build_id") REFERENCES "builds_comunidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "builds_comunidade_componentes"
  ADD CONSTRAINT "builds_comunidade_componentes_hardware_id_fkey"
  FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
