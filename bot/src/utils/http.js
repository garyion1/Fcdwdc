// Small wrapper around global fetch (Node 18+) with a timeout and one retry.
// Every outbound API the bot talks to is public and key-less, so the only
// failure modes worth handling are slowness and the odd blip.

const DEFAULT_TIMEOUT_MS = 6000;
const USER_AGENT = 'BoatBot/1.0 (Discord bot)';

async function fetchOnce(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/plain,*/*', ...headers },
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchOnce(url, options);
    if (!response) continue;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchText(url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchOnce(url, options);
    if (!response) continue;
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = { fetchJson, fetchText, USER_AGENT };
