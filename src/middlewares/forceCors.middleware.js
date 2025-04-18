function forceCors(req, res, next) {
    const origin = req.headers.origin;
  
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept, Set-Cookie"
      );
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Set-Cookie, X-Auth-Token"
      );
    } else {
      console.log("[CORS-LOGGER] Requête sans origine (probablement interne ou serveur)");
    }
  
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
  
    next();
  }
  
  module.exports = forceCors;
  