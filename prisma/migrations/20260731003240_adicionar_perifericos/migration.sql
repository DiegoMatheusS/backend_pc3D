-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CategoriaHardware" ADD VALUE 'MONITOR';
ALTER TYPE "CategoriaHardware" ADD VALUE 'MOUSE';
ALTER TYPE "CategoriaHardware" ADD VALUE 'TECLADO';
ALTER TYPE "CategoriaHardware" ADD VALUE 'FONE';
ALTER TYPE "CategoriaHardware" ADD VALUE 'MICROFONE';
