// Pictures for topics, taken from the Figma kit (public/img/topics).
const RULES: [RegExp, string][] = [
  [/экстрен|emergency/i, "emergency"],
  [/больниц|hospital/i, "hospital"],
  [/вет|vet/i, "vet"],
  [/поликлин|clinic/i, "clinic"],
  [/аптек|pharm/i, "medical"],
  [/сто$|прокат|авто|auto|car/i, "auto"],
  [/ресторан|restaurant/i, "restaurant"],
  [/свадеб|wedding/i, "wedding"],
  [/банкет|banquet/i, "banquet"],
  [/магазин|торгов|shop/i, "shop"],
  [/красот|beauty/i, "beauty"],
  [/почт|mail|post/i, "post"],
  [/банк|bank/i, "bank"],
  [/страхов|insurance/i, "insurance"],
  [/миграц|visa/i, "visa"],
  [/район|center/i, "center"],
  [/налог|tax/i, "tax"],
  [/недвиж|real/i, "real"],
  [/полиц|police/i, "law"],
  [/прокуратур/i, "law"],
  [/адвокат/i, "lawyer"],
  [/суд|court/i, "court"],
  [/нотариус|notary/i, "notary"],
  [/детск|kinder/i, "kinder"],
  [/школ|school/i, "school"],
  [/институт|курс|образ|edu/i, "edu"],
  [/агентство труда|завод|работ|labor|work/i, "work"],
  [/медиц|medic/i, "medical"],
  [/услуг|service/i, "services"],
  [/бизнес|business/i, "business"],
  [/государ|gov/i, "gov"],
  [/закон|law/i, "law"],
];

export function topicIcon(name: string): string {
  const hit = RULES.find(([re]) => re.test(name));
  return `/img/topics/${hit ? hit[1] : "default"}.png`;
}
