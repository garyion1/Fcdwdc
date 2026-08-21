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

async function fetchJson(url, { attempts = 2, ...options } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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

async function fetchText(url, { attempts = 2, ...options } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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

// Confirms a URL actually resolves to an image or video before the bot sends
// it — this is what stops Discord from showing "this content couldn't be
// loaded" on a link that a flaky API handed back (dead file, moved CDN,
// HTML error page dressed up as a 200, etc).
async function verifyMediaUrl(url, { timeoutMs = 4000 } = {}) {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(url, { method: 'HEAD', signal: controller.signal, headers: { 'User-Agent': USER_AGENT } }).catch(() => null);

    // Some CDNs (imgur, old reddit hosts) reject HEAD outright — a ranged GET
    // gets the headers without pulling the whole file.
    if (!response || response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
      }).catch(() => null);
    }

    if (!response || (!response.ok && response.status !== 206)) return false;
    const type = response.headers.get('content-type') ?? '';
    return type.startsWith('image/') || type.startsWith('video/');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Runs every task concurrently and resolves with the first truthy result —
// used to query several gif/image providers at once instead of waiting for
// each to fail before trying the next. A slow or dead provider no longer
// adds to the wait; only the fastest one that actually works does.
async function raceForFirstValid(tasks) {
  if (tasks.length === 0) return null;

  return new Promise((resolve) => {
    let remaining = tasks.length;
    let settled = false;

    for (const task of tasks) {
      Promise.resolve()
        .then(task)
        .catch(() => null)
        .then((value) => {
          if (settled) return;
          if (value) {
            settled = true;
            resolve(value);
            return;
          }
          remaining -= 1;
          if (remaining === 0) resolve(null);
        });
    }
  });
}

module.exports = { fetchJson, fetchText, verifyMediaUrl, raceForFirstValid, USER_AGENT };
