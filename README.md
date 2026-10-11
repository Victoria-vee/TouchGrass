# OutNAbout

outNAbout is a small web app for taking a break from screens. It uses AI to suggest a gentle outdoor quest, then gives you a place to reflect on what you noticed in handwritten notes.

## Features

- AI-generated outdoor quests designed to take about 10–20 minutes
- Paper-and-pen confirmation before a session
- Handwritten reflection photo required to save a completion
- Optional AI feedback on notes, with clarification when handwriting is unclear
- 5 XP for each saved completion
- A persistent journal of completed quests and reflections

## How it works

1. Request a quest from Gemma 3 4B through the local Ollama service.
2. Bring paper and a pen, head outdoors, and record anything you want to remember.
3. Return to the app, optionally request AI feedback, and submit a photo of your notes to save the completion.
4. Review saved quests and reflections in the journal.

## Open-source AI

The app uses the open-weight Gemma 3 4B model through Ollama. Its local text and image inference lets you generate quests and review handwritten notes without a paid, hosted AI API. The model runs on the machine hosting Ollama; MongoDB Atlas still stores journal records.

## Technology stack

- React 19 and Vite 8
- Node.js with JavaScript ES modules and Express 5
- MongoDB Atlas with Mongoose 8
- Ollama with `gemma3:4b`
- Multer for photo uploads

## Prerequisites

- Node.js 20.19+ or 22.12+ (the backend itself requires Node.js 18+)
- A MongoDB Atlas cluster and connection URI
- Ollama installed and running, with `gemma3:4b` available

## Local setup

### 1. Configure the backend

From the repository root, in PowerShell:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` and replace the MongoDB URI placeholder with your Atlas connection string. Ensure the cluster permits your connection. The `.env` file is ignored by Git; do not commit credentials.

### 2. Set up Ollama

Start Ollama, then download the required model:

```sh
ollama pull gemma3:4b
```

### 3. Start the backend

In a terminal from the `server` directory:

```sh
npm run dev
```

The API listens at `http://localhost:3000` by default. It provides `GET /api/health`, `POST /api/challenges`, `POST /api/reflections`, and `GET`/`POST /api/completions`.

### 4. Start the frontend

In a second terminal from the repository root:

```sh
cd client
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`.

## Environment variables

The backend loads `server/.env`. Values below are the defaults in the code; `MONGODB_URI` is required and has no default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | None (required) | MongoDB Atlas connection string |
| `PORT` | `3000` | Backend port |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama API URL |
| `OLLAMA_MODEL` | `gemma3:4b` | Model used for quests and reflections |
| `OLLAMA_TIMEOUT_MS` | `120000` | Challenge generation timeout in milliseconds |
| `OLLAMA_REFLECTION_TIMEOUT_MS` | `180000` | Reflection inference timeout in milliseconds |

Use a placeholder URI in configuration examples, never a real credential:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/<database>?retryWrites=true&w=majority
```

## Usage

Generate a quest, confirm you have paper and a pen, and take the suggested break outdoors. When you return, you can add a typed summary and request optional AI feedback. Submit a photo of your handwritten notes to save the quest and earn 5 XP; if the handwriting is unclear, you can provide a clarification. Open the journal to revisit saved entries.

## Journal and photo storage

Quest and reflection records are stored in MongoDB Atlas. Uploaded journal photos are stored as files in `server/uploads`, and the database keeps their local paths. Back up that folder to retain the photos. Local file storage is not durable across deployments that replace or discard server files, and it is not shared across multiple server instances.

## Project philosophy

OutNAbout is meant to make stepping away from a screen feel welcoming and low-pressure. Quests are gentle invitations, not tasks to optimize or score. Paper and pen give the outdoor moment room to stay offline; the journal is there when you return.

## Contributing

Bug reports and focused contributions are welcome. Open an issue to discuss a larger change, and include setup or manual verification notes with a pull request. Never commit `.env` files, credentials, or private journal photos.

## License

No license file is currently included. Until a license is added, the repository does not state permission to reuse, modify, or redistribute its code.
