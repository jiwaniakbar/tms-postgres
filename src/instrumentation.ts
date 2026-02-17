
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initPostgresSchema } = await import('./lib/init-postgres');
      console.log('Running database schema initialization...');
      await initPostgresSchema();
      console.log('Database schema initialization completed.');
    } catch (err: any) {
      console.error('Failed to initialize database schema:', err);
      // We don't throw here to avoid crashing the whole server if just one query fails, 
      // but in production you might want to stop startup if DB is critical.
    }
  }
}
