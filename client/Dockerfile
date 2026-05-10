FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 5173

CMD ["npx", "vite", "--host"]
