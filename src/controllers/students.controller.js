const { paginationQuery } = require("../utils");
const { hashValue } = require("../utils/index");
const { removeAccents } = require("../utils/userUtils");
const pricing = require("../config/princing");
const { prisma } = require("../lib/prisma");

// ✅ Ajouter un élève à la cantine
async function addNewCanteenStudent(req, res) {
  const { enrolledStudentIds, parentId, ...extraFields } = req.body;

  // Validation
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'enrolledStudentIds' et 'parentId' sont autorisés.",
    });
  }

  if (!Array.isArray(enrolledStudentIds)) {
    return res.status(400).json({
      message: "'enrolledStudentIds' doit être un tableau.",
    });
  }

  if (!parentId || typeof parentId !== "string") {
    return res.status(400).json({
      message: "'parentId' doit être une chaîne de caractères valide.",
    });
  }

  try {
    // Vérification initiale du parent
    const parentExists = await prisma.parent.findUnique({
      where: { id: parentId },
      select: { id: true },
    });

    if (!parentExists) {
      return res.status(404).json({ message: "Parent non trouvé." });
    }

    const results = await prisma.$transaction(async (tx) => {
      const addedStudents = [];
      const errors = [];

      for (const studentId of enrolledStudentIds) {
        try {
          // Validation de l'ID
          if (typeof studentId !== "string" || !studentId.trim()) {
            errors.push(`ID invalide: ${studentId}`);
            continue;
          }

          const enrolledStudent = await tx.enrolledStudent.findUnique({
            where: { id: studentId },
          });

          if (!enrolledStudent) {
            errors.push(`Élève ${studentId} non trouvé`);
            continue;
          }

          // Vérification existence active
          const existingActive = await tx.canteenStudent.findFirst({
            where: {
              enrolledStudentId: studentId,
              isActive: true,
            },
          });

          if (existingActive) {
            errors.push(`${enrolledStudent.name} est déjà inscrit`);
            continue;
          }

          const matriculeHashe = await hashValue(enrolledStudent.matricule);

          // Création ou réactivation
          await tx.canteenStudent.upsert({
            where: { enrolledStudentId: studentId },
            update: {
              isActive: true,
              parentId,
              matriculeHashe,
              abonnements: {
                create: {
                  duration: 0,
                  price: 0,
                  status: "expiré",
                },
              },
            },
            create: {
              enrolledStudentId: studentId,
              parentId,
              matriculeHashe,
              abonnements: {
                create: {
                  duration: 0,
                  price: 0,
                  status: "expiré",
                },
              },
            },
          });

          await tx.enrolledStudent.update({
            where: { id: studentId },
            data: { isRegisteredToCanteen: true },
          });

          addedStudents.push({
            id: studentId,
            name: enrolledStudent.name,
            matricule: enrolledStudent.matricule,
          });
        } catch (error) {
          errors.push(`Erreur avec l'élève ${studentId}: ${error.message}`);
        }
      }

      return { addedStudents, errors };
    });

    if (results.addedStudents.length === 0) {
      return res.status(400).json({
        message: "Aucun élève ajouté",
        errors: results.errors,
      });
    }

    const successCount = results.addedStudents.length;
    const studentNames = results.addedStudents.map(
      (s) => `${s.name} (${s.matricule})`
    );

    return res.status(201).json({
      message: `${successCount} élève(s) ajouté(s) à la cantine`,
      addedStudents: results.addedStudents,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout des élèves:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ✅ Supprimer un élève de la cantine (soft delete)
async function removeStudentsFromCanteen(req, res) {
  const { canteenStudentIds, ...extraFields } = req.body;

  // Validation approfondie
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'canteenStudentIds' est autorisé.",
      receivedFields: Object.keys(req.body),
    });
  }

  if (!Array.isArray(canteenStudentIds)) {
    return res.status(400).json({
      message: "'canteenStudentIds' doit être un tableau.",
      typeReceived: typeof canteenStudentIds,
    });
  }

  if (canteenStudentIds.length === 0) {
    return res.status(400).json({
      message: "Aucun identifiant fourni.",
      expected: "Tableau non vide d'IDs d'élèves cantine",
    });
  }

  // Validation des IDs
  const invalidIds = canteenStudentIds.filter(
    (id) => typeof id !== "string" || !id.trim()
  );
  if (invalidIds.length > 0) {
    return res.status(400).json({
      message: "Certains IDs sont invalides",
      invalidIds,
      exampleValidId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const operations = [];
      const notFoundIds = [];
      const alreadyInactiveIds = [];

      // Première passe: vérification
      for (const id of canteenStudentIds) {
        const student = await tx.canteenStudent.findUnique({
          where: { id },
          select: { isActive: true, enrolledStudentId: true },
        });

        if (!student) {
          notFoundIds.push(id);
          continue;
        }

        if (!student.isActive) {
          alreadyInactiveIds.push(id);
          continue;
        }

        operations.push({
          updateStudent: tx.enrolledStudent.update({
            where: { id: student.enrolledStudentId },
            data: { isRegisteredToCanteen: false },
          }),
          deactivateCanteenStudent: tx.canteenStudent.update({
            where: { id },
            data: { isActive: false },
          }),
          id,
        });
      }

      // Exécution des opérations valides
      await Promise.all(
        operations.map((op) =>
          Promise.all([op.updateStudent, op.deactivateCanteenStudent])
        )
      );

      return {
        deactivatedCount: operations.length,
        notFoundIds,
        alreadyInactiveIds,
        deactivatedIds: operations.map((op) => op.id),
      };
    });

    // Construction de la réponse
    const response = {
      message: `${result.deactivatedCount} élève(s) désinscrit(s) avec succès.`,
      details: {
        deactivatedCount: result.deactivatedCount,
      },
    };

    if (result.notFoundIds.length > 0) {
      response.details.notFound = result.notFoundIds;
    }

    if (result.alreadyInactiveIds.length > 0) {
      response.details.alreadyInactive = result.alreadyInactiveIds;
    }

    if (result.deactivatedCount === 0) {
      return res.status(404).json({
        message: "Aucun élève actif trouvé",
        details: response.details,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Erreur désinscription multiple:", error);
    return res.status(500).json({
      message: "Erreur lors de la désinscription",
      errorCode: error.code,
      details:
        process.env.NODE_ENV === "development"
          ? {
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
}

// ✅ Réenregistré un élève à la cantine
async function reRegisterStudentToCanteen(req, res) {
  const { canteenStudentId } = req.params;

  // Validation de l'ID
  if (!canteenStudentId || typeof canteenStudentId !== "string") {
    return res.status(400).json({
      message: "ID d'élève cantine invalide",
      example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier l'existence et le statut
      const student = await tx.canteenStudent.findUnique({
        where: { id: canteenStudentId },
        include: {
          enrolledStudent: {
            select: {
              name: true,
              matricule: true,
            },
          },
          parent: {
            select: {
              user: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!student) {
        throw { status: 404, message: "Élève cantine non trouvé" };
      }

      if (student.isActive) {
        throw { status: 400, message: "Cet élève est déjà actif" };
      }

      // 2. Vérifier que le parent est actif
      if (!student.parent?.user?.isActive) {
        throw {
          status: 400,
          message: "Le parent associé n'est pas actif",
        };
      }

      // 3. Mise à jour
      const updatedStudent = await tx.canteenStudent.update({
        where: { id: canteenStudentId },
        data: { isActive: true },
        include: {
          enrolledStudent: {
            select: {
              name: true,
              class: true,
            },
          },
        },
      });

      await tx.enrolledStudent.update({
        where: { id: updatedStudent.enrolledStudentId },
        data: { isRegisteredToCanteen: true },
      });

      // 4. Créer un nouvel abonnement vide
      await tx.abonnement.create({
        data: {
          canteenStudentId,
          status: "expiré",
          price: 0,
          duration: 0,
        },
      });

      return {
        studentId: updatedStudent.id,
        studentName: updatedStudent.enrolledStudent.name,
        className: updatedStudent.enrolledStudent.class,
        parentId: updatedStudent.parentId,
      };
    });

    return res.status(200).json({
      message: `${result.studentName} a été réinscrit avec succès`,
      student: result,
    });
  } catch (error) {
    console.error("Erreur réinscription:", error);
    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Erreur serveur",
      details:
        status === 500 && process.env.NODE_ENV === "development"
          ? error.stack
          : undefined,
    });
  }
}

// ✅ Lire tous les élèves de l'école
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

// ✅ Lire un élève enregistré à la Cantine par ID
async function getCanteenStudentById(req, res) {
  try {
    const { canteenStudentId, ...extraFields } = req.params;

    if (Object.keys(extraFields).length > 0) {
      return res.status(400).json({
        message: "Seul 'canteenStudentId' est autorisé.",
      });
    }

    if (!canteenStudentId) {
      return res.status(400).json({
        message: "Le canteenStudentId de l'élève est requis.",
      });
    }

    const canteenStudent = await prisma.canteenStudent.findUnique({
      where: {
        id: canteenStudentId,
      },
      select: {
        id: true,
        matriculeHashe: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        matriculeHashe: true,
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
        abonnements: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Récupérer seulement le dernier abonnement
        },
      },
    });

    if (!canteenStudent) {
      return res.status(404).json({
        message: "Élève non trouvé ou désactivé.",
      });
    }

    return res.status(200).json({
      message: "Détails de l'élève récupérés avec succès",
      data: canteenStudent,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des détails de l'élève :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération des détails de l'élève.",
      error: error.message,
    });
  }
}

// ✅ Lire tous les élèves enregistré à la Cantine
async function getAllCanteenStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.canteenStudent, page, limit, {
      // where: { isActive: true },
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

// ✅ Lire un élève de l'école par ID
async function getEnrolledStudentById(req, res) {
  const { enrolledStudentId, ...extraFields } = req.params;

  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'enrolledStudentId' est autorisé.",
    });
  }

  if (!enrolledStudentId) {
    return res.status(400).json({
      message: "Le enrolledStudentId de l'élève est requis.",
    });
  }

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

// ✅ Modifier un élève de l'école
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

// ✅ Lire les élèves enregistré à la Cantine par l'ID de leur parent
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

// ✅ Acheter un abonnement pour un élève enregistré à la Cantine
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

async function searchCanteenStudent(req, res) {
  try {
    const { query, page, limit } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Veuillez fournir une requête de recherche valide.",
      });
    }

    const result = await paginationQuery(prisma.canteenStudent, page, limit, {
      where: {
        OR: [
          {
            enrolledStudent: {
              searchableName: {
                contains: removeAccents(query),
                mode: "insensitive",
              },
            },
          },
          {
            enrolledStudent: {
              matricule: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            enrolledStudent: {
              class: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        ],
        isActive: true,
      },
      include: {
        enrolledStudent: true,
        parent: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        abonnements: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Liste des élèves trouvés",
      ...result,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la recherche des élèves à la cantine :",
      error
    );
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la recherche des élèves à la cantine.",
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
  getCanteenStudentById,
  getAllCanteenStudents,
  getEnrolledStudentById,
  updateEnrolledStudent,
  getCanteenStudentsLinkedToAParent,
  buySubscriptionForACanteenStudent,
  getAllNotifOfAcanteenStudent,
  markAllNotifsAsRead,
  markOneNotifAsRead,
  searchEnrolledStudent,
  searchCanteenStudent,
  scanQRCodeForACanteenStudent,
  getMealHistory,
};
