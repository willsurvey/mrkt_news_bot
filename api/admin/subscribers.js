import { getAllSubscribers } from '../../lib/kv-store.js';

/**
 * Auth menggunakan ADMIN_SECRET (string rahasia terpisah dari ADMIN_USER_IDS).
 * ADMIN_USER_IDS berisi Telegram user ID (angka) — tidak cocok untuk HTTP auth.
 * Tambahkan ADMIN_SECRET=your_secret ke .env
 */
function isAuthorized(req) {
  const adminSecret = process.env.ADMIN_SECRET;

  // Jika ADMIN_SECRET tidak di-set, endpoint ini tidak bisa diakses
  if (!adminSecret) {
    console.error('ADMIN_SECRET env var not set — admin API disabled');
    return false;
  }

  const authHeader = req.headers.get('x-admin-secret');
  const url = new URL(req.url);
  const authQuery = url.searchParams.get('secret');
  const provided = authHeader || authQuery;

  return provided === adminSecret;
}

// GET: JSON list subscriber
export async function GET(req) {
  try {
    if (!isAuthorized(req)) {
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
    console.error('Admin subscribers GET error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST: CSV export
export async function POST(req) {
  try {
    if (!isAuthorized(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscribers = await getAllSubscribers();

    const csvHeader = 'identifier,type,status,created_at,preferences\n';
    const csvRows = subscribers.map(s =>
      `${s.identifier},${s.subscriber_type},${s.status},${s.created_at},"${JSON.stringify(s.preferences || {})}"`
    ).join('\n');

    const csv = csvHeader + csvRows;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=subscribers_${Date.now()}.csv`
      }
    });
  } catch (error) {
    console.error('Admin subscribers POST error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
