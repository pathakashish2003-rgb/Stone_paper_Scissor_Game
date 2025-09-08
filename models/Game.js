const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userChoice: { type: String, required: true },
  computerChoice: { type: String, required: true },
  result: { type: String, required: true }, // win, lose, draw
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Game", gameSchema);