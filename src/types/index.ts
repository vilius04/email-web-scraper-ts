/**
 * Core types for the web scraper
 */

export interface ScrapedEmail {
  email: string;
  source: string;
  context?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  confidence?: number;
  department?: string;
  gitHubUsername?: string;
  company?: string;
  website?: string;
}

export interface ScrapeOptions {
  maxPages?: number;
  useGitHub?: boolean;
  usePuppeteer?: boolean;
  onProgress?: (current: number, total: number) => void;
}

export interface ScrapeResult {
  domain: string;
  emails: ScrapedEmail[];
  pagesScraped: number;
  githubEmailsFound: number;
  socialProfiles?: SocialProfiles;
  timestamp: Date;
}

export interface SocialProfiles {
  linkedin?: string[];
  twitter?: string[];
  github?: string[];
  facebook?: string[];
}

export interface GitHubMember {
  login: string;
  name?: string;
  email?: string;
  company?: string;
  bio?: string;
  blog?: string;
  location?: string;
  avatar_url?: string;
  html_url?: string;
}

export interface EmailPattern {
  pattern: string;
  confidence: number;
}
