FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY .env.example ./ # not used at runtime; for reference

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "src/server.js"]
