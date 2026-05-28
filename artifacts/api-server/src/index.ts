import app from "./app";
import { logger } from "./lib/logger";
import { loadAiConfigFromDb } from "./lib/aiConfig";
import { db, usersTable, voiceNotesTable } from "@workspace/db";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { hashPassword } from "./lib/auth";
import { geocodeMissingProperties } from "./routes/properties";
import { isGeocodeAvailable } from "./lib/geocode";
import { runTranscriptionJob } from "./routes/voiceNotes";
import { isSpeechAiAvailable } from "./lib/ai";

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

async function resumeStuckTranscriptions() {
  if (!isSpeechAiAvailable()) {
    logger.info("Skipping stuck transcription recovery: no speech provider configured");
    return;
  }
  try {
    const stuck = await db
      .select()
      .from(voiceNotesTable)
      .where(
        and(
          inArray(voiceNotesTable.transcriptionStatus, ["pending", "in_progress"]),
          isNotNull(voiceNotesTable.fileUrl),
        ),
      );
    if (stuck.length === 0) {
      logger.info("No stuck voice notes to recover");
      return;
    }
    logger.info({ count: stuck.length }, "Resuming transcription for stuck voice notes");
    for (const note of stuck) {
      if (note.transcriptionStatus === "pending") {
        await db
          .update(voiceNotesTable)
          .set({ transcriptionStatus: "in_progress", updatedAt: new Date() })
          .where(eq(voiceNotesTable.id, note.id))
          .catch(() => {});
      }
      const noteId = note.id;
      const url = note.fileUrl!;
      setImmediate(() => {
        runTranscriptionJob(noteId, url, logger).catch(() => {});
      });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to resume stuck transcriptions");
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
    void resumeStuckTranscriptions();
  });
});
