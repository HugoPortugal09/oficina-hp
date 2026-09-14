# Stage 1: Build the SPA
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve SPA and Email API with Node.js Alpine
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server.mjs ./
EXPOSE 80
CMD ["node", "server.mjs"]
