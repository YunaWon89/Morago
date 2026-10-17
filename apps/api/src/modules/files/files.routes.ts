import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../../config.js";
import { authenticateToken } from "../../lib/authenticate.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const uploadsDir = path.resolve(process.cwd(), config.uploadDir);
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, randomUUID() + (ALLOWED[file.mimetype] ?? "")),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, "Only JPG, PNG, WEBP images and PDF files are allowed"));
  },
});

export const filesRouter = Router();

const idSchema = z.object({ id: z.coerce.number().int().positive() });

async function saveFile(ownerId: number, file: Express.Multer.File) {
  return prisma.file.create({
    data: { ownerId, url: `/uploads/${file.filename}`, mimeType: file.mimetype },
    select: { id: true, url: true, mimeType: true },
  });
}

// Who may open a file:
// - an IMAGE that is used as a profile picture or as a category/theme icon is public
//   (<img src="/api/files/12"> cannot send an Authorization header);
// - every other file (certificates, PDFs, other pictures) only for its owner and for admins.
// Unknown and forbidden files both answer 404, so the numeric ID cannot be used to find other people's documents.
async function optionalUser(authorization: string | undefined) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  try {
    return await authenticateToken(token);
  } catch {
    return null;
  }
}

filesRouter.get("/:id", async (req, res) => {
  const { id } = idSchema.parse(req.params);
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw new HttpError(404, "File not found");

  const publicImage =
    file.mimeType.startsWith("image/") &&
    (await prisma.file.count({
      where: {
        id,
        OR: [{ userAvatars: { some: {} } }, { categories: { some: {} } }, { themes: { some: {} } }],
      },
    })) > 0;

  if (!publicImage) {
    const user = await optionalUser(req.headers.authorization);
    if (!user || (user.role !== "ADMIN" && file.ownerId !== user.id)) {
      throw new HttpError(404, "File not found");
    }
  }

  // Sent straight from the API so it also works through the frontend proxy (/api only).
  const target = path.join(uploadsDir, path.basename(file.url));
  if (!fs.existsSync(target)) throw new HttpError(404, "File not found");
  res.type(file.mimeType);
  res.setHeader("Cache-Control", publicImage ? "public, max-age=86400" : "private, no-store");
  res.sendFile(target);
});

// Any signed-in user can upload a document or an image (for example a TOPIK certificate).
filesRouter.post("/", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Send the file in the "file" field (multipart/form-data)');
  res.status(201).json({ file: await saveFile(req.user!.id, req.file) });
});

// Uploads a picture and makes it the user's avatar.
filesRouter.post("/avatar", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Send the file in the "file" field (multipart/form-data)');
  if (!req.file.mimetype.startsWith("image/")) throw new HttpError(400, "The avatar must be an image");
  const file = await saveFile(req.user!.id, req.file);
  await prisma.user.update({ where: { id: req.user!.id }, data: { avatarFileId: file.id } });
  res.status(201).json({ file, avatarFileId: file.id });
});
