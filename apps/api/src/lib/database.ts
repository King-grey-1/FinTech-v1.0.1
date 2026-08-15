/**
 * Database connection and query execution.
 * Provides pooled connections to PostgreSQL.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Database connection pool manager.
 * Manages PostgreSQL connections with connection pooling.
 */
class DatabasePool {
  private pool: Pool | null = null;

  /**
   * Initialize database connection pool.
   * @param config - Database configuration
   */
  initialize(config: DatabaseConfig): void {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: config.max ?? 20,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 2000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Get a client from the pool.
   * @returns Pool client
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool.connect();
  }

  /**
   * Execute a query on the pool.
   * @param text - SQL query text
   * @param values - Query parameters
   * @returns Query result
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool.query<T>(text, values);
  }

  /**
   * End all connections in the pool.
   */
  async end(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Check if pool is initialized and connected.
   * @returns true if connected
   */
  isConnected(): boolean {
    return this.pool != null;
  }
}

// Global singleton pool instance
export const dbPool = new DatabasePool();

/**
 * Initialize database connection pool from environment variables.
 * Expects:
 * - POSTGRES_HOST
 * - POSTGRES_PORT
 * - POSTGRES_DB
 * - POSTGRES_USER
 * - POSTGRES_PASSWORD
 */
export function initializeDatabasePool(): void {
  const config: DatabaseConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || 'fintech_platform',
    username: process.env.POSTGRES_USER || 'fintech',
    password: process.env.POSTGRES_PASSWORD || 'fintech_password',
  };

  dbPool.initialize(config);
}
