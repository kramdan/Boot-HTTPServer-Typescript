import { NextFunction, type Request, type Response } from "express";


type APIConfig = {
    fileserverHits: number;
};

export const config: APIConfig = {
    fileserverHits: 0,
};

export function middlewareMetricsInc(req: Request, res: Response, next: NextFunction): void {
    config.fileserverHits++;
    next();
}