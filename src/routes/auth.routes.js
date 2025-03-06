const { Router } = require("express");
const authRouter = Router();
const {
  signupUser,
  loginUser,
  logoutUser,
  getUserState,
} = require("../controllers/auth.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

authRouter.post("/login", loginUser);

authRouter.post("/logout", logoutUser);

authRouter.get("/user-state", authMiddleware, getUserState);

module.exports = authRouter;
