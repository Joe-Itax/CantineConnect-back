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

usersRouter.get("/", getAllUsers);
usersRouter.post("/", addNewUser);
usersRouter.delete("/", deleteUsers);
usersRouter.get("/search", searchUser);
usersRouter.get("/:userId", getUserById);
usersRouter.put(
  "/:userId",
  // authMiddleware,
  // hasRole(["admin", "parent"]),
  updateUser
);

module.exports = usersRouter;
