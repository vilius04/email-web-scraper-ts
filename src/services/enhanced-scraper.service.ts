import * as cheerio from 'cheerio';
import { URL } from 'url';
import { ScrapedEmail } from '../types';

/**
 * ENHANCEMENT 1: Advanced Email Extraction
 * Handles obfuscated emails, mailto links, and more patterns
 * Uses RFC 5322 compliant regex for maximum accuracy
 */
export function extractEmailsEnhanced(html: string, text: string): string[] {
  const emails = new Set<string>();

  // RFC 5322 compliant email regex (most accurate)
  const rfc5322Regex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi;
  
  // Simpler regex as fallback (faster, catches most common cases)
  const simpleRegex = /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}\b/g;
  
  // Extract from both HTML and text using both regexes
  const rfc5322Matches = [
    ...(html.match(rfc5322Regex) || []),
    ...(text.match(rfc5322Regex) || []),
  ];
  rfc5322Matches.forEach((email) => emails.add(email.toLowerCase()));
  
  // Also use simple regex to catch any edge cases
  const simpleMatches = [
    ...(html.match(simpleRegex) || []),
    ...(text.match(simpleRegex) || []),
  ];
  simpleMatches.forEach((email) => emails.add(email.toLowerCase()));

  // TECHNIQUE 1: Extract from mailto: links
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const mailtoMatches = html.match(mailtoRegex) || [];
  mailtoMatches.forEach((match) => {
    const email = match.replace(/mailto:/i, '').toLowerCase();
    emails.add(email);
  });

  // TECHNIQUE 2: Decode HTML entities (e.g., test&#64;example.com)
  const entityRegex = /([a-zA-Z0-9._%+-]+)&#64;([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const entityMatches = html.match(entityRegex) || [];
  entityMatches.forEach((match) => {
    const email = match.replace('&#64;', '@').toLowerCase();
    emails.add(email);
  });

  // TECHNIQUE 3: Find obfuscated emails (e.g., test [at] example [dot] com)
  const obfuscatedRegex = /\b([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|at)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|dot)\s*([a-zA-Z]{2,})\b/gi;
  const obfuscatedMatches = text.match(obfuscatedRegex) || [];
  obfuscatedMatches.forEach((match) => {
    const email = match
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*at\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*dot\s*/gi, '.')
      .toLowerCase();
    emails.add(email);
  });

  // TECHNIQUE 4: Find emails in data attributes
  const dataAttrRegex = /data-[a-z-]*email[a-z-]*=["']([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi;
  const dataAttrMatches = html.match(dataAttrRegex) || [];
  dataAttrMatches.forEach((match) => {
    const emailMatch = match.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      emails.add(emailMatch[1].toLowerCase());
    }
  });

  // Filter out common false positives
  const filtered = Array.from(emails).filter((email) => {
    const lower = email.toLowerCase();
    return (
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.jpeg') &&
      !lower.endsWith('.gif') &&
      !lower.endsWith('.svg') &&
      !lower.endsWith('.webp') &&
      !lower.includes('example.com') &&
      !lower.includes('sentry.io') &&
      !lower.includes('wixpress.com') &&
      !lower.includes('placeholder') &&
      !lower.includes('test@test') &&
      !lower.includes('email@email') &&
      !lower.includes('user@domain') &&
      !lower.includes('your@email') &&
      lower.length > 5 && // Minimum realistic email length
      lower.length < 100 // Maximum realistic email length
    );
  });

  return filtered;
}

/**
 * ENHANCEMENT 2: Advanced Person Info Extraction
 * Better name and title detection using multiple techniques
 */
export function extractPersonInfoEnhanced(context: string, html?: string): {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
} {
  const result: any = {};

  // TECHNIQUE 1: Expand title patterns
  const titlePatterns = [
    // C-Suite
    /\b(Chief\s+(?:Executive|Technology|Financial|Operating|Marketing|Product|Data|Information)\s+Officer|CEO|CTO|CFO|COO|CMO|CPO|CDO|CIO)\b/i,
    // VP and Directors
    /\b(Vice\s+President|VP|Senior\s+Vice\s+President|SVP|Executive\s+Vice\s+President|EVP|Director|Senior\s+Director|Managing\s+Director)\b/i,
    // Managers and Leads
    /\b(Manager|Senior\s+Manager|Engineering\s+Manager|Product\s+Manager|Project\s+Manager|Team\s+Lead|Tech\s+Lead|Lead|Head\s+of)\b/i,
    // Technical roles
    /\b(Senior\s+)?(?:Software|Frontend|Backend|Full[- ]?Stack|DevOps|Site\s+Reliability|Data|Machine\s+Learning|AI)\s+(?:Engineer|Developer|Architect|Scientist)\b/i,
    // Design roles
    /\b(Senior\s+)?(?:UX|UI|Product|Graphic|Visual)\s+Designer\b/i,
    // Other roles
    /\b(Founder|Co-Founder|President|Partner|Principal|Consultant|Advisor|Analyst|Specialist|Coordinator)\b/i,
  ];

  for (const pattern of titlePatterns) {
    const match = context.match(pattern);
    if (match) {
      result.jobTitle = match[0].trim();
      break;
    }
  }

  // TECHNIQUE 2: Enhanced name extraction with multiple patterns
  const namePatterns = [
    // Standard "FirstName LastName" pattern
    /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b/,
    // With middle initial: "FirstName M. LastName"
    /\b([A-Z][a-z]{1,20})\s+[A-Z]\.\s+([A-Z][a-z]{1,20})\b/,
    // Hyphenated names: "FirstName Last-Name"
    /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]+-[A-Z][a-z]+)\b/,
    // Names with apostrophes: "FirstName O'LastName"
    /\b([A-Z][a-z]{1,20})\s+([A-Z]'[A-Z][a-z]+)\b/,
  ];

  for (const pattern of namePatterns) {
    const nameMatch = context.match(pattern);
    if (nameMatch) {
      // Validate that these are likely real names (not common words)
      const firstName = nameMatch[1];
      const lastName = nameMatch[2];
      
      // Skip common false positives
      const skipWords = ['The', 'This', 'That', 'With', 'From', 'Your', 'About', 'More', 'Learn', 'Read'];
      if (!skipWords.includes(firstName) && !skipWords.includes(lastName)) {
        result.firstName = firstName;
        result.lastName = lastName;
        break;
      }
    }
  }

  // TECHNIQUE 3: Extract from structured data if HTML is provided
  if (html) {
    try {
      const $ = cheerio.load(html);
      
      // Check for Schema.org Person microdata
      const personData = $('[itemtype*="schema.org/Person"]');
      if (personData.length > 0) {
        const givenName = personData.find('[itemprop="givenName"]').text().trim();
        const familyName = personData.find('[itemprop="familyName"]').text().trim();
        const jobTitle = personData.find('[itemprop="jobTitle"]').text().trim();
        
        if (givenName) result.firstName = givenName;
        if (familyName) result.lastName = familyName;
        if (jobTitle) result.jobTitle = jobTitle;
      }

      // Check for vCard/hCard data
      const vcard = $('.vcard, .h-card');
      if (vcard.length > 0 && !result.firstName) {
        const name = vcard.find('.fn, .p-name').first().text().trim();
        const title = vcard.find('.title, .p-job-title').first().text().trim();
        
        if (name) {
          const nameParts = name.split(/\s+/);
          if (nameParts.length >= 2) {
            result.firstName = nameParts[0];
            result.lastName = nameParts[nameParts.length - 1];
          }
        }
        if (title) result.jobTitle = title;
      }
    } catch (error) {
      // Ignore cheerio errors
    }
  }

  return result;
}

/**
 * ENHANCEMENT 3: Extract structured data (JSON-LD, Schema.org)
 * Many modern sites include structured data that's easy to parse
 */
export function extractStructuredData(html: string): ScrapedEmail[] {
  const emails: ScrapedEmail[] = [];

  try {
    const $ = cheerio.load(html);

    // TECHNIQUE 1: Extract JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonContent = $(element).html();
        if (!jsonContent) return;

        const data = JSON.parse(jsonContent);
        
        // Handle arrays of structured data
        const items = Array.isArray(data) ? data : [data];
        
        items.forEach((item: any) => {
          // Check for Person type
          if (item['@type'] === 'Person' || item['@type']?.includes('Person')) {
            const email = item.email;
            if (email && typeof email === 'string' && email.includes('@')) {
              emails.push({
                email: email.toLowerCase(),
                source: 'JSON-LD',
                firstName: item.givenName,
                lastName: item.familyName,
                jobTitle: item.jobTitle,
                confidence: 90, // High confidence for structured data
              });
            }
          }

          // Check for Organization type (may have employee list)
          if (item['@type'] === 'Organization' || item['@type']?.includes('Organization')) {
            const orgEmail = item.email;
            if (orgEmail && typeof orgEmail === 'string' && orgEmail.includes('@')) {
              emails.push({
                email: orgEmail.toLowerCase(),
                source: 'JSON-LD',
                jobTitle: 'Organization',
                confidence: 85,
              });
            }

            // Check for employees
            const employees = item.employee || item.employees || [];
            const employeeList = Array.isArray(employees) ? employees : [employees];
            
            employeeList.forEach((emp: any) => {
              const empEmail = emp.email;
              if (empEmail && typeof empEmail === 'string' && empEmail.includes('@')) {
                emails.push({
                  email: empEmail.toLowerCase(),
                  source: 'JSON-LD',
                  firstName: emp.givenName,
                  lastName: emp.familyName,
                  jobTitle: emp.jobTitle,
                  confidence: 90,
                });
              }
            });
          }
        });
      } catch (parseError) {
        // Invalid JSON, skip
      }
    });

    // TECHNIQUE 2: Extract from meta tags
    const emailMeta = $('meta[property*="email"], meta[name*="email"]');
    emailMeta.each((_, element) => {
      const content = $(element).attr('content');
      if (content && content.includes('@')) {
        emails.push({
          email: content.toLowerCase(),
          source: 'meta-tag',
          confidence: 80,
        });
      }
    });

  } catch (error) {
    console.error('Error extracting structured data:', error);
  }

  return emails;
}

/**
 * ENHANCEMENT 4: Discover social media profiles
 * Find LinkedIn, Twitter, GitHub, etc.
 */
export function extractSocialProfiles(html: string): {
  linkedin?: string[];
  twitter?: string[];
  github?: string[];
  facebook?: string[];
} {
  const profiles: any = {
    linkedin: new Set<string>(),
    twitter: new Set<string>(),
    github: new Set<string>(),
    facebook: new Set<string>(),
  };

  try {
    const $ = cheerio.load(html);

    // Find all links
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const lower = href.toLowerCase();

      // LinkedIn profiles
      if (lower.includes('linkedin.com/in/') || lower.includes('linkedin.com/company/')) {
        profiles.linkedin.add(href);
      }

      // Twitter profiles
      if (lower.includes('twitter.com/') || lower.includes('x.com/')) {
        profiles.twitter.add(href);
      }

      // GitHub profiles
      if (lower.includes('github.com/') && !lower.includes('/gist/')) {
        profiles.github.add(href);
      }

      // Facebook profiles
      if (lower.includes('facebook.com/') && !lower.includes('/share')) {
        profiles.facebook.add(href);
      }
    });

    // Check for social media meta tags
    const linkedinMeta = $('meta[property="og:url"][content*="linkedin.com"]').attr('content');
    if (linkedinMeta) profiles.linkedin.add(linkedinMeta);

    const twitterMeta = $('meta[name="twitter:site"]').attr('content');
    if (twitterMeta) {
      profiles.twitter.add(`https://twitter.com/${twitterMeta.replace('@', '')}`);
    }

  } catch (error) {
    console.error('Error extracting social profiles:', error);
  }

  return {
    linkedin: Array.from(profiles.linkedin),
    twitter: Array.from(profiles.twitter),
    github: Array.from(profiles.github),
    facebook: Array.from(profiles.facebook),
  };
}

/**
 * ENHANCEMENT 5: Score emails based on multiple factors
 */
export function calculateConfidenceScore(email: ScrapedEmail, domain: string): number {
  let confidence = 50; // Base score

  // Factor 1: Has personal information
  if (email.firstName && email.lastName) {
    confidence += 25;
  } else if (email.firstName || email.lastName) {
    confidence += 10;
  }

  // Factor 2: Has job title
  if (email.jobTitle) {
    confidence += 15;
    
    // Higher scores for executive roles
    const executiveKeywords = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'president', 'vp', 'director'];
    if (executiveKeywords.some(keyword => email.jobTitle!.toLowerCase().includes(keyword))) {
      confidence += 10;
    }
  }

  // Factor 3: Email pattern analysis
  const localPart = email.email.split('@')[0].toLowerCase();
  
  // Generic emails get lower scores
  const genericPatterns = ['info', 'contact', 'admin', 'support', 'hello', 'sales', 'team', 'general'];
  if (genericPatterns.some((p) => localPart === p)) {
    confidence -= 30;
  } else if (genericPatterns.some((p) => localPart.startsWith(p))) {
    confidence -= 15;
  }

  // Personal-looking emails get higher scores
  if (localPart.includes('.') || localPart.includes('_')) {
    confidence += 10; // Likely firstname.lastname format
  }

  // Factor 4: Source reliability
  if (email.source === 'JSON-LD' || email.source === 'structured-data') {
    confidence += 15; // Structured data is very reliable
  }

  // Factor 5: Context quality
  if (email.context && email.context.length > 50) {
    confidence += 5; // Good context
  }

  // Factor 6: Domain match
  const emailDomain = email.email.split('@')[1];
  if (emailDomain === domain) {
    confidence += 10; // Matches target domain
  }

  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, confidence));
}

export default {
  extractEmailsEnhanced,
  extractPersonInfoEnhanced,
  extractStructuredData,
  extractSocialProfiles,
  calculateConfidenceScore,
};
