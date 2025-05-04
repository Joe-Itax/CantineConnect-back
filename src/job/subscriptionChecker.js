const cron = require("node-cron");
const { prisma } = require("../lib/prisma");

// Exécuter toutes les 6 heures (0 */6 * * *)
cron.schedule("0 */6 * * *", async () => {
  console.log("⏰ Lancement du cron job de vérification des abonnements...");

  const now = new Date();

  try {
    // Étape 1 : Récupération les abonnements expirés
    const abonnementsExpirés = await prisma.abonnement.findMany({
      where: {
        status: "actif",
        endDate: { lt: now },
      },
      include: {
        canteenStudent: {
          include: {
            parent: { include: { user: true } },
            enrolledStudent: true,
          },
        },
      },
    });

    if (abonnementsExpirés.length === 0) {
      console.log("✅ Aucun abonnement expiré trouvé.");
      return;
    }

    console.log(
      `🔍 ${abonnementsExpirés.length} abonnement(s) expiré(s) détecté(s).`
    );

    // Étape 2 : Mise à jour et notifications en transaction
    await prisma.$transaction(async (tx) => {
      // Mise à jour des statuts
      const updateAbonnement = await tx.abonnement.updateMany({
        where: { id: { in: abonnementsExpirés.map((a) => a.id) } },
        data: { status: "expiré" },
      });

      // Création des notifications
      await Promise.all(
        abonnementsExpirés.map((abo) =>
          tx.notification.create({
            data: {
              canteenStudentId: abo.canteenStudentId,
              message: `L'abonnement de ${abo.canteenStudent.enrolledStudent.name} a expiré.`,
              type: "abonnement_expiré",
              details: { expiredAt: now },
            },
          })
        )
      );
    });
    console.log("🎯 Vérification terminée !");
  } catch (error) {
    console.error("❌ Erreur lors du cron job abonnement :", error);
  } finally {
    await prisma.$disconnect(); // Important pour les cron jobs
  }
});
