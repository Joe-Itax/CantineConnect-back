const { PrismaClient } = require("@prisma/client");
const { paginationQuery, hashValue } = require("../utils");
const { removeAccents } = require("../utils/userUtils");
const prisma = new PrismaClient();

const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const validRoles = ["admin", "agent", "parent"];

// ✅ Créer un utilisateur
async function addNewUser(req, res) {
  const {
    email,
    password = process.env.DEFAULT_PASSWORD_USER,
    role,
    name,
    ...extraFields
  } = req.body;

  // 🎪 Anti-cirque
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'email', 'password', 'role', 'name' sont autorisés.",
    });
  }

  if (!email || !password || !role || !name) {
    return res.status(400).json({
      message: "Tous les champs sont obligatoires.",
    });
  }

  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: "Rôle invalide." });
  }

  if (!emailValid.test(email)) {
    return res.status(400).json({ message: "Email invalide." });
  }

  if (!passwordValid.test(password)) {
    return res.status(400).json({
      message:
        "Mot de passe invalide. Minimum 8 caractères, majuscule, minuscule, chiffre, symbole.",
    });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email } });

      if (existingUser) {
        throw new Error("Un utilisateur avec cet email existe déjà.");
      }

      const newUser = await tx.user.create({
        data: {
          email,
          password: await hashValue(password),
          role,
          name,
          searchableName: removeAccents(name),
        },
      });

      if (newUser.role === "parent") {
        await tx.parent.create({
          data: {
            id: newUser.id,
          },
        });
      }

      return newUser;
    });

    delete user.password;

    return res.status(201).json({
      message: "Utilisateur créé avec succès.",
      user,
    });
  } catch (error) {
    console.error("Erreur création utilisateur:", error);
    return res.status(500).json({
      message: error.message || "Erreur serveur lors de la création.",
    });
  }
}

// ✅ Lire tous les utilisateurs
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
      },
    });

    return res
      .status(200)
      .json({ message: "Liste des utilisateurs", ...result });
  } catch (error) {
    console.error("Erreur récupération utilisateurs:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

// ✅ Lire un utilisateur par ID
async function getUserById(req, res) {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Erreur getUserById:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

// ✅ Modifier un utilisateur (email, name, password, role)
async function updateUser(req, res) {
  const { userId } = req.params;
  const { ...rest } = req.body;

  const allowedFields = ["email", "name", "password", "role"];
  const unknownFields = Object.keys(rest).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      message: `Champs non autorisés: ${unknownFields.join(", ")}`,
    });
  }

  const dataToUpdate = {};

  for (const key of allowedFields) {
    if (rest[key] !== undefined) {
      if (key === "password") {
        if (!passwordValid.test(rest[key])) {
          return res.status(400).json({
            message:
              "Mot de passe invalide. 8+ caractères, majuscule, minuscule, chiffre, symbole.",
          });
        }
        dataToUpdate.password = await hashValue(rest[key]);
      }
      if (key === "role") {
        if (!validRoles.includes(rest[key])) {
          return res.status(400).json({ message: "Rôle invalide." });
        }
      }
      if (key === "name") {
        dataToUpdate.name = rest[key];
        dataToUpdate.searchableName = removeAccents(rest[key]);
      } else {
        dataToUpdate[key] = rest[key];
      }
    }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({ message: "Aucun champ à mettre à jour." });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "Utilisateur mis à jour avec succès.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Erreur updateUser:", error);
    // Gérer erreur Prisma: P2002 (conflit unique)
    if (
      error.code === "P2002" &&
      error.meta &&
      error.meta.target &&
      error.meta.target.includes("email")
    ) {
      return res.status(400).json({
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      });
    }

    return res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de l'utilisateur.",
    });
  }
}

// ✅ Supprimer un utilisateur
async function deleteUser(req, res) {
  const { userId } = req.params;

  try {
    await prisma.user.delete({ where: { id: userId } });
    return res
      .status(200)
      .json({ message: "Utilisateur supprimé avec succès." });
  } catch (error) {
    console.error("Erreur suppression utilisateur:", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
}

// ✅ Rechercher un utilisateur par email ou nom
async function searchUser(req, res) {
  try {
    const { query, page, limit } = req.query;
    if (!query) {
      return res.status(400).json({
        message: "Veuillez fournir une requête de recherche.",
      });
    }

    const result = await paginationQuery(prisma.user, page, limit, {
      where: {
        OR: [
          {
            searchableName: {
              contains: removeAccents(query),
              mode: "insensitive",
            },
          },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
    });

    // Delete password from result
    result.data = result.data.map((user) => {
      const { password, searchableName, ...rest } = user;
      return rest;
    });

    return res.status(200).json({
      message: "Liste des utilisateurs trouvés",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la recherche des utilisateurs :", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de la recherche des utilisateurs.",
    });
  }
}

module.exports = {
  addNewUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  searchUser,
};
