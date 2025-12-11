// src/utils/sendEmail.js
require("dotenv").config();
const emailQueue = require("../queues/emailQueue");

/**
 * sendEmail: ajoute un email dans la queue BullMQ
 * payload: { to, subject, html, template, templateVars, from }
 */
const sendEmail = async (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("sendEmail: payload doit être un objet");
  }
  if (!payload.to) {
    throw new Error("sendEmail: 'to' est obligatoire");
  }
  if (!payload.subject) {
    throw new Error("sendEmail: 'subject' est obligatoire");
  }

  try {
    await emailQueue.add(
      "sendEmail",
      {
        to: payload.to,
        subject: payload.subject,
        html: payload.html || null,
        template: payload.template || null,
        templateVars: payload.templateVars || {},
        from: payload.from || process.env.EMAIL_FROM,
      },
      {
        attempts: parseInt(process.env.REDIS_MAX_RETRIES || "5", 10),
        backoff: {
          type: "exponential",
          delay: 5000, // Retry 5s → 10s → 20s → 40s → etc.
        },
        removeOnComplete: true,
        removeOnFail: false,
        timeout: 20000,
      }
    );

    console.log(`📨 Email ajouté à la queue pour: ${payload.to}`);
    return true;
  } catch (err) {
    console.error("❌ Erreur queue sendEmail:", err.message);
    throw err;
  }
};

module.exports = sendEmail;
