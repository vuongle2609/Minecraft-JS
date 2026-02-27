import { Face } from "@/constants/block";
import {
  FACE_VERTICES,
  FACE_NORMALS,
  ALL_FACES,
  aoVertexWeights,
  getBlockFaceAtlasKey,
  getBlockTint,
  isTransparentBlock,
  type AtlasUV,
} from "@/constants/textureAtlas";
import { BlockKeys, FaceAoType } from "@/type";

export interface ChunkGeometryData {
  // Opaque geometry
  opaquePositions: Float32Array;
  opaqueNormals: Float32Array;
  opaqueUvs: Float32Array;
  opaqueColors: Float32Array;
  opaqueIndices: Uint32Array;
  // Transparent geometry (water)
  transparentPositions: Float32Array;
  transparentNormals: Float32Array;
  transparentUvs: Float32Array;
  transparentColors: Float32Array;
  transparentIndices: Uint32Array;
}

export interface BlockData {
  x: number;
  y: number;
  z: number;
  type: BlockKeys;
}

export function buildChunkGeometry(
  blocks: BlockData[],
  facesToRender: Record<string, Record<number, boolean>>,
  blockOcclusion: Record<string, Record<number, null | FaceAoType>>,
  atlasUVMap: Record<string, AtlasUV>
): ChunkGeometryData {
  // Pre-count faces for buffer allocation
  let opaqueCount = 0;
  let transparentCount = 0;

  for (const block of blocks) {
    const key = `${block.x}_${block.y}_${block.z}`;
    const faces = facesToRender[key];
    if (!faces) continue;

    const isTransparent = isTransparentBlock(block.type);
    for (const face of ALL_FACES) {
      if (faces[face]) {
        if (isTransparent) transparentCount++;
        else opaqueCount++;
      }
    }
  }

  // Allocate buffers: 4 vertices per face, 6 indices per face
  const opaquePositions = new Float32Array(opaqueCount * 4 * 3);
  const opaqueNormals = new Float32Array(opaqueCount * 4 * 3);
  const opaqueUvs = new Float32Array(opaqueCount * 4 * 2);
  const opaqueColors = new Float32Array(opaqueCount * 4 * 3);
  const opaqueIndices = new Uint32Array(opaqueCount * 6);

  const transparentPositions = new Float32Array(transparentCount * 4 * 3);
  const transparentNormals = new Float32Array(transparentCount * 4 * 3);
  const transparentUvs = new Float32Array(transparentCount * 4 * 2);
  const transparentColors = new Float32Array(transparentCount * 4 * 3);
  const transparentIndices = new Uint32Array(transparentCount * 6);

  let oFace = 0; // opaque face counter
  let tFace = 0; // transparent face counter

  for (const block of blocks) {
    const key = `${block.x}_${block.y}_${block.z}`;
    const faces = facesToRender[key];
    if (!faces) continue;

    const occlusion = blockOcclusion[key];
    const isTransparent = isTransparentBlock(block.type);
    const tint = getBlockTint(block.type);

    for (const face of ALL_FACES) {
      if (!faces[face]) continue;

      const positions = isTransparent ? transparentPositions : opaquePositions;
      const normals = isTransparent ? transparentNormals : opaqueNormals;
      const uvs = isTransparent ? transparentUvs : opaqueUvs;
      const colors = isTransparent ? transparentColors : opaqueColors;
      const indices = isTransparent ? transparentIndices : opaqueIndices;
      const faceIdx = isTransparent ? tFace : oFace;

      const verts = FACE_VERTICES[face];
      const normal = FACE_NORMALS[face];

      // Get atlas UV for this block type + face
      const atlasKey = getBlockFaceAtlasKey(block.type, face as Face);
      const uv = atlasUVMap[atlasKey];
      if (!uv) continue;

      // Get AO vertex weights
      const aoType = occlusion?.[face] ?? null;
      const aoKey = aoType !== null ? aoType : "base";
      const weights = aoVertexWeights[aoKey as FaceAoType | "base"] || aoVertexWeights.base;

      const baseVertex = faceIdx * 4;
      const basePos = faceIdx * 4 * 3;
      const baseUV = faceIdx * 4 * 2;
      const baseColor = faceIdx * 4 * 3;
      const baseIndex = faceIdx * 6;

      // 4 vertices: BL, BR, TR, TL
      const faceUvs = [
        [uv.uMin, uv.vMin], // BL
        [uv.uMax, uv.vMin], // BR
        [uv.uMax, uv.vMax], // TR
        [uv.uMin, uv.vMax], // TL
      ];

      for (let v = 0; v < 4; v++) {
        const vert = verts[v];
        positions[basePos + v * 3] = block.x + vert[0];
        positions[basePos + v * 3 + 1] = block.y + vert[1];
        positions[basePos + v * 3 + 2] = block.z + vert[2];

        normals[basePos + v * 3] = normal[0];
        normals[basePos + v * 3 + 1] = normal[1];
        normals[basePos + v * 3 + 2] = normal[2];

        uvs[baseUV + v * 2] = faceUvs[v][0];
        uvs[baseUV + v * 2 + 1] = faceUvs[v][1];

        // Vertex color = tint * AO brightness
        const brightness = weights[v];
        colors[baseColor + v * 3] = tint[0] * brightness;
        colors[baseColor + v * 3 + 1] = tint[1] * brightness;
        colors[baseColor + v * 3 + 2] = tint[2] * brightness;
      }

      // Indices: [0,1,2, 2,3,0]
      indices[baseIndex] = baseVertex;
      indices[baseIndex + 1] = baseVertex + 1;
      indices[baseIndex + 2] = baseVertex + 2;
      indices[baseIndex + 3] = baseVertex + 2;
      indices[baseIndex + 4] = baseVertex + 3;
      indices[baseIndex + 5] = baseVertex;

      if (isTransparent) tFace++;
      else oFace++;
    }
  }

  return {
    opaquePositions,
    opaqueNormals,
    opaqueUvs,
    opaqueColors,
    opaqueIndices,
    transparentPositions,
    transparentNormals,
    transparentUvs,
    transparentColors,
    transparentIndices,
  };
}
