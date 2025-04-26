const { Router } = require("express");
const {
  addNewUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  searchUser,
} = require("../controllers/users.controller");
const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");

const usersRouter = Router();

usersRouter.post("/", authMiddleware, hasRole("admin"), addNewUser);
usersRouter.get("/", authMiddleware, hasRole("admin"), getAllUsers);
usersRouter.get("/search", authMiddleware, hasRole("admin"), searchUser);
usersRouter.get("/:userId", authMiddleware, hasRole("admin"), getUserById);
usersRouter.put("/:userId", authMiddleware, hasRole("admin"), updateUser);
usersRouter.delete("/:userId", authMiddleware, hasRole("admin"), deleteUser);

module.exports = usersRouter;
