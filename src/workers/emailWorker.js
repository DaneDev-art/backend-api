// src/workers/emailWorker.js
require("dotenv").config();
const Queue = require("bull");
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const EmailLog = require("../models/EmailLog");
const User = require("../models/user.model");

// =========================================
// 🔗 REDIS & BULL: queue configuration
// =========================================
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const emailQueue = new Queue("emailQueue", redisUrl, {
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// =========================================
// 🗄️ Connect MongoDB
// =========================================
const connectDB = async () => {
  const uri = process.env.MONGO_ATLAS_URI || process.env.MONGO_LOCAL_URI;
  if (!uri) throw new Error("❌ MONGO URI missing");

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_INITDB_DATABASE || "mydb",
  });

  console.log("✅ Worker connected to MongoDB");
};

// =========================================
// 📄 Template loader (.hbs)
// =========================================
const loadTemplate = (name) => {
  try {
    const file = path.join(__dirname, "..", "email_templates", `${name}.hbs`);
    const source = fs.readFileSync(file, "utf8");
    return handlebars.compile(source);
  } catch (e) {
    console.error(`⚠ Template "${name}" introuvable.`);
    return null;
  }
};

// =========================================
// 📤 Create SMTP transporter
// =========================================
const createTransporter = () => {
  // PRIORITÉ : SMTP principal
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // FALLBACK Gmail (app-password)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  throw new Error("❌ Aucun provider email configuré");
};

// =========================================
// 🎯 Processor principal du worker
// =========================================
(async () => {
  await connectDB();

  const transporter = createTransporter();
  console.log("📨 Email worker prêt, en attente de jobs...");

  emailQueue.process(async (job, done) => {
    const data = job.data;

    try {
      // ----------------------------
      // VALIDATIONS
      // ----------------------------
      if (!data.to) throw new Error("Adresse email 'to' manquante");
      if (!data.subject) throw new Error("Sujet email manquant");

      // ----------------------------
      // TEMPLATE
      // ----------------------------
      let html = data.html || "";

      if (data.template) {
        const tpl = loadTemplate(data.template);
        if (tpl) {
          html = tpl(data.templateVars || {});
        } else {
          console.warn("⚠ Template introuvable, utilisation de HTML simple");
        }
      }

      if (!html) {
        throw new Error("Aucun contenu HTML fourni");
      }

      // ----------------------------
      // OPTIONS MAIL
      // ----------------------------
      const mailOptions = {
        from: data.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: data.to,
        subject: data.subject,
        html,
      };

      // ----------------------------
      // SEND MAIL
      // ----------------------------
      const info = await transporter.sendMail(mailOptions);

      console.log(`✅ Email envoyé à ${data.to} ✔`);

      // ----------------------------
      // LOGGING SUCCESS
      // ----------------------------
      await EmailLog.create({
        to: data.to,
        subject: data.subject,
        html,
        providerInfo: info,
        status: "sent",
        attempts: job.attemptsMade,
      });

      done();
    } catch (error) {
      console.error("❌ Email job ERROR:", error.message);

      // LOG failure
      try {
        await EmailLog.create({
          to: data.to,
          subject: data.subject,
          html: data.html,
          error: error.message,
          status: "failed",
          attempts: job.attemptsMade,
        });
      } catch (e) {
        console.error("❌ Impossible d'écrire le EmailLog:", e.message);
      }

      done(error);
    }
  });

  // Shutdown propre
  process.on("SIGINT", async () => {
    console.log("🛑 Arrêt du worker...");
    await emailQueue.close();
    process.exit(0);
  });
})();
