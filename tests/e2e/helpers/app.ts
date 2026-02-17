import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../apps/api/src/app.module';
import { GlobalExceptionFilter } from '../../../apps/api/src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../../apps/api/src/common/interceptors/response.interceptor';
import { RateLimitGuard } from '../../../apps/api/src/common/guards/rate-limit.guard';
import * as request from 'supertest';

let app: INestApplication;
let testingModule: TestingModule;

/**
 * Create and start the NestJS application for E2E tests.
 * Reuses the same instance across all tests in a suite.
 */
export async function createApp(): Promise<INestApplication> {
    if (app) return app;

    testingModule = await Test.createTestingModule({
        imports: [AppModule],
    })
        .overrideGuard(RateLimitGuard)
        .useValue({
            canActivate: (context: any) => {
                const response = context.switchToHttp().getResponse();
                response.setHeader('X-RateLimit-Limit', '10000');
                response.setHeader('X-RateLimit-Remaining', '9999');
                response.setHeader(
                    'X-RateLimit-Reset',
                    Math.floor(Date.now() / 1000 + 60).toString(),
                );
                return true;
            },
        })
        .compile();

    app = testingModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
    return app;
}

/**
 * Get the running app instance.
 */
export function getApp(): INestApplication {
    if (!app) throw new Error('App not initialized. Call createApp() first.');
    return app;
}

/**
 * Close the app and clean up.
 * With maxWorkers: 1, the app is shared across all test suites.
 * Actual cleanup is handled by Jest's --forceExit and Docker teardown.
 * Calling this is a no-op to prevent "Connection is closed" errors
 * between sequential test suites.
 */
export async function closeApp(): Promise<void> {
    // No-op: keep the app alive across test suites to avoid
    // connection closed errors when Redis/Prisma reconnect fails.
    // Jest --forceExit + Docker teardown handles final cleanup.
}

/**
 * Get a supertest agent for the running app.
 */
export function api(): request.SuperTest<request.Test> {
    return request.default(getApp().getHttpServer());
}

/**
 * Get the master key for authenticated requests.
 */
export function masterKey(): string {
    return process.env.OFFERHUB_MASTER_KEY || 'e2e_master_key_for_testing_only';
}
