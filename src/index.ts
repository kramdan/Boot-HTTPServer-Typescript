import express, { NextFunction, request, response, type Express, type Request, type Response } from 'express';
import { config, middlewareMetricsInc }from './config.js';

const app: Express = express();
const port = 8080;

function main() {

    app.use("/app", middlewareMetricsInc, express.static("./src/app"));
    app.get("/metrics",  (req: Request, res: Response) => {
        res.write(`Hits: ${config.fileserverHits}`);
        res.end();
    });
    app.get("/healthz", (req: Request, res: Response) => {
        res.set({'Content-Type': 'text/plain'});
        res.send(`${res.statusCode} OK`);
    });
    app.get("/reset", (req: Request, res: Response) => {
        config.fileserverHits = 0;
        res.write("Set hits to 0");
        res.end();
    });
    app.use(middlewareLogResponse);
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
    });
}

function middlewareLogResponse(req: Request, res: Response, next: NextFunction): void {
    res.on("finish", () => {
        const statusCode = res.statusCode;
        if (statusCode > 299) {
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`);
        }
    });
    next();
}

main();