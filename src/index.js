require("dotenv").config();

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const cookieParser = require("cookie-parser");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const { RedisStore } = require("connect-redis");
const { createClient } = require("redis");

const {
  authBaseURI,
  usersBaseURI,
  studentsBaseURI,
} = require("./config/path.config");
const {
  authRouter,
  usersRouter,
  studentsRouter,
} = require("./routes/index.routes");
const { serialiseDeserialiseUser } = require("./utils");

const prismaErrorHandler = require("./middlewares/prismaErrorHandler.middleware");

/**
 * ------------------  GENERAL SETUP  ---------------
 */
const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  `http://localhost:${PORT}`,
  `http://localhost:3000`,
  `http://localhost:3001`,
  `https://cantine-connect-dashboard.vercel.app/`,
  `https://cantine-connect.vercel.app/`
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
  exposedHeaders: ['set-cookie', 'x-auth-token'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Set-Cookie'
    ],
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
// Initialize client.
let redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.log("Trop de tentatives de reconnexion, abandon...");
        return new Error("Trop de tentatives de reconnexion");
      }
      // Attendre 30 seconde avant de réessayer
      return 30000;
    },
    connectTimeout: 30000, // 30 secondes
    tls: process.env.NODE_ENV === "production",
    rejectUnauthorized: false, // Désactivation de la validation du certificat
  },
});
(async () => {
  try {
    await redisClient.connect();
    console.log("Redis client connecté");
  } catch (err) {
    console.log("Redis client non connecté");
    console.error(err);
  }
})();

redisClient.on("error", (err) => {
  console.error("Erreur Redis:", err);
});

redisClient.on("reconnecting", () => {
  console.log("Reconnexion à Redis...");
});

redisClient.on("end", () => {
  console.log("Connexion Redis fermée");
});

// Initialize store.
let redisStore = new RedisStore({
  client: redisClient,
  prefix: "cantine-connect:",
});
app.use(
  session({
    name: "connect.sid",
    store: redisStore,
    secret: process.env.SESSION_SECRET, // Clé secrète pour signer les cookies
    resave: false, // Ne pas sauvegarder la session si elle n'est pas modifiée
    saveUninitialized: false, // Ne pas créer de session pour les requêtes sans données de session
    cookie: {
      httpOnly: true, // Empêche l'accès au cookie via JavaScript (protection XSS)
      secure: process.env.NODE_ENV === "production", // Activer en HTTPS (prod)
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // Durée de vie du cookie (7 jours)
    },
  })
);
// Passer l'instance d'Express aux contrôleurs
// const { checkAuthStatus } = require("./controllers/auth.controllers");
// app.get("/status", checkAuthStatus);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ["query", "info", "warn", "error"],
});

/**
 * -------------- PASSPORT AUTHENTICATION ----------------
 */

app.use(passport.initialize());
app.use(passport.session());
// Configuration de la stratégie locale (email + mot de passe)
require("./config/passport-strategies/local");
serialiseDeserialiseUser(passport);

require("./utils/dbKeepAlive");

/**
 * -------------- ROUTES ----------------
 */

app.get("/", (req, res) => {
  res.send("Hello, la racine de l'app Cantine Connect");
});

app.use(authBaseURI, authRouter);
app.use(usersBaseURI, usersRouter);
app.use(studentsBaseURI, studentsRouter);

/**
 * Middleware d’erreur Prisma
 */
app.use(prismaErrorHandler);

/**
 * -------------- RUN SERVER ----------------
 */
app.listen(PORT, () => {
  console.log(`The server listens on http://localhost:${PORT}`);
});
