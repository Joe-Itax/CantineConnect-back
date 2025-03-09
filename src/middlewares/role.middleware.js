function hasRole(requiredRoles) {
  return (req, res, next) => {
    if (!Array.isArray(requiredRoles)) {
      requiredRoles = [requiredRoles]; // Convertir en tableau si ce n'est pas déjà un
    }

    if (!req.user) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }
    if (!requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };
}

module.exports = hasRole;
