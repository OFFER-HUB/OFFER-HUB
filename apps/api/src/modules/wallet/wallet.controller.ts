import { Controller, Get, Post, Inject, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { TrustlessWorkConfig } from '../../providers/trustless-work/trustless-work.config';

@Controller('users/:userId/wallet')
@UseGuards(ApiKeyGuard, ScopeGuard)
export class WalletController {
  constructor(
    @Inject(WalletService) private readonly walletService: WalletService,
    @Inject(TrustlessWorkConfig) private readonly stellarConfig: TrustlessWorkConfig,
  ) {}

  /**
   * GET /users/:userId/wallet
   * Returns wallet info: public key, type, balance
   */
  @Get()
  @Scopes('read')
  async getWallet(@Param('userId') userId: string) {
    const wallet = await this.walletService.getPrimaryWallet(userId);
    const balance = await this.walletService.getBalance(userId);

    return {
      data: {
        publicKey: wallet.publicKey,
        type: wallet.type,
        provider: wallet.provider,
        isActive: wallet.isActive,
        isPrimary: wallet.isPrimary,
        balance: {
          usdc: balance.usdc,
          xlm: balance.xlm,
        },
        createdAt: wallet.createdAt.toISOString(),
      },
    };
  }

  /**
   * GET /users/:userId/wallet/deposit
   * Returns deposit instructions (Stellar address + asset info)
   */
  @Get('deposit')
  @Scopes('read')
  async getDepositInfo(@Param('userId') userId: string) {
    const publicKey = await this.walletService.getPublicKey(userId);

    return {
      data: {
        provider: 'crypto',
        method: 'stellar_address',
        address: publicKey,
        asset: {
          code: this.stellarConfig.stellarUsdcAssetCode,
          issuer: this.stellarConfig.stellarUsdcIssuer,
        },
        network: this.stellarConfig.stellarNetwork,
        instructions:
          'Send USDC to this Stellar address. Deposits are detected automatically within seconds.',
      },
    };
  }

  /**
   * GET /users/:userId/wallet/transactions
   * Returns transaction history from Stellar Horizon
   */
  @Get('transactions')
  @Scopes('read')
  async getTransactions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const txLimit = Math.min(parseInt(limit ?? '20', 10), 100);
    const transactions = await this.walletService.getTransactions(userId, txLimit);

    return {
      data: transactions,
    };
  }

  /**
   * POST /users/:userId/wallet/swap-xlm-usdc
   * Swap XLM for USDC using Stellar DEX (testnet only)
   */
  @Post('swap-xlm-usdc')
  @Scopes('write')
  @HttpCode(HttpStatus.OK)
  async swapXlmForUsdc(
    @Param('userId') userId: string,
    @Body() body: { amount?: string },
  ) {
    const targetAmount = body.amount || '1000.00';
    const result = await this.walletService.swapXlmForUsdc(userId, targetAmount);

    return {
      data: result,
    };
  }
}
