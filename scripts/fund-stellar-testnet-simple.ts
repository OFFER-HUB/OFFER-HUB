#!/usr/bin/env tsx
/**
 * Script simplificado para fondear Stellar testnet
 * Muestra las public keys y los comandos para fondearlas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Instrucciones para fondear Stellar testnet\n');
  console.log('='.repeat(60));

  const users = await prisma.user.findMany({
    where: {
      email: { in: ['demo3@demo.com', 'demo4@demo.com'] },
    },
    include: {
      wallets: { where: { isPrimary: true } },
      balance: true,
    },
  });

  console.log('\n📋 PASO 1: Activar cuentas con XLM testnet (gratis)\n');

  for (const user of users) {
    const wallet = user.wallets[0];
    if (!wallet) continue;

    console.log(`${user.email}:`);
    console.log(`curl "https://friendbot.stellar.org?addr=${wallet.publicKey}"\n`);
  }

  console.log('\n📋 PASO 2: Crear trustline para USDC testnet\n');
  console.log('USDC Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5\n');
  console.log('Ir a: https://laboratory.stellar.org/#txbuilder?network=test\n');

  for (const user of users) {
    const wallet = user.wallets[0];
    if (!wallet) continue;

    console.log(`${user.email}: ${wallet.publicKey}`);
    console.log(`   → Operation: Change Trust`);
    console.log(`   → Asset Code: USDC`);
    console.log(`   → Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5\n`);
  }

  console.log('\n📋 PASO 3: Fondear con USDC testnet\n');

  for (const user of users) {
    const wallet = user.wallets[0];
    const balance = user.balance;
    if (!wallet || !balance) continue;

    console.log(`${user.email}:`);
    console.log(`   Public Key: ${wallet.publicKey}`);
    console.log(`   Amount: ${balance.available} USDC`);
    console.log(`   DB Balance: $${balance.available}\n`);
  }

  console.log('\n📝 OPCIÓN AUTOMÁTICA: Usar script con variables de entorno\n');
  console.log('export WALLET_ENCRYPTION_KEY="tu-clave-de-32-bytes"');
  console.log('npx tsx scripts/fund-stellar-testnet.ts\n');

  console.log('\n📝 PARA TESTING RÁPIDO:\n');
  console.log('1. Las cuentas YA están creadas en la DB');
  console.log('2. Solo necesitas fondear las wallets de Stellar testnet');
  console.log('3. El balance DB ya muestra los montos correctos ($500 y $1000)');
  console.log('4. Después de fondear Stellar, todo estará sincronizado ✅\n');

  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main();
