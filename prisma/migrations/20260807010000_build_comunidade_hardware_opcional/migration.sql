-- Builds da Comunidade podem registrar peças que não existem no catálogo de Hardware.
-- O vínculo com Hardware passa a ser opcional e os dados principais da peça ficam
-- preservados como snapshot dentro da própria build.

ALTER TABLE "builds_comunidade_componentes"
  DROP CONSTRAINT IF EXISTS "builds_comunidade_componentes_hardware_id_fkey";

ALTER TABLE "builds_comunidade_componentes"
  ALTER COLUMN "hardware_id" DROP NOT NULL,
  ADD COLUMN "nome" VARCHAR(200),
  ADD COLUMN "marca" VARCHAR(100),
  ADD COLUMN "modelo" VARCHAR(150),
  ADD COLUMN "imagem_url" VARCHAR(500);

-- Preserva os dados dos componentes já existentes antes de tornar nome obrigatório.
UPDATE "builds_comunidade_componentes" AS componente
SET
  "nome" = hardware."nome",
  "marca" = hardware."marca",
  "modelo" = hardware."modelo",
  "imagem_url" = hardware."imagem_url"
FROM "hardwares" AS hardware
WHERE componente."hardware_id" = hardware."id";

-- Todos os registros antigos possuíam FK válida, então o nome foi preenchido acima.
ALTER TABLE "builds_comunidade_componentes"
  ALTER COLUMN "nome" SET NOT NULL;

ALTER TABLE "builds_comunidade_componentes"
  ADD CONSTRAINT "builds_comunidade_componentes_hardware_id_fkey"
  FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
