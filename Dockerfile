FROM node:20-alpine

# Créer dossier de travail
WORKDIR /usr/src/app

# Copier package.json et installer dépendances
COPY package*.json ./
RUN npm install --omit=dev

# Copier le reste du code
COPY . .

# Définir l'environnement
ENV NODE_ENV=production

# Exposer ton port 5000
EXPOSE 5000

# Lancer le serveur
CMD ["node", "server.js"]
