import { Controller, Post, Body, Get, Param, Query, Req, UseGuards, Inject } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { Public } from '../../common/decorators/public.decorator';

interface ApiKeyInfo {
    id: string;
    name: string;
    scopes: string[];
}

@Controller('auth')
export class AuthController {
    constructor(@Inject(AuthService) private readonly authService: AuthService) { }

    /**
     * Register a new user with email/password.
     * Public endpoint - no authentication required.
     */
    @Post('register')
    @Public()
    async register(
        @Body('email') email: string,
        @Body('password') password: string,
        @Body('type') type?: 'BUYER' | 'SELLER' | 'BOTH',
    ) {
        const user = await this.authService.registerUser(email, password, type);
        return { data: user };
    }

    /**
     * Login with email/password.
     * Public endpoint - no authentication required.
     */
    @Post('login')
    @Public()
    async login(
        @Body('email') email: string,
        @Body('password') password: string,
    ) {
        const result = await this.authService.loginUser(email, password);
        return { data: result };
    }

    /**
     * Creates a new API key.
     * Requires 'support' scope.
     */
    @Post('api-keys')
    @UseGuards(ApiKeyGuard, ScopeGuard)
    @Scopes('support')
    async createApiKey(
        @Body('name') name: string,
        @Body('scopes') scopes: string[],
    ) {
        return this.authService.createApiKey(name, scopes);
    }

    /**
     * Lists all API keys (masked - values never returned).
     * Requires 'support' scope.
     */
    @Get('api-keys')
    @UseGuards(ApiKeyGuard, ScopeGuard)
    @Scopes('support')
    async listApiKeys(
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        return this.authService.listApiKeys({
            limit: limit ? parseInt(limit, 10) : undefined,
            cursor,
        });
    }

    /**
     * Generates a short-lived token from an API key.
     * Requires 'write' scope.
     */
    @Post('api-keys/:id/token')
    @UseGuards(ApiKeyGuard, ScopeGuard)
    @Scopes('write')
    async generateToken(@Param('id') id: string) {
        const token = await this.authService.generateShortLivedToken(id);
        return { token };
    }

    /**
     * Returns the current authenticated context.
     * Any valid API key can access this endpoint.
     */
    @Get('me')
    @UseGuards(ApiKeyGuard)
    async getMe(@Req() req: Request) {
        const apiKey = (req as unknown as { apiKey?: ApiKeyInfo }).apiKey;

        if (!apiKey) {
            return { data: null };
        }

        return {
            data: {
                apiKeyId: apiKey.id,
                apiKeyName: apiKey.name,
                scopes: apiKey.scopes,
            },
        };
    }
}
