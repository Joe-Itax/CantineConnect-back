const { Router } = require("express");
const {
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
} = require("../controllers/students.controller");

const hasRole = require("../middlewares/role.middleware");
const { authMiddleware } = require("../middlewares/auth.middleware");
const {
  checkSubscriptionExpirationMiddleware,
} = require("../middlewares/checkSubscriptionExpiration.middleware");

const studentsRouter = Router();

// === ENROLLED STUDENTS (Élèves inscrits à l'école, pas encore à la cantine) ===

// Lister tous les élèves inscrits
studentsRouter.get(
  "/enrolled",
  authMiddleware,
  hasRole("admin"),
  getAllEnrolledStudents
);

// Chercher un élève par recherche (name, matricule, etc.)
studentsRouter.get(
  "/enrolled/search",
  authMiddleware,
  hasRole("admin"),
  searchEnrolledStudent
);

// Obtenir les détails d'un élève inscrit
studentsRouter.get(
  "/enrolled/:enrolledStudentId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getEnrolledStudentById
);

// Modifier les détails d'un élève inscrit
studentsRouter.put(
  "/enrolled/:enrolledStudentId",
  authMiddleware,
  hasRole("admin"),
  updateEnrolledStudent
);

// === CANTEEN STUDENTS (Élèves enregistrés à la cantine) ===

// Lister tous les élèves enregistrés à la cantine
studentsRouter.get(
  "/canteen",
  authMiddleware,
  hasRole("admin"),
  getAllCanteenStudents
);

// Enregistrer un élève à la cantine
studentsRouter.post(
  "/canteen",
  authMiddleware,
  hasRole("admin"),
  addNewCanteenStudent
);

// Réinscrire un élève à la cantine
studentsRouter.post(
  "/canteen/re-register/:canteenStudentId",
  authMiddleware,
  hasRole("admin"),
  reRegisterStudentToCanteen
);

// Désinscrire un élève de la cantine
studentsRouter.delete(
  "/canteen",
  authMiddleware,
  hasRole("admin"),
  removeStudentsFromCanteen
);

// Obtenir les élèves liés à un parent
studentsRouter.get(
  "/canteen/by-parent/:parentId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getCanteenStudentsLinkedToAParent
);

// === ABONNEMENTS ===

// Acheter un abonnement pour un élève
studentsRouter.post(
  "/canteen/:canteenStudentId/subscription",
  authMiddleware,
  hasRole(["parent", "admin"]),
  checkSubscriptionExpirationMiddleware,
  buySubscriptionForACanteenStudent
);

// === SCAN QR CODE ===

// Scanner le QR code d’un élève
studentsRouter.post(
  "/canteen/scan",
  authMiddleware,
  hasRole(["admin", "agent"]),
  scanQRCodeForACanteenStudent
);

// === NOTIFICATIONS ===

// Récupérer les notifs d’un élève
studentsRouter.get(
  "/canteen/:canteenStudentId/notifications",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getAllNotifOfAcanteenStudent
);

// Marquer toutes les notifs comme lues
studentsRouter.patch(
  "/canteen/:canteenStudentId/notifications",
  authMiddleware,
  hasRole(["admin", "parent"]),
  markAllNotifsAsRead
);

// Marquer une notif spécifique comme lue
studentsRouter.patch(
  "/canteen/:canteenStudentId/notifications/:notificationId",
  authMiddleware,
  hasRole(["admin", "parent"]),
  markOneNotifAsRead
);

// === HISTORIQUE DES REPAS ===

// Obtenir l’historique des repas
studentsRouter.get(
  "/canteen/:canteenStudentId/meal-history",
  authMiddleware,
  hasRole(["admin", "parent"]),
  getMealHistory
);

module.exports = studentsRouter;
