#!/usr/bin/env tsx
/**
 * Script para fondear las wallets de Stellar testnet con USDC
 * Sincroniza el balance real de Stellar con el balance en DB
 */

import { PrismaClient } from '@prisma/client';
import { Keypair, Server, Networks, TransactionBuilder, Operation, Asset, BASE_FEE } from '@stellar/stellar-sdk';

const prisma = new PrismaClient();
const server = new Server('https://horizon-testnet.stellar.org');

// USDC testnet issuer (Circle's testnet USDC)
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC = new Asset('USDC', USDC_ISSUER);

interface WalletToFund {
  email: string;
  publicKey: string;
  secretEncrypted: string;
  targetBalance: string;
}

async function decryptSecret(encrypted: string): Promise<string> {
  // Por simplicidad, esto asume que tienes la clave de desencriptación
  // En producción esto vendría del config o secrets manager
  const crypto = await import('crypto');
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');

  // Esto es un placeholder - necesitas la clave de encriptación real del config
  const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'your-32-byte-encryption-key-here';
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

async function activateAccount(publicKey: string): Promise<void> {
  console.log(`  ⏳ Activando cuenta ${publicKey}...`);

  try {
    // Usar Friendbot para activar la cuenta con XLM gratis
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    );

    if (!response.ok) {
      const account = await server.loadAccount(publicKey);
      console.log(`  ✅ Cuenta ya activa (balance: ${account.balances[0].balance} XLM)`);
      return;
    }

    console.log(`  ✅ Cuenta activada con 10,000 XLM testnet`);
  } catch (error: any) {
    if (error.response?.status === 400) {
      console.log(`  ✅ Cuenta ya existe`);
    } else {
      throw error;
    }
  }
}

async function createTrustline(secretKey: string, publicKey: string): Promise<void> {
  console.log(`  ⏳ Creando trustline para USDC...`);

  const sourceKeypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(publicKey);

  // Verificar si ya tiene trustline
  const usdcBalance = account.balances.find(
    (b: any) => b.asset_type === 'credit_alphanum4' && b.asset_code === 'USDC'
  );

  if (usdcBalance) {
    console.log(`  ✅ Trustline ya existe (balance: ${usdcBalance.balance} USDC)`);
    return;
  }

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: USDC,
      })
    )
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);

  await server.submitTransaction(transaction);
  console.log(`  ✅ Trustline creada para USDC`);
}

async function fundWithUSDC(
  secretKey: string,
  publicKey: string,
  amount: string
): Promise<void> {
  console.log(`  ⏳ Fondeando con ${amount} USDC...`);

  // Esto requiere una cuenta "issuer" con USDC testnet
  // Por ahora, esto es un placeholder
  // En testnet real, necesitarías usar un faucet de USDC testnet o tener una cuenta issuer

  console.log(`  ⚠️  NOTA: Para fondear con USDC testnet real, necesitas:`);
  console.log(`     1. Usar un faucet de USDC testnet`);
  console.log(`     2. O configurar una cuenta issuer de USDC`);
  console.log(`     3. O usar Circle's testnet USDC faucet`);

  // Verificar balance actual
  const account = await server.loadAccount(publicKey);
  const usdcBalance = account.balances.find(
    (b: any) => b.asset_type === 'credit_alphanum4' && b.asset_code === 'USDC'
  );

  if (usdcBalance) {
    console.log(`  📊 Balance actual: ${usdcBalance.balance} USDC`);
  } else {
    console.log(`  📊 Balance actual: 0 USDC (trustline no creada aún)`);
  }
}

async function main() {
  console.log('🚀 Fondeando wallets de Stellar testnet...\n');

  try {
    // 1. Obtener usuarios con sus wallets
    const users = await prisma.user.findMany({
      where: {
        email: { in: ['demo3@demo.com', 'demo4@demo.com'] },
      },
      include: {
        wallets: { where: { isPrimary: true } },
        balance: true,
      },
    });

    console.log('📋 Wallets a fondear:\n');

    for (const user of users) {
      const wallet = user.wallets[0];
      const balance = user.balance;

      if (!wallet || !balance) {
        console.log(`❌ ${user.email}: Sin wallet o balance`);
        continue;
      }

      console.log(`👤 ${user.email}`);
      console.log(`   Public Key: ${wallet.publicKey}`);
      console.log(`   Target Balance: $${balance.available} USDC\n`);

      // 2. Activar cuenta con Friendbot (XLM gratis)
      await activateAccount(wallet.publicKey);

      // 3. Desencriptar secret key
      let secretKey: string;
      try {
        secretKey = await decryptSecret(wallet.secretEncrypted!);
      } catch (error) {
        console.log(`  ⚠️  No se pudo desencriptar el secret (usa WALLET_ENCRYPTION_KEY env var)`);
        console.log(`  ℹ️  Puedes fondear manualmente visitando:`);
        console.log(`     https://laboratory.stellar.org/#account-creator?network=test`);
        console.log(`     Y luego configurar trustline para USDC\n`);
        continue;
      }

      // 4. Crear trustline para USDC
      await createTrustline(secretKey, wallet.publicKey);

      // 5. Fondear con USDC
      await fundWithUSDC(secretKey, wallet.publicKey, balance.available);

      console.log(`\n`);
    }

    console.log('\n✅ Proceso completado!\n');
    console.log('📝 Próximos pasos para fondeo real de USDC:');
    console.log('   1. Visitar: https://www.circle.com/en/usdc-testnet-faucet');
    console.log('   2. O usar el USDC testnet issuer de Circle');
    console.log('   3. Enviar USDC testnet a las public keys mostradas arriba\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
