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

// HN gravity score: balances points vs age
function hnScore(points, createdAt) {
  const ageHours = (Date.now() - new Date(createdAt)) / 3_600_000;
  return points / Math.pow(ageHours + 2, 1.8);
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

// ── Sources ───────────────────────────────────────────────────────────────────

async function fetchHackerNews() {
  const queries = [
    'AI software engineering',
    'LLM agent',
    'vibe coding',
    'cursor AI coding',
    'AI code generation',
    'large language model',
    'GPT Claude Gemini',
    'AI developer tools',
  ];

  const results = await Promise.allSettled(
    queries.map(q =>
      safeFetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=8&numericFilters=points%3E15`,
      ),
    ),
  );

  const seen = new Set();
  const items = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const hit of r.value.hits ?? []) {
      if (seen.has(hit.objectID) || !hit.title) continue;
      seen.add(hit.objectID);

      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      items.push({
        id: `hn-${hit.objectID}`,
        title: hit.title,
        url,
        description: `${hit.points ?? 0} points · ${hit.num_comments ?? 0} comments on Hacker News`,
        date: hit.created_at,
        source: 'Hacker News',
        sourceColor: '#ff6600',
        score: hnScore(hit.points ?? 0, hit.created_at),
        engagement: hit.points ?? 0,
      });
    }
  }

  return items;
}

async function fetchDevTo() {
  const tags = ['ai', 'llm', 'machinelearning', 'aiengineering', 'chatgpt', 'claudeai'];

  const results = await Promise.allSettled(
    tags.map(tag =>
      safeFetch(`https://dev.to/api/articles?tag=${tag}&per_page=8&top=7`, {
        headers: { 'User-Agent': 'Aislurp/1.0 content aggregator' },
      }),
    ),
  );

  const seen = new Set();
  const items = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const article of r.value) {
      if (seen.has(article.id)) continue;
      seen.add(article.id);

      items.push({
        id: `devto-${article.id}`,
        title: article.title,
        url: article.url,
        description: article.description || `by ${article.user?.name ?? 'unknown'}`,
        date: article.published_at,
        source: 'Dev.to',
        sourceColor: '#0ea5e9',
        score: hnScore(
          (article.public_reactions_count ?? 0) + (article.comments_count ?? 0) * 3,
          article.published_at,
        ),
        engagement: (article.public_reactions_count ?? 0) + (article.comments_count ?? 0),
      });
    }
  }

  return items;
}

async function fetchReddit(subreddit) {
  const data = await safeFetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=20&raw_json=1`,
    { headers: { 'User-Agent': 'Aislurp/1.0 content aggregator' } },
  );

  return (data?.data?.children ?? [])
    .filter(p => !p.data.stickied && p.data.score > 10)
    .map(p => {
      const post = p.data;
      const isExternal = post.url && !post.url.includes('reddit.com') && !post.is_self;
      const url = isExternal ? post.url : `https://www.reddit.com${post.permalink}`;

      let description = '';
      if (post.selftext && post.selftext.length > 20) {
        description = post.selftext.length > 220
          ? post.selftext.slice(0, 220).trimEnd() + '…'
          : post.selftext;
      } else {
        description = `${post.score.toLocaleString()} upvotes · ${post.num_comments} comments`;
      }

      return {
        id: `reddit-${post.id}`,
        title: post.title,
        url,
        description,
        date: new Date(post.created_utc * 1000).toISOString(),
        source: `r/${subreddit}`,
        sourceColor: '#ff4500',
        score: hnScore(post.score, new Date(post.created_utc * 1000).toISOString()),
        engagement: post.score,
      };
    });
}

async function fetchLobsters() {
  // Lobsters AI + ML tags, sorted by hotness
  const [ai, ml] = await Promise.allSettled([
    safeFetch('https://lobste.rs/t/ai.json'),
    safeFetch('https://lobste.rs/t/ml.json'),
  ]);

  const seen = new Set();
  const items = [];

  for (const r of [ai, ml]) {
    if (r.status !== 'fulfilled') continue;
    for (const story of r.value) {
      if (seen.has(story.short_id) || !story.title) continue;
      seen.add(story.short_id);

      items.push({
        id: `lobsters-${story.short_id}`,
        title: story.title,
        url: story.url || `https://lobste.rs/s/${story.short_id}`,
        description: story.description
          ? story.description.replace(/<[^>]+>/g, '').slice(0, 220).trimEnd() + '…'
          : `${story.score} points · ${story.comment_count} comments on Lobsters`,
        date: story.created_at,
        source: 'Lobsters',
        sourceColor: '#ac130d',
        score: hnScore(story.score ?? 0, story.created_at),
        engagement: story.score ?? 0,
      });
    }
  }

  return items;
}

async function fetchArxiv() {
  const feeds = [
    'https://export.arxiv.org/rss/cs.AI',
    'https://export.arxiv.org/rss/cs.LG',
  ];

  const results = await Promise.allSettled(feeds.map(url => rssParser.parseURL(url)));

  const seen = new Set();
  const items = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value.items ?? []) {
      const id = item.link || item.guid;
      if (!id || seen.has(id) || !item.title) continue;
      seen.add(id);

      // arXiv titles sometimes have line breaks
      const title = item.title.replace(/\n/g, ' ').trim();
      // Strip HTML from description and truncate
      const rawDesc = (item.contentSnippet || item.summary || '').replace(/\n/g, ' ').trim();
      const description = rawDesc.length > 220 ? rawDesc.slice(0, 220).trimEnd() + '…' : rawDesc;

      items.push({
        id: `arxiv-${id}`,
        title,
        url: item.link,
        description,
        date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source: 'arXiv',
        sourceColor: '#b31b1b',
        // arXiv items don't have engagement scores; weight by recency only
        score: hnScore(5, item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()),
        engagement: 0,
      });
    }
  }

  return items;
}

// ── API endpoint ──────────────────────────────────────────────────────────────

app.get('/api/articles', async (req, res) => {
  try {
    const [hn, devto, ml, llama, artificial, vibecoding, singularity, chatgpt, lobsters, arxiv] =
      await Promise.allSettled([
        fetchHackerNews(),
        fetchDevTo(),
        fetchReddit('MachineLearning'),
        fetchReddit('LocalLLaMA'),
        fetchReddit('artificial'),
        fetchReddit('vibecoding'),
        fetchReddit('singularity'),
        fetchReddit('ChatGPT'),
        fetchLobsters(),
        fetchArxiv(),
      ]);

    const all = [
      ...(hn.status === 'fulfilled' ? hn.value : []),
      ...(devto.status === 'fulfilled' ? devto.value : []),
      ...(ml.status === 'fulfilled' ? ml.value : []),
      ...(llama.status === 'fulfilled' ? llama.value : []),
      ...(artificial.status === 'fulfilled' ? artificial.value : []),
      ...(vibecoding.status === 'fulfilled' ? vibecoding.value : []),
      ...(singularity.status === 'fulfilled' ? singularity.value : []),
      ...(chatgpt.status === 'fulfilled' ? chatgpt.value : []),
      ...(lobsters.status === 'fulfilled' ? lobsters.value : []),
      ...(arxiv.status === 'fulfilled' ? arxiv.value : []),
    ];

    // Deduplicate by URL
    const seenUrls = new Set();
    const unique = all.filter(a => {
      const key = a.url.replace(/[?#].*$/, '').replace(/\/$/, '');
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

    unique.sort((a, b) => b.score - a.score);

    const top30 = unique.slice(0, 30).map(a => ({
      ...a,
      timeAgo: timeAgo(a.date),
      score: undefined, // don't expose raw score
    }));

    res.json({ articles: top30, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Aislurp  →  http://localhost:${PORT}\n`);
});
