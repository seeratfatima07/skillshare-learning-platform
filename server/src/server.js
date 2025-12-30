const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
