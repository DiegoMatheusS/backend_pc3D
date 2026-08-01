-- AlterTable
ALTER TABLE "especificacoes_placas_mae" ADD COLUMN     "portas_sata" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "slots_m2_placas_mae" (
    "id" SERIAL NOT NULL,
    "especificacao_placa_mae_id" INTEGER NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "interfaces_suportadas" "InterfaceArmazenamento"[],
    "chaves_suportadas" "ChaveM2"[],
    "tamanhos_suportados_mm" INTEGER[],
    "geracao_pcie_maxima" INTEGER,
    "pistas_pcie" INTEGER,
    "compartilha_com" VARCHAR(150),
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "slots_m2_placas_mae_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slots_m2_placas_mae_especificacao_placa_mae_id_codigo_key" ON "slots_m2_placas_mae"("especificacao_placa_mae_id", "codigo");

-- AddForeignKey
ALTER TABLE "slots_m2_placas_mae" ADD CONSTRAINT "slots_m2_placas_mae_especificacao_placa_mae_id_fkey" FOREIGN KEY ("especificacao_placa_mae_id") REFERENCES "especificacoes_placas_mae"("id") ON DELETE CASCADE ON UPDATE CASCADE;
