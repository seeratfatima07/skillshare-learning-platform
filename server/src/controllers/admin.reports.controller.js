// const pool = require("../config/db");

// // GET /api/admin/reports?status=open|resolved
// exports.getReports = async (req, res) => {
//   try {
//     const { status } = req.query;

//     let sql = `
//       SELECT
//         rp.id, rp.target_type, rp.target_id, rp.reason, rp.status, rp.created_at,
//         u.id AS reporter_id, u.name AS reporter_name, u.email AS reporter_email
//       FROM reports rp
//       JOIN users u ON u.id = rp.reporter_id
//     `;

//     const params = [];
//     if (status) {
//       sql += ` WHERE rp.status = $1`;
//       params.push(status);
//     }

//     sql += ` ORDER BY rp.created_at DESC`;

//     const result = await pool.query(sql, params);

//     return res.status(200).json({
//       success: true,
//       count: result.rows.length,
//       reports: result.rows
//     });
//   } catch (err) {
//     console.error("getReports error:", err);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // PUT /api/admin/reports/:id/resolve
// exports.resolveReport = async (req, res) => {
//   try {
//     const reportId = Number(req.params.id);

//     const result = await pool.query(
//       `
//       UPDATE reports
//       SET status = 'resolved'
//       WHERE id = $1
//       RETURNING id, status
//       `,
//       [reportId]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ success: false, message: "Report not found." });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Report resolved successfully.",
//       report: result.rows[0]
//     });
//   } catch (err) {
//     console.error("resolveReport error:", err);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };
