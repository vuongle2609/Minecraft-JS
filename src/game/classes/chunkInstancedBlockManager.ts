import { Scene, Group, InstancedMesh, Matrix4, Vector3, Euler, InstancedBufferAttribute, Frustum, Box3, Camera } from "three";
import { BLOCK_WIDTH, CHUNK_SIZE } from "@/constants";
import { Face } from "@/constants/block";
import blocks, { renderGeometry } from "@/constants/blocks";
import { BlockKeys, BlockTextureType, FaceAoType, BlocksIntancedMapping, BlocksIntancedType } from "@/type";

interface InstanceInfo {
  blockType: BlockKeys;
  faceType: BlockTextureType;
  instanceIndex: number;
}

export default class ChunkInstancedBlockManager {
  private chunkName: string;
  private chunkCenter: Vector3;
  private blocksGroup: Group;
  private instancedMeshes: BlocksIntancedMapping;
  private instanceAllocations: Map<string, InstanceInfo[]> = new Map(); // blockKey -> instance info
  private initialPoolSize = 2000; // Initial pool size for 64x64 chunks
  private poolGrowthFactor = 1.5;
  private chunkBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  private chunkBoundingBox: Box3; // 3D bounding box for frustum intersection testing
  private currentFrustumState: boolean = true; // Track current frustum state to avoid redundant updates

  constructor(chunkName: string, chunkX: number, chunkZ: number, blocksGroup: Group) {
    this.chunkName = chunkName;
    this.blocksGroup = blocksGroup;
    this.instancedMeshes = {} as BlocksIntancedMapping;
    
    // Position chunk center in world coordinates
    this.chunkCenter = new Vector3(
      (chunkX * CHUNK_SIZE + CHUNK_SIZE / 2) * BLOCK_WIDTH,
      0, // Y position at world level, instances will be offset from here
      (chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2) * BLOCK_WIDTH
    );
    
    // Calculate chunk boundaries for frustum culling checks
    this.chunkBounds = {
      minX: chunkX * CHUNK_SIZE * BLOCK_WIDTH,
      maxX: (chunkX + 1) * CHUNK_SIZE * BLOCK_WIDTH,
      minZ: chunkZ * CHUNK_SIZE * BLOCK_WIDTH,
      maxZ: (chunkZ + 1) * CHUNK_SIZE * BLOCK_WIDTH
    };
    
    // Create 3D bounding box for frustum intersection testing (includes full world height)
    this.chunkBoundingBox = new Box3(
      new Vector3(
        this.chunkBounds.minX,
        0,  // Min Y at ground level
        this.chunkBounds.minZ
      ),
      new Vector3(
        this.chunkBounds.maxX,
        256 * BLOCK_WIDTH,  // Max Y at world height limit (256 blocks)
        this.chunkBounds.maxZ
      )
    );
    
    this.initializeInstancedMeshes();
  }

  private initializeInstancedMeshes() {
    // Initialize InstancedMesh pools for each block type and face type combination
    Object.values(BlockKeys).forEach((blockType) => {
      if (typeof blockType === 'number') {
        this.instancedMeshes[blockType] = {} as BlocksIntancedType;
        
        // For each face texture type, create one InstancedMesh positioned at chunk center
        Object.values(BlockTextureType).forEach((faceType) => {
          if (typeof faceType === 'number') {
            const blockData = blocks[blockType];
            const material = blockData.texture[faceType];
            
            const instancedMesh = new InstancedMesh(
              renderGeometry, 
              material, 
              this.initialPoolSize
            );
            
            // Position the InstancedMesh at chunk center for proper frustum culling
            instancedMesh.position.copy(this.chunkCenter);
            instancedMesh.instanceMatrix.setUsage(35048); // THREE.DynamicDrawUsage
            instancedMesh.count = 0; // Start with 0 visible instances
            
            // Add AO instance attribute
            const aoAttribute = new InstancedBufferAttribute(new Float32Array(this.initialPoolSize), 1);
            instancedMesh.geometry.setAttribute('instanceAO', aoAttribute);
            
            // Set name for debugging
            instancedMesh.name = `${this.chunkName}_${blockType}_${faceType}`;
            
            this.instancedMeshes[blockType][faceType] = {
              mesh: instancedMesh,
              count: 0,
              indexCanAllocate: Array.from({ length: this.initialPoolSize }, (_, i) => i)
            };
            
            this.blocksGroup.add(instancedMesh);
          }
        });
      }
    });
  }

  /**
   * Allocate an instance for a block face (position is relative to chunk center)
   */
  allocateInstance(
    blockKey: string,
    blockType: BlockKeys,
    faceType: BlockTextureType,
    aoType: FaceAoType | "base",
    worldPosition: Vector3,
    rotation: Euler
  ): number {
    const pool = this.getPool(blockType, faceType);
    
    if (!pool) {
      console.error(`Pool not found for ${blockType}_${faceType} in chunk ${this.chunkName}`);
      return -1;
    }

    // Check if we need to resize the pool
    if (pool.indexCanAllocate.length === 0) {
      this.resizePool(blockType, faceType);
    }

    // Get an available instance index
    const instanceIndex = pool.indexCanAllocate.pop()!;
    
    // Convert world position to position relative to chunk center
    const relativePosition = worldPosition.clone().sub(this.chunkCenter);
    
    // Set the transformation matrix for this instance (relative to chunk center)
    const matrix = new Matrix4();
    matrix.makeRotationFromEuler(rotation);
    matrix.setPosition(relativePosition);
    
    pool.mesh.setMatrixAt(instanceIndex, matrix);
    pool.mesh.instanceMatrix.needsUpdate = true;
    
    // Set AO value for this instance
    const aoValue = this.getAOValue(aoType);
    const aoAttribute = pool.mesh.geometry.getAttribute('instanceAO') as InstancedBufferAttribute;
    aoAttribute.setX(instanceIndex, aoValue);
    aoAttribute.needsUpdate = true;
    
    // Update visible instance count
    pool.count++;
    pool.mesh.count = Math.max(pool.mesh.count, instanceIndex + 1);
    
    // Track this allocation
    if (!this.instanceAllocations.has(blockKey)) {
      this.instanceAllocations.set(blockKey, []);
    }
    this.instanceAllocations.get(blockKey)!.push({
      blockType,
      faceType,
      instanceIndex
    });
    
    return instanceIndex;
  }

  /**
   * Deallocate an instance
   */
  deallocateInstance(blockKey: string, instanceIndex: number, blockType: BlockKeys, faceType: BlockTextureType) {
    const pool = this.getPool(blockType, faceType);
    if (!pool) return;

    // Hide this instance by setting it to zero matrix
    const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
    pool.mesh.setMatrixAt(instanceIndex, hiddenMatrix);
    pool.mesh.instanceMatrix.needsUpdate = true;

    // Return index to available pool
    pool.indexCanAllocate.push(instanceIndex);
    pool.count--;

    // Remove from allocations tracking
    const allocations = this.instanceAllocations.get(blockKey);
    if (allocations) {
      const index = allocations.findIndex(
        alloc => alloc.instanceIndex === instanceIndex && 
                 alloc.blockType === blockType && 
                 alloc.faceType === faceType
      );
      if (index !== -1) {
        allocations.splice(index, 1);
      }
    }
  }

  /**
   * Deallocate all instances for a block
   */
  deallocateAllInstances(blockKey: string) {
    const allocations = this.instanceAllocations.get(blockKey);
    if (!allocations) return;

    // Deallocate each instance
    [...allocations].forEach(alloc => {
      this.deallocateInstance(blockKey, alloc.instanceIndex, alloc.blockType, alloc.faceType);
    });

    // Clear the allocation tracking
    this.instanceAllocations.delete(blockKey);
  }

  /**
   * Get the pool for a specific combination
   */
  private getPool(blockType: BlockKeys, faceType: BlockTextureType) {
    try {
      return this.instancedMeshes[blockType][faceType];
    } catch (e) {
      console.error(`Pool not found for blockType: ${blockType}, faceType: ${faceType} in chunk ${this.chunkName}`);
      return null;
    }
  }

  /**
   * Convert AO type to numeric value for shader
   */
  private getAOValue(aoType: FaceAoType | "base"): number {
    if (aoType === "base") return 0;
    return aoType as number;
  }

  /**
   * Resize a pool when it runs out of available indices
   */
  private resizePool(blockType: BlockKeys, faceType: BlockTextureType) {
    const pool = this.getPool(blockType, faceType);
    if (!pool) return;

    const oldSize = pool.mesh.instanceMatrix.count;
    const newSize = Math.floor(oldSize * this.poolGrowthFactor);
    
    console.log(`Resizing pool for ${blockType}_${faceType} in chunk ${this.chunkName} from ${oldSize} to ${newSize}`);

    // Create new larger InstancedMesh
    const blockData = blocks[blockType];
    const material = blockData.texture[faceType];
    const newInstancedMesh = new InstancedMesh(renderGeometry, material, newSize);
    
    // Position at chunk center
    newInstancedMesh.position.copy(this.chunkCenter);
    newInstancedMesh.instanceMatrix.setUsage(35048);
    newInstancedMesh.count = pool.mesh.count;
    newInstancedMesh.name = `${this.chunkName}_${blockType}_${faceType}`;

    // Copy existing instance matrices
    for (let i = 0; i < oldSize; i++) {
      const matrix = new Matrix4();
      pool.mesh.getMatrixAt(i, matrix);
      newInstancedMesh.setMatrixAt(i, matrix);
    }

    // Copy AO attributes
    const oldAO = pool.mesh.geometry.getAttribute('instanceAO') as InstancedBufferAttribute;
    const newAO = new InstancedBufferAttribute(new Float32Array(newSize), 1);
    for (let i = 0; i < oldSize; i++) {
      newAO.setX(i, oldAO.getX(i));
    }
    newInstancedMesh.geometry.setAttribute('instanceAO', newAO);

    // Remove old mesh and add new one
    this.blocksGroup.remove(pool.mesh);
    pool.mesh.dispose();
    this.blocksGroup.add(newInstancedMesh);

    // Update pool data
    pool.mesh = newInstancedMesh;
    
    // Add new available indices
    const newIndices = Array.from({ length: newSize - oldSize }, (_, i) => oldSize + i);
    pool.indexCanAllocate.push(...newIndices);
    
    newInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Get face rotation based on face type
   */
  getFaceRotation(face: Face): Euler {
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
   * Get chunk name for debugging
   */
  getChunkName(): string {
    return this.chunkName;
  }

  /**
   * Update frustum culling based on camera frustum intersection with chunk bounding box
   * Disables frustum culling when camera frustum intersects with chunk volume
   */
  updateFrustumCulling(frustum: Frustum): boolean {
    // Check if camera frustum intersects with chunk's 3D bounding box
    const shouldRender = frustum.intersectsBox(this.chunkBoundingBox);
    
    // Only update if state has changed to avoid redundant operations
    const newFrustumState = !shouldRender;  // Invert: if should render, disable frustum culling
    if (this.currentFrustumState !== newFrustumState) {
      this.currentFrustumState = newFrustumState;
      
      // Set frustumCulled for all meshes in this chunk
      // If chunk is in view (shouldRender=true), disable frustum culling (frustumCulled=false)
      // If chunk is not in view (shouldRender=false), enable frustum culling (frustumCulled=true)
      Object.keys(this.instancedMeshes).forEach((blockType) => {
        const blockMeshes = this.instancedMeshes[parseInt(blockType) as BlockKeys];
        Object.keys(blockMeshes).forEach((faceType) => {
          const pool = blockMeshes[parseInt(faceType) as BlockTextureType];
          if (pool?.mesh) {
            pool.mesh.frustumCulled = !shouldRender;
          }
        });
      });
    }
    
    return shouldRender;
  }

  /**
   * Get chunk center position
   */
  getChunkCenter(): Vector3 {
    return this.chunkCenter.clone();
  }

  /**
   * Clean up all resources
   */
  dispose() {
    Object.keys(this.instancedMeshes).forEach((blockType) => {
      const blockMeshes = this.instancedMeshes[parseInt(blockType) as BlockKeys];
      Object.keys(blockMeshes).forEach((faceType) => {
        const pool = blockMeshes[parseInt(faceType) as BlockTextureType];
        if (pool?.mesh) {
          this.blocksGroup.remove(pool.mesh);
          pool.mesh.dispose();
        }
      });
    });
    
    this.instanceAllocations.clear();
  }

  /**
   * Get debug info about pool usage for this chunk
   */
  getPoolStats() {
    const stats: Record<string, any> = {};
    
    Object.keys(this.instancedMeshes).forEach((blockType) => {
      const blockMeshes = this.instancedMeshes[parseInt(blockType) as BlockKeys];
      Object.keys(blockMeshes).forEach((faceType) => {
        const pool = blockMeshes[parseInt(faceType) as BlockTextureType];
        if (pool?.mesh) {
          const key = `${this.chunkName}_${blockType}_${faceType}`;
          stats[key] = {
            totalInstances: pool.mesh.instanceMatrix.count,
            usedInstances: pool.count,
            availableInstances: pool.indexCanAllocate.length
          };
        }
      });
    });
    
    return stats;
  }
}