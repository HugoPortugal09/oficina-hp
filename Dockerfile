# Serve SPA and Email API with Node.js
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY dist ./dist
COPY server.mjs ./
EXPOSE 80
CMD ["node", "server.mjs"]
