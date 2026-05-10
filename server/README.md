# TurboFeed-LowVol — Server

An Express.js/TypeScript backend that enables marketing teams to generate, localize, and manage social media campaign creatives across multiple aspect ratios.

## Prerequisites

- Node.js v16+
- npm

## Installation

```bash
cd server
npm install
```

## Environment Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

### Environment Variables

| Variable              | Default       | Description                                       |
| --------------------- | ------------- | ------------------------------------------------- |
| `PORT`                | `3001`        | Server listen port                                |
| `NODE_ENV`            | `development` | Environment mode                                  |
| `GENAI_PROVIDER`      | `openai`      | GenAI provider (`openai`)                         |
| `OPENAI_API_KEY`      | —             | OpenAI API key (required if provider is `openai`) |
| `GENAI_TIMEOUT`       | `30000`       | GenAI request timeout in ms                       |
| `GENAI_MAX_RETRIES`   | `2`           | Retry attempts on GenAI failure                   |
| `OUTPUT_DIR`          | `outputs`     | Directory for generated creatives                 |
| `MAX_ASSET_SIZE`      | `10485760`    | Max upload size in bytes (10 MB)                  |
| `MIN_IMAGE_DIMENSION` | `800`         | Minimum image width/height in px                  |

## Running the Server

```bash
npm run server
```

The server starts at `http://localhost:3001` (or your configured `PORT`).

## Running Tests

```bash
npm test                # Run all tests once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

## API Endpoints

| Method | Endpoint                              | Description                 |
| ------ | ------------------------------------- | --------------------------- |
| `POST` | `/api/campaigns`                      | Create a new campaign       |
| `GET`  | `/api/campaigns/:campaignId`          | Retrieve campaign details   |
| `GET`  | `/api/campaigns/:campaignId/outputs`  | Retrieve campaign outputs   |
| `POST` | `/api/campaigns/:campaignId/assets`   | Upload a campaign asset     |
| `POST` | `/api/campaigns/:campaignId/generate` | Trigger creative generation |

### POST /api/campaigns

Create a campaign from a structured brief.

**Request body:**

```json
{
	"products": ["HydraBolt Sports Drink", "TrailBlazer Running Shoes"],
	"targetRegion": "North America",
	"targetAudience": "Fitness enthusiasts aged 18-45",
	"campaignMessage": "Push your limits"
}
```

**Validation rules:**

- `products` — array with at least 2 non-empty strings (required)
- `targetRegion` — non-empty string (required)
- `targetAudience` — non-empty string (required)
- `campaignMessage` — non-empty string (required)

**Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "brief": { "...same as request..." },
  "createdAt": "2024-01-15T10:30:00.000Z",
  "status": "draft",
  "outputs": []
}
```

### POST /api/campaigns/:campaignId/assets

Upload an image asset for a campaign. Send as `multipart/form-data` with a `file` field.

**Accepted formats:** JPEG, PNG, WebP  
**Max file size:** 10 MB  
**Min dimensions:** 800×800 px

**Response (201):**

```json
{
	"id": "660e8400-e29b-41d4-a716-446655440001",
	"campaignId": "550e8400-e29b-41d4-a716-446655440000",
	"fileName": "hero-image.jpg",
	"mimeType": "image/jpeg",
	"uploadedAt": "2024-01-15T10:35:00.000Z",
	"metadata": { "width": 2000, "height": 2000, "size": 1048576 }
}
```

### POST /api/campaigns/:campaignId/generate

Trigger creative generation for all products × aspect ratios.

**Request body (optional):**

```json
{
	"useGenAI": false
}
```

- `useGenAI` — force AI image generation instead of using uploaded assets (default `false`)

**Response (200):**

```json
{
	"campaignId": "550e8400-...",
	"outputs": [
		{
			"product": "HydraBolt Sports Drink",
			"aspectRatio": "1:1",
			"filePath": "outputs/550e8400-.../HydraBolt_Sports_Drink/1-1/creative.jpg",
			"generatedAt": "2024-01-15T10:40:00.000Z"
		}
	],
	"generatedAt": "2024-01-15T10:40:00.000Z",
	"errors": []
}
```

### GET /api/campaigns/:campaignId

Returns the full campaign object including brief, status, and outputs.

### GET /api/campaigns/:campaignId/outputs

Returns `{ campaignId, outputs }` for the given campaign.

### Error Responses

All errors follow a consistent shape:

```json
{
	"error": {
		"code": "VALIDATION_ERROR | NOT_FOUND | SERVER_ERROR",
		"message": "Human-readable description",
		"details": {},
		"timestamp": "2024-01-15T10:30:00.000Z"
	}
}
```

| Status | Meaning                                             |
| ------ | --------------------------------------------------- |
| `400`  | Validation error (missing fields, bad format, etc.) |
| `404`  | Campaign or asset not found                         |
| `500`  | Internal server error                               |

## Output Directory Structure

Generated creatives are saved under the configured `OUTPUT_DIR`:

```
outputs/
  └── {campaignId}/
      ├── {Product_Name}/
      │   ├── 1-1/
      │   │   └── creative.jpg
      │   ├── 9-16/
      │   │   └── creative.jpg
      │   └── 16-9/
      │       └── creative.jpg
      └── manifest.json
```

- Product folders use underscores in place of spaces, special characters removed
- Aspect ratio folders use hyphens (e.g. `1-1`, `9-16`, `16-9`)
- Each campaign gets a `manifest.json` summarizing all outputs

## Supported Aspect Ratios

| Ratio | Dimensions | Use Case                   |
| ----- | ---------- | -------------------------- |
| 1:1   | 1080×1080  | Instagram square           |
| 9:16  | 1080×1920  | Instagram/TikTok stories   |
| 16:9  | 1920×1080  | YouTube/Facebook landscape |

## GenAI Integration

The system can generate hero images via AI when no uploaded assets are available.

**Supported providers:**

- **OpenAI DALL-E 3** — set `GENAI_PROVIDER=openai` and provide `OPENAI_API_KEY`

GenAI is optional. The system works with uploaded assets only. If GenAI fails, the pipeline continues with available assets and reports errors in the response.

Retry behavior: exponential backoff, up to `GENAI_MAX_RETRIES` attempts per request.

## Architecture

```
Campaign_Manager  — Campaign CRUD, brief validation, metadata storage
Asset_Manager     — Image upload, format/size/dimension validation, in-memory storage
Creative_Generator — Orchestration pipeline: resize → text overlay → file output
GenAI_Service     — AI image generation with retry and fallback
Image_Processor   — Sharp-based resize, crop, and SVG text overlay
```

### Key Design Decisions

- **In-memory storage** — campaigns and assets are stored in Maps for rapid prototyping. No database required.
- **Sharp for image processing** — high-performance native library for resize, crop, and composite operations.
- **SVG text overlay** — campaign messages rendered as SVG and composited onto images for consistent typography.
- **Modular pipeline** — each component (Campaign_Manager, Asset_Manager, Creative_Generator, GenAI_Service) is independently testable.
- **Graceful degradation** — GenAI failures don't block the pipeline; errors are collected and reported.

### Known Limitations

- All data is in-memory and lost on server restart
- No authentication or authorization
- No persistent database
- Single-node only (no horizontal scaling)
- Text overlay uses a single-line layout; long messages are truncated at 100 characters
- GenAI image generation requires valid API keys and network access
- File uploads are stored in memory (large uploads consume server RAM)

## Client

For the React frontend, see the [Client README](../client/README.md).
