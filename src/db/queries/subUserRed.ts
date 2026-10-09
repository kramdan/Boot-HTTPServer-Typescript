import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";



export async function subUserRed(userId: string) {
    const [result] = await db
        .update(users)
        .set({
            is_chirpy_red: true,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
    return result;
}