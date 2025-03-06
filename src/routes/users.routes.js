const { Router } = require("express");
const { addNewUser } = require("../controllers/users.controller");
const hasRole = require("../middlewares/role.middleware");
const usersRouter = Router();

usersRouter.post("/add", hasRole("admin"), addNewUser);

module.exports = usersRouter;
