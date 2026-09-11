'use strict';
// A thin client over cobinar-dashboard-worker's real REST API — every
// call here hits an endpoint that already exists and is already used by
// the dashboard itself (see that project's README for the full list).
// dalus doesn't talk to Cloudflare directly and has no separate deploy
// mechanism of its own; it's a scriptable front door to the same API the
// web dashboard calls, nothing more.

class DalusApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

class ApiClient {
  constructor({ apiBase, token }) {
    if (!apiBase) throw new Error('apiBase is required (set it in your dalus config, or run "dalus login").');
    if (!token) throw new Error('Not logged in — run "dalus login" first.');
    this.apiBase = apiBase.replace(/\/$/, '');
    this.token = token;
  }

  async request(method, path, { body, headers, rawBody } = {}) {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    if (!res.ok) {
      const message = (parsed && typeof parsed === 'object' && parsed.error) || `${method} ${path} failed with ${res.status}`;
      throw new DalusApiError(message, res.status, parsed);
    }
    return parsed;
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, { body }); }
  patch(path, body) { return this.request('PATCH', path, { body }); }
  put(path, body) { return this.request('PUT', path, { body }); }
  delete(path) { return this.request('DELETE', path); }
  putRaw(path, rawBody, contentType) {
    return this.request('PUT', path, { rawBody, headers: contentType ? { 'content-type': contentType } : undefined });
  }

  // ---- find-or-create helpers ----
  // Every resource kind exposes a GET list + POST create, and every
  // create schema 400s on a duplicate name scoped the way that resource
  // scopes names (see each route file) — so "does this already exist"
  // is answered by listing and matching on name, not a dedicated
  // lookup-by-name endpoint (none of these APIs have one).

  async findByName(listPath, name) {
    const rows = await this.get(listPath);
    return rows.find((r) => r.name === name) || null;
  }
}

module.exports = { ApiClient, DalusApiError };
