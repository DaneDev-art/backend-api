const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // 🆔 Infos communes
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "delivery", "admin"],
      default: "buyer",
    },

    // Buyer fields
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    zone: { type: String, trim: true },
    country: { type: String, trim: true },
    city: { type: String, trim: true },

    // Seller fields
    ownerName: { type: String, trim: true },
    shopName: { type: String, trim: true, index: true }, // 🔹 utile pour recherches rapides
    shopDescription: { type: String, trim: true }, // 🔹 optionnel (présentation boutique)
    logoUrl: { type: String }, // 🔹 logo Cloudinary si besoin

    // Delivery fields
    plate: { type: String, trim: true },
    idNumber: { type: String, trim: true },
    guarantee: { type: String, trim: true },
    transportMode: {
      type: String,
      enum: ["Moto", "Vélo", "Voiture", "Autre"],
    },

    // Documents communs
    idCardFrontUrl: { type: String },
    idCardBackUrl: { type: String },
    selfieUrl: { type: String },
  },
  { timestamps: true }
);

// 🔐 Hash password avant sauvegarde
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// 🔐 Vérif mot de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
