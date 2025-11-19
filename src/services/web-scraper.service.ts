import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import {
  extractEmailsEnhanced,
  extractPersonInfoEnhanced,
  extractStructuredData,
  extractSocialProfiles,
  calculateConfidenceScore,
} from './enhanced-scraper.service';
import { scrapeGitHubOrg } from './github-scraper.service';
import { scrapePageWithBrowser } from './puppeteer-scraper.service';
import { ScrapedEmail, ScrapeOptions, ScrapeResult } from '../types';

/**
 * Advanced Web Scraper
 * Features:
 * - Multi-source scraping (web pages + GitHub)
 * - Enhanced email extraction (RFC 5322, obfuscated emails, structured data)
 * - Person info extraction (names, job titles)
 * - Intelligent page discovery
 * - Confidence scoring
 * - Puppeteer fallback for protected sites
 */

/**
 * Utility function to add timeout to any promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Get random user agent
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get realistic headers
 */
function getRealisticHeaders() {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * Normalize domain (remove protocol, www, trailing slash)
 */
function getDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/$/, '')
    .split('/')[0];
}

/**
 * Normalize URL (ensure https://)
 */
function normalizeUrl(domain: string): string {
  return `https://${domain}`;
}

/**
 * Extract internal URLs from HTML
 */
function extractInternalUrls(html: string, baseUrl: string, targetDomain: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      // Handle relative and absolute URLs
      const resolvedUrl = new URL(href, baseUrl);
      
      // Only include URLs from the target domain
      if (resolvedUrl.hostname === targetDomain || resolvedUrl.hostname === `www.${targetDomain}`) {
        // Remove hash fragments
        resolvedUrl.hash = '';
        const cleanUrl = resolvedUrl.toString();
        
        // Filter out common non-page URLs
        if (
          !cleanUrl.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|ico|xml|json|zip|exe)$/i) &&
          !cleanUrl.includes('mailto:') &&
          !cleanUrl.includes('tel:')
        ) {
          urls.add(cleanUrl);
        }
      }
    } catch (error) {
      // Invalid URL, skip
    }
  });

  return Array.from(urls);
}

/**
 * Fetch page HTML (with fallback to Puppeteer)
 */
async function fetchPageHtml(url: string, usePuppeteer = false): Promise<string> {
  if (usePuppeteer) {
    return await withTimeout(scrapePageWithBrowser(url), 20000, 'Puppeteer timeout');
  }

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: getRealisticHeaders(),
      maxRedirects: 5,
    });
    return response.data;
  } catch (error: any) {
    // Fallback to Puppeteer on 403/429
    if (error.response?.status === 403 || error.response?.status === 429) {
      console.log(`[Scraper] Axios blocked (${error.response?.status}), falling back to Puppeteer...`);
      try {
        return await withTimeout(scrapePageWithBrowser(url), 20000, 'Puppeteer fallback timeout');
      } catch (puppeteerError: any) {
        console.error(`[Scraper] Puppeteer fallback also failed: ${puppeteerError.message}`);
        throw new Error(`Both axios and Puppeteer failed for ${url}`);
      }
    }
    throw error;
  }
}

/**
 * Scrape a single page with all enhancements
 * Returns emails and discovered URLs
 */
async function scrapePage(
  url: string,
  targetDomain: string,
  usePuppeteer = false
): Promise<{ emails: ScrapedEmail[], urls: string[] }> {
  try {
    const html = await fetchPageHtml(url, usePuppeteer);
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, noscript').remove();
    const cleanText = $.text();

    const results: ScrapedEmail[] = [];

    // Extract from structured data (JSON-LD, Schema.org)
    const structuredEmails = extractStructuredData(html);
    results.push(...structuredEmails);

    // Extract emails using enhanced regex
    const extractedEmails = extractEmailsEnhanced(html, cleanText);
    
    // Filter to target domain only
    const domainEmails = extractedEmails.filter((email) => {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      return emailDomain === targetDomain;
    });

    // Extract person info for each email
    domainEmails.forEach((email) => {
      // Skip if already in results from structured data
      if (results.some((r) => r.email === email)) return;

      // Find context around email
      const emailIndex = cleanText.indexOf(email);
      const contextStart = Math.max(0, emailIndex - 200);
      const contextEnd = Math.min(cleanText.length, emailIndex + 200);
      const context = cleanText.substring(contextStart, contextEnd).trim();

      const personInfo = extractPersonInfoEnhanced(context, html);

      results.push({
        email: email.toLowerCase(),
        source: url,
        context,
        ...personInfo,
      });
    });

    // Discover internal URLs
    const baseUrl = new URL(url).origin;
    const discoveredUrls = extractInternalUrls(html, baseUrl, targetDomain);

    return { emails: results, urls: discoveredUrls };

  } catch (error: any) {
    console.error(`[Scraper] Error scraping page ${url}:`, error.message);
    return { emails: [], urls: [] };
  }
}

/**
 * Main scraping function
 * Scrapes a domain for emails using multiple techniques
 */
export async function scrapeDomain(
  domain: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const {
    maxPages = 25,
    useGitHub = true,
    usePuppeteer = false,
    onProgress,
  } = options;

  const normalizedDomain = getDomain(domain);
  const baseUrl = normalizeUrl(normalizedDomain);
  const emailMap = new Map<string, ScrapedEmail>();
  let pagesScraped = 0;
  let githubEmailsFound = 0;
  
  // URL queue management
  const scrapedUrls = new Set<string>();
  const urlQueue: string[] = [];

  console.log(`\n[Scraper] 🚀 Starting scrape of ${domain} (max ${maxPages} pages)\n`);

  try {
    // STEP 1: Scrape homepage
    console.log('[Scraper] 📄 Scraping homepage...');
    const homepageResult = await scrapePage(baseUrl, normalizedDomain, usePuppeteer);
    homepageResult.emails.forEach((email) => emailMap.set(email.email, email));
    scrapedUrls.add(baseUrl);
    pagesScraped++;
    
    // Add discovered URLs to queue
    homepageResult.urls.forEach(url => {
      if (!scrapedUrls.has(url) && !urlQueue.includes(url)) {
        urlQueue.push(url);
      }
    });
    
    console.log(`[Scraper] ✓ Homepage: ${homepageResult.emails.length} emails, ${homepageResult.urls.length} URLs discovered\n`);

    // STEP 2: Scrape discovered pages (up to maxPages limit)
    const pagesToScrape = urlQueue.slice(0, maxPages - 1); // -1 because we already scraped homepage
    console.log(`[Scraper] 📚 Will scrape ${pagesToScrape.length} additional pages...\n`);
    
    for (let i = 0; i < pagesToScrape.length; i++) {
      const url = pagesToScrape[i];
      
      if (onProgress) {
        onProgress(i + 2, maxPages); // +2 because homepage is index 1
      }

      try {
        console.log(`[Scraper] [${i + 2}/${Math.min(pagesToScrape.length + 1, maxPages)}] Scraping: ${url}`);
        
        const pageResult = await withTimeout(
          scrapePage(url, normalizedDomain, usePuppeteer),
          30000, // 30 second timeout per page
          `Scraping timeout for ${url}`
        );
        
        scrapedUrls.add(url);
        
        // Merge emails
        pageResult.emails.forEach((email) => {
          const existing = emailMap.get(email.email);
          if (!existing) {
            emailMap.set(email.email, email);
          } else {
            // Update with more complete info
            if (!existing.firstName && email.firstName) existing.firstName = email.firstName;
            if (!existing.lastName && email.lastName) existing.lastName = email.lastName;
            if (!existing.jobTitle && email.jobTitle) existing.jobTitle = email.jobTitle;
          }
        });

        pagesScraped++;

        // Random delay (500-1500ms) between pages
        const delay = 500 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

      } catch (error: any) {
        console.error(`[Scraper] ❌ Error scraping ${url}:`, error.message || error);
        scrapedUrls.add(url);
        pagesScraped++;
      }
    }
    
    console.log(`\n[Scraper] ✅ Completed web scraping: ${pagesScraped} pages, ${emailMap.size} emails found\n`);

    // STEP 3: Extract social profiles from homepage
    const homepageHtml = await fetchPageHtml(baseUrl, usePuppeteer);
    const socialProfiles = extractSocialProfiles(homepageHtml);
    
    if (socialProfiles.linkedin?.length || socialProfiles.twitter?.length || 
        socialProfiles.github?.length || socialProfiles.facebook?.length) {
      console.log('[Scraper] 🔗 Social profiles found:');
      if (socialProfiles.linkedin?.length) console.log(`  - LinkedIn: ${socialProfiles.linkedin.length} profiles`);
      if (socialProfiles.twitter?.length) console.log(`  - Twitter: ${socialProfiles.twitter.length} profiles`);
      if (socialProfiles.github?.length) console.log(`  - GitHub: ${socialProfiles.github.length} profiles`);
      if (socialProfiles.facebook?.length) console.log(`  - Facebook: ${socialProfiles.facebook.length} profiles`);
      console.log('');
    }

    // STEP 4: Try GitHub if enabled
    if (useGitHub && socialProfiles.github && socialProfiles.github.length > 0) {
      console.log('[Scraper] 🐙 Checking GitHub for additional emails...\n');
      
      try {
        // Scrape GitHub org
        const githubEmails = await scrapeGitHubOrg(normalizedDomain, undefined, 30);
        
        githubEmails.forEach((email) => {
          if (!emailMap.has(email.email)) {
            emailMap.set(email.email, {
              ...email,
              confidence: 85,
            });
            githubEmailsFound++;
          }
        });

        console.log(`\n[Scraper] ✓ Found ${githubEmailsFound} additional emails from GitHub\n`);
      } catch (error: any) {
        console.warn('[Scraper] ⚠️  GitHub scraping failed:', error.message, '\n');
      }
    }

    // STEP 5: Calculate confidence scores
    const emails = Array.from(emailMap.values()).map((email) => ({
      ...email,
      confidence: email.confidence || calculateConfidenceScore(email, normalizedDomain),
    }));

    // Sort by confidence (highest first)
    emails.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    console.log('[Scraper] ✅ Scraping complete!');
    console.log(`[Scraper] 📊 Total emails: ${emails.length} (${githubEmailsFound} from GitHub)`);
    console.log(`[Scraper] 📄 Pages scraped: ${pagesScraped}\n`);

    return {
      domain: normalizedDomain,
      emails,
      pagesScraped,
      githubEmailsFound,
      socialProfiles,
      timestamp: new Date(),
    };

  } catch (error: any) {
    console.error('[Scraper] ❌ Fatal error:', error.message);
    throw error;
  }
}

export default {
  scrapeDomain,
};
