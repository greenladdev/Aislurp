const express = require('express');
const path = require('path');
const RssParser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

const rssParser = new RssParser({ timeout: 8000 });
const LIMIT = 5;

// ── Sources ───────────────────────────────────────────────────────────────────

async function fetchHackerNews() {
  const data = await safeFetch(
    `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=20&numericFilters=points%3E10&query=AI+LLM+machine+learning`,
  );

  const seen = new Set();
  const items = [];

  for (const hit of data.hits ?? []) {
    if (seen.has(hit.objectID) || !hit.title) continue;
    seen.add(hit.objectID);
    items.push({
      id: `hn-${hit.objectID}`,
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      description: `${hit.points ?? 0} points · ${hit.num_comments ?? 0} comments on Hacker News`,
      date: hit.created_at,
      source: 'Hacker News',
      sourceColor: '#ff6600',
    });
    if (items.length === LIMIT) break;
  }

  return items;
}

async function fetchDevTo() {
  const data = await safeFetch(
    `https://dev.to/api/articles?tag=ai&per_page=${LIMIT}`,
    { headers: { 'User-Agent': 'Aislurp/1.0 content aggregator' } },
  );

  return (data ?? []).slice(0, LIMIT).map(a => ({
    id: `devto-${a.id}`,
    title: a.title,
    url: a.url,
    description: a.description || `by ${a.user?.name ?? 'unknown'}`,
    date: a.published_at,
    source: 'Dev.to',
    sourceColor: '#0ea5e9',
  }));
}

async function fetchReddit(subreddit) {
  const data = await safeFetch(
    `https://www.reddit.com/r/${subreddit}/new.json?limit=10&raw_json=1`,
    { headers: { 'User-Agent': 'Aislurp/1.0 content aggregator' } },
  );

  return (data?.data?.children ?? [])
    .filter(p => !p.data.stickied)
    .slice(0, LIMIT)
    .map(p => {
      const post = p.data;
      const isExternal = post.url && !post.url.includes('reddit.com') && !post.is_self;
      const url = isExternal ? post.url : `https://www.reddit.com${post.permalink}`;
      const description = post.selftext?.length > 20
        ? post.selftext.slice(0, 220).trimEnd() + '…'
        : `${post.score.toLocaleString()} upvotes · ${post.num_comments} comments`;

      return {
        id: `reddit-${post.id}`,
        title: post.title,
        url,
        description,
        date: new Date(post.created_utc * 1000).toISOString(),
        source: `r/${subreddit}`,
        sourceColor: '#ff4500',
      };
    });
}

async function fetchLobsters() {
  const [ai, ml] = await Promise.allSettled([
    safeFetch('https://lobste.rs/t/ai.json'),
    safeFetch('https://lobste.rs/t/ml.json'),
  ]);

  const seen = new Set();
  const items = [];

  for (const r of [ai, ml]) {
    if (r.status !== 'fulfilled') continue;
    const sorted = [...r.value].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    for (const story of sorted) {
      if (seen.has(story.short_id) || !story.title) continue;
      seen.add(story.short_id);
      const rawDesc = story.description ? story.description.replace(/<[^>]+>/g, '') : '';
      items.push({
        id: `lobsters-${story.short_id}`,
        title: story.title,
        url: story.url || `https://lobste.rs/s/${story.short_id}`,
        description: rawDesc.length > 220 ? rawDesc.slice(0, 220).trimEnd() + '…'
          : rawDesc || `${story.score} points · ${story.comment_count} comments on Lobsters`,
        date: story.created_at,
        source: 'Lobsters',
        sourceColor: '#ac130d',
      });
      if (items.length === LIMIT) break;
    }
    if (items.length === LIMIT) break;
  }

  return items;
}

async function fetchRssFeed(url, source, color) {
  const feed = await rssParser.parseURL(url);
  const items = [];

  for (const item of feed.items ?? []) {
    const id = item.link || item.guid;
    if (!id || !item.title) continue;
    const rawDesc = (item.contentSnippet || item.summary || '').replace(/\n/g, ' ').trim();
    const date = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
    items.push({
      id: `rss-${source}-${id}`,
      title: item.title.replace(/\n/g, ' ').trim(),
      url: item.link,
      description: rawDesc.length > 220 ? rawDesc.slice(0, 220).trimEnd() + '…' : rawDesc,
      date,
      source,
      sourceColor: color,
    });
    if (items.length === LIMIT) break;
  }

  return items;
}

// ── API endpoint ──────────────────────────────────────────────────────────────

app.get('/api/articles', async (req, res) => {
  try {
    const results = await Promise.allSettled([
      fetchHackerNews(),
      fetchDevTo(),
      fetchReddit('MachineLearning'),
      fetchReddit('LocalLLaMA'),
      fetchReddit('artificial'),
      fetchReddit('vibecoding'),
      fetchReddit('singularity'),
      fetchReddit('ChatGPT'),
      fetchLobsters(),
      fetchRssFeed('https://export.arxiv.org/rss/cs.AI',                                'arXiv cs.AI',       '#b31b1b'),
      fetchRssFeed('https://export.arxiv.org/rss/cs.LG',                                'arXiv cs.LG',       '#b31b1b'),
      fetchRssFeed('https://openai.com/news/rss.xml',                                   'OpenAI',            '#10a37f'),
      fetchRssFeed('https://deepmind.google/blog/rss.xml',                              'Google DeepMind',   '#4285f4'),
      fetchRssFeed('https://research.google/blog/rss/',                                 'Google Research',   '#34a853'),
      fetchRssFeed('https://huggingface.co/blog/feed.xml',                              'Hugging Face',      '#ff9d00'),
      fetchRssFeed('https://blogs.nvidia.com/feed/',                                    'NVIDIA',            '#76b900'),
      fetchRssFeed('https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml',    'MIT News AI',       '#8b0000'),
      fetchRssFeed('https://techcrunch.com/category/artificial-intelligence/feed/',     'TechCrunch AI',     '#0a8a00'),
      fetchRssFeed('https://venturebeat.com/category/ai/feed/',                         'VentureBeat AI',    '#e31b23'),
      fetchRssFeed('https://the-decoder.com/feed/',                                     'The Decoder',       '#6366f1'),
      fetchRssFeed('https://developer.nvidia.com/blog/feed',                            'NVIDIA Dev',        '#76b900'),
      fetchRssFeed('https://machinelearning.apple.com/rss.xml',                         'Apple ML',          '#555555'),
      fetchRssFeed('https://www.microsoft.com/en-us/ai/blog/feed/',                     'Microsoft AI',      '#0078d4'),
      fetchRssFeed('https://qwenlm.github.io/blog/index.xml',                           'QwenLM',            '#7c3aed'),
    ]);

    // Flatten all results
    const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

    // Deduplicate by URL
    const seen = new Set();
    const unique = all.filter(a => {
      const key = a.url.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date, newest first
    unique.sort((a, b) => new Date(b.date) - new Date(a.date));

    const articles = unique.map(a => ({ ...a, timeAgo: timeAgo(a.date) }));

    res.json({ articles, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Aislurp  →  http://localhost:${PORT}\n`);
});
