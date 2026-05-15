import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import framesRouter from "./frames";
import layersRouter from "./layers";
import exportsRouter from "./exports";
import audioRouter from "./audio";
import statsRouter from "./stats";
import collabRouter from "./collab";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/frames", framesRouter);
router.use("/projects/:projectId/layers", layersRouter);
router.use("/projects/:projectId/exports", exportsRouter);
router.use("/projects/:projectId/audio", audioRouter);
router.use("/stats", statsRouter);
router.use("/collab", collabRouter);

export default router;
