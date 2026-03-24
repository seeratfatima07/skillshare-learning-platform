const pool = require("../config/db");

// GET pending courses
exports.getPendingCourses = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.level, c.status, c.created_at,
              u.id AS instructor_id, u.name AS instructor_name,
              cat.id AS category_id, cat.name AS category_name
       FROM courses c
       JOIN users u ON u.id = c.instructor_id
       JOIN categories cat ON cat.id = c.category_id
       WHERE c.status = 'pending'
       ORDER BY c.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      pendingCount: result.rows.length,
      courses: result.rows
    });
  } catch (err) {
    console.error("getPendingCourses error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// APPROVE course
exports.approveCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.id);

    if (!courseId) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    // Check course exists
    const existing = await pool.query(
      "SELECT id, status FROM courses WHERE id = $1",
      [courseId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    // Optional: only approve if pending
    if (existing.rows[0].status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Course is not pending. Current status: ${existing.rows[0].status}`
      });
    }

    // Update status to approved
    const updated = await pool.query(
      `UPDATE courses
       SET status = 'approved'
       WHERE id = $1
       RETURNING id, title, status`,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      message: "Course approved successfully.",
      course: updated.rows[0]
    });
  } catch (err) {
    console.error("approveCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * DASHBOARD STATS
 * GET /api/admin/dashboard
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [users, courses, enrollments, reviews,instructors] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total_users FROM users"),
      pool.query("SELECT COUNT(*)::int AS total_courses FROM courses"),
      pool.query("SELECT COUNT(*)::int AS total_enrollments FROM enrollments"),
      pool.query("SELECT COUNT(*)::int AS total_reviews FROM reviews"),
      pool.query(`
    SELECT COUNT(*)::int AS total_instructors
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'instructor'
  `),
    ]);

    // Popular courses (by enrollments)
    const popularCourses = await pool.query(`
      SELECT c.id, c.title,
             COUNT(e.id)::int AS enrollment_count
      FROM courses c
      LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE c.status = 'approved' AND c.is_active = TRUE
      GROUP BY c.id
      ORDER BY enrollment_count DESC
      LIMIT 5
    `);

    // Highly rated courses (avg rating)
    const topRatedCourses = await pool.query(`
      SELECT c.id, c.title,
             COALESCE(AVG(r.rating),0)::numeric(10,2) AS avg_rating,
             COUNT(r.id)::int AS review_count
      FROM courses c
      LEFT JOIN reviews r ON r.course_id = c.id
      WHERE c.status = 'approved' AND c.is_active = TRUE
      GROUP BY c.id
      ORDER BY avg_rating DESC, review_count DESC
      LIMIT 5
    `);

    return res.status(200).json({
      success: true,
      stats: {
        total_users: users.rows[0].total_users,
        total_courses: courses.rows[0].total_courses,
        total_enrollments: enrollments.rows[0].total_enrollments,
        total_reviews: reviews.rows[0].total_reviews,
        total_instructors: instructors.rows[0].total_instructors
      },
      popular_courses: popularCourses.rows,
      top_rated_courses: topRatedCourses.rows,
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * USER MANAGEMENT
 * GET /api/admin/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, r.name AS role,
             u.is_blocked, u.warning
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.id DESC
    `);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      users: result.rows
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * PUT /api/admin/users/:id/block
 */
exports.blockUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE users SET is_blocked = TRUE WHERE id = $1 RETURNING id, is_blocked`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "User blocked successfully.",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("blockUser error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * PUT /api/admin/users/:id/unblock
 */
exports.unblockUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE users SET is_blocked = FALSE WHERE id = $1 RETURNING id, is_blocked`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully.",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("unblockUser error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * WARN USER
 * PUT /api/admin/users/:id/warn
 * body: { warning: "text..." }
 */
exports.warnUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    // prevent crash when body is missing
    const { warning } = req.body || {};

    // 400 Bad Request for missing warning
    if (!warning || String(warning).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "warning text is required."
      });
    }

    const result = await pool.query(
      `UPDATE users SET warning = $1 WHERE id = $2 RETURNING id, warning`,
      [String(warning).trim(), userId]
    );

    // 404 only when user doesn't exist
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Warning saved successfully.",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("warnUser error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


/**
 * COURSE MANAGEMENT
 * GET /api/admin/courses?status=pending|approved|rejected&active=true|false
 */
exports.getAllCoursesAdmin = async (req, res) => {
  try {
    const { status, active } = req.query;

    let sql = `
      SELECT c.id, c.title, c.status, c.is_active, c.created_at,
             u.name AS instructor_name, cat.name AS category_name
      FROM courses c
      JOIN users u ON u.id = c.instructor_id
      JOIN categories cat ON cat.id = c.category_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status) {
      sql += ` AND c.status = $${idx++}`;
      params.push(status);
    }

    if (active === "true") sql += ` AND c.is_active = TRUE`;
    if (active === "false") sql += ` AND c.is_active = FALSE`;

    sql += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      courses: result.rows
    });
  } catch (err) {
    console.error("getAllCoursesAdmin error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * REJECT COURSE
 * PUT /api/admin/courses/:id/reject
 */
exports.rejectCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE courses SET status = 'rejected' WHERE id = $1 RETURNING id, title, status`,
      [courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Course rejected successfully.",
      course: result.rows[0]
    });
  } catch (err) {
    console.error("rejectCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * DEACTIVATE COURSE
 * PUT /api/admin/courses/:id/deactivate
 */
exports.deactivateCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE courses SET is_active = FALSE WHERE id = $1 RETURNING id, title, is_active`,
      [courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Course deactivated successfully.",
      course: result.rows[0]
    });
  } catch (err) {
    console.error("deactivateCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * ACTIVATE COURSE
 * PUT /api/admin/courses/:id/activate
 */
exports.activateCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE courses SET is_active = TRUE WHERE id = $1 RETURNING id, title, is_active`,
      [courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Course activated successfully.",
      course: result.rows[0]
    });
  } catch (err) {
    console.error("activateCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * REPORTS MODERATION
 * GET /api/admin/reports?status=open|resolved
 */
exports.getReports = async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT
        rp.id, rp.target_type, rp.target_id, rp.reason, rp.status, rp.created_at,
        u.id AS reporter_id, u.name AS reporter_name, u.email AS reporter_email
      FROM reports rp
      JOIN users u ON u.id = rp.reporter_id
    `;
    const params = [];
    if (status) {
      sql += ` WHERE rp.status = $1`;
      params.push(status);
    }
    sql += ` ORDER BY rp.created_at DESC`;

    const result = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      reports: result.rows
    });
  } catch (err) {
    console.error("getReports error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * PUT /api/admin/reports/:id/resolve
 */
exports.resolveReport = async (req, res) => {
  try {
    const reportId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE reports SET status='resolved' WHERE id=$1 RETURNING id, status`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Report resolved successfully.",
      report: result.rows[0]
    });
  } catch (err) {
    console.error("resolveReport error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/*
  Admin delete any review
  /api/admin/reviews/:id
 */
exports.deleteReviewAdmin = async (req, res) => {
  try {
    const reviewId = Number(req.params.id);

    const result = await pool.query(
      "DELETE FROM reviews WHERE id = $1 RETURNING id",
      [reviewId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    return res.status(200).json({ success: true, message: "Review deleted successfully." });
  } catch (err) {
    console.error("deleteReviewAdmin error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
