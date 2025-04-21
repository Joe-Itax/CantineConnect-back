const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { paginationQuery, hashValue } = require("../utils");

// Regex pour valider l'email et le mot de passe
const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// Liste des rôles valides
const validRoles = ["admin", "agent"];

// Add new user Admin or Agent
async function addNewUser(req, res) {
  const { email, password, role, name, ...extraFields } = req.body;
  // Vérification qu'il n'y a pas de champs supplémentaires
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message:
        "Seuls 'email', 'password', 'role' et 'name' sont autorisés dans la requête.",
    });
  }
  if (!email || !password || !role || !name) {
    return res.status(400).json({
      message: "Veuillez fournir l'email, le password, le role et le name.",
    });
  }
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
  userReq.password = await hashValue(userReq.password);

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

    // Créeation de l'utilisateur
    const user = await prisma.user.create({
      data: userReq,
    });

    // Si le rôle est "parent", créer également un enregistrement dans la table Parent
    // let parent = null;
    // if (userReq.role === "parent") {
    //   parent = await prisma.parent.create({
    //     data: {
    //       id: user.id,
    //     },
    //     include: {
    //       user: true,
    //     },
    //   });
    // }

    //   return { user };
    // });

    // Suppression le mot de passe avant de renvoyer la réponse
    delete user.password;

    // if (userReq.role === "parent") {
    //   delete newUser.parent.user.password;
    //   return res.status(200).json({
    //     user: newUser.parent.user,
    //   });
    // }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la création de l'utilisateur.",
    });
  }
}

async function getAllUsers(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await paginationQuery(prisma.user, page, limit, {
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        parent: true,
      }
    });

    if (result.error) {
      return res.status(400).json({
        message: result.error,
        ...result,
      });
    }

    return res.status(200).json({
      message: "Liste des utilisateurs",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs :", error);
    return res.status(500).json({
      message:
        "Une erreur est survenue lors de la récupération des utilisateurs.",
    });
  }
}

module.exports = {
  addNewUser,
  getAllUsers,
};
