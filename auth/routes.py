"""
auth/routes.py — NanoSafe Analyzer: Firebase Authentication Routes

All user authentication (register, email verification, login, password reset)
is powered by Firebase Authentication Web SDK & Firebase Admin SDK.
Local SQLAlchemy User records are auto-synchronized upon Firebase token verification.
"""

import secrets
import bcrypt
from datetime import datetime, timedelta

from flask import (
    request, render_template, redirect, url_for,
    session, flash, current_app, jsonify,
)
from werkzeug.security import check_password_hash
from firebase_admin import auth as fb_auth

from . import auth_bp
from .validators import strong_password, valid_username, valid_email, sanitize_input
from models import db, User, Role, AuditLog, EmailVerificationToken, PasswordResetToken
from auth.email_service import send_verification_email, send_otp_email, send_password_reset_email
def hash_password_bcrypt(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password_bcrypt(password: str, stored_hash: str) -> bool:
    """Verify password against bcrypt hash or fallback to werkzeug check."""
    if not password or not stored_hash:
        return False
    if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$") or stored_hash.startswith("$2y$"):
        try:
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            return False
    return check_password_hash(stored_hash, password)


# ────────────────────────────────────────────────────────────
# ────────────────────────────────────────────────────────────
# OTP VERIFICATION ENDPOINTS
# ────────────────────────────────────────────────────────────
@auth_bp.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    """Verify the 6-digit OTP sent to the user's email."""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return redirect(url_for("auth.login"))

    if user.is_verified:
        return redirect(url_for("admin.dashboard") if user.is_admin else url_for("main.home"))

    if request.method == "GET":
        # Show dev OTP on screen only in development mode
        dev_otp = None
        is_dev = current_app.config.get("DEBUG") or not current_app.config.get("MAIL_USERNAME")
        if is_dev:
            dev_otp = session.pop("dev_otp", None)
        else:
            session.pop("dev_otp", None)
        return render_template("auth/verify_otp.html", email=user.email, error=None, dev_otp=dev_otp)

    otp = request.form.get("otp", "").strip()
    if not otp:
        return render_template("auth/verify_otp.html", email=user.email, error="Please enter the verification code.", dev_otp=None)

    # Find valid token and rate-limit incorrect attempts
    tokens = EmailVerificationToken.query.filter_by(user_id=user.id).all()
    valid_token = None
    locked = False
    for t in tokens:
        if t.expires_at > datetime.utcnow():
            if t.attempts >= 5:
                locked = True
                continue
            if verify_password_bcrypt(otp, t.otp_hash):
                valid_token = t
                break
            else:
                t.attempts += 1
                db.session.commit()
                if t.attempts >= 5:
                    locked = True

    if locked:
        return render_template("auth/verify_otp.html", email=user.email, error="Too many incorrect attempts. This verification code has been locked. Please click 'Resend OTP' to request a new code.", dev_otp=None)

    if not valid_token:
        return render_template("auth/verify_otp.html", email=user.email, error="Invalid or expired verification code. Please try again.", dev_otp=None)

    # Verify user
    user.is_verified = True
    user.is_active = True
    
    # Clean up tokens
    EmailVerificationToken.query.filter_by(user_id=user.id).delete()
    
    # Log audit
    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="Email Verified", details="User verified email via OTP",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    # Update session
    session["is_verified"] = True

    flash("Account verified successfully! Welcome to NanoSafe Analyzer.", "success")
    return redirect(url_for("auth.researcher_profile"))


@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    """Resend a new 6-digit OTP code with rate limiting."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = db.session.get(User, user_id)
    if not user or user.is_verified:
        return jsonify({"error": "Invalid request"}), 400

    # Rate limiting: max 3 active tokens within 15 minutes
    recent_tokens = EmailVerificationToken.query.filter_by(user_id=user.id)\
        .filter(EmailVerificationToken.created_at > datetime.utcnow() - timedelta(minutes=15)).count()
    if recent_tokens >= 3:
        return jsonify({"error": "Too many requests. Please wait 15 minutes before requesting again."}), 429

    # Generate new OTP
    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_password_bcrypt(otp_code)

    # Invalidate previous tokens
    EmailVerificationToken.query.filter_by(user_id=user.id).delete()

    token = EmailVerificationToken(
        user_id=user.id,
        otp_hash=otp_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.session.add(token)
    db.session.commit()

    email_sent = send_otp_email(user.email, otp_code)
    if email_sent:
        return jsonify({"success": True, "message": "A new verification code has been sent to your email."}), 200
    else:
        # No SMTP configured — return OTP in response so it can be shown on screen
        return jsonify({"success": True, "message": "No email server configured.", "dev_otp": otp_code}), 200



# ────────────────────────────────────────────────────────────
@auth_bp.route("/verify-login-otp", methods=["GET", "POST"])
def verify_login_otp():
    """Verify the 6-digit OTP sent to the user's email during login."""
    user_id = session.get("pending_user_id")
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return redirect(url_for("auth.login"))

    if request.method == "GET":
        dev_otp = None
        is_dev = current_app.config.get("DEBUG") or not current_app.config.get("MAIL_USERNAME")
        if is_dev:
            dev_otp = session.pop("dev_login_otp", None)
        else:
            session.pop("dev_login_otp", None)
        return render_template("auth/verify_login_otp.html", email=user.email, error=None, dev_otp=dev_otp)

    otp = request.form.get("otp", "").strip()
    if not otp:
        return render_template("auth/verify_login_otp.html", email=user.email, error="Please enter the verification code.")

    tokens = EmailVerificationToken.query.filter_by(user_id=user.id).all()
    valid_token = None
    locked = False
    for t in tokens:
        if t.expires_at > datetime.utcnow():
            if t.attempts >= 5:
                locked = True
                continue
            if verify_password_bcrypt(otp, t.otp_hash):
                valid_token = t
                break
            else:
                t.attempts += 1
                db.session.commit()
                if t.attempts >= 5:
                    locked = True

    if locked:
        return render_template("auth/verify_login_otp.html", email=user.email, error="Too many incorrect attempts. This verification code has been locked. Please click 'Resend OTP' to request a new code.")

    if not valid_token:
        return render_template("auth/verify_login_otp.html", email=user.email, error="Invalid or expired verification code.")

    EmailVerificationToken.query.filter_by(user_id=user.id).delete()
    
    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="Login Verified", details="User verified login via 2FA OTP",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    _set_session(user)
    session.pop("pending_user_id", None)
    
    # Process remember_me if it was checked during login
    if not (user.full_name and user.institution and user.research_role):
        response = redirect(url_for("auth.researcher_profile"))
    else:
        response = redirect(url_for("main.home"))
    if session.pop("pending_remember_me", False):
        token_val = secrets.token_urlsafe(64)
        user.remember_token = token_val
        db.session.commit()
        response.set_cookie("remember_token", token_val, max_age=30 * 86400, httponly=True, samesite="Lax")
    
    # As requested by user, redirect straight to new analysis page after 2FA login verification
    flash("Login verified successfully!", "success")
    return response


@auth_bp.route("/resend-login-otp", methods=["POST"])
def resend_login_otp():
    """Resend a new 6-digit OTP code for login."""
    user_id = session.get("pending_user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Invalid request"}), 400

    recent_tokens = EmailVerificationToken.query.filter_by(user_id=user.id)\
        .filter(EmailVerificationToken.created_at > datetime.utcnow() - timedelta(minutes=15)).count()
    if recent_tokens >= 3:
        return jsonify({"error": "Too many requests. Please wait 15 minutes before requesting again."}), 429

    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_password_bcrypt(otp_code)

    EmailVerificationToken.query.filter_by(user_id=user.id).delete()

    token = EmailVerificationToken(
        user_id=user.id,
        otp_hash=otp_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.session.add(token)
    db.session.commit()

    email_sent = send_otp_email(user.email, otp_code)
    if email_sent:
        return jsonify({"success": True, "message": "A new verification code has been sent to your email."}), 200
    else:
        # No SMTP configured — return OTP in response to show on screen
        return jsonify({"success": True, "message": "No email server configured.", "dev_otp": otp_code}), 200


# ────────────────────────────────────────────────────────────
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("auth/register.html", error=None)

    full_name = sanitize_input(request.form.get("full_name", ""), 120)
    username = sanitize_input(request.form.get("username", ""), 80)
    email = sanitize_input(request.form.get("email", ""), 254).lower()
    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")

    if password != confirm_password:
        return render_template("auth/register.html", error="Passwords do not match.")

    if len(password) < 8:
        return render_template("auth/register.html", error="Password must be at least 8 characters long.")

    if not username or not email:
        return render_template("auth/register.html", error="Username and email are required.")

    # Validate uniqueness
    from sqlalchemy import func
    if User.query.filter(func.lower(User.username) == username.lower()).first():
        return render_template("auth/register.html", error="Username already exists. Please choose a different username.")
    
    if User.query.filter(func.lower(User.email) == email.lower()).first():
        return render_template("auth/register.html", error="Email already registered. Please sign in or use a different email.")

    try:
        user_role = Role.query.filter_by(name="user").first()
        admin_role = Role.query.filter_by(name="admin").first()
        is_admin_email = (email.strip().lower() == "dhatrikaakepati@gmail.com")
        assigned_role_id = admin_role.id if (is_admin_email and admin_role) else (user_role.id if user_role else 1)

        user = User(
            full_name=full_name,
            username=username,
            email=email,
            password_hash=hash_password_bcrypt(password),
            role_id=assigned_role_id,
            is_verified=False,
            is_active=False
        )
        db.session.add(user)
        db.session.flush()  # Get user.id

        # Generate 6-digit OTP
        otp_code = f"{secrets.randbelow(1000000):06d}"
        otp_hash = hash_password_bcrypt(otp_code)

        token = EmailVerificationToken(
            user_id=user.id,
            otp_hash=otp_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.session.add(token)
        db.session.commit()

        # Send OTP — if email fails, do not abort/rollback registration
        email_sent = send_otp_email(user.email, otp_code)
        
        # Check if we are in development/offline mode (DEBUG is True or no SMTP configured)
        is_dev = current_app.config.get("DEBUG") or not current_app.config.get("MAIL_USERNAME")
        if not email_sent:
            if is_dev:
                session["dev_otp"] = otp_code
                current_app.logger.info("Development Mode: Generated OTP %s for %s", otp_code, user.username)
            else:
                flash("SMTP service unavailable. Please click 'Resend OTP' once the email server is online.", "warning")
        else:
            if is_dev:
                session["dev_otp"] = otp_code
                current_app.logger.info("Development Mode (Email Sent): Generated OTP %s for %s", otp_code, user.username)

        # Establish an unverified session
        _set_session(user)

        db.session.add(AuditLog(
            user_id=user.id, username=user.username,
            action="User Registered",
            details=f"New account created for {username} ({email}). OTP {'emailed' if email_sent else 'displayed (no SMTP)'}.",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()

        flash("Registration successful. Please verify your account.", "success")
        return redirect(url_for("auth.verify_otp"))

    except Exception as e:
        db.session.rollback()
        current_app.logger.error("register error: %s", e, exc_info=True)
        return render_template("auth/register.html", error="Server error during registration. Please try again.")


# ────────────────────────────────────────────────────────────
# LOGIN PAGE
# ────────────────────────────────────────────────────────────
@auth_bp.route("/login", methods=["GET", "POST"])
@auth_bp.route("/", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        # Check remember-me token
        token = request.cookies.get("remember_token")
        if token:
            user = User.query.filter_by(remember_token=token, is_active=True, is_verified=True).first()
            if user:
                _set_session(user)
                return redirect(url_for("admin.dashboard") if user.is_admin else url_for("main.home"))
        return render_template("auth/login.html", error=None)

    # Traditional form POST fallback (if client JS is disabled)
    username = sanitize_input(request.form.get("username", ""), 80)
    password = request.form.get("password", "")
    remember = request.form.get("remember_me") == "on"

    from sqlalchemy import func
    user = User.query.filter((func.lower(User.username) == username.lower()) | (User.email == username.lower())).first()

    if not user or not verify_password_bcrypt(password, user.password_hash):
        return render_template("auth/login.html", error="Invalid username or password.")

    if not user.is_verified:
        # Resend initial verification OTP and redirect to verification screen
        session["user_id"] = user.id
        otp_code = f"{secrets.randbelow(1000000):06d}"
        otp_hash = hash_password_bcrypt(otp_code)
        
        EmailVerificationToken.query.filter_by(user_id=user.id).delete()
        token_record = EmailVerificationToken(
            user_id=user.id,
            otp_hash=otp_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.session.add(token_record)
        db.session.commit()
        
        email_sent = send_otp_email(user.email, otp_code)
        if not email_sent:
            session["dev_otp"] = otp_code
            
        return redirect(url_for("auth.verify_otp"))

    if not user.is_active:
        return render_template("auth/login.html", error="Your account has been deactivated. Please contact support.")

    # Log the user in directly (no 2FA)
    _set_session(user)
    user.last_login = datetime.utcnow()
    
    # Check if researcher profile is complete
    is_profile_done = bool(user.is_profile_completed and user.full_name and user.institution and user.research_role)
    if user.is_admin:
        response = redirect(url_for("admin.dashboard"))
    elif not is_profile_done:
        flash("Welcome to NanoSafe Analyzer! Please complete your mandatory Researcher Profile Setup.", "info")
        response = redirect(url_for("auth.researcher_profile"))
    else:
        response = redirect(url_for("main.home"))
    
    if remember:
        token_val = secrets.token_urlsafe(64)
        user.remember_token = token_val
        response.set_cookie("remember_token", token_val, max_age=30 * 86400, httponly=True, samesite="Lax")
        
    db.session.commit()
    
    # Configure session lifetime (2 hours as per config)
    session.permanent = True
    
    # Log audit
    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="User Login", details="Direct login (no 2FA)",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()
    
    return response


# ────────────────────────────────────────────────────────────
# FORGOT PASSWORD PAGE
# ────────────────────────────────────────────────────────────
@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "GET":
        return render_template("auth/forgot_password.html", error=None, success=None)

    email = sanitize_input(request.form.get("username", request.form.get("email", "")), 254).lower()
    
    if not email:
        return render_template("auth/forgot_password.html", error="Please enter your email.")

    user = User.query.filter_by(email=email).first()
    
    if user:
        # Invalidate old tokens
        PasswordResetToken.query.filter_by(user_id=user.id).delete()

        # Generate new token
        token_val = secrets.token_urlsafe(32)
        token = PasswordResetToken(
            user_id=user.id,
            token=token_val,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.session.add(token)
        db.session.commit()

        reset_link = url_for("auth.reset_password", token=token_val, _external=True)
        send_password_reset_email(user.email, reset_link)

        db.session.add(AuditLog(
            user_id=user.id, username=user.username,
            action="Password Reset Requested",
            details="User requested a password reset email.",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()

    return render_template("auth/forgot_password.html", success="If an account exists with that email, a password reset link has been sent.")


# ────────────────────────────────────────────────────────────
# RESET PASSWORD PAGE
# ────────────────────────────────────────────────────────────
@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    reset_token = PasswordResetToken.query.filter_by(token=token).first()

    if not reset_token or reset_token.expires_at < datetime.utcnow():
        flash("The password reset link is invalid or has expired.", "error")
        return redirect(url_for("auth.login"))

    user = reset_token.user

    if request.method == "GET":
        return render_template("auth/reset_password.html", token=token, error=None)

    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")

    if password != confirm_password:
        return render_template("auth/reset_password.html", token=token, error="Passwords do not match.")

    ok, msg = strong_password(password)
    if not ok:
        return render_template("auth/reset_password.html", token=token, error=msg)

    # Reset password
    user.password_hash = hash_password_bcrypt(password)
    
    # Invalidate token
    db.session.delete(reset_token)
    
    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="Password Reset",
        details="User reset their password via email link.",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    flash("Your password has been successfully reset. You can now log in.", "success")
    return redirect(url_for("auth.login"))



# ────────────────────────────────────────────────────────────
# LOGOUT
# ────────────────────────────────────────────────────────────
@auth_bp.route("/logout")
def logout():
    user_id = session.get("user_id")
    username = session.get("username", "User")

    if user_id:
        user = db.session.get(User, user_id)
        if user:
            user.remember_token = None
            db.session.commit()

    db.session.add(AuditLog(
        user_id=user_id, username=username,
        action="User Logout", details="User logged out",
    ))
    db.session.commit()

    session.clear()
    response = redirect(url_for("auth.login"))
    response.delete_cookie("remember_token")
    return response

# ────────────────────────────────────────────────────────────
# LOGOUT ALL DEVICES
# ────────────────────────────────────────────────────────────
@auth_bp.route("/logout-all", methods=["POST"])
def logout_all_devices():
    user_id = session.get("user_id")
    username = session.get("username", "User")
    
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db.session.get(User, user_id)
    if user:
        # Invalidating the token logs out other devices using remember-me
        user.remember_token = None
        db.session.commit()

    db.session.add(AuditLog(
        user_id=user_id, username=username,
        action="Logout All Devices", details="User terminated all active sessions",
    ))
    db.session.commit()
    
    session.clear()
    response = redirect(url_for("auth.login"))
    response.delete_cookie("remember_token")
    flash("You have been successfully logged out of all devices.", "success")
    return response


# ────────────────────────────────────────────────────────────
# CHANGE PASSWORD (authenticated)
# ────────────────────────────────────────────────────────────
@auth_bp.route("/change-password", methods=["GET", "POST"])
def change_password():
    user_id = session.get("user_id")
    if not user_id:
        flash("Please login first.", "warning")
        return redirect(url_for("auth.login"))

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return redirect(url_for("auth.login"))

    if request.method == "GET":
        return render_template("auth/change_password.html", error=None, success=None)

    current_pw = request.form.get("current_password", "")
    new_pw = request.form.get("new_password", "")
    confirm = request.form.get("confirm_password", "")

    if not verify_password_bcrypt(current_pw, user.password_hash):
        return render_template("auth/change_password.html", error="Current password is incorrect.", success=None)

    ok, msg = strong_password(new_pw)
    if not ok:
        return render_template("auth/change_password.html", error=msg, success=None)

    if new_pw != confirm:
        return render_template("auth/change_password.html", error="Passwords do not match.", success=None)

    user.password_hash = hash_password_bcrypt(new_pw)
    db.session.commit()

    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="Password Changed", details="User changed their password",
    ))
    db.session.commit()

    return render_template("auth/change_password.html", error=None, success="Password changed successfully!")


# ────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────
def _set_session(user):
    """Populate session after successful login."""
    session["user_id"] = user.id
    session["username"] = user.username
    session["role"] = user.role  # "admin" or "user"
    session["is_verified"] = user.is_verified


@auth_bp.route("/researcher-profile", methods=["GET", "POST"])
def researcher_profile():
    """First-time Researcher Profile onboarding and credential configuration."""
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for("auth.login"))

    user = db.session.get(User, user_id)
    if not user:
        return redirect(url_for("auth.login"))

    if request.method == "GET":
        return render_template("auth/researcher_profile.html", user=user)

    # Mandatory fields
    title_salutation = request.form.get("title_salutation", "").strip()
    full_name = request.form.get("full_name", "").strip()
    institution = request.form.get("institution", "").strip()
    research_role = request.form.get("research_role", "").strip()
    research_field = request.form.get("research_field", "In-Vitro Toxicology & Biocompatibility").strip()

    if not title_salutation or not full_name or not institution or not research_role:
        flash("Please fill in all mandatory fields (Title, Legal Name, Institution, Role).", "danger")
        return render_template("auth/researcher_profile.html", user=user)

    user.title_salutation = title_salutation
    user.full_name = full_name
    user.institution = institution
    user.research_role = research_role
    user.research_field = research_field

    # Optional fields
    user.gender_pronouns = request.form.get("gender_pronouns", "").strip()
    user.date_of_birth = request.form.get("date_of_birth", "").strip()
    user.secondary_email = request.form.get("secondary_email", "").strip()
    user.office_address = request.form.get("office_address", "").strip()
    user.city_state = request.form.get("city_state", "").strip()
    user.country = request.form.get("country", "").strip()
    user.preferred_language = request.form.get("preferred_language", "en").strip()
    user.bio = request.form.get("bio", "").strip()

    # Handle Photo upload if provided
    photo_file = request.files.get("profile_photo")
    if photo_file and photo_file.filename:
        import os
        ext = os.path.splitext(photo_file.filename)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
            filename = f"user_{user.id}_{int(datetime.utcnow().timestamp())}{ext}"
            upload_folder = os.path.join(current_app.root_path, "static", "uploads", "avatars")
            os.makedirs(upload_folder, exist_ok=True)
            save_path = os.path.join(upload_folder, filename)
            photo_file.save(save_path)
            user.profile_photo = f"/static/uploads/avatars/{filename}"

    user.is_profile_completed = True
    db.session.commit()

    next_action = request.form.get("next_action", "patient")
    flash(f"Welcome, {title_salutation} {full_name}! Your researcher profile is configured and your workspace is ready.", "success")
    if next_action == "patient":
        return redirect(url_for("participants.patient_search"))
    elif next_action == "research":
        return redirect(url_for("main.upload", mode="personal"))
    return redirect(url_for("main.analysis_choice"))
