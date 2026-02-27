import { BLOCK_WIDTH } from "@/constants";
import { Face } from "@/constants/block";
import { BlockKeys, FaceAoType } from "@/type";
import { nameFromCoordinate } from "./nameFromCoordinate";

const { leftZ, rightZ, leftX, rightX, bottom, top } = Face;

interface BlockLike {
  type: BlockKeys;
  position?: number[];
}

const getBlockOffset = (
  positionOffset: number[],
  position: number[],
  blocksInChunk: Map<string, BlockLike> = new Map()
) => {
  const [x1, y1, z1] = positionOffset;
  const [x, y, z] = position;

  const queryResult = blocksInChunk.get(
    nameFromCoordinate(
      x + x1 * BLOCK_WIDTH,
      y + y1 * BLOCK_WIDTH,
      z + z1 * BLOCK_WIDTH
    )
  );

  return queryResult?.type;
};

export const getFacesOcclusion = (
  position: number[],
  blocksInChunk: Map<string, BlockLike> = new Map()
) => {
  let blockTopType = null;

  const blockTop = getBlockOffset([0, 1, 0], position, blocksInChunk);

  if (!blockTop) {
    // corner
    const blockTopC1 = getBlockOffset([1, 1, 1], position, blocksInChunk);
    if (blockTopC1) blockTopType = FaceAoType.v3;

    const blockTopC2 = getBlockOffset([1, 1, -1], position, blocksInChunk);
    if (blockTopC2) blockTopType = FaceAoType.v2;

    const blockTopC3 = getBlockOffset([-1, 1, 1], position, blocksInChunk);
    if (blockTopC3) blockTopType = FaceAoType.v4;

    const blockTopC4 = getBlockOffset([-1, 1, -1], position, blocksInChunk);
    if (blockTopC4) blockTopType = FaceAoType.v1;

    // edge
    const blockTopE1 = getBlockOffset([-1, 1, 0], position, blocksInChunk);
    if (blockTopE1) blockTopType = FaceAoType.e4;

    const blockTopE2 = getBlockOffset([1, 1, 0], position, blocksInChunk);
    if (blockTopE2) blockTopType = FaceAoType.e2;

    const blockTopE3 = getBlockOffset([0, 1, 1], position, blocksInChunk);
    if (blockTopE3) blockTopType = FaceAoType.e3;

    const blockTopE4 = getBlockOffset([0, 1, -1], position, blocksInChunk);
    if (blockTopE4) blockTopType = FaceAoType.e1;

    const coverBlocksLength = [
      blockTopE1,
      blockTopE2,
      blockTopE3,
      blockTopE4,
    ].filter(Boolean).length;
    if (coverBlocksLength === 2) blockTopType = FaceAoType.f1;
    if (coverBlocksLength === 3) blockTopType = FaceAoType.f2;
    if (coverBlocksLength === 4) blockTopType = FaceAoType.f3;

    // full top
    const blockTopLevel4 = getBlockOffset([0, 5, 0], position, blocksInChunk);
    if (blockTopLevel4) blockTopType = FaceAoType.f1;

    const blockTopLevel3 = getBlockOffset([0, 4, 0], position, blocksInChunk);
    if (blockTopLevel3) blockTopType = FaceAoType.f2;

    const blockTopLevel2 = getBlockOffset([0, 3, 0], position, blocksInChunk);
    if (blockTopLevel2) blockTopType = FaceAoType.f3;

    const blockTopLevel1 = getBlockOffset([0, 2, 0], position, blocksInChunk);
    if (blockTopLevel1) blockTopType = FaceAoType.f4;
  }

  const valueToSet = {
    [leftZ]: FaceAoType.f3,
    [rightZ]: FaceAoType.f1,
    [leftX]: null,
    [rightX]: null,
    [bottom]: FaceAoType.f4,
    [top]: blockTopType,
  };

  return valueToSet;
};
