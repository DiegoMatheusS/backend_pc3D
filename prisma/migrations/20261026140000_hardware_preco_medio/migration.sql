ALTER TABLE "hardwares" ADD COLUMN "media_preco_hardware" DECIMAL(12,2);
ALTER TABLE "hardwares" ADD CONSTRAINT "hardwares_media_preco_hardware_check" CHECK ("media_preco_hardware" IS NULL OR "media_preco_hardware" BETWEEN 0.01 AND 100000000);
