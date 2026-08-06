import { Router as ExpressRouter } from "express";
import { v1Router } from "./rest.v1";

export const versionedRestRouter = ExpressRouter();

versionedRestRouter.use("/v1", v1Router);

versionedRestRouter.get("/versions", (_req, res) => {
  res.json({ versions: ["v1"], default: "v1" });
});
