"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { slugify, slugSchema } from "@/lib/slug";
import { DEFAULT_THEME } from "@/lib/theme/presets";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères.").max(72),
  displayName: z.string().trim().min(1, "Le nom est requis.").max(60),
  slug: slugSchema,
});

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { fieldErrors: flattenIssues(parsed.error) };
  }

  const { email, password, displayName, slug } = parsed.data;

  const [existingUser, existingPage] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.page.findUnique({ where: { slug }, select: { id: true } }),
  ]);

  if (existingUser) return { fieldErrors: { email: "Un compte existe déjà avec cet e-mail." } };
  if (existingPage) return { fieldErrors: { slug: "Ce lien est déjà pris." } };

  // The user and their first page are created together: an account without a
  // page has nothing to show, and the dashboard assumes one exists.
  try {
    await prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash: await bcrypt.hash(password, 10),
        pages: {
          create: { slug, displayName, themeJson: DEFAULT_THEME },
        },
      },
    });
  } catch {
    // Unique constraints can still fire if two signups race past the checks.
    return { error: "Cet e-mail ou ce lien vient d'être pris. Réessayez." };
  }

  await signIn("credentials", { email, password, redirect: false });
  redirect("/dashboard");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-mail ou mot de passe incorrect." };
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** Suggests a free slug from a display name, used by the signup form. */
export async function suggestSlugAction(displayName: string): Promise<string> {
  const base = slugify(displayName || "moi");
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 32);
    if (!slugSchema.safeParse(candidate).success) continue;
    const taken = await prisma.page.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 32);
}

function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
