//src/queues/emailQueue.js
const Queue = require("bull");
require("dotenv").config();

const emailQueue = new Queue("emailQueue", process.env.REDIS_URL, {
  defaultJobOptions: {
    attempts: parseInt(process.env.REDIS_MAX_RETRIES || "5"),
    backoff: { type: "exponential", delay: 5000 }, // réessaye en cas d’échec
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = emailQueue;
