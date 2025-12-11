// src/routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const { sendEmailJob } = require("../services/emailService");

// POST /api/email/test
router.post("/test", async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({
      message: "Veuillez fournir les champs 'to', 'subject' et 'html'",
    });
  }

  try {
    await sendEmailJob({
      to,
      subject,
      html,
      from: process.env.EMAIL_FROM, // facultatif
    });

    return res.status(200).json({
      message: "✅ Job email ajouté à la queue",
    });
  } catch (err) {
    console.error("❌ Erreur test email:", err.message);
    return res.status(500).json({
      message: "Erreur lors de l'ajout du job email",
      error: err.message,
    });
  }
});

module.exports = router;
