FROM node:20-slim

# fontconfig is required by sharp/libvips for SVG text overlay
RUN apt-get update && apt-get install -y --no-install-recommends \
    fontconfig \
    ffmpeg \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3001

CMD ["npx", "ts-node", "src/server.ts"]
