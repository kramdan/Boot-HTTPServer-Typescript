import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";



export async function updateUserPassAndEmail(pass: string, newEmail: string, userId: string) {
    const [result] = await db
        .update(users)
        .set({
            email: newEmail,
            hashed_password: pass,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
    return result;
}