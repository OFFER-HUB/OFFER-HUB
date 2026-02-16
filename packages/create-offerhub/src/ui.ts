import chalk from 'chalk';

export function printBanner(): void {
    console.log('');
    console.log(chalk.bold.cyan('  OFFER-HUB Orchestrator Setup'));
    console.log(chalk.gray('  Marketplace escrow & payment infrastructure'));
    console.log('');
    console.log(chalk.gray('  Docs: https://github.com/OFFER-HUB/OFFER-HUB'));
    console.log('');
}

export function printSuccess(
    port: number,
    paymentProvider: string,
    stellarNetwork: string,
): void {
    console.log('');
    console.log(chalk.green.bold('Setup complete!'));
    console.log('');
    console.log(chalk.bold('Configuration:'));
    console.log(`  Payment:  ${paymentProvider === 'crypto' ? 'Crypto-Native (Stellar)' : 'AirTM (Fiat)'}`);
    console.log(`  Network:  ${stellarNetwork}`);
    console.log(`  Port:     ${port}`);
    console.log('');
    console.log(chalk.bold('Next steps:'));
    console.log('');
    console.log(`  ${chalk.cyan('1.')} Install dependencies:`);
    console.log(`     ${chalk.gray('npm install')}`);
    console.log('');
    console.log(`  ${chalk.cyan('2.')} Start the development server:`);
    console.log(`     ${chalk.gray('npm run dev')}`);
    console.log('');
    console.log(`  ${chalk.cyan('3.')} Verify health:`);
    console.log(`     ${chalk.gray(`curl http://localhost:${port}/api/v1/health`)}`);
    console.log('');
    console.log(`  ${chalk.cyan('4.')} Register webhook URLs with Trustless Work:`);
    console.log(`     ${chalk.gray(`POST https://your-domain.com/api/v1/webhooks/trustless-work`)}`);
    console.log('');

    if (paymentProvider === 'crypto') {
        console.log(chalk.yellow.bold('  Reminder: Back up your WALLET_ENCRYPTION_KEY securely!'));
        console.log(chalk.yellow('  If lost, all user wallets become unrecoverable.'));
        console.log('');
    }

    console.log(chalk.gray('  Full deployment guide: docs/deployment/README.md'));
    console.log('');
}
