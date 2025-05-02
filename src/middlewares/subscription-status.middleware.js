const { prisma } = require("../lib/prisma");

async function checkSubscriptionStatus(req, res, next) {
  try {
    // Récupérer tous les abonnements actifs dont la date de fin est dépassée
    const now = new Date();
    const expiredAbonnements = await prisma.abonnement.findMany({
      where: {
        status: "actif",
        endDate: { lt: now },
      },
    });

    // Mettre à jour le statut des abonnements expirés
    for (const abonnement of expiredAbonnements) {
      await prisma.abonnement.update({
        where: { id: abonnement.id },
        data: { status: "expiré" },
      });
    }

    console.log(
      `Mise à jour de ${expiredAbonnements.length} abonnements expirés.`
    );
    next(); // Passer à la prochaine fonction middleware ou au contrôleur
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des abonnements expirés :",
      error
    );
    next(error); // Transmettre l'erreur au gestionnaire d'erreurs
  }
}

module.exports = checkSubscriptionStatus;
