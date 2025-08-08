# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Minecraft clone built with TypeScript and Three.js featuring terrain generation, ambient occlusion, basic physics, and world persistence. The game supports multiple world types with procedural generation using noise algorithms.

## Development Commands

- `npm run dev` - Start development server (skips intro screen in dev mode)
- `npm run build` - Build for production (TypeScript compilation + Vite bundling)
- `npm run preview` - Preview production build locally

## Architecture

### Core Structure
- **Entry Point**: `src/main.ts` → `src/UI/index.ts` → Game routing
- **Game Engine**: `src/game/classes/gameScene.ts` - Main game loop and rendering
- **Chunk System**: `src/game/classes/chunkManager.ts` - World streaming and management
- **Player System**: `src/game/player/character.ts` - Character controller and physics

### Key Systems
- **UI Layer** (`src/UI/`): Router-based navigation between screens
- **Game Classes** (`src/game/classes/`): Core game systems (BlockManager, InventoryManager, SoundManager, etc.)
- **Physics & Terrain**: Web Workers handle heavy computations (`src/game/physics/worker.ts`, `src/game/terrant/worker.ts`)
- **Asset Management**: Individual face meshes with shared geometry and face culling optimization

### Important Patterns
- **Worker Threads**: Terrain generation and physics run in separate workers
- **Face-based Rendering**: Each block face renders as individual Mesh objects with face culling  
- **Component Architecture**: Systems composed of focused, modular classes
- **Path Aliases**: Use `@/` prefix for src imports (`@/game/classes/...`)

## Code Conventions

- **Classes**: PascalCase (GameScene, ChunkManager)
- **Types/Interfaces**: PascalCase with Type suffix (WorldsType, BlocksType)  
- **Enums**: PascalCase (BlockKeys, BlockTextureType)
- **Constants**: SCREAMING_SNAKE_CASE (BLOCK_WIDTH)
- **Files**: camelCase for modules, PascalCase for class files

## Key Types & Enums

- `BlockKeys` - Enum of available block types (grass, stone, sand, etc.)
- `WorldsType` - Interface for world save data structure
- `BlocksType` - Complex type defining block properties, textures, and audio
- `PlayerInput` - Input state interface for player controls

## Development Notes

- Development mode automatically navigates to world selection (bypasses intro)
- The project uses ES modules throughout with Vite bundling
- No linting/testing tools configured - rely on TypeScript strict mode
- Heavy use of Three.js for 3D rendering with custom geometry generation
- Game state persists to localStorage for world saves

## Task Completion

When completing tasks, run `npm run build` to verify TypeScript compilation succeeds. Test functionality using `npm run dev` since the project lacks automated testing. The game is interactive, so manual browser testing is essential.