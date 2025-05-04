const { paginationQuery, hashValue } = require("../utils");
const { removeAccents } = require("../utils/userUtils");
const { prisma } = require("../lib/prisma");

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

  // Validation des champs
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seuls 'email', 'password', 'role', 'name' sont autorisés.",
    });
  }

  // Validation des valeurs
  if (!email || !role || !name) {
    return res.status(400).json({
      message:
        "Tous les champs obligatoires (email, role & name) doivent être fournis.",
    });
  }

  // Validation des types
  const validationErrors = [];
  if (typeof name !== "string") validationErrors.push("Nom invalide");
  if (typeof email !== "string") validationErrors.push("Email invalide");
  if (typeof password !== "string")
    validationErrors.push("Mot de passe invalide");
  if (typeof role !== "string") validationErrors.push("Rôle invalide");

  if (validationErrors.length > 0) {
    return res
      .status(400)
      .json({ message: "Erreurs de validation", errors: validationErrors });
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
        "Mot de passe invalide. 8+ caractères, majuscule, minuscule, chiffre, symbole.",
    });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Vérification de l'unicité de l'email
      const existingUser = await tx.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUser) {
        throw new Error("Un utilisateur actif avec cet email existe déjà.");
      }

      // Création de l'utilisateur
      const newUser = await tx.user.create({
        data: {
          email,
          password: await hashValue(password),
          role,
          name: name.trim(),
          searchableName: removeAccents(name.trim()),
        },
      });

      // Création du parent si nécessaire
      if (newUser.role === "parent") {
        await tx.parent.create({
          data: {
            id: newUser.id,
          },
        });
      }

      return newUser;
    });

    // Préparation de la réponse
    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(201).json({
      message: "Utilisateur créé avec succès.",
      user: userResponse,
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
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res
      .status(200)
      .json({ message: "Liste des utilisateurs", ...result });
  } catch (error) {
    console.error("Erreur récupération utilisateurs:", error);
    return res.status(500).json({
      message: "Erreur serveur.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
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
        isActive: true,
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
    return res.status(500).json({
      message: "Erreur serveur.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ✅ Modifier un utilisateur (email, name, password, role)
async function updateUser(req, res) {
  const { userId } = req.params;
  const { ...rest } = req.body;

  // Champs autorisés
  const allowedFields = ["email", "name", "password", "role", "isActive"];
  const unknownFields = Object.keys(rest).filter(
    (key) => !allowedFields.includes(key)
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      message: `Champs non autorisés: ${unknownFields.join(", ")}`,
    });
  }

  // Validation du type des valeurs
  const typeErrors = [];
  if (rest.name !== undefined && typeof rest.name !== "string") {
    typeErrors.push("Le nom doit être une chaîne de caractères");
  }
  if (rest.email !== undefined && typeof rest.email !== "string") {
    typeErrors.push("L'email doit être une chaîne de caractères");
  }
  if (rest.password !== undefined && typeof rest.password !== "string") {
    typeErrors.push("Le mot de passe doit être une chaîne de caractères");
  }
  if (rest.isActive !== undefined && typeof rest.isActive !== "boolean") {
    typeErrors.push("isActive doit être un booléen");
  }

  if (typeErrors.length > 0) {
    return res.status(400).json({
      message: "Erreurs de validation",
      errors: typeErrors,
    });
  }

  const dataToUpdate = {};

  for (const key of allowedFields) {
    if (rest[key] !== undefined) {
      switch (key) {
        case "password":
          if (!passwordValid.test(rest[key])) {
            return res.status(400).json({
              message:
                "Mot de passe invalide. 8+ caractères, majuscule, minuscule, chiffre, symbole.",
            });
          }
          dataToUpdate.password = await hashValue(rest[key]);
          break;

        case "role":
          if (!validRoles.includes(rest[key])) {
            return res.status(400).json({ message: "Rôle invalide." });
          }
          dataToUpdate.role = rest[key];
          break;

        case "name":
          // Validation supplémentaire pour le nom
          if (rest[key].trim().length === 0) {
            return res
              .status(400)
              .json({ message: "Le nom ne peut pas être vide." });
          }
          dataToUpdate.name = rest[key].trim();
          dataToUpdate.searchableName = removeAccents(rest[key].trim());
          break;

        case "isActive":
          dataToUpdate.isActive = rest[key];
          break;

        default:
          dataToUpdate[key] = rest[key];
      }
    }
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({ message: "Aucun champ à mettre à jour." });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Gestion des Parents désactivés
    if (dataToUpdate.isActive === false && updatedUser.role === "PARENT") {
      await prisma.canteenStudent.updateMany({
        where: {
          parent: { userId: updatedUser.id },
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    return res.status(200).json({
      message: "Utilisateur mis à jour avec succès.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Erreur updateUser:", error);

    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res.status(400).json({
        message: "Cet email est déjà utilisé par un autre utilisateur.",
      });
    }

    return res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de l'utilisateur.",
    });
  }
}

// ✅ Supprimer un utilisateur (Soft Delete)
async function deleteUsers(req, res) {
  const { userIds, ...extraFields } = req.body;

  // Validation des données (inchangée)
  if (Object.keys(extraFields).length > 0) {
    return res.status(400).json({
      message: "Seul 'userIds' est autorisé.",
    });
  }

  if (!Array.isArray(userIds)) {
    return res.status(400).json({
      message: "Le corps de la requête doit contenir un tableau 'userIds'.",
    });
  }

  if (userIds.length === 0) {
    return res.status(400).json({
      message: "Aucun identifiant d'utilisateur fourni.",
    });
  }

  // Validation des IDs
  const invalidIds = userIds.filter(
    (id) => typeof id !== "string" || !id.trim()
  );
  if (invalidIds.length > 0) {
    return res.status(400).json({
      message: `IDs invalides: ${invalidIds.join(", ")}`,
    });
  }

  try {
    const deactivatedUsers = [];
    const deactivatedStudents = [];

    await prisma.$transaction(async (tx) => {
      for (const id of userIds) {
        const user = await tx.user.findFirst({
          where: {
            id,
            isActive: true,
          },
          include: {
            parent: {
              include: {
                canteenStudents: {
                  where: { isActive: true },
                  select: { id: true },
                },
              },
            },
          },
        });

        if (!user) continue;

        // 1. Désactiver les élèves de cantine pour les parents
        if (
          user.role === "parent" &&
          user.parent?.canteenStudents?.length > 0
        ) {
          await tx.canteenStudent.updateMany({
            where: {
              id: {
                in: user.parent.canteenStudents.map((s) => s.id),
              },
            },
            data: { isActive: false },
          });

          deactivatedStudents.push(
            ...user.parent.canteenStudents.map((s) => s.id)
          );
        }

        // 2. Désactiver l'utilisateur (soft delete)
        await tx.user.update({
          where: { id },
          data: { isActive: false },
        });

        deactivatedUsers.push({
          id: user.id,
          name: user.name,
          role: user.role,
        });
      }
    });

    if (deactivatedUsers.length === 0) {
      return res.status(404).json({
        message:
          "Aucun utilisateur actif trouvé avec les identifiants fournis.",
      });
    }

    const userCount = deactivatedUsers.length;
    const studentCount = deactivatedStudents.length;

    const userNames = deactivatedUsers
      .map((u) => `${u.name} (${u.role})`)
      .join(", ");

    let message = `${userCount} utilisateur${
      userCount > 1 ? "s" : ""
    } désactivé${userCount > 1 ? "s" : ""}: ${userNames}`;

    if (studentCount > 0) {
      message += ` et ${studentCount} élève${
        studentCount > 1 ? "s" : ""
      } de cantine désactivé${studentCount > 1 ? "s" : ""}`;
    }

    console.log("Soft delete effectué:", message);

    return res.status(200).json({
      message,
      deactivatedUsers,
      deactivatedStudents: studentCount > 0 ? deactivatedStudents : undefined,
    });
  } catch (error) {
    console.error("Erreur lors de la désactivation des utilisateurs:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// ✅ Rechercher un utilisateur par email ou nom
async function searchUser(req, res) {
  try {
    const { query, page, limit } = req.query;
    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Veuillez fournir une requête de recherche.",
      });
    }

    const cleanedQuery = query.trim();
    if (cleanedQuery.length < 1) {
      return res.status(400).json({
        message: "La requête doit contenir au moins 1 caractère.",
      });
    }

    const result = await paginationQuery(prisma.user, page, limit, {
      where: {
        OR: [
          {
            searchableName: {
              contains: removeAccents(cleanedQuery),
              mode: "insensitive",
            },
          },
          { email: { contains: cleanedQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Delete password from result
    result.data = result.data.map((user) => {
      const { password, searchableName, ...rest } = user;
      return rest;
    });

    return res.status(200).json({
      message: "Résultats de la recherche",
      ...result,
    });
  } catch (error) {
    console.error("Erreur lors de la recherche des utilisateurs :", error);
    return res.status(500).json({
      message: "Erreur lors de la recherche.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  addNewUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUsers,
  searchUser,
};
