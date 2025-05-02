const { prisma } = require("../lib/prisma");

async function getDashboardOverview(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const lastMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const lastMonthEnd = new Date(startOfMonth.getTime() - 1);
    const threeMonthsAgo = new Date(
      new Date().setUTCMonth(now.getUTCMonth() - 3)
    );

    // Helper function to format dates for comparison
    const formatDateForComparison = (date) => date.toISOString().split("T")[0];

    // Execute all queries in parallel
    const [
      totalCanteenStudents,
      newCanteenStudentsThisMonth,
      mealsThisMonth,
      activeSubscriptions,
      enrolledLastMonth,
      mealsGroup,
      totalRevenueData,
      previousMonthRevenueData,
      expiredAbonnements,
    ] = await Promise.all([
      prisma.canteenStudent.count({ where: { isActive: true } }),

      prisma.canteenStudent.count({
        where: {
          createdAt: { gte: startOfMonth },
          isActive: true,
        },
      }),

      prisma.repas.count({
        where: {
          date: { gte: startOfMonth },
          status: true,
        },
      }),

      prisma.abonnement.count({
        where: {
          status: "actif",
          canteenStudent: { isActive: true },
        },
      }),

      prisma.canteenStudent.count({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
          isActive: true,
        },
      }),

      prisma.repas.groupBy({
        by: ["date"],
        where: {
          date: { gte: threeMonthsAgo },
          status: true,
        },
        _count: { id: true },
        orderBy: { date: "asc" },
      }),

      prisma.abonnement.aggregate({
        _sum: { price: true },
        where: { canteenStudent: { isActive: true } },
      }),

      prisma.abonnement.aggregate({
        _sum: { price: true },
        where: {
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          canteenStudent: { isActive: true },
        },
      }),

      prisma.abonnement.findMany({
        where: {
          status: "expiré",
          canteenStudent: { isActive: true },
        },
        select: { canteenStudentId: true },
        distinct: ["canteenStudentId"],
      }),
    ]);

    // Calculate metrics
    const growthRate =
      enrolledLastMonth === 0
        ? newCanteenStudentsThisMonth > 0
          ? 100
          : 0
        : ((newCanteenStudentsThisMonth - enrolledLastMonth) /
            enrolledLastMonth) *
          100;

    const abonnementRate =
      totalCanteenStudents === 0
        ? 0
        : (activeSubscriptions / totalCanteenStudents) * 100;

    const totalRevenue = totalRevenueData._sum.price || 0;
    const previousMonthRevenue = previousMonthRevenueData._sum.price || 0;
    const revenueGrowthRate = previousMonthRevenue
      ? ((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : totalRevenue > 0
      ? 100
      : 0;

    // Generate complete date range for meals graph
    const mealsGraphData = [];
    const dateMap = new Map();

    // Create a map of dates with meal counts for quick lookup
    mealsGroup.forEach((meal) => {
      dateMap.set(formatDateForComparison(meal.date), meal._count.id);
    });

    // Generate complete date range with 0 values where no data exists
    const currentDate = new Date(threeMonthsAgo);
    while (currentDate <= now) {
      const dateKey = formatDateForComparison(currentDate);
      mealsGraphData.push({
        date: new Date(currentDate),
        total: dateMap.get(dateKey) || 0,
      });
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return res.status(200).json({
      totalCanteenStudents,
      newCanteenStudentsThisMonth,
      expiredAbonnements: expiredAbonnements.length,
      mealsThisMonth,
      abonnementRate: Math.round(abonnementRate),
      growthRate: Math.round(growthRate),
      totalRevenue,
      revenueGrowthRate: Math.round(revenueGrowthRate),
      mealsGraphData,
    });
  } catch (error) {
    console.error("Error in getDashboardOverview:", error);
    return res.status(500).json({
      message: "Server error while loading dashboard data.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = { getDashboardOverview };
