-- CreateEnum
CREATE TYPE "TipoFonteImportacao" AS ENUM ('API', 'HTML_OFICIAL', 'PDF_OFICIAL', 'CSV', 'FEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PENDENTE', 'PROCESSANDO', 'AGUARDANDO_REVISAO', 'APROVADA', 'REJEITADA', 'FALHOU');

-- CreateTable
CREATE TABLE "fontes_importacao" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "fabricante" VARCHAR(100) NOT NULL,
    "tipo" "TipoFonteImportacao" NOT NULL,
    "url_base" VARCHAR(500),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultima_coleta_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fontes_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes_hardwares" (
    "id" SERIAL NOT NULL,
    "fonte_id" INTEGER NOT NULL,
    "hardware_id" INTEGER,
    "revisado_por_id" INTEGER,
    "identificador_externo" VARCHAR(200),
    "url_origem" VARCHAR(500) NOT NULL,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PENDENTE',
    "nivel_confianca" DOUBLE PRECISION,
    "conteudo_bruto" JSONB,
    "dados_normalizados" JSONB,
    "hash_conteudo" VARCHAR(64),
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "coletado_em" TIMESTAMPTZ(3),
    "revisado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "importacoes_hardwares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fontes_importacao_fabricante_nome_key" ON "fontes_importacao"("fabricante", "nome");

-- CreateIndex
CREATE INDEX "importacoes_hardwares_fonte_id_idx" ON "importacoes_hardwares"("fonte_id");

-- CreateIndex
CREATE INDEX "importacoes_hardwares_hardware_id_idx" ON "importacoes_hardwares"("hardware_id");

-- CreateIndex
CREATE INDEX "importacoes_hardwares_status_idx" ON "importacoes_hardwares"("status");

-- CreateIndex
CREATE INDEX "importacoes_hardwares_identificador_externo_idx" ON "importacoes_hardwares"("identificador_externo");

-- AddForeignKey
ALTER TABLE "importacoes_hardwares" ADD CONSTRAINT "importacoes_hardwares_fonte_id_fkey" FOREIGN KEY ("fonte_id") REFERENCES "fontes_importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_hardwares" ADD CONSTRAINT "importacoes_hardwares_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_hardwares" ADD CONSTRAINT "importacoes_hardwares_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
