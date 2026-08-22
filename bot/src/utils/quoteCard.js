// Renders the "quote card" image for ,quote — avatar on the left fading into
// the background, the quoted line beside it, attribution underneath.
//
// @napi-rs/canvas is an OPTIONAL dependency. It ships prebuilt binaries so a
// normal `npm install` picks it up, but a host that can't install it (or has
// no fonts) must not take the whole bot down — every failure path here returns
// null so the command falls back to a plain embed.

const WIDTH = 1000;
const HEIGHT = 420;
const AVATAR_W = 380;
const TEXT_X = 430;
const TEXT_RIGHT_PAD = 60;
const MAX_TEXT_W = WIDTH - TEXT_X - TEXT_RIGHT_PAD;

const BG = '#0d0d10';
const QUOTE_INK = '#f2f3f5';
const ATTRIB_INK = '#9aa3ad';

let canvasModule;
let loadAttempted = false;

function loadCanvas() {
  if (loadAttempted) return canvasModule;
  loadAttempted = true;
  try {
    canvasModule = require('@napi-rs/canvas');
  } catch {
    canvasModule = null;
    console.warn('[quote] @napi-rs/canvas is not installed — ,quote will use an embed instead of an image.');
  }
  return canvasModule;
}

function isAvailable() {
  return loadCanvas() !== null;
}

// Wraps to `maxWidth`, hard-breaking any single word too long to fit (a wall
// of characters with no spaces would otherwise run off the card).
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';

  const pushLine = () => {
    if (line) lines.push(line);
    line = '';
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    pushLine();

    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = '';
    for (const char of word) {
      if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }

  pushLine();
  return lines;
}

// Shrinks the quote until it fits the card, so a long line stays on one image
// instead of overflowing.
function fitQuote(ctx, text) {
  const maxLines = 5;
  for (let size = 46; size >= 22; size -= 2) {
    ctx.font = `600 ${size}px sans-serif`;
    const lines = wrapText(ctx, text, MAX_TEXT_W);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = '600 22px sans-serif';
  return { size: 22, lines: wrapText(ctx, text, MAX_TEXT_W).slice(0, maxLines) };
}

async function fetchAvatar(canvas, url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!response.ok) return null;
    return await canvas.loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

async function renderQuoteCard({ text, name, avatarUrl }) {
  const canvas = loadCanvas();
  if (!canvas) return null;

  try {
    const image = canvas.createCanvas(WIDTH, HEIGHT);
    const ctx = image.getContext('2d');

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A host with no fonts installed measures everything as zero width, which
    // would render a card of invisible text — fall back to the embed instead.
    ctx.font = '600 46px sans-serif';
    if (ctx.measureText('W').width === 0) {
      console.warn('[quote] no usable system font found — falling back to an embed.');
      return null;
    }

    const avatar = await fetchAvatar(canvas, avatarUrl);
    if (avatar) {
      // Cover the left panel without distorting the source image.
      const scale = Math.max(AVATAR_W / avatar.width, HEIGHT / avatar.height);
      const drawW = avatar.width * scale;
      const drawH = avatar.height * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, AVATAR_W, HEIGHT);
      ctx.clip();
      ctx.filter = 'grayscale(100%)';
      ctx.drawImage(avatar, (AVATAR_W - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
      ctx.filter = 'none';
      ctx.restore();

      // Fade the right edge of the avatar into the background.
      const fade = ctx.createLinearGradient(AVATAR_W * 0.45, 0, AVATAR_W, 0);
      fade.addColorStop(0, 'rgba(13,13,16,0)');
      fade.addColorStop(1, 'rgba(13,13,16,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, AVATAR_W, HEIGHT);
    }

    const { size, lines } = fitQuote(ctx, `“${text}”`);
    const lineHeight = Math.round(size * 1.32);
    const attribSize = Math.max(Math.round(size * 0.52), 18);
    const attribGap = 34;

    const blockHeight = lines.length * lineHeight + attribGap + attribSize;
    let y = Math.round((HEIGHT - blockHeight) / 2) + size;

    ctx.fillStyle = QUOTE_INK;
    ctx.font = `600 ${size}px sans-serif`;
    ctx.textBaseline = 'alphabetic';
    for (const line of lines) {
      ctx.fillText(line, TEXT_X, y);
      y += lineHeight;
    }

    ctx.fillStyle = ATTRIB_INK;
    ctx.font = `400 ${attribSize}px sans-serif`;
    ctx.fillText(`— ${name}`, TEXT_X, y + attribGap);

    return await image.encode('png');
  } catch (error) {
    console.error('[quote] card render failed, falling back to an embed:', error);
    return null;
  }
}

module.exports = { renderQuoteCard, isAvailable };
