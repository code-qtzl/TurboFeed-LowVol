# TurboFeed-LowVol

Creative automation pipeline that generates social ad campaign assets from a brief. Upload product images (or let AI generate them), and the system produces creatives across multiple aspect ratios with campaign messaging overlaid.

> [!IMPORTANT]
> **News: This project is cooking**
> \
> Status: **Active Development**
> \
> This project is currently "cooking" and evolving rapidly. Expect frequent breaking changes and updates. If you encounter a bug or have a feature request, please open an issue. If you'd like to help build this, forks and pull requests are highly encouraged! Check out how to [CONTRIBUTE](CONTRIBUTING.md).

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- An [OpenAI API key](https://platform.openai.com/api-keys) — used for AI image generation (the fallback when no product images are uploaded). **Note:** OpenAI has deprecated DALL-E 3 as of May 12, 2026. If your key no longer has access to DALL-E 3, upload your own product images in Step 2 to skip AI generation.
- A [Fal AI API key](https://fal.ai/dashboard/keys) — needed for video generation and image relighting features.

### Run

```bash
OPENAI_API_KEY=sk-your-key FAL_KEY=your-fal-key docker compose up
```

That's it. The client runs on **http://localhost:5173** and the server on **http://localhost:3001**.

Generated creatives are saved to `./server/outputs/`.

To rebuild after code changes:

```bash
docker compose build --no-cache && docker compose up
```

---

<details>
<summary><strong>Manual Setup (without Docker)</strong></summary>

### Prerequisites

- Node.js v20+

### 1. Install everything

```bash
npm run install:all
```

### 2. Configure your API key

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set your `OPENAI_API_KEY`.

### 3. Start the server

```bash
cd server
npm run server
```

Server runs on **http://localhost:3001**

### 4. Start the client

In a separate terminal:

```bash
cd client
npm start
```

Client runs on **http://localhost:5173**

</details>

## How It Works

1. **Create a campaign** — Submit a brief with products, target region, audience, and message
2. **Upload assets** — Add product images (or skip to let DALL-E 3 generate them)
3. **Generate creatives** — The pipeline resizes images to 1:1, 9:16, and 16:9 and overlays your campaign message
4. **Review outputs** — Browse generated creatives organized by product and aspect ratio

## Project Structure

```
├── docker-compose.yml  # One-command startup for both services
├── server/             # Express API + image processing pipeline
│   ├── Dockerfile
│   ├── src/            # Source code (endpoints, GenAI, image processor)
│   ├── outputs/        # Generated campaign creatives
│   └── .env            # Your API keys (not committed)
├── client/             # React + Vite frontend
│   ├── Dockerfile
│   └── src/            # UI components (4-step campaign workflow)
└── package.json        # Root scripts (install:all)
```

## API Endpoints

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/api/campaigns`              | Create a campaign from a brief |
| POST   | `/api/campaigns/:id/assets`   | Upload a product image         |
| POST   | `/api/campaigns/:id/generate` | Run the creative pipeline      |
| GET    | `/api/campaigns/:id`          | Get campaign details           |
| GET    | `/api/campaigns/:id/outputs`  | Get generated output manifest  |

## Example Brief

```json
{
	"products": ["Mommas House"],
	"targetRegion": "North America",
	"targetAudience": "Mothers",
	"campaignMessage": "Luxury Living"
}
```

## Running Tests

```bash
cd server && npm test        # Server unit + property tests
cd client && npm test        # Client component tests
```

## Key Design Decisions

- **In-memory storage** — Campaigns and assets live in memory (no database required for the PoC)
- **GenAI fallback** — If no images are uploaded, DALL-E 3 generates product photography automatically
- **Sharp for image processing** — Resizing and text overlay handled server-side via Sharp
- **Organized outputs** — Each campaign gets a folder: `outputs/{id}/{product}/{ratio}/creative.jpg`

See [server/README.md](server/README.md) and [client/README.md](client/README.md) for detailed docs.

--

## License

[MIT License](LICENSE)
