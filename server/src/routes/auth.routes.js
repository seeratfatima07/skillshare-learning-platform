const express = require("express");
const router = express.Router();
const { validateLogin, validateSignup } = require("../validators/auth.validators");

const { signup, login, me } = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.post("/signup",validateSignup, signup);
router.post("/login",validateLogin , login);

// protected test route
router.get("/me", authMiddleware, me);

module.exports = router;
