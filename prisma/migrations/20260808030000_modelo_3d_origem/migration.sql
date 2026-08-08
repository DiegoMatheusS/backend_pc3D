-- Permite distinguir modelos hospedados pelo CriaByte de modelos externos.
-- O arquivo 3D continua fora do PostgreSQL; o banco armazena apenas URL e metadados.
CREATE TYPE "OrigemModelo3D" AS ENUM ('PROPRIO', 'EXTERNO');

ALTER TABLE "modelos_3d_hardwares"
ADD COLUMN "origem" "OrigemModelo3D" NOT NULL DEFAULT 'PROPRIO',
ADD COLUMN "storage_key" VARCHAR(500),
ADD COLUMN "fonte_url" VARCHAR(500),
ADD COLUMN "autor" VARCHAR(200),
ADD COLUMN "licenca" VARCHAR(150);
