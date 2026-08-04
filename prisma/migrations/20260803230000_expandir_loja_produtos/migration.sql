-- Expansão incremental do catálogo CriaByte/PC Builder.
-- Mantém os hardwares e IDs atuais e adiciona uma camada comercial genérica de Produto.

-- CreateEnum
CREATE TYPE "GrupoCategoriaProduto" AS ENUM ('COMPUTADORES', 'COMPONENTES', 'PERIFERICOS', 'SETUP', 'ACESSORIOS');
CREATE TYPE "TipoProduto" AS ENUM ('HARDWARE', 'NOTEBOOK', 'BUILD', 'GENERICO');
CREATE TYPE "StatusAvaliacao" AS ENUM ('PUBLICADA', 'OCULTA', 'EM_ANALISE', 'REMOVIDA');
CREATE TYPE "OrigemDadoProduto" AS ENUM ('FABRICANTE', 'API_PARCEIRO', 'LOJA', 'IA_INTERPRETADA', 'MANUAL');

-- ExtendEnum: auditoria da Loja
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'PRODUTO_CRIADO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'PRODUTO_ATUALIZADO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'PRODUTO_PUBLICADO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'PRODUTO_REMOVIDO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'CATEGORIA_PRODUTO_CRIADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'CATEGORIA_PRODUTO_ATUALIZADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'NOTEBOOK_CRIADO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'NOTEBOOK_ATUALIZADO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'NOTEBOOK_REMOVIDO';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'BUILD_CRIADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'BUILD_ATUALIZADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'BUILD_REMOVIDA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'AVALIACAO_MODERADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'IMPORTACAO_PRODUTO_CRIADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'IMPORTACAO_PRODUTO_REVISADA';
ALTER TYPE "AcaoAuditoria" ADD VALUE IF NOT EXISTS 'IA_ADMIN_UTILIZADA';

-- Especificações técnicas avançadas já preparadas no frontend
ALTER TABLE "especificacoes_processadores"
  ADD COLUMN "litografia_nm" DOUBLE PRECISION,
  ADD COLUMN "cache_l2_mb" DOUBLE PRECISION,
  ADD COLUMN "cache_l3_mb" DOUBLE PRECISION,
  ADD COLUMN "temperatura_maxima_c" DOUBLE PRECISION,
  ADD COLUMN "versao_pcie" VARCHAR(20),
  ADD COLUMN "lanes_pcie" INTEGER,
  ADD COLUMN "cooler_incluso" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "multiplicador_desbloqueado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "suporte_overclock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "data_lancamento" DATE;

ALTER TABLE "especificacoes_placas_mae"
  ADD COLUMN "versao_pcie" VARCHAR(20),
  ADD COLUMN "wifi" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bluetooth" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ethernet" VARCHAR(100),
  ADD COLUMN "bios_flashback" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bios_minima" VARCHAR(50);

ALTER TABLE "especificacoes_memorias_ram"
  ADD COLUMN "rgb" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consumo_watts" DOUBLE PRECISION;

ALTER TABLE "especificacoes_placas_video"
  ADD COLUMN "gpu" VARCHAR(150),
  ADD COLUMN "arquitetura" VARCHAR(100),
  ADD COLUMN "barramento_bits" INTEGER,
  ADD COLUMN "clock_base_mhz" INTEGER,
  ADD COLUMN "clock_boost_mhz" INTEGER,
  ADD COLUMN "hdmi" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "display_port" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "especificacoes_coolers"
  ADD COLUMN "consumo_watts" DOUBLE PRECISION;

-- Metadado opcional do arquivo 3D para a ficha/admin.
ALTER TABLE "modelos_3d_hardwares"
  ADD COLUMN "tamanho_bytes" INTEGER;

-- Identidade física das ventoinhas em montagens salvas
ALTER TABLE "ventoinhas_config_montagem"
  ADD COLUMN "instancia_id" VARCHAR(100);

-- Categorias comerciais dinâmicas
CREATE TABLE "categorias_produtos" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "grupo" "GrupoCategoriaProduto" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categorias_produtos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categorias_produtos_slug_key" ON "categorias_produtos"("slug");
CREATE INDEX "categorias_produtos_grupo_ativo_ordem_idx" ON "categorias_produtos"("grupo", "ativo", "ordem");

INSERT INTO "categorias_produtos" ("nome", "slug", "grupo", "ordem") VALUES
('PCs montados', 'pcs-montados', 'COMPUTADORES', 10),
('Notebooks', 'notebooks', 'COMPUTADORES', 20),
('Processadores', 'processadores', 'COMPONENTES', 10),
('Coolers', 'coolers', 'COMPONENTES', 20),
('Placas-mãe', 'placas-mae', 'COMPONENTES', 30),
('Memórias RAM', 'memorias-ram', 'COMPONENTES', 40),
('Placas de vídeo', 'placas-video', 'COMPONENTES', 50),
('Armazenamento', 'armazenamento', 'COMPONENTES', 60),
('Fontes', 'fontes', 'COMPONENTES', 70),
('Gabinetes', 'gabinetes', 'COMPONENTES', 80),
('Ventoinhas', 'ventoinhas', 'COMPONENTES', 90),
('Monitores', 'monitores', 'PERIFERICOS', 10),
('Mouses', 'mouses', 'PERIFERICOS', 20),
('Teclados', 'teclados', 'PERIFERICOS', 30),
('Headsets', 'headsets', 'PERIFERICOS', 40),
('Fones', 'fones', 'PERIFERICOS', 50),
('Microfones', 'microfones', 'PERIFERICOS', 60),
('Webcams', 'webcams', 'PERIFERICOS', 70),
('Controles', 'controles', 'PERIFERICOS', 80),
('Mousepads', 'mousepads', 'SETUP', 10),
('Cadeiras', 'cadeiras', 'SETUP', 20),
('Mesas', 'mesas', 'SETUP', 30),
('Suportes para monitor', 'suportes-monitor', 'SETUP', 40),
('Braços para monitor', 'bracos-monitor', 'SETUP', 50),
('Iluminação', 'iluminacao', 'SETUP', 60),
('Organizadores de cabos', 'organizadores-cabos', 'ACESSORIOS', 10),
('Acessórios', 'acessorios', 'ACESSORIOS', 20);

ALTER TABLE "categorias_produtos" ALTER COLUMN "atualizado_em" DROP DEFAULT;

-- Entidade comercial genérica
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "tipo" "TipoProduto" NOT NULL DEFAULT 'GENERICO',
    "nome" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "marca" VARCHAR(100),
    "modelo" VARCHAR(150),
    "descricao" TEXT,
    "mpn" VARCHAR(150),
    "gtin" VARCHAR(32),
    "imagem_url" VARCHAR(500),
    "imagem_hover_url" VARCHAR(500),
    "metadados" JSONB,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "produtos_slug_key" ON "produtos"("slug");
CREATE UNIQUE INDEX "produtos_mpn_key" ON "produtos"("mpn");
CREATE UNIQUE INDEX "produtos_gtin_key" ON "produtos"("gtin");
CREATE INDEX "produtos_categoria_id_ativo_publicado_idx" ON "produtos"("categoria_id", "ativo", "publicado");
CREATE INDEX "produtos_marca_idx" ON "produtos"("marca");
CREATE INDEX "produtos_nome_idx" ON "produtos"("nome");
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserva o cadastro técnico: cada Hardware atual ganha um Produto comercial com o mesmo ID.
INSERT INTO "produtos" (
  "id", "categoria_id", "tipo", "nome", "slug", "marca", "modelo", "descricao",
  "imagem_url", "publicado", "ativo", "criado_em", "atualizado_em"
)
SELECT
  h."id",
  c."id",
  'HARDWARE'::"TipoProduto",
  h."nome",
  h."slug",
  h."marca",
  h."modelo",
  h."descricao",
  h."imagem_url",
  h."publicado",
  h."ativo",
  h."criado_em",
  h."atualizado_em"
FROM "hardwares" h
JOIN "categorias_produtos" c ON c."slug" = CASE h."categoria"::text
  WHEN 'PROCESSADOR' THEN 'processadores'
  WHEN 'COOLER' THEN 'coolers'
  WHEN 'PLACA_MAE' THEN 'placas-mae'
  WHEN 'MEMORIA_RAM' THEN 'memorias-ram'
  WHEN 'PLACA_VIDEO' THEN 'placas-video'
  WHEN 'ARMAZENAMENTO' THEN 'armazenamento'
  WHEN 'FONTE' THEN 'fontes'
  WHEN 'GABINETE' THEN 'gabinetes'
  WHEN 'VENTOINHA' THEN 'ventoinhas'
  WHEN 'MONITOR' THEN 'monitores'
  WHEN 'MOUSE' THEN 'mouses'
  WHEN 'TECLADO' THEN 'teclados'
  WHEN 'FONE' THEN 'fones'
  WHEN 'MICROFONE' THEN 'microfones'
END;

SELECT setval(
  pg_get_serial_sequence('produtos', 'id'),
  GREATEST((SELECT COALESCE(MAX("id"), 1) FROM "produtos"), 1),
  true
);

ALTER TABLE "hardwares" ADD COLUMN "produto_id" INTEGER;
UPDATE "hardwares" SET "produto_id" = "id";
CREATE UNIQUE INDEX "hardwares_produto_id_key" ON "hardwares"("produto_id");
ALTER TABLE "hardwares" ADD CONSTRAINT "hardwares_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ofertas passam a pertencer ao Produto e suportam marketplaces/vendedores.
DROP INDEX IF EXISTS "ofertas_hardware_id_parceiro_id_key";
ALTER TABLE "ofertas" ALTER COLUMN "hardware_id" DROP NOT NULL;
ALTER TABLE "ofertas"
  ADD COLUMN "produto_id" INTEGER,
  ADD COLUMN "vendedor_nome" VARCHAR(200),
  ADD COLUMN "vendedor_identificador" VARCHAR(200),
  ADD COLUMN "frete" DECIMAL(10,2),
  ADD COLUMN "valido_ate" TIMESTAMPTZ(3),
  ADD COLUMN "verificado_em" TIMESTAMPTZ(3);
UPDATE "ofertas" o
SET "produto_id" = h."produto_id"
FROM "hardwares" h
WHERE h."id" = o."hardware_id";
ALTER TABLE "ofertas" ALTER COLUMN "produto_id" SET NOT NULL;
CREATE UNIQUE INDEX "ofertas_produto_id_parceiro_id_url_original_key"
  ON "ofertas"("produto_id", "parceiro_id", "url_original");
CREATE INDEX "ofertas_produto_id_status_idx" ON "ofertas"("produto_id", "status");
CREATE INDEX "ofertas_vendedor_identificador_idx" ON "ofertas"("vendedor_identificador");
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Especificações da primeira expansão da Loja
CREATE TABLE "especificacoes_monitores" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "tamanho_polegadas" DOUBLE PRECISION,
    "resolucao" VARCHAR(50),
    "taxa_atualizacao_hz" INTEGER,
    "tipo_painel" VARCHAR(50),
    "tempo_resposta_ms" DOUBLE PRECISION,
    "brilho_nits" INTEGER,
    "hdr" BOOLEAN NOT NULL DEFAULT false,
    "adaptive_sync" BOOLEAN NOT NULL DEFAULT false,
    "g_sync" BOOLEAN NOT NULL DEFAULT false,
    "free_sync" BOOLEAN NOT NULL DEFAULT false,
    "hdmi" INTEGER NOT NULL DEFAULT 0,
    "display_port" INTEGER NOT NULL DEFAULT 0,
    "usb_c" INTEGER NOT NULL DEFAULT 0,
    "vesa" VARCHAR(50),
    CONSTRAINT "especificacoes_monitores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "especificacoes_monitores_produto_id_key" ON "especificacoes_monitores"("produto_id");
ALTER TABLE "especificacoes_monitores" ADD CONSTRAINT "especificacoes_monitores_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "especificacoes_mouses" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "sensor" VARCHAR(100),
    "dpi_maximo" INTEGER,
    "polling_rate_hz" INTEGER,
    "botoes" INTEGER,
    "peso_gramas" DOUBLE PRECISION,
    "conexao" VARCHAR(100),
    "bluetooth" BOOLEAN NOT NULL DEFAULT false,
    "wireless" BOOLEAN NOT NULL DEFAULT false,
    "cabo" BOOLEAN NOT NULL DEFAULT true,
    "rgb" BOOLEAN NOT NULL DEFAULT false,
    "mao" VARCHAR(50),
    CONSTRAINT "especificacoes_mouses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "especificacoes_mouses_produto_id_key" ON "especificacoes_mouses"("produto_id");
ALTER TABLE "especificacoes_mouses" ADD CONSTRAINT "especificacoes_mouses_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "especificacoes_teclados" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "tipo" VARCHAR(80),
    "layout" VARCHAR(80),
    "switch" VARCHAR(100),
    "tamanho" VARCHAR(80),
    "abnt2" BOOLEAN NOT NULL DEFAULT false,
    "conexao" VARCHAR(100),
    "bluetooth" BOOLEAN NOT NULL DEFAULT false,
    "wireless" BOOLEAN NOT NULL DEFAULT false,
    "usb" BOOLEAN NOT NULL DEFAULT true,
    "rgb" BOOLEAN NOT NULL DEFAULT false,
    "hot_swap" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "especificacoes_teclados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "especificacoes_teclados_produto_id_key" ON "especificacoes_teclados"("produto_id");
ALTER TABLE "especificacoes_teclados" ADD CONSTRAINT "especificacoes_teclados_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "especificacoes_headsets" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "tipo_conexao" VARCHAR(100),
    "wireless" BOOLEAN NOT NULL DEFAULT false,
    "bluetooth" BOOLEAN NOT NULL DEFAULT false,
    "driver_mm" DOUBLE PRECISION,
    "microfone" BOOLEAN NOT NULL DEFAULT true,
    "som_surround" BOOLEAN NOT NULL DEFAULT false,
    "impedancia" DOUBLE PRECISION,
    "peso_gramas" DOUBLE PRECISION,
    "bateria_horas" DOUBLE PRECISION,
    CONSTRAINT "especificacoes_headsets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "especificacoes_headsets_produto_id_key" ON "especificacoes_headsets"("produto_id");
ALTER TABLE "especificacoes_headsets" ADD CONSTRAINT "especificacoes_headsets_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notebooks
CREATE TABLE "notebooks" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notebooks_produto_id_key" ON "notebooks"("produto_id");
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "especificacoes_notebooks" (
    "id" SERIAL NOT NULL,
    "notebook_id" INTEGER NOT NULL,
    "processador_nome" VARCHAR(200), "processador_marca" VARCHAR(100), "processador_geracao" VARCHAR(100),
    "nucleos" INTEGER, "threads" INTEGER, "clock_base_mhz" INTEGER, "clock_turbo_mhz" INTEGER, "tdp_watts" INTEGER,
    "gpu_nome" VARCHAR(200), "gpu_integrada" BOOLEAN NOT NULL DEFAULT false, "gpu_dedicada" BOOLEAN NOT NULL DEFAULT false,
    "vram_gb" INTEGER, "tgp_watts" INTEGER,
    "ram_instalada_gb" INTEGER, "tipo_memoria" "TipoMemoria", "frequencia_mhz" INTEGER, "ram_soldada_gb" INTEGER,
    "slots_ram_total" INTEGER, "slots_ram_livres" INTEGER, "ram_maxima_gb" INTEGER, "upgrade_ram" BOOLEAN NOT NULL DEFAULT false,
    "armazenamento_gb" INTEGER, "tipo_armazenamento" VARCHAR(80), "slots_m2_total" INTEGER, "slots_m2_livres" INTEGER,
    "upgrade_armazenamento" BOOLEAN NOT NULL DEFAULT false,
    "tamanho_tela_polegadas" DOUBLE PRECISION, "resolucao_largura" INTEGER, "resolucao_altura" INTEGER,
    "taxa_atualizacao_hz" INTEGER, "tipo_painel" VARCHAR(80), "brilho_nits" INTEGER, "touch" BOOLEAN NOT NULL DEFAULT false,
    "bateria_wh" DOUBLE PRECISION, "autonomia_informada_horas" DOUBLE PRECISION, "potencia_carregador_watts" INTEGER,
    "peso_kg" DOUBLE PRECISION, "largura_mm" DOUBLE PRECISION, "altura_mm" DOUBLE PRECISION, "profundidade_mm" DOUBLE PRECISION,
    "wifi" VARCHAR(100), "bluetooth" VARCHAR(100), "usb_a" INTEGER NOT NULL DEFAULT 0, "usb_c" INTEGER NOT NULL DEFAULT 0,
    "thunderbolt" INTEGER NOT NULL DEFAULT 0, "hdmi" INTEGER NOT NULL DEFAULT 0, "display_port" INTEGER NOT NULL DEFAULT 0,
    "ethernet" BOOLEAN NOT NULL DEFAULT false, "leitor_cartao" BOOLEAN NOT NULL DEFAULT false,
    "sistema_operacional" VARCHAR(150), "webcam" BOOLEAN NOT NULL DEFAULT false, "resolucao_webcam" VARCHAR(80),
    "teclado_iluminado" BOOLEAN NOT NULL DEFAULT false, "teclado_numerico" BOOLEAN NOT NULL DEFAULT false,
    "leitor_digital" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "especificacoes_notebooks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "especificacoes_notebooks_notebook_id_key" ON "especificacoes_notebooks"("notebook_id");
ALTER TABLE "especificacoes_notebooks" ADD CONSTRAINT "especificacoes_notebooks_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PCs montados comerciais, separados das montagens pessoais
CREATE TABLE "builds" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "categoria" VARCHAR(100),
    "finalidade" VARCHAR(150),
    "resolucao_recomendada" VARCHAR(80),
    "consumo_estimado_watts" DOUBLE PRECISION,
    "fonte_recomendada_watts" INTEGER,
    "configuracao_3d" JSONB,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "builds_produto_id_key" ON "builds"("produto_id");
ALTER TABLE "builds" ADD CONSTRAINT "builds_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "build_componentes" (
    "id" SERIAL NOT NULL,
    "build_id" INTEGER NOT NULL,
    "hardware_id" INTEGER NOT NULL,
    "categoria" "CategoriaHardware" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "posicao" VARCHAR(100),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "build_componentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "build_componentes_build_id_ordem_idx" ON "build_componentes"("build_id", "ordem");
CREATE INDEX "build_componentes_hardware_id_idx" ON "build_componentes"("hardware_id");
ALTER TABLE "build_componentes" ADD CONSTRAINT "build_componentes_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "build_componentes" ADD CONSTRAINT "build_componentes_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardwares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Comentários e avaliações genéricos para qualquer Produto
CREATE TABLE "avaliacoes" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "nota" INTEGER NOT NULL,
    "titulo" VARCHAR(200),
    "comentario" VARCHAR(3000) NOT NULL,
    "status" "StatusAvaliacao" NOT NULL DEFAULT 'PUBLICADA',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "avaliacoes_nota_check" CHECK ("nota" >= 1 AND "nota" <= 5)
);
CREATE UNIQUE INDEX "avaliacoes_usuario_id_produto_id_key" ON "avaliacoes"("usuario_id", "produto_id");
CREATE INDEX "avaliacoes_produto_id_status_criado_em_idx" ON "avaliacoes"("produto_id", "status", "criado_em");
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Histórico de importação/revisão de produtos da Loja
CREATE TABLE "importacoes_produtos" (
    "id" SERIAL NOT NULL,
    "produto_id" INTEGER,
    "revisado_por_id" INTEGER,
    "url_origem" VARCHAR(500) NOT NULL,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PENDENTE',
    "origem_principal" "OrigemDadoProduto" NOT NULL DEFAULT 'MANUAL',
    "conteudo_bruto" JSONB,
    "dados_normalizados" JSONB,
    "campos_nao_encontrados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "hash_conteudo" VARCHAR(64),
    "erro" TEXT,
    "coletado_em" TIMESTAMPTZ(3),
    "revisado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "importacoes_produtos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "importacoes_produtos_produto_id_idx" ON "importacoes_produtos"("produto_id");
CREATE INDEX "importacoes_produtos_status_idx" ON "importacoes_produtos"("status");
ALTER TABLE "importacoes_produtos" ADD CONSTRAINT "importacoes_produtos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "importacoes_produtos" ADD CONSTRAINT "importacoes_produtos_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Histórico de preços das ofertas para gráficos/alertas futuros.
CREATE TABLE "historico_precos_ofertas" (
    "id" SERIAL NOT NULL,
    "oferta_id" INTEGER NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "frete" DECIMAL(10,2),
    "verificado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historico_precos_ofertas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "historico_precos_ofertas_oferta_id_verificado_em_idx"
  ON "historico_precos_ofertas"("oferta_id", "verificado_em");
ALTER TABLE "historico_precos_ofertas"
  ADD CONSTRAINT "historico_precos_ofertas_oferta_id_fkey"
  FOREIGN KEY ("oferta_id") REFERENCES "ofertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Registra o preço atual das ofertas já existentes como primeiro ponto histórico.
INSERT INTO "historico_precos_ofertas" ("oferta_id", "preco", "frete", "verificado_em")
SELECT "id", "preco", "frete", COALESCE("verificado_em", "atualizado_em", "criado_em")
FROM "ofertas";
