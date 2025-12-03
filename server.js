import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3000;

// Helper functions
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makePlayerId(name) {
  return normalizeName(name).replace(/\s+/g, '-');
}

function buildConsensus(allSources) {
  const players = new Map();

  for (const row of allSources) {
    const key = normalizeName(row.displayName);

    if (!players.has(key)) {
      players.set(key, {
        playerId: makePlayerId(row.displayName),
        name: row.displayName,
        team: row.team || '',
        ranks: {},
      });
    }

    const entry = players.get(key);
    entry.ranks[row.source] = row.rank;
    if (!entry.team && row.team) entry.team = row.team;
  }

  const consensus = [];
  for (const p of players.values()) {
    const srcRanks = Object.values(p.ranks);
    const avg = srcRanks.reduce((a, b) => a + b, 0) / srcRanks.length;

    consensus.push({
      ...p,
      averageRank: avg,
      sources: srcRanks.length
    });
  }

  consensus.sort((a, b) => a.averageRank - b.averageRank);
  return consensus;
}

// Placeholder scrapers (we will fix selectors later)
async function scrapeCBS() {
  const url = 'https://www.cbssports.com/fantasy/football/rankings/ppr/WR/';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = [];

  $('table tbody tr').each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 3) return;

    const rankText = $(tds[0]).text().trim();
    const playerRaw = $(tds[1]).text().trim();
    const oppText = $(tds[2]).text().trim();

    const rank = parseInt(rankText, 10);
    if (isNaN(rank)) return;

    const teamMatch = oppText.match(/[A-Z]{2,3}/);
    const team = teamMatch ? teamMatch[0] : '';

    rows.push({
      source: 'cbs',
      rank,
      displayName: playerRaw,
      team
    });
  });

  return rows;
}

async function scrapeFantasyPros() {
  const rows = [];
  return rows; // placeholder until Step 4
}

async function scrapeESPN() {
  const rows = [];
  return rows; // placeholder until Step 4
}

// API route
app.get('/api/wr-consensus', async (req, res) => {
  try {
    const [cbs, fp, espn] = await Promise.all([
      scrapeCBS(),
      scrapeFantasyPros(),
      scrapeESPN()
    ]);

    const consensus = buildConsensus([...cbs, ...fp, ...espn]);
    res.json({ updatedAt: new Date().toISOString(), consensus });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Serve frontend later
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
