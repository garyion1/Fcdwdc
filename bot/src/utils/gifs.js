async function fetchReactionGifOnce(category) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://nekos.best/api/v2/${category}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`nekos.best request failed with status ${response.status}`);
    const data = await response.json();
    return data.results?.[0]?.url ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

// Retries once — a single slow/failed request shouldn't mean no gif at all.
async function fetchReactionGif(category) {
  try {
    return await fetchReactionGifOnce(category);
  } catch {
    return fetchReactionGifOnce(category);
  }
}

module.exports = { fetchReactionGif };
