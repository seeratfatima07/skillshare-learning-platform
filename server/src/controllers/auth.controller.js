const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { generateToken } = require("../utils/jwt");

// SIGNUP
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // role -> role_id
    const roleRes = await pool.query("SELECT id FROM roles WHERE name = $1", [role]);
    if (roleRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    const role_id = roleRes.rows[0].id;

    // check duplicate email
    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    // hash password correctly
    const hashedPassword = await bcrypt.hash(password, 10);

    // store in password_hash
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email`,
      [name, email, hashedPassword, role_id]
    );

    const user = userRes.rows[0];
    const token = generateToken({ id: user.id, role });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token,
      user: { ...user, role }
    });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const userRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const user = userRes.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ME
exports.me = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Token is valid.",
    user: req.user,
  });
};
