# Use a small official Node image (LTS)
FROM node:20-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Install production dependencies only
# Copy package files first to leverage layer caching
COPY package.json package-lock.json* ./
# Use npm ci for reproducible installs; omit dev deps in production
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Use a non-root user for security (the official Node image ships a "node" user)
USER node

# Set environment and exposed port
ENV NODE_ENV=production
EXPOSE 5000

# Start the app
CMD ["node", "server.js"]
