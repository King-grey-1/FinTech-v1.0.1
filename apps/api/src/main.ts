import dotenv from 'dotenv';
import { app } from './app';
import { dbPool } from './lib/database';
import { initializeDatabase } from './lib/db-init';

dotenv.config();

const port = Number(process.env.APP_PORT || 4000);

/**
 * Initialize database and start server.
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database pool with environment config
    dbPool.initialize({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DATABASE || 'fintech',
      username: process.env.POSTGRES_USERNAME || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    });

    console.log('✓ Database pool initialized');

    // Create database schema (idempotent)
    await initializeDatabase();
    console.log('✓ Database schema initialized');

    // Start Express server
    app.listen(port, () => {
      console.log(`✓ API listening on http://localhost:${port}`);
      console.log('✓ Service: platform-api (ready for requests)');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
