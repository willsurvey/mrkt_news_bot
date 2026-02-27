import { getHealthStatus } from '../lib/kv-store.js';

export async function GET() {
  try {
    const health = await getHealthStatus();
    
    const now = new Date();
    const lastRun = health.last_successful_run 
      ? new Date(health.last_successful_run)
      : null;
    
    const minutesSinceLastRun = lastRun
      ? Math.floor((now - lastRun) / 60000)
      : null;
    
    const status = minutesSinceLastRun !== null && minutesSinceLastRun < 30
      ? 'healthy'
      : 'degraded';
    
    return new Response(
      JSON.stringify({
        status,
        last_successful_run: health.last_successful_run,
        minutes_since_last_run: minutesSinceLastRun,
        current_time: now.toISOString()
      }),
      { 
        status: status === 'healthy' ? 200 : 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}