// api/grants.js — Vercel serverless function
// Proxies grant searches to the official Grants.gov search2 API.
// The browser can't call api.grants.gov directly (CORS), but this function
// runs on Vercel's servers, where CORS doesn't apply. No API key required —
// search2 is a public, unauthenticated endpoint (confirmed at
// https://www.grants.gov/api/api-guide).

export default async function handler(req, res) {
  // Only accept POST — same method the front-end uses
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const upstream = await fetch('https://api.grants.gov/v1/api/search2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // req.body is already parsed by Vercel when Content-Type is JSON
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: 'Could not reach Grants.gov',
      detail: String(err && err.message ? err.message : err),
    });
  }
}
