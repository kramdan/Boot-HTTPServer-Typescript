import express, { request, type Express, type Request, type Response } from 'express';

const app: Express = express();
const port = 8080;

function main() {

    app.use("/app", express.static("./src/app"));
    app.get("/healthz", (req: Request, res: Response) => {
        res.set({'Content-Type': 'text/plain'});
        res.send(`${res.statusCode} OK`);
    });

    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
    });
}

main();