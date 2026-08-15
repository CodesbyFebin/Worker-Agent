#!/usr/bin/env node

/**
 * Merge All Open Pull Requests Script
 * 
 * Usage:
 *   node merge-all-prs.js
 * 
 * Prerequisites:
 *   1. Set GITHUB_TOKEN environment variable with a valid GitHub token
 *      export GITHUB_TOKEN=your_token_here
 *   2. Ensure the token has 'repo' and 'workflow' permissions
 */

const https = require('https');

const OWNER = 'Cyberteckmaster';
const REPO = 'Worker-Agent';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is not set');
  console.error('Please run: export GITHUB_TOKEN=your_github_token');
  process.exit(1);
}

/**
 * Make an HTTPS request to GitHub API
 */
function githubRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Node.js PR Merger',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Get all open pull requests
 */
async function getOpenPRs() {
  console.log('Fetching open pull requests...');
  
  const response = await githubRequest(
    'GET',
    `/repos/${OWNER}/${REPO}/pulls?state=open&per_page=100`
  );

  if (response.status !== 200) {
    throw new Error(`Failed to fetch PRs: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

/**
 * Merge a single pull request
 */
async function mergePR(prNumber, title) {
  const body = {
    merge_method: 'merge' // Options: 'merge', 'squash', 'rebase'
  };

  const response = await githubRequest(
    'PUT',
    `/repos/${OWNER}/${REPO}/pulls/${prNumber}/merge`,
    body
  );

  if (response.status === 200) {
    console.log(`✓ Merged PR #${prNumber}: ${title}`);
    return true;
  } else if (response.status === 405) {
    console.log(`⚠ Cannot merge PR #${prNumber}: ${response.data.message}`);
    return false;
  } else {
    console.log(`✗ Failed to merge PR #${prNumber}: ${response.status} - ${response.data.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const prs = await getOpenPRs();

    if (prs.length === 0) {
      console.log('No open pull requests found.');
      process.exit(0);
    }

    console.log(`Found ${prs.length} open pull request(s)\n`);
    console.log('Starting merge process...\n');

    let merged = 0;
    let failed = 0;

    for (const pr of prs) {
      try {
        const success = await mergePR(pr.number, pr.title);
        if (success) {
          merged++;
        } else {
          failed++;
        }
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`✗ Error merging PR #${pr.number}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Merge Summary:`);
    console.log(`  Total PRs: ${prs.length}`);
    console.log(`  Merged: ${merged}`);
    console.log(`  Failed: ${failed}`);
    console.log('='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
