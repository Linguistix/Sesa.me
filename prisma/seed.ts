import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { THEME_PRESETS } from "../src/lib/theme/presets";
import { DEFAULT_FORM_FIELDS } from "../src/lib/forms";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/**
 * Creates a demo account so a fresh clone has something to look at.
 * Idempotent: re-running replaces the demo page's blocks rather than piling up.
 */
async function main() {
  const email = "demo@sesa.me";
  const goldNoir = THEME_PRESETS.find((p) => p.id === "gold-noir")!;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Camille Dupont",
      passwordHash: await bcrypt.hash("demo1234", 10),
      locale: "fr",
    },
  });

  const page = await prisma.page.upsert({
    where: { slug: "camille" },
    update: { themeJson: goldNoir.theme },
    create: {
      userId: user.id,
      slug: "camille",
      displayName: "Camille Dupont",
      bio: "Productrice & DJ. Nouveau single disponible partout.",
      themeJson: goldNoir.theme,
    },
  });

  await prisma.link.deleteMany({ where: { pageId: page.id } });

  await prisma.link.createMany({
    data: [
      { pageId: page.id, type: "HEADING", title: "Ma musique", position: 0 },
      {
        pageId: page.id,
        type: "LINK",
        title: "Écouter sur Spotify",
        url: "https://open.spotify.com",
        emoji: "🎧",
        position: 1,
      },
      {
        pageId: page.id,
        type: "LINK",
        title: "Clip officiel",
        url: "https://www.youtube.com",
        emoji: "📺",
        position: 2,
      },
      { pageId: page.id, type: "HEADING", title: "Me suivre", position: 3 },
      {
        pageId: page.id,
        type: "SOCIAL",
        title: "Instagram",
        url: "https://instagram.com",
        emoji: "📸",
        position: 4,
      },
      {
        pageId: page.id,
        type: "TEXT",
        title: "Note",
        body: "Prochaine date : Paris, le 14 novembre.",
        position: 5,
      },
      {
        pageId: page.id,
        type: "EMBED",
        title: "Dernier single",
        url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        position: 6,
      },
      {
        pageId: page.id,
        type: "GALLERY",
        title: "En tournée",
        images: [
          "https://picsum.photos/seed/sesame1/600/600",
          "https://picsum.photos/seed/sesame2/600/600",
          "https://picsum.photos/seed/sesame3/600/600",
        ],
        position: 7,
      },
      {
        pageId: page.id,
        type: "LINK",
        title: "Espace membres",
        url: "https://example.com/members",
        emoji: "🔐",
        position: 8,
        passwordHash: await bcrypt.hash("secret123", 10),
      },
    ],
  });

  // A form block, plus the form it submits to.
  const formLink = await prisma.link.create({
    data: { pageId: page.id, type: "FORM", title: "Me contacter", position: 9 },
  });

  await prisma.form.create({
    data: {
      pageId: page.id,
      linkId: formLink.id,
      title: "Me contacter",
      fieldsJson: DEFAULT_FORM_FIELDS,
    },
  });

  console.log(`Seeded ${email} / demo1234 → /${page.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
