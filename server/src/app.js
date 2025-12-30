require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const instructorRoutes = require("./routes/instructor.routes");
const adminRoutes = require("./routes/admin.routes");
const studentRoutes = require("./routes/student.routes");

const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

//Global Middlewares 
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

//Routes 
app.use("/api/auth", authRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);

// Health Check 
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// Error Middleware 
app.use(errorMiddleware);

module.exports = app;
