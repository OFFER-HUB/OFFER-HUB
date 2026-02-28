#!/usr/bin/env tsx
/**
 * Agregar trustline de USDC a demo3 wallet
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Horizon,
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

// demo3 credentials
const DEMO3_PUBLIC = 'GAAHFQIGIUN47APPF4X7VNX5KS2SDLQD4GRGQSYKWXJDHT2AFLEJ642M';
const DEMO3_SECRET = 'SAUYUZZGBRNC54H4RPDOWFHGAU2DULHYHP6FDNZBD6W357SEJNNSP5MN';

async function addTrustline() {
  console.log('🔧 Agregando USDC trustline a demo3...\n');

  const server = new Horizon.Server(HORIZON_URL);
  const sourceKeypair = Keypair.fromSecret(DEMO3_SECRET);

  try {
    // Get account
    const account = await server.loadAccount(DEMO3_PUBLIC);
    console.log(`✅ Account loaded: ${DEMO3_PUBLIC}`);

    // Build transaction
    const usdcAsset = new Asset('USDC', USDC_ISSUER);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.changeTrust({
          asset: usdcAsset,
          limit: '1000000', // 1M USDC limit
        })
      )
      .setTimeout(180)
      .build();

    // Sign and submit
    transaction.sign(sourceKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('✅ Trustline creada exitosamente!');
    console.log(`   Hash: ${result.hash}`);
    console.log(`   Asset: USDC:${USDC_ISSUER}`);
    console.log(`\n📝 Ahora demo3 puede recibir USDC en escrows\n`);

  } catch (error: any) {
    if (error?.response?.data) {
      console.error('❌ Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

addTrustline();
