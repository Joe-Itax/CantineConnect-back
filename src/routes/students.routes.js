const { Router } = require("express");
const {
  addNewStudent,
  getAllStudents,
  getOneStudent,
  getStudentsFromParent,
} = require("../controllers/students.controller");

const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");

const studentsRouter = Router();

studentsRouter.post("/add", hasRole("admin"), addNewStudent);

studentsRouter.get("/", authMiddleware, hasRole("admin"), getAllStudents);

studentsRouter.get(
  "/by-parent",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getStudentsFromParent
);

studentsRouter.get(
  "/:idStudent",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getOneStudent
);

module.exports = studentsRouter;
