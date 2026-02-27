# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
bun dev        # Start Vite dev server (hot reload)
bun run build  # TypeScript check + Vite production build
bun run preview # Preview production build locally
```

No test framework is configured. No linter is configured.

## Path Aliases

`@/*` maps to `./src/*` (configured in both tsconfig.json and vite.config.ts).

## Architecture Overview

Browser-based Minecraft clone built with **Three.js** (WebGPURenderer) and **TypeScript**. Uses **Vite** for bundling and **Tailwind CSS** for UI styling. World data persists to **localStorage**.

### Core Class Hierarchy

The game uses a class-based architecture (not ECS):

- **GameScene** (`src/game/classes/gameScene.ts`) — Main orchestrator. Initializes Three.js scene/camera/renderer, builds texture atlas, creates all managers, runs the game loop via requestAnimationFrame.
- **ChunkManager** (`src/game/classes/chunkManager.ts`) — Extends BlockManager. Manages a 41x41 chunk grid around the player (DEFAULT_CHUNK_VIEW=20), coordinates a dynamic pool of terrain generation workers (4-16 based on `navigator.hardwareConcurrency`), handles chunk loading/unloading with time-budgeted rendering (8ms per frame).
- **BlockManager** (`src/game/classes/blockManager.ts`) — Uses `ChunkDataStore` for block data and `ChunkMesh` for merged geometry. Handles block placement/destruction with chunk mesh rebuilds, DDA voxel raycasting for block selection.
- **ChunkMesh** (`src/game/classes/chunkMesh.ts`) — Manages 1-2 merged `BufferGeometry` meshes (opaque + transparent) per chunk. Uses shared atlas materials with vertex colors for AO.
- **ChunkDataStore** (`src/game/classes/chunkDataStore.ts`) — Lightweight `Map<string, BlockKeys>` per chunk + global lookup. Replaces the old per-block `Block` class instances.
- **Player** (`src/game/player/character.ts`) — Player physics body, detects chunk transitions, receives position updates from the physics worker.
- **InventoryManager** (`src/game/classes/inventoryManager.ts`) — 9-slot hotbar, block selection (keys 0-8).

### Rendering Pipeline

1. **Texture Atlas** (`src/constants/textureAtlas.ts`) — All 20 block textures packed into a single 128x64 `CanvasTexture`. Only 2 shared `MeshLambertMaterial`s (opaque + transparent water). AO encoded as per-vertex brightness via `aoVertexWeights`.
2. **Chunk Geometry Builder** (`src/game/helpers/chunkGeometryBuilder.ts`) — Builds merged `BufferGeometry` data (positions, normals, UVs, vertex colors, indices) from block data arrays. Separates opaque and transparent geometry.
3. **DDA Voxel Raycasting** (`src/game/helpers/voxelRaycast.ts`) — O(distance/blockWidth) grid traversal for block selection, replacing O(n) Three.js raycaster.
4. **Face Recomputation** (`src/game/helpers/recomputeChunkFaces.ts`) — Main-thread face visibility + AO recalculation for block placement/destruction.
5. **Distance Culling** — Chunks beyond FOG_CUTOFF_DISTANCE (700 units) are hidden. `FogExp2` density 0.004.

### Web Workers (Multi-threaded)

Heavy computation is offloaded to workers to keep the main thread responsive:

- **Terrain Workers** (`src/game/terrant/worker.ts`) — Dynamic pool (4-16 workers). Generate chunk block data, pre-calculate visible faces, compute ambient occlusion. Data transferred as `Int32Array` buffers.
- **Physics Worker** (`src/game/physics/worker.ts`) — Runs gravity, AABB collision detection, jump/movement physics. Sends position updates back to main thread. Also generates its own terrain data.

Worker communication is message-based (`postMessage`/`onmessage`), no shared state.

### Terrain Generation

Two world types in `src/game/terrant/`:
- **WorldGeneration** (`worldGeneration.ts`) — Noise-based using FastNoiseLite (OpenSimplex2). Multiple noise layers for terrain height, tree placement, and water.
- **FlatWorldGeneration** (`flatWorldGeneration.ts`) — Simple 3-layer flat world (grass/dirt/bedrock).
- **BaseUtilsGeneration** (`baseUtilsGeneration.ts`) — Shared base class with face culling logic (`calFaceToRender`) and AO calculation.

### Block Definitions

`src/constants/blocks.ts` — Defines all 17 block types with sounds (step/place/break) and inventory icons. Block type enum is in `src/type.ts` (`BlockKeys`). Texture mapping is in `src/constants/textureAtlas.ts` (`blockFaceToAtlasKey`).

### Key Constants

- `BLOCK_WIDTH = 2` — World-space size of one block
- `CHUNK_SIZE = 16` — 16x16 blocks per chunk
- `DEFAULT_CHUNK_VIEW = 20` — Renders 41x41 chunks (20 in each direction)
- `TIME_TO_INTERACT = 800` — Block break time in ms

### UI System

`src/UI/` — Page-based router (`src/UI/router/index.ts`) navigating between screens (main menu, world select/create/edit/delete, game render). Game HUD is HTML overlaid on the Three.js canvas. Base class `RenderPage` (`src/game/classes/renderPage.ts`) provides lifecycle hooks (`render`, `afterRender`, `setState`).

### State Persistence

Worlds saved to localStorage with structure: `{ name, createdDate, seed, worldType, blocksWorldChunk, initPos, rotation }`. `blocksWorldChunk` stores only player-modified blocks (placed/destroyed), not generated terrain.

### Input

- `src/game/action/input.ts` — Keyboard state (WASD, space, shift)
- `src/game/action/mouseControl.ts` — Pointer lock, first-person camera
