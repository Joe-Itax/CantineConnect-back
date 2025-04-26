const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Planifie un job toutes les 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log(`[${new Date().toISOString()}] 🔄 Pinging DB to stay alive...`);
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[${new Date().toISOString()}] ✅ DB is alive!`);
  } catch (err) {
    console.error("🔥 Error while pinging DB:", err);
  }
});
