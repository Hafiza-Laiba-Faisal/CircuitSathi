**⚔️  Circuits as a Quest**  
*A Pixel-Art RPG that teaches electronics*

Next.js 14  •  PixiJS  •  Gemini Vision  •  ElevenLabs  •  MongoDB

# **1\. Overview**

Circuits as a Quest is an educational web platform that transforms electronic circuit schematics into playable 2D pixel-art RPG scenes. Users upload a hand-drawn or digital circuit diagram; the platform's AI pipeline parses it, generates a living adventure world, and narrates the circuit's behaviour as an unfolding quest story.

Every component in the schematic becomes a landmark, obstacle, or character in a 16-bit Pokémon-style world. Current flow is embodied by a hero sprite that journeys through roads, swamps, dungeons, and bonfires — making abstract electronics tangible and memorable.

**🎯  Design Philosophy**  
Show, don't tell — animate the physics rather than lecturing.  
Each circuit generates a unique scene with its own biome palette and quest narrative.  
Complexity scales gracefully: a simple LED circuit is a short forest path; a full H-bridge is a multi-dungeon world.

# **2\. Component → RPG World Mapping**

The table below defines the canonical translation layer between circuit components and their in-game equivalents. This mapping lives in shared/types/mappings.ts and is consumed by both the simulation engine and the PixiJS renderer.

| ⚡ Component | 🏰 RPG Element | 📖 Narrative | 🎨 Scene Tint |
| :---- | :---- | :---- | :---- |
| Battery / PSU | The Hero's Spawn Throne | Origin of all power; the quest begins here | Warm amber — dawn light |
| Wire | Road / Forest Path | Carries the hero between landmarks | Earthy green |
| Resistor | Swamp / Enemy Encounter | Slows the current-hero; voltage drops as they fight | Murky brown |
| Capacitor | Dungeon Holding Cell | Hero waits inside, then bursts through when full | Deep indigo |
| LED / Bulb | Bonfire / Torch | Lights up and animates when current arrives | Bright orange glow |
| Switch (open) | Raised Drawbridge | Impassable — blocks the hero's route | Stone grey |
| Switch (closed) | Lowered Drawbridge | Path opens; hero walks across | Stone grey \+ sparkle |
| Parallel branch | Fork in the Road | Hero clones and takes both paths simultaneously | Split-screen teal |
| Ground | Exit Portal / World's Edge | Journey ends; charge returns to the earth | Void purple |
| Short circuit | Cursed Shortcut | Hero rushes through uncontrolled — danger flashes | Flashing red |
| Voltage divider | Two-Enemy Gauntlet | Hero loses energy fighting each in sequence | Gradient ochre |
| Open circuit | Broken Bridge | Hero stops; cannot continue — quest blocked | Grey with crack |

# **3\. Architecture**

## **3.1 Monorepo Structure**

circuits-as-a-quest/  
├── frontend/          \# Next.js 14  (React, Tailwind, Zustand, React Flow, PixiJS)  
├── backend/           \# Node.js \+ Express REST API  (TypeScript, Mongoose)  
├── shared/            \# Shared TypeScript types (CircuitGraph, SceneConfig, …)  
└── README.md

## **3.2 Data Flow**

The platform follows a five-stage pipeline from image upload to animated scene:

1. User uploads a circuit image (JPEG/PNG/PDF) via the React frontend.

2. POST /api/upload sends the image to Gemini Vision, which returns a CircuitGraph JSON — a nodes-and-edges representation of every component and connection.

3. POST /api/simulate runs Kirchhoff's laws on the CircuitGraph, annotating each node with voltage, current magnitude, and fault flags.

4. The annotated graph is mapped through shared/types/mappings.ts into a SceneConfig (tile layout, sprite assignments, biome palette, animation speeds).

5. POST /api/narrate sends the SceneConfig summary to Gemini for quest commentary, then pipes the text to ElevenLabs, returning an audio URL.

6. The PixiJS renderer in CityView.tsx consumes the SceneConfig and spawns the hero sprite, begins the journey animation, and plays the narration audio.

## **3.3 Key Shared Types**

// shared/types/circuit.ts  
export interface CircuitNode {  
  id:        string;  
  type:      ComponentType;   // 'resistor' | 'capacitor' | 'led' | …  
  value?:    number;          // Ohms, Farads, Volts …  
  voltage?:  number;          // populated after simulation  
  current?:  number;  
  fault?:    'open' | 'short' | null;  
}  
   
export interface SceneConfig {  
  biome:     BiomeType;       // 'forest' | 'dungeon' | 'desert' | …  
  tint:      string;          // hex colour overlay  
  tiles:     TileMap;  
  sprites:   SpriteAssignment\[\];  
  heroSpeed: number;          // pixels/sec — scales with current  
  narrative: string;          // Gemini-generated quest text  
  audioUrl:  string;  
}

# **4\. Setup & Running Locally**

## **4.1 Prerequisites**

* Node.js 18+

* npm 9+

* A MongoDB Atlas cluster (or local mongod instance)

* Google Gemini API key (Vision \+ text generation)

* ElevenLabs API key

## **4.2 Clone**

git clone \<repo-url\>  
cd circuits-as-a-quest

## **4.3 Frontend**

cd frontend  
npm install  
npm run dev  
\# → http://localhost:3000

## **4.4 Backend**

cd backend  
copy .env.example .env    \# Windows  
\# cp .env.example .env   \# macOS / Linux  
notepad .env             \# fill in your keys  
npm install  
npm run dev  
\# → http://localhost:3001

## **4.5 Run Both Services Simultaneously (Windows)**

Option A — two separate PowerShell windows:

\# Terminal 1  
cd circuits-as-a-quest\\frontend && npm run dev  
   
\# Terminal 2  
cd circuits-as-a-quest\\backend && npm run dev

Option B — single command with concurrently:

npm install \-g concurrently  
concurrently "npm run dev \--prefix frontend" "npm run dev \--prefix backend"

Option C — PowerShell one-liner (launches two windows):

Start-Process powershell \-ArgumentList "-NoExit","-Command","cd '$PWD\\frontend'; npm run dev"  
Start-Process powershell \-ArgumentList "-NoExit","-Command","cd '$PWD\\backend'; npm run dev"

## **4.6 Environment Variables**

| Variable | Service | Description |
| :---- | :---- | :---- |
| **PORT** | backend | HTTP port (default 3001\) |
| **MONGODB\_URI** | backend | MongoDB Atlas connection string |
| **GEMINI\_API\_KEY** | backend | Google Gemini API key (Vision \+ text generation) |
| **ELEVENLABS\_API\_KEY** | backend | ElevenLabs text-to-speech API key |
| **NEXT\_PUBLIC\_API\_URL** | frontend | Backend base URL (default http://localhost:3001) |

# **5\. Developer Branches**

Three feature branches are ready for parallel development. Checkout your branch before starting:

git checkout feature/city-renderer       \# Person 1  
git checkout feature/simulation-engine   \# Person 2  
git checkout feature/ai-pipeline         \# Person 3

| Branch | Owner | Owns |
| :---- | :---- | :---- |
| **feature/city-renderer** | **Person 1 — PixiJS & UI** | CityView.tsx (PixiJS RPG canvas), sprite rendering, tile maps, day/night, animation loop, responsive layout |
| **feature/simulation-engine** | **Person 2 — Sim & Data** | SchematicBuilder.tsx (manual draw mode), simulate.ts (Kirchhoff solver), projects.ts (MongoDB CRUD), Zustand wiring |
| **feature/ai-pipeline** | **Person 3 — AI & Audio** | upload.ts (Gemini Vision → CircuitGraph), narrate.ts (ElevenLabs TTS), ExplanationPanel.tsx, optional Python pre-processor |

## **feature/city-renderer — PixiJS RPG World**

Owns the visual heart of the project. Responsible for:

* CityView.tsx — PixiJS Application with 16-bit tilemap rendering

* Hero sprite controller — movement speed proportional to current magnitude

* Biome tile sets: forest paths, dungeon corridors, desert dunes, arctic tundra

* Component sprites: swamp (resistor), bonfire (LED), drawbridge (switch), portal (ground)

* Fault animations: flashing red overlay for short circuits, grey crack for open circuits

* Day/night cycle keyed to circuit operating time

* Responsive layout — side panel for ExplanationPanel, main canvas for scene

## **feature/simulation-engine — Circuit Solver & Data**

Owns the mathematical core and persistence layer:

* SchematicBuilder.tsx — React Flow drag-and-drop editor (manual circuit drawing mode)

* simulate.ts — Node voltage method / Kirchhoff's laws, returns voltages \+ currents per edge

* Fault detection: identifies open circuits, short circuits, over-current nodes

* projects.ts — MongoDB CRUD: save, load, list, delete CircuitGraph \+ SceneConfig pairs

* Zustand store wiring: schematic state ↔ scene state ↔ UI state

## **feature/ai-pipeline — Gemini Vision \+ ElevenLabs**

Owns the AI ingestion and narration pipeline:

* upload.ts — accepts image upload, calls Gemini Vision with structured prompt, parses response into CircuitGraph

* narrate.ts — takes annotated SceneConfig, generates quest narrative via Gemini, sends to ElevenLabs, returns audio URL

* ExplanationPanel.tsx — displays quest narrative text, audio player with waveform, key circuit facts

* Optional Python microservice for image pre-processing (contrast boost, noise removal) before Gemini ingestion

# **6\. API Reference**

All endpoints are prefixed with /api and served by the Express backend on port 3001\.

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **GET** | /api/health | Health check — returns server status |
| **GET** | /api/projects | List all saved quest (circuit) projects |
| **POST** | /api/projects | Save a new project (CircuitGraph \+ scene metadata) |
| **GET** | /api/projects/:id | Fetch a project by ID |
| **DELETE** | /api/projects/:id | Delete a project |
| **POST** | /api/simulate | Run simulation on a CircuitGraph — returns voltages, currents, faults |
| **POST** | /api/upload | Upload circuit image → Gemini Vision → CircuitGraph JSON |
| **POST** | /api/narrate | Gemini generates quest commentary → ElevenLabs audio URL |

## **Example: Upload & Simulate**

\# 1\. Upload a circuit image  
curl \-X POST http://localhost:3001/api/upload \\  
  \-F "image=@my\_circuit.png"  
\# → { circuitGraph: { nodes: \[...\], edges: \[...\] } }  
   
\# 2\. Simulate the returned graph  
curl \-X POST http://localhost:3001/api/simulate \\  
  \-H "Content-Type: application/json" \\  
  \-d '{"circuitGraph": { ... }}'  
\# → { sceneConfig: { biome, tiles, heroSpeed, ... } }  
   
\# 3\. Generate narration audio  
curl \-X POST http://localhost:3001/api/narrate \\  
  \-H "Content-Type: application/json" \\  
  \-d '{"sceneConfig": { ... }}'  
\# → { audioUrl: "https://...elevenlabs.io/..." }

# **7\. Scene Biomes**

The simulation engine selects a biome automatically based on circuit characteristics. Biome palettes are defined in shared/types/biomes.ts and can be overridden per project.

* Forest (default) — green palette, dirt paths, trees. Simple series/parallel circuits.

* Dungeon — deep indigo, torchlit corridors. Circuits with capacitors or complex loops.

* Desert — warm amber and ochre. High-resistance circuits with significant voltage drops.

* Arctic Tundra — pale blue, icy paths. Low-current circuits with LEDs.

* Lava World — red and orange. Fault / short-circuit states; flashing danger overlay.

* Void — dark purple. Open-circuit states; the hero cannot proceed.

# **8\. Contributing**

7. Fork the repository and create your feature branch from the assigned branch above.

8. Ensure shared/ types are updated before changing API contracts — both services depend on them.

9. Run npm run typecheck in both frontend/ and backend/ before opening a PR.

10. Add a brief description of any new component → RPG mapping to shared/types/mappings.ts.

11. PRs should target main and require one reviewer approval.

**💡  Tip for Person 3 (AI Pipeline)**  
Gemini Vision works best with high-contrast schematic images.  
Pre-process uploads with Python (Pillow) to threshold to black-and-white before sending.  
Ask Gemini to return CircuitGraph as strict JSON with a schema you provide in the prompt.

Circuits as a Quest  •  Built with Next.js, PixiJS, Gemini & ElevenLabs  •  *May your current flow true ⚡*