const helmet = require("helmet");

async function securityMiddleware () {
  return [
    // Protection basique des headers HTTP
    helmet(),

    // Limitation de la taille des payloads JSON (1 Mo max)
    (req, res, next) => {
      express.json({ limit: "1mb" })(req, res, next);
    },

    // Limitation de la taille des payloads URL Encoded aussi
    (req, res, next) => {
      express.urlencoded({ extended: true, limit: "1mb" })(req, res, next);
    },

    // Middleware pour forcer HTTPS en prod
    (req, res, next) => {
      if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
        return res.redirect(`https://${req.headers.host}${req.url}`);
      }
      next();
    },

    // Logger d'erreurs server 500+
    (err, req, res, next) => {
      if (res.headersSent) {
        return next(err);
      }
      if (err.status >= 500) {
        console.error("[SERVER ERROR]", {
          method: req.method,
          url: req.url,
          body: req.body,
          error: err.message,
        });
      }
      next(err);
    },
  ];
}

module.exports = securityMiddleware