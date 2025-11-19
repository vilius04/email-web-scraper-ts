#!/usr/bin/env node

import { scrapeDomain, closeBrowser } from '../src';

/**
 * Simple CLI interface for the web scraper
 * Usage: ts-node examples/cli.ts <domain> [maxPages] [useGitHub]
 * Example: ts-node examples/cli.ts stripe.com 15 true
 */

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: ts-node examples/cli.ts <domain> [maxPages] [useGitHub]');
    console.log('Example: ts-node examples/cli.ts stripe.com 15 true');
    process.exit(1);
  }

  const domain = args[0];
  const maxPages = args[1] ? parseInt(args[1]) : 25;
  const useGitHub = args[2] ? args[2].toLowerCase() === 'true' : true;

  console.log(`\n🔍 Scraping ${domain}...`);
  console.log(`📄 Max pages: ${maxPages}`);
  console.log(`🐙 GitHub: ${useGitHub ? 'enabled' : 'disabled'}\n`);

  try {
    const result = await scrapeDomain(domain, {
      maxPages,
      useGitHub,
      onProgress: (current, total) => {
        process.stdout.write(`\rProgress: ${current}/${total} pages`);
      },
    });

    console.log('\n\n📊 === RESULTS ===\n');
    console.log(`Domain: ${result.domain}`);
    console.log(`Timestamp: ${result.timestamp.toISOString()}`);
    console.log(`Pages scraped: ${result.pagesScraped}`);
    console.log(`Total emails: ${result.emails.length}`);
    console.log(`GitHub emails: ${result.githubEmailsFound}`);

    // Social profiles
    if (result.socialProfiles) {
      const hasProfiles = Object.values(result.socialProfiles).some(p => p && p.length > 0);
      if (hasProfiles) {
        console.log('\n🔗 === SOCIAL PROFILES ===\n');
        if (result.socialProfiles.linkedin?.length) {
          console.log('LinkedIn:');
          result.socialProfiles.linkedin.forEach(url => console.log(`  - ${url}`));
        }
        if (result.socialProfiles.twitter?.length) {
          console.log('Twitter:');
          result.socialProfiles.twitter.forEach(url => console.log(`  - ${url}`));
        }
        if (result.socialProfiles.github?.length) {
          console.log('GitHub:');
          result.socialProfiles.github.forEach(url => console.log(`  - ${url}`));
        }
        if (result.socialProfiles.facebook?.length) {
          console.log('Facebook:');
          result.socialProfiles.facebook.forEach(url => console.log(`  - ${url}`));
        }
      }
    }

    // Emails
    console.log('\n📧 === EMAILS ===\n');
    
    if (result.emails.length === 0) {
      console.log('No emails found.');
    } else {
      result.emails.forEach((email, index) => {
        console.log(`${index + 1}. ${email.email}`);
        console.log(`   Confidence: ${email.confidence}%`);
        if (email.firstName || email.lastName) {
          console.log(`   Name: ${email.firstName || ''} ${email.lastName || ''}`.trim());
        }
        if (email.jobTitle) {
          console.log(`   Title: ${email.jobTitle}`);
        }
        if (email.gitHubUsername) {
          console.log(`   GitHub: @${email.gitHubUsername}`);
        }
        if (email.source) {
          console.log(`   Source: ${email.source}`);
        }
        console.log('');
      });
    }

    // Statistics
    console.log('📈 === STATISTICS ===\n');
    const highConfidence = result.emails.filter(e => (e.confidence || 0) >= 70).length;
    const withNames = result.emails.filter(e => e.firstName || e.lastName).length;
    const withTitles = result.emails.filter(e => e.jobTitle).length;
    
    console.log(`High confidence (≥70%): ${highConfidence}`);
    console.log(`With names: ${withNames}`);
    console.log(`With job titles: ${withTitles}`);
    
    // Export to JSON
    const outputFile = `${domain.replace(/[^a-z0-9]/gi, '_')}_emails.json`;
    const fs = require('fs');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 Results saved to: ${outputFile}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main();
