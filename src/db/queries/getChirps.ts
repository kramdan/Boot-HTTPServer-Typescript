import { asc, desc, eq, exists, or, SQL, sql } from "drizzle-orm";
import { db } from "../index.js";
import { chirps, users } from "../schema.js";
import { iife } from "drizzle-orm/tracing-utils";

export async function getChirps(authorId: string) {
    const result = db
        .select()
        .from(chirps)
        .where(authorId ? eq(chirps.user_id, authorId) : undefined)
        .orderBy(chirps.createdAt);
    return result;
}