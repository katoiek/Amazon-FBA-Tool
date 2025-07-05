import { serve } from '@hono/node-server';
import app from './index.js';

const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 Starting production server on port ${port}...`);

try {
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`✅ Production server successfully started on http://localhost:${port}`);
    console.log(`📊 Dashboard available at: http://localhost:${port}`);
  });
} catch (error) {
  console.error('❌ Production server startup error:', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down production server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down production server...');
  process.exit(0);
});
