# Code Style and Conventions

## TypeScript Configuration
- **Target**: ESNext with DOM libs
- **Strict mode**: Enabled with strict type checking
- **Module system**: ES modules with Node resolution
- **Path aliases**: `@/*` maps to `./src/*` for clean imports
- **No emit**: TypeScript used only for type checking, Vite handles compilation

## Naming Conventions
- **Classes**: PascalCase (e.g., `GameScene`, `ChunkManager`)
- **Interfaces/Types**: PascalCase with descriptive suffixes (e.g., `WorldsType`, `BlocksType`)
- **Enums**: PascalCase (e.g., `BlockKeys`, `BlockTextureType`)
- **Variables/Functions**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `BLOCK_WIDTH`)
- **Files**: camelCase for modules, PascalCase for classes

## Code Organization
- **Imports**: Grouped and ordered (external dependencies first, then local imports)
- **Path aliases**: Use `@/` prefix for src imports instead of relative paths
- **Enums**: Used extensively for type-safe constants (BlockKeys, BlockTextureType, etc.)
- **Interfaces**: Well-defined interfaces for complex data structures

## Architecture Patterns
- **Class-based**: Heavy use of ES6 classes for game entities
- **Component composition**: Systems composed of smaller, focused modules
- **Worker separation**: Computationally heavy tasks moved to web workers
- **Type safety**: Strong typing throughout with custom interfaces

## File Structure
- **Index files**: Each major directory has an index.ts for clean exports
- **Asset organization**: Assets organized by type (block textures, sounds, etc.)
- **Separation of concerns**: Clear separation between UI, game logic, and utilities