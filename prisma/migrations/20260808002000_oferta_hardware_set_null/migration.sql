-- A Oferta pertence ao Produto. O vínculo com Hardware é apenas técnico/opcional.
-- Ao excluir permanentemente um Hardware, preserva a Oferta e seu histórico.
ALTER TABLE "ofertas"
  DROP CONSTRAINT IF EXISTS "ofertas_hardware_id_fkey";

ALTER TABLE "ofertas"
  ADD CONSTRAINT "ofertas_hardware_id_fkey"
  FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
