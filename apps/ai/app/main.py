from fastapi import Depends, FastAPI

from app.security import require_signature

app = FastAPI(title="UOSBuddy AI", version="0.1.0", docs_url=None, redoc_url=None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Internal routes (chat, OCR pre-check, moderation, embeddings) mount here from Phase 1 on.
@app.post("/internal/ping", dependencies=[Depends(require_signature)])
def internal_ping() -> dict[str, str]:
    return {"status": "ok"}
