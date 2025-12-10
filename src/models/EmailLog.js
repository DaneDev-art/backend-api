// src/models/EmailLog.js
const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  to: String,
  subject: String,
  html: String,
  providerInfo: { type: Object, default: {} },
  error: { type: String, default: "" },
  status: { type: String, enum: ["sent", "failed", "queued"], default: "queued" },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("EmailLog", emailLogSchema, "email_logs");
