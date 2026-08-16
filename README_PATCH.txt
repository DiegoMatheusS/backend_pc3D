PATCH CRIABYTE — OFERTAS + IA POR BOTÕES + HARDWARE/PRODUTO SEPARADOS
Versão: V3 — 15/08/2026

BASE CONSOLIDADA
- backend_atual(20260811-003841).zip
- inclui as alterações do PATCH_CRIABYTE_IA_MODO_ACOES_ADMIN_V2
- adiciona as alterações desta etapa

============================================================
O QUE MUDA
============================================================

1. Hardware NÃO cria Produto automaticamente
- POST /api/hardwares cria somente Hardware.
- Atualizar Hardware não cria nem sincroniza Produto automaticamente.
- Arquivar Hardware não arquiva Produto.
- Exclusão permanente de Hardware não apaga Produto.

2. Hardware passa a guardar sua própria identificação técnica
- mpn
- gtin
- imagemHoverUrl

A migração é ADITIVA e copia esses dados dos Produtos já vinculados antes da separação.
Não há DROP/TRUNCATE/reset/delete geral.

3. Criação explícita de Produto a partir de Hardware
- GET /api/admin/produtos/hardwares/disponiveis
- POST /api/admin/produtos/de-hardware/:hardwareId

O Produto é criado somente após ação explícita do ADMIN/EDITOR.
O cadastro usa os dados do Hardware como pré-preenchimento sem alterar o Hardware técnico.
O body pode incluir `ofertaInicial` para criar Produto + Oferta afiliada na mesma transação.
O mesmo campo opcional também existe em POST /api/admin/produtos.

4. Busca de Ofertas — visão de links afiliados cadastrados
- GET /api/admin/busca-ofertas
- GET /api/admin/busca-ofertas/status
- POST /api/admin/busca-ofertas/atualizar

Permissões nesta versão:
- ADMIN: permitido
- EDITOR: permitido
- REVISOR: não
- USUARIO: não

Filtros preparados:
- busca
- tag ou categoria
- descontoMinimo
- ordenar

Não existe integração automática com API do Mercado Livre nesta versão.
O endpoint lê as Ofertas já cadastradas no CriaByte e exibe somente as que possuem urlAfiliada, estão ATIVAS e não estão vencidas.
Não é feito scraping do marketplace.
O link afiliado continua pertencendo à entidade Oferta.

5. IA por botões para economizar cota
- GET /api/ia/menu
- GET /api/admin/ia/menu

Fluxos determinísticos usam modo LOCAL / geminiUtilizado=false.
A montagem guiada devolve interfaceSugerida.botoes para selecionar peças, filtrar, ver mais, voltar, pular e deixar o sistema decidir.
Pergunta livre continua disponível e pode usar Gemini.

6. Comunidade — histórico e avaliação
- Avaliação de build é única e imutável por usuário. Uma segunda tentativa retorna conflito (409).
- Ao publicar uma build da Comunidade, `precoNaPublicacao` é salvo somente quando todas as peças possuem Hardware vinculado e oferta pública/ativa confiável.
- Se houver peça externa ou componente sem oferta, `precoNaPublicacao` permanece null em vez de gravar total parcial como se fosse exato.

7. Bloco de notas
BLOCO_NOTAS_CRIABYTE.txt mantém:
- Google OAuth como melhoria futura;
- Busca de Ofertas baseada nas Ofertas com link afiliado já cadastradas;
- fontes técnicas secundárias;
- regra de economia da IA.

============================================================
COMO APLICAR COM SEGURANÇA
============================================================

1. Faça backup do PostgreSQL antes da migração.
2. Copie os arquivos deste patch mantendo as mesmas pastas.
3. Rode:

   npx prisma validate

4. Abra e confira manualmente:

   prisma/migrations/20260815125000_separar_hardware_produto/migration.sql

5. Aplique a migração existente, sem reset:

   npx prisma migrate deploy

6. Regenere o Prisma Client:

   npx prisma generate

7. Formate e valide:

   npm run format
   npm run lint
   npm run build
   npm test
   npm run test:e2e

O comando `npm run test:e2e` executa o Jest com `--runInBand`, evitando que várias suítes e2e abram pools do Prisma em paralelo e estourem o limite de conexões do PostgreSQL.
Quando houver migration nova, aplique-a manualmente no banco de teste com `npm run db:test:migrate` antes da suíte.

Ou, após generate:

   npm run verify

NÃO executar prisma migrate reset.
NÃO apagar banco.
NÃO resetar IDs.

============================================================
FRONTEND
============================================================

Leia:
CONTRATO_FRONTEND_BUSCA_OFERTAS_IA.txt

Ele contém as rotas e formatos que podem ser usados agora no React.

IMPORTANTE:
A Busca de Ofertas mostra automaticamente as Ofertas ativas que possuem link afiliado cadastrado.
Isso é esperado e permite construir o frontend agora sem acoplar a UI à implementação futura do provider.

============================================================
CLOUDFLARE R2 — UPLOAD DE MODELOS 3D GLB
============================================================

Variaveis no .env:
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET=criabyte-modelos-3d
R2_ACCESS_KEY_ID=<ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev

IMPORTANTE:
- R2_ENDPOINT deve ser o endpoint da conta, SEM /criabyte-modelos-3d no final.
- Nunca commitar R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY.

Status da configuracao:
GET /api/admin/hardwares/modelos-3d/storage/status

Upload + cadastro do modelo no Hardware:
POST /api/admin/hardwares/:hardwareId/modelos-3d/upload
Content-Type: multipart/form-data
Campo obrigatorio:
- arquivo: arquivo .glb (maximo 100 MB)
Campos opcionais:
- nome
- storageKey (ex.: modelos/gpu/rtx_4060.glb)
- autor
- licenca
- versao

Se storageKey nao for informado, a API usa as pastas ja adotadas pelo projeto:
PROCESSADOR   -> modelos/cpu
COOLER        -> modelos/cooler
PLACA_MAE     -> modelos/placaMae
MEMORIA_RAM   -> modelos/ram
PLACA_VIDEO   -> modelos/gpu
ARMAZENAMENTO -> modelos/sdd_hd
FONTE         -> modelos/fonte
GABINETE      -> modelos/gabinete
VENTOINHA     -> modelos/fan

A API valida o cabecalho GLB 2.0, envia ao R2 e cria Modelo3DHardware com:
- origem=PROPRIO
- formato=GLB
- storageKey
- arquivoUrl publica
- tamanhoBytes
- aprovado=false

Arquivos existentes no mesmo storageKey nao sao sobrescritos automaticamente.

R2 / modelos 3D (fix AWS SDK v3)
--------------------------------
- O upload de GLB usa @aws-sdk/client-s3 (AWS SDK v3), conforme a API S3 compatível do Cloudflare R2.
- R2_ENDPOINT deve ser o endpoint da conta, sem /<bucket> no final.
- Região usada pelo cliente: auto.
- GET /api/admin/hardwares/modelos-3d/storage/status mostra se as variáveis estão configuradas.
- GET /api/admin/hardwares/modelos-3d/storage/testar valida autenticação/conexão real com o bucket.
- POST /api/admin/hardwares/:hardwareId/modelos-3d/upload envia o GLB.
- Depois de substituir o backend, rode npm install antes de npm run verify para instalar @aws-sdk/client-s3 e atualizar package-lock.json.
