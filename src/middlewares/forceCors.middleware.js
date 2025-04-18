const allowedOrigins = [
    `http://localhost:4000`,
    `http://localhost:3000`,
    `http://localhost:3001`,
    `https://cantine-connect-dashboard.vercel.app`,
    `https://cantine-connect.vercel.app`
];
  
function forceCors(req, res, next) {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept, Set-Cookie"
        );
    }

    if (req.method === "OPTIONS") {
        // Pour régler les préflight CORS immédiatement
        return res.status(200).end();
    }

    next();
}
  
  module.exports = { forceCors };
  