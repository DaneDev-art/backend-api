FROM mongo:6

# Installer AWS CLI, cron et bash
RUN apt-get update && \
    apt-get install -y awscli cron bash && \
    rm -rf /var/lib/apt/lists/*

# Copier le script de backup corrigé
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Créer le fichier de log si non existant
RUN touch /var/log/cron.log

# Ajouter la tâche cron (tous les jours à 2h UTC)
RUN echo "0 2 * * * root /bin/bash /usr/local/bin/backup.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/mongo-backup

# Donner les permissions correctes au fichier cron
RUN chmod 0644 /etc/cron.d/mongo-backup

# S'assurer que les droits sur le dossier de backups sont corrects
VOLUME /backups

# Définir un environnement par défaut pour Mongo URI (peut être surchargé par .env)
ENV MONGO_URI="mongodb://mongo:27017/mydb"

# Démarrer cron en foreground
CMD ["cron", "-f"]
