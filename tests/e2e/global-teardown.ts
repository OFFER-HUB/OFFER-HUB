import { execSync } from 'child_process';
import { join } from 'path';

const COMPOSE_FILE = join(__dirname, 'docker-compose.e2e.yml');

export default async function globalTeardown() {
    console.log('\n🧹 Stopping E2E Docker containers...');

    try {
        execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
            stdio: 'inherit',
        });
    } catch {
        // Ignore errors during teardown
    }

    console.log('✅ E2E cleanup complete\n');
}
