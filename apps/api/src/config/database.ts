export const databaseConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'fintech_platform',
  username: process.env.POSTGRES_USER || 'fintech',
  password: process.env.POSTGRES_PASSWORD || 'fintech_password',
};

export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};
