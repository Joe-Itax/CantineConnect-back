const { Router } = require("express");
const {
  addNewUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUsers,
  searchUser,
} = require("../controllers/users.controller");
const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");

const usersRouter = Router();

usersRouter.get("/", authMiddleware, hasRole("admin"), getAllUsers);
usersRouter.post("/", authMiddleware, hasRole("admin"), addNewUser);
usersRouter.delete("/", authMiddleware, hasRole("admin"), deleteUsers);
usersRouter.get("/search", authMiddleware, hasRole("admin"), searchUser);
usersRouter.get("/:userId", authMiddleware, hasRole("admin"), getUserById);
usersRouter.put(
  "/:userId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  updateUser
);

module.exports = usersRouter;
