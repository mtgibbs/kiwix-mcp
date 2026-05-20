FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3000

USER node

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
