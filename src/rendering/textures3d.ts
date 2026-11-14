/**
 * Procedural "Zelda: The Wind Waker" style texture atlas generator for 3D models & terrain.
 *
 * Generates a 512x640 RGBA8 texture atlas containing 20 stylized 128x128 tiles (4 columns x 5 rows).
 * Each tile uses bold, clean, high-contrast cel-shaded patterns (swirls, wood grain, clapboards,
 * shingles, masonry bricks, birch bark, bookshelves, gift wrap, etc.) that multiply with vertex
 * colors and quantized toon lighting in the WebGPU shader.
 */

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 5;
export const TILE_RES = 128;
export const ATLAS_WIDTH = ATLAS_COLS * TILE_RES; // 512
export const ATLAS_HEIGHT = ATLAS_ROWS * TILE_RES; // 640

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

  // 0: SOLID (pure white so vertex color controls exact shade)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      setTilePixel(data, TexId.SOLID, x, y, 255, 255, 255, 255);
    }
  }

  // 1: SNOW (Wind Waker style swirling snow drifts with subtle ice-blue curves)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const u = (x / TILE_RES) * Math.PI * 2;
      const v = (y / TILE_RES) * Math.PI * 2;
      const swirl =
        Math.sin(u * 2 + Math.sin(v * 2) * 1.4) * 0.5 +
        Math.cos(v * 2 - Math.cos(u) * 1.3) * 0.5;
      // Quantize into crisp toon bands
      let shade = 250;
      let blueTint = 255;
      if (swirl > 0.58) {
        shade = 255;
        blueTint = 255;
      } else if (swirl < -0.52) {
        shade = 228;
        blueTint = 248;
      } else {
        shade = 242;
        blueTint = 252;
      }
      setTilePixel(data, TexId.SNOW, x, y, shade, shade + 2, blueTint, 255);
    }
  }

  // 2: GRAVEL (Driveway gravel stones with snow patches)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const cellX = Math.floor(x / 8);
      const cellY = Math.floor(y / 8);
      const lx = (x % 8) - 4;
      const ly = (y % 8) - 4;
      const dist = Math.hypot(lx, ly);
      const rnd = hash2d(cellX, cellY, 2);
      let v = 225;
      if (dist < 3.1) {
        v = rnd > 0.65 ? 245 : rnd > 0.3 ? 212 : 194;
      } else if (dist < 3.8) {
        v = 176;
      }
      setTilePixel(data, TexId.GRAVEL, x, y, v, v, v + 4, 255);
    }
  }

  // 3: HOUSE_SIDING (Horizontal wooden clapboard siding with crisp under-board shadow line)
  for (let y = 0; y < TILE_RES; y++) {
    const plankRow = y % 16;
    const plankIdx = Math.floor(y / 16);
    for (let x = 0; x < TILE_RES; x++) {
      const grain = Math.sin((x / TILE_RES) * Math.PI * 6 + plankIdx * 1.7) * 4;
      let v = 246 + grain;
      if (plankRow === 0 || plankRow === 1) {
        v = 192; // dark clapboard shadow groove
      } else if (plankRow === 2) {
        v = 255; // top highlight bevel
      }
      setTilePixel(data, TexId.HOUSE_SIDING, x, y, v, v, v, 255);
    }
  }

  // 4: ROOF_SLATE (Scalloped slate roof shingles with subtle frost highlight)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 16);
    const ry = y % 16;
    for (let x = 0; x < TILE_RES; x++) {
      const offsetX = (x + (row % 2) * 16) % 32;
      const cx = offsetX - 16;
      const arch = Math.sqrt(Math.max(0, 16 * 16 - cx * cx)) * 0.35;
      let v = 232;
      if (ry < 2 || Math.abs(cx) >= 15) {
        v = 165; // dark shingle outline
      } else if (ry > 12 - arch * 0.3) {
        v = 252; // frost edge highlight
      } else if ((row + Math.floor((x + (row % 2) * 16) / 32)) % 3 === 0) {
        v = 216;
      }
      setTilePixel(data, TexId.ROOF_SLATE, x, y, v, v + 2, v + 6, 255);
    }
  }

  // 5: LOG_WALL (Rounded horizontal timber logs for Swedish guest cottages)
  for (let y = 0; y < TILE_RES; y++) {
    const ry = y % 21;
    const logIdx = Math.floor(y / 21);
    for (let x = 0; x < TILE_RES; x++) {
      const normY = (ry - 10.5) / 10.5; // -1 to 1 across log cylinder
      const cyl = Math.sqrt(Math.max(0, 1 - normY * normY));
      const whorl =
        Math.sin((x / TILE_RES) * Math.PI * 4 + logIdx * 2.1) *
        Math.cos(normY * 2.5) *
        8;
      let v = 185 + cyl * 62 + whorl;
      if (ry <= 1 || ry >= 20) {
        v = 135; // deep chinking groove between logs
      }
      setTilePixel(data, TexId.LOG_WALL, x, y, v, v * 0.95, v * 0.88, 255);
    }
  }

  // 6: BRICK_RED (Masonry bricks with pale mortar lines for chimneys and fireplace)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 16);
    const ry = y % 16;
    for (let x = 0; x < TILE_RES; x++) {
      const bx = (x + (row % 2) * 16) % 32;
      const brickId = Math.floor((x + (row % 2) * 16) / 32);
      const isMortar = ry < 2 || bx < 2;
      if (isMortar) {
        setTilePixel(data, TexId.BRICK_RED, x, y, 228, 222, 214, 255);
      } else {
        const rnd = hash2d(brickId, row, 6);
        const shade = rnd > 0.6 ? 248 : rnd > 0.25 ? 226 : 204;
        setTilePixel(
          data,
          TexId.BRICK_RED,
          x,
          y,
          shade,
          shade * 0.85,
          shade * 0.8,
          255
        );
      }
    }
  }

  // 7: BLUE_SIDING (Vertical board-and-batten siding for the blue garage)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const rx = x % 16;
      let v = 240;
      if (rx === 0 || rx === 1) {
        v = 180;
      } else if (rx === 2 || rx === 3) {
        v = 255;
      }
      setTilePixel(data, TexId.BLUE_SIDING, x, y, v, v, v, 255);
    }
  }

  // 8: WOOD_FLOOR (Staggered warm hardwood floorboards with toon grain)
  for (let y = 0; y < TILE_RES; y++) {
    const plankCol = Math.floor(y / 16);
    const py = y % 16;
    for (let x = 0; x < TILE_RES; x++) {
      const jointX = (x + (plankCol % 2) * 48) % 96;
      const isSeam = py === 0 || jointX === 0;
      if (isSeam) {
        setTilePixel(data, TexId.WOOD_FLOOR, x, y, 172, 160, 148, 255);
      } else {
        const wave =
          Math.sin((x / TILE_RES) * Math.PI * 6 + plankCol * 1.9 + py * 0.25) *
          8;
        const plankTone = (plankCol % 3 === 0 ? 246 : plankCol % 3 === 1 ? 236 : 228) + wave;
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

  // 9: STONE_FLOOR (Basement terracotta/stone square tiles with bevels)
  for (let y = 0; y < TILE_RES; y++) {
    const ty = y % 32;
    const row = Math.floor(y / 32);
    for (let x = 0; x < TILE_RES; x++) {
      const tx = x % 32;
      const col = Math.floor(x / 32);
      if (tx < 2 || ty < 2) {
        setTilePixel(data, TexId.STONE_FLOOR, x, y, 175, 170, 165, 255);
      } else if (tx === 2 || ty === 2) {
        setTilePixel(data, TexId.STONE_FLOOR, x, y, 252, 250, 246, 255);
      } else {
        const checker = (row + col) % 2 === 0 ? 238 : 226;
        setTilePixel(data, TexId.STONE_FLOOR, x, y, checker, checker, checker, 255);
      }
    }
  }

  // 10: BATHROOM_TILE (Crisp small ceramic mosaic tiles with specular shine)
  for (let y = 0; y < TILE_RES; y++) {
    const ty = y % 16;
    for (let x = 0; x < TILE_RES; x++) {
      const tx = x % 16;
      if (tx === 0 || ty === 0) {
        setTilePixel(data, TexId.BATHROOM_TILE, x, y, 200, 220, 225, 255);
      } else if (tx >= 3 && tx <= 6 && ty >= 3 && ty <= 5) {
        setTilePixel(data, TexId.BATHROOM_TILE, x, y, 255, 255, 255, 255);
      } else {
        setTilePixel(data, TexId.BATHROOM_TILE, x, y, 236, 246, 248, 255);
      }
    }
  }

  // 11: INTERIOR_WALL (Subtle vertical wallpaper stripe + lower wainscoting trim)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const stripe = Math.floor(x / 16) % 2 === 0 ? 248 : 240;
      let v = stripe;
      if (y > 96 && y < 102) {
        v = 210; // chair rail molding
      } else if (y >= 102) {
        v = (x % 32 < 3 || y > 123) ? 205 : 232; // wainscoting panel
      }
      setTilePixel(data, TexId.INTERIOR_WALL, x, y, v, v, v, 255);
    }
  }

  // 12: PINE_FOLIAGE (Stylized Wind Waker layered pine needle arcs & snow tips)
  for (let y = 0; y < TILE_RES; y++) {
    const row = Math.floor(y / 24);
    const ry = y % 24;
    for (let x = 0; x < TILE_RES; x++) {
      const ox = (x + (row % 2) * 16) % 32;
      const dx = ox - 16;
      const scallop = 18 - (dx * dx) / 18;
      let v = 235;
      if (ry > scallop && ry <= scallop + 3) {
        v = 175; // dark toon needle contour
      } else if (ry > scallop - 4 && ry <= scallop) {
        v = 255; // bright snow-dusted needle tip
      } else if ((x + y) % 7 === 0) {
        v = 220;
      }
      setTilePixel(data, TexId.PINE_FOLIAGE, x, y, v, v, v, 255);
    }
  }

  // 13: WOOD_GRAIN (Rich stylized concentric Wind Waker wood swirl for furniture & doors)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const nx = (x - 64) / 64;
      const ny = (y - 64) / 64;
      const ring = Math.sin(Math.hypot(nx * 0.7, ny * 1.8) * 18 + Math.sin(ny * 4) * 1.5);
      const v = ring > 0.55 ? 212 : ring < -0.55 ? 252 : 236;
      setTilePixel(data, TexId.WOOD_GRAIN, x, y, v, v * 0.96, v * 0.9, 255);
    }
  }

  // 14: BIRCH_BARK (White bark with dark horizontal lenticel dashes)
  for (let y = 0; y < TILE_RES; y++) {
    const band = Math.floor(y / 6);
    for (let x = 0; x < TILE_RES; x++) {
      const rnd = hash2d(Math.floor(x / 20), band, 14);
      const isKnot = rnd > 0.76 && (y % 6 >= 1 && y % 6 <= 4);
      const v = isKnot ? 110 : 248;
      setTilePixel(data, TexId.BIRCH_BARK, x, y, v, v, v, 255);
    }
  }

  // 15: FABRIC (Cozy woven diamond/herringbone upholstery texture)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const d = ((x + y) % 16 < 8) !== (((x - y + 128) % 16) < 8);
      const stitch = x % 8 === 0 || y % 8 === 0;
      const v = stitch ? 218 : d ? 248 : 234;
      setTilePixel(data, TexId.FABRIC, x, y, v, v, v, 255);
    }
  }

  // 16: WINDOW_GLOW (Golden lit window panes with dark wooden muntin frame)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const isBorder = x < 10 || x >= TILE_RES - 10 || y < 10 || y >= TILE_RES - 10;
      const isCrossbar = Math.abs(x - 64) < 5 || Math.abs(y - 64) < 5;
      if (isBorder || isCrossbar) {
        setTilePixel(data, TexId.WINDOW_GLOW, x, y, 75, 52, 38, 255);
      } else {
        const dist = Math.hypot(x - 64, y - 64) / 75;
        const glow = Math.max(0, 1 - dist * 0.35);
        setTilePixel(
          data,
          TexId.WINDOW_GLOW,
          x,
          y,
          255,
          Math.round(230 * glow + 20),
          Math.round(145 * glow + 15),
          255
        );
      }
    }
  }

  // 17: BOOKSHELF (Rows of colorful books with spines and shelves)
  const bookColors: [number, number, number][] = [
    [196, 48, 43],
    [46, 118, 178],
    [52, 146, 84],
    [214, 158, 46],
    [136, 78, 160],
    [184, 92, 56],
  ];
  for (let y = 0; y < TILE_RES; y++) {
    const shelfRow = Math.floor(y / 32);
    const sy = y % 32;
    for (let x = 0; x < TILE_RES; x++) {
      if (sy >= 27 || x < 6 || x >= TILE_RES - 6) {
        // Wooden shelf plank
        setTilePixel(data, TexId.BOOKSHELF, x, y, 142, 92, 52, 255);
      } else {
        const bookIdx = Math.floor(x / 12) + shelfRow * 7;
        const bx = x % 12;
        const topHeight = 3 + Math.floor(hash2d(bookIdx, shelfRow, 17) * 5);
        if (sy < topHeight) {
          // Dark gap behind top of books
          setTilePixel(data, TexId.BOOKSHELF, x, y, 54, 34, 22, 255);
        } else if (bx === 0) {
          setTilePixel(data, TexId.BOOKSHELF, x, y, 42, 28, 18, 255);
        } else if (sy === topHeight + 3 || sy === 23) {
          // Gold foil spine band
          setTilePixel(data, TexId.BOOKSHELF, x, y, 245, 212, 92, 255);
        } else {
          const [br, bg, bb] = bookColors[bookIdx % bookColors.length];
          setTilePixel(data, TexId.BOOKSHELF, x, y, br, bg, bb, 255);
        }
      }
    }
  }

  // 18: CHESSBOARD (8x8 alternating cream and walnut squares)
  for (let y = 0; y < TILE_RES; y++) {
    const cy = Math.floor(y / 16);
    for (let x = 0; x < TILE_RES; x++) {
      const cx = Math.floor(x / 16);
      const isLight = (cx + cy) % 2 === 0;
      if (isLight) {
        setTilePixel(data, TexId.CHESSBOARD, x, y, 248, 236, 208, 255);
      } else {
        setTilePixel(data, TexId.CHESSBOARD, x, y, 88, 52, 32, 255);
      }
    }
  }

  // 19: GIFT_WRAP (Festive diagonal stripes + gold ribbon cross)
  for (let y = 0; y < TILE_RES; y++) {
    for (let x = 0; x < TILE_RES; x++) {
      const isRibbon = Math.abs(x - 64) < 11 || Math.abs(y - 64) < 11;
      if (isRibbon) {
        const isEdge =
          Math.abs(Math.abs(x - 64) - 10) <= 1 ||
          Math.abs(Math.abs(y - 64) - 10) <= 1;
        setTilePixel(
          data,
          TexId.GIFT_WRAP,
          x,
          y,
          255,
          isEdge ? 200 : 232,
          isEdge ? 40 : 95,
          255
        );
      } else {
        const stripe = (x + y) % 24 < 12 ? 252 : 222;
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
