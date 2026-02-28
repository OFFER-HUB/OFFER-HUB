import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { generateApiKey, generateUserId } from '@offerhub/shared';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @Inject(PrismaService) private prisma: PrismaService,
        @Inject(JwtService) private jwtService: JwtService,
        @Inject(forwardRef(() => WalletService)) private walletService: WalletService,
    ) { }

    /**
     * Hash password using SHA-256 with salt (simple for demo)
     */
    private hashPassword(password: string, salt?: string): { hash: string; salt: string } {
        const passwordSalt = salt || randomBytes(16).toString('hex');
        const hash = createHash('sha256')
            .update(password + passwordSalt)
            .digest('hex');
        return { hash, salt: passwordSalt };
    }

    /**
     * Verify password against hash
     */
    private verifyPassword(password: string, storedHash: string): boolean {
        const [hash, salt] = storedHash.split(':');
        const { hash: computedHash } = this.hashPassword(password, salt);
        try {
            return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
        } catch {
            return false;
        }
    }

    /**
     * Register a new user with email/password
     */
    async registerUser(email: string, password: string, type: 'BUYER' | 'SELLER' | 'BOTH' = 'BOTH') {
        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const { hash, salt } = this.hashPassword(password);
        const passwordHash = `${hash}:${salt}`;

        // Create user
        const user = await this.prisma.user.create({
            data: {
                id: generateUserId(),
                externalUserId: `local_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                email,
                passwordHash,
                type,
            },
        });

        // Create balance
        await this.prisma.balance.create({
            data: {
                userId: user.id,
                available: '0.00',
                reserved: '0.00',
            },
        });

        // Create invisible Stellar wallet (async, non-blocking for registration)
        try {
            const walletResult = await this.walletService.createWallet(user.id);
            this.logger.log(
                `Wallet created for user ${user.id}: ${walletResult.publicKey} (funded: ${walletResult.funded}, trustline: ${walletResult.trustlineReady})`,
            );
        } catch (error) {
            // Log error but don't fail registration - wallet can be created later
            this.logger.error(
                `Failed to create wallet for user ${user.id}: ${error instanceof Error ? error.message : error}`,
            );
        }

        return {
            id: user.id,
            email: user.email,
            type: user.type,
        };
    }

    /**
     * Login user with email/password
     */
    async loginUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                balance: true,
                wallets: {
                    where: { isActive: true, isPrimary: true },
                    take: 1,
                },
            },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const isValid = this.verifyPassword(password, user.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Generate JWT token for the user
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
            type: user.type,
        }, {
            expiresIn: '7d',
        });

        const primaryWallet = user.wallets?.[0];

        return {
            user: {
                id: user.id,
                email: user.email,
                type: user.type,
                balance: user.balance ? {
                    available: user.balance.available,
                    reserved: user.balance.reserved,
                } : null,
                wallet: primaryWallet ? {
                    publicKey: primaryWallet.publicKey,
                    type: primaryWallet.type,
                } : null,
            },
            token,
        };
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: { balance: true },
        });
    }

    /**
     * Creates a new API Key.
     * The full key is returned only once.
     */
    async createApiKey(name: string, scopes: string[], marketplaceId?: string) {
        const { key, hashedKey, salt, id } = generateApiKey();

        const apiKey = await this.prisma.apiKey.create({
            data: {
                id,
                name,
                hashedKey,
                salt,
                scopes,
                marketplaceId,
            },
        });

        return {
            id: apiKey.id,
            key, // Plain text key to be shown once
            name: apiKey.name,
            scopes: apiKey.scopes,
        };
    }

    /**
     * Generates a short-lived token (ohk_tok_...) from a valid API Key ID.
     * Designed for frontend-to-orchestrator communication.
     */
    async generateShortLivedToken(apiKeyId: string) {
        const apiKey = await this.prisma.apiKey.findUnique({
            where: { id: apiKeyId },
        });

        if (!apiKey) {
            throw new UnauthorizedException('Invalid API Key ID');
        }

        const payload = {
            sub: apiKey.id,
            scopes: apiKey.scopes,
            type: 'short-lived',
        };

        const token = await this.jwtService.signAsync(payload, {
            expiresIn: '1h', // Short-lived
        });

        return `ohk_tok_${token}`;
    }

    /**
     * Validates a short-lived token.
     */
    async validateShortLivedToken(token: string) {
        try {
            const jwtPart = token.replace('ohk_tok_', '');
            const payload = await this.jwtService.verifyAsync(jwtPart);
            return payload;
        } catch {
            throw new UnauthorizedException('Invalid or expired short-lived token');
        }
    }

    /**
     * Lists API keys with pagination.
     * API key values are never returned (only shown once at creation).
     */
    async listApiKeys(options: { limit?: number; cursor?: string } = {}) {
        const limit = Math.min(options.limit || 20, 100);

        const apiKeys = await this.prisma.apiKey.findMany({
            take: limit + 1,
            ...(options.cursor && {
                skip: 1,
                cursor: { id: options.cursor },
            }),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                scopes: true,
                lastUsedAt: true,
                createdAt: true,
            },
        });

        const hasMore = apiKeys.length > limit;
        const data = apiKeys.slice(0, limit);

        return {
            data: data.map((key) => ({
                id: key.id,
                name: key.name,
                scopes: key.scopes,
                lastUsedAt: key.lastUsedAt?.toISOString() || null,
                createdAt: key.createdAt.toISOString(),
            })),
            pagination: {
                hasMore,
                nextCursor: hasMore ? data[data.length - 1].id : null,
            },
        };
    }

    /**
     * Gets API key by ID (for /me endpoint context).
     */
    async getApiKeyById(id: string) {
        return this.prisma.apiKey.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                scopes: true,
            },
        });
    }
}
