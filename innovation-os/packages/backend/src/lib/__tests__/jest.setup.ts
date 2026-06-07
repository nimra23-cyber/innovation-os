/**
 * Jest global setup: push the Prisma schema to the test SQLite database
 * so that the test.db has the correct tables before any tests run.
 */

import { execSync } from 'child_process';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  // Resolve backend directory: 3 levels up from __tests__ → lib → src → backend
  const backendDir = path.resolve(__dirname, '../../../');
  const schemaPath = path.resolve(backendDir, 'prisma/schema.prisma');
  const testDbUrl = `file:${path.resolve(backendDir, 'prisma/test.db')}`;

  execSync(`npx prisma db push --schema "${schemaPath}" --accept-data-loss`, {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
    stdio: 'inherit',
  });
}
