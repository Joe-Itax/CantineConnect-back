const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const serialiseDeserialiseUser = async (passport) => {
  passport.serializeUser(async (user, done) => {
    done(null, user.email);
  });

  passport.deserializeUser(async (email, done) => {
    try {
      const userData = await prisma.user.findUnique({ where: { email } });
      done(null, userData);
    } catch (error) {
      done(error);
    }
  });
};

module.exports = {
  serialiseDeserialiseUser,
};

/*
//Generer des fakes data des élèves de l'école
const { fakerFR: faker } = require("@faker-js/faker");
const fs = require("fs");

// Options de classes et niveaux
const niveaux = [
  "7ème Générale",
  "8ème Générale",
  "1ère Humanités",
  "2ème Humanités",
  "3ème Humanités",
  "4ème Humanités",
];
const options = [
  "Coupe et Couture",
  "Menuiserie",
  "Électricité",
  "Mécanique Auto",
  "Sciences Commerciales",
  "Sciences Sociales",
];
const genders = ["F", "M"];

// Fonction pour générer un élève
function generateStudent(i) {
  const niveau = faker.helpers.arrayElement(niveaux); // Utiliser faker.helpers.arrayElement
  const option = niveau.includes("Générale")
    ? ""
    : faker.helpers.arrayElement(options);
  const classe = `${niveau}${option ? " " + option : ""}`;

  const gender = faker.helpers.arrayElement(genders);

  return {
    name: faker.person.fullName(),
    class: classe,
    gender: gender,
    matricule: `2025/${i}`,
  };
}

// Générer 100 élèves
const studentsToGenerate = [];
for (let i = 1; i <= 100; i++) {
  studentsToGenerate.push(generateStudent(i));
}
// Sauvegarder les données dans un fichier JSON
// fs.writeFileSync("students.json", JSON.stringify(studentsToGenerate, null, 2));
// console.log("Données des élèves générées et sauvegardées dans students.json");

// --------------------------------------------------
const students = require("../../students.json"); // Chargement les données générées
async function insertStudents() {
  try {
    // Insérer tous les élèves en une seule opération
    await prisma.schoolStudent.createMany({
      data: students.map((student) => ({
        name: student.name,
        class: student.class,
        gender: student.gender,
        matricule: student.matricule,
      })),
    });

    console.log("Tous les élèves ont été insérés avec succès.");
  } catch (error) {
    console.error("Erreur lors de l'insertion des élèves :", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Génération des fake data des élèves
 insertStudents();
*/
