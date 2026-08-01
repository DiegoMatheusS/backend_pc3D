-- CreateEnum
CREATE TYPE "FormatoModelo3D" AS ENUM ('GLB', 'GLTF', 'FBX', 'OBJ');

-- CreateTable
CREATE TABLE "modelos_3d_hardwares" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "nome" VARCHAR(150),
    "arquivo_url" VARCHAR(500) NOT NULL,
    "formato" "FormatoModelo3D" NOT NULL,
    "versao" VARCHAR(50),
    "altura_real_mm" DOUBLE PRECISION,
    "largura_real_mm" DOUBLE PRECISION,
    "profundidade_real_mm" DOUBLE PRECISION,
    "posicao_correcao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_correcao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_correcao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_correcao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_correcao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_correcao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escala_correcao_x" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_correcao_y" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_correcao_z" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modelos_3d_hardwares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pontos_encaixe_hardwares" (
    "id" SERIAL NOT NULL,
    "hardware_pai_id" INTEGER NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "nome" VARCHAR(150),
    "categoria_aceita" "CategoriaHardware" NOT NULL,
    "posicao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escala_x" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_y" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_z" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pontos_encaixe_hardwares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_3d_hardwares_hardware_id_idx" ON "modelos_3d_hardwares"("hardware_id");

-- CreateIndex
CREATE INDEX "modelos_3d_hardwares_hardware_id_ativo_idx" ON "modelos_3d_hardwares"("hardware_id", "ativo");

-- CreateIndex
CREATE INDEX "pontos_encaixe_hardwares_hardware_pai_id_categoria_aceita_idx" ON "pontos_encaixe_hardwares"("hardware_pai_id", "categoria_aceita");

-- CreateIndex
CREATE UNIQUE INDEX "pontos_encaixe_hardwares_hardware_pai_id_codigo_key" ON "pontos_encaixe_hardwares"("hardware_pai_id", "codigo");

-- AddForeignKey
ALTER TABLE "modelos_3d_hardwares" ADD CONSTRAINT "modelos_3d_hardwares_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pontos_encaixe_hardwares" ADD CONSTRAINT "pontos_encaixe_hardwares_hardware_pai_id_fkey" FOREIGN KEY ("hardware_pai_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
