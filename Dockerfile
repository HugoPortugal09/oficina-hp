# Stage 1: Build the SPA
FROM node:22-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build

# Stage 2: Serve SPA and Email API with Node.js
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server.mjs ./
EXPOSE 80
CMD ["node", "server.mjs"]
