import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-request-id', 'x-tenant-id'],
  });
  app.useWebSocketAdapter(new IoAdapter(app));
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
