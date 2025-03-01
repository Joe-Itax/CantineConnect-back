require("dotenv").config();

const express = require("express");
// const { PrismaClient } = require("@prisma/client");

const cookieParser = require("cookie-parser");
const cors = require("cors");
const passport = require("passport");
// const { authBaseURI } = require("./config/path.config");
// const { authRouter } = require("./routes/index.routes");

/**
 * ------------------  GENERAL SETUP  ---------------
 */
const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  `http://localhost:${PORT}`,
  `http://localhost:3000`,
  `http://localhost:3001`,
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not Allowed By CORS`, { cause: origin }));
    }
  },
  credentials: true, // Nécessaire pour utiliser des cookies avec CORS
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cookieParser());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Autorise les requêtes OPTIONS pour toutes les routes

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  res.header(
    "Access-Control-Allow-Headers",
    "x-access-token, Origin, Content-Type, Accept"
  );
  next();
});

// Servir des fichiers statiques depuis le répertoire 'uploads/images'
// app.use("/uploads/images", express.static("uploads/images"));

/**
 * -------------- SESSION SETUP ----------------
 */

// Passer l'instance d'Express aux contrôleurs
// const { checkAuthStatus } = require("./controllers/auth.controllers");
// app.get("/status", checkAuthStatus);

// const prisma = new PrismaClient({
//   datasources: {
//     db: {
//       url: process.env.DATABASE_URL,
//     },
//   },
//   log: ["query", "info", "warn", "error"],
// });

/**
 * -------------- PASSPORT AUTHENTICATION ----------------
 */

// require("./config/passport-strategies/jwt");
app.use(passport.initialize());

/**
 * -------------- ROUTES ----------------
 */

app.get("/", (req, res) => {
  res.send("Hello, la racine de l'app Etudify");
});

// app.use(authBaseURI, authRouter);

/**
 * -------------- RUN SERVER ----------------
 */
app.listen(PORT, () => {
  console.log(`The server listens on http://localhost:${PORT}`);
});
