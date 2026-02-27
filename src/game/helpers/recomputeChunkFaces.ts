import { BLOCK_WIDTH } from "@/constants";
import { Face } from "@/constants/block";
import { BlockKeys, FaceAoType } from "@/type";
import { ChunkDataStore } from "@/game/classes/chunkDataStore";
import { nameFromCoordinate } from "./nameFromCoordinate";
import { getFacesOcclusion } from "./calculateAO";

const ALL_FACES = [Face.leftZ, Face.rightZ, Face.leftX, Face.rightX, Face.top, Face.bottom];

function shouldRenderFace(neighborType: BlockKeys | undefined, blockType: BlockKeys): boolean {
  // Water face: render if neighbor is not water
  if (neighborType === BlockKeys.water) {
    return blockType !== BlockKeys.water;
  }
  // Neighbor exists and is solid: don't render
  if (neighborType !== undefined) return false;
  // No neighbor: render
  return true;
}

const FACE_OFFSETS: Record<number, [number, number, number]> = {
  [Face.leftZ]: [0, 0, BLOCK_WIDTH],
  [Face.rightZ]: [0, 0, -BLOCK_WIDTH],
  [Face.leftX]: [BLOCK_WIDTH, 0, 0],
  [Face.rightX]: [-BLOCK_WIDTH, 0, 0],
  [Face.top]: [0, BLOCK_WIDTH, 0],
  [Face.bottom]: [0, -BLOCK_WIDTH, 0],
};

// Lightweight proxy that wraps ChunkDataStore for getFacesOcclusion compatibility.
// Avoids building a massive map from all global blocks (was the #1 bottleneck).
function createStoreLookup(store: ChunkDataStore) {
  return {
    get(key: string) {
      const type = store.getBlock(key);
      return type !== undefined ? { type } : undefined;
    },
  } as Map<string, { type: BlockKeys }>;
}

// Recompute facesToRender and blockOcclusion for all blocks in a chunk
// Uses ChunkDataStore (which includes all loaded chunks) for neighbor lookups
export function recomputeChunkFaces(
  store: ChunkDataStore,
  chunkBlocks: Map<string, BlockKeys>
): {
  facesToRender: Record<string, Record<number, boolean>>;
  blockOcclusion: Record<string, Record<number, null | FaceAoType>>;
} {
  const facesToRender: Record<string, Record<number, boolean>> = {};
  const blockOcclusion: Record<string, Record<number, null | FaceAoType>> = {};

  // Proxy for AO computation — avoids iterating all global blocks
  const blockLookup = createStoreLookup(store);

  for (const [key, type] of chunkBlocks) {
    // Skip destroyed blocks (type 0 shouldn't be in store, but be safe)
    if (!type) continue;

    const parts = key.split("_");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);

    const faceResult: Record<number, boolean> = {};
    let hasAnyFace = false;

    for (const face of ALL_FACES) {
      const offset = FACE_OFFSETS[face];
      const nx = x + offset[0];
      const ny = y + offset[1];
      const nz = z + offset[2];
      const neighborKey = nameFromCoordinate(nx, ny, nz);
      const neighborType = store.getBlock(neighborKey);

      let shouldRender = shouldRenderFace(neighborType, type);

      // Bedrock: only render top face
      if (type === BlockKeys.bedrock && face !== Face.top) {
        shouldRender = false;
      }

      faceResult[face] = shouldRender;
      if (shouldRender) hasAnyFace = true;
    }

    if (hasAnyFace) {
      facesToRender[key] = faceResult;
      blockOcclusion[key] = getFacesOcclusion([x, y, z], blockLookup);
    }
  }

  return { facesToRender, blockOcclusion };
}
