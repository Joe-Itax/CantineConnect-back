const { PrismaClient } = require("@prisma/client");
const { paginationQuery } = require("../utils");
const { hashValue } = require("../utils/index");
const { removeAccents } = require("../utils/userUtils");
const pricing = require("../config/princing");
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

      // Mettre à jour l'EnrolledStudent pour dire qu'il est inscrit à la cantine
      await tx.enrolledStudent.update({
        where: { id: enrolledStudentId },
        data: { isRegisteredToCanteen: true },
      });

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

async function removeStudentsFromCanteen(req, res) {
  const { canteenStudentIds } = req.body;

  if (!Array.isArray(canteenStudentIds)) {
    return res.status(400).json({
      message:
        "Le corps de la requête doit contenir un tableau d'identifiants.",
    });
  }

  if (canteenStudentIds.length === 0) {
    return res
      .status(400)
      .json({ message: "Aucun identifiant d'élève fourni." });
  }

  try {
    const now = new Date();
    const updatedStudents = [];

    await prisma.$transaction(async (tx) => {
      for (const id of canteenStudentIds) {
        const canteenStudent = await tx.canteenStudent.findUnique({
          where: { id, isActive: true },
          include: {
            enrolledStudent: true,
          },
        });

        if (!canteenStudent) continue;

        await tx.enrolledStudent.update({
          where: { id: canteenStudent.enrolledStudentId },
          data: { isRegisteredToCanteen: false },
        });

        await tx.canteenStudent.update({
          where: { id },
          data: { isActive: false },
        });

        updatedStudents.push(
          `${canteenStudent.enrolledStudent.name} (${canteenStudent.enrolledStudent.matricule})`
        );
      }
    });

    if (updatedStudents.length === 0) {
      return res.status(404).json({
        message: "Aucun élève actif trouvé avec les identifiants fournis.",
      });
    }

    console.log(
      `${updatedStudents.length} élève(s), dont ${updatedStudents.join(
        ", "
      )}, ont été désinscrits de la cantine.`
    );

    return res.status(200).json({
      message: `${updatedStudents.length} élève(s), dont ${updatedStudents.join(
        ", "
      )}, ont été désinscrits de la cantine.`,
    });
  } catch (error) {
    console.error("Erreur lors de la désinscription multiple :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

async function reRegisterStudentToCanteen(req, res) {
  const { canteenStudentId } = req.params;

  if (!canteenStudentId) {
    return res.status(400).json({ message: "canteenStudentId requis." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const canteenStudent = await tx.canteenStudent.findUnique({
        where: { id: canteenStudentId },
      });

      if (!canteenStudent) {
        throw new Error("Aucun élève trouvé avec cet identifiant.");
      }

      if (canteenStudent.isActive) {
        throw new Error("Cet élève est déjà actif dans la cantine.");
      }

      const updatedStudent = await tx.canteenStudent.update({
        where: { id: canteenStudentId },
        data: { isActive: true },
      });

      await tx.enrolledStudent.update({
        where: { id: updatedStudent.enrolledStudentId },
        data: { isRegisteredToCanteen: true },
      });

      return updatedStudent;
    });

    return res.status(200).json({
      message: "Élève réinscrit à la cantine avec succès.",
      student: result,
    });
  } catch (error) {
    console.error("Erreur lors de la réinscription :", error);
    return res.status(500).json({
      message: error.message || "Erreur serveur lors de la réinscription.",
    });
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
        isRegisteredToCanteen: true,
        createdAt: true,
        updatedAt: true,
        canteenStudent: true,
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
      where: { isActive: true },
      select: {
        id: true,
        isActive: true,
        enrolledStudent: {
          select: {
            id: true,
            name: true,
            class: true,
            gender: true,
            matricule: true,
            createdAt: true,
            updatedAt: true,
            isRegisteredToCanteen: true,
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

async function updateEnrolledStudent(req, res) {
  const { enrolledStudentId } = req.params;
  const { ...rest } = req.body;

  const allowedFields = ["name", "class", "gender", "matricule"];
  const unknownFields = Object.keys(rest).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      message: `Champs non autorisés : ${unknownFields.join(", ")}`,
    });
  }

  const dataToUpdate = {};

  for (const key of allowedFields) {
    if (rest[key] !== undefined) {
      if (key === "name") {
        dataToUpdate.name = rest[key];
        dataToUpdate.searchableName = removeAccents(rest[key]);
      } else {
        dataToUpdate[key] = rest[key];
      }
    }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res
      .status(400)
      .json({ message: "Aucun champ valide fourni pour la mise à jour." });
  }

  try {
    const updated = await prisma.enrolledStudent.update({
      where: { id: enrolledStudentId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        class: true,
        gender: true,
        matricule: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "EnrolledStudent mis à jour avec succès.",
      student: updated,
    });
  } catch (error) {
    console.error("Erreur updateEnrolledStudent:", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur lors de la mise à jour." });
  }
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
        where: { parentId, isActive: true },
        include: {
          enrolledStudent: true,
          abonnements: true,
        },
      });

      // Suppression des informations sensibles avant de renvoyer la réponse
      delete parent.user.password;

      canteenStudents.forEach((student) => {
        delete student.enrolledStudent.searchableName;
      });

      return canteenStudents;
    });

    if (result.length === 0) {
      return res.status(404).json({
        message: "Aucun élève trouvé pour ce parent.",
      });
    }

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
  const { duration, ...extraFields } = req.body;
  const { canteenStudentId } = req.params;

  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'duration' est autorisé dans la requête.",
    });
  }

  const validDurations = Object.keys(pricing).map(Number);
  if (!duration || !validDurations.includes(duration)) {
    return res.status(400).json({
      message: `Durée invalide. Durées acceptées : '${validDurations.join(
        ", "
      )}' en Number`,
    });
  }

  const { price, type } = pricing[duration];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.canteenStudent.findUnique({
        where: { id: canteenStudentId, isActive: true },
        include: {
          parent: { include: { user: true } },
          enrolledStudent: true,
        },
      });

      if (!student) {
        throw new Error("Aucun élève actif trouvé avec cet identifiant.");
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

      const existingActiveAbonnement = await tx.abonnement.findFirst({
        where: { canteenStudentId, status: "actif" },
      });

      let abonnement;
      if (existingActiveAbonnement) {
        abonnement = await tx.abonnement.update({
          where: { id: existingActiveAbonnement.id },
          data: {
            duration,
            price,
            type,
            startDate: now,
            endDate,
            status: "actif",
          },
        });
      } else {
        abonnement = await tx.abonnement.create({
          data: {
            canteenStudentId,
            duration,
            price,
            type,
            startDate: now,
            endDate,
            status: "actif",
          },
        });
      }

      const notification = await tx.notification.create({
        data: {
          canteenStudent: { connect: { id: canteenStudentId } },
          message: `Un abonnement de ${duration} jours a été acheté pour ${student.enrolledStudent.name}.`,
          type: "abonnement",
          details: { duration, price, endDate, type },
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
      message: error.message || "Erreur serveur lors de l'achat.",
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
  const notificationIdInt = parseInt(notificationId);
  if (isNaN(notificationIdInt)) {
    return res.status(400).json({
      message: "L'ID de la notification doit être un nombre valide.",
    });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findUnique({
        where: { id: notificationIdInt },
      });

      if (!notification) {
        throw new Error("Notification introuvable.");
      }

      const updatedNotification = await tx.notification.update({
        where: { id: notificationIdInt },
        data: { read: true },
      });

      return updatedNotification;
    });

    return res.status(200).json({
      message: "Notification marquée comme lue.",
      notification: result,
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
          {
            searchableName: {
              contains: removeAccents(query),
              mode: "insensitive",
            },
          },
          { matricule: { contains: query, mode: "insensitive" } },
          { class: { contains: query, mode: "insensitive" } },
        ],
      },
    });
    return res.status(200).json({
      message: "Liste des élèves trouvés",
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

  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'matriculeHashe' est autorisé dans la requête.",
    });
  }

  if (!matriculeHashe) {
    return res.status(400).json({
      message: "Veuillez fournir le matricule hashé pour le scan.",
    });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const result = await prisma.$transaction(async (tx) => {
      // 1 seule requête pour récupérer TOUT ce qu'il faut !
      const student = await tx.canteenStudent.findUnique({
        where: { matriculeHashe },
        select: {
          id: true,
          isActive: true,
          enrolledStudent: {
            select: { name: true },
          },
          abonnements: {
            where: {
              status: "actif",
            },
            select: {
              id: true,
              endDate: true,
            },
          },
          repas: {
            where: {
              date: { gte: todayStart, lte: todayEnd },
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!student || !student.isActive) {
        throw new Error("Élève introuvable ou inactif.");
      }

      const abonnement = student.abonnements[0];
      if (!abonnement) {
        throw new Error("L'élève n'a pas d'abonnement actif.");
      }

      if (abonnement.endDate && abonnement.endDate < new Date()) {
        await Promise.all([
          tx.abonnement.update({
            where: { id: abonnement.id },
            data: { status: "expiré" },
          }),
          tx.notification.create({
            data: {
              canteenStudentId: student.id,
              message: `L'abonnement de ${student.enrolledStudent.name} a expiré.`,
              type: "abonnement_expiré",
              details: {
                expiredAt: now,
              },
            },
          }),
        ]);

        throw new Error("L'abonnement de cet élève a expiré.");
      }

      if (student.repas.length > 0) {
        throw new Error("L'élève a déjà été servi aujourd'hui.");
      }

      const [repas, notification] = await Promise.all([
        tx.repas.create({
          data: {
            canteenStudentId: student.id,
            date: now,
            status: true,
          },
        }),
        tx.notification.create({
          data: {
            canteenStudentId: student.id,
            message: `Votre enfant ${student.enrolledStudent.name} a été servi à la cantine aujourd'hui.`,
            type: "repas",
            details: {
              date: now,
              status: "servi",
            },
          },
        }),
      ]);

      return { repas, notification };
    });

    return res.status(200).json({
      message: "L'élève a été servi avec succès.",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors du scan du QR Code :", error);

    return res.status(400).json({
      message: error.message || "Erreur serveur lors du scan du QR Code.",
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
  removeStudentsFromCanteen,
  reRegisterStudentToCanteen,
  getAllEnrolledStudents,
  getAllCanteenStudents,
  getEnrolledStudentById,
  updateEnrolledStudent,
  getCanteenStudentsLinkedToAParent,
  buySubscriptionForACanteenStudent,
  getAllNotifOfAcanteenStudent,
  markAllNotifsAsRead,
  markOneNotifAsRead,
  searchEnrolledStudent,
  scanQRCodeForACanteenStudent,
  getMealHistory,
};
