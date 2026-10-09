import { type Request } from "express";
import { hash, verify } from "argon2";
import jwt, { Jwt, JwtPayload } from "jsonwebtoken";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "./error_classes.js";
import crypto from "crypto";
import { NewRefreshToken, NewUser } from "./db/schema.js";
import { time } from "drizzle-orm/mysql-core";
import { createRefreshToken } from "./db/queries/refreshTokens.js";

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export async function hashPassword(password: string): Promise<string> {
    const hashed = hash(password);
    return hashed;
}

export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
    const verified = verify(hash, password);
    return verified;
}

export function makeJWT(userId: string, expiresIn: number, secret: string): string {
    const iat = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
        "iss": "chirpy",
        "sub": userId,
        "iat": iat,
        "exp": iat + expiresIn,
    };
    const newJWT = jwt.sign(payload, secret);
    return newJWT;
}

export function validateJWT(tokenString: string, secret: string): string {
    let verified;
    try {
        verified = jwt.verify(tokenString, secret);
    } catch {
        throw new UnauthorizedError("Issue verifying token");
    }
    
    if (typeof verified === "string") {
        throw new UnauthorizedError("Invalid access token");
    }
    const payload = verified as JwtPayload
    if (payload.sub == undefined) {
        throw new UnauthorizedError("Missing token contents");
    }
    return payload.sub;
}

export function getBearerToken(req: Request): string {
    const header = req.get('Authorization');
    if (header == undefined) {
        throw new UnauthorizedError("Token incorrect or missing");
    }
    const token = header.replace("Bearer", "").trim();
    return token;
}

export async function makeRefreshToken(user: NewUser): Promise<NewRefreshToken> {
    const randomText = crypto.randomBytes(32);
    const token = randomText.toString('hex');
    const userId = user.id as string;
    const insert: NewRefreshToken = {
        token: token,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        user_id: userId,
    }
    const inserted = await createRefreshToken(insert);

    return insert;
}

export function getAPIKey(req: Request): string {
    const header = req.get('Authorization');
    if (header == undefined) {
        throw new UnauthorizedError("No authorization header found");
    }
    const apiKey = header.replace("ApiKey", "").trim();
    return apiKey;
}