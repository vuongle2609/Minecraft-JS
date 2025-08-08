# Code Architecture

## High-Level Structure
The project follows a modular architecture with clear separation of concerns:

### Main Entry Points
- `src/main.ts`: Application entry point, initializes UI
- `src/UI/index.ts`: Main UI controller with router and sound manager
- `src/game/classes/gameScene.ts`: Core game engine and rendering loop

### Architecture Layers

#### 1. UI Layer (`src/UI/`)
- **Router**: Navigation between different screens (main menu, world selection, game)
- **Pages**: Individual screen implementations (mainScreen, selectWorld, gameRender, etc.)
- **Utils**: Helper utilities (selector, throttle, random)

#### 2. Game Engine (`src/game/`)
- **Classes**: Core game systems
  - `GameScene`: Main game loop and rendering
  - `ChunkManager`: World chunk loading/unloading
  - `Player`: Character controller and physics
  - `BlockManager`: Block type management
  - `InventoryManager`: Player inventory system
  - `SoundManager`: Audio system
  - `Light`: Lighting system
  - `Cloud`: Sky rendering

#### 3. Game Systems (`src/game/`)
- **Action**: Input handling (`mouseControl.ts`, `input.ts`)
- **Physics**: Physics engine with worker thread (`physics.ts`, `worker.ts`)
- **Terrain**: Procedural world generation (`worldGeneration.ts`, `flatWorldGeneration.ts`)
- **Helpers**: Utility functions for calculations and transformations

#### 4. Constants & Types (`src/constants/`, `src/types/`)
- Block definitions and properties
- Player constants
- TypeScript type definitions

### Key Design Patterns
- **Component-based architecture**: Game entities composed of modular components
- **Worker pattern**: Heavy computations (terrain generation, physics) run in web workers
- **Singleton pattern**: Managers (ChunkManager, SoundManager) are typically singletons
- **Observer pattern**: Event-driven communication between systems
- **Instanced rendering**: Efficient rendering of many similar blocks using Three.js InstancedMesh