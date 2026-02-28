#!/usr/bin/env tsx
/**
 * Script para actualizar las wallets de Stellar con nuevas keys
 */

import { PrismaClient } from '@prisma/client';
import { encrypt } from '../apps/api/src/utils/crypto';

const prisma = new PrismaClient();

const NEW_WALLETS = {
  'demo3@demo.com': {
    publicKey: 'GAAHFQIGIUN47APPF4X7VNX5KS2SDLQD4GRGQSYKWXJDHT2AFLEJ642M',
    secret: 'SAUYUZZGBRNC54H4RPDOWFHGAU2DULHYHP6FDNZBD6W357SEJNNSP5MN',
  },
  'demo4@demo.com': {
    publicKey: 'GCLP2IG5DND3E4WO3BIQYS46MJ2B5DE6XWJJK7DLAPWGNCWCWJ2FT4G3',
    secret: 'SCN2R5K4H7V4XXZANQQQAAQTGVHUINANF3OY6E6JUNVPK2WK5WMO27CT',
  },
};

async function main() {
  console.log('🔄 Actualizando wallets de Stellar...\n');

  try {
    for (const [email, wallet] of Object.entries(NEW_WALLETS)) {
      console.log(`👤 ${email}`);
      console.log(`   Public Key: ${wallet.publicKey}`);

      // 1. Buscar usuario
      const user = await prisma.user.findUnique({
        where: { email },
        include: { wallets: { where: { isPrimary: true } } },
      });

      if (!user) {
        console.log(`   ❌ Usuario no encontrado\n`);
        continue;
      }

      const existingWallet = user.wallets[0];
      if (!existingWallet) {
        console.log(`   ❌ No tiene wallet\n`);
        continue;
      }

      // 2. Encriptar nuevo secret
      const encryptedSecret = encrypt(wallet.secret);
      console.log(`   ✅ Secret encriptado`);

      // 3. Actualizar wallet
      await prisma.wallet.update({
        where: { id: existingWallet.id },
        data: {
          publicKey: wallet.publicKey,
          secretEncrypted: encryptedSecret,
        },
      });

      console.log(`   ✅ Wallet actualizada en DB`);
      console.log(`   Old Public: ${existingWallet.publicKey}`);
      console.log(`   New Public: ${wallet.publicKey}\n`);
    }

    console.log('✅ Wallets actualizadas exitosamente!\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Verificar que las nuevas wallets tienen fondos en Stellar');
    console.log('   2. El balance DB ya está correcto ($500 y $1000)');
    console.log('   3. Probar el flujo completo de Orders → Escrow\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
