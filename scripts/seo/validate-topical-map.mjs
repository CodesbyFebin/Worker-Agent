import fs from 'node:fs/promises';

const path = new URL('../../docs/seo/TOPICAL_AUTHORITY_MAP.md', import.meta.url);
const source = await fs.readFile(path, 'utf8');
const lines = source.split(/\r?\n/);

const pillars = [];
let current = null;

for (const line of lines) {
  const pillarMatch = line.match(/^## P(\d{2}) — (.+)$/);
  if (pillarMatch) {
    current = {
      id: Number(pillarMatch[1]),
      title: pillarMatch[2].trim(),
      clusters: [],
    };
    pillars.push(current);
    continue;
  }

  if (!current) continue;
  if (/^##\s/.test(line)) {
    current = null;
    continue;
  }

  const clusterMatch = line.match(/^\d+\.\s+(.+)$/);
  if (clusterMatch) current.clusters.push(clusterMatch[1].trim());
}

const errors = [];

if (pillars.length !== 30) {
  errors.push(`Expected 30 pillars, found ${pillars.length}`);
}

for (let index = 0; index < pillars.length; index += 1) {
  const pillar = pillars[index];
  const expectedId = index + 1;
  if (pillar.id !== expectedId) {
    errors.push(`Expected pillar P${String(expectedId).padStart(2, '0')}, found P${String(pillar.id).padStart(2, '0')}`);
  }
  if (pillar.clusters.length !== 10) {
    errors.push(`P${String(pillar.id).padStart(2, '0')} ${pillar.title}: expected 10 clusters, found ${pillar.clusters.length}`);
  }
}

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const pillarKeys = new Set();
for (const pillar of pillars) {
  const key = normalize(pillar.title);
  if (pillarKeys.has(key)) errors.push(`Duplicate pillar title: ${pillar.title}`);
  pillarKeys.add(key);

  const clusterKeys = new Set();
  for (const cluster of pillar.clusters) {
    const clusterKey = normalize(cluster);
    if (clusterKeys.has(clusterKey)) {
      errors.push(`Duplicate cluster in P${String(pillar.id).padStart(2, '0')}: ${cluster}`);
    }
    clusterKeys.add(clusterKey);
  }
}

if (errors.length) {
  console.error('Topical authority map validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${pillars.length} pillars and ${pillars.reduce((sum, pillar) => sum + pillar.clusters.length, 0)} clusters.`);
console.log('Planning taxonomy only: validation does not grant publication or indexability.');
