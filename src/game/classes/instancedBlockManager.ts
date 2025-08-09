import { Scene, Group, Vector3, Euler, Frustum, Matrix4, Camera } from "three";
import { CHUNK_SIZE, BLOCK_WIDTH } from "@/constants";
import { Face } from "@/constants/block";
import { BlockKeys, BlockTextureType, FaceAoType } from "@/type";
import ChunkInstancedBlockManager from "./chunkInstancedBlockManager";
import { nameFromCoordinate, nameChunkFromCoordinate } from "@/game/helpers/nameFromCoordinate";

export default class InstancedBlockManager {
  private scene: Scene;
  private blocksGroup: Group;
  private chunkManagers: Map<string, ChunkInstancedBlockManager> = new Map();
  private lastCameraChunk: string | null = null; // Track last chunk camera was in for optimization
  private lastCameraRotation: Vector3 = new Vector3(); // Track camera rotation for changes
  private frustumUpdateCounter: number = 0; // Counter for throttling frustum updates
  private isFirstUpdate: boolean = true; // Force update on first frame

  constructor(scene: Scene, blocksGroup: Group) {
    this.scene = scene;
    this.blocksGroup = blocksGroup;
  }

  /**
   * Create a chunk manager for the specified chunk
   */
  createChunkManager(chunkName: string, chunkX: number, chunkZ: number): ChunkInstancedBlockManager {
    if (this.chunkManagers.has(chunkName)) {
      console.warn(`Chunk manager for ${chunkName} already exists`);
      return this.chunkManagers.get(chunkName)!;
    }

    const chunkManager = new ChunkInstancedBlockManager(chunkName, chunkX, chunkZ, this.blocksGroup);
    this.chunkManagers.set(chunkName, chunkManager);
    
    // Force immediate frustum update for newly created chunks
    this.isFirstUpdate = true;
    
    console.log(`Created chunk manager for ${chunkName} at (${chunkX}, ${chunkZ})`);
    return chunkManager;
  }

  /**
   * Get existing chunk manager
   */
  getChunkManager(chunkName: string): ChunkInstancedBlockManager | null {
    return this.chunkManagers.get(chunkName) || null;
  }

  /**
   * Get chunk name from block world position
   */
  private getChunkNameFromPosition(position: Vector3): string {
    const chunkX = Math.floor(position.x / (CHUNK_SIZE * BLOCK_WIDTH));
    const chunkZ = Math.floor(position.z / (CHUNK_SIZE * BLOCK_WIDTH));
    return nameChunkFromCoordinate(chunkX, chunkZ);
  }

  /**
   * Get chunk coordinates from world position
   */
  private getChunkCoordinates(position: Vector3): { chunkX: number; chunkZ: number; chunkName: string } {
    const chunkX = Math.floor(position.x / (CHUNK_SIZE * BLOCK_WIDTH));
    const chunkZ = Math.floor(position.z / (CHUNK_SIZE * BLOCK_WIDTH));
    const chunkName = nameChunkFromCoordinate(chunkX, chunkZ);
    return { chunkX, chunkZ, chunkName };
  }

  /**
   * Allocate an instance for a block face (routes to appropriate chunk manager)
   */
  allocateInstance(
    blockKey: string,
    blockType: BlockKeys,
    faceType: BlockTextureType,
    aoType: FaceAoType | "base",
    position: Vector3,
    rotation: Euler
  ): number {
    const { chunkX, chunkZ, chunkName } = this.getChunkCoordinates(position);
    
    // Create chunk manager if it doesn't exist
    let chunkManager = this.chunkManagers.get(chunkName);
    if (!chunkManager) {
      chunkManager = this.createChunkManager(chunkName, chunkX, chunkZ);
    }
    
    // Route allocation to chunk manager
    return chunkManager.allocateInstance(blockKey, blockType, faceType, aoType, position, rotation);
  }

  /**
   * Deallocate an instance (routes to appropriate chunk manager)
   */
  deallocateInstance(blockKey: string, instanceIndex: number, blockType: BlockKeys, faceType: BlockTextureType) {
    // Extract position from blockKey to determine chunk
    const parts = blockKey.split('_');
    if (parts.length < 3) {
      console.error(`Invalid block key format: ${blockKey}`);
      return;
    }
    
    const x = parseInt(parts[0]);
    const z = parseInt(parts[2]);
    const position = new Vector3(x, 0, z);
    const chunkName = this.getChunkNameFromPosition(position);
    
    const chunkManager = this.chunkManagers.get(chunkName);
    if (chunkManager) {
      // Find the allocation to get the AO type
      const allocations = chunkManager['instanceAllocations'].get(blockKey);
      if (allocations) {
        const allocation = allocations.find(a => 
          a.instanceIndex === instanceIndex && 
          a.blockType === blockType && 
          a.faceType === faceType
        );
        if (allocation) {
          chunkManager.deallocateInstance(blockKey, instanceIndex, blockType, faceType, allocation.aoType);
        }
      }
    }
  }

  /**
   * Deallocate all instances for a block (routes to appropriate chunk manager)
   */
  deallocateAllInstances(blockKey: string) {
    // Extract position from blockKey to determine chunk
    const parts = blockKey.split('_');
    if (parts.length < 3) {
      console.error(`Invalid block key format: ${blockKey}`);
      return;
    }
    
    const x = parseInt(parts[0]);
    const z = parseInt(parts[2]);
    const position = new Vector3(x, 0, z);
    const chunkName = this.getChunkNameFromPosition(position);
    
    const chunkManager = this.chunkManagers.get(chunkName);
    if (chunkManager) {
      chunkManager.deallocateAllInstances(blockKey);
    }
  }

  /**
   * Dispose a chunk manager when chunk is unloaded
   */
  disposeChunkManager(chunkName: string) {
    const chunkManager = this.chunkManagers.get(chunkName);
    if (chunkManager) {
      chunkManager.dispose();
      this.chunkManagers.delete(chunkName);
      console.log(`Disposed chunk manager for ${chunkName}`);
    }
  }

  /**
   * Update frustum culling for all chunks based on camera frustum
   * Runs every frame when camera moves or rotates
   */
  updateAllChunksFrustum(camera: Camera, forceUpdate: boolean = false) {
    // Check if camera has moved or rotated
    const currentCameraChunk = this.getChunkNameFromPosition(camera.position);
    
    // Check rotation changes (Euler doesn't have toVector3, so we check components)
    const hasRotated = 
      camera.rotation.x !== this.lastCameraRotation.x ||
      camera.rotation.y !== this.lastCameraRotation.y ||
      camera.rotation.z !== this.lastCameraRotation.z;
    
    const hasMoved = currentCameraChunk !== this.lastCameraChunk;
    const needsUpdate = this.isFirstUpdate || hasRotated || hasMoved || forceUpdate;
    
    // Skip update only if camera hasn't moved or rotated
    if (!needsUpdate) {
      return;
    }
    
    // Update tracking variables
    this.lastCameraChunk = currentCameraChunk;
    this.lastCameraRotation.set(camera.rotation.x, camera.rotation.y, camera.rotation.z);
    this.isFirstUpdate = false;
    this.frustumUpdateCounter++;
    
    // Create frustum from camera matrices
    const frustum = new Frustum();
    const matrix = new Matrix4();
    
    // Update camera matrices if needed
    camera.updateMatrixWorld();
    
    // Combine projection and view matrices to get frustum
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    
    // Update frustum culling for all active chunks
    let visibleChunkCount = 0;
    this.chunkManagers.forEach((chunkManager, chunkName) => {
      const isVisible = chunkManager.updateFrustumCulling(frustum);
      if (isVisible) {
        visibleChunkCount++;
      }
    });
    
    // Debug logging (can be removed in production)
    if (this.frustumUpdateCounter % 60 === 0) {  // Log every 60 updates (~1 second)
      console.log(`Visible chunks: ${visibleChunkCount}/${this.chunkManagers.size}`);
    }
  }

  /**
   * Get face rotation based on face type (routes to chunk manager)
   */
  getFaceRotation(face: Face): Euler {
    // This is the same for all chunks, so we can implement it directly
    switch (face) {
      case Face.leftZ:
        return new Euler(0, 0, 0);
      case Face.rightZ:
        return new Euler(0, Math.PI, 0);
      case Face.leftX:
        return new Euler(0, Math.PI / 2, 0);
      case Face.rightX:
        return new Euler(0, -Math.PI / 2, 0);
      case Face.top:
        return new Euler(-Math.PI / 2, 0, 0);
      case Face.bottom:
        return new Euler(Math.PI / 2, 0, 0);
      default:
        return new Euler(0, 0, 0);
    }
  }

  /**
   * Clean up all resources
   */
  dispose() {
    this.chunkManagers.forEach((chunkManager) => {
      chunkManager.dispose();
    });
    this.chunkManagers.clear();
  }

  /**
   * Get debug info about all chunk managers
   */
  getPoolStats() {
    const stats: Record<string, any> = {};
    
    this.chunkManagers.forEach((chunkManager, chunkName) => {
      const chunkStats = chunkManager.getPoolStats();
      Object.assign(stats, chunkStats);
    });
    
    return stats;
  }

  /**
   * Get all active chunk names
   */
  getActiveChunks(): string[] {
    return Array.from(this.chunkManagers.keys());
  }

  /**
   * Get number of active chunks
   */
  getChunkCount(): number {
    return this.chunkManagers.size;
  }
}