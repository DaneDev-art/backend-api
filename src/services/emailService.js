// src/services/emailService.js
const emailQueue = require("../queues/emailQueue");

/**
 * Ajoute un email à la file BullMQ + Upstash
 * options = { to, subject, html, template, templateVars, from }
 */
const sendEmailJob = async (options) => {
  // -------------------------
  // Validation minimale
  // -------------------------
  if (!options || typeof options !== "object") {
    throw new Error("sendEmailJob: options doit être un objet");
  }
  if (!options.to) {
    throw new Error("sendEmailJob: 'to' est obligatoire");
  }
  if (!options.subject) {
    throw new Error("sendEmailJob: 'subject' est obligatoire");
  }

  // -------------------------
  // Ajout du job dans la Queue
  // -------------------------
  return emailQueue.add(
    "sendEmail", // <= Nom du job (obligatoire pour BullMQ)
    {
      to: options.to,
      subject: options.subject,
      html: options.html || null,
      template: options.template || null,
      templateVars: options.templateVars || {},
      from: options.from || null,
    },
    {
      // options supplémentaires (si tu veux override celles de emailQueue.js)
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 20000,
    }
  );
};

module.exports = { sendEmailJob };
