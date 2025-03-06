const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { hashPassword } = require("../utils/helper");

// Regex pour valider l'email et le mot de passe
const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// Liste des rôles valides
const validRoles = ["admin", "agent", "parent"];

// Add new user Admin or Agent
async function addNewUser(req, res) {
  const userReq = req.body;

  if (!validRoles.includes(userReq.role)) {
    return res.status(403).json({
      message: `Veuillez saisir un rôle valide (${validRoles.join(" || ")}).`,
    });
  }

  // Validation de l'email
  if (!emailValid.test(userReq.email)) {
    return res.status(403).json({
      message: `Veuillez saisir une adresse mail valide.`,
    });
  }

  // Validation du mot de passe
  if (!passwordValid.test(userReq.password)) {
    return res.status(403).json({
      message: `Veuillez saisir un mot de passe selon les critères (Au moins 8 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial).`,
    });
  }

  //Hasher le password
  userReq.password = await hashPassword(userReq.password);

  try {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: userReq.email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Un utilisateur avec cet email est déjà enregistré.",
      });
    }

    const newUser = await prisma.$transaction(async (prisma) => {
      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: userReq,
      });

      // Si le rôle est "parent", créer également un enregistrement dans la table Parent
      let parent = null;
      if (userReq.role === "parent") {
        parent = await prisma.parent.create({
          data: {
            id: user.id,
          },
          include: {
            user: true,
          },
        });
      }

      return { user, parent };
    });

    // Suppression le mot de passe avant de renvoyer la réponse
    delete newUser.user.password;

    if (userReq.role === "parent") {
      delete newUser.parent.user.password;
      return res.status(200).json({
        user: newUser.parent.user,
      });
    }
    return res.status(200).json({
      user: newUser.user,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la création de l'utilisateur.",
    });
  }
}

async function addNewStudent(req, res) {}

module.exports = {
  addNewUser,
  addNewStudent,
};
