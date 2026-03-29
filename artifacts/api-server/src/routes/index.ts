import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import buyersRouter from "./buyers";
import toursRouter from "./tours";
import tourStopsRouter from "./tourStops";
import showingsRouter from "./showings";
import voiceNotesRouter from "./voiceNotes";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(buyersRouter);
router.use(toursRouter);
router.use(tourStopsRouter);
router.use(showingsRouter);
router.use(voiceNotesRouter);
router.use(adminRouter);

export default router;
