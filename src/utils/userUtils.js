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

function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

module.exports = {
  serialiseDeserialiseUser,
  removeAccents,
};
