-- CreateTable
CREATE TABLE "compatibilidades_memorias_placas_mae" (
    "id" SERIAL NOT NULL,
    "placa_mae_id" INTEGER NOT NULL,
    "memoria_ram_id" INTEGER NOT NULL,
    "revisao_placa_mae" VARCHAR(50),
    "bios_testada" VARCHAR(50),
    "familia_processador_testada" VARCHAR(150),
    "frequencia_validada_mhz" INTEGER,
    "quantidade_modulos_testados" INTEGER,
    "capacidade_total_testada_gb" INTEGER,
    "compativel" BOOLEAN NOT NULL DEFAULT true,
    "consta_na_qvl" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "fonte_url" VARCHAR(500),
    "verificado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "compatibilidades_memorias_placas_mae_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compatibilidades_memorias_placas_mae_placa_mae_id_idx" ON "compatibilidades_memorias_placas_mae"("placa_mae_id");

-- CreateIndex
CREATE INDEX "compatibilidades_memorias_placas_mae_memoria_ram_id_idx" ON "compatibilidades_memorias_placas_mae"("memoria_ram_id");

-- CreateIndex
CREATE UNIQUE INDEX "compatibilidades_memorias_placas_mae_placa_mae_id_memoria_r_key" ON "compatibilidades_memorias_placas_mae"("placa_mae_id", "memoria_ram_id", "revisao_placa_mae");

-- AddForeignKey
ALTER TABLE "compatibilidades_memorias_placas_mae" ADD CONSTRAINT "compatibilidades_memorias_placas_mae_placa_mae_id_fkey" FOREIGN KEY ("placa_mae_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_memorias_placas_mae" ADD CONSTRAINT "compatibilidades_memorias_placas_mae_memoria_ram_id_fkey" FOREIGN KEY ("memoria_ram_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
