FROM node:18-alpine

# Install system dependencies (including ffmpeg)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nodemon.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY index.js .
COPY config/ ./config/

# Create directories for runtime
RUN mkdir -p client_data

# Set environment
ENV NODE_ENV=production

# Start bot
CMD ["npm", "start"]
