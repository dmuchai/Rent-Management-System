import type { Request, Response, NextFunction } from "express";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://landee.kejalink.co.ke",
  "https://property-manager-ke.vercel.app",
  "https://rent-management-system-chi.vercel.app",
  "https://rent-management-system-bblda265x-dmmuchai-1174s-projects.vercel.app",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin as string)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With, Cookie"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
}
