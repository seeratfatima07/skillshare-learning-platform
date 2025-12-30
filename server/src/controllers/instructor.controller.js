const pool = require("../config/db");

// Instructor creates course
exports.createCourse = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { title, description, category_id, level } = req.body || {};

    if (!title || !description || !category_id || !level) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO courses (title, description, category_id, level, instructor_id, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, title, status
      `,
      [title, description, category_id, level, instructorId]
    );

    return res.status(201).json({
      success: true,
      message: "Course created successfully. Waiting for admin approval.",
      course: result.rows[0]
    });
  } catch (err) {
    console.error("createCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Instructor: view my courses
// GET /api/instructor/courses
exports.getMyCourses = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const result = await pool.query(
      `
      SELECT c.id, c.title, c.level, c.status, c.created_at,
             cat.name AS category_name,
             COUNT(e.id) AS enrolled_count
      FROM courses c
      JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE c.instructor_id = $1
      GROUP BY c.id, cat.name
      ORDER BY c.created_at DESC
      `,
      [instructorId]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      courses: result.rows
    });
  } catch (err) {
    console.error("getMyCourses error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
// PUT /api/instructor/courses/:id
exports.updateCourse = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const courseId = Number(req.params.id);

    const { title, description, category_id, level } = req.body || {};

    // Prevent empty update (so no crash)
    if (!title && !description && !category_id && !level) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update: title, description, category_id, level."
      });
    }

    // Must own the course
    const exists = await pool.query(
      "SELECT id, status FROM courses WHERE id = $1 AND instructor_id = $2",
      [courseId, instructorId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you don't have permission."
      });
    }

    // Update
    const result = await pool.query(
      `
      UPDATE courses
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        level = COALESCE($4, level),
        status = CASE
          WHEN status = 'approved' THEN 'pending'
          ELSE status
        END
      WHERE id = $5 AND instructor_id = $6
      RETURNING id, title, description, category_id, level, status
      `,
      [
        title ?? null,
        description ?? null,
        category_id ? Number(category_id) : null,
        level ?? null,
        courseId,
        instructorId
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Course updated. If it was approved, it is now pending admin approval again.",
      course: result.rows[0]
    });

  } catch (err) {
    console.error("updateCourse error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};



// Instructor: add lesson to my course
// POST /api/instructor/courses/:courseId/lessons
exports.addLesson = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const courseId = Number(req.params.courseId);
    const { title, description, video_url, order_index } = req.body || {};

    if (!title || !video_url || !order_index) {
      return res.status(400).json({
        success: false,
        message: "title, video_url, and order_index are required."
      });
    }

    // Course must belong to this instructor
    const courseRes = await pool.query(
      "SELECT id, status FROM courses WHERE id = $1 AND instructor_id = $2",
      [courseId, instructorId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You can add lessons only to your own course."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO lessons (course_id, title, description, video_url, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, course_id, title, description, video_url, order_index, created_at
      `,
      [courseId, title, description ?? null, video_url, Number(order_index)]
    );

    return res.status(201).json({
      success: true,
      message: "Lesson added successfully.",
      lesson: result.rows[0]
    });
  } catch (err) {
    // unique order conflict if you created uq_lessons_course_order
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This order_index already exists for this course. Use a different number."
      });
    }

    console.error("addLesson error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Instructor: update lesson (only if lesson belongs to instructor’s course)
// PUT /api/instructor/lessons/:lessonId
exports.updateLesson = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const lessonId = Number(req.params.lessonId);
    const { title, description, video_url, order_index } = req.body || {};

    // Find lesson + ownership
    const existing = await pool.query(
      `
      SELECT l.id, l.course_id
      FROM lessons l
      JOIN courses c ON c.id = l.course_id
      WHERE l.id = $1 AND c.instructor_id = $2
      `,
      [lessonId, instructorId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found or you don't have permission."
      });
    }

    const updated = await pool.query(
      `
      UPDATE lessons
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        video_url = COALESCE($3, video_url),
        order_index = COALESCE($4, order_index)
      WHERE id = $5
      RETURNING id, course_id, title, description, video_url, order_index, created_at
      `,
      [
        title ?? null,
        description ?? null,
        video_url ?? null,
        order_index !== undefined ? Number(order_index) : null,
        lessonId
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully.",
      lesson: updated.rows[0]
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This order_index already exists for this course."
      });
    }
    console.error("updateLesson error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Instructor: delete lesson (only own)
// DELETE /api/instructor/lessons/:lessonId
exports.deleteLesson = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const lessonId = Number(req.params.lessonId);

    const existing = await pool.query(
      `
      SELECT l.id
      FROM lessons l
      JOIN courses c ON c.id = l.course_id
      WHERE l.id = $1 AND c.instructor_id = $2
      `,
      [lessonId, instructorId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found or you don't have permission."
      });
    }

    await pool.query("DELETE FROM lessons WHERE id = $1", [lessonId]);

    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully."
    });
  } catch (err) {
    console.error("deleteLesson error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Instructor: view students in my course
// GET /api/instructor/courses/:courseId/students
exports.getCourseStudents = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const courseId = Number(req.params.courseId);

    // Verify course ownership
    const courseRes = await pool.query(
      "SELECT id, title FROM courses WHERE id = $1 AND instructor_id = $2",
      [courseId, instructorId]
    );

    if (courseRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You can view students only for your own course."
      });
    }

    const studentsRes = await pool.query(
      `
      SELECT
        u.id AS student_id, u.name AS student_name, u.email,
        e.enrolled_at
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      WHERE e.course_id = $1
      ORDER BY e.enrolled_at DESC
      `,
      [courseId]
    );

    return res.status(200).json({
      success: true,
      course: courseRes.rows[0],
      count: studentsRes.rows.length,
      students: studentsRes.rows
    });
  } catch (err) {
    console.error("getCourseStudents error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
// GET /api/instructor/courses/:id/reviews
exports.getCourseReviews = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const courseId = Number(req.params.id);

    // must own course
    const courseRes = await pool.query(
      "SELECT id, title FROM courses WHERE id = $1 AND instructor_id = $2",
      [courseId, instructorId]
    );
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found or no permission." });
    }

    const ratingRes = await pool.query(
      `
      SELECT COALESCE(AVG(rating), 0)::numeric(10,2) AS avg_rating,
             COUNT(*) AS review_count
      FROM reviews
      WHERE course_id = $1
      `,
      [courseId]
    );

    const reviewsRes = await pool.query(
      `
      SELECT rv.id, rv.rating, rv.comment, rv.created_at,
             u.id AS student_id, u.name AS student_name
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
      reviews: reviewsRes.rows
    });
  } catch (err) {
    console.error("getCourseReviews error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
