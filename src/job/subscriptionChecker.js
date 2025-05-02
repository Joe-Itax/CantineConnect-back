const cron = require("node-cron");
const { prisma } = require("../lib/prisma");

// Exécuter toutes les 6 heures (0 */6 * * *)
cron.schedule("0 */6 * * *", async () => {
  console.log("⏰ Lancement du cron job de vérification des abonnements...");

  const now = new Date();

  try {
    // Étape 1 : mise à jour
    const abonnements = await prisma.$transaction(async (tx) => {
      const abonnementsExpirés = await tx.abonnement.findMany({
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

      if (abonnementsExpirés.length === 0) {
        console.log("✅ Aucun abonnement expiré trouvé.");
        return [];
      }

      console.log(
        `🔍 ${abonnementsExpirés.length} abonnement(s) expiré(s) détecté(s).`
      );

      await Promise.all(
        abonnementsExpirés.map((abo) =>
          tx.abonnement.update({
            where: { id: abo.id },
            data: { status: "expiré" },
          })
        )
      );

      return abonnementsExpirés;
    });

    // Étape 2 : création des notifications
    for (const abo of abonnements) {
      await prisma.notification.create({
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
    }

    console.log("🎯 Vérification terminée !");
  } catch (error) {
    console.error("❌ Erreur lors du cron job abonnement :", error);
  }
});
