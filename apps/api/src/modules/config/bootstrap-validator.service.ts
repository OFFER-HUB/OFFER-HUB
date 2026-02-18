import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Validates at startup that PLATFORM_USER_ID is configured correctly.
 *
 * Fails fast with an actionable error message if the platform user
 * or its wallet is missing — instead of failing silently at runtime
 * when createEscrow() is called.
 */
@Injectable()
export class BootstrapValidatorService implements OnModuleInit {
    private readonly logger = new Logger(BootstrapValidatorService.name);

    constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

    async onModuleInit(): Promise<void> {
        if (process.env.NODE_ENV === 'test') return;

        const platformUserId = process.env.PLATFORM_USER_ID;
        if (!platformUserId) return; // TrustlessWorkConfig already throws for missing env

        const user = await this.prisma.user.findUnique({
            where: { id: platformUserId },
        });

        if (!user) {
            throw new Error(
                `[Bootstrap] PLATFORM_USER_ID "${platformUserId}" not found in database. ` +
                `Run: npm run bootstrap`,
            );
        }

        const wallet = await this.prisma.wallet.findFirst({
            where: { userId: platformUserId, isActive: true },
        });

        if (!wallet) {
            throw new Error(
                `[Bootstrap] Platform user "${platformUserId}" has no active Stellar wallet. ` +
                `Run: npm run bootstrap`,
            );
        }

        this.logger.log(`[Bootstrap] Platform user validated: ${platformUserId} (wallet: ${wallet.publicKey})`);
    }
}
