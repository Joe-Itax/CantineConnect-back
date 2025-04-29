const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// function startSubscriptionChecker() {
// Exécuter toutes les 6 (0 */6 * * *) heures
cron.schedule("0 */6 * * *", async () => {
  console.log("⏰ Lancement du cron job de vérification des abonnements...");

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const abonnements = await tx.abonnement.findMany({
        where: {
          status: "actif",
          endDate: { lt: now },
        },
        include: {
          canteenStudent: {
            include: {
              parent: {
                include: {
                  user: true,
                },
              },
              enrolledStudent: true,
            },
          },
        },
      });

      if (abonnements.length === 0) {
        console.log("✅ Aucun abonnement expiré trouvé.");
        return;
      }

      console.log(
        `🔍 ${abonnements.length} abonnement(s) expiré(s) détecté(s).`
      );

      await Promise.all(
        abonnements.map(async (abo) => {
          await tx.abonnement.update({
            where: { id: abo.id },
            data: { status: "expiré" },
          });

          await tx.notification.create({
            data: {
              canteenStudent: { connect: { id: abo.canteenStudentId } },
              message: `L'abonnement de ${abo.canteenStudent.enrolledStudent.name} a expiré.`,
              type: "abonnement_expiré",
              details: { expiredAt: now },
            },
          });

          console.log(
            `⛔ Abonnement expiré pour ${abo.canteenStudent.enrolledStudent.name}`
          );
        })
      );
    });

    console.log("🎯 Vérification terminée !");
  } catch (error) {
    console.error("❌ Erreur lors du cron job abonnement :", error);
  }
});
// }

// startSubscriptionChecker();
