import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";

export async function getChirp(chirpID: string) {
    const [result] = await db
        .select()
        .from(chirps)
        .where(eq(chirps.id, chirpID));
    return result;
}