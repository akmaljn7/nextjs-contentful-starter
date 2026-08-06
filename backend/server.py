"""Geofence Attendance Console — main FastAPI app."""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import ensure_indexes, close_db
from routes.auth import router as auth_router
from routes.offices import router as offices_router
from routes.employees import router as employees_router
from routes.sessions import router as sessions_router
from routes.attendance import router as attendance_router
from routes.audit import router as audit_router
from routes.settings import router as settings_router
from routes.ws import router as ws_router
from routes.photos import router as photos_router
from routes.time_off import router as time_off_router
from routes.face import router as face_router
from routes.mobile import router as mobile_router
from routes.cron import router as cron_router
from seed import seed_demo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Geofence Attendance Console")


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed_demo()
    logger.info("Startup complete — indexes ready, seed applied.")


@app.on_event("shutdown")
async def shutdown():
    await close_db()


origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
async def api_root():
    return {"service": "geofence-attendance-console", "status": "ok"}


app.include_router(auth_router)
app.include_router(offices_router)
app.include_router(employees_router)
app.include_router(sessions_router)
app.include_router(attendance_router)
app.include_router(audit_router)
app.include_router(settings_router)
app.include_router(ws_router)
app.include_router(photos_router)
app.include_router(time_off_router)
app.include_router(face_router)
app.include_router(mobile_router)
app.include_router(cron_router)
