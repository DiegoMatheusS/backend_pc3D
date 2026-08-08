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
- nunca enviar segredos para Git ou ZIP.

Consulte também:

- `BACKEND_API_CONTRACT.md`
- `CHECKLIST_FINAL_BACKEND.md`
