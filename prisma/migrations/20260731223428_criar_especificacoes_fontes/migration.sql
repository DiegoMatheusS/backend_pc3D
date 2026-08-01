-- CreateEnum
CREATE TYPE "ModularidadeFonte" AS ENUM ('NAO_MODULAR', 'SEMI_MODULAR', 'MODULAR');

-- CreateTable
CREATE TABLE "especificacoes_fontes" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "formato" "FormatoFonte" NOT NULL,
    "potencia_watts" INTEGER NOT NULL,
    "certificacao" VARCHAR(100),
    "modularidade" "ModularidadeFonte" NOT NULL DEFAULT 'NAO_MODULAR',
    "comprimento_mm" DOUBLE PRECISION,
    "largura_mm" DOUBLE PRECISION,
    "altura_mm" DOUBLE PRECISION,
    "padrao_atx" VARCHAR(50),
    "eficiencia_percentual" DOUBLE PRECISION,
    "corrente_linha_12v_amperes" DOUBLE PRECISION,
    "conectores_atx_24_pinos" INTEGER NOT NULL DEFAULT 1,
    "conectores_eps_cpu" INTEGER NOT NULL DEFAULT 1,
    "conectores_pcie_6_pinos" INTEGER NOT NULL DEFAULT 0,
    "conectores_pcie_8_pinos" INTEGER NOT NULL DEFAULT 0,
    "conectores_12vhpwr" INTEGER NOT NULL DEFAULT 0,
    "conectores_12v_2x6" INTEGER NOT NULL DEFAULT 0,
    "conectores_sata" INTEGER NOT NULL DEFAULT 0,
    "conectores_molex" INTEGER NOT NULL DEFAULT 0,
    "protecoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tensao_entrada" VARCHAR(100),

    CONSTRAINT "especificacoes_fontes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_fontes_hardware_id_key" ON "especificacoes_fontes"("hardware_id");

-- AddForeignKey
ALTER TABLE "especificacoes_fontes" ADD CONSTRAINT "especificacoes_fontes_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
