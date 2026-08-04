-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('HARDWARE_CRIADO', 'HARDWARE_ATUALIZADO', 'HARDWARE_PUBLICADO', 'HARDWARE_DESPUBLICADO', 'HARDWARE_REMOVIDO', 'HARDWARE_REMOVIDO_PERMANENTEMENTE', 'MODELO_3D_CRIADO', 'MODELO_3D_APROVADO', 'MODELO_3D_DESATIVADO', 'COMPATIBILIDADE_CRIADA', 'COMPATIBILIDADE_REMOVIDA', 'USUARIO_CRIADO', 'USUARIO_ATUALIZADO', 'USUARIO_DESATIVADO', 'SENHA_REDEFINIDA_ADMIN', 'PARCEIRO_CRIADO', 'PARCEIRO_ATUALIZADO', 'OFERTA_CRIADA', 'OFERTA_ATUALIZADA', 'OFERTA_REMOVIDA', 'MONTAGEM_CRIADA', 'MONTAGEM_ATUALIZADA', 'MONTAGEM_REMOVIDA');

-- CreateTable
CREATE TABLE "auditoria_logs" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" VARCHAR(100) NOT NULL,
    "entidade_id" VARCHAR(100),
    "dados_antigos" JSONB,
    "dados_novos" JSONB,
    "ip" VARCHAR(45),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_logs_acao_idx" ON "auditoria_logs"("acao");

-- CreateIndex
CREATE INDEX "auditoria_logs_entidade_entidade_id_idx" ON "auditoria_logs"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "auditoria_logs_usuario_id_idx" ON "auditoria_logs"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_logs_criado_em_idx" ON "auditoria_logs"("criado_em");

-- AddForeignKey
ALTER TABLE "auditoria_logs" ADD CONSTRAINT "auditoria_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
