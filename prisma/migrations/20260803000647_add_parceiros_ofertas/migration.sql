-- CreateEnum
CREATE TYPE "StatusOferta" AS ENUM ('ATIVA', 'INDISPONIVEL', 'DESCONTINUADA');

-- CreateTable
CREATE TABLE "parceiros" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "logo_url" VARCHAR(500),
    "site" VARCHAR(500),
    "dominio" VARCHAR(150),
    "programa_afiliados" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parceiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas" (
    "id" SERIAL NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "parceiro_id" INTEGER NOT NULL,
    "url_original" VARCHAR(500) NOT NULL,
    "url_afiliada" VARCHAR(500),
    "preco" DECIMAL(10,2) NOT NULL,
    "preco_anterior" DECIMAL(10,2),
    "status" "StatusOferta" NOT NULL DEFAULT 'ATIVA',
    "coletado_em" TIMESTAMPTZ(3),
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parceiros_slug_key" ON "parceiros"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "parceiros_dominio_key" ON "parceiros"("dominio");

-- CreateIndex
CREATE INDEX "ofertas_hardware_id_status_idx" ON "ofertas"("hardware_id", "status");

-- CreateIndex
CREATE INDEX "ofertas_parceiro_id_idx" ON "ofertas"("parceiro_id");

-- CreateIndex
CREATE UNIQUE INDEX "ofertas_hardware_id_parceiro_id_key" ON "ofertas"("hardware_id", "parceiro_id");

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_parceiro_id_fkey" FOREIGN KEY ("parceiro_id") REFERENCES "parceiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
