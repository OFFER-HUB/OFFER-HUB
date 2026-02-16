import { Logger } from '@nestjs/common';
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk';

const logger = new Logger('TestnetUtils');

/**
 * Fund a Stellar testnet account using Friendbot.
 * Only works on testnet — throws on mainnet.
 */
export async function fundTestAccount(publicKey: string): Promise<void> {
  const url = `https://friendbot.stellar.org?addr=${publicKey}`;
  logger.log(`Funding testnet account via Friendbot: ${publicKey}`);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Friendbot funding failed (${response.status}): ${body}`);
  }

  logger.log(`Testnet account funded: ${publicKey}`);
}

/**
 * Set up a USDC trustline on a Stellar testnet account.
 */
export async function setupTestTrustline(
  keypair: Keypair,
  horizonUrl: string,
  usdcCode: string,
  usdcIssuer: string,
): Promise<string> {
  const server = new Horizon.Server(horizonUrl);
  const account = await server.loadAccount(keypair.publicKey());
  const usdcAsset = new Asset(usdcCode, usdcIssuer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: usdcAsset,
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(keypair);

  logger.log(`Submitting USDC trustline for ${keypair.publicKey()}`);
  const result = await server.submitTransaction(tx);
  const hash = (result as { hash: string }).hash;
  logger.log(`USDC trustline established: ${hash}`);

  return hash;
}
