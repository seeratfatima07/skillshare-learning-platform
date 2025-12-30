const jwt = require("jsonwebtoken");

exports.generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
};

exports.verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
