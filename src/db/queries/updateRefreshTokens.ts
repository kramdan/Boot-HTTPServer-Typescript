import { eq } from "drizzle-orm";
import { refresh_tokens } from "../schema.js";
import { db } from "../index.js";



export async function updateRefreshToken(token: string) {
    const [result] = await db
    .update(refresh_tokens)
    .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
    })
    .where(eq(refresh_tokens.token, token))
    .returning();
    return result;
}