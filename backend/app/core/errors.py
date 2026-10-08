from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """A domain error raised by services and rendered as {"error": {code, message}}.

    `code` is a stable machine-readable string the frontend can branch on;
    `message` is shown to the user as-is.
    """

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFoundError(AppError):
    def __init__(self, code: str = "not_found", message: str = "Not found") -> None:
        super().__init__(404, code, message)


class ForbiddenError(AppError):
    def __init__(self, code: str = "forbidden", message: str = "Not allowed") -> None:
        super().__init__(403, code, message)


class BadRequestError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(400, code, message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
