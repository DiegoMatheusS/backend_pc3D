# Atualização de cadastro e segurança

## Banco e início de produção

Aplicar `20261021180000_builds_conta_seguranca` antes de atender requisições. A migração cria tabelas de builds pessoais, configuração 2FA, tokens temporários e limites de requisições; não remove dados existentes. `npm run start:prod` executa `prisma migrate deploy` antes da aplicação. Se o serviço usa um comando próprio para iniciar, incluir a mesma migração antes de `node dist/src/main.js`.

Prisma passa a ser dependência de execução para permitir essa etapa sem baixar ferramentas durante o início do serviço. Não executar migrações de teste em um banco de produção.

## Configuração

- `AUTH_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64, mantida somente no ambiente do servidor. Protege os segredos TOTP por AES-256-GCM. Configurar antes de ativar o primeiro 2FA; preservar a chave em backups e não substituí-la sem planejar a rotação.
- `AUTH_PUBLIC_URL`: origem HTTPS do frontend, por exemplo `https://criabyte.com.br`.
- `SMTP_HOST`, `SMTP_PORT` (587 por padrão), `SMTP_FROM`, `SMTP_USER` e `SMTP_PASSWORD`: credenciais do serviço de e-mail. `SMTP_SECURE=true` usa TLS direto, normalmente na porta 465; caso contrário, exige STARTTLS.
- `PRODUTO_IA_URL` e `PRODUTO_IA_API_KEY`: mantêm a integração existente com o agente. Chaves de dispositivos são criadas no painel e não substituem a chave interna do servidor.

Sem SMTP configurado, a recuperação informa indisponibilidade. Sem a chave de criptografia, o restante do login continua funcionando e a configuração de 2FA fica indisponível. Nenhuma credencial deve ser incluída no repositório ou no frontend.

## Comportamento

`POST /api/admin/builds` aceita `ofertas` (até 25) e grava anúncio e ofertas na mesma transação. O campo antigo `oferta` continua aceito; não combinar os dois. Vínculos são opcionais para PCs comerciais. A deduplicação de um PC não usa o modelo de sua CPU como identidade comercial.

Builds pessoais exigem sessão e `X-CriaByte-Account` igual ao e-mail da conta autenticada. `PUT` aceita `revisao`; uma alteração antiga recebe 409 e uma repetição do mesmo conteúdo é idempotente. Outra conta não lê ou remove a montagem.

TOTP tem códigos de recuperação de uso único, controle de repetição e desafios temporários com limite de tentativas. Ativar ou desativar 2FA revoga sessões. Recuperação de senha não desativa o segundo fator e revoga as sessões ao redefinir a senha. A resposta de solicitação por e-mail é genérica.

O segundo fator permite até cinco tentativas por desafio e dez por conta em quinze minutos. Gerar outro desafio não reinicia esse orçamento. Tokens antigos de configuração e login são invalidados nas mudanças de segurança. Uma configuração concorrente não substitui o segundo fator já ativo.

O limite global e o bloqueio por conta usam PostgreSQL; reiniciar a aplicação não limpa os contadores. A limpeza periódica remove registros expirados.

## Verificação

`npm test -- --runInBand` executa testes unitários. A suíte `test/platform-upgrade.e2e-spec.ts` usa um banco isolado, verifica cadastro comercial com oferta e sem vínculos, separação de contas, revisão, segredo TOTP criptografado, recuperação de uso único e persistência dos bloqueios. O workflow usa PostgreSQL 17. SMTP e integrações externas não recebem mensagens/chamadas reais durante esses testes.
