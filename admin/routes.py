"""
admin/routes.py — NanoSafe Analyzer: Admin Dashboard Routes

Separate admin dashboard with user management, system overview, and audit log.
All routes require admin role.
"""

import secrets

from flask import (
    request, render_template, redirect, url_for,
    flash, jsonify,
)
from werkzeug.security import generate_password_hash
from collections import defaultdict
from datetime import datetime

from . import admin_bp
from auth.decorators import admin_required, current_user_id, current_username
from auth.email_service import send_admin_password_reset
from models import (
    db, User, Role, History, Experiment, AuditLog, Report,
    StudyParticipant, BiologicalSample, SampleExperimentLink
)


# ────────────────────────────────────────────────────────────
# ADMIN DASHBOARD
# ────────────────────────────────────────────────────────────
@admin_bp.route("/dashboard")
@admin_required
def dashboard():
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    verified_users = User.query.filter_by(is_verified=True).count()
    unverified_users = total_users - verified_users
    total_experiments = History.query.count()
    total_reports = Report.query.count()

    # Risk breakdown
    high_risk = History.query.filter_by(risk_level="High").count()
    moderate_risk = History.query.filter_by(risk_level="Moderate").count()
    low_risk = History.query.filter_by(risk_level="Low").count()

    # Participant & Sample System-wide Statistics
    total_participants = StudyParticipant.query.count()
    consented_participants = StudyParticipant.query.filter_by(consent_status="Consented").count()
    pending_participants = StudyParticipant.query.filter_by(consent_status="Pending").count()
    withdrawn_participants = StudyParticipant.query.filter_by(consent_status="Withdrawn").count()
    consent_rate = round((consented_participants / total_participants * 100), 1) if total_participants > 0 else 0.0

    total_samples = BiologicalSample.query.count()
    active_samples = BiologicalSample.query.filter_by(sample_status="Active").count()
    completed_samples = BiologicalSample.query.filter_by(sample_status="Completed").count()
    processing_samples = BiologicalSample.query.filter_by(sample_status="Processing").count()
    archived_samples = BiologicalSample.query.filter_by(sample_status="Archived").count()
    linked_samples_count = db.session.query(SampleExperimentLink.sample_id).distinct().count()

    # Recent activity
    recent_logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(10).all()

    return render_template("admin/dashboard.html",
        username=current_username(),
        stats={
            "total_users": total_users,
            "active_users": active_users,
            "verified_users": verified_users,
            "unverified_users": unverified_users,
            "total_experiments": total_experiments,
            "total_reports": total_reports,
            "high_risk": high_risk,
            "moderate_risk": moderate_risk,
            "low_risk": low_risk,
            # Study Participants & Samples
            "total_participants": total_participants,
            "consented_participants": consented_participants,
            "pending_participants": pending_participants,
            "withdrawn_participants": withdrawn_participants,
            "consent_rate": consent_rate,
            "total_samples": total_samples,
            "active_samples": active_samples,
            "completed_samples": completed_samples,
            "processing_samples": processing_samples,
            "archived_samples": archived_samples,
            "linked_samples": linked_samples_count,
        },
        recent_logs=recent_logs,
    )


# ────────────────────────────────────────────────────────────
# ANALYTICS API FOR DASHBOARD CHARTS
# ────────────────────────────────────────────────────────────
@admin_bp.route("/analytics-data")
@admin_required
def analytics_data():
    users = User.query.all()
    histories = History.query.all()

    # Registrations per month
    regs_by_month = defaultdict(int)
    for u in users:
        if u.created_at:
            m = u.created_at.strftime("%Y-%m")
            regs_by_month[m] += 1

    # Experiments per month
    exps_by_month = defaultdict(int)
    cell_lines = defaultdict(int)
    risk_levels = {"Low": 0, "Moderate": 0, "High": 0}
    
    sum_ros, sum_ldh, sum_apo, sum_ic50, ic50_count = 0, 0, 0, 0, 0
    
    for h in histories:
        # Date parsing (date_time is typically string like "2023-10-25 14:30")
        try:
            if h.date_time:
                dt = datetime.strptime(h.date_time.split()[0], "%Y-%m-%d")
                exps_by_month[dt.strftime("%Y-%m")] += 1
        except Exception:
            pass

        if h.cell_line:
            cell_lines[h.cell_line] += 1
        if h.risk_level in risk_levels:
            risk_levels[h.risk_level] += 1
            
        sum_ros += h.ros or 0
        sum_ldh += h.ldh or 0
        sum_apo += h.apoptosis or 0
        
        # Parse IC50 numeric value if possible
        if h.estimated_ic50 and "µg/mL" in h.estimated_ic50:
            try:
                val = float(h.estimated_ic50.replace("µg/mL", "").strip())
                sum_ic50 += val
                ic50_count += 1
            except ValueError:
                pass

    total_h = len(histories) if len(histories) > 0 else 1
    averages = {
        "ros": round(sum_ros / total_h, 2),
        "ldh": round(sum_ldh / total_h, 2),
        "apoptosis": round(sum_apo / total_h, 2),
        "ic50": round(sum_ic50 / ic50_count, 2) if ic50_count > 0 else 0
    }

    # Sort months
    sorted_months = sorted(set(regs_by_month.keys()) | set(exps_by_month.keys()))
    
    # Participant & Sample Analytics
    consent_counts = {
        "Consented": StudyParticipant.query.filter_by(consent_status="Consented").count(),
        "Pending": StudyParticipant.query.filter_by(consent_status="Pending").count(),
        "Withdrawn": StudyParticipant.query.filter_by(consent_status="Withdrawn").count(),
    }

    sample_status_counts = {
        "Active": BiologicalSample.query.filter_by(sample_status="Active").count(),
        "Processing": BiologicalSample.query.filter_by(sample_status="Processing").count(),
        "Completed": BiologicalSample.query.filter_by(sample_status="Completed").count(),
        "Archived": BiologicalSample.query.filter_by(sample_status="Archived").count(),
    }

    sample_types = defaultdict(int)
    for s in BiologicalSample.query.all():
        st = s.sample_type or "Unspecified"
        sample_types[st] += 1

    return jsonify({
        "months": sorted_months,
        "registrations": [regs_by_month[m] for m in sorted_months],
        "experiments": [exps_by_month[m] for m in sorted_months],
        "cell_lines": dict(cell_lines),
        "risk_levels": risk_levels,
        "averages": averages,
        "consent_breakdown": consent_counts,
        "sample_status": sample_status_counts,
        "sample_types": dict(sample_types),
    })


# ────────────────────────────────────────────────────────────
# USER MANAGEMENT
# ────────────────────────────────────────────────────────────
@admin_bp.route("/users")
@admin_required
def users():
    search = request.args.get("search", "").strip()
    query = User.query
    if search:
        query = query.filter((User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))
    all_users = query.order_by(User.created_at.desc()).all()

    user_stats = {}
    for u in all_users:
        exp_count = Experiment.query.filter_by(user_id=u.id).count()
        rep_count = Report.query.join(Experiment).filter(Experiment.user_id == u.id).count()
        user_stats[u.id] = {"experiments": exp_count, "reports": rep_count}

    return render_template("admin/users.html",
        username=current_username(),
        users=all_users,
        search=search,
        user_stats=user_stats,
    )


@admin_bp.route("/users/<int:user_id>/toggle-active", methods=["POST"])
@admin_required
def toggle_active(user_id):
    user = User.query.get_or_404(user_id)

    # Don't let admin deactivate themselves
    if user.id == current_user_id():
        return jsonify({"error": "Cannot deactivate your own account"}), 400

    user.is_active = not user.is_active
    db.session.commit()

    action = "activated" if user.is_active else "deactivated"
    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action=f"User {action.title()}", details=f"{action.title()} user: {user.username}",
    ))
    db.session.commit()

    return jsonify({"success": True, "message": f"User '{user.username}' {action}.", "is_active": user.is_active})


@admin_bp.route("/users/<int:user_id>/toggle-verified", methods=["POST"])
@admin_required
def toggle_verified(user_id):
    user = User.query.get_or_404(user_id)
    user.is_verified = not user.is_verified
    db.session.commit()

    status = "verified" if user.is_verified else "unverified"
    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action=f"User {status.title()}", details=f"Set user {user.username} as {status}",
    ))
    return jsonify({"success": True, "message": f"User '{user.username}' marked as {status}.", "is_verified": user.is_verified})


@admin_bp.route("/users/<int:user_id>/clear-history", methods=["POST"])
@admin_required
def clear_user_history(user_id):
    user = User.query.get_or_404(user_id)
    history_count = History.query.filter_by(user_id=user.id).count()
    
    History.query.filter_by(user_id=user.id).delete()
    experiments = Experiment.query.filter_by(user_id=user.id).all()
    for exp in experiments:
        db.session.delete(exp)
    db.session.commit()

    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action="Clear User History", details=f"Cleared {history_count} history records for user: {user.username} ({user.email})",
    ))
    db.session.commit()

    return jsonify({"success": True, "message": f"Successfully cleared history for user '{user.username}'."})


@admin_bp.route("/users/<int:user_id>/change-role", methods=["POST"])
@admin_required
def change_role(user_id):
    user = User.query.get_or_404(user_id)

    if user.id == current_user_id():
        return jsonify({"error": "Cannot change your own role"}), 400

    new_role_name = request.form.get("role", "user")
    role = Role.query.filter_by(name=new_role_name).first()
    if not role:
        return jsonify({"error": f"Role '{new_role_name}' not found"}), 400

    user.role_id = role.id
    db.session.commit()

    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action="Role Changed", details=f"Changed {user.username} role to {new_role_name}",
    ))
    db.session.commit()

    return jsonify({"success": True, "message": f"User '{user.username}' role changed to '{new_role_name}'."})


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@admin_required
def reset_user_password(user_id):
    user = User.query.get_or_404(user_id)

    new_password = secrets.token_urlsafe(12) + "!A1"
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    # Try to send email
    if user.email:
        send_admin_password_reset(user.email, new_password)

    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action="Admin Password Reset", details=f"Reset password for user: {user.username}",
    ))
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Password reset initiated for '{user.username}'. Instructions have been sent to their email.",
    })


@admin_bp.route("/users/<int:user_id>/delete", methods=["POST"])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)

    if user.id == current_user_id():
        return jsonify({"error": "Cannot delete your own account."}), 400

    # Delete history
    History.query.filter_by(user_id=user.id).delete()
    
    # Delete everything cascaded through user.experiments (Experiments, Results, Reports)
    experiments = Experiment.query.filter_by(user_id=user.id).all()
    for exp in experiments:
        db.session.delete(exp)
        
    db.session.delete(user)
    db.session.commit()

    db.session.add(AuditLog(
        user_id=current_user_id(), username=current_username(),
        action="User Deleted", details=f"Completely deleted user: {user.username} ({user.email})",
    ))
    db.session.commit()

    return jsonify({"success": True, "message": f"Successfully deleted user '{user.username}' and all associated data."})


# ────────────────────────────────────────────────────────────
# ALL EXPERIMENTS (admin can see everything)
# ────────────────────────────────────────────────────────────
@admin_bp.route("/experiments")
@admin_required
def all_experiments():
    page = int(request.args.get("page", 1))
    per_page = 20
    query = History.query.order_by(History.id.desc())
    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    experiments = query.offset((page - 1) * per_page).limit(per_page).all()

    return render_template("admin/experiments.html",
        username=current_username(),
        experiments=[e.to_dict() for e in experiments],
        page=page, total_pages=total_pages, total_count=total,
    )


# ────────────────────────────────────────────────────────────
# AUDIT LOG
# ────────────────────────────────────────────────────────────
@admin_bp.route("/audit-log")
@admin_required
def audit_log():
    page = int(request.args.get("page", 1))
    per_page = 30
    query = AuditLog.query.order_by(AuditLog.timestamp.desc())
    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)
    logs = query.offset((page - 1) * per_page).limit(per_page).all()

    return render_template("admin/audit_log.html",
        username=current_username(),
        logs=logs,
        page=page, total_pages=total_pages, total_count=total,
    )


# ────────────────────────────────────────────────────────────
# ML MODELS & RETRAINING CONSOLE
# ────────────────────────────────────────────────────────────
@admin_bp.route("/ml-models")
@admin_required
def ml_models():
    import json
    import os
    metrics = None
    metrics_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "model_metrics.json")
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                metrics = json.load(f)
        except Exception:
            pass

    return render_template("admin/ml_models.html",
        username=current_username(),
        metrics=metrics,
    )


@admin_bp.route("/ml-models/retrain", methods=["POST"])
@admin_required
def retrain_ml_models():
    try:
        from model.train_model import train_and_save_model
        from services.ml_predictor import ml_predictor

        train_and_save_model()
        ml_predictor._load_resources()

        db.session.add(AuditLog(
            user_id=current_user_id(), username=current_username(),
            action="ML Models Retrained", details="Administrator triggered local offline model retraining on dataset",
        ))
        db.session.commit()
        flash("⚡ Local Multi-Model Machine Learning suite retrained and reloaded successfully!", "success")
    except Exception as e:
        flash(f"Model retraining failed: {e}", "danger")

    return redirect(url_for("admin.ml_models"))
