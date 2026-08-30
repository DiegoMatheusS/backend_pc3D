-- Normaliza eventual estado legado antes de criar a garantia global.
WITH selecionado AS (
  SELECT "id" FROM "modelos_3d_hardwares"
  WHERE "mostrar_no_home" = true
  ORDER BY "atualizado_em" DESC, "id" DESC
  LIMIT 1
)
UPDATE "modelos_3d_hardwares"
SET "mostrar_no_home" = false
WHERE "mostrar_no_home" = true
  AND "id" NOT IN (SELECT "id" FROM selecionado);

-- Somente um registro pode ter mostrar_no_home=true em todo o banco.
CREATE UNIQUE INDEX IF NOT EXISTS "modelos_3d_hardwares_um_home_idx"
ON "modelos_3d_hardwares" ((1))
WHERE "mostrar_no_home" = true;
