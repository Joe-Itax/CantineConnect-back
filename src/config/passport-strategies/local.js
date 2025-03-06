const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { PrismaClient } = require("@prisma/client");
const { comparePassword } = require("../../utils/helper");
const { user } = new PrismaClient();

// Configuration de la stratégie locale (email + mot de passe)
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const userData = await user.findUnique({ where: { email } });

        if (
          !userData ||
          !(await comparePassword(password, userData.password))
        ) {
          return done(null, false, { message: "Identifiants incorrects." });
        }

        return done(null, userData);
      } catch (error) {
        return done(error);
      }
    }
  )
);
