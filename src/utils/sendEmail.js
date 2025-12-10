// src/utils/sendEmail.js
const Queue = require("bull");
const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const emailQueue = new Queue("email", redisUrl);

/**
 * sendEmail: ajoute une tâche d'email dans la queue.
 * payload: { to, subject, html, template, templateVars, from }
 */
const sendEmail = async (payload) => {
  try {
    // Validation minimale
    if (!payload || !payload.to || (!payload.html && !payload.template)) {
      throw new Error("Invalid email payload");
    }

    // Options: attempts/backoff gérées par Bull
    await emailQueue.add(payload, {
      attempts: parseInt(process.env.REDIS_MAX_RETRIES || "5", 10),
      backoff: {
        type: "exponential",
        delay: 60 * 1000, // 1min initial
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`📨 Email queued for ${payload.to}`);
    return true;
  } catch (err) {
    console.error("❌ enqueue sendEmail error:", err);
    throw err;
  }
};

module.exports = sendEmail;
