/**
 * Advanced Web Scraper
 * A powerful email discovery tool with multiple data sources
 * 
 * @author Vilius Brazdeikis
 * @license MIT
 */

export { scrapeDomain } from './services/web-scraper.service';
export { scrapeGitHubOrg, checkRateLimit } from './services/github-scraper.service';
export { closeBrowser } from './services/puppeteer-scraper.service';
export * from './types';

// Re-export enhanced scraper functions for advanced users
export {
  extractEmailsEnhanced,
  extractPersonInfoEnhanced,
  extractStructuredData,
  extractSocialProfiles,
  calculateConfidenceScore,
} from './services/enhanced-scraper.service';
