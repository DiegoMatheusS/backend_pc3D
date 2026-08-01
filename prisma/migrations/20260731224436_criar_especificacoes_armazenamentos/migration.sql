-- CreateEnum
CREATE TYPE "TipoArmazenamento" AS ENUM ('SSD', 'HDD');

-- CreateEnum
CREATE TYPE "FormatoArmazenamento" AS ENUM ('POLEGADAS_2_5', 'POLEGADAS_3_5', 'M2', 'PLACA_PCIE');

-- CreateEnum
CREATE TYPE "InterfaceArmazenamento" AS ENUM ('SATA', 'NVME_PCIE', 'SAS');

-- CreateEnum
CREATE TYPE "ChaveM2" AS ENUM ('B', 'M', 'B_M');

-- CreateTable
CREATE TABLE "especificacoes_armazenamentos" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "tipo" "TipoArmazenamento" NOT NULL,
    "formato" "FormatoArmazenamento" NOT NULL,
    "interface" "InterfaceArmazenamento" NOT NULL,
    "capacidade_gb" INTEGER NOT NULL,
    "tamanho_m2_mm" INTEGER,
    "chave_m2" "ChaveM2",
    "geracao_pcie" INTEGER,
    "pistas_pcie" INTEGER,
    "leitura_sequencial_mbps" INTEGER,
    "escrita_sequencial_mbps" INTEGER,
    "altura_mm" DOUBLE PRECISION,
    "largura_mm" DOUBLE PRECISION,
    "profundidade_mm" DOUBLE PRECISION,
    "espessura_mm" DOUBLE PRECISION,
    "consumo_watts" DOUBLE PRECISION,
    "possui_dissipador" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "especificacoes_armazenamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_armazenamentos_hardware_id_key" ON "especificacoes_armazenamentos"("hardware_id");

-- AddForeignKey
ALTER TABLE "especificacoes_armazenamentos" ADD CONSTRAINT "especificacoes_armazenamentos_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
