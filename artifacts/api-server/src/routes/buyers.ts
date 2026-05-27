import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, buyersTable, toursTable, tourStopsTable, propertiesTable, showingRequestsTable, voiceNotesTable } from "@workspace/db";
import { CreateBuyerBody, UpdateBuyerBody } from "@workspace/api-zod";
import { idParams, parseParams, parseBody } from "../lib/validate";
import { sendValidated, BuyerResponseSchema, BuyerListResponseSchema, BuyerDetailResponseSchema } from "../lib/responseSchemas";

const router: IRouter = Router();

router.get("/buyers", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  try {
    const buyers = await db
      .select()
      .from(buyersTable)
      .where(eq(buyersTable.agentId, user.id))
      .orderBy(buyersTable.createdAt);
    sendValidated(res, BuyerListResponseSchema, { buyers });
  } catch (err) {
    req.log.error({ err }, "Failed to list buyers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/buyers", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const body = parseBody(CreateBuyerBody, req, res);
  if (!body) return;
  try {
    const [buyer] = await db
      .insert(buyersTable)
      .values({ id: randomUUID(), agentId: user.id, ...body })
      .returning();
    sendValidated(res, BuyerResponseSchema, { buyer }, 201);
  } catch (err) {
    req.log.error({ err }, "Failed to create buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [buyer] = await db
      .select()
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    sendValidated(res, BuyerResponseSchema, { buyer });
  } catch (err) {
    req.log.error({ err }, "Failed to get buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  const body = parseBody(UpdateBuyerBody, req, res);
  if (!body) return;
  try {
    const [existing] = await db
      .select({ id: buyersTable.id })
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    const [buyer] = await db
      .update(buyersTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(buyersTable.id, params.buyerId))
      .returning();
    sendValidated(res, BuyerResponseSchema, { buyer });
  } catch (err) {
    req.log.error({ err }, "Failed to update buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/buyers/:buyerId/detail", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [buyer] = await db
      .select()
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!buyer) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }

    const tours = await db
      .select()
      .from(toursTable)
      .where(and(eq(toursTable.buyerId, params.buyerId), eq(toursTable.agentId, user.id)))
      .orderBy(toursTable.date);

    const tourDetails = await Promise.all(
      tours.map(async (tour) => {
        const stops = await db
          .select()
          .from(tourStopsTable)
          .where(eq(tourStopsTable.tourId, tour.id))
          .orderBy(tourStopsTable.sequence);

        const stopsWithData = await Promise.all(
          stops.map(async (stop) => {
            const [property] = await db
              .select()
              .from(propertiesTable)
              .where(eq(propertiesTable.id, stop.propertyId));

            const [showingReq] = await db
              .select()
              .from(showingRequestsTable)
              .where(eq(showingRequestsTable.tourStopId, stop.id));

            const voiceNotes = await db
              .select()
              .from(voiceNotesTable)
              .where(eq(voiceNotesTable.tourStopId, stop.id))
              .orderBy(voiceNotesTable.createdAt);

            const comments = voiceNotes
              .filter((vn) => {
                if (vn.fileUrl && vn.fileUrl !== "") {
                  return vn.transcriptionStatus === "completed" && vn.typedNote;
                }
                return !!vn.typedNote;
              })
              .map((vn) => ({
                id: vn.id,
                text: vn.typedNote ?? "",
                isVoiceNote: !!(vn.fileUrl && vn.fileUrl !== ""),
                transcriptionStatus: vn.transcriptionStatus,
                createdAt: vn.createdAt,
              }));

            return {
              id: stop.id,
              tourId: stop.tourId,
              propertyId: stop.propertyId,
              sequence: stop.sequence,
              formattedAddress: property?.formattedAddress ?? "",
              propertyNickname: property?.nickname ?? null,
              listPrice: property?.listPrice ?? null,
              beds: property?.beds ?? null,
              baths: property?.baths ?? null,
              squareFeet: property?.squareFeet ?? null,
              approvedStatus: stop.approvedStatus,
              showingStatus: showingReq?.status ?? null,
              skipped: stop.skipped,
              skipReason: stop.skipReason ?? null,
              skipNotes: stop.skipNotes ?? null,
              visited: stop.visited,
              arrivalTime: stop.arrivalTime ?? null,
              departureTime: stop.departureTime ?? null,
              overallFitRating: stop.overallFitRating ?? null,
              buyerInterest: stop.buyerInterest ?? null,
              kitchenRating: stop.kitchenRating ?? null,
              primarySuiteRating: stop.primarySuiteRating ?? null,
              backyardRating: stop.backyardRating ?? null,
              roadNoiseRating: stop.roadNoiseRating ?? null,
              followUpFlag: stop.followUpFlag,
              revisitFlag: stop.revisitFlag,
              quickTags: stop.quickTags ?? null,
              comments,
              createdAt: stop.createdAt,
              updatedAt: stop.updatedAt,
            };
          })
        );

        return {
          id: tour.id,
          title: tour.title ?? "",
          date: tour.date ?? "",
          status: tour.status,
          stops: stopsWithData,
          createdAt: tour.createdAt,
          updatedAt: tour.updatedAt,
        };
      })
    );

    sendValidated(res, BuyerDetailResponseSchema, { buyer, tours: tourDetails });
  } catch (err) {
    req.log.error({ err }, "Failed to get buyer detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/buyers/:buyerId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = (req as Express.AuthedRequest).user;
  const params = parseParams(idParams.buyerId, req, res);
  if (!params) return;
  try {
    const [existing] = await db
      .select({ id: buyersTable.id })
      .from(buyersTable)
      .where(and(eq(buyersTable.id, params.buyerId), eq(buyersTable.agentId, user.id)));
    if (!existing) {
      res.status(404).json({ error: "Buyer not found" });
      return;
    }
    await db.delete(buyersTable).where(eq(buyersTable.id, params.buyerId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete buyer");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
