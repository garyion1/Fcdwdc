async function fetchReactionGif(category) {
  const response = await fetch(`https://nekos.best/api/v2/${category}`);
  if (!response.ok) throw new Error(`nekos.best request failed with status ${response.status}`);
  const data = await response.json();
  return data.results?.[0]?.url ?? null;
}

module.exports = { fetchReactionGif };
