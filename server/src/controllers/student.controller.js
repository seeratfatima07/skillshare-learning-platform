// src/controllers/student.controller.js
const pool = require("../config/db");

// -------------------- helpers --------------------
async function checkCourseApproved(courseId) {
  const res = await pool.query(
    "SELECT id FROM courses WHERE id = $1 AND status = 'approved' AND is_active = TRUE",
    [courseId]
  );
  return res.rows[0] || null;
}

async function checkEnrollment(userId, courseId) {
  const res = await pool.query(
    "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2",
    [userId, courseId]
  );
  return res.rows.length > 0;
}

// -------------------- 1) Profile --------------------
// GET /api/student/profile
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT u.id, u.name, u.email, u.bio, u.avatar_url, r.name AS role
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      `,
      [userId]
    );

    return res.status(200).json({ success: true, profile: result.rows[0] });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/student/profile
// PUT /api/student/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, avatar_url } = req.body;

    if (!name && !bio && !avatar_url) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field: name, bio, avatar_url."
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        name = COALESCE($1, name),
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url)
      WHERE id = $4
      RETURNING id, name, email, bio, avatar_url
      `,
      [name ?? null, bio ?? null, avatar_url ?? null, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: result.rows[0]
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};


// GET /api/student/me/summary  (enrolled courses + my reviews)
exports.getMySummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrolledRes = await pool.query(
      `
      SELECT
        e.id AS enrollment_id, e.enrolled_at,
        c.id AS course_id, c.title, c.level, c.status,
        cat.name AS category_name,
        u.name AS instructor_name
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.instructor_id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
      `,
      [userId]
    );

    const reviewsRes = await pool.query(
      `
      SELECT
        rv.id AS review_id, rv.rating, rv.comment, rv.created_at,
        c.id AS course_id, c.title AS course_title
      FROM reviews rv
      JOIN courses c ON c.id = rv.course_id
      WHERE rv.user_id = $1
      ORDER BY rv.created_at DESC
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      enrolledCourses: enrolledRes.rows,
      myReviews: reviewsRes.rows,
    });
  } catch (err) {
    console.error("getMySummary error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// -------------------- 2) Browse/Search/Filter courses --------------------
// GET /api/student/courses?search=&category_id=&level=&sort=latest|rating|reviews
exports.getApprovedCourses = async (req, res) => {
  try {
    const { search, category_id, level, sort } = req.query;

    let sql = `
      SELECT
        c.id, c.title, c.description, c.level, c.created_at,
        cat.id AS category_id, cat.name AS category_name,
        u.id AS instructor_id, u.name AS instructor_name,
        COALESCE(AVG(r.rating), 0)::numeric(10,2) AS avg_rating,
        COUNT(r.id) AS review_count
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.instructor_id
      LEFT JOIN reviews r ON r.course_id = c.id
      WHERE c.status = 'approved'
      AND c.is_active = TRUE
    `;

    const params = [];
    let idx = 1;

    if (search && search.trim() !== "") {
      sql += ` AND (LOWER(c.title) LIKE LOWER($${idx}) OR LOWER(u.name) LIKE LOWER($${idx}))`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (category_id) {
      sql += ` AND c.category_id = $${idx}`;
      params.push(Number(category_id));
      idx++;
    }

    if (level) {
      sql += ` AND c.level = $${idx}`;
      params.push(level);
      idx++;
    }

    sql += ` GROUP BY c.id, cat.id, u.id `;

    if (sort === "rating") sql += ` ORDER BY avg_rating DESC `;
    else if (sort === "reviews") sql += ` ORDER BY review_count DESC `;
    else sql += ` ORDER BY c.created_at DESC `;

    const result = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      courses: result.rows,
    });
  } catch (err) {
    console.error("getApprovedCourses error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// -------------------- 3) Course Details --------------------
// GET /api/student/courses/:id
exports.getCourseDetails = async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!courseId) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    const courseRes = await pool.query(
      `
      SELECT
        c.id, c.title, c.description, c.level, c.created_at,
        cat.id AS category_id, cat.name AS category_name,
        u.id AS instructor_id, u.name AS instructor_name,
        u.bio AS instructor_bio, u.avatar_url AS instructor_avatar
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.instructor_id
      WHERE c.id = $1
    AND c.status = 'approved'
    AND c.is_active = TRUE
      `,
      [courseId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found or not approved." });
    }

    const ratingRes = await pool.query(
      `
      SELECT
        COALESCE(AVG(rating), 0)::numeric(10,2) AS avg_rating,
        COUNT(*) AS review_count
      FROM reviews
      WHERE course_id = $1
      `,
      [courseId]
    );

    const reviewsRes = await pool.query(
      `
      SELECT
        rv.id, rv.rating, rv.comment, rv.created_at,
        u.id AS user_id, u.name AS user_name
      FROM reviews rv
      JOIN users u ON u.id = rv.user_id
      WHERE rv.course_id = $1
      ORDER BY rv.created_at DESC
      `,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      course: courseRes.rows[0],
      rating: ratingRes.rows[0],
      reviews: reviewsRes.rows,
    });
  } catch (err) {
    console.error("getCourseDetails error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// -------------------- 4) Learning System --------------------
// POST /api/student/courses/:id/enroll
exports.enrollCourse = async (req, res) => {
  try {
    const studentId = req.user.id;
    const courseId = Number(req.params.id);

    const course = await checkCourseApproved(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found or not approved." });
    }

    const enrolledAlready = await checkEnrollment(studentId, courseId);
    if (enrolledAlready) {
      return res.status(409).json({ success: false, message: "You are already enrolled in this course." });
    }

    await pool.query("INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)", [
      studentId,
      courseId,
    ]);

    return res.status(201).json({ success: true, message: "Enrolled in course successfully." });
  } catch (err) {
    console.error("enrollCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/student/courses/:id/lessons  (only if enrolled)
exports.getCourseLessons = async (req, res) => {
  try {
    const studentId = req.user.id;
    const courseId = Number(req.params.id);

    const course = await checkCourseApproved(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found or not approved." });
    }

    const enrolled = await checkEnrollment(studentId, courseId);
    if (!enrolled) {
      return res.status(403).json({ success: false, message: "Enroll first to view lessons." });
    }

    const lessonsRes = await pool.query(
      `
      SELECT id, course_id, title, description, video_url, order_index, created_at
      FROM lessons
      WHERE l.course_id = $1
      AND c.is_active = TRUE
      ORDER BY order_index ASC
      `,
      [courseId]
    );

    return res.status(200).json({ success: true, course, lessons: lessonsRes.rows });
  } catch (err) {
    console.error("getCourseLessons error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/student/enrollments  (view enrolled courses)
exports.getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        e.id AS enrollment_id, e.enrolled_at,
        c.id AS course_id, c.title, c.level,
        cat.name AS category_name,
        u.name AS instructor_name
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN categories cat ON cat.id = c.category_id
      JOIN users u ON u.id = c.instructor_id
      WHERE e.user_id = $1
      ORDER BY e.enrolled_at DESC
      `,
      [studentId]
    );

    return res.status(200).json({ success: true, count: result.rows.length, enrollments: result.rows });
  } catch (err) {
    console.error("getMyEnrollments error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/student/lessons/:lessonId/complete  (progress tracking)
// NOTE: requires lesson_progress table
exports.completeLesson = async (req, res) => {
  try {
    const studentId = req.user.id;
    const lessonId = Number(req.params.lessonId);

    const lessonRes = await pool.query("SELECT id, course_id FROM lessons WHERE id = $1", [lessonId]);
    if (lessonRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Lesson not found." });
    }

    const courseId = lessonRes.rows[0].course_id;
    const enrolled = await checkEnrollment(studentId, courseId);
    if (!enrolled) {
      return res.status(403).json({ success: false, message: "Enroll first to track progress." });
    }

    await pool.query(
      `
      INSERT INTO lesson_progress (user_id, lesson_id, is_completed, completed_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET is_completed = TRUE, completed_at = NOW()
      `,
      [studentId, lessonId]
    );

    return res.status(200).json({ success: true, message: "Lesson marked as completed." });
  } catch (err) {
    console.error("completeLesson error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// -------------------- 5) Review System --------------------
// POST /api/student/courses/:id/reviews
exports.addReview = async (req, res) => {
  try {
    const studentId = req.user.id;
    const courseId = Number(req.params.id);
    const { rating, comment } = req.body || {};

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    const course = await checkCourseApproved(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found or not approved." });
    }

    const enrolled = await checkEnrollment(studentId, courseId);
    if (!enrolled) {
      return res.status(403).json({ success: false, message: "Enroll first to add a review." });
    }

    const result = await pool.query(
      `
      INSERT INTO reviews (user_id, course_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, course_id, rating, comment, created_at
      `,
      [studentId, courseId, Number(rating), comment ?? null]
    );

    return res.status(201).json({ success: true, message: "Review added successfully.", review: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "You already reviewed this course." });
    }
    console.error("addReview error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/student/reviews/:reviewId
exports.updateReview = async (req, res) => {
  try {
    const studentId = req.user.id;
    const reviewId = Number(req.params.reviewId);
    const { rating, comment } = req.body || {};

    if (rating && (Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    const exists = await pool.query("SELECT id FROM reviews WHERE id = $1 AND user_id = $2", [
      reviewId,
      studentId,
    ]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    const updated = await pool.query(
      `
      UPDATE reviews
      SET
        rating = COALESCE($1, rating),
        comment = COALESCE($2, comment)
      WHERE id = $3 AND user_id = $4
      RETURNING id, user_id, course_id, rating, comment, created_at
      `,
      [rating ?? null, comment ?? null, reviewId, studentId]
    );

    return res.status(200).json({ success: true, message: "Review updated successfully.", review: updated.rows[0] });
  } catch (err) {
    console.error("updateReview error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/student/reviews/:reviewId
exports.deleteReview = async (req, res) => {
  try {
    const studentId = req.user.id;
    const reviewId = Number(req.params.reviewId);

    const exists = await pool.query("SELECT id FROM reviews WHERE id = $1 AND user_id = $2", [
      reviewId,
      studentId,
    ]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    await pool.query("DELETE FROM reviews WHERE id = $1 AND user_id = $2", [reviewId, studentId]);

    return res.status(200).json({ success: true, message: "Review deleted successfully." });
  } catch (err) {
    console.error("deleteReview error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// -------------------- 6) Reporting --------------------
// POST /api/student/reports
// body: { target_type: 'course'|'lesson'|'review', target_id: number, reason: string }
exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { target_type, target_id, reason } = req.body || {};

    if (!target_type || !target_id || !reason) {
      return res.status(400).json({
        success: false,
        message: "target_type, target_id, and reason are required.",
      });
    }

    const allowed = ["course", "lesson", "review"];
    if (!allowed.includes(target_type)) {
      return res.status(400).json({ success: false, message: "Invalid target_type." });
    }

    const result = await pool.query(
      `
      INSERT INTO reports (reporter_id, target_type, target_id, reason, status)
      VALUES ($1, $2, $3, $4, 'open')
      RETURNING id, reporter_id, target_type, target_id, reason, status, created_at
      `,
      [reporterId, target_type, Number(target_id), reason]
    );

    return res.status(201).json({ success: true, message: "Report submitted successfully.", report: result.rows[0] });
  } catch (err) {
    console.error("createReport error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/student/courses/:id/lessons
exports.getCourseLessons = async (req, res) => {
  try {
    const studentId = req.user.id;
    const courseId = Number(req.params.id);

    if (!courseId) {
      return res.status(400).json({ success: false, message: "Invalid course id." });
    }

    // 1) Course must be approved
    const courseRes = await pool.query(
      `
      SELECT c.id, c.title, c.status
      FROM courses c
      WHERE c.id = $1 AND c.status = 'approved'
      `,
      [courseId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found or not approved.",
      });
    }

    // 2) Must be enrolled
    const enrollRes = await pool.query(
      `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [studentId, courseId]
    );

    if (enrollRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Enroll first to view lessons.",
      });
    }

    // 3) Lessons + progress (progress is optional)
    // If you don't have lesson_progress table, use the simpler query below (comment progress query)
    const lessonsRes = await pool.query(
      `
      SELECT
        l.id, l.course_id, l.title, l.description, l.video_url, l.order_index, l.created_at,
        COALESCE(lp.is_completed, FALSE) AS is_completed,
        lp.completed_at
      FROM lessons l
      LEFT JOIN lesson_progress lp
        ON lp.lesson_id = l.id AND lp.user_id = $2
      WHERE l.course_id = $1
      ORDER BY l.order_index ASC
      `,
      [courseId, studentId]
    );

    return res.status(200).json({
      success: true,
      course: courseRes.rows[0],
      lessons: lessonsRes.rows,
    });
  } catch (err) {
    console.error("getCourseLessons error:", err);

    
    // In that case, you'll need the no-progress version below.
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
