const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  try {
    // 📩 Transporteur Gmail (recommandé)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Ton email Gmail
        pass: process.env.EMAIL_PASS, // Mot de passe d’application : 16 caractères
      },
    });

    // 📤 Envoi du mail
    await transporter.sendMail({
      from: `LivriTogo <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 Email envoyé à : ${to}`);
  } catch (error) {
    console.error("❌ Erreur sendEmail:", error);
    throw new Error("Erreur lors de l'envoi du mail");
  }
};

module.exports = sendEmail;
