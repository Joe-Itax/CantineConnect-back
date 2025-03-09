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
        },
        include: {
          schoolStudent: true,
          parent: {
            include: {
              user: true,
            },
          },
        },
      });
      // Suppression des informations sensibles avant de renvoyer la réponse
      delete newStudent.parent.user.password;
      delete newStudent.parent.user.role;

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

async function getAllStudents(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.schoolStudent, page, limit, {
      id: true,
      name: true,
      class: true,
      gender: true,
      matricule: true,
      createdAt: true,
      updatedAt: true,
      Student: true,
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

async function getOneStudent(req, res) {
  const { idStudent } = req.params;
  const student = await prisma.schoolStudent.findUnique({
    where: {
      id: idStudent,
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

module.exports = {
  addNewStudent,
  getAllStudents,
  getOneStudent,
  getStudentsFromParent,
};
