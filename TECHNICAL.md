# 📘 Technical Documentation

Comprehensive technical guide for developers who want to understand, implement, or extend the web scraper.

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Core Components](#core-components)
3. [Email Extraction Techniques](#email-extraction-techniques)
4. [Person Information Extraction](#person-information-extraction)
5. [Confidence Scoring Algorithm](#confidence-scoring-algorithm)
6. [GitHub Integration](#github-integration)
7. [Puppeteer Implementation](#puppeteer-implementation)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling](#error-handling)
10. [API Reference](#api-reference)

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                    scrapeDomain()                        │
│                                                          │
│  1. Normalize domain & initialize state                 │
│  2. Scrape homepage → discover URLs                      │
│  3. Scrape discovered pages (up to maxPages)            │
│  4. Extract social profiles                              │
│  5. Optional: Scrape GitHub organization                 │
│  6. Calculate confidence scores                          │
│  7. Sort & return results                                │
└─────────────────────────────────────────────────────────┘
```

### Module Structure

```
web-scraper/
├── src/
│   ├── index.ts                    # Main exports
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── services/
│       ├── web-scraper.service.ts  # Main orchestrator
│       ├── enhanced-scraper.service.ts  # Advanced extraction
│       ├── github-scraper.service.ts    # GitHub integration
│       └── puppeteer-scraper.service.ts # Browser automation
└── examples/
    ├── basic-usage.ts              # Simple examples
    └── cli.ts                      # CLI interface
```

---

## Core Components

### 1. Web Scraper Service (`web-scraper.service.ts`)

**Purpose**: Main orchestration layer that coordinates all scraping activities.

**Key Functions:**

#### `scrapeDomain(domain: string, options?: ScrapeOptions): Promise<ScrapeResult>`

Main entry point that:
1. Normalizes domain
2. Scrapes homepage and discovers URLs
3. Scrapes additional pages up to `maxPages`
4. Extracts social profiles
5. Optionally scrapes GitHub
6. Calculates confidence scores
7. Returns consolidated results

**Implementation Details:**

```typescript
// URL Queue Management
const scrapedUrls = new Set<string>();  // Track visited URLs
const urlQueue: string[] = [];           // URLs to visit
const emailMap = new Map<string, ScrapedEmail>(); // Dedup emails

// Process each page
for (let i = 0; i < pagesToScrape.length; i++) {
  const pageResult = await scrapePage(url, normalizedDomain, usePuppeteer);
  
  // Merge emails intelligently
  pageResult.emails.forEach((email) => {
    const existing = emailMap.get(email.email);
    if (!existing) {
      emailMap.set(email.email, email);
    } else {
      // Update with more complete information
      if (!existing.firstName && email.firstName) {
        existing.firstName = email.firstName;
      }
      // ... merge other fields
    }
  });
  
  // Rate limiting: 500-1500ms random delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
}
```

#### `scrapePage(url, targetDomain, usePuppeteer): Promise<{emails, urls}>`

Scrapes a single page:
1. Fetches HTML (axios or Puppeteer)
2. Extracts structured data (JSON-LD)
3. Extracts emails using enhanced regex
4. Extracts person information
5. Discovers internal URLs

#### `fetchPageHtml(url, usePuppeteer): Promise<string>`

Handles HTTP requests with automatic fallback:
- Try axios first (faster)
- On 403/429 → automatically switch to Puppeteer
- 10 second timeout for axios
- 20 second timeout for Puppeteer

---

### 2. Enhanced Scraper Service (`enhanced-scraper.service.ts`)

**Purpose**: Advanced email extraction and data mining techniques.

#### Technique 1: RFC 5322 Compliant Email Regex

```typescript
const rfc5322Regex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi;
```

**What it catches that simple regex misses:**
- Quoted strings: `"john.doe"@example.com`
- Plus addressing: `user+tag@example.com`
- IP addresses: `admin@[192.168.1.1]`
- Special characters: `user_name@example.com`

#### Technique 2: Obfuscated Email Detection

```typescript
// HTML entities: test&#64;example.com → test@example.com
const entityRegex = /([a-zA-Z0-9._%+-]+)&#64;([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

// Obfuscated: john [at] company [dot] com → john@company.com
const obfuscatedRegex = /\b([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|at)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|dot)\s*([a-zA-Z]{2,})\b/gi;

// mailto: links
const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

// Data attributes: data-email="john@company.com"
const dataAttrRegex = /data-[a-z-]*email[a-z-]*=["']([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi;
```

#### Technique 3: Structured Data Extraction

```typescript
// Parse JSON-LD
$('script[type="application/ld+json"]').each((_, element) => {
  const data = JSON.parse($(element).html());
  
  if (data['@type'] === 'Person') {
    emails.push({
      email: data.email,
      firstName: data.givenName,
      lastName: data.familyName,
      jobTitle: data.jobTitle,
      confidence: 90, // High confidence for structured data
    });
  }
});
```

**Supported formats:**
- JSON-LD (schema.org)
- Microdata (itemprop)
- vCard/hCard
- Meta tags

#### Technique 4: Social Profile Discovery

Finds company social media profiles:

```typescript
export function extractSocialProfiles(html: string): SocialProfiles {
  // Scan all links
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    
    if (href.includes('linkedin.com/in/') || href.includes('linkedin.com/company/')) {
      profiles.linkedin.add(href);
    }
    // ... Twitter, GitHub, Facebook
  });
  
  // Check meta tags
  const twitterMeta = $('meta[name="twitter:site"]').attr('content');
  // ...
}
```

---

## Email Extraction Techniques

### 1. Multi-Regex Approach

**Why multiple regex patterns?**
- RFC 5322 is very accurate but computationally expensive
- Simple regex is fast but may miss edge cases
- Using both ensures maximum coverage

```typescript
export function extractEmailsEnhanced(html: string, text: string): string[] {
  const emails = new Set<string>();
  
  // RFC 5322 (accurate)
  const rfc5322Matches = [...html.match(rfc5322Regex), ...text.match(rfc5322Regex)];
  
  // Simple regex (fast fallback)
  const simpleMatches = [...html.match(simpleRegex), ...text.match(simpleRegex)];
  
  // Combine results
  [...rfc5322Matches, ...simpleMatches].forEach(email => emails.add(email.toLowerCase()));
  
  return filterFalsePositives(Array.from(emails));
}
```

### 2. False Positive Filtering

Common false positives to filter out:

```typescript
const filtered = emails.filter(email => {
  const lower = email.toLowerCase();
  return (
    !lower.endsWith('.png') &&      // Image files
    !lower.endsWith('.jpg') &&
    !lower.includes('example.com') && // Placeholder emails
    !lower.includes('test@test') &&
    !lower.includes('your@email') &&
    lower.length > 5 &&              // Too short
    lower.length < 100               // Too long
  );
});
```

### 3. Context Extraction

For each email, extract surrounding text for analysis:

```typescript
const emailIndex = cleanText.indexOf(email);
const contextStart = Math.max(0, emailIndex - 200);
const contextEnd = Math.min(cleanText.length, emailIndex + 200);
const context = cleanText.substring(contextStart, contextEnd).trim();
```

**Why 200 characters?**
- Large enough to capture names, titles, and descriptions
- Small enough to be performant
- Tested empirically for best results

---

## Person Information Extraction

### Job Title Detection

**50+ job title patterns** organized by category:

```typescript
const titlePatterns = [
  // C-Suite (highest priority)
  /\b(CEO|CTO|CFO|COO|CMO|CPO|CDO|CIO)\b/i,
  /\b(Chief\s+(?:Executive|Technology|Financial|Operating|Marketing|Product|Data|Information)\s+Officer)\b/i,
  
  // VP and Directors
  /\b(Vice\s+President|VP|SVP|EVP|Director|Senior\s+Director|Managing\s+Director)\b/i,
  
  // Managers and Leads
  /\b(Manager|Senior\s+Manager|Engineering\s+Manager|Product\s+Manager|Team\s+Lead)\b/i,
  
  // Technical roles
  /\b(Senior\s+)?(?:Software|Frontend|Backend|Full[- ]?Stack|DevOps)\s+(?:Engineer|Developer)\b/i,
  
  // ... more patterns
];

for (const pattern of titlePatterns) {
  const match = context.match(pattern);
  if (match) {
    result.jobTitle = match[0].trim();
    break; // Stop at first match
  }
}
```

### Name Extraction

**Multiple patterns for different name formats:**

```typescript
const namePatterns = [
  // Standard: "John Smith"
  /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/,
  
  // With middle initial: "John M. Smith"
  /\b([A-Z][a-z]{1,20})\s+[A-Z]\.\s+([A-Z][a-z]{1,20})\b/,
  
  // Hyphenated: "Mary-Jane Smith"
  /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]+-[A-Z][a-z]+)\b/,
  
  // Apostrophe: "John O'Brien"
  /\b([A-Z][a-z]{1,20})\s+([A-Z]'[A-Z][a-z]+)\b/,
];
```

**False positive prevention:**

```typescript
const skipWords = ['The', 'This', 'That', 'With', 'From', 'Your', 'About'];
if (!skipWords.includes(firstName) && !skipWords.includes(lastName)) {
  result.firstName = firstName;
  result.lastName = lastName;
}
```

---

## Confidence Scoring Algorithm

### Scoring Factors

```typescript
export function calculateConfidenceScore(email: ScrapedEmail, domain: string): number {
  let confidence = 50; // Base score
  
  // FACTOR 1: Personal Information (+25 max)
  if (email.firstName && email.lastName) confidence += 25;
  else if (email.firstName || email.lastName) confidence += 10;
  
  // FACTOR 2: Job Title (+25 max)
  if (email.jobTitle) {
    confidence += 15;
    
    // Bonus for executives
    const executiveKeywords = ['ceo', 'cto', 'cfo', 'founder', 'vp', 'director'];
    if (executiveKeywords.some(k => email.jobTitle.toLowerCase().includes(k))) {
      confidence += 10;
    }
  }
  
  // FACTOR 3: Email Pattern Analysis (+10 / -30)
  const localPart = email.email.split('@')[0].toLowerCase();
  
  // Generic emails (info@, contact@) get penalty
  const genericPatterns = ['info', 'contact', 'admin', 'support', 'sales'];
  if (genericPatterns.some(p => localPart === p)) {
    confidence -= 30;
  } else if (genericPatterns.some(p => localPart.startsWith(p))) {
    confidence -= 15;
  }
  
  // Personal format bonus (firstname.lastname)
  if (localPart.includes('.') || localPart.includes('_')) {
    confidence += 10;
  }
  
  // FACTOR 4: Source Reliability (+15)
  if (email.source === 'JSON-LD' || email.source === 'structured-data') {
    confidence += 15;
  }
  
  // FACTOR 5: Context Quality (+5)
  if (email.context && email.context.length > 50) {
    confidence += 5;
  }
  
  // FACTOR 6: Domain Match (+10)
  const emailDomain = email.email.split('@')[1];
  if (emailDomain === domain) {
    confidence += 10;
  }
  
  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, confidence));
}
```

### Score Interpretation

| Score Range | Quality | Description |
|-------------|---------|-------------|
| 90-100 | Excellent ⭐⭐⭐⭐⭐ | Full name + title + personal email |
| 70-89 | Good ⭐⭐⭐⭐ | Partial info + personal email pattern |
| 50-69 | Fair ⭐⭐⭐ | Limited info or role-based email |
| 30-49 | Low ⭐⭐ | Generic prefix or minimal context |
| 0-29 | Very Low ⭐ | Generic catch-all addresses |

---

## GitHub Integration

### Finding Organizations

**Tries multiple patterns:**

```typescript
const possibleOrgs = [
  domainWithoutTld,                    // "stripe" from "stripe.com"
  companyName?.toLowerCase().replace(/\s+/g, '-'), // "Acme Corp" → "acme-corp"
  companyName?.toLowerCase().replace(/\s+/g, ''),  // "Acme Corp" → "acmecorp"
  `${domainWithoutTld}hq`,            // "stripehq"
  `${domainWithoutTld}-inc`,          // "stripe-inc"
];

for (const orgName of possibleOrgs) {
  const response = await axios.get(`https://api.github.com/orgs/${orgName}`);
  if (response.status === 200) return orgName;
}
```

### Email Discovery Strategy

**Two-phase approach:**

1. **Check public profile emails:**
```typescript
const userResponse = await axios.get(`https://api.github.com/users/${username}`);
const email = userResponse.data.email; // May be null
```

2. **Search recent commits:**
```typescript
const events = await axios.get(`https://api.github.com/users/${username}/events/public`);

for (const event of events) {
  if (event.type === 'PushEvent') {
    for (const commit of event.payload.commits) {
      if (commit.author?.email && !commit.author.email.includes('noreply.github.com')) {
        return commit.author.email; // Found it!
      }
    }
  }
}
```

### Rate Limiting

**GitHub API Limits:**
- Unauthenticated: 60 requests/hour
- Authenticated: 5,000 requests/hour

**Built-in protection:**
```typescript
// 1 second delay between member fetches
await new Promise(resolve => setTimeout(resolve, 1000));

// Check for rate limit errors
if (error.response?.status === 403) {
  console.warn('GitHub API rate limit reached');
  break; // Stop gracefully
}
```

**Check remaining quota:**
```typescript
import { checkRateLimit } from './src';

const rateLimit = await checkRateLimit();
console.log(`Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
console.log(`Resets at: ${rateLimit.reset}`);
```

---

## Puppeteer Implementation

### Anti-Detection Measures

**1. Realistic User Agents:**
```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...',
];
await page.setUserAgent(randomUA);
```

**2. Hide Automation Flags:**
```typescript
await page.evaluateOnNewDocument(() => {
  // Override webdriver flag
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
  });
  
  // Add chrome object
  (globalThis as any).chrome = { runtime: {} };
  
  // Override plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });
});
```

**3. Browser Arguments:**
```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled', // Hide automation
    '--window-size=1920,1080',
  ],
});
```

### Performance Optimization

**Fast page loading:**
```typescript
await page.goto(url, {
  waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
  timeout: 15000,
});

// Short delay for JS execution
await new Promise(resolve => setTimeout(resolve, 500));
```

**Resource Management:**
```typescript
try {
  // ... scraping logic
} finally {
  // Always close page to prevent memory leaks
  if (page) {
    await page.close();
  }
}

// Cleanup on process exit
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
```

---

## Performance Optimization

### 1. Intelligent URL Discovery

**Prioritize relevant pages:**

```typescript
const teamKeywords = [
  'about', 'team', 'people', 'staff', 'leadership',  // High priority
  'contact', 'careers', 'press',                     // Medium priority
  'company', 'advisors',                             // Low priority
];

// Check if URL or link text contains keywords
const hasKeyword = teamKeywords.some(keyword => 
  path.includes(keyword) || linkText.includes(keyword)
);
```

**Benefits:**
- Focuses on pages likely to have emails
- Avoids wasting time on irrelevant pages
- Improves email-to-page ratio

### 2. Request Optimization

**Parallel processing where possible:**
```typescript
// ✅ Good: Parallel operations
const [homepage, socialProfiles] = await Promise.all([
  fetchPageHtml(baseUrl),
  extractSocialProfiles(html),
]);

// ❌ Bad: Sequential (slower)
const homepage = await fetchPageHtml(baseUrl);
const socialProfiles = await extractSocialProfiles(html);
```

**Smart delays:**
```typescript
// Random delay: 500-1500ms (avoids detection patterns)
const delay = 500 + Math.random() * 1000;
await new Promise(resolve => setTimeout(resolve, delay));
```

### 3. Email Deduplication

**Use Map for O(1) lookups:**

```typescript
const emailMap = new Map<string, ScrapedEmail>();

// Adding emails
pageResult.emails.forEach((email) => {
  const existing = emailMap.get(email.email);
  if (!existing) {
    emailMap.set(email.email, email);
  } else {
    // Merge information intelligently
    if (!existing.firstName && email.firstName) {
      existing.firstName = email.firstName;
    }
  }
});

// Convert back to array
const emails = Array.from(emailMap.values());
```

### 4. Timeout Management

**Prevent hanging requests:**

```typescript
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// Usage
const result = await withTimeout(
  scrapePage(url),
  30000,
  'Page scraping timeout'
);
```

---

## Error Handling

### Graceful Degradation

**Never let one failure stop the entire scrape:**

```typescript
for (const url of urls) {
  try {
    const pageResult = await scrapePage(url);
    // ... process results
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    // Continue with next URL
    continue;
  }
}
```

### Automatic Fallbacks

**axios → Puppeteer cascade:**

```typescript
async function fetchPageHtml(url: string, usePuppeteer = false): Promise<string> {
  if (usePuppeteer) {
    return await scrapePageWithBrowser(url);
  }
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    // Auto-fallback on 403/429
    if (error.response?.status === 403 || error.response?.status === 429) {
      console.log('Falling back to Puppeteer...');
      return await scrapePageWithBrowser(url);
    }
    throw error;
  }
}
```

### User-Friendly Error Messages

```typescript
try {
  await getOrgMembers(orgName);
} catch (error) {
  if (error.response?.status === 403) {
    throw new Error('GitHub API rate limit exceeded. Try again in an hour.');
  } else if (error.response?.status === 404) {
    throw new Error(`GitHub organization ${orgName} not found`);
  }
  throw error;
}
```

---

## API Reference

### Main Functions

#### `scrapeDomain(domain, options?)`

**Parameters:**
- `domain` (string): Domain to scrape (e.g., "example.com")
- `options` (ScrapeOptions): Configuration options
  - `maxPages` (number): Maximum pages to scrape (default: 25)
  - `useGitHub` (boolean): Enable GitHub scraping (default: true)
  - `usePuppeteer` (boolean): Force Puppeteer usage (default: false)
  - `onProgress` (function): Progress callback `(current, total) => void`

**Returns:** `Promise<ScrapeResult>`

**Example:**
```typescript
const result = await scrapeDomain('stripe.com', {
  maxPages: 15,
  useGitHub: true,
  onProgress: (current, total) => {
    console.log(`${current}/${total} pages scraped`);
  },
});
```

---

#### `scrapeGitHubOrg(domain, companyName?, maxMembers?)`

**Parameters:**
- `domain` (string): Company domain
- `companyName` (string, optional): Company name for org search
- `maxMembers` (number): Max members to fetch (default: 30)

**Returns:** `Promise<ScrapedEmail[]>`

**Example:**
```typescript
const githubEmails = await scrapeGitHubOrg('stripe.com', 'Stripe', 50);
```

---

#### `checkRateLimit()`

**Returns:** `Promise<{limit, remaining, reset}>`

**Example:**
```typescript
const rateLimit = await checkRateLimit();
console.log(`Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
console.log(`Resets at: ${rateLimit.reset.toISOString()}`);
```

---

#### `closeBrowser()`

**Returns:** `Promise<void>`

**Example:**
```typescript
// Always call at the end
await closeBrowser();
```

---

### Advanced Functions

#### `extractEmailsEnhanced(html, text)`

Extract emails using all techniques (RFC 5322, obfuscated, structured data, etc.)

**Returns:** `string[]`

---

#### `extractPersonInfoEnhanced(context, html?)`

Extract first name, last name, and job title from text context.

**Returns:** `{firstName?, lastName?, jobTitle?}`

---

#### `extractStructuredData(html)`

Parse JSON-LD and Schema.org structured data.

**Returns:** `ScrapedEmail[]`

---

#### `extractSocialProfiles(html)`

Find social media profiles (LinkedIn, Twitter, GitHub, Facebook).

**Returns:** `{linkedin?, twitter?, github?, facebook?}`

---

#### `calculateConfidenceScore(email, domain)`

Calculate 0-100 confidence score for an email.

**Returns:** `number`

---

## Best Practices

### 1. Always Clean Up Resources

```typescript
try {
  const result = await scrapeDomain('example.com');
  // ... process results
} finally {
  await closeBrowser(); // Always close browser
}
```

### 2. Handle Progress Updates

```typescript
await scrapeDomain('example.com', {
  onProgress: (current, total) => {
    const percent = Math.round((current / total) * 100);
    process.stdout.write(`\rProgress: ${percent}%`);
  },
});
```

### 3. Filter Results by Confidence

```typescript
const result = await scrapeDomain('example.com');

// Only high-quality emails
const highQuality = result.emails.filter(e => e.confidence >= 70);

// Only emails with names
const withNames = result.emails.filter(e => e.firstName && e.lastName);

// Only executives
const executives = result.emails.filter(e => 
  e.jobTitle && /ceo|cto|founder|vp|director/i.test(e.jobTitle)
);
```

### 4. Implement Retry Logic

```typescript
async function scrapeWithRetry(domain: string, maxRetries = 3): Promise<ScrapeResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await scrapeDomain(domain);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 5. Export Results

```typescript
import * as fs from 'fs';

const result = await scrapeDomain('example.com');

// JSON
fs.writeFileSync('result.json', JSON.stringify(result, null, 2));

// CSV
const csv = [
  'Email,First Name,Last Name,Job Title,Confidence,Source',
  ...result.emails.map(e => 
    `${e.email},${e.firstName || ''},${e.lastName || ''},${e.jobTitle || ''},${e.confidence},${e.source}`
  )
].join('\n');
fs.writeFileSync('result.csv', csv);
```

---

## Performance Benchmarks

**Test Environment:**
- CPU: Intel i7-10700K
- RAM: 16GB
- Network: 100 Mbps

**Results (25 pages, GitHub enabled):**

| Domain | Pages | Emails | Time | Emails/sec |
|--------|-------|--------|------|------------|
| stripe.com | 25 | 18 | 52s | 0.35 |
| github.com | 25 | 23 | 48s | 0.48 |
| shopify.com | 25 | 15 | 61s | 0.25 |
| **Average** | **25** | **19** | **54s** | **0.36** |

**Key Findings:**
- ⚡ ~2 seconds per page average
- 📧 0.3-0.5 emails found per second
- 🎯 60-75% high-confidence emails (≥70)
- 🐙 GitHub adds 10-30% more emails

---

## Troubleshooting

### Issue: No emails found

**Possible causes:**
1. Site blocks scraping → Try `usePuppeteer: true`
2. No team pages → Increase `maxPages`
3. Site uses JavaScript rendering → Use Puppeteer
4. robots.txt blocks access → Check site's robots.txt

### Issue: GitHub rate limit

**Solution:**
```typescript
import { checkRateLimit } from './src';

const rateLimit = await checkRateLimit();
if (rateLimit.remaining < 10) {
  console.log(`Rate limit low, wait until ${rateLimit.reset}`);
}
```

### Issue: Low confidence scores

**Causes:**
- Mostly generic emails (info@, contact@)
- No names/titles in context
- Emails from non-person pages

**Solution:** Filter by confidence:
```typescript
const goodEmails = result.emails.filter(e => e.confidence >= 70);
```

---

## Contributing

Contributions welcome! Focus areas:

1. **New extraction techniques**
2. **Performance improvements**
3. **Better name/title detection**
4. **Additional social platforms**
5. **Bug fixes**

---

## License

MIT License - See LICENSE file for details.

---

**Questions?** Open an issue on GitHub!
