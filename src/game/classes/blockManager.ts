import {
  BoxGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import { Face } from "@/constants/block";
import blocks from "@/constants/blocks";
import { type AtlasUV } from "@/constants/textureAtlas";
import { getChunkCoordinate } from "@/game/helpers/chunkHelpers";
import {
  nameChunkFromCoordinate,
  nameFromCoordinate,
} from "@/game/helpers/nameFromCoordinate";
import { BlockKeys, FaceAoType } from "@/type";
import { voxelRaycast, VoxelHit } from "@/game/helpers/voxelRaycast";
import {
  buildChunkGeometry,
  BlockData,
} from "@/game/helpers/chunkGeometryBuilder";
import { recomputeChunkFaces } from "@/game/helpers/recomputeChunkFaces";

import { BLOCK_WIDTH, CHUNK_SIZE } from "@/constants";
import BaseEntity, { BasePropsType } from "./baseEntity";
import { ChunkDataStore } from "./chunkDataStore";
import { ChunkMesh } from "./chunkMesh";
import InventoryManager from "./inventoryManager";

const { leftX, leftZ, bottom, rightX, rightZ, top } = Face;

interface PropsType {
  inventoryManager: InventoryManager;
}

export default class BlockManager extends BaseEntity {
  inventoryManager: InventoryManager;

  currentPlaceSound: HTMLAudioElement;

  currentBreakSound: HTMLAudioElement;

  // Persistent block overrides for save data
  blocksWorldChunk: Record<string, Record<string, BlockKeys | 0>> = {};

  chunksActive: string[] = [];

  // New: lightweight block data store
  chunkDataStore = new ChunkDataStore();

  // New: chunk meshes (merged geometry per chunk)
  chunkMeshes: Map<string, ChunkMesh> = new Map();

  // Atlas data (set during initialization)
  atlasUVMap: Record<string, AtlasUV> = {};
  opaqueMaterial: MeshLambertMaterial | null = null;
  waterMaterial: MeshLambertMaterial | null = null;

  disposeBlockManager: Function;

  blockDisplayHover = new Mesh(
    new BoxGeometry(BLOCK_WIDTH + 0.01, BLOCK_WIDTH + 0.01, BLOCK_WIDTH + 0.01),
    new MeshStandardMaterial({
      wireframe: true,
      visible: true,
    })
  );

  constructor(props: BasePropsType & PropsType) {
    super(props);

    this.inventoryManager = props.inventoryManager;
    this.blocksWorldChunk = props.worldStorage?.blocksWorldChunk || {};
  }

  setAtlas(
    uvMap: Record<string, AtlasUV>,
    opaqueMaterial: MeshLambertMaterial,
    waterMaterial: MeshLambertMaterial
  ) {
    this.atlasUVMap = uvMap;
    this.opaqueMaterial = opaqueMaterial;
    this.waterMaterial = waterMaterial;
  }

  async initialize() {
    this.blockDisplayHover.name = "helper";
    this.scene?.add(this.blockDisplayHover);

    const eventMouseDown = this.onMouseDown.bind(this);

    document.addEventListener("mousedown", eventMouseDown, false);

    this.disposeBlockManager = () => {
      document.removeEventListener("mousedown", eventMouseDown, false);
    };

    this.worker?.addEventListener("message", (e) => {
      if (e.data.type === "renderPlaceBlock") {
        const { position, type } = e.data.data;

        this.handleRenderPlaceBlock(position, type);
      }
    });
  }

  // Get the targeted block using DDA voxel raycasting
  getIntersectBlock(): VoxelHit | null {
    if (!this.camera || !this.scene || !this.control?.isLocked) return null;

    const origin = this.camera.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);

    return voxelRaycast(origin, direction, 12, this.chunkDataStore);
  }

  handleHoverBlock() {
    const hit = this.getIntersectBlock();

    if (!hit) {
      this.blockDisplayHover.visible = false;
      return;
    }

    if (hit.type == BlockKeys.water) {
      this.blockDisplayHover.visible = false;
      return;
    }

    this.blockDisplayHover.visible = true;
    this.blockDisplayHover.position.set(hit.x, hit.y, hit.z);
  }

  handleGetBlock() {
    const hit = this.getIntersectBlock();
    if (!hit) return;

    if (!blocks[hit.type].renderInInventory) return;

    this.inventoryManager.inventory[this.inventoryManager.currentFocusIndex] =
      hit.type;

    this.inventoryManager.renderHotbar();

    if (this.inventoryManager.currentFocus)
      this.inventoryManager.renderLabelFocusItem(
        blocks[this.inventoryManager.currentFocus].name
      );
  }

  handleBreakBlock() {
    const hit = this.getIntersectBlock();
    if (!hit) return;

    const { x, y, z, type } = hit;

    if (type == BlockKeys.bedrock) return;
    if (type == BlockKeys.water) return;

    // Remove from data store
    const chunk = getChunkCoordinate(x, z);
    const chunkName = nameChunkFromCoordinate(chunk.x, chunk.z);
    const coordKey = nameFromCoordinate(x, y, z);

    this.chunkDataStore.removeBlock(chunkName, coordKey);

    // Notify physics worker
    this.removeBlockWorker({ position: [x, y, z] });

    // Update persistence
    this.blocksWorldChunk[chunkName] = this.blocksWorldChunk[chunkName] || {};
    this.blocksWorldChunk[chunkName][coordKey] = 0;

    // Rebuild affected chunk meshes
    this.rebuildAffectedChunks(x, y, z);

    // Play sound
    if (this.currentBreakSound) {
      this.currentBreakSound.pause();
      this.currentBreakSound.currentTime = 0;
    }

    this.currentBreakSound = blocks[type].break;
    this.currentBreakSound.play();
  }

  handleRenderPlaceBlock(blockPositionArr: number[], placeType: BlockKeys) {
    const [x, y, z] = blockPositionArr;

    // Add to data store
    const chunk = getChunkCoordinate(x, z);
    const chunkName = nameChunkFromCoordinate(chunk.x, chunk.z);
    const coordKey = nameFromCoordinate(x, y, z);

    this.chunkDataStore.setBlock(chunkName, coordKey, placeType);

    // Update persistence
    this.blocksWorldChunk[chunkName] = this.blocksWorldChunk[chunkName] || {};
    this.blocksWorldChunk[chunkName][coordKey] = placeType;

    // Rebuild affected chunk meshes
    this.rebuildAffectedChunks(x, y, z);

    // Play sound
    if (this.currentPlaceSound) {
      this.currentPlaceSound.pause();
      this.currentPlaceSound.currentTime = 0;
    }

    this.currentPlaceSound = blocks[placeType].place;
    this.currentPlaceSound.play();
  }

  handlePlaceBlock() {
    const hit = this.getIntersectBlock();
    if (!hit) return;

    const { x, y, z, face } = hit;

    const blockPosition = new Vector3();

    switch (face) {
      case leftX:
        blockPosition.set(x + BLOCK_WIDTH, y, z);
        break;
      case rightX:
        blockPosition.set(x - BLOCK_WIDTH, y, z);
        break;
      case top:
        blockPosition.set(x, y + BLOCK_WIDTH, z);
        break;
      case bottom:
        blockPosition.set(x, y - BLOCK_WIDTH, z);
        break;
      case leftZ:
        blockPosition.set(x, y, z + BLOCK_WIDTH);
        break;
      case rightZ:
        blockPosition.set(x, y, z - BLOCK_WIDTH);
        break;
    }

    const placeType = this.inventoryManager.currentFocus;

    if (placeType) {
      this.updateBlockWorker({
        position: [blockPosition.x, blockPosition.y, blockPosition.z],
        type: placeType,
      });
    }
  }

  // Rebuild chunk meshes affected by a block change at (bx, by, bz)
  rebuildAffectedChunks(bx: number, by: number, bz: number) {
    const mainChunk = getChunkCoordinate(bx, bz);
    const mainChunkName = nameChunkFromCoordinate(mainChunk.x, mainChunk.z);
    this.rebuildChunkMesh(mainChunkName);

    // Only rebuild neighbor chunks if block is on this chunk's boundary
    const chunkWorldSize = CHUNK_SIZE * BLOCK_WIDTH;
    const localX = bx - mainChunk.x * chunkWorldSize;
    const localZ = bz - mainChunk.z * chunkWorldSize;
    const maxLocal = (CHUNK_SIZE - 1) * BLOCK_WIDTH;

    if (localX === 0) {
      const n = nameChunkFromCoordinate(mainChunk.x - 1, mainChunk.z);
      if (n !== mainChunkName) this.rebuildChunkMesh(n);
    }
    if (localX === maxLocal) {
      const n = nameChunkFromCoordinate(mainChunk.x + 1, mainChunk.z);
      if (n !== mainChunkName) this.rebuildChunkMesh(n);
    }
    if (localZ === 0) {
      const n = nameChunkFromCoordinate(mainChunk.x, mainChunk.z - 1);
      if (n !== mainChunkName) this.rebuildChunkMesh(n);
    }
    if (localZ === maxLocal) {
      const n = nameChunkFromCoordinate(mainChunk.x, mainChunk.z + 1);
      if (n !== mainChunkName) this.rebuildChunkMesh(n);
    }
  }

  // Rebuild the mesh for a single chunk using current ChunkDataStore data
  rebuildChunkMesh(chunkName: string) {
    if (!this.opaqueMaterial || !this.waterMaterial) return;

    const chunkBlocks = this.chunkDataStore.getChunkBlocks(chunkName);
    if (!chunkBlocks) return;

    // Recompute faces and AO
    const { facesToRender, blockOcclusion } = recomputeChunkFaces(
      this.chunkDataStore,
      chunkBlocks
    );

    // Build block data array
    const blockDataArray: BlockData[] = [];
    for (const [key, type] of chunkBlocks) {
      const parts = key.split("_");
      blockDataArray.push({
        x: Number(parts[0]),
        y: Number(parts[1]),
        z: Number(parts[2]),
        type,
      });
    }

    // Build geometry
    const geometryData = buildChunkGeometry(
      blockDataArray,
      facesToRender,
      blockOcclusion,
      this.atlasUVMap
    );

    // Update or create ChunkMesh
    let chunkMesh = this.chunkMeshes.get(chunkName);
    if (!chunkMesh) {
      chunkMesh = new ChunkMesh(chunkName, this.opaqueMaterial, this.waterMaterial);
      this.chunkMeshes.set(chunkName, chunkMesh);
      this.scene?.add(chunkMesh.group);
    }

    chunkMesh.buildFromGeometryData(geometryData);
  }

  removeBlockWorker({ position }: { position: number[] }) {
    this.worker?.postMessage({
      type: "removeBlock",
      data: {
        position,
      },
    });
  }

  updateBlockWorker({
    position,
    type,
  }: {
    position: number[];
    type: BlockKeys;
  }) {
    this.worker?.postMessage({
      type: "requestPlaceBlock",
      data: {
        position,
        type,
      },
    });
  }

  onMouseDown(e: MouseEvent) {
    switch (e.button) {
      case 0:
        this.handleBreakBlock();
        break;
      case 1:
        this.handleGetBlock();
        break;
      case 2:
        this.handlePlaceBlock();
    }
  }

  update() {
    this.handleHoverBlock();
  }
}
