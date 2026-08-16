-- CreateEnum
CREATE TYPE "TipoCooler" AS ENUM ('AIR_COOLER', 'WATER_COOLER');

-- CreateTable
CREATE TABLE "especificacoes_coolers" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "tipo" "TipoCooler" NOT NULL,
    "sockets_suportados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capacidade_termica_watts" INTEGER,
    "altura_mm" DOUBLE PRECISION,
    "largura_mm" DOUBLE PRECISION,
    "profundidade_mm" DOUBLE PRECISION,
    "altura_livre_ram_mm" DOUBLE PRECISION,
    "tamanho_radiador_mm" INTEGER,
    "espessura_radiador_mm" DOUBLE PRECISION,
    "quantidade_ventoinhas" INTEGER,
    "tamanho_ventoinha_mm" INTEGER,
    "espessura_ventoinha_mm" DOUBLE PRECISION,
    "comprimento_mangueiras_mm" DOUBLE PRECISION,
    "conector_bomba" VARCHAR(50),
    "consumo_bomba_watts" DOUBLE PRECISION,
    "rgb" BOOLEAN NOT NULL DEFAULT false,
    "argb" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "especificacoes_coolers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_coolers_hardware_id_key" ON "especificacoes_coolers"("hardware_id");

-- AddForeignKey
ALTER TABLE "especificacoes_coolers" ADD CONSTRAINT "especificacoes_coolers_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
