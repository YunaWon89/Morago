import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const url = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

type ThemeSeed = { name: string; nameKo?: string };
type CategorySeed = { name: string; isActive: boolean; themes: ThemeSeed[] };

const languages = [
  { code: "ru", name: "Русский" },
  { code: "ko", name: "Корейский" },
  { code: "en", name: "Английский" },
  { code: "zh", name: "Китайский" },
  { code: "kk", name: "Казахский" },
  { code: "uz", name: "Узбекский" },
  { code: "tg", name: "Таджикский" },
];

const categories: CategorySeed[] = [
  {
    name: "Работа",
    isActive: true,
    themes: [
      { name: "Агентство труда", nameKo: "인력사무실" },
      { name: "Завод", nameKo: "공장" },
      { name: "Мин труда", nameKo: "노동부" },
    ],
  },
  {
    name: "Медицина",
    isActive: true,
    themes: [
      { name: "Больница", nameKo: "병원" },
      { name: "Поликлиника", nameKo: "보건소" },
      { name: "Вет клиника", nameKo: "동물병원" },
      { name: "Аптека", nameKo: "약국" },
    ],
  },
  {
    name: "Авто",
    isActive: true,
    themes: [
      { name: "СТО", nameKo: "자동차 서비스 센터" },
      { name: "Авто салон", nameKo: "자동차 가게" },
      { name: "Прокат", nameKo: "렌트카" },
    ],
  },
  {
    name: "Услуги",
    isActive: true,
    themes: [
      { name: "Рестораны", nameKo: "식당" },
      { name: "Свадебный салон", nameKo: "웨딩홀" },
      { name: "Банкетный зал", nameKo: "연회장" },
      { name: "Магазин / Торговый центр", nameKo: "마트 / 백화점" },
      { name: "Салон красоты", nameKo: "미용실" },
      { name: "Почта", nameKo: "우체국" },
      { name: "Банк", nameKo: "은행" },
    ],
  },
  {
    name: "Бизнес",
    isActive: true,
    themes: [{ name: "Бизнес", nameKo: "사업" }],
  },
  {
    name: "Государственные учреждения",
    isActive: true,
    themes: [
      { name: "Гос страховка", nameKo: "국민건강보험" },
      { name: "Миграционный центр", nameKo: "출입국 관리사무소" },
      { name: "Районный центр", nameKo: "주민센터" },
      { name: "Налоговая", nameKo: "세무서" },
      { name: "Агентство недвижимости", nameKo: "부동산" },
      { name: "Другое" },
    ],
  },
  {
    name: "Закон",
    isActive: true,
    themes: [
      { name: "Полиция", nameKo: "경찰" },
      { name: "Прокуратура", nameKo: "검찰" },
      { name: "Адвокатура", nameKo: "변호사 사무소" },
      { name: "Суд", nameKo: "법원" },
      { name: "Нотариус", nameKo: "공증인" },
    ],
  },
  {
    // Marked as not confirmed in the source table, so it is seeded as inactive.
    name: "Образовательные учреждения",
    isActive: false,
    themes: [
      { name: "Детский сад", nameKo: "교육 기관" },
      { name: "Школа", nameKo: "교육 기관" },
      { name: "Институт", nameKo: "교육 기관" },
      { name: "Учебные курсы", nameKo: "학원" },
    ],
  },
];

async function seedLanguages() {
  for (const language of languages) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: { name: language.name },
      create: language,
    });
  }
}

async function seedCategoriesAndThemes() {
  for (const category of categories) {
    const savedCategory = await prisma.category.upsert({
      where: { name: category.name },
      update: { isActive: category.isActive },
      create: { name: category.name, isActive: category.isActive },
    });

    for (const theme of category.themes) {
      const data = {
        name: theme.name,
        nameKo: theme.nameKo ?? null,
        categoryId: savedCategory.id,
        isActive: category.isActive,
      };
      const existing = await prisma.theme.findFirst({
        where: { name: theme.name, categoryId: savedCategory.id },
      });
      if (existing) {
        await prisma.theme.update({ where: { id: existing.id }, data });
      } else {
        await prisma.theme.create({ data });
      }
    }
  }
}

async function seedEmergencyTheme() {
  const data = {
    name: "Экстренный вызов",
    nameKo: "긴급 콜",
    categoryId: null,
    isEmergency: true,
    isActive: true,
  };
  const existing = await prisma.theme.findFirst({ where: { isEmergency: true } });
  if (existing) {
    await prisma.theme.update({ where: { id: existing.id }, data });
  } else {
    await prisma.theme.create({ data });
  }
}

async function main() {
  await seedLanguages();
  await seedCategoriesAndThemes();
  await seedEmergencyTheme();

  const [languagesCount, categoriesCount, themesCount] = await Promise.all([
    prisma.language.count(),
    prisma.category.count(),
    prisma.theme.count(),
  ]);
  console.log(
    `Seed finished: ${languagesCount} languages, ${categoriesCount} categories, ${themesCount} themes`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
