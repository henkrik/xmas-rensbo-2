/**
 * HD Procedural "Zelda: The Wind Waker HD" style texture atlas generator for 3D models & terrain.
 *
 * Generates a 1024x1280 RGBA8 texture atlas containing 20 stylized 256x256 tiles (4 columns x 5 rows).
 * Uses smooth anti-aliased painterly gradients, wood whorls, beveled stone/tile reliefs, woven textiles,
 * and crisp cel-shaded details that combine with WebGPU MSAA + toon lighting.
 */

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 5;
export const TILE_RES = 256;
export const ATLAS_WIDTH = ATLAS_COLS * TILE_RES; // 1024
export const ATLAS_HEIGHT = ATLAS_ROWS * TILE_RES; // 1280

export const TexId = {
  SOLID: 0,
  SNOW: 1,
  GRAVEL: 2,
  HOUSE_SIDING: 3,
  ROOF_SLATE: 4,
  LOG_WALL: 5,
  BRICK_RED: 6,
  BLUE_SIDING: 7,
  WOOD_FLOOR: 8,
  STONE_FLOOR: 9,
  BATHROOM_TILE: 10,
  INTERIOR_WALL: 11,
  PINE_FOLIAGE: 12,
  WOOD_GRAIN: 13,
  BIRCH_BARK: 14,
  FABRIC: 15,
  WINDOW_GLOW: 16,
  BOOKSHELF: 17,
  CHESSBOARD: 18,
  GIFT_WRAP: 19,
} as const;

export type TextureIdValue = (typeof TexId)[keyof typeof TexId];

export interface ProceduralAtlasData {
  width: number;
  height: number;
  data: Uint8Array;
}

function hash2d(ix: number, iy: number, seed = 0): number {
  let n = ix * 374761393 + iy * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function setTilePixel(
  data: Uint8Array,
  tileId: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255
): void {
  const col = tileId % ATLAS_COLS;
  const row = Math.floor(tileId / ATLAS_COLS);
  const px = col * TILE_RES + (x & (TILE_RES - 1));
  const py = row * TILE_RES + (y & (TILE_RES - 1));
  const idx = (py * ATLAS_WIDTH + px) * 4;
  data[idx] = Math.max(0, Math.min(255, Math.round(r)));
  data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
  data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
  data[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
}

let cachedAtlas: ProceduralAtlasData | null = null;

export function getProceduralTextureAtlas(): ProceduralAtlasData {
  if (cachedAtlas) {
    return cachedAtlas;
  }

  const data = new Uint8Array(ATLAS_WIDTH * ATLAS_HEIGHT * 4);

  // 0: SOLID (pure white with subtle vertical micro-gradient)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      setTilePixel(data, TexId.SOLID, x, y, 255, 255, 255, 255);
    }
  }

  // 1: SNOW (Wind Waker HD silky swirling snowdrifts + subtle sparkle grains)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const u = (x / TILE_RES) * Math.PI * 2;
      const v = (y / TILE_RES) * Math.PI * 2;
      const swirl =
        Math.sin(u * 2 + Math.sin(v * 2) * 1.45) * 0.5 +
        Math.cos(v * 2 - Math.cos(u * 2) * 1.35) * 0.5;
      const bandHi = smoothstep(0.42, 0.56, swirl);
      const bandLo = 1 - smoothstep(-0.56, -0.4, swirl);
      const sparkle = hash2d(x, y, 101) > 0.992 ? 12 : 0;
      const r = 240 + bandHi * 15 - bandLo * 18 + sparkle;
      const g = 245 + bandHi * 10 - bandLo * 12 + sparkle;
      const b = 254 + bandHi * 1 - bandLo * 4;
      setTilePixel(data, TexId.SNOW, x, y, r, g, b, 255);
    }
  }

  // 2: GRAVEL (Rounded winter pebbles embedded in snowy slush)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const cellX = Math.floor(x / 16);
      const cellY = Math.floor(y / 16);
      const lx = ((x % 16) - 8) / 8;
      const ly = ((y % 16) - 8) / 8;
      const dist = Math.hypot(lx, ly);
      const rnd = hash2d(cellX, cellY, 2);
      const dome = Math.sqrt(Math.max(0, 1 - dist * dist));
      const base = rnd > 0.65 ? 236 : rnd > 0.3 ? 208 : 190;
      const rim = smoothstep(0.75, 0.92, dist);
      const v = (base + dome * 22) * (1 - rim * 0.22);
      setTilePixel(data, TexId.GRAVEL, x, y, v, v + 2, v + 7, 255);
    }
  }

  // 3: HOUSE_SIDING (Detailed beveled wooden clapboard siding with fine grain)
  for (let y = 0; y < TILE_RES; y++) {
    const plankRow = y % 32;
    const plankIdx = Math.floor(y / 32);
    for (let x = 0; x < TILE_RES; x++) {
      const grain =
        Math.sin((x / TILE_RES) * Math.PI * 8 + plankIdx * 1.7 + Math.sin(y * 0.15) * 0.8) * 5;
      const bevel = (plankRow / 32) * 10;
      let v = 242 + bevel + grain;
      if (plankRow < 3) {
        v = 178 + plankRow * 12; // deep shadow under clapboard overlap
      } else if (plankRow === 3 || plankRow === 4) {
        v = 255; // crisp sunlit bevel edge
      }
      setTilePixel(data, TexId.HOUSE_SIDING, x, y, v, v, v, 255);
    }
  }

  // 4: ROOF_SLATE (Layered architectural slate shingles with beveled edges & frost)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 32);
    const ry = y % 32;
    for (let x = 0; x < TILE_RES; x++) {
      const offsetX = (x + (row % 2) * 32) % 64;
      const cx = (offsetX - 32) / 32;
      const arch = Math.sqrt(Math.max(0, 1 - cx * cx)) * 10;
      const tileIdHash = hash2d(Math.floor((x + (row % 2) * 32) / 64), row, 4);
      let v = 224 + (tileIdHash - 0.5) * 26 + (ry / 32) * 14;
      if (ry < 3 || Math.abs(offsetX - 32) >= 30) {
        v = 148; // dark slate seam
      } else if (ry > 25 - arch * 0.35) {
        v = 252; // frosted lower shingle lip
      }
      setTilePixel(data, TexId.ROOF_SLATE, x, y, v, v + 3, v + 8, 255);
    }
  }

  // 5: LOG_WALL (Sculpted Swedish timber logs with rich wood grain & chinking)
  for (let y = 0; y < TILE_RES; y++) {
    const ry = y % 42;
    const logIdx = Math.floor(y / 42);
    for (let x = 0; x < TILE_RES; x++) {
      const normY = (ry - 21) / 21;
      const cyl = Math.sqrt(Math.max(0, 1 - normY * normY));
      const whorl =
        Math.sin((x / TILE_RES) * Math.PI * 6 + logIdx * 2.3 + Math.sin(normY * 3) * 1.4) * 10;
      let v = 172 + cyl * 74 + whorl;
      if (ry <= 2 || ry >= 40) {
        v = 118; // deep log seam
      }
      setTilePixel(data, TexId.LOG_WALL, x, y, v, v * 0.95, v * 0.88, 255);
    }
  }

  // 6: BRICK_RED (Beveled clay masonry bricks with recessed mortar & subtle texture)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 32);
    const ry = y % 32;
    for (let x = 0; x < TILE_RES; x++) {
      const bx = (x + (row % 2) * 32) % 64;
      const brickId = Math.floor((x + (row % 2) * 32) / 64);
      const isMortar = ry < 4 || bx < 4;
      if (isMortar) {
        const m = 220 + (ry === 2 || bx === 2 ? -12 : 4);
        setTilePixel(data, TexId.BRICK_RED, x, y, m, m - 4, m - 10, 255);
      } else {
        const rnd = hash2d(brickId, row, 6);
        const bevel = ry < 7 || bx < 7 ? 14 : ry > 28 || bx > 60 ? -16 : 0;
        const shade = (rnd > 0.65 ? 244 : rnd > 0.25 ? 224 : 202) + bevel;
        setTilePixel(data, TexId.BRICK_RED, x, y, shade, shade * 0.85, shade * 0.8, 255);
      }
    }
  }

  // 7: BLUE_SIDING (Board-and-batten architectural siding with crisp shadow reliefs)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const rx = x % 32;
      const grain = Math.sin((y / TILE_RES) * Math.PI * 8 + Math.floor(x / 32)) * 4;
      let v = 238 + grain;
      if (rx < 3) {
        v = 168;
      } else if (rx >= 3 && rx <= 6) {
        v = 255;
      } else if (rx >= 22 && rx <= 24) {
        v = 212;
      }
      setTilePixel(data, TexId.BLUE_SIDING, x, y, v, v, v, 255);
    }
  }

  // 8: WOOD_FLOOR (Polished Scandinavian oak parquet floorboards with wood cathedrals)
  for (let y = 0; y < TILE_RES; y++) {
    const plankCol = Math.floor(y / 32);
    const py = y % 32;
    for (let x = 0; x < TILE_RES; x++) {
      const jointX = (x + (plankCol % 2) * 96) % 192;
      const isSeam = py < 2 || jointX < 2;
      if (isSeam) {
        setTilePixel(data, TexId.WOOD_FLOOR, x, y, 156, 142, 128, 255);
      } else {
        const cathedral =
          Math.sin(
            Math.hypot((x % 192) - 96, (py - 16) * 4.5) * 0.18 + plankCol * 1.7
          ) * 9;
        const bevel = py === 2 || jointX === 2 ? 10 : 0;
        const plankTone =
          (plankCol % 3 === 0 ? 245 : plankCol % 3 === 1 ? 235 : 226) +
          cathedral +
          bevel;
        setTilePixel(
          data,
          TexId.WOOD_FLOOR,
          x,
          y,
          plankTone,
          plankTone * 0.97,
          plankTone * 0.93,
          255
        );
      }
    }
  }

  // 9: STONE_FLOOR (Beveled limestone/terracotta flagstones with chiseled edges)
  for (let y = 0; y < TILE_RES; y++) {
    const ty = y % 64;
    const row = Math.floor(y / 64);
    for (let x = 0; x < TILE_RES; x++) {
      const tx = x % 64;
      const col = Math.floor(x / 64);
      if (tx < 3 || ty < 3) {
        setTilePixel(data, TexId.STONE_FLOOR, x, y, 158, 154, 148, 255);
      } else {
        const bevel = tx < 7 || ty < 7 ? 14 : tx > 59 || ty > 59 ? -12 : 0;
        const marble = Math.sin((x + y) * 0.08 + Math.sin(x * 0.05) * 2) * 5;
        const checker = (row + col) % 2 === 0 ? 238 : 224;
        const v = checker + bevel + marble;
        setTilePixel(data, TexId.STONE_FLOOR, x, y, v, v, v, 255);
      }
    }
  }

  // 10: BATHROOM_TILE (Glossy porcelain mosaic tiles with diagonal specular sheen)
  for (let y = 0; y < TILE_RES; y++) {
    const ty = y % 32;
    for (let x = 0; x < TILE_RES; x++) {
      const tx = x % 32;
      if (tx < 2 || ty < 2) {
        setTilePixel(data, TexId.BATHROOM_TILE, x, y, 192, 214, 222, 255);
      } else {
        const distHi = Math.hypot(tx - 10, ty - 10);
        const spec = distHi < 6 ? (1 - distHi / 6) * 22 : 0;
        const bevel = tx < 5 || ty < 5 ? 10 : tx > 28 || ty > 28 ? -10 : 0;
        setTilePixel(
          data,
          TexId.BATHROOM_TILE,
          x,
          y,
          232 + spec + bevel,
          244 + spec + bevel,
          248 + spec + bevel,
          255
        );
      }
    }
  }

  // 11: INTERIOR_WALL (Classic Nordic damask wallpaper + raised panel wainscoting)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const stripe = Math.floor(x / 32) % 2 === 0 ? 248 : 241;
      let v = stripe;
      if (y >= 176 && y < 186) {
        // Dado chair-rail molding
        v = y < 180 ? 255 : 196;
      } else if (y >= 186) {
        const px = x % 64;
        const py = y - 186;
        const inFrame = px >= 8 && px <= 56 && py >= 8 && py <= 58;
        const onFrameEdge =
          (px === 8 || px === 56 || py === 8 || py === 58) && inFrame;
        v = onFrameEdge ? 192 : inFrame ? 244 : 230;
      }
      setTilePixel(data, TexId.INTERIOR_WALL, x, y, v, v, v, 255);
    }
  }

  // 12: PINE_FOLIAGE (Painterly layered evergreen boughs with frosted snow tips)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 48);
    const ry = y % 48;
    for (let x = 0; x < TILE_RES; x++) {
      const ox = (x + (row % 2) * 32) % 64;
      const dx = (ox - 32) / 32;
      const scallop = 36 - dx * dx * 18;
      const needleAngle = Math.atan2(ry, ox - 32);
      const needleWave = Math.sin(needleAngle * 18) * 5;
      let v = 232 + needleWave;
      if (ry > scallop && ry <= scallop + 5) {
        v = 162; // deep shadow under bough layer
      } else if (ry > scallop - 8 && ry <= scallop) {
        v = 255; // snow-frosted needle tips
      }
      setTilePixel(data, TexId.PINE_FOLIAGE, x, y, v, v, v, 255);
    }
  }

  // 13: WOOD_GRAIN (Wind Waker HD stylized concentric wood grain for fine furniture)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const nx = (x - 128) / 128;
      const ny = (y - 128) / 128;
      const ring = Math.sin(
        Math.hypot(nx * 0.75, ny * 1.85) * 22 + Math.sin(ny * 5) * 1.6
      );
      const v =
        236 +
        smoothstep(0.45, 0.65, ring) * 18 -
        (1 - smoothstep(-0.65, -0.45, ring)) * 26;
      setTilePixel(data, TexId.WOOD_GRAIN, x, y, v, v * 0.96, v * 0.9, 255);
    }
  }

  // 14: BIRCH_BARK (Crisp silver-white birch bark with dark lenticel bands)
  for (let y = 0; y < TILE_RES; y++) {
    const band = Math.floor(y / 10);
    for (let x = 0; x < TILE_RES; x++) {
      const rnd = hash2d(Math.floor(x / 36), band, 14);
      const isKnot = rnd > 0.76 && y % 10 >= 2 && y % 10 <= 7;
      const v = isKnot ? 96 : 248 - Math.sin(x * 0.05) * 6;
      setTilePixel(data, TexId.BIRCH_BARK, x, y, v, v, v, 255);
    }
  }

  // 15: FABRIC (Plush quilted diamond upholstery with button tufting & weave)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const u = (x % 64) - 32;
      const v = (y % 64) - 32;
      const diamondDist = (Math.abs(u) + Math.abs(v)) / 32;
      const puff = Math.cos(Math.min(1, diamondDist) * Math.PI * 0.5) * 18;
      const weave = ((x + y) % 4 === 0 ? -4 : 2);
      const shade = 228 + puff + weave;
      setTilePixel(data, TexId.FABRIC, x, y, shade, shade, shade, 255);
    }
  }

  // 16: WINDOW_GLOW (Multi-pane Georgian window with warm candlelit interior & frost corners)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const isBorder =
        x < 16 || x >= TILE_RES - 16 || y < 16 || y >= TILE_RES - 16;
      const isCrossbar =
        Math.abs(x - 128) < 7 || Math.abs(y - 128) < 7;
      if (isBorder || isCrossbar) {
        const bevel =
          Math.abs(x - 128) < 3 || Math.abs(y - 128) < 3 ? 92 : 68;
        setTilePixel(data, TexId.WINDOW_GLOW, x, y, bevel, bevel * 0.72, bevel * 0.52, 255);
      } else {
        const dist = Math.hypot(x - 128, y - 128) / 150;
        const glow = Math.max(0, 1 - dist * 0.38);
        const sheen = Math.abs(x + y - 220) < 18 ? 18 : 0;
        setTilePixel(
          data,
          TexId.WINDOW_GLOW,
          x,
          y,
          255,
          Math.min(255, Math.round(232 * glow + 20 + sheen)),
          Math.min(255, Math.round(150 * glow + 15 + sheen)),
          255
        );
      }
    }
  }

  // 17: BOOKSHELF (HD rows of leather-bound books with ribbed spines & gold leaf)
  const bookColors: [number, number, number][] = [
    [196, 48, 43],
    [46, 118, 178],
    [52, 146, 84],
    [214, 158, 46],
    [136, 78, 160],
    [184, 92, 56],
  ];
  for (let y = 0; y < TILE_RES; y++) {
    const shelfRow = Math.floor(y / 64);
    const sy = y % 64;
    for (let x = 0; x < TILE_RES; x++) {
      if (sy >= 54 || x < 10 || x >= TILE_RES - 10) {
        const bevel = sy === 54 ? 172 : 142;
        setTilePixel(data, TexId.BOOKSHELF, x, y, bevel, bevel * 0.65, bevel * 0.38, 255);
      } else {
        const bookIdx = Math.floor(x / 22) + shelfRow * 11;
        const bx = x % 22;
        const topHeight = 6 + Math.floor(hash2d(bookIdx, shelfRow, 17) * 10);
        if (sy < topHeight) {
          setTilePixel(data, TexId.BOOKSHELF, x, y, 48, 30, 20, 255);
        } else if (bx <= 1 || bx >= 21) {
          setTilePixel(data, TexId.BOOKSHELF, x, y, 38, 24, 16, 255);
        } else if (sy === topHeight + 5 || sy === topHeight + 6 || sy === 46 || sy === 47) {
          setTilePixel(data, TexId.BOOKSHELF, x, y, 250, 216, 96, 255);
        } else {
          const [br, bg, bb] = bookColors[bookIdx % bookColors.length];
          const cyl = Math.sin((bx / 22) * Math.PI) * 18;
          setTilePixel(data, TexId.BOOKSHELF, x, y, br + cyl, bg + cyl, bb + cyl, 255);
        }
      }
    }
  }

  // 18: CHESSBOARD (Inlaid walnut and maple 8x8 chessboard with satin wood sheen)
  for (let y = 0; y < TILE_RES; y++) {
    const cy = Math.floor(y / 32);
    for (let x = 0; x < TILE_RES; x++) {
      const cx = Math.floor(x / 32);
      const isLight = (cx + cy) % 2 === 0;
      const grain = Math.sin(x * 0.25 + cy) * 4;
      if (isLight) {
        setTilePixel(data, TexId.CHESSBOARD, x, y, 248 + grain, 236 + grain, 208 + grain, 255);
      } else {
        setTilePixel(data, TexId.CHESSBOARD, x, y, 88 + grain, 52 + grain, 32 + grain, 255);
      }
    }
  }

  // 19: GIFT_WRAP (Festive diagonal candy-stripe foil paper + satin gold ribbon cross)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const isRibbon = Math.abs(x - 128) < 22 || Math.abs(y - 128) < 22;
      if (isRibbon) {
        const isEdge =
          Math.abs(Math.abs(x - 128) - 20) <= 2 ||
          Math.abs(Math.abs(y - 128) - 20) <= 2;
        setTilePixel(
          data,
          TexId.GIFT_WRAP,
          x,
          y,
          255,
          isEdge ? 200 : 236,
          isEdge ? 42 : 98,
          255
        );
      } else {
        const wave = Math.sin(((x + y) / 48) * Math.PI * 2);
        const stripe = wave > 0 ? 252 : 224;
        setTilePixel(data, TexId.GIFT_WRAP, x, y, stripe, stripe, stripe, 255);
      }
    }
  }

  cachedAtlas = {
    width: ATLAS_WIDTH,
    height: ATLAS_HEIGHT,
    data,
  };
  return cachedAtlas;
}
