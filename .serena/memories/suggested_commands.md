# Suggested Commands

## Development Commands
- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build locally

## Project Setup
- `npm install` - Install all dependencies
- `npm run dev` - Start development (goes directly to world selection in dev mode)

## Build Process
The build process includes:
1. TypeScript compilation (`tsc`)
2. Vite bundling with optimizations
3. Asset processing and chunking

## Important Notes
- Development mode (`npm run dev`) skips the intro screen and goes directly to world selection
- The project uses ES modules throughout
- Vite handles hot module replacement for fast development
- Build output is optimized with code splitting per dependency
- No linting or testing commands are currently configured