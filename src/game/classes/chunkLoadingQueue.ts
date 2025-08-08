// Remove unused import

export interface ChunkLoadRequest {
  chunkName: string;
  chunk: { x: number; z: number };
  arrayBlocksData?: any;
  facesToRender?: any;
  blockOcclusion?: any;
  priority: number; // Lower number = higher priority (distance from player)
}

export enum ChunkLoadState {
  PENDING = "pending",
  LOADING = "loading",
  LOADED = "loaded",
  ABORTED = "aborted"
}

export class ChunkLoadingQueue {
  private loadingStack: ChunkLoadRequest[] = [];
  private chunkStates: Map<string, ChunkLoadState> = new Map();
  private activeChunks: Set<string> = new Set();
  private currentLoadingChunk: string | null = null;
  private frameTimeTarget = 16; // Target 60fps (16ms per frame)
  private lastProcessTime = 0;
  private processIntervalId: number | null = null;

  constructor() {
    // Start the processing loop
    this.startProcessingLoop();
  }

  /**
   * Add a chunk to the loading queue with stack-based priority
   */
  public addChunkToQueue(request: ChunkLoadRequest): void {
    const { chunkName } = request;

    // Check if chunk is already loaded or in progress
    const state = this.chunkStates.get(chunkName);
    if (state === ChunkLoadState.LOADED || state === ChunkLoadState.LOADING) {
      return;
    }

    // Remove any existing request for this chunk
    this.loadingStack = this.loadingStack.filter(r => r.chunkName !== chunkName);

    // Add to stack (LIFO - last in, first out)
    this.loadingStack.push(request);
    this.chunkStates.set(chunkName, ChunkLoadState.PENDING);

    // Sort by priority (distance from player)
    this.sortStackByPriority();
  }

  /**
   * Remove chunks from queue and mark as aborted if they're no longer needed
   */
  public removeChunksFromQueue(chunkNames: string[]): void {
    chunkNames.forEach(chunkName => {
      // Don't abort if currently loading
      if (this.currentLoadingChunk === chunkName) {
        return;
      }

      // Remove from stack
      this.loadingStack = this.loadingStack.filter(r => r.chunkName !== chunkName);
      
      // Mark as aborted if it was pending
      if (this.chunkStates.get(chunkName) === ChunkLoadState.PENDING) {
        this.chunkStates.set(chunkName, ChunkLoadState.ABORTED);
      }
    });
  }

  /**
   * Update the list of active chunks (chunks that should be rendered)
   */
  public updateActiveChunks(chunkNames: string[]): void {
    this.activeChunks.clear();
    chunkNames.forEach(name => this.activeChunks.add(name));

    // Remove inactive chunks from the loading stack
    this.loadingStack = this.loadingStack.filter(request => 
      this.activeChunks.has(request.chunkName)
    );

    // Abort chunks that are no longer active
    for (const [chunkName, state] of this.chunkStates) {
      if (!this.activeChunks.has(chunkName) && state === ChunkLoadState.PENDING) {
        this.chunkStates.set(chunkName, ChunkLoadState.ABORTED);
      }
    }
  }

  /**
   * Check if a chunk should still be loaded
   */
  private shouldLoadChunk(chunkName: string): boolean {
    // Check if chunk is still active
    if (!this.activeChunks.has(chunkName)) {
      return false;
    }

    // Check if chunk was already loaded
    const state = this.chunkStates.get(chunkName);
    if (state === ChunkLoadState.LOADED || state === ChunkLoadState.LOADING) {
      return false;
    }

    return true;
  }

  /**
   * Sort stack by priority (distance from player)
   */
  private sortStackByPriority(): void {
    // Sort in reverse order so highest priority (lowest number) is at the end
    // This way pop() gets the highest priority item
    this.loadingStack.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get debug information about the queue state
   */
  public getDebugInfo(): {
    pendingCount: number;
    loadedCount: number;
    activeCount: number;
    currentLoading: string | null;
  } {
    let loadedCount = 0;
    for (const state of this.chunkStates.values()) {
      if (state === ChunkLoadState.LOADED) loadedCount++;
    }
    
    return {
      pendingCount: this.loadingStack.length,
      loadedCount,
      activeCount: this.activeChunks.size,
      currentLoading: this.currentLoadingChunk,
    };
  }

  /**
   * Process the next chunk in the queue
   */
  public processNextChunk(renderCallback: (request: ChunkLoadRequest) => void): boolean {
    // Check frame budget
    const now = performance.now();
    const deltaTime = now - this.lastProcessTime;
    
    // Skip if we're over frame budget (unless it's been too long)
    if (deltaTime < this.frameTimeTarget * 0.5 && this.lastProcessTime > 0) {
      return false;
    }

    // Get next chunk from stack
    let request = this.loadingStack.pop();
    
    // Find a valid chunk to load
    while (request && !this.shouldLoadChunk(request.chunkName)) {
      request = this.loadingStack.pop();
    }

    if (!request) {
      return false;
    }

    // Mark as loading
    this.currentLoadingChunk = request.chunkName;
    this.chunkStates.set(request.chunkName, ChunkLoadState.LOADING);

    // Execute the render callback
    try {
      renderCallback(request);
      
      // Mark as loaded
      this.chunkStates.set(request.chunkName, ChunkLoadState.LOADED);
    } catch (error) {
      console.error(`Failed to load chunk ${request.chunkName}:`, error);
      this.chunkStates.set(request.chunkName, ChunkLoadState.ABORTED);
    } finally {
      this.currentLoadingChunk = null;
      this.lastProcessTime = now;
    }

    return true;
  }

  /**
   * Start the automatic processing loop
   */
  private startProcessingLoop(): void {
    if (this.processIntervalId !== null) {
      return;
    }

    // Process chunks at 60fps when there are chunks to load
    this.processIntervalId = window.setInterval(() => {
      if (this.loadingStack.length === 0) {
        this.lastProcessTime = 0; // Reset timing when idle
      }
    }, 16);
  }

  /**
   * Stop the processing loop
   */
  public dispose(): void {
    if (this.processIntervalId !== null) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = null;
    }
    
    this.loadingStack = [];
    this.chunkStates.clear();
    this.activeChunks.clear();
  }

  /**
   * Get the number of chunks pending in the queue
   */
  public getPendingCount(): number {
    return this.loadingStack.length;
  }

  /**
   * Check if a specific chunk is loaded
   */
  public isChunkLoaded(chunkName: string): boolean {
    return this.chunkStates.get(chunkName) === ChunkLoadState.LOADED;
  }

  /**
   * Reset a chunk's state (for chunk updates/modifications)
   */
  public resetChunkState(chunkName: string): void {
    this.chunkStates.delete(chunkName);
  }

  /**
   * Calculate priority based on distance from player
   */
  public static calculatePriority(
    chunkX: number, 
    chunkZ: number, 
    playerChunkX: number, 
    playerChunkZ: number
  ): number {
    const dx = chunkX - playerChunkX;
    const dz = chunkZ - playerChunkZ;
    return Math.sqrt(dx * dx + dz * dz);
  }
}