FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 5000
CMD ["node", "server.js"]
