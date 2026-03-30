/* ── State ───────────────────────────────────────────────────────────────────── */
let allArticles = [];
let activeSource = 'all';
let searchQuery = '';

/* ── DOM refs ────────────────────────────────────────────────────────────────── */
const grid        = document.getElementById('article-grid');
const statusText  = document.getElementById('status-text');
const fetchedAt   = document.getElementById('fetched-at');
const emptyState  = document.getElementById('empty-state');
const errorState  = document.getElementById('error-state');
const errorMsg    = document.getElementById('error-msg');
const refreshBtn  = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const searchInput = document.getElementById('search');

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

function badgeStyle(source) {
  const s = SOURCE_STYLES[source] ?? { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'rgba(148,163,184,0.2)' };
  return `background:${s.bg};color:${s.color};border-color:${s.border}`;
}

/* ── Render ──────────────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCard(article) {
  const title = escapeHtml(article.title);
  const desc  = escapeHtml(article.description || '');
  const url   = escapeHtml(article.url);
  const style = badgeStyle(article.source);

  return `
    <article class="card">
      <div class="card-meta">
        <span class="source-badge" style="${style}">${escapeHtml(article.source)}</span>
        <span class="card-time">${escapeHtml(article.timeAgo)}</span>
      </div>
      <h2 class="card-title">
        <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>
      </h2>
      ${desc ? `<p class="card-desc">${desc}</p>` : ''}
      <div class="card-footer">
        <a class="read-link" href="${url}" target="_blank" rel="noopener noreferrer">
          Read article
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm6.5-.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V6.56l-5.97 5.97a.75.75 0 0 1-1.06-1.06l5.97-5.97h-3.69a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/>
          </svg>
        </a>
      </div>
    </article>
  `;
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

  grid.innerHTML = filtered.length ? filtered.map(renderCard).join('') : '';

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

/* ── Fetch ───────────────────────────────────────────────────────────────────── */
function showSkeletons() {
  grid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
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

    allArticles = data.articles ?? [];

    const time = new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    fetchedAt.textContent = `Last updated ${time}`;

    buildSourceFilters();
    applyFilters();
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

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeSource = btn.dataset.source;
  applyFilters();
});

let searchTimer;
searchInput.addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    applyFilters();
  }, 200);
});

/* ── Boot ────────────────────────────────────────────────────────────────────── */
loadArticles();
