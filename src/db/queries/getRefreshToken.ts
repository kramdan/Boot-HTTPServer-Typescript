import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { refresh_tokens } from "../schema.js";



export async function getRefreshToken(token: string) {
    const [result] = await db
        .select()
        .from(refresh_tokens)
        .where(eq(refresh_tokens.token, token));
    return result;
}