"""
config.py — NanoSafe Analyzer: Central configuration from environment variables.
All secrets and settings are loaded from .env — nothing is hardcoded.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file if it exists (development convenience)
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    # ── Flask Core ─────────────────────────────────────────
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-insecure-key-change-me")
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    PORT: int = int(os.environ.get("PORT", 5000))
    MAX_CONTENT_LENGTH: int = int(os.environ.get("MAX_CONTENT_LENGTH_MB", 16)) * 1024 * 1024

    # ── Firebase Storage (optional — file storage only, NOT auth) ─
    GOOGLE_APPLICATION_CREDENTIALS: str = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
    FIREBASE_STORAGE_BUCKET: str = os.environ.get("FIREBASE_STORAGE_BUCKET", "")

    # ── Database ───────────────────────────────────────────
    _raw_db_url: str = os.environ.get("DATABASE_URL", "sqlite:///database.db")
    # Resolve relative SQLite paths to absolute (so app works from any cwd)
    if _raw_db_url.startswith("sqlite:///") and not os.path.isabs(_raw_db_url[len("sqlite:///"):]):
        SQLALCHEMY_DATABASE_URI: str = f"sqlite:///{os.path.join(BASE_DIR, _raw_db_url[len('sqlite:///'):])}"
    else:
        SQLALCHEMY_DATABASE_URI: str = _raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ENGINE_OPTIONS: dict = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # ── Admin Seed ─────────────────────────────────────────
    ADMIN_USERNAME: str = os.environ.get("ADMIN_USERNAME", "dhatrikaakepati")
    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "dhatrikaakepati@gmail.com")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "AdminPassword123!")

    # ── Email / SMTP ───────────────────────────────────────
    MAIL_SERVER: str = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT: int = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS: bool = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USE_SSL: bool = os.environ.get("MAIL_USE_SSL", "false").lower() == "true"
    MAIL_USERNAME: str = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD: str = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER: str = os.environ.get("MAIL_DEFAULT_SENDER", "NanoSafe Analyzer <noreply@nanosafe.local>")

    # ── OTP / Session ──────────────────────────────────────
    OTP_EXPIRY_MINUTES: int = int(os.environ.get("OTP_EXPIRY_MINUTES", 10))
    PERMANENT_SESSION_LIFETIME: timedelta = timedelta(
        minutes=int(os.environ.get("SESSION_LIFETIME_MINUTES", 120))
    )
    REMEMBER_ME_DAYS: int = int(os.environ.get("REMEMBER_ME_DAYS", 30))
    REMEMBER_ME_DURATION: timedelta = timedelta(days=int(os.environ.get("REMEMBER_ME_DAYS", 30)))

    # ── CSRF ───────────────────────────────────────────────
    WTF_CSRF_ENABLED: bool = os.environ.get("WTF_CSRF_ENABLED", "true").lower() == "true"

    # ── Session Security ───────────────────────────────────
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "Lax"
    SESSION_COOKIE_SECURE: bool = not (os.environ.get("DEBUG", "false").lower() == "true") and not (os.environ.get("FLASK_ENV", "production") == "development") and not (os.environ.get("TESTING", "false").lower() == "true")

    # ── JWT ────────────────────────────────────────────────
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES_HOURS: int = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 1))
    JWT_REFRESH_TOKEN_EXPIRES_DAYS: int = int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30))

    # ── Rate Limiting ──────────────────────────────────────
    RATE_LIMIT_LOGIN: str = os.environ.get("RATE_LIMIT_LOGIN", "10 per minute")
    RATE_LIMIT_REGISTER: str = os.environ.get("RATE_LIMIT_REGISTER", "5 per minute")
    RATE_LIMIT_OTP: str = os.environ.get("RATE_LIMIT_OTP", "5 per minute")
    RATELIMIT_STORAGE_URL: str = "memory://"
    RATELIMIT_DEFAULT: str = "200 per day;50 per hour"
