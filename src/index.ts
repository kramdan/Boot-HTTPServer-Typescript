import express, { NextFunction, request, response, type Express, type Request, type Response } from 'express';
import { config, middlewareMetricsInc }from './config.js';
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from './error_classes.js';

const app: Express = express();
const port = 8080;

function main() {

    app.use("/app", middlewareMetricsInc, express.static("./src/app"));
    app.get("/admin/metrics", (req: Request, res: Response) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.write(`<html><body><h1>Welcome, Chirpy Admin</h1><p>Chirpy has been visited ${config.fileserverHits} times!</p></body></html>`);
        res.end();
    });
    app.get("/api/healthz", (req: Request, res: Response) => {
        res.set({'Content-Type': 'text/plain'});
        res.send(`${res.statusCode} OK`);
    });
    app.post("/admin/reset", (req: Request, res: Response) => {
        config.fileserverHits = 0;
        res.write("Set hits to 0");
        res.end();
    });
    app.post("/api/validate_chirp", express.json(), (req: Request, res: Response) => {
        type content = {
            body: string
        };
        const profaneWords = ["kerfuffle", "sharbert", "fornax"];
        const cont: content = req.body;

        if (cont.body.length <= 140){
            let cleaned = "";
            const contSplit = cont.body.split(" ");

            for (const word in contSplit) {
                if (profaneWords.includes(contSplit[word].toLowerCase())) {
                    contSplit[word] = "****";
                }
            }
            cleaned = contSplit.join(" ");

            res.status(200).send({
                "cleanedBody": cleaned
            });
        } else {
            throw new BadRequestError("Chirp is too long. Max length is 140");
            
        }
    });
    app.use(middlewareLogResponse);
    app.use(middlewareLogError);
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

function middlewareLogError(err: Error, req: Request, res: Response, next: NextFunction): void {
    console.error("Something went wrong on our end");
    switch (true) {
        case err instanceof BadRequestError:
            res.status(400).json({ error: err.message });
        default:
            res.status(500).json({ error: "Something went wrong on our end" });
    }
        
        
    
}

main();