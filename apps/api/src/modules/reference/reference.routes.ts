import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const referenceRouter = Router();

const themeSelect = {
  id: true,
  name: true,
  nameKo: true,
  description: true,
  iconFileId: true,
  isEmergency: true,
} as const;

referenceRouter.get("/languages", async (_req, res) => {
  const languages = await prisma.language.findMany({
    orderBy: { id: "asc" },
    select: { id: true, code: true, name: true },
  });
  res.json({ languages });
});

referenceRouter.get("/categories", async (_req, res) => {
  const [categories, uncategorizedThemes] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        iconFileId: true,
        themes: {
          where: { isActive: true },
          orderBy: { id: "asc" },
          select: themeSelect,
        },
      },
    }),
    prisma.theme.findMany({
      where: { categoryId: null, isActive: true },
      orderBy: { id: "asc" },
      select: themeSelect,
    }),
  ]);
  res.json({ categories, uncategorizedThemes });
});
