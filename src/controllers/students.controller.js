const { PrismaClient } = require("@prisma/client");
const { paginationQuery } = require("../utils");
const { hashValue } = require("../utils/index");
const prisma = new PrismaClient();

async function addNewCanteenStudent(req, res) {
  const { enrolledStudentId, parentId, ...extraFields } = req.body;

  // Sécurité anti-clown 🤡
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'enrolledStudentId' et 'parentId' sont autorisés.",
    });
  }

  if (!enrolledStudentId || !parentId) {
    return res.status(400).json({
      message:
        "Les champs 'enrolledStudentId' et 'parentId' sont obligatoires.",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Vérifier si l'élève existe
      const enrolledStudent = await tx.enrolledStudent.findUnique({
        where: { id: enrolledStudentId },
      });

      if (!enrolledStudent) {
        throw new Error("Élève non trouvé.");
      }

      if (enrolledStudent.isRegisteredToCanteen) {
        throw new Error("Cet élève est déjà inscrit à la cantine.");
      }

      // Vérifier si le parent existe
      const parent = await tx.parent.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new Error("Parent introuvable.");
      }

      // Créer le hash du matricule
      const matriculeHashe = await hashValue(enrolledStudent.matricule);

      // Ajouter l'élève dans CanteenStudent
      const canteenStudent = await tx.canteenStudent.create({
        data: {
          enrolledStudentId: enrolledStudent.id,
          matriculeHashe,
          parentId: parent.id,
          abonnements: {
            create: {
              duration: 0,
              price: 0,
              status: "expiré",
              endDate: null,
            },
          },
        },
        include: {
          enrolledStudent: true,
          parent: {
            include: { user: true },
          },
          abonnements: true,
        },
      });

      // Mettre à jour l'EnrolledStudent pour dire qu'il est inscrit à la cantine
      await tx.enrolledStudent.update({
        where: { id: enrolledStudentId },
        data: { isRegisteredToCanteen: true },
      });

      // Nettoyer avant de renvoyer (pas de password ni rôle admin dans la réponse)
      delete canteenStudent.parent.user.password;
      delete canteenStudent.parent.user.role;

      return canteenStudent;
    });

    return res.status(201).json({
      message: "Élève inscrit à la cantine avec succès.",
      student: result,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'élève à la cantine :", error);
    return res.status(400).json({ message: error.message });
  }
}

async function removeStudentFromCanteen(req, res) {
  const { canteenStudentId } = req.params;

  if (!canteenStudentId) {
    return res.status(400).json({ message: "canteenStudentId requis." });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Étape 1 : Vérifier si le canteenStudent existe
      const canteenStudent = await tx.canteenStudent.findUnique({
        where: { id: canteenStudentId },
      });

      if (!canteenStudent) {
        throw new Error("Élève non trouvé dans la cantine.");
      }

      // Étape 2 : Mettre isRegisteredToCanteen à false dans EnrolledStudent
      await tx.enrolledStudent.update({
        where: { id: canteenStudent.enrolledStudentId },
        data: { isRegisteredToCanteen: false },
      });

      // Étape 3 : Supprimer le record dans canteenStudent
      await tx.canteenStudent.delete({
        where: { id: canteenStudentId },
      });
    });

    return res.status(200).json({
      message: "Élève désinscrit de la cantine avec succès.",
    });
  } catch (error) {
    console.error("Erreur lors de la désinscription :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

async function getAllEnrolledStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.enrolledStudent, page, limit, {
      select: {
        id: true,
        name: true,
        class: true,
        gender: true,
        matricule: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (result.error) {
      return res.status(400).json({
        message: result.error,
        ...result,
      });
    }

    return res.status(200).json({
      message: "Liste des élèves",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des élèves :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la récupération des élèves.",
    });
  }
}

async function getAllCanteenStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.canteenStudent, page, limit, {
      select: {
        id: true,
        enrolledStudent: {
          select: {
            id: true,
            name: true,
            class: true,
            gender: true,
            matricule: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        abonnements: true,
      },
    });

    if (result.error) {
      return res.status(400).json({
        message: result.error,
        ...result,
      });
    }

    return res.status(200).json({
      message: "Liste des élèves enregistré à la Cantine",
      ...result,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des élèves enregistré à la Cantine :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération des élèves enregistré à la Cantine.",
    });
  }
}

async function getEnrolledStudentById(req, res) {
  const { enrolledStudentId } = req.params;
  const enrolledStudent = await prisma.enrolledStudent.findUnique({
    where: {
      id: enrolledStudentId,
    },
    select: {
      id: true,
      name: true,
      class: true,
      gender: true,
      matricule: true,
      createdAt: true,
      updatedAt: true,
      canteenStudent: true,
    },
  });

  if (!enrolledStudent) {
    return res.status(404).json({
      message: "Aucun élève trouvé avec cet identifiant.",
    });
  }

  return res.status(200).json({
    message: "Détails de l'élève",
    enrolledStudent,
  });
}

async function getCanteenStudentsLinkedToAParent(req, res) {
  try {
    const { parentId } = req.params;

    // Vérification stricte des entrées (uniquement parentId)
    if (!parentId) {
      return res.status(400).json({
        message: "L'ID du parent est requis.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Vérifier si le parent existe
      const parent = await tx.parent.findUnique({
        where: { id: parentId },
        include: {
          user: true,
        },
      });

      if (!parent) {
        throw new Error("Aucun parent trouvé avec cet identifiant.");
      }

      // Récupérer les élèves liés au parent
      const canteenStudents = await tx.canteenStudent.findMany({
        where: { parentId },
        include: {
          enrolledStudent: true,
          abonnements: true,
        },
      });

      // Suppression des informations sensibles avant de renvoyer la réponse
      delete parent.user.password;

      return canteenStudents;
    });

    return res.status(200).json({
      message: "Liste des élèves rattachés au parent",
      nombre: result.length,
      data: result,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des élèves d'un parent :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération des élèves d'un parent.",
    });
  }
}

async function buySubscriptionForACanteenStudent(req, res) {
  const { duration, price, ...extraFields } = req.body;
  const { canteenStudentId } = req.params;
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'duration'et 'price' sont autorisés dans la requête.",
    });
  }
  if (
    !duration ||
    !price ||
    !(typeof duration === "number") ||
    !(typeof price === "number")
  ) {
    return res.status(400).json({
      message:
        "Seuls 'duration'et 'price' sont autorisés dans la requête. Et veuillez les fournir en tant que nombres.",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Vérifier si l'élève existe
      const student = await tx.canteenStudent.findUnique({
        where: { id: canteenStudentId },
        include: {
          parent: {
            include: {
              user: true,
            },
          },
          enrolledStudent: true,
        },
      });

      if (!student) {
        throw new Error("Aucun élève trouvé avec cet identifiant.");
      }

      // Calculer la date de fin de l'abonnement
      const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      const startDate = new Date();

      const existingActiveAbonnement = await tx.abonnement.findFirst({
        where: {
          canteenStudentId,
          status: "actif",
        },
      });

      let abonnement;
      if (existingActiveAbonnement) {
        // Mise à jour l'abonnement existant
        abonnement = await tx.abonnement.update({
          where: { id: existingActiveAbonnement.id },
          data: {
            duration,
            price,
            startDate,
            endDate,
            status: "actif",
          },
        });
      } else {
        // Création d'un nouvel abonnement
        abonnement = await tx.abonnement.create({
          data: {
            canteenStudentId,
            duration,
            price,
            startDate,
            endDate,
            status: "actif",
          },
        });
      }

      // Créer une notification pour le parent
      const notification = await tx.notification.create({
        data: {
          canteenStudent: {
            connect: { id: canteenStudentId }, // Utilisation de `connect` pour établir la relation
          },
          message: `Un nouvel abonnement de ${duration} jours a été acheté pour ${student.enrolledStudent.name}.`,
          type: "abonnement",
          details: {
            duration,
            price,
            endDate,
          },
        },
      });

      return { abonnement, notification };
    });

    return res.status(201).json({
      message: "Abonnement acheté avec succès.",
      data: result,
    });
  } catch (error) {
    console.error("Erreur lors de l'achat de l'abonnement :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'achat de l'abonnement.",
    });
  }
}

async function getAllNotifOfAcanteenStudent(req, res) {
  const { canteenStudentId } = req.params;
  const { page, limit } = req.query;
  try {
    const result = await paginationQuery(prisma.notification, page, limit, {
      where: { canteenStudentId },
      orderBy: { createdAt: "desc" },
      include: {
        canteenStudent: {
          select: {
            id: true,
            enrolledStudent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return res.status(200).json({
      message: "Liste des notifications",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des notifications :", error);
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération des notifications.",
    });
  }
}

async function markAllNotifsAsRead(req, res) {
  const { canteenStudentId } = req.params;
  try {
    const notifications = await prisma.notification.updateMany({
      where: { canteenStudentId },
      data: { read: true },
    });

    return res.status(200).json({
      message: "Toutes les notifications marquées comme lues.",
      notifications,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la marque comme lues de toutes les notifications :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la marque comme lues de toutes les notifications.",
    });
  }
}

async function markOneNotifAsRead(req, res) {
  const { notificationId } = req.params;
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      return res.status(404).json({
        message: "Notification introuvable.",
      });
    }
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
    return res.status(200).json({
      message: "Notification marquée comme lue.",
      notification: updatedNotification,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la marque comme lue de la notification :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la marque comme lue de la notification.",
    });
  }
}

async function searchEnrolledStudent(req, res) {
  try {
    const { query, page, limit } = req.query;
    if (!query) {
      return res.status(400).json({
        message: "Veuillez fournir une requête de recherche.",
      });
    }

    const result = await paginationQuery(prisma.enrolledStudent, page, limit, {
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } }, // recherche insensible à la casse
          { matricule: { contains: query, mode: "insensitive" } },
          { class: { contains: query, mode: "insensitive" } },
        ],
      },
    });
    return res.status(200).json({
      message: "Liste des élèves",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la recherche des élèves :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la recherche des élèves.",
    });
  }
}

async function scanQRCodeForACanteenStudent(req, res) {
  const { matriculeHashe, ...extraFields } = req.body;

  // Vérification qu'il n'y a pas de champs supplémentaires
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'matriculeHashe'est autorisé dans la requête.",
    });
  }

  // Validation des données requises
  if (!matriculeHashe) {
    return res.status(400).json({
      message: "Veuillez fournir le matricule hashé pour le scan.",
    });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)); // Début de la journée
    const todayEnd = new Date(now.setHours(23, 59, 59, 999)); // Fin de la journée

    // Récupérer l'élève et son abonnement actif
    const student = await prisma.canteenStudent.findUnique({
      where: { matriculeHashe },
      include: {
        abonnements: {
          where: {
            status: "actif",
            endDate: { gte: now }, // Vérifier que l'abonnement n'est pas expiré
          },
        },
        repas: {
          where: {
            date: { gte: todayStart, lte: todayEnd }, // Vérifier les repas d'aujourd'hui
          },
        },
        enrolledStudent: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        message: "Élève introuvable.",
      });
    }

    // Vérifier si l'élève a un abonnement actif
    if (student.abonnements?.status !== "actif") {
      return res.status(400).json({
        message: "L'élève n'a pas d'abonnement actif.",
      });
    }

    // Vérifier si l'élève a déjà mangé aujourd'hui
    if (student.repas.length > 0) {
      return res.status(400).json({
        message: "L'élève a déjà été servi aujourd'hui.",
        alreadyScanned: true,
      });
    }

    // Enregistrer le repas
    const repas = await prisma.repas.create({
      data: {
        canteenStudentId: student.id,
        date: now,
        status: true, // L'élève a mangé
      },
    });

    // Envoyer une notification au parent
    const notification = await prisma.notification.create({
      data: {
        canteenStudent: {
          connect: { id: student.id },
        },
        message: `Votre enfant ${student.enrolledStudent.name} a été servi à la cantine aujourd'hui.`,
        type: "repas",
        details: {
          date: now,
          status: "servi",
        },
      },
    });

    return res.status(200).json({
      message: "L'élève a été servi avec succès.",
      repas,
      notification,
    });
  } catch (error) {
    console.error("Erreur lors du scan du QR Code :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors du scan du QR Code.",
    });
  }
}

async function getMealHistory(req, res) {
  const { canteenStudentId } = req.params;

  if (!canteenStudentId) {
    return res.status(400).json({
      message: "Veuillez fournir l'ID de l'élève.",
    });
  }

  try {
    const student = await prisma.canteenStudent.findUnique({
      where: { id: canteenStudentId },
    });

    if (!student) {
      return res.status(404).json({
        message: "Élève introuvable.",
      });
    }
    // Récupérer tous les repas de l'élève
    const repas = await prisma.repas.findMany({
      where: { canteenStudentId },
      orderBy: { date: "asc" },
    });

    // Formater les données pour le calendrier
    const calendar = repas.map((repas) => ({
      date: repas.date.toISOString().split("T")[0], // Format YYYY-MM-DD
      status: repas.status, // true = servi, false = non servi, null = week-end ou absence
    }));

    return res.status(200).json({
      message: "Historique des repas récupéré avec succès.",
      calendar,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération de l'historique des repas :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération de l'historique des repas.",
    });
  }
}

module.exports = {
  addNewCanteenStudent,
  removeStudentFromCanteen,
  getAllEnrolledStudents,
  getAllCanteenStudents,
  getEnrolledStudentById,
  getCanteenStudentsLinkedToAParent,
  buySubscriptionForACanteenStudent,
  getAllNotifOfAcanteenStudent,
  markAllNotifsAsRead,
  markOneNotifAsRead,
  searchEnrolledStudent,
  scanQRCodeForACanteenStudent,
  getMealHistory,
};
