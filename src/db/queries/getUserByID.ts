import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";

export async function getUserByID(userID: string) {
    const [result] = await db
        .select()
        .from(users)
        .where(eq(users.id, userID));
    return result;
}