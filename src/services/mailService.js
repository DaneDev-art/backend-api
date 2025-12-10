// src/services/emailService.js
const emailQueue = require("../queues/emailQueue");

/**
 * Ajoute un email à la file Bull (queue)
 * options = { to, subject, html, template, templateVars, from }
 */
const sendEmailJob = async (options) => {
  // -------------------------
  // Validation minimale
  // -------------------------
  if (!options || typeof options !== "object") {
    throw new Error("sendEmailJob: options doivent être un objet");
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
    {
      to: options.to,
      subject: options.subject,
      html: options.html || null,
      template: options.template || null,
      templateVars: options.templateVars || {},
      from: options.from || null,
    },
    {
      // -------------------------
      // Options Bull
      // -------------------------
      attempts: 5,               // Nombre de tentatives
      backoff: {
        type: "exponential",     // Backoff exponentiel
        delay: 5000,             // 5 sec → 10 sec → 20 sec → 40 sec → 80 sec
      },
      removeOnComplete: true,     // Pas de pollution
      removeOnFail: false,        // Garder les échecs pour debug
      timeout: 20000,             // Timeout job 20 secondes
    }
  );
};

module.exports = { sendEmailJob };
