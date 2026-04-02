(function attachArticleUtils(globalScope) {
  function getSafeArticleUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  function timeAgo(dateStr, now = Date.now()) {
    const seconds = Math.floor((now - new Date(dateStr)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const articleUtils = {
    getSafeArticleUrl,
    timeAgo,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = articleUtils;
  }

  if (globalScope) {
    globalScope.ArticleUtils = articleUtils;
  }
})(typeof window !== 'undefined' ? window : globalThis);
