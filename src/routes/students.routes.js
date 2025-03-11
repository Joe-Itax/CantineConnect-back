const { Router } = require("express");
const {
  addNewStudent,
  getAllStudents,
  getOneStudent,
  getStudentsFromParent,
  buySubscription,
  getAllNotifOfStudent,
  getAllSchoolStudents,
  markAllNotifsAsRead,
  markOneNotifAsRead,
  searchSchoolStudent,
  scanQRStudent,
  getMealHistory,
} = require("../controllers/students.controller");

const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");

const studentsRouter = Router();

studentsRouter.get("/", authMiddleware, hasRole("admin"), getAllStudents);

studentsRouter.post("/add", hasRole("admin"), addNewStudent);

studentsRouter.get(
  "/school-students",
  authMiddleware,
  hasRole("admin"),
  getAllSchoolStudents
);

studentsRouter.get(
  "/by-parent",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getStudentsFromParent
);

studentsRouter.post(
  "/qr/scan",
  authMiddleware,
  hasRole(["admin", "agent"]),
  scanQRStudent
);

studentsRouter.get(
  "/search",
  authMiddleware,
  hasRole("admin"),
  searchSchoolStudent
);

studentsRouter.get(
  "/:studentId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getOneStudent
);

studentsRouter.get(
  "/:studentId/notifications",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getAllNotifOfStudent
);

studentsRouter.get(
  "/:studentId/meal-history",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getMealHistory
);

studentsRouter.patch(
  "/:studentId/notifications",
  authMiddleware,
  hasRole(["admin", "parent"]),
  markAllNotifsAsRead
);

studentsRouter.patch(
  "/:studentId/notifications/:notificationId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  markOneNotifAsRead
);

studentsRouter.post(
  "/:studentId/subscription",
  authMiddleware,
  hasRole(["parent", "admin"]),
  buySubscription
);

module.exports = studentsRouter;
