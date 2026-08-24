# The Money Website — Vercel Deployment Package

## What's in this folder

```
the-money-website-vercel/
├── index.html        ← the entire site (all 6 pages)
├── api/
│   ├── grants.js     ← serverless function: live Grants.gov search proxy
│   ├── ca-grants.js  ← serverless function: California grant sources
│   └── draft.js      ← serverless function: real AI grant writing
└── README.md         ← this file
```

No build step, no frameworks, no command line needed. Vercel automatically
recognizes `index.html` as the site and anything in `api/` as serverless
functions.

## The AI writer now calls a real model

The Grant Draft Generator, AI Feedback Coach, and Improve Draft features used
to be template demos that ran in the browser. They now call `api/draft.js`,
which calls a real model through Vercel AI Gateway.

`api/draft.js` supports four modes, all POST to `/api/draft`:

| mode | what it does |
|------|--------------|
| `draft` | writes all five narrative sections in one call |
| `section` | rewrites one section (the Regenerate button) |
| `feedback` | scores and critiques one section (Review with AI Coach) |
| `improve` | rewrites one section against the coach notes (Improve Draft) |

### Required setup

Set one environment variable on the Vercel project, under
Settings → Environment Variables:

```
AI_GATEWAY_API_KEY = <your key from vercel.com/dashboard → AI Gateway → API Keys>
```

Add it to Production, Preview, and Development, then redeploy.

Until that key is set, the site still works. Every draft shows an orange
SAMPLE banner and falls back to the old template text, so nobody mistakes a
placeholder for a real draft. Once the key is set the banner turns green and
reads LIVE.

### Optional environment variables

| variable | default | purpose |
|----------|---------|---------|
| `AI_MODEL` | `anthropic/claude-sonnet-5` | swap models without a code change |
| `DRAFT_RATE_LIMIT` | `12` | max requests per IP per window |
| `DRAFT_RATE_WINDOW_MS` | `3600000` | window length in milliseconds |

### Cost and abuse

`/api/draft` is a public endpoint. Anyone who finds it can spend your AI
Gateway credits. The rate limiter caps requests per IP, but it holds state in
memory on each function instance, so Vercel running several instances means a
determined attacker can exceed the cap. If real traffic arrives, move the
counter to Vercel KV or Upstash Redis.

The model is instructed never to invent statistics. Where a number would help
but was not supplied, it writes a bracketed placeholder such as
`[insert free and reduced price lunch percentage]`. Those placeholders are
intentional. District staff fill them in.

## No Anthropic API key is required

The site does not call the Anthropic API directly. Everything goes through
Vercel AI Gateway. You do NOT need to set `ANTHROPIC_API_KEY`.

## One thing to configure after deploying: Formspree (lead capture)

1. Go to https://formspree.io and create a free account (50 submissions/month free).
2. Click "+ New form", name it "Money Website Leads", set the email where you
   want leads delivered.
3. Formspree shows you an endpoint like `https://formspree.io/f/xabcdefg`.
   Copy the ID — the part after `/f/` (e.g. `xabcdefg`).
4. In your GitHub repository, open `index.html`, click the pencil icon (Edit),
   press Ctrl+F and search for: YOUR_FORM_ID_HERE
5. Replace `YOUR_FORM_ID_HERE` with your ID (keep the quotes), e.g.:
   `const FORMSPREE_FORM_ID = 'xabcdefg';`
6. Click "Commit changes". Vercel redeploys automatically in ~1 minute.
7. Test: on your live site, click Generate Draft on any grant, fill out the
   account form, submit — the lead should arrive in your email within a minute.
   (The first submission may require you to click a one-time confirmation
   email from Formspree.)

Until you do this, the site works fine — leads just aren't sent anywhere,
and the browser console will remind you with a [TMW] warning.

## Verifying the live grant search works

1. Open your live site, run any grant search.
2. Press F12 (DevTools) → Console tab.
3. Look for: `[TMW] HTTP response received: 200` and `[TMW] hitCount: <number>`
   followed by `[TMW] ✓ LIVE FETCH SUCCEEDED`.
4. The federal section under your results should show a 🟢 LIVE badge with
   real opportunities, each linking to grants.gov/search-results-detail/{id}.

If you instead see the ⚠️ SAMPLE banner on the deployed site, check the
Vercel dashboard → your project → Functions tab to confirm `api/grants`
deployed.
