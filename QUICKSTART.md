# 🚀 Quick Start Guide

Get up and running with the web scraper in under 5 minutes!

## Installation

```bash
cd web-scraper
npm install
```

## Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

## Run Your First Scrape

### Option 1: Using the CLI

```bash
npm run example stripe.com
```

This will:
- Scrape up to 25 pages from stripe.com
- Extract emails with names and job titles
- Check GitHub for additional emails
- Save results to `stripe_com_emails.json`

### Option 2: Custom Script

Create a file `my-scraper.ts`:

```typescript
import { scrapeDomain, closeBrowser } from './src';

async function main() {
  try {
    const result = await scrapeDomain('example.com', {
      maxPages: 10,
      useGitHub: true,
    });
    
    console.log(`Found ${result.emails.length} emails!`);
    
    result.emails.forEach(email => {
      console.log(`${email.email} (${email.confidence}%)`);
    });
  } finally {
    await closeBrowser();
  }
}

main();
```

Run it:
```bash
ts-node my-scraper.ts
```

## Understanding Results

### Confidence Scores

- **90-100** ⭐⭐⭐⭐⭐: Excellent (full name + title + personal email)
- **70-89** ⭐⭐⭐⭐: Good (partial info + personal email)
- **50-69** ⭐⭐⭐: Fair (limited info or role-based)
- **30-49** ⭐⭐: Low (generic prefix)
- **0-29** ⭐: Very low (catch-all addresses)

### Filtering Results

```typescript
// Only high-confidence emails
const best = result.emails.filter(e => e.confidence >= 70);

// Only emails with names
const withNames = result.emails.filter(e => e.firstName && e.lastName);

// Only executives
const execs = result.emails.filter(e => 
  e.jobTitle && /ceo|cto|founder|vp|director/i.test(e.jobTitle)
);
```

## Common Options

```typescript
await scrapeDomain('example.com', {
  maxPages: 25,        // How many pages to scrape (default: 25)
  useGitHub: true,     // Search GitHub for more emails (default: true)
  usePuppeteer: false, // Use headless browser (default: false, auto-enabled if blocked)
  onProgress: (current, total) => {
    console.log(`Scraped ${current} of ${total} pages`);
  }
});
```

## When to Use Puppeteer

Set `usePuppeteer: true` if:
- Site blocks your requests (403/429 errors)
- Site heavily uses JavaScript
- You need maximum compatibility

**Note:** Puppeteer is slower but more reliable. The scraper automatically falls back to Puppeteer if needed.

## Export Results

### To JSON
```typescript
import * as fs from 'fs';
fs.writeFileSync('results.json', JSON.stringify(result, null, 2));
```

### To CSV
```typescript
const csv = [
  'Email,Name,Title,Confidence',
  ...result.emails.map(e => 
    `${e.email},"${e.firstName} ${e.lastName}",${e.jobTitle || ''},${e.confidence}`
  )
].join('\n');
fs.writeFileSync('results.csv', csv);
```

## Troubleshooting

### "No emails found"
- Try increasing `maxPages` to 50
- Set `usePuppeteer: true`
- Check if the site has a team/about page

### "GitHub rate limit exceeded"
```typescript
import { checkRateLimit } from './src';

const limit = await checkRateLimit();
console.log(`Remaining: ${limit.remaining}`);
console.log(`Resets: ${limit.reset}`);
```

Wait until the reset time, or use a GitHub token to get 5000 requests/hour.

### Site blocks scraping
- Set `usePuppeteer: true`
- Add longer delays (edit `web-scraper.service.ts`)
- Check the site's `robots.txt`

## Next Steps

- Read [README.md](README.md) for detailed features
- Read [TECHNICAL.md](TECHNICAL.md) for implementation details
- Check [examples/](examples/) for more code samples

## Need Help?

- Check existing issues on GitHub
- Open a new issue with:
  - Domain you're trying to scrape
  - Error message (if any)
  - Your configuration

---

**Happy Scraping! 🎉**
