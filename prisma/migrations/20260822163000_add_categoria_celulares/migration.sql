-- Adiciona Celulares ao catálogo comercial sem transformá-los em Hardware técnico.
-- atualizado_em é @updatedAt no Prisma e não possui DEFAULT no PostgreSQL,
-- portanto precisa ser informado em INSERTs SQL diretos.
INSERT INTO "categorias_produtos" ("nome", "slug", "grupo", "ordem", "atualizado_em")
VALUES ('Celulares', 'celulares', 'COMPUTADORES', 30, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
