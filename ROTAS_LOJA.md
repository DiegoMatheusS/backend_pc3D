# Rotas principais — Loja expandida

Todas recebem o prefixo global `/api`.

## Público

### Loja
- `GET /produtos` — filtros gerais e por categoria (`categoria`, `grupo`, `marca`, `busca`, `precoMin`, `precoMax`, `parceiro`, `comOferta`, `telaMin`, `hzMin`, `resolucao`, `painel`, `dpiMin`, `pollingRateMin`, `pesoMax`, `switch`, `layout`, `wireless`, `bateriaMin`)
- `GET /produtos/:id`
- `GET /produtos/slug/:slug`
- `GET /categorias-produto`

### Hardware técnico
- `GET /hardwares`
- `GET /hardwares/:id`
- rotas existentes de compatibilidade e montagem 3D permanecem disponíveis.

### Notebooks
- `GET /notebooks`
- `GET /notebooks/:id`

### PCs montados comerciais
- `GET /builds`
- `GET /builds/:id`
- `GET /builds/:id/3d`

### Ofertas
- `GET /ofertas/parceiros`
- `GET /ofertas/produto/:produtoId`
- `GET /ofertas/hardware/:hardwareId`
- `GET /ofertas/:id/historico`

### Avaliações
- `GET /produtos/:produtoId/avaliacoes`
- `POST /produtos/:produtoId/avaliacoes` — autenticado
- `PATCH /avaliacoes/:id` — dono
- `DELETE /avaliacoes/:id` — dono

Aliases também existem para Hardware, Notebook e Build.

### IA
- `POST /ia/chat`
- `POST /ia/montar-pc`
- `POST /ia/loja/recomendar`

## Administrativo

### Produtos
- `GET /admin/produtos`
- `GET /admin/produtos/:id`
- `POST /admin/produtos`
- `PATCH /admin/produtos/:id`
- `DELETE /admin/produtos/:id`
- `POST /admin/produtos/importar`
- `GET /admin/produtos/importacoes`
- `PATCH /admin/produtos/importacoes/:id/revisar`

### Categorias
- `GET /admin/categorias-produto`
- `POST /admin/categorias-produto`
- `PATCH /admin/categorias-produto/:id`

### Notebooks
- `GET /admin/notebooks`
- `GET /admin/notebooks/:id`
- `POST /admin/notebooks`
- `PATCH /admin/notebooks/:id`
- `DELETE /admin/notebooks/:id`

### PCs montados
- `GET /admin/builds`
- `GET /admin/builds/:id`
- `POST /admin/builds`
- `PATCH /admin/builds/:id`
- `DELETE /admin/builds/:id`

### Ofertas / Parceiros
- `GET /admin/ofertas`
- `GET /admin/ofertas/:id`
- `GET /admin/ofertas/:id/historico`
- `POST /admin/ofertas`
- `PATCH /admin/ofertas/:id`
- `DELETE /admin/ofertas/:id`
- `GET /admin/ofertas/parceiros`
- `GET /admin/ofertas/parceiros/:id`
- `POST /admin/ofertas/parceiros`
- `PATCH /admin/ofertas/parceiros/:id`

### Moderação
- `PATCH /avaliacoes/:id/moderar`

### IA Admin
- `POST /admin/ia/chat`
- `POST /admin/ia/analisar-produto`
- `POST /admin/ia/normalizar-produto`
- `POST /admin/ia/gerar-descricao`

### Auditoria
- rotas existentes do módulo de auditoria permanecem disponíveis para ADMIN.
