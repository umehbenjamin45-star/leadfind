import app from "./app.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
}
app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("LEADFIND API ready on port 3001"),
);
