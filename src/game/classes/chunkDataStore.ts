import { BlockKeys } from "@/type";

export class ChunkDataStore {
  // Per-chunk block data: chunkName -> Map<coordKey, BlockKeys>
  private chunks: Map<string, Map<string, BlockKeys>> = new Map();

  // Global lookup for fast coordinate queries (raycasting, physics)
  private globalBlocks: Map<string, BlockKeys> = new Map();

  setBlock(chunkName: string, coordKey: string, type: BlockKeys): void {
    let chunkMap = this.chunks.get(chunkName);
    if (!chunkMap) {
      chunkMap = new Map();
      this.chunks.set(chunkName, chunkMap);
    }
    chunkMap.set(coordKey, type);
    this.globalBlocks.set(coordKey, type);
  }

  removeBlock(chunkName: string, coordKey: string): void {
    this.chunks.get(chunkName)?.delete(coordKey);
    this.globalBlocks.delete(coordKey);
  }

  getBlock(coordKey: string): BlockKeys | undefined {
    return this.globalBlocks.get(coordKey);
  }

  getChunkBlocks(chunkName: string): Map<string, BlockKeys> | undefined {
    return this.chunks.get(chunkName);
  }

  hasBlock(coordKey: string): boolean {
    return this.globalBlocks.has(coordKey);
  }

  clearChunk(chunkName: string): void {
    const chunkMap = this.chunks.get(chunkName);
    if (chunkMap) {
      for (const coordKey of chunkMap.keys()) {
        this.globalBlocks.delete(coordKey);
      }
      this.chunks.delete(chunkName);
    }
  }

  getGlobalBlocks(): Map<string, BlockKeys> {
    return this.globalBlocks;
  }
}
