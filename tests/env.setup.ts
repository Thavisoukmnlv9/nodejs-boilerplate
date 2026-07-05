/**
 * Runs before any module is imported (jest `setupFiles`), so config/env's boot-time
 * validation sees a valid test environment. Real values (CI) win; these are fallbacks.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-0123456789';
process.env.DATABASE_URL ||= 'postgresql://boilerplate:boilerplate_dev@localhost:5432/boilerplate_test?schema=public';
process.env.LOG_LEVEL ||= 'silent';
process.env.STORAGE_DRIVER ||= 'local';
