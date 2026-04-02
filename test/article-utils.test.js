const test = require('node:test');
const assert = require('node:assert/strict');

const { getSafeArticleUrl, timeAgo } = require('../public/article-utils');

test('getSafeArticleUrl accepts http and https URLs', () => {
  assert.equal(getSafeArticleUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1');
  assert.equal(getSafeArticleUrl('http://example.com'), 'http://example.com/');
});

test('getSafeArticleUrl rejects dangerous or malformed URLs', () => {
  assert.equal(getSafeArticleUrl('javascript:alert(1)'), null);
  assert.equal(getSafeArticleUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(getSafeArticleUrl('/relative/path'), null);
  assert.equal(getSafeArticleUrl('not a url'), null);
  assert.equal(getSafeArticleUrl(''), null);
});

test('timeAgo renders seconds, minutes, hours, and days from a fixed time', () => {
  const now = Date.parse('2026-04-01T12:00:00.000Z');

  assert.equal(timeAgo('2026-04-01T11:59:45.000Z', now), '15s ago');
  assert.equal(timeAgo('2026-04-01T11:30:00.000Z', now), '30m ago');
  assert.equal(timeAgo('2026-04-01T09:00:00.000Z', now), '3h ago');
  assert.equal(timeAgo('2026-03-29T12:00:00.000Z', now), '3d ago');
});
