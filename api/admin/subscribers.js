import { getAllSubscribers, isAdmin } from '../../lib/kv-store.js';

export async function GET(req) {
  try {
    // Check admin auth (via header)
    const authHeader = req.headers.get('x-admin-secret');
    const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    
    // Simple auth check (in production, use proper auth)
    if (!authHeader || !adminIds.includes(authHeader)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const subscribers = await getAllSubscribers();
    
    return new Response(
      JSON.stringify({
        success: true,
        count: subscribers.length,
        subscribers: subscribers.map(s => ({
          identifier: s.identifier,
          type: s.subscriber_type,
          status: s.status,
          created_at: s.created_at,
          preferences: s.preferences
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin subscribers error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req) {
  try {
    // Check admin auth
    const authHeader = req.headers.get('x-admin-secret');
    const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
    
    if (!authHeader || !adminIds.includes(authHeader)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Export to CSV
    const subscribers = await getAllSubscribers();
    
    const csvHeader = 'identifier,type,status,created_at,preferences\n';
    const csvRows = subscribers.map(s => 
      `${s.identifier},${s.subscriber_type},${s.status},${s.created_at},"${JSON.stringify(s.preferences)}"`
    ).join('\n');
    
    const csv = csvHeader + csvRows;
    
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=subscribers.csv'
      }
    });
  } catch (error) {
    console.error('Admin export error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}