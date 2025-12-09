const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",  // ⭐ Utiliser Gmail simplifie la configuration
      auth: {
        user: process.env.EMAIL_USER,  // ton email Gmail
        pass: process.env.EMAIL_PASS,  // mot de passe d’application Gmail
      },
    });

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
