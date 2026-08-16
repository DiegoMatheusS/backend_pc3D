-- CreateEnum
CREATE TYPE "TipoMemoria" AS ENUM ('DDR3', 'DDR4', 'DDR5');

-- CreateEnum
CREATE TYPE "FormatoMemoria" AS ENUM ('DIMM', 'SO_DIMM');

-- CreateEnum
CREATE TYPE "FormatoPlacaMae" AS ENUM ('E_ATX', 'ATX', 'MICRO_ATX', 'MINI_ITX');

-- CreateTable
CREATE TABLE "especificacoes_processadores" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "socket" VARCHAR(50) NOT NULL,
    "familia" VARCHAR(100),
    "linha" VARCHAR(100),
    "geracao" VARCHAR(100),
    "arquitetura" VARCHAR(100),
    "nucleos" INTEGER,
    "threads" INTEGER,
    "frequencia_base_mhz" INTEGER,
    "frequencia_turbo_mhz" INTEGER,
    "tdp_watts" INTEGER,
    "possui_video_integrado" BOOLEAN NOT NULL DEFAULT false,
    "modelo_video_integrado" VARCHAR(150),
    "tipos_memoria_suportados" "TipoMemoria"[],
    "frequencia_memoria_maxima_mhz" INTEGER,
    "capacidade_memoria_maxima_gb" INTEGER,
    "canais_memoria" INTEGER,
    "suporta_ecc" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "especificacoes_processadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especificacoes_placas_mae" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "socket" VARCHAR(50) NOT NULL,
    "chipset" VARCHAR(100) NOT NULL,
    "formato" "FormatoPlacaMae" NOT NULL,
    "revisao" VARCHAR(50),
    "bios_inicial" VARCHAR(50),
    "tipos_memoria_suportados" "TipoMemoria"[],
    "frequencias_memoria_jedec_mhz" INTEGER[],
    "frequencias_memoria_overclock_mhz" INTEGER[],
    "slots_memoria" INTEGER NOT NULL,
    "capacidade_maxima_memoria_gb" INTEGER,
    "capacidade_maxima_por_slot_gb" INTEGER,
    "suporta_xmp" BOOLEAN NOT NULL DEFAULT false,
    "suporta_expo" BOOLEAN NOT NULL DEFAULT false,
    "suporta_ecc" BOOLEAN NOT NULL DEFAULT false,
    "saidas_video" TEXT[],

    CONSTRAINT "especificacoes_placas_mae_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especificacoes_memorias_ram" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "tipo" "TipoMemoria" NOT NULL,
    "formato" "FormatoMemoria" NOT NULL,
    "capacidade_por_modulo_gb" INTEGER NOT NULL,
    "quantidade_modulos" INTEGER NOT NULL DEFAULT 1,
    "frequencia_mhz" INTEGER NOT NULL,
    "frequencia_jedec_mhz" INTEGER,
    "latencia_cl" INTEGER,
    "tensao_volts" DOUBLE PRECISION,
    "ecc" BOOLEAN NOT NULL DEFAULT false,
    "registrada" BOOLEAN NOT NULL DEFAULT false,
    "suporta_xmp" BOOLEAN NOT NULL DEFAULT false,
    "suporta_expo" BOOLEAN NOT NULL DEFAULT false,
    "altura_mm" DOUBLE PRECISION,

    CONSTRAINT "especificacoes_memorias_ram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibilidades_cpu_placa_mae" (
    "id" SERIAL NOT NULL,
    "placa_mae_id" INTEGER NOT NULL,
    "processador_id" INTEGER NOT NULL,
    "revisao_placa_mae" VARCHAR(50),
    "bios_minima" VARCHAR(50),
    "compativel" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "fonte_url" VARCHAR(500),
    "verificado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "compatibilidades_cpu_placa_mae_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_processadores_hardware_id_key" ON "especificacoes_processadores"("hardware_id");

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_placas_mae_hardware_id_key" ON "especificacoes_placas_mae"("hardware_id");

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_memorias_ram_hardware_id_key" ON "especificacoes_memorias_ram"("hardware_id");

-- CreateIndex
CREATE INDEX "compatibilidades_cpu_placa_mae_placa_mae_id_idx" ON "compatibilidades_cpu_placa_mae"("placa_mae_id");

-- CreateIndex
CREATE INDEX "compatibilidades_cpu_placa_mae_processador_id_idx" ON "compatibilidades_cpu_placa_mae"("processador_id");

-- CreateIndex
CREATE UNIQUE INDEX "compatibilidades_cpu_placa_mae_placa_mae_id_processador_id__key" ON "compatibilidades_cpu_placa_mae"("placa_mae_id", "processador_id", "revisao_placa_mae");

-- AddForeignKey
ALTER TABLE "especificacoes_processadores" ADD CONSTRAINT "especificacoes_processadores_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificacoes_placas_mae" ADD CONSTRAINT "especificacoes_placas_mae_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especificacoes_memorias_ram" ADD CONSTRAINT "especificacoes_memorias_ram_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_cpu_placa_mae" ADD CONSTRAINT "compatibilidades_cpu_placa_mae_placa_mae_id_fkey" FOREIGN KEY ("placa_mae_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibilidades_cpu_placa_mae" ADD CONSTRAINT "compatibilidades_cpu_placa_mae_processador_id_fkey" FOREIGN KEY ("processador_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
