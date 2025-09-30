const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    image: { type: String },
    category: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);
