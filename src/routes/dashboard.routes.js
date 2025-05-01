const { Router } = require("express");
const dashboardRouter = Router();

const { getDashboardOverview } = require("../controllers/dashboard.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");
const hasRole = require("../middlewares/role.middleware");

dashboardRouter.get(
  "/overview",
  authMiddleware,
  hasRole("admin"),
  getDashboardOverview
);

module.exports = dashboardRouter;
