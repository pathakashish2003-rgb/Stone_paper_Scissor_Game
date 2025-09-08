const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  mobile: { type: String, unique: true, required: true },
  otpHash: { type: String }, // store hashed OTP
  otpExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);