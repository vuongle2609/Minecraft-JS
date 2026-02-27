import {
  CanvasTexture,
  MeshLambertMaterial,
  NearestFilter,
} from "three";

// block textures
import grassTop from "@/assets/block/grass.jpg";
import grassSide from "@/assets/block/grass_side.png";
import dirt from "@/assets/block/dirt.png";
import sand from "@/assets/block/sand.png";
import leavesOak from "@/assets/block/leaves_oak.png";
import stone from "@/assets/block/stone.png";
import oakPlanksSide from "@/assets/block/planks_oak.png";
import diamondBlockSide from "@/assets/block/diamond_block.png";
import furnaceFront from "@/assets/block/furnace_front_on.png";
import furnaceSide from "@/assets/block/furnace_side.png";
import furnaceTop from "@/assets/block/furnace_top.png";
import cobblestoneSide from "@/assets/block/cobblestone.png";
import ironBlockSide from "@/assets/block/iron_block.png";
import goldBlockSide from "@/assets/block/gold_block.png";
import lapisBlockSide from "@/assets/block/lapis_block.png";
import emeraldBlockSide from "@/assets/block/emerald_block.png";
import woodSide from "@/assets/block/log_oak.png";
import woodTop from "@/assets/block/log_oak_top.png";
import bedrock from "@/assets/block/bedrock.png";
import water from "@/assets/block/water.png";

import { BlockKeys, FaceAoType } from "@/type";
import { Face } from "@/constants/block";

const TILE_SIZE = 16;
const ATLAS_COLS = 8;
const ATLAS_ROWS = 4;

export interface AtlasUV {
  uMin: number;
  vMin: number;
  uMax: number;
  vMax: number;
}

// Each unique texture gets a slot in the atlas grid
const textureEntries: { key: string; url: string; col: number; row: number }[] = [
  { key: "grassTop", url: grassTop, col: 0, row: 0 },
  { key: "grassSide", url: grassSide, col: 1, row: 0 },
  { key: "dirt", url: dirt, col: 2, row: 0 },
  { key: "sand", url: sand, col: 3, row: 0 },
  { key: "leavesOak", url: leavesOak, col: 4, row: 0 },
  { key: "stone", url: stone, col: 5, row: 0 },
  { key: "oakPlanks", url: oakPlanksSide, col: 6, row: 0 },
  { key: "diamondBlock", url: diamondBlockSide, col: 7, row: 0 },
  { key: "furnaceFront", url: furnaceFront, col: 0, row: 1 },
  { key: "furnaceSide", url: furnaceSide, col: 1, row: 1 },
  { key: "furnaceTop", url: furnaceTop, col: 2, row: 1 },
  { key: "cobblestone", url: cobblestoneSide, col: 3, row: 1 },
  { key: "ironBlock", url: ironBlockSide, col: 4, row: 1 },
  { key: "goldBlock", url: goldBlockSide, col: 5, row: 1 },
  { key: "lapisBlock", url: lapisBlockSide, col: 6, row: 1 },
  { key: "emeraldBlock", url: emeraldBlockSide, col: 7, row: 1 },
  { key: "woodSide", url: woodSide, col: 0, row: 2 },
  { key: "woodTop", url: woodTop, col: 1, row: 2 },
  { key: "bedrock", url: bedrock, col: 2, row: 2 },
  { key: "water", url: water, col: 3, row: 2 },
];

// Maps (BlockKeys, face index) -> atlas texture key
// face index: 0=leftZ, 1=rightZ, 2=leftX, 3=rightX, 4=top, 5=bottom
// This follows the textureMap pattern from blocks.ts
const blockFaceToAtlasKey: Record<number, Record<number, string>> = {
  [BlockKeys.grass]: {
    [Face.leftZ]: "grassSide",
    [Face.rightZ]: "grassSide",
    [Face.leftX]: "grassSide",
    [Face.rightX]: "grassSide",
    [Face.top]: "grassTop",
    [Face.bottom]: "dirt",
  },
  [BlockKeys.stone]: {
    [Face.leftZ]: "stone", [Face.rightZ]: "stone",
    [Face.leftX]: "stone", [Face.rightX]: "stone",
    [Face.top]: "stone", [Face.bottom]: "stone",
  },
  [BlockKeys.sand]: {
    [Face.leftZ]: "sand", [Face.rightZ]: "sand",
    [Face.leftX]: "sand", [Face.rightX]: "sand",
    [Face.top]: "sand", [Face.bottom]: "sand",
  },
  [BlockKeys.dirt]: {
    [Face.leftZ]: "dirt", [Face.rightZ]: "dirt",
    [Face.leftX]: "dirt", [Face.rightX]: "dirt",
    [Face.top]: "dirt", [Face.bottom]: "dirt",
  },
  [BlockKeys.cobblestone]: {
    [Face.leftZ]: "cobblestone", [Face.rightZ]: "cobblestone",
    [Face.leftX]: "cobblestone", [Face.rightX]: "cobblestone",
    [Face.top]: "cobblestone", [Face.bottom]: "cobblestone",
  },
  [BlockKeys.leaves]: {
    [Face.leftZ]: "leavesOak", [Face.rightZ]: "leavesOak",
    [Face.leftX]: "leavesOak", [Face.rightX]: "leavesOak",
    [Face.top]: "leavesOak", [Face.bottom]: "leavesOak",
  },
  [BlockKeys.wood]: {
    [Face.leftZ]: "woodSide", [Face.rightZ]: "woodSide",
    [Face.leftX]: "woodSide", [Face.rightX]: "woodSide",
    [Face.top]: "woodTop", [Face.bottom]: "woodTop",
  },
  [BlockKeys.furnace]: {
    [Face.leftZ]: "furnaceSide",
    [Face.rightZ]: "furnaceFront",
    [Face.leftX]: "furnaceSide",
    [Face.rightX]: "furnaceSide",
    [Face.top]: "furnaceTop",
    [Face.bottom]: "furnaceTop",
  },
  [BlockKeys.oakPlanks]: {
    [Face.leftZ]: "oakPlanks", [Face.rightZ]: "oakPlanks",
    [Face.leftX]: "oakPlanks", [Face.rightX]: "oakPlanks",
    [Face.top]: "oakPlanks", [Face.bottom]: "oakPlanks",
  },
  [BlockKeys.blockOfDiamond]: {
    [Face.leftZ]: "diamondBlock", [Face.rightZ]: "diamondBlock",
    [Face.leftX]: "diamondBlock", [Face.rightX]: "diamondBlock",
    [Face.top]: "diamondBlock", [Face.bottom]: "diamondBlock",
  },
  [BlockKeys.blockOfIron]: {
    [Face.leftZ]: "ironBlock", [Face.rightZ]: "ironBlock",
    [Face.leftX]: "ironBlock", [Face.rightX]: "ironBlock",
    [Face.top]: "ironBlock", [Face.bottom]: "ironBlock",
  },
  [BlockKeys.blockOfGold]: {
    [Face.leftZ]: "goldBlock", [Face.rightZ]: "goldBlock",
    [Face.leftX]: "goldBlock", [Face.rightX]: "goldBlock",
    [Face.top]: "goldBlock", [Face.bottom]: "goldBlock",
  },
  [BlockKeys.blockOfLapis]: {
    [Face.leftZ]: "lapisBlock", [Face.rightZ]: "lapisBlock",
    [Face.leftX]: "lapisBlock", [Face.rightX]: "lapisBlock",
    [Face.top]: "lapisBlock", [Face.bottom]: "lapisBlock",
  },
  [BlockKeys.blockOfEmerald]: {
    [Face.leftZ]: "emeraldBlock", [Face.rightZ]: "emeraldBlock",
    [Face.leftX]: "emeraldBlock", [Face.rightX]: "emeraldBlock",
    [Face.top]: "emeraldBlock", [Face.bottom]: "emeraldBlock",
  },
  [BlockKeys.water]: {
    [Face.leftZ]: "water", [Face.rightZ]: "water",
    [Face.leftX]: "water", [Face.rightX]: "water",
    [Face.top]: "water", [Face.bottom]: "water",
  },
  [BlockKeys.bedrock]: {
    [Face.leftZ]: "bedrock", [Face.rightZ]: "bedrock",
    [Face.leftX]: "bedrock", [Face.rightX]: "bedrock",
    [Face.top]: "bedrock", [Face.bottom]: "bedrock",
  },
};

// Vertex color tints for special blocks (leaves have green tint)
// [r, g, b] normalized. Default is [1, 1, 1] (white = no tint)
const LEAVES_TINT: [number, number, number] = [0x63 / 0xff, 0xa9 / 0xff, 0x48 / 0xff];
const DEFAULT_TINT: [number, number, number] = [1, 1, 1];

export function getBlockTint(blockType: BlockKeys): [number, number, number] {
  if (blockType === BlockKeys.leaves) return LEAVES_TINT;
  return DEFAULT_TINT;
}

export function isTransparentBlock(blockType: BlockKeys): boolean {
  return blockType === BlockKeys.water;
}

// AO vertex weights: brightness per corner [v0_BL, v1_BR, v2_TR, v3_TL]
// Applied to the quad vertices. For edge patterns, 2 vertices are darkened.
// For corner patterns, 1 vertex is darkened. For full patterns, all are darkened uniformly.
const D_EDGE = 1.0 - 0.24; // 0.76 - edge/corner darkening
export const aoVertexWeights: Record<FaceAoType | "base", [number, number, number, number]> = {
  base: [1.0, 1.0, 1.0, 1.0],
  // Edge patterns: darken 2 vertices along one edge
  [FaceAoType.e1]: [1.0, 1.0, D_EDGE, D_EDGE],     // top edge (TR, TL dark)
  [FaceAoType.e2]: [1.0, D_EDGE, D_EDGE, 1.0],     // right edge (BR, TR dark)
  [FaceAoType.e3]: [D_EDGE, D_EDGE, 1.0, 1.0],     // bottom edge (BL, BR dark)
  [FaceAoType.e4]: [D_EDGE, 1.0, 1.0, D_EDGE],     // left edge (BL, TL dark)
  // Corner patterns: darken 1 vertex at a corner
  [FaceAoType.v1]: [1.0, 1.0, 1.0, D_EDGE],        // top-left corner (TL dark)
  [FaceAoType.v2]: [1.0, 1.0, D_EDGE, 1.0],        // top-right corner (TR dark)
  [FaceAoType.v3]: [1.0, D_EDGE, 1.0, 1.0],        // bottom-right corner (BR dark)
  [FaceAoType.v4]: [D_EDGE, 1.0, 1.0, 1.0],        // bottom-left corner (BL dark)
  // Full patterns: uniform darkening at increasing intensities
  [FaceAoType.f1]: [0.82, 0.82, 0.82, 0.82],       // intensity 0.18
  [FaceAoType.f2]: [0.78, 0.78, 0.78, 0.78],       // intensity 0.22
  [FaceAoType.f3]: [0.74, 0.74, 0.74, 0.74],       // intensity 0.26
  [FaceAoType.f4]: [0.70, 0.70, 0.70, 0.70],       // intensity 0.30
};

// Face vertex positions relative to block center (BLOCK_WIDTH=2, so half-width=1)
// 4 vertices per face: [BL, BR, TR, TL] with indices [0,1,2, 2,3,0]
export const FACE_VERTICES: Record<number, number[][]> = {
  [Face.leftZ]:  [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  [Face.rightZ]: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  [Face.leftX]:  [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
  [Face.rightX]: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
  [Face.top]:    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
  [Face.bottom]: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
};

// Face normals
export const FACE_NORMALS: Record<number, [number, number, number]> = {
  [Face.leftZ]:  [0, 0, 1],
  [Face.rightZ]: [0, 0, -1],
  [Face.leftX]:  [1, 0, 0],
  [Face.rightX]: [-1, 0, 0],
  [Face.top]:    [0, 1, 0],
  [Face.bottom]: [0, -1, 0],
};

export const ALL_FACES = [Face.leftZ, Face.rightZ, Face.leftX, Face.rightX, Face.top, Face.bottom];

// Async atlas builder
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export interface TextureAtlas {
  texture: CanvasTexture;
  uvMap: Record<string, AtlasUV>;
  opaqueMaterial: MeshLambertMaterial;
  waterMaterial: MeshLambertMaterial;
}

export async function buildTextureAtlas(): Promise<TextureAtlas> {
  const atlasWidth = ATLAS_COLS * TILE_SIZE;
  const atlasHeight = ATLAS_ROWS * TILE_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d")!;

  // Disable image smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  // Load and draw all textures
  await Promise.all(
    textureEntries.map(async (entry) => {
      const img = await loadImage(entry.url);
      ctx.drawImage(img, entry.col * TILE_SIZE, entry.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    })
  );

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;

  // Build UV map
  // CanvasTexture has flipY=true by default:
  // Canvas top (row 0) -> UV v=1, Canvas bottom -> UV v=0
  const uvMap: Record<string, AtlasUV> = {};
  for (const entry of textureEntries) {
    uvMap[entry.key] = {
      uMin: (entry.col * TILE_SIZE) / atlasWidth,
      vMin: 1 - ((entry.row + 1) * TILE_SIZE) / atlasHeight,
      uMax: ((entry.col + 1) * TILE_SIZE) / atlasWidth,
      vMax: 1 - (entry.row * TILE_SIZE) / atlasHeight,
    };
  }

  const opaqueMaterial = new MeshLambertMaterial({
    map: texture,
    vertexColors: true,
  });

  const waterMaterial = new MeshLambertMaterial({
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });

  return { texture, uvMap, opaqueMaterial, waterMaterial };
}

// Get atlas UV for a specific block type and face
export function getBlockFaceAtlasKey(blockType: BlockKeys, face: Face): string {
  return blockFaceToAtlasKey[blockType]?.[face] || "stone";
}

// Export for use in workers (serializable data only)
export function getAtlasUVData(uvMap: Record<string, AtlasUV>) {
  return { blockFaceToAtlasKey, uvMap };
}
