const { PrismaClient } = require("@prisma/client");
const { user } = new PrismaClient();

async function authMiddleware(req, res, next) {
  // Vérifier si l'utilisateur est authentifié
  if (req.isAuthenticated()) {
    return next();
  }

  // Si l'utilisateur n'est pas authentifié, renvoyer une erreur
  return res.status(401).json({
    message: "Accès refusé ! Utilisateur non connecté.",
    isAuthenticated: false,
  });
}

module.exports = {
  authMiddleware,
};
