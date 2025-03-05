const passport = require("passport");
const { Strategy, ExtractJwt } = require("passport-jwt");
const { PrismaClient } = require("@prisma/client");
const { user } = new PrismaClient();

const cookieExtractor = function (req) {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies.jwt;
  }
  return token;
};

const opts = {
  jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new Strategy(opts, async function (jwt_payload, done) {
    try {
      const userReq = user.findUnique({
        where: {
          email: jwt_payload.email,
        },
      });
      if (userReq) {
        return done(null, userReq);
      }
    } catch (error) {
      done(error);
    }
  })
);
