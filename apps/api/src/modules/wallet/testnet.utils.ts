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

// Default amount of USDC to fund new accounts (for testing)
const DEFAULT_USDC_AMOUNT = '1000.00';

// Approximate XLM price in USD for testnet swap calculations
const XLM_APPROX_USD_PRICE = 0.10;

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

/**
 * Swap XLM for USDC using Stellar DEX path payment.
 * Attempts to convert XLM to USDC for the account.
 *
 * @param keypair - The account keypair
 * @param horizonUrl - Horizon server URL
 * @param usdcCode - USDC asset code
 * @param usdcIssuer - USDC issuer address
 * @param usdcAmount - Amount of USDC to receive (default: 1000)
 * @returns Transaction hash if successful
 */
export async function swapXlmToUsdc(
  keypair: Keypair,
  horizonUrl: string,
  usdcCode: string,
  usdcIssuer: string,
  usdcAmount: string = DEFAULT_USDC_AMOUNT,
): Promise<{ success: boolean; hash?: string; error?: string; usdcBalance?: string }> {
  const server = new Horizon.Server(horizonUrl);
  const publicKey = keypair.publicKey();
  const usdcAsset = new Asset(usdcCode, usdcIssuer);

  logger.log(`Attempting to swap XLM for ${usdcAmount} USDC for ${publicKey}`);

  try {
    // Load account to get current balances
    const account = await server.loadAccount(publicKey);

    // Check XLM balance
    const xlmBalance = account.balances.find((b: any) => b.asset_type === 'native');
    const xlmAvailable = parseFloat(xlmBalance?.balance || '0');

    logger.log(`Current XLM balance: ${xlmAvailable}`);

    // Need at least 2 XLM for reserves, so check we have enough to swap
    const xlmToSwap = Math.min(xlmAvailable - 5, 5000); // Keep 5 XLM, swap up to 5000

    if (xlmToSwap <= 0) {
      return {
        success: false,
        error: `Insufficient XLM balance for swap. Have: ${xlmAvailable}, need at least 6 XLM`,
      };
    }

    // First, try to find a path from XLM to USDC
    logger.log(`Looking for path from ${xlmToSwap} XLM to USDC...`);

    const paths = await server
      .strictSendPaths(Asset.native(), xlmToSwap.toFixed(7), [usdcAsset])
      .call();

    if (paths.records.length === 0) {
      logger.warn(`No liquidity path found from XLM to USDC on testnet DEX`);
      return {
        success: false,
        error: 'No liquidity path found on testnet DEX. Use USDC issuer mint instead.',
      };
    }

    // Get the best path
    const bestPath = paths.records[0];
    const expectedUsdc = bestPath.destination_amount;
    logger.log(`Found path: ${xlmToSwap} XLM → ${expectedUsdc} USDC`);

    // Build path payment transaction
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: Asset.native(),
          sendAmount: xlmToSwap.toFixed(7),
          destination: publicKey, // Send to self
          destAsset: usdcAsset,
          destMin: '0.01', // Accept any amount > 0.01 USDC
          path: bestPath.path.map((p: any) => new Asset(p.asset_code, p.asset_issuer)),
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    logger.log(`Submitting XLM → USDC swap transaction...`);
    const result = await server.submitTransaction(tx);
    const hash = (result as { hash: string }).hash;

    // Get new USDC balance
    const updatedAccount = await server.loadAccount(publicKey);
    const usdcBalance = updatedAccount.balances.find(
      (b: any) => b.asset_code === usdcCode && b.asset_issuer === usdcIssuer,
    );

    logger.log(`Swap successful! Hash: ${hash}, New USDC balance: ${usdcBalance?.balance || '0'}`);

    return {
      success: true,
      hash,
      usdcBalance: usdcBalance?.balance || '0',
    };
  } catch (error: any) {
    const errorMsg = error?.response?.data?.extras?.result_codes || error.message || String(error);
    logger.error(`Swap failed: ${JSON.stringify(errorMsg)}`);

    return {
      success: false,
      error: `Swap failed: ${JSON.stringify(errorMsg)}`,
    };
  }
}

/**
 * Fund account with USDC by minting from issuer.
 * Only works if you have the issuer's secret key.
 *
 * @param issuerKeypair - The USDC issuer's keypair
 * @param destinationPublicKey - The account to receive USDC
 * @param horizonUrl - Horizon server URL
 * @param usdcCode - USDC asset code
 * @param amount - Amount of USDC to mint
 * @returns Transaction hash
 */
export async function mintTestUsdc(
  issuerKeypair: Keypair,
  destinationPublicKey: string,
  horizonUrl: string,
  usdcCode: string,
  amount: string = DEFAULT_USDC_AMOUNT,
): Promise<string> {
  const server = new Horizon.Server(horizonUrl);
  const usdcAsset = new Asset(usdcCode, issuerKeypair.publicKey());

  logger.log(`Minting ${amount} USDC from issuer to ${destinationPublicKey}`);

  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const tx = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: usdcAsset,
        amount,
      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(issuerKeypair);

  const result = await server.submitTransaction(tx);
  const hash = (result as { hash: string }).hash;

  logger.log(`USDC minted successfully: ${hash}`);
  return hash;
}
