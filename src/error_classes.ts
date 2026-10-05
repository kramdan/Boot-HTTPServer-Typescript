export class BadRequestError extends Error { //Error 400
    constructor(message: string) {
        super(message);
    }
}

export class UnauthorizedError extends Error { //Error 401
    constructor(message: string) {
        super(message);
    }
}

export class ForbiddenError extends Error { //Error 403
    constructor(message: string) {
        super(message);
    }
}

export class NotFoundError extends Error { //Error 404
    constructor(message: string) {
        super(message);
    }
}