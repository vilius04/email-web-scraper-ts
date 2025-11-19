import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Puppeteer-based web scraper
 * Uses a real browser to bypass bot detection
 */

let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance (singleton pattern)
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[Puppeteer] Launching browser...');
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    console.log('[Puppeteer] Browser launched');
  }
  return browserInstance;
}

/**
 * Configure page with anti-detection measures
 */
async function setupPage(page: Page): Promise<void> {
  // Set realistic viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Randomize user agent
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(randomUA);

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  // Override navigator properties to avoid detection
  await page.evaluateOnNewDocument(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Override the navigator.plugins property
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override the navigator.languages property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Add chrome property (use globalThis instead of window for TypeScript)
    (globalThis as any).chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = (globalThis as any).navigator.permissions.query;
    (globalThis as any).navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'granted' })
        : originalQuery(parameters);
  });
}

/**
 * Scrape a single page using Puppeteer
 */
export async function scrapePageWithBrowser(url: string): Promise<string> {
  let page;
  
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await setupPage(page);

    console.log(`[Puppeteer] Navigating to ${url}...`);

    // Navigate with timeout (optimized for speed)
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Faster than networkidle2
      timeout: 15000, // 15 second timeout
    });

    // Wait a bit for any JavaScript to execute
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get the full HTML content
    const html = await page.content();

    console.log(`[Puppeteer] ✅ Successfully scraped ${url} (${html.length} bytes)`);

    return html;
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[Puppeteer] ❌ Error scraping ${url}:`, errorMsg);
    
    // Close page on error to prevent resource leaks
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('[Puppeteer] Error closing page:', closeError);
      }
    }
    
    // Re-throw with more context
    throw new Error(`Puppeteer failed for ${url}: ${errorMsg}`);
  } finally {
    // Always try to close the page
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        // Ignore close errors in finally
      }
    }
  }
}

/**
 * Scrape multiple URLs using Puppeteer
 */
export async function scrapeMultiplePages(urls: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const url of urls) {
    try {
      const html = await scrapePageWithBrowser(url);
      results.set(url, html);

      // Random delay between requests (optimized: 500-1500ms instead of 2-4s)
      const delay = 500 + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`[Puppeteer] Failed to scrape ${url}`);
      // Continue with next URL
    }
  }

  return results;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    console.log('[Puppeteer] Closing browser...');
    await browserInstance.close();
    browserInstance = null;
  }
}

// Cleanup on process exit
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);

export default {
  scrapePageWithBrowser,
  scrapeMultiplePages,
  closeBrowser,
};
