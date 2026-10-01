import express, { type Express, type Request, type Response } from 'express';

const app: Express = express();
const port = 8080;

function main() {

    app.use(express.static("."));

    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
    });
}

main();