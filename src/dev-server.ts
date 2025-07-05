import { serve } from '@hono/node-server';
import app from './index';

const port = 3000;

console.log(`🚀 Starting server on port ${port}...`);

try {
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`✅ Server successfully started on http://localhost:${port}`);
    console.log(`📊 Dashboard available at: http://localhost:${port}`);
  });
} catch (error) {
  console.error('❌ Server startup error:', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});
