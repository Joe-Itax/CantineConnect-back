const { PrismaClient } = require("@prisma/client");
const { paginationQuery } = require("../utils");
const prisma = new PrismaClient();
const { hashValue } = require("../utils/index");

async function addNewStudent(req, res) {
  const {
    schoolStudentId,
    parentEmail,
    parentName,
    parentPassword = process.env.DEFAULT_PASSWORD_FOR_NEW_PARENT_USER, //Set Default Password
    ...extraFields
  } = req.body;

  // Vérification qu'il n'y a pas de champs supplémentaires
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message:
        "Seuls 'schoolStudentId', 'parentEmail', 'parentName' et parentPassword(optionnel) sont autorisés dans la requête.",
    });
  }
  if (!schoolStudentId || !parentEmail || !parentName) {
    return res.status(400).json({
      message:
        "Veuillez fournir le schoolStudentId de l'élève, le parentName et le parentEmail (Fournir aussi le parentPassword qui est optionnel).",
    });
  }

  // Validation des données requises
  if (!schoolStudentId || !parentEmail || !parentName) {
    return res.status(400).json({
      message: "Veuillez fournir l'ID de l'élève, le nom et l'email du parent.",
    });
  }

  try {
    const result = await prisma.$transaction(async (prisma) => {
      // Vérifier si l'élève existe dans SchoolStudent
      const schoolStudent = await prisma.schoolStudent.findUnique({
        where: {
          id: schoolStudentId,
        },
      });

      if (!schoolStudent) {
        throw new Error("L'élève spécifié n'existe pas dans SchoolStudent.");
      }

      // Vérifier si l'élève est déjà inscrit à la cantine
      const existingStudent = await prisma.student.findUnique({
        where: { schoolStudentId },
      });

      if (existingStudent) {
        throw new Error("Cet élève est déjà inscrit à la cantine.");
      }

      // Vérifier si le parent existe déjà
      let parentUser = await prisma.user.findUnique({
        where: { email: parentEmail },
        include: { parent: true }, // Vérifie si c'est bien un parent
      });

      // Si le parent n'existe pas, le créer
      if (!parentUser) {
        parentUser = await prisma.user.create({
          data: {
            email: parentEmail,
            name: parentName,
            role: "parent",
            password: await hashValue(parentPassword),
            parent: {
              create: {},
            },
          },
        });
      } else if (!parentUser.parent) {
        throw new Error("Ce compte existe déjà mais n'est pas un parent.");
      }

      // Création d'un matricule hashé pour le QR Code
      const matriculeHashe = await hashValue(schoolStudent.matricule);

      // Ajout de l'élève à la table Student
      const newStudent = await prisma.student.create({
        data: {
          schoolStudentId: schoolStudent.id,
          matriculeHashe,
          parentId: parentUser.id,
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
          schoolStudent: true,
          parent: {
            include: {
              user: true,
            },
          },
          abonnements: true,
        },
      });
      // Suppression des informations sensibles avant de renvoyer la réponse
      delete newStudent.parent.user.password;
      delete newStudent.parent.user.role;
      // delete newStudent.

      return newStudent;
    });

    return res.status(201).json({
      message: "L'élève a été ajouté avec succès à la cantine.",
      student: result,
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'élève à la cantine :", error);
    return res.status(400).json({
      message: error.message,
    });
  }
}

async function getAllSchoolStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.schoolStudent, page, limit, {
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

async function getAllStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.student, page, limit, {
      select: {
        id: true,
        schoolStudent: {
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

async function getOneStudent(req, res) {
  const { studentId } = req.params;
  const student = await prisma.schoolStudent.findUnique({
    where: {
      id: studentId,
    },
    select: {
      id: true,
      name: true,
      class: true,
      gender: true,
      matricule: true,
      createdAt: true,
      updatedAt: true,
      Student: true,
    },
  });

  if (!student) {
    return res.status(404).json({
      message: "Aucun élève trouvé avec cet identifiant.",
    });
  }

  return res.status(200).json({
    message: "Détails de l'élève",
    student,
  });
}

async function getStudentsFromParent(req, res) {
  try {
    const { parentId, ...extraFields } = req.body;

    // Vérification stricte des entrées (uniquement parentId)
    if (!parentId) {
      return res.status(400).json({
        message: "L'ID du parent est requis.",
      });
    }

    if (Object.keys(extraFields).length > 0) {
      return res.status(400).json({
        message: "Seul 'parentId' est attendu dans le corps de la requête.",
      });
    }

    // Vérifier si le parent existe
    const parentExists = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        user: true, // Inclure les infos du parent si besoin
      },
    });

    if (!parentExists) {
      return res.status(404).json({
        message: "Aucun parent trouvé avec cet identifiant.",
      });
    }

    // Récupérer les élèves liés au parent
    const students = await prisma.student.findMany({
      where: { parentId },
      include: {
        schoolStudent: true,
        abonnements: true,
      },
    });

    return res.status(200).json({
      message: "Liste des élèves rattachés au parent",
      nombre: students.length,
      students,
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

async function buySubscription(req, res) {
  const { duration, price, ...extraFields } = req.body;
  const { studentId } = req.params;
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'duration'et 'price' sont autorisés dans la requête.",
    });
  }
  if (!duration || !price) {
    return res.status(400).json({
      message: "Veuillez fournir la duration  de l'abonnement et le price.",
    });
  }

  if (!(typeof duration === "number") || !(typeof price === "number")) {
    return res.status(400).json({
      message: "Veuillez fournir la durée et le prix en tant que nombres.",
    });
  }

  try {
    const result = await prisma.$transaction(async (prisma) => {
      // Vérifier si l'élève existe
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          parent: {
            include: {
              user: true,
            },
          },
          schoolStudent: true,
        },
      });

      if (!student) {
        throw new Error("Aucun élève trouvé avec cet identifiant.");
      }

      // Calculer la date de fin de l'abonnement
      const endDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      const startDate = new Date();

      const existingActiveAbonnement = await prisma.abonnement.findFirst({
        where: {
          studentId,
          status: "actif",
        },
      });

      let abonnement;
      if (existingActiveAbonnement) {
        // Mise à jour l'abonnement existant
        abonnement = await prisma.abonnement.update({
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
        abonnement = await prisma.abonnement.create({
          data: {
            studentId,
            duration,
            price,
            startDate,
            endDate,
            status: "actif",
          },
        });
      }

      // Créer une notification pour le parent
      const notification = await prisma.notification.create({
        data: {
          student: {
            connect: { id: studentId }, // Utilisation de `connect` pour établir la relation
          },
          message: `Un nouvel abonnement de ${duration} jours a été acheté pour ${student.schoolStudent.name}.`,
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

async function getAllNotifOfStudent(req, res) {
  const { studentId } = req.params;
  const { page, limit } = req.query;
  try {
    const result = await paginationQuery(prisma.notification, page, limit, {
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            schoolStudent: {
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
  const { studentId } = req.params;
  try {
    const notifications = await prisma.notification.updateMany({
      where: { studentId },
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

async function searchSchoolStudent(req, res) {
  try {
    const { query, page, limit } = req.query;
    if (!query) {
      return res.status(400).json({
        message: "Veuillez fournir une requête de recherche.",
      });
    }

    const result = await paginationQuery(prisma.schoolStudent, page, limit, {
      where: {
        OR: [{ email: { contains: query } }, { name: { contains: query } }],
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

async function scanQRStudent(req, res) {
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
    const student = await prisma.student.findUnique({
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
        schoolStudent: true,
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
        studentId: student.id,
        date: now,
        status: true, // L'élève a mangé
      },
    });

    // Envoyer une notification au parent
    const notification = await prisma.notification.create({
      data: {
        student: {
          connect: { id: student.id },
        },
        message: `Votre enfant ${student.schoolStudent.name} a été servi à la cantine aujourd'hui.`,
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
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({
      message: "Veuillez fournir l'ID de l'élève.",
    });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        message: "Élève introuvable.",
      });
    }
    // Récupérer tous les repas de l'élève
    const repas = await prisma.repas.findMany({
      where: { studentId },
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
  addNewStudent,
  getAllSchoolStudents,
  getAllStudents,
  getOneStudent,
  getStudentsFromParent,
  buySubscription,
  getAllNotifOfStudent,
  markAllNotifsAsRead,
  markOneNotifAsRead,
  searchSchoolStudent,
  scanQRStudent,
  getMealHistory,
};
