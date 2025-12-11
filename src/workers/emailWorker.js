require("dotenv").config();

const { Worker } = require("bullmq");
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const EmailLog = require("../models/EmailLog");

// ----------------------- MONGO CONNECTION -----------------------
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_ATLAS_URI, {
      dbName: process.env.MONGO_INITDB_DATABASE,
    });
    console.log("✅ Worker connecté à MongoDB");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
  }
})();

// ----------------------- TEMPLATE LOADER ------------------------
const loadTemplate = (name) => {
  try {
    const filePath = path.join(__dirname, "..", "email_templates", `${name}.hbs`);
    return handlebars.compile(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("⚠ Template introuvable :", name);
    return null;
  }
};

// ----------------------- SMTP TRANSPORTER -----------------------
const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  throw new Error("Aucun provider email n'est configuré !");
};

const transporter = createTransporter();
console.log("📨 Worker prêt, en attente de jobs...");

// --------------------------- WORKER -----------------------------
const worker = new Worker(
  "emailQueue",
  async (job) => {
    const data = job.data;

    if (!data.to) throw new Error("Champ 'to' manquant");
    if (!data.subject) throw new Error("Champ 'subject' manquant");

    // HTML ou template
    let html = data.html || "";
    if (data.template) {
      const tpl = loadTemplate(data.template);
      html = tpl ? tpl(data.templateVars || {}) : html;
    }
    if (!html) throw new Error("Aucun contenu HTML fourni");

    const mailOptions = {
      from: data.from || process.env.EMAIL_FROM,
      to: data.to,
      subject: data.subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    await EmailLog.create({
      to: data.to,
      subject: data.subject,
      html,
      providerInfo: info,
      status: "sent",
      attempts: job.attemptsMade,
    });

    console.log("📧 Email envoyé →", data.to);
  },
  {
    connection: {
      url: process.env.REDIS_URL, // Upstash rediss://...
      maxRetriesPerRequest: null, // important pour Upstash TLS
    },
    concurrency: 5,
  }
);

// -------------------------- ERROR LOGS --------------------------
worker.on("failed", (job, err) => {
  console.error("❌ Job échoué :", err.message);
});

process.on("SIGINT", async () => {
  console.log("🛑 Arrêt du worker...");
  await worker.close();
  process.exit(0);
});
