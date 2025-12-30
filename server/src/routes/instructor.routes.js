const express = require("express");
const router = express.Router();

const { validateCreateCourse } = require("../validators/course.validators");

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");

const {
  createCourse,
  getMyCourses,
  addLesson,
  updateLesson,
  deleteLesson,
  getCourseStudents,
  updateCourse,
  getCourseReviews
} = require("../controllers/instructor.controller");

// Courses
router.post("/courses",  validateCreateCourse, authMiddleware, requireRole("instructor"), createCourse);
router.get("/courses", authMiddleware, requireRole("instructor"), getMyCourses);
router.put("/courses/:id", authMiddleware, requireRole("instructor"), updateCourse);

// Lessons (Instructor can manage only own courses)
router.post("/courses/:courseId/lessons", authMiddleware, requireRole("instructor"), addLesson);
router.put("/lessons/:lessonId", authMiddleware, requireRole("instructor"), updateLesson);
router.delete("/lessons/:lessonId", authMiddleware, requireRole("instructor"), deleteLesson);

// Students enrolled in instructor course
router.get("/courses/:courseId/students", authMiddleware, requireRole("instructor"), getCourseStudents);
router.get("/courses/:id/reviews", authMiddleware, requireRole("instructor"), getCourseReviews);


module.exports = router;
