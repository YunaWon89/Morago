import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./openapi.js";

export const swaggerRouter = Router();

swaggerRouter.get("/openapi.json", (_req, res) => {
  res.json(openapi);
});

swaggerRouter.use("/", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "MORAGO API" }));
