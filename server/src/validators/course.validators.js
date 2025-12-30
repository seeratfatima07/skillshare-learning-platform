exports.validateCreateCourse = (req, res, next) => {
  const { title, description, category_id, level } = req.body || {};

  if (!title || !description || !category_id || !level) {
    return res.status(400).json({
      success: false,
      message: "All course fields are required.",
    });
  }

  next();
};
