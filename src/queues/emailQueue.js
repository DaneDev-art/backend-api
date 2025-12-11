// src/queues/emailQueue.js
const { Queue } = require("bullmq");
require("dotenv").config();

// Connexion Upstash (SSL obligatoire)
const connection = {
  url: process.env.REDIS_URL, // rediss://default:xxxx@xxxxx.upstash.io:6379
  tls: {
    rejectUnauthorized: false, // 🔥 Important pour Upstash + BullMQ
  },
};

// Initialisation de la queue
const emailQueue = new Queue("emailQueue", {
  connection,
  defaultJobOptions: {
    attempts: parseInt(process.env.REDIS_MAX_RETRIES || "5", 10),
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = emailQueue;
