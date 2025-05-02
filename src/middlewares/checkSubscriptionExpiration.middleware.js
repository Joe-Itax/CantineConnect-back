const { prisma } = require("../lib/prisma");

async function checkSubscriptionExpirationMiddleware(req, res, next) {
  const { canteenStudentId } = req.params;

  if (!canteenStudentId) {
    return res.status(400).json({
      message:
        "L'ID de l'élève (canteenStudentId) est requis pour la vérification d'abonnement.",
    });
  }

  try {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const activeAbonnement = await tx.abonnement.findFirst({
        where: {
          canteenStudentId,
          status: "actif",
        },
      });

      if (activeAbonnement && activeAbonnement.endDate < now) {
        // Si l'abonnement a expiré => le passer à "expiré"
        await tx.abonnement.update({
          where: { id: activeAbonnement.id },
          data: { status: "expiré" },
        });

        const student = await tx.canteenStudent.findUnique({
          where: { id: canteenStudentId },
          include: {
            enrolledStudent: true,
          },
        });
        if (!student) {
          return res.status(404).json({
            message: "Élève non trouvé.",
          });
        }

        // Créer une notification pour prévenir
        await tx.notification.create({
          data: {
            canteenStudent: { connect: { id: canteenStudentId } },
            message: `L'abonnement de ${student.enrolledStudent.name} a expiré.`,
            type: "abonnement_expiré",
            details: {
              expiredAt: now,
            },
          },
        });

        console.log(
          `🚨 Abonnement expiré traité pour ${student.enrolledStudent.name}`
        );
      }
    });

    next();
  } catch (error) {
    console.error("Erreur dans checkSubscriptionExpirationMiddleware:", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la vérification de l'abonnement.",
    });
  }
}

module.exports = { checkSubscriptionExpirationMiddleware };
