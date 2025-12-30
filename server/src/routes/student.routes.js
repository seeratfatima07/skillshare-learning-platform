// src/routes/student.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");

const {
  // profile
  getProfile,
  updateProfile,
  getMySummary,

  // courses
  getApprovedCourses,
  getCourseDetails,
  enrollCourse,
  getCourseLessons,
  getMyEnrollments,

  // progress
  completeLesson,

  // reviews
  addReview,
  updateReview,
  deleteReview,

  // reports
  createReport,
} = require("../controllers/student.controller");

// Profile
router.get("/profile", authMiddleware, requireRole("student"), getProfile);
router.put("/profile", authMiddleware, requireRole("student"), updateProfile);
router.get("/me/summary", authMiddleware, requireRole("student"), getMySummary);

// Browse + details
router.get("/courses", authMiddleware, requireRole("student"), getApprovedCourses);
router.get("/courses/:id", authMiddleware, requireRole("student"), getCourseDetails);

// Enrollments + lessons
router.post("/courses/:id/enroll", authMiddleware, requireRole("student"), enrollCourse);
router.get("/courses/:id/lessons", authMiddleware, requireRole("student"), getCourseLessons);
router.get("/enrollments", authMiddleware, requireRole("student"), getMyEnrollments);

// Progress tracking (requires lesson_progress table)
router.post("/lessons/:lessonId/complete", authMiddleware, requireRole("student"), completeLesson);

// Reviews
router.post("/courses/:id/reviews", authMiddleware, requireRole("student"), addReview);
router.put("/reviews/:reviewId", authMiddleware, requireRole("student"), updateReview);
router.delete("/reviews/:reviewId", authMiddleware, requireRole("student"), deleteReview);

// Reporting
router.post("/reports", authMiddleware, requireRole("student"), createReport);

module.exports = router;
