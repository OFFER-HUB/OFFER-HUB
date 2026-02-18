#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { randomBytes } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { generateEnvFile } from './env-generator.js';
import { printBanner, printSuccess } from './ui.js';

interface SetupAnswers {
    port: number;
    databaseUrl: string;
    redisUrl: string;
    paymentProvider: 'crypto' | 'airtm';
    stellarNetwork: 'testnet' | 'mainnet';
    trustlessApiKey: string;
    trustlessWebhookSecret: string;
    publicBaseUrl: string;
    // AirTM (conditional)
    airtmApiKey?: string;
    airtmApiSecret?: string;
    airtmWebhookSecret?: string;
    // Actions
    runMigrations: boolean;
    generateApiKey: boolean;
}

async function main(): Promise<void> {
    printBanner();

    const cwd = process.cwd();

    // Check if we're in an OFFER-HUB project
    const packageJsonPath = join(cwd, 'package.json');
    if (!existsSync(packageJsonPath)) {
        console.log(chalk.red('Error: No package.json found in current directory.'));
        console.log(chalk.gray('Run this command from the root of your OFFER-HUB Orchestrator project.'));
        process.exit(1);
    }

    // Check if .env already exists
    const envPath = join(cwd, '.env');
    if (existsSync(envPath)) {
        const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: '.env file already exists. Overwrite?',
            default: false,
        }]);
        if (!overwrite) {
            console.log(chalk.yellow('Setup canceled. Existing .env preserved.'));
            process.exit(0);
        }
    }

    console.log('');
    console.log(chalk.bold('Let\'s configure your OFFER-HUB Orchestrator instance.'));
    console.log('');

    // --- Core configuration ---
    const coreAnswers = await inquirer.prompt([
        {
            type: 'number',
            name: 'port',
            message: 'API Port:',
            default: 4000,
            validate: (input: number) => (input > 0 && input < 65536) || 'Port must be between 1 and 65535',
        },
        {
            type: 'input',
            name: 'databaseUrl',
            message: 'PostgreSQL Database URL:',
            default: 'postgresql://postgres:postgres@localhost:5432/offerhub',
            validate: (input: string) => input.startsWith('postgres') || 'Must be a PostgreSQL connection string',
        },
        {
            type: 'input',
            name: 'redisUrl',
            message: 'Redis URL:',
            default: 'redis://localhost:6379',
            validate: (input: string) => input.startsWith('redis') || 'Must be a Redis connection string',
        },
    ]);

    // --- Payment provider ---
    const { paymentProvider } = await inquirer.prompt([{
        type: 'list',
        name: 'paymentProvider',
        message: 'Payment provider:',
        choices: [
            { name: 'Crypto-Native (Stellar invisible wallets) — recommended', value: 'crypto' },
            { name: 'AirTM (fiat on/off ramp — requires Enterprise account)', value: 'airtm' },
        ],
        default: 'crypto',
    }]);

    // --- AirTM credentials (conditional) ---
    let airtmAnswers = {};
    if (paymentProvider === 'airtm') {
        airtmAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'airtmApiKey',
                message: 'AirTM API Key:',
                validate: (input: string) => input.trim() !== '' || 'Required for AirTM mode',
            },
            {
                type: 'password',
                name: 'airtmApiSecret',
                message: 'AirTM API Secret:',
                mask: '*',
                validate: (input: string) => input.trim() !== '' || 'Required for AirTM mode',
            },
            {
                type: 'password',
                name: 'airtmWebhookSecret',
                message: 'AirTM Webhook Secret:',
                mask: '*',
                validate: (input: string) => input.trim() !== '' || 'Required for AirTM mode',
            },
        ]);
    }

    // --- Stellar configuration ---
    const stellarAnswers = await inquirer.prompt([{
        type: 'list',
        name: 'stellarNetwork',
        message: 'Stellar network:',
        choices: [
            { name: 'Testnet (development/staging)', value: 'testnet' },
            { name: 'Mainnet (production)', value: 'mainnet' },
        ],
        default: 'testnet',
    }]);

    // --- Trustless Work ---
    console.log('');
    console.log(chalk.bold('Trustless Work Integration'));
    console.log(chalk.gray('Get credentials at: https://dapp.trustlesswork.com'));
    console.log('');

    const trustlessAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'trustlessApiKey',
            message: 'Trustless Work API Key:',
            default: 'your_api_key_here',
        },
        {
            type: 'password',
            name: 'trustlessWebhookSecret',
            message: 'Trustless Work Webhook Secret:',
            mask: '*',
            default: 'tw_whsec_...',
        },
    ]);

    // --- Public URL ---
    const { publicBaseUrl } = await inquirer.prompt([{
        type: 'input',
        name: 'publicBaseUrl',
        message: 'Public URL (for webhooks):',
        default: `http://localhost:${coreAnswers.port}`,
        validate: (input: string) => {
            try {
                new URL(input);
                return true;
            } catch {
                return 'Must be a valid URL';
            }
        },
    }]);

    // --- Post-setup actions ---
    console.log('');
    console.log(chalk.bold('Post-Setup Actions'));
    console.log('');

    const actionAnswers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'runMigrations',
            message: 'Run database migrations now?',
            default: true,
        },
        {
            type: 'confirm',
            name: 'generateApiKey',
            message: 'Generate initial admin API key?',
            default: true,
        },
    ]);

    const answers: SetupAnswers = {
        ...coreAnswers,
        paymentProvider,
        ...stellarAnswers,
        ...trustlessAnswers,
        publicBaseUrl,
        ...airtmAnswers,
        ...actionAnswers,
    };

    // --- Generate keys ---
    console.log('');
    const masterKey = `ohk_master_${randomBytes(24).toString('hex')}`;
    const walletEncryptionKey = randomBytes(32).toString('hex');

    console.log(chalk.cyan('Generated OFFERHUB_MASTER_KEY:'));
    console.log(chalk.yellow(masterKey));
    console.log('');

    if (answers.paymentProvider === 'crypto') {
        console.log(chalk.cyan('Generated WALLET_ENCRYPTION_KEY:'));
        console.log(chalk.yellow(walletEncryptionKey));
        console.log(chalk.red.bold('IMPORTANT: Back up this key securely. If lost, all wallets become unrecoverable.'));
        console.log('');
    }

    // --- Write .env ---
    const spinner = ora('Writing .env file...').start();
    const envContent = generateEnvFile({
        port: answers.port,
        databaseUrl: answers.databaseUrl,
        redisUrl: answers.redisUrl,
        masterKey,
        paymentProvider: answers.paymentProvider,
        walletEncryptionKey: answers.paymentProvider === 'crypto' ? walletEncryptionKey : undefined,
        stellarNetwork: answers.stellarNetwork,
        trustlessApiKey: answers.trustlessApiKey,
        trustlessWebhookSecret: answers.trustlessWebhookSecret,
        publicBaseUrl: answers.publicBaseUrl,
        airtmApiKey: answers.airtmApiKey,
        airtmApiSecret: answers.airtmApiSecret,
        airtmWebhookSecret: answers.airtmWebhookSecret,
    });

    writeFileSync(envPath, envContent, 'utf-8');
    spinner.succeed('.env file created');

    // --- Run migrations ---
    if (answers.runMigrations) {
        const migrationSpinner = ora('Running database migrations...').start();
        try {
            execSync('npx prisma generate --schema packages/database/prisma/schema.prisma', {
                cwd,
                stdio: 'pipe',
            });
            execSync('npx prisma migrate deploy --schema packages/database/prisma/schema.prisma', {
                cwd,
                stdio: 'pipe',
            });
            migrationSpinner.succeed('Database migrations applied');
        } catch (error) {
            migrationSpinner.fail('Database migration failed');
            console.log(chalk.red('Check your DATABASE_URL and ensure PostgreSQL is running.'));
            console.log(chalk.gray('You can run migrations manually later:'));
            console.log(chalk.gray('  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma'));
            console.log('');
        }

        // --- Bootstrap platform user ---
        const bootstrapSpinner = ora('Bootstrapping platform user (Stellar wallet)...').start();
        try {
            const bootstrapOutput = execSync('npm run bootstrap', {
                cwd,
                stdio: 'pipe',
                env: { ...process.env },
            }).toString();

            const match = bootstrapOutput.match(/PLATFORM_USER_ID=(usr_\S+)/);
            if (match) {
                const platformUserId = match[1];
                const envContent = readFileSync(envPath, 'utf-8');
                writeFileSync(envPath, envContent.replace('PLATFORM_USER_ID=', `PLATFORM_USER_ID=${platformUserId}`), 'utf-8');
                bootstrapSpinner.succeed(`Platform user created: ${platformUserId}`);
            } else {
                throw new Error('Could not parse PLATFORM_USER_ID from bootstrap output');
            }
        } catch {
            bootstrapSpinner.warn('Bootstrap failed — run manually after setup:');
            console.log(chalk.gray('  npm run bootstrap'));
            console.log(chalk.gray('  Then paste the PLATFORM_USER_ID= value into your .env'));
            console.log('');
        }
    }

    // --- Generate API key ---
    if (answers.generateApiKey) {
        const apiKeySpinner = ora('Generating admin API key...').start();
        try {
            const result = execSync(
                `curl -s -X POST http://localhost:${answers.port}/api/v1/auth/api-keys ` +
                `-H "Authorization: Bearer ${masterKey}" ` +
                `-H "Content-Type: application/json" ` +
                `-d '{"name": "Admin Key", "scopes": ["orders", "users", "balance", "withdrawals", "topups", "support"]}'`,
                { cwd, stdio: 'pipe' },
            );
            const response = JSON.parse(result.toString());
            if (response.data?.key) {
                apiKeySpinner.succeed('Admin API key generated');
                console.log('');
                console.log(chalk.cyan('Your API Key (save this — shown only once):'));
                console.log(chalk.yellow(response.data.key));
                console.log('');
            } else {
                throw new Error('Unexpected response');
            }
        } catch {
            apiKeySpinner.warn('Could not generate API key (server may not be running yet)');
            console.log(chalk.gray('Start the server first, then generate a key:'));
            console.log(chalk.gray(`  curl -X POST http://localhost:${answers.port}/api/v1/auth/api-keys \\`));
            console.log(chalk.gray(`    -H "Authorization: Bearer ${masterKey}" \\`));
            console.log(chalk.gray(`    -H "Content-Type: application/json" \\`));
            console.log(chalk.gray(`    -d '{"name": "Admin Key", "scopes": ["orders", "users", "balance"]}'`));
            console.log('');
        }
    }

    // --- Success ---
    printSuccess(answers.port, answers.paymentProvider, answers.stellarNetwork);
}

main().catch((error) => {
    console.error(chalk.red('Setup failed:'), error.message);
    process.exit(1);
});
