CREATE TABLE "builds_pessoais" (
 "usuario_id" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
 "cliente_id" VARCHAR(100) NOT NULL, "dados" JSONB NOT NULL, "revisao" INTEGER NOT NULL DEFAULT 1,
 "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("usuario_id", "cliente_id")
);
CREATE TABLE "seguranca_conta" (
 "usuario_id" INTEGER PRIMARY KEY REFERENCES "usuarios"("id") ON DELETE CASCADE,
 "segredo" TEXT, "ultimo_passo" BIGINT, "recuperacao" TEXT[] NOT NULL DEFAULT '{}'
);
CREATE TABLE "tokens_acesso" (
 "hash" VARCHAR(64) PRIMARY KEY, "usuario_id" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
 "finalidade" VARCHAR(30) NOT NULL, "tentativas" INTEGER NOT NULL DEFAULT 0, "dados" TEXT, "expira_em" TIMESTAMPTZ(3) NOT NULL, "usado_em" TIMESTAMPTZ(3)
);
CREATE INDEX "tokens_acesso_expira_em_idx" ON "tokens_acesso"("expira_em");
CREATE TABLE "limites_requisicao" (
 "chave" VARCHAR(64) PRIMARY KEY, "total" INTEGER NOT NULL DEFAULT 0,
 "expira_em" TIMESTAMPTZ(3) NOT NULL, "bloqueado_ate" TIMESTAMPTZ(3)
);
CREATE INDEX "limites_requisicao_expira_em_idx" ON "limites_requisicao"("expira_em");
