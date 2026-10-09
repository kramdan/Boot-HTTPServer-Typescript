import { db } from "../index.js";
import { NewRefreshToken, refresh_tokens } from "../schema.js";


export async function createRefreshToken(token: NewRefreshToken) {
    const [result] = await db
        .insert(refresh_tokens)
        .values(token)
        .onConflictDoNothing()
        .returning();
    return result;
}