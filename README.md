# The Money Website — Vercel Deployment Package

## What's in this folder

```
the-money-website-vercel/
├── index.html      ← the entire site (all 5 pages)
├── api/
│   └── grants.js   ← serverless function: live Grants.gov search proxy
└── README.md       ← this file
```

No build step, no frameworks, no command line needed. Vercel automatically
recognizes `index.html` as the site and anything in `api/` as serverless
functions.

## No API key is required

This site makes zero calls to the Anthropic/Claude API. The Grant Draft
Generator, AI Feedback Coach, and Improve Draft features are template-based
demos that run entirely in the browser. The only external call is to
Grants.gov's public search API, which requires no key.

You do NOT need to set the ANTHROPIC_API_KEY environment variable.

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
