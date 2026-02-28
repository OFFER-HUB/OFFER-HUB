#!/usr/bin/env tsx
/**
 * Script para fondear cuentas de prueba con balance
 *
 * Usage: npx tsx scripts/fund-test-accounts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fundTestAccounts() {
  console.log('🚀 Fondeando cuentas de prueba...\n');

  try {
    // Buscar usuarios por email
    const demo3 = await prisma.user.findUnique({
      where: { email: 'demo3@demo.com' },
      include: { balance: true },
    });

    const demo4 = await prisma.user.findUnique({
      where: { email: 'demo4@demo.com' },
      include: { balance: true },
    });

    if (!demo3 || !demo4) {
      console.error('❌ Error: No se encontraron los usuarios demo3 y/o demo4');
      console.log('   Asegúrate de que existan usuarios con estos emails.');
      process.exit(1);
    }

    console.log('✅ Usuarios encontrados:');
    console.log(`   - demo3@demo.com (${demo3.id}) - Freelancer/Seller`);
    console.log(`   - demo4@demo.com (${demo4.id}) - Cliente/Buyer\n`);

    // Fondear demo4 (buyer) con $1000
    const buyerAmount = '1000.00';

    if (demo4.balance) {
      // Update existing balance
      await prisma.balance.update({
        where: { userId: demo4.id },
        data: { available: buyerAmount, reserved: '0.00' },
      });
      console.log(`✅ Balance actualizado para demo4@demo.com: $${buyerAmount}`);
    } else {
      // Create new balance
      await prisma.balance.create({
        data: {
          userId: demo4.id,
          available: buyerAmount,
          reserved: '0.00',
          currency: 'USD',
        },
      });
      console.log(`✅ Balance creado para demo4@demo.com: $${buyerAmount}`);
    }

    // Fondear demo3 (seller) con $500 (opcional, para probar withdrawals)
    const sellerAmount = '500.00';

    if (demo3.balance) {
      // Update existing balance
      await prisma.balance.update({
        where: { userId: demo3.id },
        data: { available: sellerAmount, reserved: '0.00' },
      });
      console.log(`✅ Balance actualizado para demo3@demo.com: $${sellerAmount}`);
    } else {
      // Create new balance
      await prisma.balance.create({
        data: {
          userId: demo3.id,
          available: sellerAmount,
          reserved: '0.00',
          currency: 'USD',
        },
      });
      console.log(`✅ Balance creado para demo3@demo.com: $${sellerAmount}`);
    }

    console.log('\n🎉 ¡Cuentas fondeadas exitosamente!');
    console.log('\nResumen:');
    console.log(`   - demo4@demo.com (Buyer):  $${buyerAmount} disponible`);
    console.log(`   - demo3@demo.com (Seller): $${sellerAmount} disponible`);
    console.log('\nYa puedes probar el flujo de Reserve Funds → Create Escrow → Fund Escrow 🚀');
  } catch (error) {
    console.error('❌ Error al fondear cuentas:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fundTestAccounts();
