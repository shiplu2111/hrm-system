import * as dotenv from 'dotenv';
import * as path from 'path';

// Pre-load environment variables from workspace root or current directory
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';
import { createCorsDelegate } from './common/security/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter?.getInstance?.();
  if (expressInstance && typeof expressInstance.set === 'function') {
    // Respect X-Forwarded-For behind Render / Nginx / Cloudflare proxies for accurate rate limiting
    expressInstance.set('trust proxy', 1);
    if (typeof expressInstance.disable === 'function') {
      expressInstance.disable('x-powered-by');
    }
  }

  app.enableCors(createCorsDelegate());
  app.useWebSocketAdapter(new IoAdapter(app));

  // Baseline HTTP security headers and strict 64 KB payload guard on unauthenticated public routes
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const url = typeof req.url === 'string' ? req.url : '';
    if (url.startsWith('/api/v1/public') || url.startsWith('/public')) {
      const contentLength = Number(req.headers?.['content-length'] ?? 0);
      if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
        return res.status(413).json({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Public endpoint payload exceeds the 64 KB limit.',
          },
        });
      }
    }

    if (url.startsWith('/platform/') && !url.startsWith('/api/v1/platform/')) {
      req.url = `/api/v1${url}`;
    }
    return next();
  });
  app.setGlobalPrefix('api/v1', {
    exclude: ['', 'health'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HRM API')
    .setDescription(
      'Multi-tenant HR + Payroll + Attendance API. Use **Authorize** with `Bearer <accessToken>` for protected routes.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the accessToken from POST /api/v1/auth/login',
      },
      'access-token',
    )
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description: 'Set automatically by login; used by POST /api/v1/auth/refresh',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`HRM API listening on http://0.0.0.0:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`WebSocket: ws://localhost:${port}/realtime`);
}

bootstrap();
