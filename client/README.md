# TurboFeed-LowVol — Client

A React + TypeScript + Vite frontend for the Creative Automation platform.

## Prerequisites

- Node.js v16+
- npm

## Installation

```bash
cd client
npm install
```

## Running the App

```bash
npm start
```

The app will be available at `http://localhost:5173`.

## Linting

```bash
npm run lint
```

## Server Connection

This frontend connects to the backend server at `http://localhost:3001`. Make sure the server is running first:

```bash
cd ../server
npm run server
```

For full backend documentation (API endpoints, environment config, GenAI setup), see the [Server README](../server/README.md).
