# 🌐 Advanced Web Scraper

A powerful, production-ready email discovery tool that extracts business emails from websites and GitHub organizations. Built with TypeScript, featuring advanced extraction techniques and intelligent confidence scoring.

## ✨ Features

- **🎯 Multi-Source Scraping**: Extracts emails from web pages AND GitHub organizations
- **🧠 Smart Email Detection**: Uses RFC 5322 compliant regex + handles obfuscated emails
- **📊 Confidence Scoring**: Rates each email from 0-100 based on multiple factors
- **👤 Person Information**: Extracts names, job titles, and context
- **🏗️ Structured Data**: Parses JSON-LD and Schema.org markup
- **🔗 Social Discovery**: Finds LinkedIn, Twitter, GitHub, Facebook profiles
- **🤖 Bot Protection**: Automatic Puppeteer fallback for protected sites
- **⚡ Optimized Performance**: Intelligent page discovery and rate limiting

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Basic Usage

```typescript
import { scrapeDomain, closeBrowser } from './src';

const result = await scrapeDomain('example.com', {
  maxPages: 25,        // Maximum pages to scrape
  useGitHub: true,     // Enable GitHub scraping
  usePuppeteer: false, // Use headless browser (slower but bypasses blocks)
});

console.log(`Found ${result.emails.length} emails!`);

// Always close browser when done
await closeBrowser();
```

### CLI Usage

```bash
# Basic usage
npm run example stripe.com

# With custom options
ts-node examples/cli.ts stripe.com 15 true
```

## 📖 Examples

### Example 1: Basic Scraping

```typescript
import { scrapeDomain } from './src';

const result = await scrapeDomain('stripe.com', {
  maxPages: 10,
  onProgress: (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  },
});

// Filter high-confidence emails
const highQuality = result.emails.filter(e => e.confidence >= 70);
console.log(`Found ${highQuality.length} high-confidence emails`);
```

### Example 2: Find Executives

```typescript
const result = await scrapeDomain('company.com');

const executives = result.emails.filter(email => 
  email.jobTitle && 
  /ceo|cto|cfo|founder|president|director/i.test(email.jobTitle)
);

executives.forEach(exec => {
  console.log(`${exec.firstName} ${exec.lastName} - ${exec.jobTitle}`);
  console.log(`Email: ${exec.email}`);
});
```

### Example 3: Export to CSV

```typescript
import * as fs from 'fs';

const result = await scrapeDomain('example.com');

const csv = [
  'Email,First Name,Last Name,Job Title,Confidence',
  ...result.emails.map(e => 
    `${e.email},${e.firstName || ''},${e.lastName || ''},${e.jobTitle || ''},${e.confidence}`
  )
].join('\n');

fs.writeFileSync('emails.csv', csv);
```

## 📊 Result Format

```typescript
interface ScrapeResult {
  domain: string;
  emails: ScrapedEmail[];
  pagesScraped: number;
  githubEmailsFound: number;
  socialProfiles?: {
    linkedin?: string[];
    twitter?: string[];
    github?: string[];
    facebook?: string[];
  };
  timestamp: Date;
}

interface ScrapedEmail {
  email: string;           // The email address
  source: string;          // Where it was found
  confidence?: number;     // 0-100 confidence score
  firstName?: string;      // Extracted first name
  lastName?: string;       // Extracted last name
  jobTitle?: string;       // Job title if found
  context?: string;        // Text context around email
  gitHubUsername?: string; // GitHub username if from GitHub
}
```

## 🎯 Confidence Scoring

Each email receives a confidence score (0-100) based on:

- ✅ **+25**: Has first AND last name
- ✅ **+15**: Has job title
- ✅ **+10**: Executive role (CEO, CTO, Founder, etc.)
- ✅ **+15**: From structured data (JSON-LD)
- ✅ **+10**: Email pattern suggests personal (firstname.lastname)
- ❌ **-30**: Generic email (info@, contact@, support@)

**Example Scores:**
- `john.smith@company.com` + "John Smith, CEO" = **95** ⭐⭐⭐⭐⭐
- `developer@company.com` + "Jane Doe, Engineer" = **75** ⭐⭐⭐⭐
- `contact@company.com` = **20** ⭐

## 🔧 Configuration Options

```typescript
interface ScrapeOptions {
  maxPages?: number;        // Max pages to scrape (default: 25)
  useGitHub?: boolean;      // Enable GitHub scraping (default: true)
  usePuppeteer?: boolean;   // Use headless browser (default: false)
  onProgress?: (current: number, total: number) => void;
}
```

## 🐙 GitHub Integration

Automatically finds and scrapes company GitHub organizations:

- ✅ Extracts public emails from member profiles
- ✅ Searches recent commits for email addresses
- ✅ 100% legal - uses official GitHub API
- ⚠️ Rate limit: 60 requests/hour (unauthenticated)

## 🤖 Puppeteer Fallback

When sites block regular requests (403/429), the scraper automatically:

1. Switches to Puppeteer (headless Chrome)
2. Uses realistic user agents and headers
3. Implements anti-detection measures
4. Maintains same extraction quality

## 📈 Performance

**Typical Results:**
- ⚡ Speed: 25-60 seconds per domain
- 📧 Emails: 10-50 per domain (depends on site)
- 📄 Pages: 10-25 pages scraped
- 🎯 Quality: 50-80% high-confidence emails

**Best Performance:**
- Tech companies (often have team pages + GitHub)
- B2B companies (executive info readily available)
- Companies with structured data markup

## ⚖️ Legal & Ethical Use

### ✅ Legal
- Public website scraping (respect robots.txt)
- GitHub public API usage
- Structured data extraction

### ⚠️ Best Practices
- Add delays between requests (built-in)
- Respect rate limits (built-in)
- Use for legitimate business purposes only
- Comply with GDPR, CAN-SPAM, and local laws

### ❌ Prohibited
- Don't spam or harass
- Don't sell email lists
- Don't violate anti-scraping ToS

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run example
npm run dev

# Clean build
npm run clean
```

## 📝 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

**Vilius Brazdeikis**

## 🤝 Contributing

Contributions are welcome! This is a standalone tool extracted from a larger project. Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📚 More Information

For technical details, architecture, and advanced usage, see [TECHNICAL.md](TECHNICAL.md)

---

**⭐ If you find this useful, please star the repository!**
