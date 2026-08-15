"""
db_migrate.py — NanoSafe Analyzer: Database Migration Script
Run once after upgrade to:
  1. Create new ORM tables (roles, email_verification_tokens, etc.)
  2. Add new columns to existing users table (email, is_verified, is_active, role_id)
  3. Add user_id FK column to experiment_history (if exists)
  4. Mark all pre-existing users as verified + active (no email lockout)
  5. Seed role records (admin, user)
  6. Auto-create admin account from .env
  7. Migrate legacy history records → History ORM table (preserve all data)

Safe to run multiple times — idempotent.
"""

import os
import sys
import sqlite3
from datetime import datetime

# Ensure the project root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from dotenv import load_dotenv
load_dotenv()

from config import Config
from app_factory import create_app
from models import db, Role, User, History, AuditLog

# ── Werkzeug password hashing (no bcrypt dependency yet) ─────
from werkzeug.security import generate_password_hash


def log(msg: str):
    print(f"[migrate] {msg}")


def migrate():
    app = create_app()

    with app.app_context():
        # ────────────────────────────────────────────────────
        # STEP 1: Create all new ORM tables
        # ────────────────────────────────────────────────────
        log("Step 1: Creating new ORM tables...")
        db.create_all()
        log("  OK All tables created (or already existed)")

        # ────────────────────────────────────────────────────
        # STEP 2: Seed roles
        # ────────────────────────────────────────────────────
        log("Step 2: Seeding roles...")
        for role_name, desc in [("admin", "Full platform administrator"), ("user", "Research user")]:
            if not Role.query.filter_by(name=role_name).first():
                db.session.add(Role(name=role_name, description=desc))
                log(f"  OK Created role: {role_name}")
            else:
                log(f"  - Role already exists: {role_name}")
        db.session.commit()

        admin_role = Role.query.filter_by(name="admin").first()
        user_role  = Role.query.filter_by(name="user").first()

        # ────────────────────────────────────────────────────
        # STEP 3: Migrate legacy SQLite users -> ORM Users
        # ────────────────────────────────────────────────────
        log("Step 3: Migrating legacy users from database.db...")
        legacy_db_path = os.path.join(BASE_DIR, "database.db")
        migrated_legacy = 0

        if os.path.exists(legacy_db_path):
            try:
                conn = sqlite3.connect(legacy_db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # Check if legacy users table has old 3-column structure
                cur.execute("PRAGMA table_info(users)")
                cols = {row["name"] for row in cur.fetchall()}
                has_legacy_structure = "password" in cols and "role_id" not in cols

                if has_legacy_structure:
                    cur.execute("SELECT * FROM users")
                    legacy_users = cur.fetchall()
                    for lu in legacy_users:
                        uname = lu["username"]
                        passwd = lu["password"]
                        if not User.query.filter_by(username=uname).first():
                            new_user = User(
                                username=uname,
                                email=None,         # existing users have no email
                                password_hash=passwd,
                                role_id=user_role.id,
                                is_verified=True,   # auto-verify existing users
                                is_active=True,
                                created_at=datetime.utcnow(),
                            )
                            db.session.add(new_user)
                            migrated_legacy += 1
                            log(f"  OK Migrated user: {uname} (auto-verified)")
                    db.session.commit()
                else:
                    log("  - Legacy users table not in old format, skipping")

                conn.close()
            except Exception as e:
                log(f"  WARN Legacy user migration error: {e}")
        else:
            log("  - No legacy database.db found, skipping user migration")

        log(f"  OK Migrated {migrated_legacy} legacy users")

        # ────────────────────────────────────────────────────
        # STEP 4: Migrate legacy experiment_history -> History ORM
        # ────────────────────────────────────────────────────
        log("Step 4: Migrating legacy experiment_history...")
        migrated_history = 0

        if os.path.exists(legacy_db_path):
            try:
                conn = sqlite3.connect(legacy_db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='experiment_history'")
                if cur.fetchone():
                    cur.execute("SELECT * FROM experiment_history ORDER BY id ASC")
                    rows = cur.fetchall()
                    for row in rows:
                        row_dict = dict(row)
                        # Only migrate if not already in History ORM
                        if not History.query.filter_by(id=row_dict["id"]).first():
                            # Look up the user
                            uname = row_dict.get("username", "")
                            user_obj = User.query.filter_by(username=uname).first() if uname else None
                            uid = user_obj.id if user_obj else None

                            h = History(
                                id=row_dict["id"],
                                user_id=uid,
                                experiment_id=None,
                                date_time=row_dict.get("date_time", ""),
                                sample_name=row_dict.get("sample_name", ""),
                                nanoparticle_type=row_dict.get("nanoparticle_type", "ZnO"),
                                cell_line=row_dict.get("cell_line", ""),
                                concentration=float(row_dict.get("concentration") or 0),
                                cell_viability=float(row_dict.get("cell_viability") or 0),
                                ros=float(row_dict.get("ros") or 0),
                                ldh=float(row_dict.get("ldh") or 0),
                                apoptosis=float(row_dict.get("apoptosis") or 0),
                                toxicity_score=float(row_dict.get("toxicity_score") or 0),
                                risk_level=row_dict.get("risk_level", "Low"),
                                estimated_ic50=row_dict.get("estimated_ic50", "Not Reached"),
                                safe_range=row_dict.get("safe_range", ""),
                                csv_filename=row_dict.get("csv_filename", ""),
                                pdf_path=row_dict.get("pdf_path", ""),
                                graph_path=row_dict.get("graph_path", ""),
                                researcher_name=row_dict.get("researcher_name", ""),
                                exposure_time=row_dict.get("exposure_time", ""),
                                interpretation=row_dict.get("interpretation", ""),
                                tables_html=row_dict.get("tables_html", ""),
                                username=row_dict.get("username", ""),
                            )
                            db.session.add(h)
                            migrated_history += 1
                    db.session.commit()
                conn.close()
            except Exception as e:
                log(f"  WARN History migration error: {e}")
                db.session.rollback()

        log(f"  OK Migrated {migrated_history} history records")

        # ────────────────────────────────────────────────────
        # STEP 5: Create admin account from .env
        # ────────────────────────────────────────────────────
        log("Step 5: Seeding admin account...")
        admin_username = Config.ADMIN_USERNAME
        admin_email = Config.ADMIN_EMAIL
        admin_password = Config.ADMIN_PASSWORD

        existing_admin = User.query.filter_by(username=admin_username).first()
        if existing_admin:
            # Ensure role is correct
            if existing_admin.role_id != admin_role.id:
                existing_admin.role_id = admin_role.id
                existing_admin.is_verified = True
                existing_admin.is_active = True
                db.session.commit()
                log(f"  OK Promoted existing user '{admin_username}' to admin")
            else:
                log(f"  - Admin '{admin_username}' already exists, skipping")
        else:
            new_admin = User(
                username=admin_username,
                email=admin_email,
                password_hash=generate_password_hash(admin_password),
                role_id=admin_role.id,
                is_verified=True,
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.session.add(new_admin)
            db.session.commit()
            log(f"  OK Admin account created: {admin_username} / {admin_email}")

        # ────────────────────────────────────────────────────
        # STEP 6: Audit log
        # ────────────────────────────────────────────────────
        db.session.add(AuditLog(
            username="system",
            action="Database Migration",
            details=f"Migration completed: {migrated_legacy} users, {migrated_history} history records",
        ))
        db.session.commit()

        log("")
        log("=" * 50)
        log("Migration completed successfully!")
        log(f"  Legacy users migrated : {migrated_legacy}")
        log(f"  History records migrated: {migrated_history}")
        log(f"  Admin account: {admin_username} ({admin_email})")
        log("=" * 50)


if __name__ == "__main__":
    migrate()
