# CriaByte Backend

Backend da plataforma CriaByte, construído com NestJS, TypeScript, Prisma e PostgreSQL.

## Estado atual

O núcleo funcional está fechado antes da etapa final de IA/Gemini:

- autenticação por sessão/cookie HttpOnly;
- usuários e papéis;
- hardwares e especificações técnicas;
- compatibilidade;
- produtos, categorias, parceiros e ofertas;
- histórico de preços;
- notebooks e periféricos;
- builds comerciais;
- builds da comunidade, avaliações e comentários;
- montagens salvas;
- modelos e montagem 3D;
- auditoria;
- tratamento padronizado de erros;
- rate limiting;
- Swagger/OpenAPI;
- banco E2E separado.

A IA já possui estrutura no projeto, mas deve ser considerada **em fase de finalização separada**.

## Diagnóstico e contrato proposto: fichas técnicas de smartphones (30/09/2026)

**Situação: diagnóstico confirmado no código; correção funcional ainda pendente.** Não considerar esta seção uma funcionalidade já implantada.

Caso de referência: Motorola Edge 70 Fusion 5G 256 GB importado do Mercado Livre pela extensão e já publicado na loja CriaByte. A extensão conseguiu importar o anúncio, mas a ficha pública apareceu sem especificações. O conteúdo desse registro particular no PostgreSQL ainda não foi confirmado por consulta autenticada ou GET bem-sucedido da API pública.

### Comportamento atual constatado

- `Produto.metadados` aceita JSON, mas `ProdutosService.buscarPublico` **não o utiliza** na composição de `especificacoes`.
- O campo público `especificacoes` é composto a partir das tabelas de monitor, mouse, teclado, headset, notebook, hardware ou dados básicos de build; **não existe tabela específica para celular**.
- O DTO genérico de produto e o DTO da integração da extensão aceitam `metadados`, mas não aceitam uma especificação de celular dedicada.
- No ProjetoIA, `SCHEMAS['CELULAR']` está definido como `('PRODUTO', None, [...])`; na integração `src/extension/router.py`, `_product_payload_for_backend()` só envia especificações de categorias com `spec_field` definido. Portanto, informações técnicas de celular identificadas durante a coleta podem não alcançar o backend.
- O mesmo fluxo pode encontrar um produto existente e atualizar/adicionar apenas a oferta. Uma reimportação não deve criar outro produto nem apagar dados técnicos previamente confirmados.

### Contrato a implementar e validar em conjunto com ProjetoIA e frontend

1. Normalizar campos técnicos de celulares em um objeto de especificações com chaves estáveis, por exemplo: `processadorNome`, `ramGb`, `armazenamentoGb`, `tamanhoTelaPolegadas`, `resolucao`, `taxaAtualizacaoHz`, `tipoTela`, `cameraPrincipalMp`, `cameraFrontalMp`, `bateriaMah`, `carregamentoWatts`, `cincoG`, `nfc`, `dualSim`, `esim`, `wifi`, `bluetooth`, `sistemaOperacional`, `pesoGramas`, `cor`, `resistenciaAgua`.
2. Persistir somente dados respaldados pelo anúncio/fonte técnica, sem interpretar RAM Boost como RAM física: no exemplo, 8 GB físicos e 16 GB de expansão virtual são informações distintas. Preservar proveniência e a descrição original.
3. Definir o contrato de persistência da categoria `celulares` (JSON validado em `metadados.especificacoes` ou tabela tipada, sem manter dois padrões concorrentes). A rota pública de detalhes deve fornecer `especificacoes` reais em vez de `null` quando houver dados validados.
4. Na reimportação, atualizar dados técnicos faltantes do **produto existente** e manter ofertas, histórico de preços, imagem e slug estáveis sempre que possível. Não sobrescrever campos existentes com `null` ou campos genéricos extraídos com confiança inferior.
5. O frontend deve apresentar rótulos amigáveis e unidades adequadas, exibir `NFC` como `Sim`/`Não` somente quando conhecido e mostrar a capacidade da bateria em `mAh`.
6. Testar o cenário da extensão do Mercado Livre, o cenário de produto preexistente sem ficha, dados ausentes, booleanos desconhecidos, reimportação idempotente e resposta da API pública. Não alterar um cadastro em produção sem conferir a identidade exata e os campos atuais.

**Como conferir após a implementação:** consultar `GET /api/produtos/slug/:slug` para o produto de referência e verificar `tipo`, `categoria.slug`, `metadados` (sem expor informação privada) e `especificacoes`. Depois confirmar a renderização em `/produto/:slug` na loja.

## Bancos

### Desenvolvimento

Banco normal:

```text
pc_builder
```

O `.env` deve apontar para ele.

### Testes E2E

Banco exclusivo:

```text
criabyte_test
```

O `.env.test` deve apontar exclusivamente para ele.

O carregador de testes aborta a execução se a `DATABASE_URL` não contiver `/criabyte_test`.

Nunca execute `prisma migrate reset` no banco de desenvolvimento.

## Configuração

Copie `.env.example` para `.env` e configure os valores locais.

Para os testes, copie `.env.test.example` para `.env.test` e configure a senha do usuário PostgreSQL.

Nunca versione:

- `.env`
- `.env.local`
- `.env.test`
- credenciais

## Instalação

```powershell
npm install
npx prisma generate
```

## Migration no banco normal

Garanta que `DOTENV_CONFIG_PATH` não esteja apontando para testes:

```powershell
Remove-Item Env:DOTENV_CONFIG_PATH -ErrorAction SilentlyContinue
npx prisma migrate dev
npx prisma generate
```

## Migration no banco de testes

Use o comando seguro do projeto:

```powershell
npm run db:test:status
npm run db:test:migrate
```

Ele carrega `.env.test` e se recusa a executar se o banco não for `criabyte_test`.

Para abrir o Prisma Studio no banco E2E:

```powershell
npm run db:test:studio
```

## Desenvolvimento

Após alterações de código, verificar nesta ordem:

```powershell
npm run format
npm run start:dev
```

Health check:

```text
GET http://localhost:3000/api/health
```

Swagger em desenvolvimento:

```text
http://localhost:3000/api/docs
```

## Testes

E2E:

```powershell
npm run test:e2e
```

Verificação completa:

```powershell
npm run verify
```

O `verify` executa:

1. lint;
2. build;
3. testes unitários;
4. testes E2E.

Auditoria das dependências de produção (requer acesso ao registry npm):

```powershell
npm run security:audit
```

## Regras críticas do domínio

### Usuários

Toda conta nova nasce com papel `USUARIO`, inclusive quando criada por ADMIN.
Promoções para `EDITOR`, `REVISOR` ou `ADMIN` acontecem posteriormente por rota administrativa protegida.

### Build da Comunidade

`hardwareId` é opcional.
Uma peça pode existir apenas como snapshot da build e isso também vale para publicação.
A remoção de um Hardware não pode apagar o componente snapshot da comunidade.

### Preços

Preço atual vem de Ofertas.
Hardware não é a fonte de verdade de preço.

### 3D

Arquivos GLB/GLTF ficam fora do PostgreSQL.
O banco armazena URL e metadados.
Modelos podem ter origem própria ou externa.

Ausência de modelo 3D não significa incompatibilidade técnica.

## Produção

Antes do deploy:

- configurar `NODE_ENV=production`;
- configurar `CORS_ORIGINS` explicitamente;
- habilitar `TRUST_PROXY=true` quando estiver atrás de Cloudflare/Nginx;
- usar HTTPS;
- manter cookies `HttpOnly` e `Secure`;
- decidir se Swagger ficará habilitado;
- aplicar migrations com `prisma migrate deploy`;
- manter backups do PostgreSQL;
- executar `npm run security:audit`;
- nunca enviar segredos para Git ou ZIP.

Consulte também:

- `BACKEND_API_CONTRACT.md`
- `CHECKLIST_FINAL_BACKEND.md`
