import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

// Admin: create, edit and hide categories and themes (topics).
export const adminCatalogRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const categoryCreate = z.object({
  name: z.string().trim().min(1).max(100),
  iconFileId: z.number().int().positive().nullable().optional(),
});
const categoryUpdate = categoryCreate.partial().extend({ isActive: z.boolean().optional() });

const themeCreate = z.object({
  name: z.string().trim().min(1).max(150),
  nameKo: z.string().trim().max(150).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  iconFileId: z.number().int().positive().nullable().optional(),
  isEmergency: z.boolean().optional(),
});
const themeUpdate = themeCreate.partial().extend({ isActive: z.boolean().optional() });

const languageCreate = z.object({
  code: z.string().trim().toLowerCase().min(2).max(10),
  name: z.string().trim().min(1).max(100),
});
const languageUpdate = languageCreate.partial();

adminCatalogRouter.get("/languages", async (_req, res) => {
  const languages = await prisma.language.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { translators: true, calls: true } } },
  });
  res.json({ languages });
});

adminCatalogRouter.post("/languages", async (req, res) => {
  const data = languageCreate.parse(req.body ?? {});
  if (await prisma.language.findUnique({ where: { code: data.code } })) {
    throw new HttpError(409, "A language with this code already exists");
  }
  res.status(201).json({ language: await prisma.language.create({ data }) });
});

adminCatalogRouter.patch("/languages/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = languageUpdate.parse(req.body ?? {});
  if (!(await prisma.language.findUnique({ where: { id } }))) {
    throw new HttpError(404, "Language not found");
  }
  if (data.code) {
    const other = await prisma.language.findUnique({ where: { code: data.code } });
    if (other && other.id !== id) {
      throw new HttpError(409, "A language with this code already exists");
    }
  }
  res.json({ language: await prisma.language.update({ where: { id }, data }) });
});

// A language that translators or calls already use cannot be deleted, otherwise history would break.
adminCatalogRouter.delete("/languages/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const language = await prisma.language.findUnique({
    where: { id },
    include: { _count: { select: { translators: true, calls: true } } },
  });
  if (!language) {
    throw new HttpError(404, "Language not found");
  }
  if (language._count.translators > 0 || language._count.calls > 0) {
    throw new HttpError(409, "This language is used by translators or calls and cannot be deleted");
  }
  await prisma.language.delete({ where: { id } });
  res.json({ deleted: true });
});

adminCatalogRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { themes: true } } },
  });
  res.json({ categories });
});

adminCatalogRouter.post("/categories", async (req, res) => {
  const data = categoryCreate.parse(req.body ?? {});
  res.status(201).json({ category: await prisma.category.create({ data }) });
});

adminCatalogRouter.patch("/categories/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = categoryUpdate.parse(req.body ?? {});
  res.json({ category: await prisma.category.update({ where: { id }, data }) });
});

// A category that is already used is hidden instead of deleted, so history stays intact.
adminCatalogRouter.delete("/categories/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const used = await prisma.theme.count({ where: { categoryId: id } });
  if (used > 0) {
    await prisma.category.update({ where: { id }, data: { isActive: false } });
    res.json({ deleted: false, hidden: true });
    return;
  }
  await prisma.category.delete({ where: { id } });
  res.json({ deleted: true });
});

adminCatalogRouter.get("/themes", async (_req, res) => {
  const themes = await prisma.theme.findMany({
    orderBy: { id: "asc" },
    include: { category: { select: { id: true, name: true } } },
  });
  res.json({ themes });
});

adminCatalogRouter.post("/themes", async (req, res) => {
  const data = themeCreate.parse(req.body ?? {});
  res.status(201).json({ theme: await prisma.theme.create({ data }) });
});

adminCatalogRouter.patch("/themes/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const data = themeUpdate.parse(req.body ?? {});
  res.json({ theme: await prisma.theme.update({ where: { id }, data }) });
});

adminCatalogRouter.delete("/themes/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const calls = await prisma.call.count({ where: { themeId: id } });
  if (calls > 0) {
    await prisma.theme.update({ where: { id }, data: { isActive: false } });
    res.json({ deleted: false, hidden: true });
    return;
  }
  const exists = await prisma.theme.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new HttpError(404, "Theme not found");
  await prisma.translatorTheme.deleteMany({ where: { themeId: id } });
  await prisma.theme.delete({ where: { id } });
  res.json({ deleted: true });
});
