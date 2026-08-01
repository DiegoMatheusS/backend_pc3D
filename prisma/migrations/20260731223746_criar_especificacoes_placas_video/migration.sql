-- CreateTable
CREATE TABLE "especificacoes_placas_video" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "chipset" VARCHAR(150),
    "memoria_video_gb" INTEGER,
    "tipo_memoria_video" VARCHAR(50),
    "geracao_pcie" INTEGER,
    "largura_pcie" INTEGER,
    "comprimento_mm" DOUBLE PRECISION NOT NULL,
    "altura_mm" DOUBLE PRECISION,
    "espessura_mm" DOUBLE PRECISION,
    "slots_ocupados" DOUBLE PRECISION,
    "consumo_watts" INTEGER,
    "potencia_fonte_recomendada_watts" INTEGER,
    "conectores_pcie_6_pinos" INTEGER NOT NULL DEFAULT 0,
    "conectores_pcie_8_pinos" INTEGER NOT NULL DEFAULT 0,
    "conectores_12vhpwr" INTEGER NOT NULL DEFAULT 0,
    "conectores_12v_2x6" INTEGER NOT NULL DEFAULT 0,
    "saidas_video" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "especificacoes_placas_video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_placas_video_hardware_id_key" ON "especificacoes_placas_video"("hardware_id");

-- AddForeignKey
ALTER TABLE "especificacoes_placas_video" ADD CONSTRAINT "especificacoes_placas_video_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
