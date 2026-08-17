// api/ca-grants.js - Vercel serverless function
//
// Proxies the California Grants Portal dataset published by the California
// State Library on data.ca.gov (CKAN 2.9.11).
//
// VERIFIED FACTS (checked against the live platform, August 2026):
//   Dataset  : https://data.ca.gov/dataset/california-grants-portal
//   Resource : 111c8c88-21f6-453c-ae2c-b4785a0624f5
//   Refresh  : once every 24 hours at 8:45pm Pacific (not real time)
//   Licence  : public domain, no API key required
//   Schema   : PortalID, GrantID, Status, LastUpdated, ChangeNotes, AgencyDept,
//              Title, Type, LOI, Categories, CategorySuggestion, Purpose,
//              Description, ApplicantType, ApplicantTypeNotes, Geography,
//              FundingSource, FundingSourceNotes, MatchingFunds,
//              MatchingFundsNotes, EstAvailFunds, EstAwards, EstAmounts,
//              FundingMethod, FundingMethodNotes, OpenDate, ApplicationDeadline,
//              AwardPeriod, ExpAwardDate, ElecSubmission, GrantURL, AgencyURL,
//              AgencySubscribeURL, GrantEventsURL, ContactInfo, AwardStats
//
// TWO PATHS, because I could not verify from the build environment whether the
// DataStore extension is enabled for this particular resource:
//   1. CKAN datastore_search  - fast, supports server-side keyword search
//   2. CSV download + parse   - proven to work, used when path 1 is unavailable
// The response reports which path served the request in `source`.

const RESOURCE_ID = '111c8c88-21f6-453c-ae2c-b4785a0624f5';
const DATASTORE_URL = 'https://data.ca.gov/api/3/action/datastore_search';
const CSV_URL =
  'https://data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/' +
  '111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv';

// Minimal RFC 4180 parser. Fields may contain commas, quotes and newlines.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] === undefined ? '' : r[i]); });
    return o;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const body = req.body || {};
  const keyword = String(body.keyword || '').trim();
  const limit = Math.min(parseInt(body.limit, 10) || 300, 1000);

  // ---- Path 1: CKAN DataStore -------------------------------------------
  try {
    const params = new URLSearchParams({
      resource_id: RESOURCE_ID,
      limit: String(limit),
    });
    if (keyword) params.set('q', keyword);

    const r = await fetch(DATASTORE_URL + '?' + params.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (r.ok) {
      const j = await r.json();
      if (j && j.success && j.result && Array.isArray(j.result.records)) {
        res.status(200);
        res.setHeader('Content-Type', 'application/json');
        // Upstream refreshes once a day, so a long edge cache is appropriate.
        res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
        res.send(JSON.stringify({
          source: 'datastore_search',
          total: j.result.total,
          returned: j.result.records.length,
          records: j.result.records,
        }));
        return;
      }
    }
  } catch (e) {
    // fall through to the CSV path
  }

  // ---- Path 2: CSV download and parse ------------------------------------
  try {
    const r = await fetch(CSV_URL, { headers: { Accept: 'text/csv' } });
    if (!r.ok) throw new Error('CSV fetch returned HTTP ' + r.status);
    const text = await r.text();
    let records = parseCSV(text);

    // Server-side keyword match so the client receives a manageable payload.
    if (keyword) {
      const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
      records = records.filter(rec => {
        const blob = (
          (rec.Title || '') + ' ' + (rec.Purpose || '') + ' ' +
          (rec.Description || '') + ' ' + (rec.Categories || '') + ' ' +
          (rec.AgencyDept || '') + ' ' + (rec.ApplicantTypeNotes || '')
        ).toLowerCase();
        return terms.some(t => blob.indexOf(t) !== -1);
      });
    }

    const total = records.length;
    records = records.slice(0, limit);

    res.status(200);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.send(JSON.stringify({
      source: 'csv_parse',
      total,
      returned: records.length,
      records,
    }));
  } catch (err) {
    res.status(502).json({
      error: 'Could not reach the California Grants Portal dataset',
      detail: String(err && err.message ? err.message : err),
    });
  }
}
