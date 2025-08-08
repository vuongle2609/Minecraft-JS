# Project Overview

## Purpose
This is a Minecraft clone built with TypeScript and Three.js. The game features:
- Terrain generation with procedural chunks
- Ambient occlusion rendering for realistic lighting
- Basic physics engine with collision detection
- World persistence (save/load functionality)
- Player inventory and block placement/destruction
- Multiple world types and seeds support

## Tech Stack
- **Frontend Framework**: Vanilla TypeScript with Vite
- **3D Graphics**: Three.js (version 0.158.0)
- **Build Tool**: Vite with TypeScript compilation
- **Noise Generation**: fastnoise-lite for terrain generation
- **UI Framework**: Custom HTML/CSS with Tailwind CSS
- **Audio**: Web Audio API for sound effects
- **Worker Threads**: Web Workers for terrain generation and physics

## Key Dependencies
- three: 3D graphics library
- dat.gui: Debug interface
- fastnoise-lite: Procedural noise generation
- uuid: Unique identifier generation
- tailwindcss: CSS framework
- vite: Development and build tool