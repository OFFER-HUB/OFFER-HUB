import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import { resolve } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

// Load .env from monorepo root (works with tsx watch from apps/api/)
config({ path: resolve(process.cwd(), '../../.env') });

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const banner = `
 ██████╗ ███████╗███████╗███████╗██████╗       ██╗  ██╗██╗   ██╗██████╗
██╔═══██╗██╔════╝██╔════╝██╔════╝██╔══██╗      ██║  ██║██║   ██║██╔══██╗
██║   ██║█████╗  █████╗  █████╗  ██████╔╝█████╗███████║██║   ██║██████╔╝
██║   ██║██╔══╝  ██╔══╝  ██╔══╝  ██╔══██╗╚════╝██╔══██║██║   ██║██╔══██╗
╚██████╔╝██║     ██║     ███████╗██║  ██║      ██║  ██║╚██████╔╝██████╔╝
 ╚═════╝ ╚═╝     ╚═╝     ╚══════╝╚═╝  ╚═╝      ╚═╝  ╚═╝ ╚═════╝ ╚═════╝

---------------------- Marketplaces Orchestrator ----------------------
`;
  console.log(banner);

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global response interceptor for standardized success responses
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Enable shutdown hooks for clean closing (database connections, etc.)
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;

  await app.listen(port);
  logger.log(`API listening on port ${port}`);

  // Graceful shutdown: stops HTTP server, drains BullMQ workers, closes Horizon SSE streams
  const gracefulShutdown = async (signal: string) => {
    logger.log(`[Shutdown] Received ${signal} — shutting down gracefully...`);

    // Force-exit after 30s if shutdown hangs
    const forceExit = setTimeout(() => {
      logger.error('[Shutdown] Graceful shutdown timed out (30s) — forcing exit');
      process.exit(1);
    }, 30_000);
    forceExit.unref();

    await app.close();
    clearTimeout(forceExit);

    logger.log('[Shutdown] Clean shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });

  logger.log('[Shutdown] Graceful shutdown handler registered');
}

bootstrap();
