// src/models/user.model.js
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
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "delivery", "admin"],
      default: "buyer",
    },

    // 🔹 Infos Buyer
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    zone: { type: String, trim: true },
    country: { type: String, trim: true },
    city: { type: String, trim: true },

    // 🔹 Infos Seller
    ownerName: { type: String, trim: true },
    shopName: { type: String, trim: true, index: true },
    shopDescription: { type: String, trim: true },
    logoUrl: { type: String },
    profileImageUrl: { type: String }, // optionnel (image profil vendeur)

    // 🔹 Infos Delivery
    plate: { type: String, trim: true },
    idNumber: { type: String, trim: true },
    guarantee: { type: String, trim: true },
    transportMode: {
      type: String,
      enum: ["Moto", "Vélo", "Voiture", "Autre"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return this.role === "delivery" ? "pending" : undefined;
      },
    },

    // 🔹 Documents communs
    idCardFrontUrl: { type: String },
    idCardBackUrl: { type: String },
    selfieUrl: { type: String },
  },
  { timestamps: true }
);

// ======================================================
// 🔐 Hash du mot de passe avant sauvegarde
// ======================================================
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

// ======================================================
// 🔐 Vérification du mot de passe
// ======================================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ======================================================
// 🔹 Getter public (pour renvoyer un profil sans mot de passe)
// ======================================================
userSchema.methods.toPublicJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// ======================================================
// ✅ Export
// ======================================================
module.exports = mongoose.model("User", userSchema);
