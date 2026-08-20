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
    """Ensure only dhatrikaakepati@gmail.com has the admin role, and all others have user role."""
    from werkzeug.security import generate_password_hash
    from sqlalchemy import func

    admin_role = Role.query.filter_by(name="admin").first()
    user_role = Role.query.filter_by(name="user").first()
    if not admin_role or not user_role:
        return

    admin_username = Config.ADMIN_USERNAME or "dhatrikaakepati"
    admin_email = Config.ADMIN_EMAIL or "dhatrikaakepati@gmail.com"
    admin_password = Config.ADMIN_PASSWORD or "Dhatrika@123"

    # Find the designated admin by email
    admin_user = User.query.filter(func.lower(User.email) == admin_email.lower()).first()
    if not admin_user:
        admin_user = User.query.filter(func.lower(User.username) == admin_username.lower()).first()

    if admin_user:
        admin_user.role_id = admin_role.id
        admin_user.email = admin_email
        admin_user.is_verified = True
        admin_user.is_active = True
        logger.info("Admin account active: %s (%s)", admin_user.username, admin_user.email)
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
        logger.info("Admin account created: %s / %s", admin_username, admin_email)

    # Demote ALL other users to standard researcher role (role_id = user_role.id)
    non_admins = User.query.filter(func.lower(User.email) != admin_email.lower()).all()
    for u in non_admins:
        if u.role_id != user_role.id:
            u.role_id = user_role.id
            logger.info("Assigned user '%s' (%s) to standard researcher role", u.username, u.email)

    db.session.commit()


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
            if engine.dialect.name == "sqlite":
                # Check users table columns
                res_u = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                cols_u = [r[1] for r in res_u] if res_u else []
                new_cols_u = [
                    ("research_field", "VARCHAR(150) DEFAULT ''"),
                    ("is_profile_completed", "BOOLEAN DEFAULT 0"),
                    ("department", "VARCHAR(200) DEFAULT ''"),
                    ("research_role", "VARCHAR(100) DEFAULT ''"),
                    ("title_salutation", "VARCHAR(20) DEFAULT ''"),
                    ("gender_pronouns", "VARCHAR(50) DEFAULT ''"),
                    ("date_of_birth", "VARCHAR(50) DEFAULT ''"),
                    ("secondary_email", "VARCHAR(120) DEFAULT ''"),
                    ("office_address", "VARCHAR(255) DEFAULT ''"),
                    ("city_state", "VARCHAR(100) DEFAULT ''"),
                    ("country", "VARCHAR(100) DEFAULT ''"),
                    ("preferred_language", "VARCHAR(50) DEFAULT 'en'"),
                    ("bio", "TEXT DEFAULT ''"),
                ]
                for col_name, col_type in new_cols_u:
                    if col_name not in cols_u:
                        conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                        logger.info("Auto-migrated: added %s to users", col_name)

                # Check biological_samples table columns
                res_bs = conn.exec_driver_sql("PRAGMA table_info(biological_samples)").fetchall()
                cols_bs = [r[1] for r in res_bs] if res_bs else []
                new_cols_bs = [
                    ("researcher_id", "VARCHAR(80) DEFAULT ''"),
                    ("study_id", "VARCHAR(80) DEFAULT ''"),
                    ("sample_category", "VARCHAR(80) DEFAULT 'Primary Cell Culture'"),
                    ("source", "VARCHAR(150) DEFAULT ''"),
                    ("volume_quantity", "VARCHAR(50) DEFAULT '1.0 mL'"),
                    ("passage_number", "VARCHAR(30) DEFAULT 'P1'"),
                    ("storage_condition", "VARCHAR(80) DEFAULT '-80°C Cryopreservation'"),
                    ("storage_location", "VARCHAR(100) DEFAULT 'Tank A / Rack 2 / Box 4'"),
                    ("collection_time", "VARCHAR(30) DEFAULT ''"),
                ]
                for col_name, col_type in new_cols_bs:
                    if col_name not in cols_bs:
                        conn.exec_driver_sql(f"ALTER TABLE biological_samples ADD COLUMN {col_name} {col_type}")
                        logger.info("Auto-migrated: added %s to biological_samples", col_name)

                # Check study_participants table columns
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
                
                # Check experiments table columns
                res_exp = conn.exec_driver_sql("PRAGMA table_info(experiments)").fetchall()
                cols_exp = [r[1] for r in res_exp] if res_exp else []
                new_cols_exp = [
                    ("synthesis_method", "VARCHAR(80) DEFAULT 'Green_Synthesis'"),
                    ("surface_coating", "VARCHAR(80) DEFAULT 'Bare_ZnO'"),
                    ("hemolysis_rate", "FLOAT DEFAULT 0.0"),
                    ("hemocompatibility_status", "VARCHAR(50) DEFAULT 'Non-Hemolytic (<2%)'"),
                    ("selectivity_index", "FLOAT DEFAULT 1.0"),
                    ("comet_tail_moment", "FLOAT DEFAULT 1.0")
                ]
                for col_name, col_type in new_cols_exp:
                    if col_name not in cols_exp:
                        conn.exec_driver_sql(f"ALTER TABLE experiments ADD COLUMN {col_name} {col_type}")
                        logger.info("Auto-migrated: added %s to experiments", col_name)

                # Check experiment_results table columns
                res_res = conn.exec_driver_sql("PRAGMA table_info(experiment_results)").fetchall()
                cols_res = [r[1] for r in res_res] if res_res else []
                for col_name, col_type in new_cols_exp:
                    if col_name not in cols_res:
                        conn.exec_driver_sql(f"ALTER TABLE experiment_results ADD COLUMN {col_name} {col_type}")
                        logger.info("Auto-migrated: added %s to experiment_results", col_name)

                # Check history table columns
                res_hist = conn.exec_driver_sql("PRAGMA table_info(history)").fetchall()
                cols_hist = [r[1] for r in res_hist] if res_hist else []
                for col_name, col_type in new_cols_exp:
                    if col_name not in cols_hist:
                        conn.exec_driver_sql(f"ALTER TABLE history ADD COLUMN {col_name} {col_type}")
                        logger.info("Auto-migrated: added %s to history", col_name)
                
                conn.commit()
    except Exception as e:
        logger.warning("Auto-migration notice: %s", e)


