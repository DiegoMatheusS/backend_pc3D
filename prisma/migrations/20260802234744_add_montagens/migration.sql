-- CreateEnum
CREATE TYPE "StatusMontagem" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');

-- CreateTable
CREATE TABLE "montagens" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "gabinete_id" INTEGER NOT NULL,
    "fonte_id" INTEGER,
    "cooler_id" INTEGER,
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "slug" VARCHAR(220) NOT NULL,
    "status" "StatusMontagem" NOT NULL DEFAULT 'RASCUNHO',
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "montagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_montagem" (
    "id" SERIAL NOT NULL,
    "montagem_id" INTEGER NOT NULL,
    "instanciaId" VARCHAR(100) NOT NULL,
    "instancia_pai_id" VARCHAR(100),
    "ponto_encaixe_id" INTEGER NOT NULL,
    "hardware_filho_id" INTEGER NOT NULL,

    CONSTRAINT "itens_montagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventoinhas_config_montagem" (
    "id" SERIAL NOT NULL,
    "montagem_id" INTEGER NOT NULL,
    "ventoinha_id" INTEGER NOT NULL,
    "posicao" "PosicaoRefrigeracaoGabinete" NOT NULL,
    "sentido" VARCHAR(10),

    CONSTRAINT "ventoinhas_config_montagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "montagens_slug_key" ON "montagens"("slug");

-- CreateIndex
CREATE INDEX "montagens_usuario_id_idx" ON "montagens"("usuario_id");

-- CreateIndex
CREATE INDEX "montagens_status_idx" ON "montagens"("status");

-- CreateIndex
CREATE INDEX "montagens_publico_idx" ON "montagens"("publico");

-- CreateIndex
CREATE INDEX "itens_montagem_montagem_id_idx" ON "itens_montagem"("montagem_id");

-- CreateIndex
CREATE UNIQUE INDEX "itens_montagem_montagem_id_instanciaId_key" ON "itens_montagem"("montagem_id", "instanciaId");

-- CreateIndex
CREATE INDEX "ventoinhas_config_montagem_montagem_id_idx" ON "ventoinhas_config_montagem"("montagem_id");

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_gabinete_id_fkey" FOREIGN KEY ("gabinete_id") REFERENCES "hardwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_fonte_id_fkey" FOREIGN KEY ("fonte_id") REFERENCES "hardwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "montagens" ADD CONSTRAINT "montagens_cooler_id_fkey" FOREIGN KEY ("cooler_id") REFERENCES "hardwares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_montagem" ADD CONSTRAINT "itens_montagem_montagem_id_fkey" FOREIGN KEY ("montagem_id") REFERENCES "montagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_montagem" ADD CONSTRAINT "itens_montagem_ponto_encaixe_id_fkey" FOREIGN KEY ("ponto_encaixe_id") REFERENCES "pontos_encaixe_hardwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_montagem" ADD CONSTRAINT "itens_montagem_hardware_filho_id_fkey" FOREIGN KEY ("hardware_filho_id") REFERENCES "hardwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventoinhas_config_montagem" ADD CONSTRAINT "ventoinhas_config_montagem_montagem_id_fkey" FOREIGN KEY ("montagem_id") REFERENCES "montagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventoinhas_config_montagem" ADD CONSTRAINT "ventoinhas_config_montagem_ventoinha_id_fkey" FOREIGN KEY ("ventoinha_id") REFERENCES "hardwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
