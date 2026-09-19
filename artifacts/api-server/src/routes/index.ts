import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rentfasterRouter from "./rentfaster";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rentfasterRouter);

export default router;
