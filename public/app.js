/* ── State ───────────────────────────────────────────────────────────────────── */
let allArticles = [];
let allVideos   = [];
let activeSource = 'all';
let activeVideoChannel = 'all';
let activeTab = 'articles';
let searchQuery = '';

/* ── DOM refs ────────────────────────────────────────────────────────────────── */
const grid             = document.getElementById('article-grid');
const statusText       = document.getElementById('status-text');
const fetchedAt        = document.getElementById('fetched-at');
const emptyState       = document.getElementById('empty-state');
const errorState       = document.getElementById('error-state');
const errorMsg         = document.getElementById('error-msg');
const refreshBtn       = document.getElementById('refresh-btn');
const refreshIcon      = document.getElementById('refresh-icon');
const searchInput      = document.getElementById('search');
const videoGrid        = document.getElementById('video-grid');
const videoEmptyState  = document.getElementById('video-empty-state');
const videoStatusText  = document.getElementById('video-status-text');
const articlesView     = document.getElementById('articles-view');
const videosView       = document.getElementById('videos-view');
const articleFiltersWrap = document.getElementById('article-filters-wrap');
const videoFiltersWrap   = document.getElementById('video-filters-wrap');
const { getSafeArticleUrl } = window.ArticleUtils;

/* ── Source badge styling ────────────────────────────────────────────────────── */
const SOURCE_STYLES = {
  'Hacker News':       { bg: 'rgba(255,102,0,0.12)',  color: '#ff8533', border: 'rgba(255,102,0,0.3)'  },
  'Dev.to':            { bg: 'rgba(14,165,233,0.12)', color: '#38bdf8', border: 'rgba(14,165,233,0.3)' },
  'Lobsters':          { bg: 'rgba(172,19,13,0.12)',  color: '#f87171', border: 'rgba(172,19,13,0.35)' },
  'arXiv':             { bg: 'rgba(179,27,27,0.12)',  color: '#fca5a5', border: 'rgba(179,27,27,0.35)' },
  'r/MachineLearning': { bg: 'rgba(255,69,0,0.12)',   color: '#ff6b35', border: 'rgba(255,69,0,0.3)'   },
  'r/LocalLLaMA':      { bg: 'rgba(255,69,0,0.12)',   color: '#ff6b35', border: 'rgba(255,69,0,0.3)'   },
  'r/artificial':      { bg: 'rgba(255,69,0,0.12)',   color: '#ff6b35', border: 'rgba(255,69,0,0.3)'   },
  'r/singularity':     { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  'r/ChatGPT':         { bg: 'rgba(16,163,127,0.12)', color: '#34d399', border: 'rgba(16,163,127,0.3)' },
  'r/vibecoding':      { bg: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: 'rgba(124,58,237,0.3)' },
};

function badgeStyle(article) {
  if (article.mediaType === 'video') {
    return 'background:rgba(255,0,0,0.12);color:#f87171;border-color:rgba(255,0,0,0.35)';
  }
  const s = SOURCE_STYLES[article.source] ?? { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'rgba(148,163,184,0.2)' };
  return `background:${s.bg};color:${s.color};border-color:${s.border}`;
}

/* ── Render ──────────────────────────────────────────────────────────────────── */
function createArticleLink(url, className, label) {
  const link = document.createElement('a');
  link.className = className;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  if (label) link.textContent = label;

  if (!url) {
    link.href = '#';
    link.setAttribute('aria-disabled', 'true');
    link.addEventListener('click', event => event.preventDefault());
    return link;
  }

  link.href = url;

  return link;
}

function renderCard(article) {
  const safeUrl = getSafeArticleUrl(article.url);
  const card = document.createElement('article');
  card.className = 'card';

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'source-badge';
  sourceBadge.style.cssText = badgeStyle(article);
  sourceBadge.textContent = article.source;

  const cardTime = document.createElement('span');
  cardTime.className = 'card-time';
  cardTime.textContent = article.timeAgo;

  meta.append(sourceBadge, cardTime);

  const title = document.createElement('h2');
  title.className = 'card-title';

  const titleLink = createArticleLink(safeUrl, '', article.title);
  title.appendChild(titleLink);

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const ctaLabel = article.mediaType === 'video' ? 'Watch video' : 'Read article';
  const readLink = createArticleLink(safeUrl, 'read-link', ctaLabel);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  icon.setAttribute('viewBox', '0 0 20 20');
  icon.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('d', 'M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm6.5-.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V6.56l-5.97 5.97a.75.75 0 0 1-1.06-1.06l5.97-5.97h-3.69a.75.75 0 0 1-.75-.75Z');
  path.setAttribute('clip-rule', 'evenodd');
  icon.appendChild(path);
  readLink.appendChild(document.createTextNode(' '));
  readLink.appendChild(icon);

  footer.appendChild(readLink);

  card.append(meta, title);

  if (article.thumbnail) {
    try {
      const thumbUrl = new URL(article.thumbnail);
      if (thumbUrl.protocol === 'https:' && ['i.ytimg.com', 'img.youtube.com'].includes(thumbUrl.hostname)) {
        const img = document.createElement('img');
        img.className = 'card-thumb';
        img.src = thumbUrl.href;
        img.alt = '';
        img.loading = 'lazy';
        card.appendChild(img);
      }
    } catch { /* invalid URL, skip */ }
  }

  if (article.description) {
    const desc = document.createElement('p');
    desc.className = 'card-desc';
    desc.textContent = article.description;
    card.appendChild(desc);
  }

  card.appendChild(footer);
  return card;
}

function applyFilters() {
  let filtered = allArticles;

  if (activeSource !== 'all') {
    filtered = filtered.filter(a => a.source === activeSource);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q),
    );
  }

  if (filtered.length) {
    grid.replaceChildren(...filtered.map(renderCard));
  } else {
    grid.replaceChildren();
  }

  emptyState.hidden = filtered.length > 0 || allArticles.length === 0;
  errorState.hidden = true;

  statusText.textContent = `Showing ${filtered.length} of ${allArticles.length} articles`;
}

/* ── Source filters ──────────────────────────────────────────────────────────── */
function buildSourceFilters() {
  const container = document.getElementById('source-filters');
  const sources = [...new Set(allArticles.map(a => a.source))].sort();

  // Remove all buttons except "All"
  container.querySelectorAll('.filter-btn:not([data-source="all"])').forEach(b => b.remove());

  for (const source of sources) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.source = source;
    btn.textContent = source;
    if (source === activeSource) btn.classList.add('active');
    container.appendChild(btn);
  }
}

/* ── Tab switching ───────────────────────────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;
  const isArticles = tab === 'articles';

  articlesView.hidden     = !isArticles;
  videosView.hidden       =  isArticles;
  articleFiltersWrap.hidden =  !isArticles;
  videoFiltersWrap.hidden   =  isArticles;

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
}

document.querySelector('.tab-bar').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (btn && btn.dataset.tab !== activeTab) switchTab(btn.dataset.tab);
});

/* ── Video filters ───────────────────────────────────────────────────────────── */
function buildVideoChannelFilters() {
  const container = document.getElementById('video-channel-filters');
  const channels = [...new Set(allVideos.map(v => v.source))].sort();

  container.querySelectorAll('.filter-btn:not([data-source="all"])').forEach(b => b.remove());

  for (const channel of channels) {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.source = channel;
    btn.textContent = channel;
    if (channel === activeVideoChannel) btn.classList.add('active');
    container.appendChild(btn);
  }
}

function applyVideoFilters() {
  let filtered = allVideos;

  if (activeVideoChannel !== 'all') {
    filtered = filtered.filter(v => v.source === activeVideoChannel);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(v =>
      v.title.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q),
    );
  }

  videoGrid.replaceChildren(...filtered.map(renderCard));
  videoEmptyState.hidden = filtered.length > 0 || allVideos.length === 0;
  videoStatusText.textContent = `${filtered.length} of ${allVideos.length} videos`;
}

/* ── Fetch ───────────────────────────────────────────────────────────────────── */
function showSkeletons() {
  grid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
  videoGrid.innerHTML = Array(3).fill('<div class="skeleton-card"></div>').join('');
  emptyState.hidden = true;
  errorState.hidden = true;
}

function setRefreshing(loading) {
  refreshBtn.disabled = loading;
  refreshIcon.classList.toggle('spinning', loading);
}

async function loadArticles() {
  showSkeletons();
  setRefreshing(true);
  statusText.textContent = 'Fetching latest articles…';
  fetchedAt.textContent = '';

  try {
    const res  = await fetch('/api/articles');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();

    const allItems = data.articles ?? [];
    allArticles = allItems.filter(a => a.mediaType !== 'video');
    allVideos   = allItems.filter(a => a.mediaType === 'video');

    const time = new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    fetchedAt.textContent = `Last updated ${time}`;

    buildSourceFilters();
    applyFilters();
    buildVideoChannelFilters();
    applyVideoFilters();
  } catch (err) {
    grid.innerHTML = '';
    emptyState.hidden = true;
    errorState.hidden = false;
    errorMsg.textContent = err.message || 'Could not load articles.';
    statusText.textContent = 'Error loading articles';
  } finally {
    setRefreshing(false);
  }
}

/* ── Event listeners ─────────────────────────────────────────────────────────── */
refreshBtn.addEventListener('click', loadArticles);
document.getElementById('error-retry').addEventListener('click', loadArticles);

document.getElementById('source-filters').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  document.querySelectorAll('#source-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeSource = btn.dataset.source;
  applyFilters();
});

document.getElementById('video-channel-filters').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  document.querySelectorAll('#video-channel-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeVideoChannel = btn.dataset.source;
  applyVideoFilters();
});

let searchTimer;
searchInput.addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    if (activeTab === 'articles') applyFilters();
    else applyVideoFilters();
  }, 200);
});

/* ── Boot ────────────────────────────────────────────────────────────────────── */
loadArticles();
