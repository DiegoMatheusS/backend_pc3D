# CriaByte — Atualização do backend para Loja expandida

Esta versão consolida a evolução do backend para acompanhar o frontend atual e a expansão da antiga área **Peças** para uma **Loja** mais ampla.

## Regra central de arquitetura

- **Banco** = fatos cadastrados.
- **Backend** = regras, compatibilidade, segurança e validação.
- **IA** = interpretação e explicação.
- **Frontend** = interface.

A IA não é a fonte de verdade para compatibilidade, preço, links ou existência de produtos.

## Produto comercial x Hardware técnico

A camada comercial passa a ser organizada por `Produto`:

```text
Produto
├── Hardware
├── Notebook
├── Build / PC Montado
└── Produto genérico da Loja
```

`Hardware` continua existindo e concentra as regras técnicas do montador: especificações, compatibilidade, QVL, modelos 3D, pontos de encaixe e ajustes.

### Categorias comerciais

`CategoriaProduto` é uma tabela dinâmica. O admin pode criar novas categorias sem aumentar indefinidamente o enum técnico de Hardware.

Grupos iniciais:

- COMPUTADORES
- COMPONENTES
- PERIFERICOS
- SETUP
- ACESSORIOS

A migration inclui categorias iniciais para PCs montados, notebooks, componentes, monitores, mouses, teclados, headsets, fones, microfones, webcams, controles, mousepads, cadeiras, mesas, suportes, iluminação e acessórios.

## 3D

O montador 3D continua restrito a componentes que participam fisicamente do PC:

- PROCESSADOR
- PLACA_MAE
- MEMORIA_RAM
- PLACA_VIDEO
- ARMAZENAMENTO
- FONTE
- GABINETE
- COOLER
- VENTOINHA

Produtos externos ao gabinete não precisam de modelo 3D. O backend rejeita novos modelos/pontos do montador em categorias externas.

## Instâncias físicas

A montagem continua distinguindo produto e peça física:

```text
hardwareId 5 = modelo de RAM
ram-1 = módulo físico 1
ram-2 = módulo físico 2
```

Foram preservadas as regras por `instanciaId`/`instanciaPaiId`, incluindo RAM, armazenamentos e ventoinhas repetidas, ocupação por ponto físico, hierarquia e ciclos.

A montagem completa também retorna `resumoFisico` com quantidade de RAM, capacidade física calculada, armazenamentos e ventoinhas.

## Ficha pública de Hardware

`GET /api/hardwares/:id` continua disponível e agora agrega:

- especificação técnica;
- aliases compatíveis com a ficha/comparador novo;
- ofertas válidas;
- média/quantidade de avaliações;
- MPN/GTIN da camada Produto;
- informação de modelo 3D aprovado.

Os aliases mantêm os nomes históricos e acrescentam nomes utilizados pelo frontend, como `clockBaseMhz`, `clockTurboMhz`, `vramGb`, `tgpWatts`, `capacidadeTotalGb` etc.

## Loja pública

Principais rotas:

```text
GET /api/produtos
GET /api/produtos/:id
GET /api/produtos/slug/:slug
GET /api/categorias-produto
```

Filtros de Produto incluem categoria, grupo, marca, busca, preço, parceiro, oferta e paginação. Também existem filtros estruturados para as primeiras categorias da expansão: tela/Hz/resolução/painel de Monitor, DPI/polling/peso de Mouse, switch/layout de Teclado e wireless/bateria de Headset.

## Produtos genéricos

O admin pode cadastrar produtos comerciais que não pertencem ao montador.

Primeiras especificações estruturadas:

- Monitor
- Mouse
- Teclado
- Headset

Categorias futuras podem usar `metadados` inicialmente e ganhar uma tabela de especificação própria quando a categoria justificar isso.

## Notebooks

Foi criada estrutura própria:

```text
Produto
└── Notebook
    └── EspecificacaoNotebook
```

A especificação cobre CPU, GPU, RAM, RAM soldada, slots, armazenamento, M.2, tela, bateria, peso, dimensões, conectividade, sistema operacional, webcam e teclado.

Rotas públicas:

```text
GET /api/notebooks
GET /api/notebooks/:id
```

CRUD administrativo em `/api/admin/notebooks`.

## PCs montados comerciais

`Build` é separado de `Montagem` do usuário.

```text
Produto
└── Build
    └── BuildComponente
        └── Hardware
```

`BuildComponente.quantidade` permite 2 RAMs, 2 SSDs, várias ventoinhas etc. Ao publicar, o backend exige o conjunto essencial (CPU, placa-mãe, RAM, armazenamento, fonte e gabinete), restringe peças unitárias e exige GPU quando o processador não possui vídeo integrado.

Rotas:

```text
GET /api/builds
GET /api/builds/:id
GET /api/builds/:id/3d
```

CRUD administrativo em `/api/admin/builds`.

## Ofertas / afiliados

A oferta pertence ao `Produto` e, quando aplicável, também mantém referência ao Hardware técnico.

Suporta:

- parceiro;
- vendedor opcional de marketplace;
- identificador do vendedor;
- preço atual/anterior;
- frete;
- URL original;
- URL afiliada;
- validade;
- verificação;
- status;
- histórico de preços.

Isso permite várias ofertas da Shopee/Mercado Livre para o mesmo Produto quando forem anúncios diferentes.

Rotas públicas importantes:

```text
GET /api/ofertas/parceiros
GET /api/ofertas/produto/:produtoId
GET /api/ofertas/hardware/:hardwareId
GET /api/ofertas/:id/historico
```

## Avaliações e comentários

As avaliações pertencem diretamente ao `Produto`. Dessa forma o mesmo sistema funciona para Hardware, Notebook, Build, Mouse, Monitor etc.

Regras:

- visitante lê;
- usuário autenticado avalia;
- uma avaliação por usuário/produto;
- novo POST atualiza a avaliação já existente;
- somente o dono edita/remove a própria avaliação;
- ADMIN/REVISOR podem moderar;
- nota 1 a 5;
- comentário de texto puro, 3 a 3000 caracteres;
- paginação, média e distribuição por estrelas.

Rotas genéricas e aliases para Hardware/Notebook/Build estão disponíveis.

## Importação administrativa

`POST /api/admin/produtos/importar` faz a coleta no backend, nunca no navegador/IA.

Proteções incluídas:

- somente HTTP/HTTPS;
- bloqueio de localhost/redes privadas;
- resolução DNS;
- redirecionamento controlado;
- limite de tamanho de resposta;
- timeout;
- somente HTML;
- extração de JSON-LD/Open Graph;
- detecção de MPN, GTIN e marca/modelo;
- registro para revisão administrativa.

A IA administrativa pode organizar os dados extraídos, mas o admin continua responsável pela revisão antes de salvar/publicar.

## IA pública e administrativa

A IA pública usa somente catálogo real e ofertas válidas. Para montagem de PC, o backend valida os IDs e executa as regras técnicas antes da resposta final.

A IA nunca deve inventar URL afiliada ou preço.

Rotas principais:

```text
POST /api/ia/chat
POST /api/ia/montar-pc
POST /api/ia/loja/recomendar

POST /api/admin/ia/chat
POST /api/admin/ia/analisar-produto
POST /api/admin/ia/normalizar-produto
POST /api/admin/ia/gerar-descricao
```

## Segurança e administração

Incluído/preservado:

- sessão HttpOnly;
- AuthGuard;
- PapelGuard;
- ADMIN / EDITOR / REVISOR / USUARIO;
- Helmet;
- CORS configurável;
- rate limiting global e específico;
- ValidationPipe;
- filtro global de erros;
- auditoria;
- Swagger/OpenAPI;
- Swagger desabilitado por padrão em produção.

## O que permanece propositalmente para uma etapa com infraestrutura externa

Alguns itens não devem ser inventados dentro do código sem escolher o serviço real:

- upload real de imagens/GLB para S3/R2/CDN;
- sincronização automática de preço via API oficial de cada parceiro;
- scraping periódico de marketplaces;
- compra verificada;
- denúncias/votos de utilidade em comentários;
- visualização 3D específica de notebooks/periféricos;
- tabelas dedicadas para todas as categorias futuras de setup.

A arquitetura já deixa espaço para essas evoluções.
