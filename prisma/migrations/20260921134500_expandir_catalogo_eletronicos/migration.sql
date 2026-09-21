-- Expansão do catálogo comercial para eletrônicos gerais.
-- Todos continuam como Produto GENERICO + Oferta; não entram no PC Builder/Hardware.

UPDATE "categorias_produtos"
SET "nome" = 'Câmeras e fotografia', "atualizado_em" = CURRENT_TIMESTAMP
WHERE "slug" = 'cameras';

INSERT INTO "categorias_produtos" ("nome", "slug", "grupo", "ordem", "atualizado_em") VALUES
  ('Aspiradores de pó', 'aspiradores-de-po', 'SETUP', 80, CURRENT_TIMESTAMP),
  ('Robôs aspiradores', 'robos-aspiradores', 'SETUP', 81, CURRENT_TIMESTAMP),
  ('Smart speakers', 'smart-speakers', 'SETUP', 82, CURRENT_TIMESTAMP),
  ('Câmeras de segurança', 'cameras-de-seguranca', 'SETUP', 83, CURRENT_TIMESTAMP),
  ('Lâmpadas inteligentes', 'lampadas-inteligentes', 'SETUP', 84, CURRENT_TIMESTAMP),
  ('Tomadas inteligentes', 'tomadas-inteligentes', 'SETUP', 85, CURRENT_TIMESTAMP),
  ('Fechaduras inteligentes', 'fechaduras-inteligentes', 'SETUP', 86, CURRENT_TIMESTAMP),
  ('E-readers', 'e-readers', 'COMPUTADORES', 86, CURRENT_TIMESTAMP),
  ('Drones', 'drones', 'PERIFERICOS', 86, CURRENT_TIMESTAMP),
  ('Câmeras de ação', 'cameras-de-acao', 'PERIFERICOS', 87, CURRENT_TIMESTAMP),
  ('Soundbars', 'soundbars', 'PERIFERICOS', 88, CURRENT_TIMESTAMP),
  ('Home theaters', 'home-theaters', 'PERIFERICOS', 89, CURRENT_TIMESTAMP),
  ('TVs', 'tvs', 'SETUP', 90, CURRENT_TIMESTAMP),
  ('Air fryers', 'air-fryers', 'SETUP', 91, CURRENT_TIMESTAMP),
  ('Cafeteiras', 'cafeteiras', 'SETUP', 92, CURRENT_TIMESTAMP),
  ('Liquidificadores', 'liquidificadores', 'SETUP', 93, CURRENT_TIMESTAMP),
  ('Ventiladores', 'ventiladores', 'SETUP', 94, CURRENT_TIMESTAMP),
  ('Climatizadores', 'climatizadores', 'SETUP', 95, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
