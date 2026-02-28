import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { DatabaseModule } from '../database/database.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
    imports: [
        DatabaseModule,
        forwardRef(() => WalletModule),
        JwtModule.register({
            secret: process.env.OFFERHUB_JWT_SECRET || 'fallback-secret-for-dev',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        ApiKeyGuard,
        ScopeGuard,
        {
            provide: APP_GUARD,
            useFactory: (reflector: Reflector, jwtService: JwtService) => {
                return new JwtAuthGuard(reflector, jwtService);
            },
            inject: [Reflector, JwtService],
        },
    ],
    exports: [AuthService, ApiKeyGuard, ScopeGuard, JwtModule],
})
export class AuthModule { }
