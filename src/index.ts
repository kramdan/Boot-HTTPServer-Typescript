import express, { NextFunction, request, response, type Express, type Request, type Response } from 'express';
import { config, middlewareMetricsInc }from './config.js';
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from './error_classes.js';
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser } from './db/queries/users.js';
import { createChirp } from './db/queries/chirps.js';
import { time, uuid } from 'drizzle-orm/pg-core';
import { NewChirp, NewUser } from './db/schema.js';
import { deleteUsers } from './db/queries/deleteUsers.js';
import { stringify } from 'node:querystring';
import { getChirps } from './db/queries/getChirps.js';
import { getChirp } from './db/queries/getChirp.js';
import { checkPasswordHash, getAPIKey, getBearerToken, hashPassword, makeJWT, makeRefreshToken, validateJWT } from './auth.js';
import { getUser } from './db/queries/getUser.js';
import { getRefreshToken } from './db/queries/getRefreshToken.js';
import { getUserFromRefreshToken } from './db/queries/getUserFromRefreshToken.js';
import { updateRefreshToken } from './db/queries/updateRefreshTokens.js';
import { updateUserPassAndEmail } from './db/queries/updateUserPass.js';
import { getUserByID } from './db/queries/getUserByID.js';
import { deleteChirp } from './db/queries/deleteChirp.js';
import { subUserRed } from './db/queries/subUserRed.js';
import { createDeflate } from 'node:zlib';

const app: Express = express();

const migrationClient = postgres(config.dbURL, { max: 1});
await migrate(drizzle(migrationClient), config.migConf);

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
    app.get("/api/chirps", async (req: Request, res: Response) => {
        let authorId = "";
        let sortParam = "asc";
        let authorIdQuery = req.query.authorId;
        let sortQuery = req.query.sort;
        if (typeof authorIdQuery === "string") {
            authorId = authorIdQuery;
        }
        if (typeof sortQuery === "string") {
            sortParam = sortQuery;
        }
        let chirps = await getChirps(authorId ?? null);
        if (sortParam == "asc") {
            chirps = chirps.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        } else if (sortParam == "desc") {
            chirps = chirps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        res.status(200).send(chirps);
    });
    app.get("/api/chirps/:chirpId", express.json(), async (req: Request, res: Response) => {
        const path = req.params.chirpId;
        if (typeof path !== "string") {
            throw new BadRequestError("Not a string");
        }
        const chirp = await getChirp(path);
        if (!chirp) {
            throw new NotFoundError("Chirp not found");
        }
        res.status(200).send(chirp);
    });
    app.put("/api/users", express.json(), async (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(handleUpdatePass(req, res)).catch(next);
    });
    app.post("/admin/reset", async (req: Request, res: Response) => {
        if (config.platform !== "dev") {
            throw new ForbiddenError("Not for you");
        }
        config.fileserverHits = 0;
        await deleteUsers();
        res.write("Set hits to 0 and cleared all tables in db");
        res.end();
    });
    app.post("/api/users", express.json(), (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(handleCreateUsers(req, res)).catch(next);
    });
    app.post("/api/chirps", express.json(), async (req: Request, res: Response, next: NextFunction) => {
        return await Promise.resolve(handleCreateChirps(req, res)).catch(next);
    });
    app.post("/api/login", express.json(), async (req: Request, res: Response, next: NextFunction) => {
        return await Promise.resolve(handleLoginUser(req, res)).catch(next);
    });
    app.post("/api/refresh", async (req: Request, res: Response, next: NextFunction) => {
        const token = getBearerToken(req);
        const getToken = await getRefreshToken(token);
        if (!getToken) {
            throw new UnauthorizedError("Token missing, expired, or revoked");
        }
        if ((getToken.expiresAt.getTime() - new Date().getTime()) > new Date().getTime() ) {
            throw new UnauthorizedError("Token missing, expired, or revoked");
        }
        if(getToken.revokedAt){
            throw new UnauthorizedError("Token missing, expired, or revoked");
        }
        const user = await getUserFromRefreshToken(getToken.user_id);
        res.status(200).send({
            "token": makeJWT(user.id, 3600, config.secret),
        });
    });
    app.post("/api/revoke", async (req: Request, res: Response, next: NextFunction) => {
        const token = getBearerToken(req);
        const updateToken = await updateRefreshToken(token);
        res.status(204).send();
    });
    app.post("/api/polka/webhooks", express.json(), async (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(handleUpgradeUser(req, res)).catch(next);
    });
    app.delete("/api/chirps/:chirpId", express.json(), async (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(handleDeleteChirps(req, res)).catch(next);
    });
    app.use(middlewareLogResponse);
    app.use(middlewareLogError);
    app.listen(config.port, () => {
        console.log(`Example app listening on port ${config.port}`);
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
    console.error(`${err.message}`);
    switch (true) {
        case err instanceof BadRequestError:
            res.status(400).json({ error: err.message });
            break;
        case err instanceof UnauthorizedError:
            res.status(401).json({error: err.message});
            break;
        case err instanceof ForbiddenError:
            res.status(403).json({error: err.message});
            break;
        case err instanceof NotFoundError:
            res.status(404).json({error: err.message});
            break;
        default:
            res.status(500).json({ error: "Something went wrong on our end" });
    }
        
        
    
}

async function handleCreateUsers(req: Request, res: Response) {
    type content = {
        password: string
        email: string
    };
    const cont: content = req.body;
    if (cont.email == "") {
        throw new BadRequestError("No email provided");
    }
    if (cont.password == "") {
        throw new BadRequestError("No password provided");
    }
    const user: NewUser = {
        email: cont.email,
        hashed_password: await hashPassword(cont.password),
    };

    const newUser = await createUser(user);

    if (!newUser) {
        throw new Error("Could not create user");
    }
    res.status(201).send({
        "id": newUser.id,
        "email": newUser.email,
        "createdAt": newUser.createdAt,
        "updatedAt": newUser.updatedAt,
        "isChirpyRed": newUser.is_chirpy_red,
    });
    return newUser;
}

async function handleLoginUser(req: Request, res: Response) {
    type content = {
        password: string,
        email: string,
    };
    const cont: content = req.body;
    if (cont.email == "") {
        throw new BadRequestError("Provide email to login");
    }
    if (cont.password == "") {
        throw new BadRequestError("Provide password to login");
    }
    const user = await getUser(cont.email);
    if (user.hashed_password == null) {
        throw new UnauthorizedError("incorrect email or password");
    }
    const passCheck = await checkPasswordHash(cont.password, user.hashed_password);
    if (!passCheck) {
        throw new UnauthorizedError("incorrect email or password");
    }
    const token = makeJWT(user.id, 3600, config.secret);
    const refreshToken = await makeRefreshToken(user);
    res.status(200).send({
        "id": user.id,
        "email": user.email,
        "createdAt": user.createdAt,
        "updatedAt": user.updatedAt,
        "isChirpyRed": user.is_chirpy_red,
        "token": token,
        "refreshToken": refreshToken.token,
    });
}

async function handleUpdatePass(req: Request, res: Response) {
    type content = {
        password: string
        email: string
    };
    const cont: content = req.body;
    if (cont.email == "") {
        throw new BadRequestError("No email provided");
    }
    if (cont.password == "") {
        throw new BadRequestError("No password provided");
    }
    const newPass = await hashPassword(cont.password);
    const token = getBearerToken(req);
    const validatedToken = validateJWT(token, config.secret);
    const user = await getUserByID(validatedToken);
    const updatedUser = await updateUserPassAndEmail(newPass, cont.email, user.id);
    res.status(200).send({
        "id": updatedUser.id,
        "created_at": updatedUser.createdAt,
        "updated_at": updatedUser.updatedAt,
        "email": updatedUser.email,
        "isChirpyRed": updatedUser.is_chirpy_red,
    });
}

async function handleUpgradeUser(req: Request, res: Response) {
    type content = {
        event: string,
        data: {
            userId: string,
        },
    };
    const cont: content = req.body;
    const apiKey = getAPIKey(req);
    if (apiKey != config.polka_key) {
        throw new UnauthorizedError("Only for Polka clients");
    } else {
        if (cont.event != "user.upgraded") {
            res.status(204).send();
        } else {
            let user;
            try {
                user = await getUserByID(cont.data.userId);
            } catch {
                throw new NotFoundError("User not found");
            }
            subUserRed(user.id);
            res.status(204).send();
        }
    }
}

async function handleCreateChirps(req: Request, res: Response) {
    const token = getBearerToken(req);
    let verifiedToken: string;
    try {
        verifiedToken = validateJWT(token, config.secret);
    } catch {
        throw new UnauthorizedError("Token Invalid");
    }
    type content = {
        body: string,
        userId: string,
    };
    const cont: content = {
        body: req.body.body,
        userId: verifiedToken,
    }
    const profaneWords = ["kerfuffle", "sharbert", "fornax"];

    let cleaned = "";
    if (cont.body.length <= 140){
        
        const contSplit = cont.body.split(" ");

        for (const word in contSplit) {
            if (profaneWords.includes(contSplit[word].toLowerCase())) {
                contSplit[word] = "****";
            }
        }
        cleaned = contSplit.join(" ");
    } else {
        throw new BadRequestError("Chirp is too long. Max length is 140");
        
    }
    const chirp: NewChirp = {
        "body": cont.body,
        "user_id": cont.userId,
    };
    const newChirp = await createChirp(chirp);
    if (!newChirp) {
        throw new BadRequestError("Issue creating chirp");
    }
    res.status(201).send({
        "id": newChirp.id,
        "createdAt": newChirp.createdAt,
        "updatedAt": newChirp.updatedAt,
        "body": newChirp.body,
        "userId": newChirp.user_id,
    });
    return newChirp
        
}

async function handleDeleteChirps(req: Request, res: Response) {
    const token = getBearerToken(req);
    let verifiedToken: string;
    try {
        verifiedToken = validateJWT(token, config.secret);
    } catch {
        throw new UnauthorizedError("Token Invalid");
    }
    type content = {
        body: string,
        userId: string,
    };
    const path = req.params.chirpId;
    if (typeof path !== "string") {
        throw new BadRequestError("Missing Chirp ID");
    }
    const cont: content = {
        body: path,
        userId: verifiedToken,
    };
    const chirp = await getChirp(cont.body);
    if (!chirp) {
        throw new NotFoundError("Chirp does not exist");
    }
    if (cont.userId !== chirp.user_id) {
        throw new ForbiddenError("Only creator can delete chirp");
    }
    deleteChirp(chirp.id);
    res.status(204).send();
}

main();