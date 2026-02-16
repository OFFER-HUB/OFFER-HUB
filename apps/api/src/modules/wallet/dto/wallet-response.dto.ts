export interface WalletResponseDto {
  publicKey: string;
  type: 'INVISIBLE' | 'EXTERNAL';
  provider: 'STELLAR';
  isActive: boolean;
  isPrimary: boolean;
  balance: {
    usdc: string;
    xlm: string;
  };
  createdAt: string;
}

export interface DepositInfoDto {
  provider: 'crypto';
  method: 'stellar_address';
  address: string;
  asset: {
    code: string;
    issuer: string;
  };
  network: 'testnet' | 'mainnet';
  instructions: string;
}

export interface TransactionDto {
  id: string;
  type: 'payment' | 'create_account' | 'change_trust';
  from: string;
  to: string;
  amount: string;
  asset: string;
  createdAt: string;
  hash: string;
  successful: boolean;
}
