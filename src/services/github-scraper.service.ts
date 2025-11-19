import axios from 'axios';
import { ScrapedEmail, GitHubMember, EmailPattern } from '../types';

/**
 * GitHub Organization Member Scraper
 * Uses GitHub's public API - no authentication required for public data
 * Rate limit: 60 requests/hour for unauthenticated requests
 */

/**
 * Find GitHub organization from domain
 * Tries common patterns: company name, domain name, etc.
 */
export async function findGitHubOrg(domain: string, companyName?: string): Promise<string | null> {
  const domainWithoutTld = domain.split('.')[0]; // e.g., "stripe" from "stripe.com"
  
  // Try multiple possible organization names
  const possibleOrgs = [
    domainWithoutTld,
    companyName?.toLowerCase().replace(/\s+/g, '-'),
    companyName?.toLowerCase().replace(/\s+/g, ''),
    `${domainWithoutTld}hq`,
    `${domainWithoutTld}-inc`,
  ].filter(Boolean) as string[];

  for (const orgName of possibleOrgs) {
    try {
      const response = await axios.get(`https://api.github.com/orgs/${orgName}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Web-Scraper',
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        console.log(`✅ Found GitHub org: ${orgName}`);
        return orgName;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Org doesn't exist, try next
        continue;
      } else if (error.response?.status === 403) {
        console.warn('⚠️ GitHub API rate limit reached');
        return null;
      }
    }
  }

  return null;
}

/**
 * Get user's email from recent commits
 * Most users don't expose their email in profile, but it's visible in commits
 */
async function getUserEmailFromCommits(username: string): Promise<string | null> {
  try {
    // Get user's recent events (includes commit info)
    const response = await axios.get(`https://api.github.com/users/${username}/events/public`, {
      params: { per_page: 30 },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Web-Scraper',
      },
      timeout: 5000,
    });

    // Look for PushEvent which contains commit info with email
    for (const event of response.data) {
      if (event.type === 'PushEvent' && event.payload?.commits) {
        for (const commit of event.payload.commits) {
          if (commit.author?.email && 
              !commit.author.email.includes('noreply.github.com') &&
              !commit.author.email.includes('users.noreply.github.com')) {
            console.log(`  ✓ Found commit email for ${username}: ${commit.author.email}`);
            return commit.author.email;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get organization members from GitHub
 */
export async function getOrgMembers(orgName: string, maxMembers = 30): Promise<GitHubMember[]> {
  try {
    console.log(`[GitHub] Fetching members for org: ${orgName}`);

    const response = await axios.get(`https://api.github.com/orgs/${orgName}/members`, {
      params: {
        per_page: Math.min(maxMembers, 100), // GitHub max is 100 per page
      },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Web-Scraper',
      },
      timeout: 10000,
    });

    const members = response.data;
    console.log(`[GitHub] Found ${members.length} members`);

    // Get detailed info for each member (including email if public)
    const detailedMembers: GitHubMember[] = [];

    for (const member of members.slice(0, maxMembers)) {
      try {
        // Add delay to respect rate limits (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const userResponse = await axios.get(`https://api.github.com/users/${member.login}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Web-Scraper',
          },
          timeout: 5000,
        });

        const userData = userResponse.data;
        let email = userData.email;
        
        // If no public email, try to get from commits
        if (!email) {
          console.log(`  → No public email for ${userData.login}, checking commits...`);
          email = await getUserEmailFromCommits(userData.login);
        } else {
          console.log(`  ✓ Found public email for ${userData.login}: ${email}`);
        }

        detailedMembers.push({
          login: userData.login,
          name: userData.name,
          email: email,
          company: userData.company,
          bio: userData.bio,
          blog: userData.blog,
          location: userData.location,
          avatar_url: userData.avatar_url,
          html_url: userData.html_url,
        });

      } catch (userError: any) {
        if (userError.response?.status === 403) {
          console.warn('⚠️ GitHub API rate limit reached, stopping member fetch');
          break;
        }
        console.error(`Error fetching user ${member.login}:`, userError.message);
      }
    }

    return detailedMembers;

  } catch (error: any) {
    if (error.response?.status === 403) {
      console.error('❌ GitHub API rate limit exceeded');
      throw new Error('GitHub API rate limit exceeded. Try again in an hour.');
    } else if (error.response?.status === 404) {
      console.error(`❌ Organization ${orgName} not found`);
      throw new Error(`GitHub organization ${orgName} not found`);
    }
    throw error;
  }
}

/**
 * Parse name into firstName and lastName
 */
function parseName(fullName: string): { firstName?: string; lastName?: string } {
  if (!fullName || fullName.trim().length === 0) {
    return {};
  }

  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
  };
}

/**
 * Main function: Scrape emails from GitHub organization
 */
export async function scrapeGitHubOrg(
  domain: string,
  companyName?: string,
  maxMembers = 30
): Promise<ScrapedEmail[]> {
  try {
    // Step 1: Find the GitHub organization
    const orgName = await findGitHubOrg(domain, companyName);
    
    if (!orgName) {
      console.log(`[GitHub] No GitHub organization found for ${domain}`);
      return [];
    }

    // Step 2: Get organization members
    const members = await getOrgMembers(orgName, maxMembers);

    // Step 3: Extract emails and format results
    const results: ScrapedEmail[] = [];
    let publicEmailCount = 0;

    for (const member of members) {
      const { firstName, lastName } = parseName(member.name || '');
      
      // If member has public email, use it
      if (member.email && member.email.includes('@')) {
        publicEmailCount++;
        results.push({
          email: member.email.toLowerCase(),
          source: `github.com/${orgName}`,
          firstName,
          lastName,
          gitHubUsername: member.login,
          company: member.company || undefined,
          website: member.blog || undefined,
        });
      }
    }

    console.log(`[GitHub] Extracted ${results.length} emails from ${orgName}`);
    console.log(`[GitHub]   - ${publicEmailCount} public emails`);
    
    return results;

  } catch (error: any) {
    console.error('[GitHub] Error scraping organization:', error.message);
    return []; // Return empty array instead of throwing
  }
}

/**
 * Check rate limit status
 */
export async function checkRateLimit(): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  try {
    const response = await axios.get('https://api.github.com/rate_limit', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Web-Scraper',
      },
    });

    const { limit, remaining, reset } = response.data.rate;

    return {
      limit,
      remaining,
      reset: new Date(reset * 1000),
    };
  } catch (error) {
    throw new Error('Failed to check GitHub API rate limit');
  }
}

export default {
  findGitHubOrg,
  getOrgMembers,
  scrapeGitHubOrg,
  checkRateLimit,
};
