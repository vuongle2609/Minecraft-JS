import { DEFAULT_CHUNK_VIEW } from "@/constants";
import { Face } from "@/constants/block";
import {
  nameChunkFromCoordinate,
  nameFromCoordinate,
} from "@/game/helpers/nameFromCoordinate";
import { BlockKeys, FaceAoType } from "@/type";

import { throttle } from "@/UI/utils/throttle";
import { calNeighborsOffset } from "../helpers/calNeighborsOffset";
import { getChunkNeighborsCoor } from "../helpers/chunkHelpers";
import { detailFromName } from "../helpers/detailFromName";
import { BasePropsType } from "./baseEntity";
import BlockManager from "./blockManager";
import InventoryManager from "./inventoryManager";

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
  // todo
  chunkCached = [];

  chunkRendered = new Map();

  chunkRenderQueue: ChunkWorkerDataType[] = [];

  chunkPendingQueue: ChunkPendingQueueType[] = [];
  currentChunk = [0, 0];

  neighborOffset = calNeighborsOffset(DEFAULT_CHUNK_VIEW);

  createWorker = (index: number) => ({
    worker: new Worker(new URL("../terrant/worker", import.meta.url), {
      type: "module",
    }),
    isBusy: false,
    index,
    currentProcessChunk: null,
  });

  chunkWorkers = Array(9)
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

    chunkDetail.forEach(({ chunkName, chunk }) => {
      this.handleAssignWorkerChunk(chunkName, chunk);
    });
  }

  handleRenderChunksInQueue() {
    const data = this.chunkRenderQueue.pop();

    if (!data) return;

    const { chunkName, arrayBlocksData, facesToRender, blockOcclusion } = data;

    if (!this.chunksActive.includes(chunkName)) return;

    this.handleRenderChunkBlocks(
      chunkName,
      arrayBlocksData,
      facesToRender,
      blockOcclusion
    );
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

  // can optimize worker speed
  handleRenderChunkBlocks(
    chunkName: string,
    arrayBlocksData: Int32Array,
    facesToRender: Record<string, Record<Face, boolean>>,
    blockOcclusion: Record<string, Record<Face, null | FaceAoType>>
  ) {
    const blocksInChunk: string[] = [];

    let tmpPos: number[] = [];
    const lengthCached = arrayBlocksData.length;
    for (let index = 0; index < lengthCached; index++) {
      const num = arrayBlocksData[index];

      if (tmpPos.length === 3) {
        const key = nameFromCoordinate(tmpPos[0], tmpPos[1], tmpPos[2]);
        this.updateBlock({
          x: tmpPos[0],
          y: tmpPos[1],
          z: tmpPos[2],
          type: num,
          facesToRender: facesToRender[key] || null,
          blockOcclusion: blockOcclusion[key] || null,
        });
        blocksInChunk.push(key);

        tmpPos = [];
      } else {
        tmpPos.push(num);
      }
    }

    this.chunksBlocks[chunkName] = blocksInChunk;
  }

  handleClearChunks(neighborChunksKeys: string[]) {
    const inactiveChunk = this.chunksActive.filter(
      (item) => !neighborChunksKeys.includes(item)
    );

    let blocksDelete: string[] = [];

    inactiveChunk.forEach((item) => {
      this.chunkRendered.set(item, false);

      blocksDelete = [...blocksDelete, ...(this.chunksBlocks[item] || [])];

      delete this.chunksBlocks[item];
      
      // Dispose the chunk's InstancedBlockManager to free up GPU resources
      this.instancedBlockManager?.disposeChunkManager(item);
    });

    blocksDelete.forEach((blockKey) => {
      const { y, x, z } = detailFromName(blockKey);

      this.removeBlock(x, y, z, true);
    });
  }

  handleAssignWorkerChunk(chunkName: string, chunk: { x: number; z: number }) {
    if (
      !this.chunksBlocks[chunkName] &&
      !Object.values(this.chunkWorkers).find(
        (item) => item.currentProcessChunk === chunkName
      )
    ) {
      this.chunkPendingQueueProxy.unshift(chunk.x, chunk.z);
    }
  }

  update() {
    // Call parent update for hover block handling
    super.update();
    
    // Update frustum culling for all chunks based on camera frustum
    if (this.camera && this.instancedBlockManager) {
      this.instancedBlockManager.updateAllChunksFrustum(this.camera);
    }
  }

  dispose() {
    this.disposeBlockManager();
    Object.values(this.chunkWorkers).forEach(({ worker }) => {
      worker.terminate();
    });
  }
}
