# Serve SPA and Email API with Node.js
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
ENV CACHE_BUSTER="2026-10-17-v2"
COPY dist ./dist
COPY server*.mjs automations_state.json* ./
EXPOSE 80
CMD ["node", "server.mjs"]
