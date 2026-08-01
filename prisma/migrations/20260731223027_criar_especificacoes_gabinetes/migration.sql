-- CreateEnum
CREATE TYPE "TamanhoGabinete" AS ENUM ('FULL_TOWER', 'MID_TOWER', 'MINI_TOWER', 'SFF', 'OPEN_FRAME');

-- CreateEnum
CREATE TYPE "FormatoFonte" AS ENUM ('ATX', 'SFX', 'SFX_L', 'TFX', 'FLEX_ATX');

-- CreateEnum
CREATE TYPE "PosicaoRefrigeracaoGabinete" AS ENUM ('FRENTE', 'TOPO', 'TRASEIRA', 'INFERIOR', 'LATERAL');

-- CreateTable
CREATE TABLE "especificacoes_gabinetes" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "tamanho" "TamanhoGabinete" NOT NULL,
    "altura_mm" DOUBLE PRECISION NOT NULL,
    "largura_mm" DOUBLE PRECISION NOT NULL,
    "profundidade_mm" DOUBLE PRECISION NOT NULL,
    "formatos_placa_mae_suportados" "FormatoPlacaMae"[],
    "formatos_fonte_suportados" "FormatoFonte"[],
    "comprimento_maximo_fonte_mm" DOUBLE PRECISION,
    "comprimento_maximo_gpu_mm" DOUBLE PRECISION,
    "altura_maxima_gpu_mm" DOUBLE PRECISION,
    "slots_maximos_gpu" DOUBLE PRECISION,
    "altura_maxima_cooler_cpu_mm" DOUBLE PRECISION,
    "baias_25" INTEGER NOT NULL DEFAULT 0,
    "baias_35" INTEGER NOT NULL DEFAULT 0,
    "slots_traseiros" INTEGER,
    "suporta_gpu_vertical" BOOLEAN NOT NULL DEFAULT false,
    "espaco_gerenciamento_cabos_mm" DOUBLE PRECISION,

    CONSTRAINT "especificacoes_gabinetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suportes_ventoinhas_gabinetes" (
    "id" SERIAL NOT NULL,
    "especificacao_gabinete_id" INTEGER NOT NULL,
    "posicao" "PosicaoRefrigeracaoGabinete" NOT NULL,
    "tamanho_mm" INTEGER NOT NULL,
    "quantidade_maxima" INTEGER NOT NULL,
    "espessura_maxima_mm" DOUBLE PRECISION,
    "observacao" TEXT,

    CONSTRAINT "suportes_ventoinhas_gabinetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suportes_radiadores_gabinetes" (
    "id" SERIAL NOT NULL,
    "especificacao_gabinete_id" INTEGER NOT NULL,
    "posicao" "PosicaoRefrigeracaoGabinete" NOT NULL,
    "tamanho_mm" INTEGER NOT NULL,
    "espessura_conjunto_maxima_mm" DOUBLE PRECISION,
    "observacao" TEXT,

    CONSTRAINT "suportes_radiadores_gabinetes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_gabinetes_hardware_id_key" ON "especificacoes_gabinetes"("hardware_id");

-- CreateIndex
CREATE UNIQUE INDEX "suportes_ventoinhas_gabinetes_especificacao_gabinete_id_pos_key" ON "suportes_ventoinhas_gabinetes"("especificacao_gabinete_id", "posicao", "tamanho_mm");

-- CreateIndex
CREATE UNIQUE INDEX "suportes_radiadores_gabinetes_especificacao_gabinete_id_pos_key" ON "suportes_radiadores_gabinetes"("especificacao_gabinete_id", "posicao", "tamanho_mm");

-- AddForeignKey
ALTER TABLE "especificacoes_gabinetes" ADD CONSTRAINT "especificacoes_gabinetes_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suportes_ventoinhas_gabinetes" ADD CONSTRAINT "suportes_ventoinhas_gabinetes_especificacao_gabinete_id_fkey" FOREIGN KEY ("especificacao_gabinete_id") REFERENCES "especificacoes_gabinetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suportes_radiadores_gabinetes" ADD CONSTRAINT "suportes_radiadores_gabinetes_especificacao_gabinete_id_fkey" FOREIGN KEY ("especificacao_gabinete_id") REFERENCES "especificacoes_gabinetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
