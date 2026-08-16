-- Compatibilidade de memória mais precisa para placas-mãe desktop.
-- Mantém os registros existentes assumindo DIMM, que é o padrão do catálogo
-- de placas-mãe de desktop do CriaByte. Novos cadastros podem informar SO_DIMM.
ALTER TABLE "especificacoes_placas_mae"
ADD COLUMN "formatos_memoria_suportados" "FormatoMemoria"[] NOT NULL DEFAULT ARRAY['DIMM']::"FormatoMemoria"[],
ADD COLUMN "suporta_memoria_registrada" BOOLEAN NOT NULL DEFAULT false;
