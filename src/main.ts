import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FiltroHttpExcecoes } from './common/filters/http-excecoes.filter';
import cookieParser from 'cookie-parser';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import {
  criarProtecaoCacheSensivel,
  criarProtecaoOrigemNavegador,
  limitarComplexidadeJson,
  normalizarOrigensPermitidas,
  tratarErrosParserCorpo,
} from './common/security/request-security';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>('PORT') ?? 3000);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const sessionCookieName =
    configService.get<string>('SESSION_COOKIE_NAME') ?? 'pcbuilder_session';
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (chave: string, valor: unknown) => void;
  };

  // Parser simples evita objetos arbitrariamente aninhados via query string.
  // Parâmetros repetidos viram arrays e são recusados pelos DTOs escalares.
  expressApp.set('query parser', 'simple');

  // Em produção atrás de proxy/reverse proxy (Cloudflare, Nginx etc.),
  // habilite TRUST_PROXY=true para req.ip e rate limiting usarem o IP correto.
  if (configService.get<string>('TRUST_PROXY') === 'true') {
    expressApp.set('trust proxy', 1);
  }

  // ── Segurança: headers HTTP seguros ──────────────────────────────────────
  app.use(
    helmet({
      // Permite o Swagger UI carregar em dev; em produção recomenda-se CSP mais restrito
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────
  const corsConfigurado = configService.get<string>('CORS_ORIGINS');
  if (nodeEnv === 'production' && !corsConfigurado?.trim()) {
    throw new Error(
      'CORS_ORIGINS precisa ser configurado explicitamente em produção.',
    );
  }

  const allowedOrigins = normalizarOrigensPermitidas(
    (corsConfigurado ?? 'http://localhost:5173')
      .split(',')
      .map((origem) => origem.trim())
      .filter(Boolean),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'Cache-Control',
    ],
    optionsSuccessStatus: 204,
    preflightContinue: false,
    maxAge: 600,
  });

  // Responde preflight antes de guards, parsers e rotas administrativas.
  // Alguns proxies/CDNs tratam OPTIONS de forma diferente de GET/POST; manter
  // uma resposta explícita e curta evita o preflight cair na pilha da aplicação.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method.toUpperCase() !== 'OPTIONS') {
      next();
      return;
    }

    const origin = req.get('origin');
    if (!origin || !allowedOrigins.includes(origin)) {
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PATCH,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.get('access-control-request-headers') ||
        'Content-Type, Accept, Authorization, X-Requested-With, X-CSRF-Token, Cache-Control',
    );
    res.setHeader('Access-Control-Max-Age', '600');
    res.vary('Origin');
    res.status(204).end();
  });

  // Defesa adicional de navegador contra CSRF/origens cruzadas. Fica antes
  // do parser de corpo para rejeitar origens indevidas sem processar payloads.
  app.use(criarProtecaoOrigemNavegador(allowedOrigins));

  app.use(cookieParser());
  app.use(criarProtecaoCacheSensivel(sessionCookieName));
  app.setGlobalPrefix('api');

  // ── Corpo da requisição / abuso de payload ───────────────────────────────
  // Desabilitamos o parser automático do Nest para estes limites serem
  // efetivamente os limites aplicados pela aplicação.
  app.use(json({ limit: '1mb', strict: true }));
  app.use(
    urlencoded({
      limit: '100kb',
      extended: false,
      parameterLimit: 100,
    }),
  );
  app.use(tratarErrosParserCorpo());
  app.use(limitarComplexidadeJson());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new FiltroHttpExcecoes());

  // ── Swagger / OpenAPI ────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CriaByte API')
    .setDescription(
      'API do sistema CriaByte PC Builder — hardware, compatibilidade, montagem 3D, ofertas e muito mais.',
    )
    .setVersion('1.0')
    .addCookieAuth(sessionCookieName, {
      type: 'apiKey',
      in: 'cookie',
      name: sessionCookieName,
    })
    .addTag('Auth', 'Autenticação e sessão')
    .addTag('Usuários', 'Gestão de usuários')
    .addTag('Hardwares', 'Catálogo de hardwares (público)')
    .addTag('Hardwares Admin', 'Gestão administrativa de hardwares')
    .addTag('Modelos 3D', 'Modelos 3D dos hardwares')
    .addTag('Montagem 3D', 'Resolução e renderização de montagens 3D')
    .addTag('Montagens', 'Montagens salvas dos usuários')
    .addTag(
      'Compatibilidade',
      'Verificação de compatibilidade entre componentes',
    )
    .addTag('Ofertas', 'Ofertas de lojas parceiras')
    .addTag(
      'Busca de Ofertas',
      'Visão interna das Ofertas do CriaByte que possuem link afiliado',
    )
    .addTag('Loja', 'Catálogo público de produtos')
    .addTag('Loja Admin', 'Gestão administrativa do catálogo da loja')
    .addTag('Notebooks', 'Catálogo público de notebooks')
    .addTag('Notebooks Admin', 'Gestão administrativa de notebooks')
    .addTag('PCs Montados', 'Catálogo público de PCs montados')
    .addTag('PCs Montados Admin', 'Gestão administrativa de PCs montados')
    .addTag('Avaliações', 'Comentários e avaliações de produtos')
    .addTag('Comunidade', 'Builds criadas e compartilhadas pelos usuários')
    .addTag('Auditoria', 'Logs de auditoria administrativa')
    .addTag(
      'IA Pública',
      'Assistente público usando catálogo e regras reais do backend',
    )
    .addTag(
      'IA Admin',
      'Ferramentas administrativas de interpretação e organização com IA',
    )
    .build();

  const swaggerHabilitado =
    nodeEnv !== 'production' ||
    configService.get<string>('SWAGGER_ENABLED') === 'true';

  if (swaggerHabilitado) {
    const documento = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, documento, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  await app.listen(port);

  console.log(`CriaByte API:   http://localhost:${port}/api`);
  if (swaggerHabilitado) {
    console.log(`Swagger UI:      http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
