import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import buyersRouter from "./buyers";
import propertiesRouter from "./properties";
import toursRouter from "./tours";
import tourStopsRouter from "./tourStops";
import showingsRouter from "./showings";
import voiceNotesRouter from "./voiceNotes";
import debriefVoiceNotesRouter from "./debriefVoiceNotes";
import adminRouter from "./admin";
import storageRouter from "./storage";
import listingAgentContactsRouter from "./listingAgentContacts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(buyersRouter);
router.use(propertiesRouter);
router.use(toursRouter);
router.use(tourStopsRouter);
router.use(showingsRouter);
router.use(voiceNotesRouter);
router.use(debriefVoiceNotesRouter);
router.use(adminRouter);
router.use(listingAgentContactsRouter);

export default router;
