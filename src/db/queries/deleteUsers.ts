import { ilike } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";

export async function deleteUsers() {
  const [result] = await db.delete(users).returning();
  return result;
}