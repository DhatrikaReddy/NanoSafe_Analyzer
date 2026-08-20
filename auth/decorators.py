"""
auth/decorators.py — NanoSafe Analyzer: RBAC Decorators

Usage:
  @login_required     — any authenticated user
  @admin_required     — role must be 'admin'
  @user_required      — role must be 'user' (not admin)
  @verified_required  — user must have verified email
"""

from functools import wraps
from flask import session, redirect, url_for, flash, request, jsonify


def _is_logged_in() -> bool:
    return "user_id" in session


def _is_admin() -> bool:
    return session.get("role") == "admin"


def _is_verified() -> bool:
    return session.get("is_verified", False)


def _is_user_active() -> bool:
    if "user_id" not in session:
        return False
    from models import db, User
    user = db.session.get(User, session["user_id"])
    if not user or not user.is_active:
        session.clear()
        return False
    return True


def _is_mobile_request() -> bool:
    return (request.path.startswith("/mobile/") or
            request.accept_mimetypes.best == "application/json" or
            request.headers.get("Authorization", "").startswith("Bearer "))


def login_required(f):
    """Require any authenticated session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _is_logged_in() or not _is_user_active():
            if _is_mobile_request():
                return jsonify({"error": "Authentication required"}), 401
            flash("Please log in to continue.", "warning")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def verified_required(f):
    """Require email-verified account."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _is_logged_in() or not _is_user_active():
            if _is_mobile_request():
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        if not _is_verified():
            if _is_mobile_request():
                return jsonify({"error": "Email verification required"}), 403
            flash("Please verify your email address first.", "warning")
            return redirect(url_for("auth.verify_otp"))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Require admin role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _is_logged_in() or not _is_user_active():
            if _is_mobile_request():
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        if not _is_admin():
            if _is_mobile_request():
                return jsonify({"error": "Administrator access required"}), 403
            return redirect(url_for("main.home"))
        return f(*args, **kwargs)
    return decorated


def user_required(f):
    """Require non-admin researcher role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _is_logged_in() or not _is_user_active():
            if _is_mobile_request():
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        if _is_admin():
            if _is_mobile_request():
                return jsonify({"error": "User (non-admin) access only"}), 403
            return redirect(url_for("admin.dashboard"))
        return f(*args, **kwargs)
    return decorated


def profile_completed_required(f):
    """Require completed researcher profile before accessing analysis/research features."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not _is_logged_in() or not _is_user_active():
            if _is_mobile_request():
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        if _is_admin():
            return f(*args, **kwargs)
        from models import db, User
        user = db.session.get(User, session["user_id"])
        if not user or not user.is_profile_completed or not (user.full_name and user.institution and user.research_role):
            if _is_mobile_request():
                return jsonify({"error": "Researcher Profile Setup required", "requires_profile": True}), 403
            flash("Please complete your Researcher Profile Setup before accessing the research workspace.", "info")
            return redirect(url_for("auth.researcher_profile"))
        return f(*args, **kwargs)
    return decorated


def current_user_id() -> int | None:
    """Return the logged-in user's ID from session, or None."""
    return session.get("user_id")


def current_username() -> str:
    """Return the logged-in username from session."""
    return session.get("username", "User")


def current_role() -> str:
    """Return the logged-in user's role."""
    return session.get("role", "user")

