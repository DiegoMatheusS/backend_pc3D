-- CreateEnum
CREATE TYPE "TipoConectorVentoinha" AS ENUM ('DC_3_PINOS', 'PWM_4_PINOS', 'MOLEX', 'PROPRIETARIO');

-- CreateTable
CREATE TABLE "especificacoes_ventoinhas" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "tamanho_mm" INTEGER NOT NULL,
    "espessura_mm" DOUBLE PRECISION,
    "rpm_minima" INTEGER,
    "rpm_maxima" INTEGER,
    "fluxo_ar_cfm" DOUBLE PRECISION,
    "pressao_estatica_mm_h2o" DOUBLE PRECISION,
    "ruido_db" DOUBLE PRECISION,
    "conector" "TipoConectorVentoinha" NOT NULL,
    "tensao_volts" DOUBLE PRECISION,
    "corrente_amperes" DOUBLE PRECISION,
    "pwm" BOOLEAN NOT NULL DEFAULT false,
    "rgb" BOOLEAN NOT NULL DEFAULT false,
    "argb" BOOLEAN NOT NULL DEFAULT false,
    "fluxo_reverso" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "especificacoes_ventoinhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especificacoes_ventoinhas_hardware_id_key" ON "especificacoes_ventoinhas"("hardware_id");

-- AddForeignKey
ALTER TABLE "especificacoes_ventoinhas" ADD CONSTRAINT "especificacoes_ventoinhas_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
