import { DEFAULT_CHUNK_VIEW, BLOCK_WIDTH, CHUNK_SIZE } from "@/constants";
import { Face } from "@/constants/block";
import {
  nameChunkFromCoordinate,
  nameFromCoordinate,
} from "@/game/helpers/nameFromCoordinate";
import { BlockKeys, FaceAoType } from "@/type";

import { throttle } from "@/UI/utils/throttle";
import { calNeighborsOffset } from "../helpers/calNeighborsOffset";
import { getChunkNeighborsCoor } from "../helpers/chunkHelpers";
import { BasePropsType } from "./baseEntity";
import BlockManager from "./blockManager";
import InventoryManager from "./inventoryManager";
import { ChunkMesh } from "./chunkMesh";
import {
  buildChunkGeometry,
  BlockData,
} from "@/game/helpers/chunkGeometryBuilder";

// Distance beyond which chunks are hidden (fog fully obscures)
// At fog density 0.004, visibility ~= 3/0.004 = 750 units
const FOG_CUTOFF_DISTANCE = 700;

interface PropsType {
  inventoryManager: InventoryManager;
}

type ChunkPendingQueueType = {
  type: number | undefined;
  chunkBlocksCustom: Record<string, 0 | BlockKeys>;
  neighborsChunkData: Record<string, Record<string, 0 | BlockKeys>>;
  seed: number | undefined;
  x: number;
  z: number;
  name: string;
};

type ChunkWorkerDataType = {
  chunkName: string;
  arrayBlocksData: Int32Array;
  facesToRender: Record<string, Record<Face, boolean>>;
  blockOcclusion: Record<string, Record<Face, null | FaceAoType>>;
};

export default class ChunkManager extends BlockManager {
  chunkRendered = new Map();

  chunkRenderQueue: ChunkWorkerDataType[] = [];

  chunkPendingQueue: ChunkPendingQueueType[] = [];
  currentChunk = [0, 0];

  neighborOffset = calNeighborsOffset(DEFAULT_CHUNK_VIEW);

  // Track which block keys belong to each chunk (for data store management)
  chunksBlockKeys: Record<string, string[]> = {};

  createWorker = (index: number) => ({
    worker: new Worker(new URL("../terrant/worker", import.meta.url), {
      type: "module",
    }),
    isBusy: false,
    index,
    currentProcessChunk: null,
  });

  // Dynamic worker pool based on hardware
  workerCount = Math.min(
    Math.max((navigator.hardwareConcurrency || 4) - 2, 4),
    16
  );

  chunkWorkers = Array(this.workerCount)
    .fill(0)
    .reduce((prev, _, index) => {
      return {
        ...prev,
        [index]: this.createWorker(index),
      };
    }, {}) as Record<
    string | number,
    {
      worker: Worker;
      isBusy: boolean;
      index: number;
      currentProcessChunk: string | null;
    }
  >;

  startWorker(
    workerChunk: {
      worker: Worker;
      isBusy: boolean;
      index: number;
      currentProcessChunk: string | null;
    },
    data?: ChunkPendingQueueType
  ) {
    if (data) {
      workerChunk.currentProcessChunk = data.name;
      workerChunk.isBusy = true;
      workerChunk.worker.postMessage({
        type: "getBlocksInChunk",
        data,
      });
    }
  }

  chunkPendingQueueProxy = {
    unshift: (x: number, z: number) => {
      const neighborsChunkData: Record<
        string,
        Record<string, 0 | BlockKeys>
      > = {};

      const neighbors = getChunkNeighborsCoor(x, z);

      Object.keys(neighbors).forEach((key) => {
        neighborsChunkData[key] = this.blocksWorldChunk[key] || {};
      });

      const chunkName = nameChunkFromCoordinate(x, z);

      const workerData = {
        x,
        z,
        type: this.worldStorage?.worldType,
        chunkBlocksCustom: this.blocksWorldChunk[chunkName] || {},
        neighborsChunkData,
        seed: this.worldStorage?.seed,
        name: chunkName,
      };

      this.chunkPendingQueue.unshift(workerData);

      const freeOrInactiveWorker = Object.values(this.chunkWorkers).find(
        (chunk) => {
          const currentProcessKey =
            this.chunkWorkers[chunk.index].currentProcessChunk;

          const isProccessDeadJob =
            currentProcessKey && !this.chunksActive.includes(currentProcessKey);

          if (isProccessDeadJob) {
            this.chunkWorkers[chunk.index].worker.terminate();

            this.chunkWorkers[chunk.index] = this.createWorker(chunk.index);

            this.setUpWorker(chunk.index);
          }

          return !this.chunkWorkers[chunk.index].isBusy || isProccessDeadJob;
        }
      );

      if (freeOrInactiveWorker) {
        this.startWorker(
          freeOrInactiveWorker,
          this.chunkPendingQueueProxy.pop()
        );
      }
    },
    pop: () => {
      return this.chunkPendingQueue.pop();
    },
    filterInactive: () => {
      this.chunkPendingQueue = this.chunkPendingQueue.filter((item) =>
        this.chunksActive.includes(item.name)
      );
    },
  };

  setUpWorker(index?: number) {
    const setupWithIndex = (index: number | string) => {
      const currWorker = this.chunkWorkers[index];

      currWorker.worker.onmessage = (e) => {
        const { chunkName, facesToRender, arrayBlocksData, blockOcclusion } =
          e.data;

        currWorker.currentProcessChunk = null;
        currWorker.isBusy = false;

        if (!this.chunkRendered.get(chunkName)) {
          this.chunkRendered.set(chunkName, true);
          this.chunkRenderQueue.unshift({
            chunkName,
            arrayBlocksData: Array.from(arrayBlocksData) as any,
            facesToRender,
            blockOcclusion,
          });
        }

        this.worker?.postMessage(
          {
            type: "addBlocks",
            data: {
              arrayBlocksData,
            },
          },
          [arrayBlocksData.buffer]
        );

        this.startWorker(currWorker, this.chunkPendingQueueProxy.pop());
      };
    };

    if (index !== undefined) {
      setupWithIndex(index);

      return;
    }

    Object.keys(this.chunkWorkers).forEach(setupWithIndex);
  }

  constructor(props: BasePropsType & PropsType) {
    super(props);

    this.setUpWorker();
    this.initialize();
  }

  async initialize() {
    super.initialize();
  }

  handleRequestChunks(currentChunk: { x: number; z: number }) {
    this.currentChunk[0] = currentChunk.x;
    this.currentChunk[1] = currentChunk.z;

    const chunkDetail: {
      chunk: {
        x: number;
        z: number;
      };
      chunkName: string;
    }[] = [];

    const neighborChunksKeys = this.neighborOffset.map((offset) => {
      const chunk = {
        x: currentChunk.x + offset.x,
        z: currentChunk.z + offset.z,
      };

      const chunkName = nameChunkFromCoordinate(chunk.x, chunk.z);

      chunkDetail.push({
        chunk,
        chunkName,
      });

      return chunkName;
    });

    this.handleClearChunks(neighborChunksKeys);

    this.chunksActive = neighborChunksKeys;
    this.chunkPendingQueueProxy.filterInactive();

    // Sort by distance from player (closest first)
    chunkDetail.sort((a, b) => {
      const distA =
        Math.abs(a.chunk.x - currentChunk.x) +
        Math.abs(a.chunk.z - currentChunk.z);
      const distB =
        Math.abs(b.chunk.x - currentChunk.x) +
        Math.abs(b.chunk.z - currentChunk.z);
      return distA - distB;
    });

    chunkDetail.forEach(({ chunkName, chunk }) => {
      this.handleAssignWorkerChunk(chunkName, chunk);
    });
  }

  handleRenderChunksInQueue() {
    const startTime = performance.now();
    const TIME_BUDGET_MS = 8; // allow 8ms per frame for chunk rendering

    while (
      this.chunkRenderQueue.length > 0 &&
      performance.now() - startTime < TIME_BUDGET_MS
    ) {
      const data = this.chunkRenderQueue.pop();

      if (!data) break;

      const { chunkName, arrayBlocksData, facesToRender, blockOcclusion } = data;

      if (!this.chunksActive.includes(chunkName)) continue;

      this.handleRenderChunkBlocks(
        chunkName,
        arrayBlocksData,
        facesToRender,
        blockOcclusion
      );
    }
  }

  renderChunk = throttle(this.handleRenderChunksInQueue.bind(this), 0);

  validateChunk = throttle(this.handleValidateChunkRendered.bind(this), 1000);

  handleValidateChunkRendered(currentChunk: { x: number; z: number }) {
    const isIncludeInWorker = (chunkname: string) => {
      return Object.values(this.chunkWorkers).find(
        (item) => item.currentProcessChunk === chunkname
      );
    };

    const isPendingProcess = (currentChunk: { x: number; z: number }) => {
      return this.chunkPendingQueue.find(
        (item) => item.x === currentChunk.x && item.z === currentChunk.z
      );
    };

    const isPendingRender = (currentChunk: { x: number; z: number }) => {
      return this.chunkRenderQueue.find(
        (item) =>
          item.chunkName ===
          nameChunkFromCoordinate(currentChunk.x, currentChunk.z)
      );
    };

    this.neighborOffset.forEach((offset) => {
      const chunk = {
        x: currentChunk.x + offset.x,
        z: currentChunk.z + offset.z,
      };

      const chunkName = nameChunkFromCoordinate(chunk.x, chunk.z);

      if (
        !this.chunkRendered.get(chunkName) &&
        !isIncludeInWorker(chunkName) &&
        !isPendingProcess(chunk) &&
        !isPendingRender(chunk)
      ) {
        this.handleAssignWorkerChunk(chunkName, chunk);
      }
    });
  }

  handleRenderChunkBlocks(
    chunkName: string,
    arrayBlocksData: Int32Array,
    facesToRender: Record<string, Record<Face, boolean>>,
    blockOcclusion: Record<string, Record<Face, null | FaceAoType>>
  ) {
    if (!this.opaqueMaterial || !this.waterMaterial) return;

    const blockDataArray: BlockData[] = [];
    const blocksInChunk: string[] = [];

    // Parse arrayBlocksData: [x, y, z, type, x, y, z, type, ...]
    let tmpPos: number[] = [];
    const lengthCached = arrayBlocksData.length;
    for (let index = 0; index < lengthCached; index++) {
      const num = arrayBlocksData[index];

      if (tmpPos.length === 3) {
        const key = nameFromCoordinate(tmpPos[0], tmpPos[1], tmpPos[2]);

        // Store in ChunkDataStore (skip destroyed blocks)
        if (num !== 0) {
          this.chunkDataStore.setBlock(chunkName, key, num as BlockKeys);
          blockDataArray.push({
            x: tmpPos[0],
            y: tmpPos[1],
            z: tmpPos[2],
            type: num as BlockKeys,
          });
        }

        blocksInChunk.push(key);
        tmpPos = [];
      } else {
        tmpPos.push(num);
      }
    }

    this.chunksBlockKeys[chunkName] = blocksInChunk;

    // Build merged chunk geometry
    const geometryData = buildChunkGeometry(
      blockDataArray,
      facesToRender,
      blockOcclusion,
      this.atlasUVMap
    );

    // Create or update ChunkMesh
    let chunkMesh = this.chunkMeshes.get(chunkName);
    if (!chunkMesh) {
      chunkMesh = new ChunkMesh(chunkName, this.opaqueMaterial, this.waterMaterial);
      this.chunkMeshes.set(chunkName, chunkMesh);
      this.scene?.add(chunkMesh.group);
    }

    chunkMesh.buildFromGeometryData(geometryData);
  }

  handleClearChunks(neighborChunksKeys: string[]) {
    const inactiveChunk = this.chunksActive.filter(
      (item) => !neighborChunksKeys.includes(item)
    );

    inactiveChunk.forEach((chunkName) => {
      this.chunkRendered.set(chunkName, false);

      // Dispose chunk mesh
      const chunkMesh = this.chunkMeshes.get(chunkName);
      if (chunkMesh) {
        chunkMesh.dispose();
        this.chunkMeshes.delete(chunkName);
      }

      // Clear block data
      this.chunkDataStore.clearChunk(chunkName);

      delete this.chunksBlockKeys[chunkName];
    });
  }

  handleAssignWorkerChunk(chunkName: string, chunk: { x: number; z: number }) {
    if (
      !this.chunksBlockKeys[chunkName] &&
      !Object.values(this.chunkWorkers).find(
        (item) => item.currentProcessChunk === chunkName
      )
    ) {
      this.chunkPendingQueueProxy.unshift(chunk.x, chunk.z);
    }
  }

  update() {
    super.update();
    this.updateChunkVisibility();
  }

  // Hide chunks that are beyond the fog cutoff distance
  updateChunkVisibility() {
    if (!this.camera) return;

    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const chunkWorldSize = CHUNK_SIZE * BLOCK_WIDTH;

    for (const [chunkName, chunkMesh] of this.chunkMeshes) {
      const parts = chunkName.split("_");
      const cx = Number(parts[0]);
      const cz = Number(parts[1]);

      // Chunk center in world space
      const chunkCenterX = (cx + 0.5) * chunkWorldSize;
      const chunkCenterZ = (cz + 0.5) * chunkWorldSize;

      const dx = chunkCenterX - camX;
      const dz = chunkCenterZ - camZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      chunkMesh.setVisible(dist < FOG_CUTOFF_DISTANCE);
    }
  }

  dispose() {
    this.disposeBlockManager();

    // Dispose all chunk meshes
    for (const [, chunkMesh] of this.chunkMeshes) {
      chunkMesh.dispose();
    }
    this.chunkMeshes.clear();

    Object.values(this.chunkWorkers).forEach(({ worker }) => {
      worker.terminate();
    });
  }
}
