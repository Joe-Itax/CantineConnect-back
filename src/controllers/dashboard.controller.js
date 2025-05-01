const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);

    const [
      totalCanteenStudents,
      newCanteenStudentsThisMonth,
      mealsThisMonth,
      totalAbonnes,
      actifs,
      enrolledLastMonth,
      mealsGraphData,
      revenueAllTime,
      revenueThisMonth,
      revenueLastMonth,
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

      prisma.canteenStudent.count({ where: { isActive: true } }),

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
        where: { price: { gt: 0 }, canteenStudent: { isActive: true } },
      }),

      prisma.abonnement.aggregate({
        _sum: { price: true },
        where: {
          price: { gt: 0 },
          canteenStudent: { isActive: true },
          createdAt: { gte: startOfMonth },
        },
      }),

      prisma.abonnement.aggregate({
        _sum: { price: true },
        where: {
          price: { gt: 0 },
          canteenStudent: { isActive: true },
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      }),
    ]);

    const growthRate =
      enrolledLastMonth === 0
        ? 100
        : ((newCanteenStudentsThisMonth - enrolledLastMonth) /
            enrolledLastMonth) *
          100;

    const abonnementRate =
      totalAbonnes === 0 ? 0 : (actifs / totalAbonnes) * 100;

    const expiredAbonnements = await prisma.abonnement.findMany({
      where: {
        status: "expiré",
        canteenStudent: { isActive: true },
      },
      select: {
        canteenStudentId: true,
      },
      distinct: ["canteenStudentId"],
    });
    const expiredAbonnementsCount = expiredAbonnements.length;

    const revenueGrowthRate =
      revenueLastMonth._sum.price === 0
        ? 100
        : ((revenueThisMonth._sum.price - revenueLastMonth._sum.price) /
            revenueLastMonth._sum.price) *
          100;

    return res.status(200).json({
      totalCanteenStudents,
      newCanteenStudentsThisMonth,
      expiredAbonnements: expiredAbonnementsCount,
      mealsThisMonth,
      abonnementRate: Math.round(abonnementRate),
      growthRate: Math.round(growthRate),
      totalRevenue: revenueAllTime._sum.price || 0,
      revenueGrowthRate: Math.round(revenueGrowthRate),
      mealsGraphData: mealsGraphData.map((m) => ({
        date: m.date,
        total: m._count.id,
      })),
    });
  } catch (error) {
    console.error("Erreur getDashboardOverview:", error);
    return res.status(500).json({
      message: "Erreur serveur lors du chargement du tableau de bord.",
    });
  }
}

module.exports = { getDashboardOverview };
