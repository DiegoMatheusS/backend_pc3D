-- CreateEnum
CREATE TYPE "CategoriaHardware" AS ENUM ('PROCESSADOR', 'COOLER', 'PLACA_MAE', 'MEMORIA_RAM', 'PLACA_VIDEO', 'ARMAZENAMENTO', 'FONTE', 'GABINETE', 'VENTOINHA');

-- CreateTable
CREATE TABLE "hardwares" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "categoria" "CategoriaHardware" NOT NULL,
    "marca" VARCHAR(100) NOT NULL,
    "modelo" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "imagem_url" VARCHAR(500),
    "especificacoes" JSONB,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hardwares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hardwares_slug_key" ON "hardwares"("slug");

-- CreateIndex
CREATE INDEX "hardwares_categoria_idx" ON "hardwares"("categoria");

-- CreateIndex
CREATE INDEX "hardwares_marca_idx" ON "hardwares"("marca");

-- CreateIndex
CREATE INDEX "hardwares_ativo_publicado_idx" ON "hardwares"("ativo", "publicado");
