-- Alinha a tabela de especificações de placas-mãe ao schema Prisma atual.
-- IF NOT EXISTS mantém o deploy seguro caso algum ambiente já tenha recebido
-- uma ou mais dessas colunas manualmente.
ALTER TABLE "especificacoes_placas_mae"
  ADD COLUMN IF NOT EXISTS "versao_pcie" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "wifi" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bluetooth" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ethernet" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "bios_flashback" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bios_minima" VARCHAR(50);
