import { Vector3 } from "three";

import { BLOCK_WIDTH } from "@/constants";
import { Face } from "@/constants/block";
import { BlockKeys } from "@/type";
import { ChunkDataStore } from "@/game/classes/chunkDataStore";
import { nameFromCoordinate } from "./nameFromCoordinate";

export interface VoxelHit {
  x: number;
  y: number;
  z: number;
  face: Face;
  type: BlockKeys;
  distance: number;
}

// DDA voxel traversal algorithm
// Steps through the voxel grid along the ray and checks for solid blocks
export function voxelRaycast(
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
  store: ChunkDataStore
): VoxelHit | null {
  // Normalize direction
  const dir = direction.clone().normalize();

  // Convert to voxel grid coordinates
  // Blocks are at even positions: ..., -4, -2, 0, 2, 4, ...
  // Block at world position (bx, by, bz) occupies [bx-1, bx+1] x [by-1, by+1] x [bz-1, bz+1]
  // To find which voxel a point is in: round to nearest even number
  const half = BLOCK_WIDTH / 2; // 1

  // Current voxel grid position (block coordinates)
  let vx = Math.round(origin.x / BLOCK_WIDTH) * BLOCK_WIDTH;
  let vy = Math.round(origin.y / BLOCK_WIDTH) * BLOCK_WIDTH;
  let vz = Math.round(origin.z / BLOCK_WIDTH) * BLOCK_WIDTH;

  // Step direction (+BLOCK_WIDTH or -BLOCK_WIDTH)
  const stepX = dir.x >= 0 ? BLOCK_WIDTH : -BLOCK_WIDTH;
  const stepY = dir.y >= 0 ? BLOCK_WIDTH : -BLOCK_WIDTH;
  const stepZ = dir.z >= 0 ? BLOCK_WIDTH : -BLOCK_WIDTH;

  // Distance to next voxel boundary along each axis
  // The voxel boundary is at voxel_center +/- half
  const nextBoundX = dir.x >= 0 ? vx + half : vx - half;
  const nextBoundY = dir.y >= 0 ? vy + half : vy - half;
  const nextBoundZ = dir.z >= 0 ? vz + half : vz - half;

  // tMax: parametric distance along ray to the next boundary
  let tMaxX = dir.x !== 0 ? (nextBoundX - origin.x) / dir.x : Infinity;
  let tMaxY = dir.y !== 0 ? (nextBoundY - origin.y) / dir.y : Infinity;
  let tMaxZ = dir.z !== 0 ? (nextBoundZ - origin.z) / dir.z : Infinity;

  // tDelta: parametric distance to cross one full voxel
  const tDeltaX = dir.x !== 0 ? Math.abs(BLOCK_WIDTH / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(BLOCK_WIDTH / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(BLOCK_WIDTH / dir.z) : Infinity;

  // Track which face we entered from
  let lastFace: Face = Face.top;
  let t = 0;

  // Don't check the block the camera is inside
  const startKey = nameFromCoordinate(vx, vy, vz);
  const startBlock = store.getBlock(startKey);
  const skipStart = startBlock !== undefined;

  for (let i = 0; i < 100; i++) {
    // Check current voxel (skip the starting block if camera is inside it)
    if (!(i === 0 && skipStart)) {
      const key = nameFromCoordinate(vx, vy, vz);
      const blockType = store.getBlock(key);

      if (blockType !== undefined) {
        return {
          x: vx,
          y: vy,
          z: vz,
          face: lastFace,
          type: blockType,
          distance: t,
        };
      }
    }

    // Step to next voxel (advance along the axis with smallest tMax)
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        if (t > maxDistance) return null;
        vx += stepX;
        tMaxX += tDeltaX;
        lastFace = stepX > 0 ? Face.rightX : Face.leftX;
      } else {
        t = tMaxZ;
        if (t > maxDistance) return null;
        vz += stepZ;
        tMaxZ += tDeltaZ;
        lastFace = stepZ > 0 ? Face.rightZ : Face.leftZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        t = tMaxY;
        if (t > maxDistance) return null;
        vy += stepY;
        tMaxY += tDeltaY;
        lastFace = stepY > 0 ? Face.bottom : Face.top;
      } else {
        t = tMaxZ;
        if (t > maxDistance) return null;
        vz += stepZ;
        tMaxZ += tDeltaZ;
        lastFace = stepZ > 0 ? Face.rightZ : Face.leftZ;
      }
    }
  }

  return null;
}
