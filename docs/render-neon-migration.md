# Migrar a API CriaByte para Render e Neon

O `render.yaml` publica somente a API NestJS em uma instância **Free**. O PostgreSQL fica no Neon, separado do PostgreSQL temporário do Render. A configuração não cria banco, disco, worker ou serviço pago.

O deploy automático fica desligado durante a migração. O serviço usa o endpoint já existente `/api/health` e executa as migrações existentes pelo `prestart:prod` antes de iniciar a API.

## Preservar os dados atuais

1. Manter backend_pc3D e ProjetoIA desligados enquanto a cópia é produzida.
2. Ligar somente o PostgreSQL do Railway durante a exportação. Confirmar que o volume original continua montado no caminho original.
3. Produzir um dump **atual**, em formato custom do PostgreSQL, e registrar tamanho, SHA-256, versão do servidor e quantidade de registros por tabela. Os dumps de agosto de 2026 existentes neste repositório são históricos e não substituem essa exportação.
4. Validar o arquivo com `pg_restore --list` e, antes de trocar o destino da aplicação, restaurar em um banco separado e comparar as contagens.
5. Salvar também os arquivos persistentes de `/data` do ProjetoIA, inclusive SQLite, seus arquivos WAL/SHM quando presentes e o arquivo criptografado de tokens. Manter as chaves de criptografia originais em armazenamento seguro.
6. Encerrar novamente o PostgreSQL do Railway após concluir a exportação. Não excluir os volumes antes de validar o banco de destino.

Não versionar dumps novos, arquivos de estado, URLs de conexão ou credenciais. Nunca executar `prisma migrate reset`, `db push --accept-data-loss` ou uma restauração com `--clean` no banco de origem.

## Banco de destino

Criar um projeto Neon no plano gratuito, em uma região próxima do serviço Render. Conferir se a versão de PostgreSQL de destino é compatível com a versão do dump de origem; o serviço de origem usa imagem PostgreSQL 18.

Usar a conexão direta do Neon para importar o dump e executar migrações. Usar TLS na conexão. Criar um destino vazio exclusivo para esta migração.

Exemplo de restauração com cliente compatível com a versão do arquivo:

```bash
pg_restore --no-owner --no-acl --exit-on-error --dbname "$NEON_DIRECT_DATABASE_URL" ./criabyte_atual.dump
```

Fornecer a URL por variável de ambiente, sem incluí-la no histórico, no Git ou em logs. Após a importação, conferir tabelas, contagens e `_prisma_migrations` antes de iniciar a API.

## Configuração da API

Importar o Blueprint `render.yaml` no Render e conferir explicitamente `plan: free`. As variáveis `sync: false` são preenchidas no serviço, sem serem armazenadas no repositório.

| Variável | Valor a preservar ou configurar |
| --- | --- |
| `DATABASE_URL` | URL TLS do banco Neon importado; começar pela conexão direta para validar as migrações e a API. |
| `CORS_ORIGINS` | Origens exatas do frontend que estavam autorizadas no Railway. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_IDS` | Clientes Google já usados pelo frontend e pelo backend. |
| `AUTH_ENCRYPTION_KEY` | A chave original, para manter os dados de segurança de conta já criptografados. |
| `AUTH_PUBLIC_URL` | URL pública do frontend usada nos links de conta. |
| `SMTP_*` | Configuração original de envio de e-mail, quando usada. |
| `R2_*` | Configuração original completa para imagens/modelos 3D já existentes. |
| `PRODUTO_IA_URL` / `PRODUTO_IA_API_KEY` | Endereço do serviço de IA e chave interna; configurar após validar a persistência desse serviço no destino. |
| Demais integrações | Copiar os valores existentes que ainda forem necessários, sem gerar novas chaves de criptografia. |

O Render injeta `PORT`; a API já lê essa variável. O nome padrão do cookie em produção é `__Host-criabyte_session`. Preservar a configuração anterior quando houver um nome personalizado compatível.

## Validação e troca

1. Conferir o build e a resposta de `/api/health` na URL de teste do Render.
2. Conferir catálogo, autenticação, permissões, sessão/cookie, CORS e e-mail. Evitar criar pedidos ou alterar cadastros durante a conferência.
3. Validar o serviço de IA separadamente antes de habilitar pesquisa, importação e integrações que dependem dele.
4. Só então apontar o domínio da API e o frontend para o destino validado.

## Limites do plano gratuito

- Render: 512 MB de RAM, suspensão após 15 minutos sem tráfego e 750 horas gratuitas mensais compartilhadas entre os serviços do workspace. Duas aplicações ativas o mês inteiro não cabem nessa cota.
- Neon: respeitar as cotas atuais de armazenamento, processamento e transferência. Confirmar o tamanho real do banco antes de importar.
- ProjetoIA: a fila usa SQLite e o armazenamento de tokens do Mercado Livre usa um arquivo criptografado. O Render Free não oferece disco persistente. Este Blueprint não publica a IA nem altera sua persistência; ela precisa de armazenamento durável no destino antes da migração.

Referências: [Render Free](https://render.com/docs/free), [Blueprints](https://render.com/docs/blueprint-spec), [Neon](https://neon.com/pricing).
