import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type ProfileRole = "tenant" | "landlord" | "admin";

function bearerToken(req: Request) {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function getSupabaseUser(req: Request): Promise<SupabaseUser | null> {
  const token = bearerToken(req);
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return null;

  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json() as Promise<SupabaseUser>;
}

export async function requireSupabaseUser(req: Request, res: Response) {
  const user = await getSupabaseUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return user;
}

export async function syncUserProfile(user: SupabaseUser, requestedRole?: ProfileRole, requestedName?: string) {
  const metadata = user.user_metadata ?? {};
  const metadataRole = metadata.role === "landlord" ? "landlord" : "tenant";
  const name = requestedName?.trim() || (typeof metadata.name === "string" ? metadata.name : "") || user.email?.split("@")[0] || "RentFaster user";
  const email = user.email ?? `${user.id}@supabase.local`;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));

  if (existing) {
    const role = existing.role === "admin" ? "admin" : requestedRole ?? existing.role;
    const [updated] = await db.update(usersTable).set({ email, name, role }).where(eq(usersTable.id, user.id)).returning();
    return updated;
  }

  const [created] = await db.insert(usersTable).values({
    id: user.id,
    email,
    name,
    role: requestedRole ?? metadataRole,
  }).returning();
  return created;
}

export async function getCurrentProfile(req: Request, res: Response) {
  const user = await requireSupabaseUser(req, res);
  if (!user) return null;
  const [profile] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  return profile ?? await syncUserProfile(user);
}