import { NextFunction, type Request, type Response } from "express";
import type { MigrationConfig } from "drizzle-orm/migrator";
import { loadEnvFile } from "node:process";

loadEnvFile();

const databaseURL = process.env.DB_URL;
const serverPort = process.env.PORT;
const platformType = process.env.PLATFORM;
const secretENV = process.env.SECRET;
const polkaKeyENV = process.env.POLKA_KEY;

type APIConfig = {
    fileserverHits: number;
    dbURL: string;
    port: string;
    platform: string;
    secret: string;
    polka_key: string;
};

type DBConfig = {
    dbURL: string,
    migConf: MigrationConfig,
};

export const migrationConfig: MigrationConfig = {
    migrationsFolder: "./src/db/migrations",
};

export const config: APIConfig & DBConfig = {
    fileserverHits: 0,
    dbURL: envOrThrow(databaseURL),
    port: envOrThrow(serverPort),
    migConf: migrationConfig,
    platform: envOrThrow(platformType),
    secret: envOrThrow(secretENV),
    polka_key: envOrThrow(polkaKeyENV),
};

export function middlewareMetricsInc(req: Request, res: Response, next: NextFunction): void {
    config.fileserverHits++;
    next();
}

function envOrThrow(key: string | undefined): string {
    if (key == undefined) {
        throw new Error("No env variable");
    }
    return key;
}