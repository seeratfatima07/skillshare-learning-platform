const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");

const {
  getDashboardStats,
  getAllUsers,
  blockUser,
  unblockUser,
  warnUser,
  getAllCoursesAdmin,
  getPendingCourses,  
  approveCourse, 
  rejectCourse,
  deactivateCourse,
  activateCourse,
  getReports,
  resolveReport,
  deleteReviewAdmin
} = require("../controllers/admin.controller");

// Dashboard
router.get("/dashboard", authMiddleware, requireRole("admin"), getDashboardStats);

// Users
router.get("/users", authMiddleware, requireRole("admin"), getAllUsers);

router.put("/users/:id/block", authMiddleware, requireRole("admin"), blockUser);
router.put("/users/:id/unblock", authMiddleware, requireRole("admin"), unblockUser);
router.put("/users/:id/warn", authMiddleware, requireRole("admin"), warnUser);

// Courses management
router.get("/courses", authMiddleware, requireRole("admin"), getAllCoursesAdmin);
router.get("/courses/pending", authMiddleware, requireRole("admin"), getPendingCourses);
router.put("/courses/:id/approve", authMiddleware, requireRole("admin"), approveCourse);
router.put("/courses/:id/reject", authMiddleware, requireRole("admin"), rejectCourse);
router.put("/courses/:id/deactivate", authMiddleware, requireRole("admin"), deactivateCourse);
router.put("/courses/:id/activate", authMiddleware, requireRole("admin"), activateCourse);

// Reports moderation
router.get("/reports", authMiddleware, requireRole("admin"), getReports);
router.put("/reports/:id/resolve", authMiddleware, requireRole("admin"), resolveReport);

// Review moderation
router.delete("/reviews/:id", authMiddleware, requireRole("admin"), deleteReviewAdmin);

module.exports = router;

