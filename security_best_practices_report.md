# Security Best Practices Report

## Executive Summary

This report was updated on April 1, 2026 after remediation work in the current branch. The previously identified findings in this repo have been addressed in application code: `/api/articles` now has in-process rate limiting and caching, the Express app now sets baseline hardening headers through `helmet`, and the server bootstrap now disables Express fingerprinting and defines terminal 404/error handlers.

I did not find any remaining critical or high-severity vulnerabilities in the code reviewed here. Residual risk remains around deployment-specific controls that are outside the repo, such as edge rate limiting, TLS termination, and runtime header verification.

## Remediated Findings

### 1. `/api/articles` fan-out abuse risk is reduced

- Rule ID: `EXPRESS-ABUSE-001`
- Status: Remediated in app code
- Location: `server.js`
- Remediation:
  - Added a per-client in-memory rate limiter for `/api/articles`
  - Added a 60-second in-memory response cache and shared in-flight fetch promise
  - Added `Cache-Control: public, max-age=60` on successful responses

### 2. Baseline browser hardening headers are now set

- Rule ID: `EXPRESS-HEADERS-001`
- Status: Remediated in app code
- Location: `server.js`
- Remediation:
  - Added `helmet()` early in the middleware stack
  - Added a CSP that limits scripts to self and explicitly allowlists the current Google Fonts dependencies
  - Added referrer policy and other Helmet defaults while leaving HSTS disabled for local/dev safety

### 3. Express fingerprinting reduction and terminal handlers are now present

- Rule ID: `EXPRESS-FINGERPRINT-001`
- Status: Remediated in app code
- Location: `server.js`
- Remediation:
  - Added `app.disable('x-powered-by')`
  - Added a JSON 404 handler
  - Added centralized error middleware with generic client-facing responses

## Informational

### 4. Client-side link sanitization remains in place

- Location: `public/article-utils.js`, `public/app.js`
- Assessment: The existing `getSafeArticleUrl()` validation still blocks non-HTTP(S) links before anchors are created.

### 5. Validation run after remediation

- `node --check server.js` passed on April 1, 2026
- `npm test` passed on April 1, 2026
