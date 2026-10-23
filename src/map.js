import { TILE } from './config.js';

const idx = (map, c, r) => r * map.cols + c;

export function isWall(map, c, r) {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return true;
  return map.tiles[idx(map, c, r)] === 1;
}

export function setTile(map, c, r, v) {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return;
  map.tiles[idx(map, c, r)] = v;
}

export function destroyTile(map, c, r) {
  setTile(map, c, r, 0);
}

export function tileCenter(map, c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

export function rectHitsWall(map, x, y, size) {
  const h = size / 2 - 0.5;
  const c0 = Math.floor((x - h) / TILE);
  const c1 = Math.floor((x + h) / TILE);
  const r0 = Math.floor((y - h) / TILE);
  const r1 = Math.floor((y + h) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isWall(map, c, r)) return true;
    }
  }
  return false;
}

export function wallAt(map, x, y) {
  return isWall(map, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function reflectAxes(map, x, y, nx, ny) {
  const hx = wallAt(map, nx, y);
  const hy = wallAt(map, x, ny);
  if (!hx && !hy) return { hx: true, hy: true };
  return { hx, hy };
}

export function clearArea(map, cx, cy, radius) {
  for (let r = cy - radius; r <= cy + radius; r++) {
    for (let c = cx - radius; c <= cx + radius; c++) {
      setTile(map, c, r, 0);
    }
  }
}

export function createMap(cols, rows) {
  const map = { cols, rows, tiles: new Uint8Array(cols * rows) };
  for (let c = 0; c < cols; c++) {
    setTile(map, c, 0, 1);
    setTile(map, c, rows - 1, 1);
  }
  for (let r = 0; r < rows; r++) {
    setTile(map, 0, r, 1);
    setTile(map, cols - 1, r, 1);
  }
  for (let c = 2; c < cols - 3; c += 4) {
    for (let r = 2; r < rows - 3; r += 4) {
      if (Math.random() > 0.72) continue;
      const w = Math.random() < 0.4 ? 1 : 2;
      const h = Math.random() < 0.4 ? 1 : 2;
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) setTile(map, c + i, r + j, 1);
      }
    }
  }
  return map;
}

export function reachableSet(map, from) {
  const seen = new Set();
  const queue = [from];
  seen.add(from.r * map.cols + from.c);
  while (queue.length) {
    const { c, r } = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const key = nr * map.cols + nc;
      if (nc < 0 || nr < 0 || nc >= map.cols || nr >= map.rows) continue;
      if (seen.has(key) || isWall(map, nc, nr)) continue;
      seen.add(key);
      queue.push({ c: nc, r: nr });
    }
  }
  return seen;
}

export function spawnTiles(map, count) {
  const m = 3;
  const midC = Math.floor(map.cols / 2);
  const midR = Math.floor(map.rows / 2);
  const all = [
    { c: m, r: m },
    { c: map.cols - 1 - m, r: map.rows - 1 - m },
    { c: map.cols - 1 - m, r: m },
    { c: m, r: map.rows - 1 - m },
    { c: midC, r: m },
    { c: midC, r: map.rows - 1 - m },
    { c: m, r: midR },
    { c: map.cols - 1 - m, r: midR },
  ].slice(0, count);
  for (const p of all) clearArea(map, p.c, p.r, 2);
  return all;
}

export function randomEmptyTile(map, avoid = [], minDist = 0) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const c = 1 + Math.floor(Math.random() * (map.cols - 2));
    const r = 1 + Math.floor(Math.random() * (map.rows - 2));
    if (isWall(map, c, r)) continue;
    const { x, y } = tileCenter(map, c, r);
    let ok = true;
    for (const a of avoid) {
      if (Math.hypot(a.x - x, a.y - y) < minDist) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  return null;
}
