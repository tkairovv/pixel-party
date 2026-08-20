# 🎨 Pixel Party — Realtime Collaborative Pixel-Art Web Game

Pixel Party is a full-stack, realtime multiplayer pixel-art party game where friends can create a room, scan a QR code from mobile/desktop, join instantly with a nickname, and draw together on a shared 64×64 canvas with authoritative server synchronization, pixel ownership tracking, and realtime player filtering.

---

## 🚀 Quick Start

### 1. Install Dependencies
From the root directory:
```bash
npm install
```

### 2. Run in Development Mode
To launch both frontend and backend concurrently:
```bash
npm run dev
```

Or run individually:
- **Backend**: `npm run dev:backend` (runs on `http://localhost:3001`)
- **Frontend**: `npm run dev:frontend` (runs on `http://localhost:5173`)

### 3. Run Automated Tests
```bash
npm test
```

---

## 🏗️ Architecture

```
pixel-party/
├── shared/                   # Shared types, constants, and utilities
│   ├── src/types.ts          # Authoritative models (Player, Room, PixelUpdate, CanvasSnapshot)
│   ├── src/constants.ts      # Canvas dimensions (64x64), 24-color palette, brush sizes
│   └── src/utils.ts          # Bresenham line algorithm, sanitizers, coordinate math
├── backend/                  # Server-authoritative Node.js + Express + Socket.IO
│   ├── src/server.ts         # Express REST & Socket.IO server entry
│   ├── src/store/
│   │   ├── roomStore.ts      # Authoritative LWW engine, monotonic sequence, idempotency
│   │   └── dbAdapter.ts      # PostgreSQL schema & persistence adapter
│   ├── src/socket/
│   │   ├── socketHandler.ts  # Realtime room & drawing socket event handlers
│   │   └── rateLimiter.ts    # Token-bucket rate limiter per socket
│   └── src/tests/
│       ├── consistency.test.ts # 8 automated consistency scenarios
│       └── e2e.test.ts       # Full multi-client lifecycle test
└── frontend/                 # React + TypeScript + Vite + Tailwind CSS + HTML5 Canvas
    ├── src/stores/           # Lightweight Zustand stores (room, player, canvas, ui)
    ├── src/socket/           # Resilient Socket.IO client with auto-sync & gap detection
    └── src/components/       # Modular UI components:
        ├── PixelCanvas.tsx   # Direct HTML5 canvas renderer (nearest-neighbor, filter dimming)
        ├── Toolbar.tsx       # Pencil, Eraser, Brush sizes (1x1, 2x2, 3x3), View controls
        ├── ColorPalette.tsx  # 24-color vibrant palette with active indicators
        ├── PlayersPanel.tsx  # Live player stats & realtime filter toggle
        ├── LobbyPage.tsx     # QR code scanner & room lobby
        └── GameFinished.tsx  # PNG Export (1024×1024 nearest-neighbor) & celebration
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env` optional)
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend HTTP & Socket.IO port |
| `HOST` | `0.0.0.0` | Host binding (`0.0.0.0` allows LAN mobile connections) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `CANVAS_WIDTH` | `64` | Configurable canvas logical width |
| `CANVAS_HEIGHT` | `64` | Configurable canvas logical height |
| `RATE_LIMIT_MAX` | `120` | Max operations/second per player |

### Frontend (`frontend/.env` optional)
| Variable | Default | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `""` (proxied by Vite) | Custom backend URL if hosted separately |

---

## 📱 Testing with Multiple Devices (LAN / Mobile)

1. Ensure your computer and phone are connected to the same Wi-Fi network.
2. Find your computer's local IP address (e.g., `192.168.1.50`).
3. Start the dev server: `npm run dev`.
4. Open `http://localhost:5173` on your PC, click **Create Room** -> you will see the Room QR Code.
5. Point your smartphone camera at the QR code (or browse to `http://<your-pc-ip>:5173/room/<roomId>`).
6. Enter a nickname on your phone and start drawing in realtime!

---

## 🛡️ Consistency Guarantee: Server-Authoritative LWW

1. **Per-Room Monotonic Sequence (`seq`)**: Every validated pixel change is assigned a strictly increasing integer sequence number by the server.
2. **Client `operationId`**: Deduplicates duplicate packets, retries, and network glitches.
3. **Delta & Snapshot Resync (`canvas:sync`)**: Clients detect sequence gaps and automatically request missing deltas or authoritative snapshots.
4. **Realtime Player Filter**: Clicking any player in the sidebar filters their pixels (bright) while dimming other players' pixels in realtime.
