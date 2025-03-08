const { Router } = require("express");
const { addNewUser, getAllUsers } = require("../controllers/users.controller");
const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const usersRouter = Router();

usersRouter.post("/add", hasRole("admin"), addNewUser);

usersRouter.get("/", authMiddleware, hasRole("admin"), getAllUsers);

module.exports = usersRouter;
