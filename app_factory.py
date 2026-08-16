"""
app_factory.py — NanoSafe Analyzer: Flask Application Factory

Creates and configures the Flask application with all extensions and blueprints.
"""

import logging
from datetime import datetime

from flask import Flask, request
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from models import (
    db, Role, User, StudyParticipant, BiologicalSample,
    SampleExperimentLink, ParticipantConsentLog
)
from auth.email_service import mail

logger = logging.getLogger("nanosafe.factory")

csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")


def create_app(config_class=Config):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Disable rate limits in debug/testing mode
    if app.config.get("DEBUG") or app.config.get("TESTING"):
        app.config["RATELIMIT_ENABLED"] = False

    # ── Initialise Extensions ──────────────────────────────
    db.init_app(app)
    mail.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)

    @limiter.request_filter
    def bypass_limiter_for_testing_and_localhost():
        return app.config.get("TESTING", False) or request.remote_addr in ["127.0.0.1", "::1"]


    from mobile import mobile_bp
    csrf.exempt(mobile_bp)

    # ── Register Blueprints ────────────────────────────────
    from auth import auth_bp
    from main import main_bp
    from admin import admin_bp
    from participants import participants_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(mobile_bp)
    app.register_blueprint(participants_bp)

    # ── Create Tables & Seed Data ──────────────────────────
    with app.app_context():
        db.create_all()
        _auto_migrate_schema()
        _seed_roles()
        _seed_admin()
        _auto_verify_existing_users()

    # ── Logging ────────────────────────────────────────────
    if app.config.get("DEBUG"):
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    return app


def _seed_roles():
    """Ensure 'admin' and 'user' roles exist."""
    for name, desc in [("admin", "Full platform administrator"), ("user", "Research user")]:
        if not Role.query.filter_by(name=name).first():
            db.session.add(Role(name=name, description=desc))
            logger.info("Created role: %s", name)
    db.session.commit()


def _seed_admin():
    """Create admin account from .env if it doesn't exist."""
    from werkzeug.security import generate_password_hash

    admin_role = Role.query.filter_by(name="admin").first()
    if not admin_role:
        return

    admin_username = Config.ADMIN_USERNAME
    admin_email = Config.ADMIN_EMAIL
    admin_password = Config.ADMIN_PASSWORD

    existing = User.query.filter_by(username=admin_username).first()
    if existing:
        # Ensure admin role
        if existing.role_id != admin_role.id:
            existing.role_id = admin_role.id
            existing.is_verified = True
            existing.is_active = True
            db.session.commit()
            logger.info("Promoted existing user '%s' to admin", admin_username)
    else:
        admin_user = User(
            username=admin_username,
            email=admin_email,
            password_hash=generate_password_hash(admin_password),
            role_id=admin_role.id,
            is_verified=True,
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.session.add(admin_user)
        db.session.commit()
        logger.info("Admin account created: %s / %s", admin_username, admin_email)


def _auto_verify_existing_users():
    """Mark any existing users without verification as verified+active."""
    user_role = Role.query.filter_by(name="user").first()
    if not user_role:
        return

    # Find users that have no role set (migrated from legacy)
    unset = User.query.filter(User.role_id.is_(None)).all()
    for u in unset:
        u.role_id = user_role.id
        u.is_verified = True
        u.is_active = True
    if unset:
        db.session.commit()
        logger.info("Auto-verified %d existing users", len(unset))


def _auto_migrate_schema():
    """Ensure newly added columns exist in relational databases."""
    try:
        engine = db.engine
        with engine.connect() as conn:
            # Check study_participants table columns
            if engine.dialect.name == "sqlite":
                res = conn.exec_driver_sql("PRAGMA table_info(study_participants)").fetchall()
                cols = [r[1] for r in res] if res else []
                if "consent_date" not in cols:
                    conn.exec_driver_sql("ALTER TABLE study_participants ADD COLUMN consent_date DATE")
                    logger.info("Auto-migrated: added consent_date column to study_participants")
                if "consent_updated_at" not in cols:
                    conn.exec_driver_sql("ALTER TABLE study_participants ADD COLUMN consent_updated_at DATETIME")
                    logger.info("Auto-migrated: added consent_updated_at column to study_participants")
                
                # Check email_verification_tokens table columns
                res_tok = conn.exec_driver_sql("PRAGMA table_info(email_verification_tokens)").fetchall()
                cols_tok = [r[1] for r in res_tok] if res_tok else []
                if "attempts" not in cols_tok:
                    conn.exec_driver_sql("ALTER TABLE email_verification_tokens ADD COLUMN attempts INTEGER DEFAULT 0 NOT NULL")
                    logger.info("Auto-migrated: added attempts column to email_verification_tokens")
                
                conn.commit()
    except Exception as e:
        logger.warning("Auto-migration notice: %s", e)

