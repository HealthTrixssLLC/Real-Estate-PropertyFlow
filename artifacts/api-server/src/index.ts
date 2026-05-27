import app from "./app";
import { logger } from "./lib/logger";
import { loadAiConfigFromDb } from "./lib/aiConfig";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";
import { geocodeMissingProperties } from "./routes/properties";
import { isGeocodeAvailable } from "./lib/geocode";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminUser() {
  const adminUsername = "admin";
  const adminPassword = "Admin123!";
  const passwordHash = await hashPassword(adminPassword);

  await db
    .insert(usersTable)
    .values({
      username: adminUsername,
      passwordHash,
      role: "admin",
      firstName: "Admin",
      lastName: null,
      email: null,
      isSystemAccount: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: usersTable.username,
      set: {
        passwordHash,
        role: "admin",
        isSystemAccount: true,
        isActive: true,
      },
    });

  logger.info("Admin user seeded");
}

async function batchGeocodeOnStartup() {
  if (!isGeocodeAvailable()) {
    logger.info("Skipping startup batch geocode: no Google Maps API key configured");
    return;
  }
  logger.info("Starting background batch geocode for properties missing coordinates");
  try {
    const result = await geocodeMissingProperties();
    logger.info(result, "Startup batch geocode complete");
  } catch (err) {
    logger.warn({ err }, "Startup batch geocode failed");
  }
}

loadAiConfigFromDb().then(async () => {
  await seedAdminUser();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    void batchGeocodeOnStartup();
  });
});
