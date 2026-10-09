import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { chirps } from "../schema.js";



export async function deleteChirp(chirpId: string) {
    await db.delete(chirps).where(eq(chirps.id, chirpId));
}