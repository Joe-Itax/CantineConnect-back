const passport = require("passport");

async function loginUser(req, res, next) {
  req.session.regenerate((err) =>{
    if (err) {
      console.error("Erreur regenerate session:", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    if (req.isAuthenticated()) {
      console.log('User already authenticated, destroying old session...');
      req.logout((err) => {
        if (err) return next(err);
        req.session.destroy((err) => {
          if (err) return next(err);
          authenticateNow();
        });
      });
    } else {
      authenticateNow();
    }
  
    function authenticateNow() {
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          return res.status(500).json({ message: "Erreur serveur" });
        }
        if (!user) {
          return res.status(401).json({ message: info.message });
        }
        req.logIn(user, (err) => {
          if (err) {
            return res.status(500).json({ message: "Erreur serveur" });
          }
          req.session.save((err) => {
            if (err) {
              console.error("Erreur sauvegarde session:", err);
              return res.status(500).json({ message: "Erreur serveur" });
            }
            delete user.password;
            res.json({
              message: "Connexion réussie",
              isAuthenticated: true,
              user,
            });
          });
        });
      })(req, res, next);
    }
  })
  
}

async function logoutUser(req, res) {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }

    req.session.destroy((err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Erreur lors de la destruction de la session" });
      }

      res.clearCookie("connect.sid");
      res.json({ message: "Déconnexion réussie", isAuthenticated: false });
    });
  });
}

async function getUserState(req, res) {
  const user = req.user;
  delete user.password;
  res.json({ isAuthenticated: true, user: user });
}

module.exports = {
  loginUser,
  logoutUser,
  getUserState,
};
