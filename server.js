// server.js
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Game = require("./models/Game");

require("dotenv").config();
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is missing in .env");
  process.exit(1);
}

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing in .env");
  process.exit(1);
}

console.log("✅ JWT_SECRET and MONGO_URI loaded");

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err);
    process.exit(1); // Exit if DB fails
  });

// ---------------- AUTH MIDDLEWARE ----------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.log("Auth middleware error:", err.message); // Debug log
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------------- AUTH ROUTES ----------------

// Step 1: Request OTP
app.post("/auth/request-otp", async (req, res) => {
  try {
    let { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: "Mobile required" });

    // Basic validation
    mobile = mobile.trim();
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ error: "Invalid mobile number format (10 digits required)" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`OTP for ${mobile}: ${otp}`); // Still log for debugging

    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    let user = await User.findOne({ mobile });
    if (!user) {
      user = new User({ mobile });
    }

    user.otpHash = otpHash;
    user.otpExpiry = otpExpiry;
    await user.save();

    console.log(`OTP stored for user: ${user._id}`); // Debug log
    res.json({ message: "OTP sent", otp }); // Return OTP to frontend
  } catch (err) {
    console.error("Request OTP error:", err); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});

// Step 2: Verify OTP
app.post("/auth/verify-otp", async (req, res) => {
  try {
    let { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ error: "Mobile and OTP required" });
    }

    // Basic validation
    mobile = mobile.trim();
    otp = otp.trim();
    if (!/^\d{10}$/.test(mobile) || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ error: "Invalid mobile or OTP format" });
    }

    const user = await User.findOne({ mobile });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const isMatch = await bcrypt.compare(otp, user.otpHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid OTP" });

    // Clear OTP after successful verification
    user.otpHash = null;
    user.otpExpiry = null;
    await user.save();

    // Issue JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });
    console.log(`User ${user._id} logged in`); // Debug log
    res.json({ token });
  } catch (err) {
    console.error("Verify OTP error:", err); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- GAME ROUTES ----------------
const choices = ["stone", "paper", "scissor"];

// Play game
app.post("/play", authMiddleware, async (req, res) => {
  try {
    const { choice: userChoice } = req.body;
    if (!choices.includes(userChoice)) {
      return res.status(400).json({ error: "Invalid choice" });
    }

    const computerChoice = choices[Math.floor(Math.random() * choices.length)];
    let result = "lose";

    if (userChoice === computerChoice) {
      result = "draw";
    } else if (
      (userChoice === "stone" && computerChoice === "scissor") ||
      (userChoice === "paper" && computerChoice === "stone") ||
      (userChoice === "scissor" && computerChoice === "paper")
    ) {
      result = "win";
    }

    const game = new Game({ userId: req.userId, userChoice, computerChoice, result });
    await game.save();

    console.log(`Game saved for user ${req.userId}: ${result}`); // Debug log
    res.json({ userChoice, computerChoice, result });
  } catch (err) {
    console.error("Play game error:", err); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});

// Get user history
app.get("/history", authMiddleware, async (req, res) => {
  try {
    const history = await Game.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    console.log(`History fetched for user ${req.userId}: ${history.length} games`); // Debug log
    res.json(history);
  } catch (err) {
    console.error("History error:", err); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});

// Get user scoreboard
app.get("/scoreboard", authMiddleware, async (req, res) => {
  try {
    const games = await Game.find({ userId: req.userId });
    const stats = { win: 0, lose: 0, draw: 0 };
    games.forEach((g) => {
      if (stats[g.result] !== undefined) stats[g.result]++;
    });
    console.log(`Scoreboard for user ${req.userId}:`, stats); // Debug log
    res.json(stats);
  } catch (err) {
    console.error("Scoreboard error:", err); // Debug log
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});