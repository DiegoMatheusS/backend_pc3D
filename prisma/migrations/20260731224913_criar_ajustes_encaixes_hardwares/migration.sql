-- CreateTable
CREATE TABLE "ajustes_encaixes_hardwares" (
    "id" SERIAL NOT NULL,
    "ponto_encaixe_id" INTEGER NOT NULL,
    "hardware_filho_id" INTEGER NOT NULL,
    "posicao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posicao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotacao_z" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "escala_x" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_y" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "escala_z" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ajustes_encaixes_hardwares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ajustes_encaixes_hardwares_hardware_filho_id_idx" ON "ajustes_encaixes_hardwares"("hardware_filho_id");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_encaixes_hardwares_ponto_encaixe_id_hardware_filho__key" ON "ajustes_encaixes_hardwares"("ponto_encaixe_id", "hardware_filho_id");

-- AddForeignKey
ALTER TABLE "ajustes_encaixes_hardwares" ADD CONSTRAINT "ajustes_encaixes_hardwares_ponto_encaixe_id_fkey" FOREIGN KEY ("ponto_encaixe_id") REFERENCES "pontos_encaixe_hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_encaixes_hardwares" ADD CONSTRAINT "ajustes_encaixes_hardwares_hardware_filho_id_fkey" FOREIGN KEY ("hardware_filho_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
