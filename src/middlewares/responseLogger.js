// function responseLogger(req, res, next) {
//     const originalSend = res.send;
  
//     res.send = function (body) {
//       console.log("----------- REPONSE ENVOYEE -----------");
//       console.log("URL:", req.originalUrl);
//       console.log("session: ", req.session);
//       console.log("Status:", res.statusCode);
//       console.log("Headers:", res.getHeaders());
//       console.log("Body:", typeof body === "object" ? JSON.stringify(body) : body);
//       console.log("----------------------------------------");
  
//       return originalSend.call(this, body);
//     };
  
//     next();
//   }
  
//   module.exports = responseLogger;
  