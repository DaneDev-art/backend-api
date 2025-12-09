const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  try {
    // 📨 Configuration transporteur
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // false = STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 📨 Envoi du mail
    await transporter.sendMail({
      from: `LivriTogo <${process.env.EMAIL_USER}>`,
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
