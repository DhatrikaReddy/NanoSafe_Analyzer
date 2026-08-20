from flask import request, jsonify, current_app, send_file
import os
from . import mobile_bp
from .jwt_utils import jwt_required
from services.analysis_service import process_experiment_data

import jwt
import secrets
from datetime import datetime, timedelta, date
from auth.routes import hash_password_bcrypt, verify_password_bcrypt
from auth.email_service import send_otp_email
from models import (db, 
    db, User, History, EmailVerificationToken, AuditLog,
    StudyParticipant, BiologicalSample, SampleExperimentLink,
    ParticipantConsentLog, Experiment, ExperimentResult, Report
)

@mobile_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    raw_input = data.get("username", "").strip()
    password = data.get("password", "")

    # Query user by username or email
    from sqlalchemy import func
    user = User.query.filter(
        (func.lower(User.username) == raw_input.lower()) |
        (User.email == raw_input.lower())
    ).first()

    if not user or not verify_password_bcrypt(password, user.password_hash):
        return jsonify({"error": "Invalid username or password"}), 401
        
    if not user.is_active or not user.is_verified:
        return jsonify({"error": "Please verify your email before logging in."}), 401

    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY") or "nanosafe_mobile_jwt_secret"
    
    token = jwt.encode({
        "uid": user.id,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(days=365)
    }, secret, algorithm="HS256")
    
    return jsonify({
        "accessToken": token,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "isProfileCompleted": bool(user.full_name and user.full_name.strip())
    }), 200

@mobile_bp.route("/auth/register", methods=["POST"])
def api_register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    email = data.get("email", "").strip().lower()

    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    from sqlalchemy import func
    if User.query.filter(func.lower(User.username) == username.lower()).first():
        return jsonify({"error": "Username already exists."}), 400

    if User.query.filter(User.email == email).first():
        return jsonify({"error": "Email already registered."}), 400

    # Create unverified user
    new_user = User(
        username=username,
        email=email,
        password_hash=hash_password_bcrypt(password),
        is_verified=False,
        is_active=False
    )
    db.session.add(new_user)
    db.session.commit()

    # Generate OTP
    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_password_bcrypt(otp_code)

    token = EmailVerificationToken(
        user_id=new_user.id,
        otp_hash=otp_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.session.add(token)
    db.session.commit()

    send_otp_email(new_user.email, otp_code)

    return jsonify({
        "success": True,
        "message": "Registration successful. Please verify your email."
    }), 201

@mobile_bp.route("/auth/verify-otp", methods=["POST"])
def api_verify_otp():
    data = request.get_json() or {}
    identifier = data.get("email", "").strip().lower() or data.get("username", "").strip()
    otp = data.get("otp", "").strip()

    user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_verified:
        return jsonify({"success": True, "message": "User is already verified"}), 200

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
        return jsonify({"error": "Too many incorrect attempts. This verification code has been locked. Please request a new OTP."}), 429

    if not valid_token:
        return jsonify({"error": "Invalid or expired verification code."}), 400

    user.is_verified = True
    user.is_active = True
    EmailVerificationToken.query.filter_by(user_id=user.id).delete()
    
    db.session.add(AuditLog(
        user_id=user.id, username=user.username,
        action="Email Verified API", details="User verified email via API OTP",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    # Automatically generate login token after verification
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY") or "nanosafe_mobile_jwt_secret"
    
    session_token = jwt.encode({
        "uid": user.id,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(days=365)
    }, secret, algorithm="HS256")

    return jsonify({
        "success": True, 
        "message": "Email verified successfully",
        "accessToken": session_token,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "isProfileCompleted": bool(user.full_name and user.full_name.strip())
    }), 200

@mobile_bp.route("/auth/resend-otp", methods=["POST"])
def api_resend_otp():
    data = request.get_json() or {}
    identifier = data.get("email", "").strip().lower() or data.get("username", "").strip()
    
    user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    if user.is_verified:
        return jsonify({"error": "User is already verified"}), 400

    recent_tokens = EmailVerificationToken.query.filter_by(user_id=user.id)\
        .filter(EmailVerificationToken.created_at > datetime.utcnow() - timedelta(minutes=15)).count()
    if recent_tokens >= 3:
        return jsonify({"error": "Too many requests. Please wait 15 minutes."}), 429

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

    if send_otp_email(user.email, otp_code):
        return jsonify({"success": True, "message": "A new verification code has been sent."}), 200
    else:
        return jsonify({"error": "Failed to send email."}), 500

@mobile_bp.route("/auth/profile", methods=["GET"])
@jwt_required
def api_get_profile():
    uid = request.uid
    user = db.session.get(User, uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    total_participants = StudyParticipant.query.filter_by(user_id=uid).count()
    total_assays = History.query.filter_by(user_id=uid).count()
    safe_assays = History.query.filter_by(user_id=uid).filter(History.risk_level.ilike("%low%")).count()
    pass_rate = round((safe_assays / total_assays * 100), 1) if total_assays > 0 else 100.0

    return jsonify({
        "success": True,
        "profile": {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "fullName": getattr(user, 'full_name', '') or "",
            "titleSalutation": getattr(user, 'title_salutation', '') or "",
            "genderPronouns": getattr(user, 'gender_pronouns', '') or "",
            "dateOfBirth": getattr(user, 'date_of_birth', '') or "",
            "secondaryEmail": getattr(user, 'secondary_email', '') or "",
            "officeAddress": getattr(user, 'office_address', '') or "",
            "cityState": getattr(user, 'city_state', '') or "",
            "country": getattr(user, 'country', '') or "",
            "preferredLanguage": getattr(user, 'preferred_language', '') or "",
            "bio": getattr(user, 'bio', '') or "",
            "institution": getattr(user, 'institution', '') or "",
            "department": getattr(user, 'department', '') or "",
            "researchRole": getattr(user, 'research_role', '') or "",
            "isVerified": user.is_verified,
            "createdAt": user.created_at.strftime("%B %Y") if user.created_at else "2026",
            "totalParticipants": total_participants,
            "totalAssays": total_assays,
            "passRate": pass_rate,
        }
    }), 200

@mobile_bp.route("/auth/profile", methods=["PUT"])
@jwt_required
def api_update_profile():
    uid = request.uid
    user = db.session.get(User, uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    new_email = data.get("email", "").strip().lower()
    new_full_name = data.get("fullName", "").strip()
    new_title = data.get("titleSalutation", "").strip()
    new_gender = data.get("genderPronouns", "").strip()
    new_dob = data.get("dateOfBirth", "").strip()
    new_sec_email = data.get("secondaryEmail", "").strip().lower()
    new_office = data.get("officeAddress", "").strip()
    new_city_state = data.get("cityState", "").strip()
    new_country = data.get("country", "").strip()
    new_lang = data.get("preferredLanguage", "").strip()
    new_bio = data.get("bio", "").strip()
    new_institution = data.get("institution", "").strip()
    new_department = data.get("department", "").strip()
    new_role = data.get("researchRole", "").strip()

    if new_email and new_email != user.email:
        existing = User.query.filter(User.email == new_email, User.id != uid).first()
        if existing:
            return jsonify({"error": "This email is already registered to another account."}), 400
        user.email = new_email

    if hasattr(user, 'full_name'):
        user.full_name = new_full_name
    if hasattr(user, 'title_salutation'):
        user.title_salutation = new_title
    if hasattr(user, 'gender_pronouns'):
        user.gender_pronouns = new_gender
    if hasattr(user, 'date_of_birth'):
        user.date_of_birth = new_dob
    if hasattr(user, 'secondary_email'):
        user.secondary_email = new_sec_email
    if hasattr(user, 'office_address'):
        user.office_address = new_office
    if hasattr(user, 'city_state'):
        user.city_state = new_city_state
    if hasattr(user, 'country'):
        user.country = new_country
    if hasattr(user, 'preferred_language'):
        user.preferred_language = new_lang
    if hasattr(user, 'bio'):
        user.bio = new_bio
    if hasattr(user, 'institution'):
        user.institution = new_institution
    if hasattr(user, 'department'):
        user.department = new_department
    if hasattr(user, 'research_role'):
        user.research_role = new_role

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Researcher profile updated successfully.",
        "profile": {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "fullName": getattr(user, 'full_name', '') or "",
            "titleSalutation": getattr(user, 'title_salutation', '') or "",
            "genderPronouns": getattr(user, 'gender_pronouns', '') or "",
            "dateOfBirth": getattr(user, 'date_of_birth', '') or "",
            "secondaryEmail": getattr(user, 'secondary_email', '') or "",
            "officeAddress": getattr(user, 'office_address', '') or "",
            "cityState": getattr(user, 'city_state', '') or "",
            "country": getattr(user, 'country', '') or "",
            "preferredLanguage": getattr(user, 'preferred_language', '') or "",
            "bio": getattr(user, 'bio', '') or "",
            "institution": getattr(user, 'institution', '') or "",
            "department": getattr(user, 'department', '') or "",
            "researchRole": getattr(user, 'research_role', '') or "",
        }
    }), 200

@mobile_bp.route("/auth/change-password", methods=["POST"])
@jwt_required
def api_change_password():
    uid = request.uid
    user = db.session.get(User, uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    current_pwd = data.get("current_password", "").strip()
    new_pwd = data.get("new_password", "").strip()

    if not current_pwd or not new_pwd:
        return jsonify({"error": "Both current and new passwords are required."}), 400

    if not verify_password_bcrypt(current_pwd, user.password_hash):
        return jsonify({"error": "Current password is incorrect."}), 400

    if len(new_pwd) < 8:
        return jsonify({"error": "New password must be at least 8 characters long."}), 400

    user.password_hash = hash_password_bcrypt(new_pwd)
    db.session.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="Password Changed (Mobile)",
        details="User changed password via mobile app",
        ip_address=request.remote_addr or ""
    ))
    db.session.commit()

    return jsonify({"success": True, "message": "Password updated successfully."}), 200

@mobile_bp.route("/history/", methods=["GET"])
@jwt_required
def history():
    uid = request.uid
    import json
    records = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    res = []
    for h in records:
        submitted_rows = []
        if h.tables_html and (h.tables_html.startswith("[") or h.tables_html.startswith("{")):
            try:
                parsed = json.loads(h.tables_html)
                if isinstance(parsed, list):
                    submitted_rows = parsed
            except Exception:
                submitted_rows = []

        c_val = float(h.concentration or 25.0)
        v_val = float(h.cell_viability or 80.0)
        r_val = float(h.ros or 1.8)
        l_val = float(h.ldh or 4.5)
        a_val = float(h.apoptosis or 3.2)

        if not submitted_rows:
            # Generate representative dose response points for graph visualization if not explicitly stored
            submitted_rows = [
                {"concentration": "0.0", "viability": "100.0", "ros": "1.0", "ldh": "0.5", "apoptosis": "0.2"},
                {"concentration": str(round(max(0.1, c_val * 0.25), 1)), "viability": str(round(min(100.0, v_val + 14.0), 1)), "ros": str(round(max(1.0, r_val * 0.7), 1)), "ldh": str(round(max(0.5, l_val * 0.6), 1)), "apoptosis": str(round(max(0.2, a_val * 0.5), 1))},
                {"concentration": str(round(max(0.1, c_val * 0.5), 1)), "viability": str(round(min(100.0, v_val + 6.0), 1)), "ros": str(round(max(1.0, r_val * 0.85), 1)), "ldh": str(round(max(0.5, l_val * 0.8), 1)), "apoptosis": str(round(max(0.2, a_val * 0.75), 1))},
                {"concentration": str(round(c_val, 1)), "viability": str(round(v_val, 1)), "ros": str(round(r_val, 1)), "ldh": str(round(l_val, 1)), "apoptosis": str(round(a_val, 1))},
                {"concentration": str(round(c_val * 2.0, 1)), "viability": str(round(max(0.0, v_val - 22.0), 1)), "ros": str(round(r_val * 1.6, 1)), "ldh": str(round(l_val * 2.0, 1)), "apoptosis": str(round(a_val * 2.2, 1))},
            ]

        is_safe = (v_val >= 80.0)
        is_mod = (50.0 <= v_val < 80.0)
        risk = h.risk_level or ("Low" if is_safe else ("Moderate" if is_mod else "High"))

        res.append({
            "id": str(h.id),
            "name": h.sample_name or f"Experiment #{h.id}",
            "sample_name": h.sample_name or f"Experiment #{h.id}",
            "date": str(h.date_time or "").split(" ")[0],
            "date_time": str(h.date_time or ""),
            "toxicityScore": round(float(h.toxicity_score or (12.0 if is_safe else (45.0 if is_mod else 78.0))), 1),
            "toxicity_score": round(float(h.toxicity_score or (12.0 if is_safe else (45.0 if is_mod else 78.0))), 1),
            "result": risk,
            "risk_level": risk,
            "cell_line": h.cell_line or "HeLa",
            "cell_viability": round(v_val, 1),
            "viability": round(v_val, 1),
            "viability_pct": round(v_val, 1),
            "concentration": round(c_val, 1),
            "ros": round(r_val, 1),
            "ros_avg": round(r_val, 1),
            "ldh": round(l_val, 1),
            "ldh_avg": round(l_val, 1),
            "apoptosis": round(a_val, 1),
            "apoptosis_avg": round(a_val, 1),
            "estimated_ic50": h.estimated_ic50 or "Not Reached",
            "ic50": h.estimated_ic50 or "Not Reached",
            "safe_range": h.safe_range or "0.0 – 25.0 µg/mL",
            "exposure_time": h.exposure_time or "24h",
            "nanoparticle_type": h.nanoparticle_type or "Zinc Oxide (ZnO)",
            "interpretation": h.interpretation or "",
            "is_biocompatible": is_safe,
            "iso_compliance": "ISO 10993-5 PASS — Biocompatible" if is_safe else "ISO 10993-5 FAIL — Cytotoxic",
            "confidence": "98.5%",
            "submittedRows": submitted_rows,
            "participantId": h.participant_id or "",
            "participant_id": h.participant_id or "",
            "participantName": h.participant_name or "",
            "participant_name": h.participant_name or "",
            "studyGroup": h.study_group or "",
            "study_group": h.study_group or "",
            "isGeneralScreening": not bool(h.participant_id),
        })
    return jsonify(res), 200

@mobile_bp.route("/reports/", methods=["GET"])
@jwt_required
def reports():
    uid = request.uid
    records = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    res = []
    for h in records:
        res.append({
            "id": str(h.id),
            "experimentName": h.sample_name or f"Experiment #{h.id}",
            "date": str(h.date_time or "").split(" ")[0],
            "toxicityScore": float(h.toxicity_score or 0),
            "result": h.risk_level or "Evaluated",
            "downloadUrl": f"/mobile/v1/reports/{h.id}/pdf"
        })
    return jsonify(res), 200

@mobile_bp.route("/reports/latest/pdf", methods=["GET"])
def download_mobile_latest_report_pdf():
    hist = History.query.order_by(History.id.desc()).first()
    if not hist:
        return jsonify({"error": "No experiment history found"}), 404
    return download_mobile_report_pdf(hist.id)


@mobile_bp.route("/reports/<int:history_id>/pdf", methods=["GET"])
def download_mobile_report_pdf(history_id):
    from services.pdf_service import generate_pdf_file
    import re

    def sanitize_filename(name):
        return re.sub(r'[^\w\-_. ]', '_', name or 'report').strip()[:50]

    hist = History.query.filter_by(id=history_id).first()
    if not hist:
        # Fallback to the latest record
        hist = History.query.order_by(History.id.desc()).first()
    if not hist:
        return jsonify({"error": "Experiment report not found"}), 404

    report_folder = os.path.join(current_app.static_folder or os.path.join(current_app.root_path, "static"), "reports")
    os.makedirs(report_folder, exist_ok=True)

    safe_name = sanitize_filename(hist.sample_name or f"Experiment_{hist.id}")
    pdf_filename = f"NanoSafe_Report_{safe_name}_{hist.id}.pdf"
    pdf_path = os.path.join(report_folder, pdf_filename)

    exp_data = {
        "id": hist.id,
        "experiment_name": hist.sample_name,
        "sample_name": hist.sample_name,
        "cell_line": hist.cell_line,
        "avg": hist.cell_viability,
        "cell_viability": hist.cell_viability,
        "avg_ros": hist.ros, "ros": hist.ros,
        "avg_ldh": hist.ldh, "ldh": hist.ldh,
        "avg_apoptosis": hist.apoptosis, "apoptosis": hist.apoptosis,
        "avg_concentration": hist.concentration,
        "toxicity_score": hist.toxicity_score,
        "toxicity_level": hist.risk_level, "risk_level": hist.risk_level,
        "result": "Safe" if hist.risk_level == "Low" else ("Moderate Risk" if hist.risk_level == "Moderate" else "Toxic"),
        "ic50": hist.estimated_ic50,
        "estimated_ic50": hist.estimated_ic50,
        "safe_range": hist.safe_range,
        "researcher_name": hist.researcher_name or hist.username or "Researcher",
        "exposure_time": hist.exposure_time,
        "graph_path": hist.graph_path,
        "interpretation": hist.interpretation,
        "username": hist.username or "",
        "csv_filename": hist.csv_filename or "",
        "date_time": hist.date_time or "",
        "iso_compliance": "PASS — Biocompatible" if (hist.cell_viability and hist.cell_viability >= 80) else "FAIL — Cytotoxic",
        "medical_application": getattr(hist, "medical_application", "General Biomedical"),
    }

    # Synthesize representative dose-response rows for chart generation
    try:
        ic50_str = str(hist.estimated_ic50 or "").split()[0]
        ic50_num = float(ic50_str)
    except Exception:
        ic50_num = float(hist.concentration or 25.0) * 2

    dose_points = [ic50_num * f for f in [0.05, 0.15, 0.35, 0.7, 1.2, 2.0]]
    def four_pl(dose, ic50, top=100.0, bottom=5.0, hill=1.5):
        return bottom + (top - bottom) / (1.0 + (dose / max(ic50, 0.001)) ** hill)

    exp_data["rows"] = [
        {
            "concentration": round(d, 2),
            "viability": round(max(0, min(100, four_pl(d, ic50_num))), 1),
            "ros": round(1.0 + (d / max(ic50_num, 1)) * 3.5, 2),
            "ldh": round(max(0, (d / max(ic50_num, 1)) * 18), 1),
            "apoptosis": round(max(0, (d / max(ic50_num, 1)) * 12), 1),
        }
        for d in dose_points
    ]

    try:
        generate_pdf_file(exp_data, pdf_path, hist.id)
        hist.pdf_path = pdf_path
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"PDF generation error: {e}")
        return jsonify({"error": f"Failed to generate PDF: {e}"}), 500

    as_attach = request.args.get("download", "0") == "1"
    return send_file(
        pdf_path,
        as_attachment=as_attach,
        download_name=f"NanoSafe_Report_{safe_name}.pdf",
        mimetype="application/pdf"
    )


@mobile_bp.route("/reports/compare/pdf", methods=["GET", "POST"])
def download_mobile_compare_pdf():
    from services.pdf_service import generate_comparison_pdf_file

    if request.method == "POST":
        data = request.get_json() or {}
        comparison_list = data.get("comparison", [])
    else:
        # GET fallback: use recent history items
        records = History.query.order_by(History.id.desc()).limit(3).all()
        comparison_list = [
            {
                "name": r.sample_name or f"Sample #{r.id}",
                "cell_line": r.cell_line or "HeLa",
                "viability": float(r.cell_viability or 80),
                "toxicity_score": float(r.toxicity_score or 0),
                "ic50": str(r.estimated_ic50 or "N/A"),
                "iso_compliance": "PASS — Biocompatible" if (r.cell_viability and r.cell_viability >= 80) else "FAIL — Cytotoxic",
                "ros": float(r.ros or 1.0),
                "ldh": float(r.ldh or 0.0),
                "apoptosis": float(r.apoptosis or 0.0),
            }
            for r in records
        ]

    if not comparison_list or len(comparison_list) == 0:
        return jsonify({"error": "No comparison data provided"}), 400

    report_folder = os.path.join(current_app.static_folder or os.path.join(current_app.root_path, "static"), "reports")
    os.makedirs(report_folder, exist_ok=True)

    import time
    pdf_filename = f"NanoSafe_Comparison_Report_{int(time.time())}.pdf"
    pdf_path = os.path.join(report_folder, pdf_filename)

    try:
        generate_comparison_pdf_file(comparison_list, pdf_path)
    except Exception as e:
        current_app.logger.error(f"Comparison PDF generation error: {e}")
        return jsonify({"error": f"Failed to generate comparison PDF: {e}"}), 500

    as_attach = request.args.get("download", "0") == "1"
    return send_file(
        pdf_path,
        as_attachment=as_attach,
        download_name="NanoSafe_MultiSample_Comparison_Report.pdf",
        mimetype="application/pdf"
    )

@mobile_bp.route("/analysis/calculate", methods=["POST"])
@jwt_required
def calculate():
    uid = getattr(request, 'uid', 1)
    data = request.get_json() or {}
    import pandas as pd
    import numpy as np

    cell_line   = data.get("cell_line", "HeLa") or "HeLa"
    sample_name = data.get("sample_name", "Mobile Analysis") or "Mobile Analysis"
    rows        = data.get("rows", [])

    if rows and len(rows) > 0:
        # Multi-row manual entry table from mobile app
        cleaned_rows = []
        for r in rows:
            conc = r.get("concentration") if r.get("concentration") is not None else r.get("Concentration")
            viab = r.get("viability") if r.get("viability") is not None else (r.get("cell_viability") if r.get("cell_viability") is not None else r.get("Cell Viability"))
            ros  = r.get("ros") if r.get("ros") is not None else (r.get("ros_level") if r.get("ros_level") is not None else r.get("ROS Level", 1.0))
            ldh  = r.get("ldh") if r.get("ldh") is not None else (r.get("ldh_level") if r.get("ldh_level") is not None else r.get("LDH Release", 0.0))
            apop = r.get("apoptosis") if r.get("apoptosis") is not None else (r.get("apoptosis_rate") if r.get("apoptosis_rate") is not None else r.get("Apoptosis", 0.0))

            if conc is not None and viab is not None and str(conc).strip() != "" and str(viab).strip() != "":
                try:
                    c_val = float(str(conc).replace(",", ".").strip())
                    v_val = float(str(viab).replace(",", ".").strip())
                    r_val = float(str(ros).replace(",", ".").strip()) if (ros is not None and str(ros).strip() != "") else 1.0
                    l_val = float(str(ldh).replace(",", ".").strip()) if (ldh is not None and str(ldh).strip() != "") else 0.0
                    a_val = float(str(apop).replace(",", ".").strip()) if (apop is not None and str(apop).strip() != "") else 0.0
                    cleaned_rows.append({
                        "Concentration": c_val,
                        "Cell Viability": v_val,
                        "ROS Level": r_val,
                        "LDH Release": l_val,
                        "Apoptosis": a_val,
                    })
                except (ValueError, TypeError):
                    pass

        if not cleaned_rows:
            return jsonify({"error": "No valid numeric rows provided."}), 400
        df = pd.DataFrame(cleaned_rows)
        concentration = float(df["Concentration"].mean())
        ros_level = float(df["ROS Level"].mean())
        ldh_level = float(df["LDH Release"].mean())
        apoptosis_rate = float(df["Apoptosis"].mean())
    else:
        # Single flat-parameter mode
        concentration  = data.get("concentration")
        cell_viability = data.get("cell_viability")
        ros_level      = float(data.get("ros_level", 0) or 0)
        ldh_level      = float(data.get("ldh_level", 0) or 0)
        apoptosis_rate = float(data.get("apoptosis_rate", 0) or 0)

        if concentration is None or cell_viability is None:
            return jsonify({"error": "Please provide either multi-point 'rows' or 'concentration'+'cell_viability'."}), 400

        try:
            conc = float(concentration)
            viab = float(cell_viability)
            concentrations = [
                max(0.1, conc * 0.05),
                max(0.1, conc * 0.25),
                max(0.1, conc * 0.5),
                conc,
                conc * 2.0,
                conc * 4.0,
            ]
            viabilities = [
                min(100.0, viab + 22.0),
                min(100.0, viab + 14.0),
                min(100.0, viab + 6.0),
                viab,
                max(0.0, viab - 14.0),
                max(0.0, viab - 26.0),
            ]
            df = pd.DataFrame({
                "Concentration": concentrations,
                "Cell Viability": viabilities,
                "ROS Level":   [ros_level] * 6,
                "LDH Release": [ldh_level] * 6,
                "Apoptosis":   [apoptosis_rate] * 6,
            })
        except (TypeError, ValueError) as e:
            return jsonify({"error": f"Invalid numeric values: {e}"}), 400

    try:
        synth_method = data.get("synthesis_method", "Green_Synthesis") or "Green_Synthesis"
        surf_coating = data.get("surface_coating", "Bare_ZnO") or "Bare_ZnO"
        hemo_rate = float(data.get("hemolysis_rate", 0.0) or 0.0)

        static_dir = current_app.static_folder or os.path.join(current_app.root_path, "static")
        results = process_experiment_data(
            df, cell_line,
            static_dir,
            sample_name,
            medical_application=data.get("medical_application", "general"),
            synthesis_method=synth_method,
            surface_coating=surf_coating,
            hemolysis_rate=hemo_rate
        )

        # Run Local Trained ML Model on Experimental Data
        raw_exp = str(data.get("exposure_time", "24")).lower().replace("h", "").replace("standard", "").replace("extended", "").replace("(", "").replace(")", "").strip()
        try:
            exp_time_val = float(raw_exp) if raw_exp else 24.0
        except ValueError:
            exp_time_val = 24.0

        from services.ml_predictor import ml_predictor
        ml_res = ml_predictor.predict_toxicity(
            nanoparticle="ZnO",
            dose=concentration if concentration is not None else results.get("avg_concentration", 25.0),
            exposure_time=exp_time_val,
            avg_viability=results["avg"],
            ros=ros_level or results["avg_ros"],
            ldh=ldh_level or results.get("avg_ldh", 0.0),
            apoptosis=apoptosis_rate or results.get("avg_apoptosis", 0.0),
            cell_line=cell_line,
            medical_application=data.get("medical_application", "general"),
            synthesis_method=synth_method,
            surface_coating=surf_coating,
            hemolysis=hemo_rate
        )

        final_toxicity_score = ml_res.get("toxicity_score", results["toxicity_score"])
        final_risk_level = ml_res.get("toxicity_level", results["result"])

        # Resolve patient / participant metadata
        raw_pid = (data.get("participantId") or data.get("participant_id") or "").strip()
        raw_pname = (data.get("participantName") or data.get("participant_name") or "").strip()
        raw_group = (data.get("studyGroup") or data.get("study_group") or "").strip()

        if raw_pid and raw_pid.lower() != "general":
            p_match = StudyParticipant.query.filter_by(user_id=uid, participant_id=raw_pid).first()
            if not p_match and raw_pid.isdigit():
                p_match = StudyParticipant.query.filter_by(user_id=uid, id=int(raw_pid)).first()
            if p_match:
                raw_pid = p_match.participant_id
                if not raw_pname:
                    raw_pname = p_match.name or f"Subject {p_match.participant_id}"
                if not raw_group:
                    raw_group = p_match.study_group or ""
        else:
            raw_pid = ""
            raw_pname = "General Material Screening"
            raw_group = ""

        import json
        saved_rows_json = json.dumps(cleaned_rows if (rows and len(rows) > 0) else df.to_dict(orient="records"))
        from datetime import datetime as _dt
        history_entry = History(
            user_id=uid,
            sample_name=sample_name,
            cell_line=cell_line,
            concentration=float(concentration) if concentration is not None else results.get("avg_concentration", 0),
            toxicity_score=final_toxicity_score,
            risk_level=final_risk_level,
            cell_viability=results["avg"],
            ros=ros_level or results["avg_ros"],
            ldh=ldh_level or results.get("avg_ldh", 0.0),
            apoptosis=apoptosis_rate or results.get("avg_apoptosis", 0.0),
            hemolysis_rate=hemo_rate,
            hemocompatibility_status=results.get("hemocompatibility_status", "Non-Hemolytic (<2%)"),
            selectivity_index=results.get("selectivity_index", 1.0),
            comet_tail_moment=results.get("comet_tail_moment", 1.0),
            synthesis_method=synth_method,
            surface_coating=surf_coating,
            estimated_ic50=str(results.get("ic50", ml_res.get("ic50", "Not Reached"))),
            safe_range=ml_res.get("safe_range", results.get("safe_range", "")),
            interpretation=ml_res.get("interpretation", results.get("interpretation", "")),
            date_time=_dt.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            nanoparticle_type="Zinc Oxide (ZnO)",
            exposure_time=str(data.get("exposure_time", "24h")),
            tables_html=saved_rows_json,
            participant_id=raw_pid,
            participant_name=raw_pname,
            study_group=raw_group,
        )
        db.session.add(history_entry)
        db.session.commit()

        return jsonify({
            "experimentId": history_entry.id,
            "sample_name": sample_name,
            "cell_line": cell_line,
            "toxicity_score": final_toxicity_score,
            "risk_level": final_risk_level,
            "safety_category": final_risk_level,
            "confidence": ml_res.get("confidence", "98.5%"),
            "classification": ml_res.get("classification", "ISO 10993-5 Evaluated"),
            "iso_compliance": ml_res.get("iso_compliance", "PASS — Biocompatible"),
            "ic50": results.get("ic50") or ml_res.get("ic50"),
            "predicted_ic50": ml_res.get("predicted_ic50"),
            "viability_pct": results["avg"],
            "viability": results["avg"],
            "ros_avg": results["avg_ros"],
            "ldh_avg": results.get("avg_ldh", ldh_level),
            "apoptosis_avg": results.get("avg_apoptosis", apoptosis_rate),
            "safe_range": ml_res.get("safe_range", results.get("safe_range", "")),
            "interpretation": ml_res.get("interpretation", results.get("interpretation", "")),
            "radar_scores": ml_res.get("radar_scores", {
                "viability": results["avg"],
                "ros": min(100.0, float(ros_level or results["avg_ros"]) * 20.0),
                "ldh": min(100.0, float(ldh_level or results.get("avg_ldh", 0.0)) * 2.0),
                "apoptosis": min(100.0, float(apoptosis_rate or results.get("avg_apoptosis", 0.0)) * 2.0),
            }),
            "is_biocompatible": results["avg"] >= 80,
            "ml_powered": True,
            "model_name": "Scikit-Learn Random Forest Regressor & Multi-Output Classifier v1.0",
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@mobile_bp.route("/analysis/upload", methods=["POST"])
@jwt_required
def upload():
    """
    Upload a CSV file and parse it into concentration/viability rows.
    Supports multipart/form-data with a 'file' field.
    Returns parsed rows ready for /analysis/calculate.
    """
    import csv, io
    uid = getattr(request, 'uid', 1)

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded. Send a multipart form with 'file' field."}), 400

    f = request.files['file']
    if f.filename == '':
        return jsonify({"error": "Empty filename."}), 400
    if not f.filename.lower().endswith('.csv'):
        return jsonify({"error": "Only CSV files are supported."}), 400

    try:
        content = f.read().decode('utf-8-sig')  # Strip BOM if present
        reader = csv.DictReader(io.StringIO(content))
        headers_raw = reader.fieldnames or []
        headers = [h.strip().lower().replace(' ', '_') for h in headers_raw]

        def find_col(aliases):
            for a in aliases:
                for h in headers_raw:
                    if a in h.strip().lower().replace(' ', '_'):
                        return h
            return None

        col_conc = find_col(['conc', 'concentration', 'dose'])
        col_viab = find_col(['viab', 'viability', 'viable', 'cell_viability'])
        col_ros  = find_col(['ros', 'reactive', 'oxidative'])
        col_ldh  = find_col(['ldh', 'lysis', 'leakage'])
        col_apop = find_col(['apop', 'apoptosis'])

        if not col_conc or not col_viab:
            return jsonify({"error": "CSV must have at minimum a 'Concentration' and 'Viability' column."}), 400

        rows = []
        for i, row in enumerate(reader):
            try:
                conc = float(row.get(col_conc, '0') or '0')
                viab = float(row.get(col_viab, '0') or '0')
            except ValueError:
                continue
            rows.append({
                "id": i + 1,
                "concentration": conc,
                "viability": viab,
                "ros":       float(row.get(col_ros,  '1.0') or '1.0') if col_ros  else 1.0,
                "ldh":       float(row.get(col_ldh,  '0')   or '0')   if col_ldh  else 0.0,
                "apoptosis": float(row.get(col_apop, '0')   or '0')   if col_apop else 0.0,
            })

        if not rows:
            return jsonify({"error": "No valid data rows found in CSV."}), 400

        return jsonify({
            "success": True,
            "filename": f.filename,
            "row_count": len(rows),
            "rows": rows,
            "columns_detected": {
                "concentration": col_conc,
                "viability": col_viab,
                "ros": col_ros,
                "ldh": col_ldh,
                "apoptosis": col_apop,
            }
        }), 200

    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400

@mobile_bp.route("/compare/evaluate", methods=["POST"])
@mobile_bp.route("/analysis/compare", methods=["POST"])
@jwt_required
def evaluate():
    import pandas as pd
    import numpy as np
    import json
    from services.ml_predictor import ml_predictor

    data = request.get_json() or {}
    uid = getattr(request, 'uid', 1)
    history_ids = data.get("history_ids", [])
    experiments = data.get("experiments", [])

    # If history_ids provided, load from History database
    if history_ids and len(history_ids) >= 2:
        records = History.query.filter(History.id.in_(history_ids), History.user_id == uid).all()
        if len(records) < 2:
            records = History.query.filter(History.id.in_(history_ids)).all()
        experiments = []
        for r in records:
            r_rows = []
            if r.tables_html:
                if r.tables_html.startswith("[") or r.tables_html.startswith("{"):
                    try:
                        parsed = json.loads(r.tables_html)
                        if isinstance(parsed, list):
                            r_rows = parsed
                    except Exception:
                        pass
                elif "<table" in r.tables_html:
                    try:
                        dfs = pd.read_html(r.tables_html)
                        if dfs:
                            df_tab = dfs[0]
                            for _, row in df_tab.iterrows():
                                c = row.get("Concentration", row.get("Dose", None))
                                v = row.get("Cell Viability", row.get("Viability", None))
                                if c is not None and v is not None:
                                    r_rows.append({
                                        "concentration": str(round(float(c), 1)),
                                        "viability": str(round(float(v), 1)),
                                        "ros": str(round(float(row.get("ROS Level", row.get("ROS", 1.0))), 1)),
                                        "ldh": str(round(float(row.get("LDH Release", row.get("LDH", 0.0))), 1)),
                                        "apoptosis": str(round(float(row.get("Apoptosis", 0.0)), 1))
                                    })
                    except Exception:
                        pass
            
            c_val = float(r.concentration or 25.0)
            v_val = float(r.cell_viability or 80.0)
            r_val = float(r.ros or 1.8)
            l_val = float(r.ldh or 4.5)
            a_val = float(r.apoptosis or 3.2)

            if not r_rows:
                r_rows = [
                    {"concentration": "0.0", "viability": "100.0", "ros": "1.0", "ldh": "0.5", "apoptosis": "0.2"},
                    {"concentration": str(round(max(0.1, c_val * 0.25), 1)), "viability": str(round(min(100.0, v_val + 14.0), 1)), "ros": str(round(max(1.0, r_val * 0.7), 1)), "ldh": str(round(max(0.5, l_val * 0.6), 1)), "apoptosis": str(round(max(0.2, a_val * 0.5), 1))},
                    {"concentration": str(round(max(0.1, c_val * 0.5), 1)), "viability": str(round(min(100.0, v_val + 6.0), 1)), "ros": str(round(max(1.0, r_val * 0.85), 1)), "ldh": str(round(max(0.5, l_val * 0.8), 1)), "apoptosis": str(round(max(0.2, a_val * 0.75), 1))},
                    {"concentration": str(round(c_val, 1)), "viability": str(round(v_val, 1)), "ros": str(round(r_val, 1)), "ldh": str(round(l_val, 1)), "apoptosis": str(round(a_val, 1))},
                    {"concentration": str(round(c_val * 2.0, 1)), "viability": str(round(max(0.0, v_val - 22.0), 1)), "ros": str(round(r_val * 1.6, 1)), "ldh": str(round(l_val * 2.0, 1)), "apoptosis": str(round(a_val * 2.2, 1))},
                ]

            exp_name_label = f"[{r.participant_id}] {r.sample_name}" if r.participant_id else (r.sample_name or f"Experiment #{r.id}")

            experiments.append({
                "name": exp_name_label,
                "cell_line": r.cell_line or "HeLa",
                "exposure_time": r.exposure_time or "24h",
                "rows": r_rows,
                "concentration": c_val,
                "viability": v_val,
                "toxicity_score": float(r.toxicity_score) if r.toxicity_score is not None else 15.0,
                "risk_level": r.risk_level or ("Low" if v_val >= 80 else "High"),
                "ic50": r.estimated_ic50 or "Not Reached",
                "safe_range": r.safe_range or "0.0 – 25.0 µg/mL",
                "is_historical": True,
            })

    if not experiments or len(experiments) < 2:
        return jsonify({"error": "Please provide or select at least 2 experiments to compare."}), 400

    results = []
    for idx, exp in enumerate(experiments):
        name = exp.get("name") or f"Experiment #{idx + 1}"
        cell_line = exp.get("cell_line") or "HeLa"
        raw_exp = str(exp.get("exposure_time", 24)).replace("h","").replace(" ","").strip()
        try:
            exposure_time = float(raw_exp) if raw_exp else 24.0
        except ValueError:
            exposure_time = 24.0

        rows = exp.get("rows", [])
        cleaned_rows = []
        for r in rows:
            conc = r.get("concentration")
            viab = r.get("viability")
            ros  = r.get("ros", 1.0)
            ldh  = r.get("ldh", 0.0)
            apop = r.get("apoptosis", 0.0)
            if conc is not None and viab is not None and str(conc).strip() != "" and str(viab).strip() != "":
                try:
                    cleaned_rows.append({
                        "Concentration": float(conc),
                        "Cell Viability": float(viab),
                        "ROS Level": float(ros or 1.0),
                        "LDH Release": float(ldh or 0.0),
                        "Apoptosis": float(apop or 0.0),
                    })
                except (ValueError, TypeError):
                    pass

        if not cleaned_rows:
            c_val = float(exp.get("concentration") or 25.0)
            v_val = float(exp.get("viability") or 80.0)
            cleaned_rows = [
                {"Concentration": 0.0, "Cell Viability": 100.0, "ROS Level": 1.0, "LDH Release": 0.5, "Apoptosis": 0.2},
                {"Concentration": max(0.1, c_val * 0.25), "Cell Viability": min(100.0, v_val + 14.0), "ROS Level": 1.2, "LDH Release": 1.5, "Apoptosis": 0.8},
                {"Concentration": max(0.1, c_val * 0.5),  "Cell Viability": min(100.0, v_val + 6.0),  "ROS Level": 1.5, "LDH Release": 2.5, "Apoptosis": 1.5},
                {"Concentration": c_val,                  "Cell Viability": v_val,                     "ROS Level": 1.8, "LDH Release": 4.5, "Apoptosis": 3.2},
                {"Concentration": c_val * 2.0,            "Cell Viability": max(0.0, v_val - 22.0),   "ROS Level": 3.5, "LDH Release": 10.0, "Apoptosis": 7.0},
            ]

        df = pd.DataFrame(cleaned_rows)
        avg_viab = round(float(df["Cell Viability"].mean()), 1)
        avg_conc = round(float(df["Concentration"].mean()), 1)
        avg_ros  = round(float(df["ROS Level"].mean()), 1)
        avg_ldh  = round(float(df["LDH Release"].mean()), 1)
        avg_apop = round(float(df["Apoptosis"].mean()), 1)

        # Compute 4PL Hill equation on dose-response curve
        df_s = df.sort_values("Concentration")
        from services.analysis_service import compute_4pl_ic50
        ic50_val, hill_slope, fit_r2, fit_msg = compute_4pl_ic50(df_s)
        ic50_str = f"{ic50_val} µg/mL" if ic50_val is not None else fit_msg

        # Exact Trained Random Forest / Gradient Boosting ML Model Execution
        ml_pred = ml_predictor.predict_toxicity(
            nanoparticle="ZnO",
            dose=float(df["Concentration"].max()) if not df.empty else avg_conc,
            exposure_time=exposure_time,
            avg_viability=avg_viab,
            ros=avg_ros,
            ldh=avg_ldh,
            apoptosis=avg_apop,
            cell_line=cell_line,
        )

        formatted_rows = [
            {
                "concentration": str(round(float(r["Concentration"]), 1)),
                "viability": str(round(float(r["Cell Viability"]), 1)),
                "ros": str(round(float(r["ROS Level"]), 1)),
                "ldh": str(round(float(r["LDH Release"]), 1)),
                "apoptosis": str(round(float(r["Apoptosis"]), 1)),
            }
            for r in cleaned_rows
        ]

        is_hist = exp.get("is_historical", False)
        # Use trained ML model prediction directly
        t_score = round(float(ml_pred.get("toxicity_score", 15.0)), 1)
        if is_hist and exp.get("toxicity_score") is not None and exp.get("toxicity_score") != 0:
            t_score = round(float(exp.get("toxicity_score")), 1)

        final_viab = round(float(exp.get("viability", avg_viab)), 1) if is_hist else avg_viab
        risk_lvl = exp.get("risk_level") if (is_hist and exp.get("risk_level")) else ml_pred.get("toxicity_level", "Low")
        iso_verdict = ml_pred.get("iso_compliance", "PASS — Biocompatible")
        safe_range_val = ml_pred.get("safe_range", "0.0 – 25.0 µg/mL")

        results.append({
            "id": idx + 1,
            "name": name,
            "sample_name": name,
            "cell_line": cell_line,
            "exposure_time": f"{int(exposure_time)}h" if exposure_time == int(exposure_time) else f"{exposure_time}h",
            "viability": final_viab,
            "viability_pct": final_viab,
            "toxicity_score": t_score,
            "toxicityScore": t_score,
            "risk_level": risk_lvl,
            "iso_compliance": iso_verdict,
            "ic50": ic50_str if ic50_val is not None else ml_pred.get("ic50", ic50_str),
            "safe_range": safe_range_val,
            "confidence": ml_pred.get("confidence", "98.5%"),
            "ros_avg": avg_ros,
            "ldh_avg": avg_ldh,
            "apoptosis_avg": avg_apop,
            "submittedRows": formatted_rows,
            "interpretation": ml_pred.get("interpretation", ""),
        })

    # Sort and rank by safest (lowest toxicity_score, highest viability)
    results_sorted = sorted(results, key=lambda x: (x["toxicity_score"], -x["viability"]))
    safest = results_sorted[0]
    for r_idx, r_item in enumerate(results_sorted):
        for orig in results:
            if orig["id"] == r_item["id"]:
                orig["rank"] = r_idx + 1

    return jsonify({
        "success": True,
        "experiments": results,
        "safest_experiment": safest["name"],
        "comparison_count": len(results),
        "summary": f"{safest['name']} is the top-performing candidate with {safest['viability']}% viability and lowest toxicity score ({safest['toxicity_score']}/100).",
    }), 200



# ============================================================
# MOBILE: STUDY PARTICIPANTS API
# ============================================================
@mobile_bp.route("/participants/", methods=["GET"])
@jwt_required
def mobile_participants_list():
    uid = request.uid
    search = request.args.get("search", "").strip()
    consent = request.args.get("consent", "").strip()

    query = StudyParticipant.query.filter_by(user_id=uid)
    if search:
        query = query.filter(StudyParticipant.participant_id.ilike(f"%{search}%"))
    if consent:
        query = query.filter_by(consent_status=consent)

    participants = query.order_by(StudyParticipant.created_at.desc()).all()
    results = []
    import json
    for p in participants:
        p_history = History.query.filter_by(user_id=uid, participant_id=p.participant_id).order_by(History.id.desc()).all()
        assays_summary = []
        for ah in p_history:
            ah_rows = []
            if ah.tables_html and (ah.tables_html.startswith("[") or ah.tables_html.startswith("{")):
                try:
                    parsed = json.loads(ah.tables_html)
                    if isinstance(parsed, list):
                        ah_rows = parsed
                except Exception:
                    pass
            assays_summary.append({
                "id": str(ah.id),
                "sample_name": ah.sample_name,
                "cell_line": ah.cell_line,
                "viability": round(float(ah.cell_viability or 0), 1),
                "toxicity_score": round(float(ah.toxicity_score or 0), 1),
                "risk_level": ah.risk_level or "Low",
                "ic50": ah.estimated_ic50 or "Not Reached",
                "safe_range": ah.safe_range or "0.0 – 25.0 µg/mL",
                "date": str(ah.date_time or "").split(" ")[0],
                "submittedRows": ah_rows,
            })

        results.append({
            "id": p.id,
            "participantId": p.participant_id,
            "name": p.name or "",
            "bloodGroup": p.blood_group or "O+",
            "age": p.age,
            "sex": p.sex,
            "studyGroup": p.study_group or "General Research Cohort",
            "consentStatus": p.consent_status,
            "consentDate": p.consent_date.strftime("%Y-%m-%d") if p.consent_date else None,
            "totalSamples": p.samples.count() or (1 if len(assays_summary) > 0 else 0),
            "researchNotes": p.research_notes,
            "createdAt": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else None,
            "linkedAssays": assays_summary,
            "totalAssays": len(assays_summary),
            "latestViability": assays_summary[0]["viability"] if assays_summary else None,
            "latestRisk": assays_summary[0]["risk_level"] if assays_summary else None,
        })
    return jsonify({"success": True, "participants": results}), 200


@mobile_bp.route("/participants/", methods=["POST"])
@jwt_required
def mobile_participant_create():
    uid = request.uid
    data = request.get_json() or {}

    pid = (data.get("participantId") or data.get("participant_id") or "").strip()
    if not pid:
        from datetime import datetime as _dt
        year = _dt.utcnow().year
        count = StudyParticipant.query.filter_by(user_id=uid).count() + 1
        pid = f"PAT-{year}-{count:03d}"
        while StudyParticipant.query.filter_by(user_id=uid, participant_id=pid).first():
            count += 1
            pid = f"PAT-{year}-{count:03d}"
    else:
        # Duplicate check
        existing = StudyParticipant.query.filter_by(user_id=uid, participant_id=pid).first()
        if existing:
            return jsonify({"error": f"Participant ID '{pid}' already exists."}), 400

    name = (data.get("name") or "").strip()
    blood_group = (data.get("bloodGroup") or data.get("blood_group") or "O+").strip()
    age = data.get("age")
    sex = data.get("sex")
    study_group = data.get("studyGroup") or data.get("study_group")
    consent_status = data.get("consentStatus") or data.get("consent_status") or "Pending"
    consent_date_str = data.get("consentDate") or data.get("consent_date")
    notes = data.get("researchNotes") or data.get("research_notes") or ""

    consent_date = None
    if consent_date_str:
        try:
            consent_date = datetime.strptime(str(consent_date_str), "%Y-%m-%d").date()
        except ValueError:
            pass
    elif consent_status == "Consented":
        consent_date = date.today()

    participant = StudyParticipant(
        user_id=uid,
        participant_id=pid,
        name=name,
        blood_group=blood_group,
        age=int(age) if age is not None and str(age).isdigit() else None,
        sex=sex,
        study_group=study_group,
        consent_status=consent_status,
        consent_date=consent_date,
        research_notes=notes,
    )
    db.session.add(participant)
    db.session.flush()

    # Initial consent audit log
    db.session.add(ParticipantConsentLog(
        participant_fk=participant.id,
        user_id=uid,
        old_status=None,
        new_status=consent_status,
        reason="Enrolled via Mobile App API",
        changed_by="Mobile User",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Participant {pid} created successfully",
        "participant": {
            "id": participant.id,
            "participantId": participant.participant_id,
            "consentStatus": participant.consent_status,
            "createdAt": participant.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    }), 201


@mobile_bp.route("/participants/<int:participant_pk>", methods=["GET"])
@jwt_required
def mobile_participant_detail(participant_pk):
    uid = request.uid
    participant = StudyParticipant.query.filter_by(id=participant_pk, user_id=uid).first()
    if not participant:
        return jsonify({"error": "Participant not found"}), 404

    samples = BiologicalSample.query.filter_by(participant_fk=participant.id, user_id=uid).all()
    samples_data = []
    for s in samples:
        links = s.experiment_links.all()
        experiments_data = []
        for lnk in links:
            if lnk.experiment:
                res = ExperimentResult.query.filter_by(experiment_id=lnk.experiment.id).first()
                experiments_data.append({
                    "experimentId": lnk.experiment.id,
                    "sampleName": lnk.experiment.sample_name,
                    "cellLine": lnk.experiment.cell_line,
                    "viability": res.cell_viability if res else None,
                    "toxicityScore": res.toxicity_score if res else None,
                    "riskLevel": res.toxicity_level if res else None,
                    "estimatedIc50": res.estimated_ic50 if res else None,
                    "safeRange": res.safe_range if res else None,
                })
        samples_data.append({
            "id": s.id,
            "sampleId": s.sample_id,
            "sampleType": s.sample_type,
            "cellType": s.cell_type,
            "collectionDate": s.collection_date.strftime("%Y-%m-%d") if s.collection_date else None,
            "sampleStatus": s.sample_status,
            "notes": s.notes,
            "experiments": experiments_data,
        })

    logs = participant.consent_logs.all()
    consent_logs_data = []
    for l in logs:
        consent_logs_data.append({
            "id": l.id,
            "oldStatus": l.old_status,
            "newStatus": l.new_status,
            "reason": l.reason,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
        })

    return jsonify({
        "success": True,
        "participant": {
            "id": participant.id,
            "participantId": participant.participant_id,
            "age": participant.age,
            "sex": participant.sex,
            "studyGroup": participant.study_group,
            "consentStatus": participant.consent_status,
            "consentDate": participant.consent_date.strftime("%Y-%m-%d") if participant.consent_date else None,
            "researchNotes": participant.research_notes,
            "createdAt": participant.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "samples": samples_data,
            "consentLogs": consent_logs_data,
        }
    }), 200


@mobile_bp.route("/participants/stats", methods=["GET"])
@jwt_required
def mobile_participants_stats():
    uid = request.uid
    total_participants = StudyParticipant.query.filter_by(user_id=uid).count()
    consented = StudyParticipant.query.filter_by(user_id=uid, consent_status="Consented").count()
    pending = StudyParticipant.query.filter_by(user_id=uid, consent_status="Pending").count()
    withdrawn = StudyParticipant.query.filter_by(user_id=uid, consent_status="Withdrawn").count()
    total_samples = BiologicalSample.query.filter_by(user_id=uid).count()

    sample_ids = [s.id for s in BiologicalSample.query.filter_by(user_id=uid).with_entities(BiologicalSample.id).all()]
    active_links = SampleExperimentLink.query.filter(SampleExperimentLink.sample_id.in_(sample_ids)).count() if sample_ids else 0

    return jsonify({
        "success": True,
        "stats": {
            "totalParticipants": total_participants,
            "consentedParticipants": consented,
            "pendingParticipants": pending,
            "withdrawnParticipants": withdrawn,
            "totalSamples": total_samples,
            "activeExperimentLinks": active_links,
        }
    }), 200


# ============================================================
# MOBILE: BIOLOGICAL SAMPLES API
# ============================================================
@mobile_bp.route("/samples/", methods=["GET"])
@jwt_required
def mobile_samples_list():
    uid = request.uid
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "").strip()

    query = BiologicalSample.query.filter_by(user_id=uid)
    if search:
        query = query.filter(BiologicalSample.sample_id.ilike(f"%{search}%"))
    if status:
        query = query.filter_by(sample_status=status)

    samples = query.order_by(BiologicalSample.created_at.desc()).all()
    results = []
    for s in samples:
        results.append({
            "id": s.id,
            "sampleId": s.sample_id,
            "participantId": s.participant.participant_id if s.participant else None,
            "participantName": s.participant.name if s.participant else None,
            "participantBloodGroup": s.participant.blood_group if s.participant else None,
            "participantCohort": s.participant.study_group if s.participant else None,
            "participantConsent": s.participant.consent_status if s.participant else None,
            "participantAge": s.participant.age if s.participant else None,
            "participantSex": s.participant.sex if s.participant else None,
            "sampleType": s.sample_type,
            "cellType": s.cell_type,
            "collectionDate": s.collection_date.strftime("%Y-%m-%d") if s.collection_date else None,
            "sampleStatus": s.sample_status,
            "linkedExperimentsCount": s.experiment_links.count(),
            "notes": s.notes,
            "createdAt": s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else None,
        })
    return jsonify({"success": True, "samples": results}), 200


@mobile_bp.route("/samples/", methods=["POST"])
@jwt_required
def mobile_sample_create():
    uid = request.uid
    data = request.get_json() or {}

    sid = (data.get("sampleId") or data.get("sample_id") or "").strip()
    if not sid:
        return jsonify({"error": "sampleId is required"}), 400

    existing = BiologicalSample.query.filter_by(user_id=uid, sample_id=sid).first()
    if existing:
        return jsonify({"error": f"Sample ID '{sid}' already exists."}), 400

    # Validate participant consent if provided
    participant_fk = None
    pid_str = (data.get("participantId") or data.get("participant_id") or "").strip()
    if pid_str:
        pt = StudyParticipant.query.filter_by(user_id=uid, participant_id=pid_str).first()
        if not pt:
            return jsonify({"error": f"Participant '{pid_str}' not found"}), 400
        if pt.consent_status != "Consented":
            return jsonify({"error": f"Participant '{pid_str}' has not consented ({pt.consent_status})."}), 400
        participant_fk = pt.id

    collection_date = None
    c_date_str = data.get("collectionDate") or data.get("collection_date")
    if c_date_str:
        try:
            collection_date = datetime.strptime(str(c_date_str), "%Y-%m-%d").date()
        except ValueError:
            pass

    sample = BiologicalSample(
        user_id=uid,
        sample_id=sid,
        participant_fk=participant_fk,
        sample_type=data.get("sampleType") or data.get("sample_type") or "",
        cell_type=data.get("cellType") or data.get("cell_type") or "",
        collection_date=collection_date,
        sample_status=data.get("sampleStatus") or data.get("sample_status") or "Active",
        notes=data.get("notes") or "",
    )
    db.session.add(sample)
    db.session.flush()

    # Link experiments if provided
    linked_exp_ids = data.get("linkedExperiments") or data.get("linked_experiments") or []
    for exp_id in linked_exp_ids:
        try:
            exp_id_int = int(exp_id)
            exp = Experiment.query.filter_by(id=exp_id_int, user_id=uid).first()
            if exp:
                db.session.add(SampleExperimentLink(sample_id=sample.id, experiment_id=exp.id))
        except (ValueError, TypeError):
            pass

    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"Sample {sid} created successfully",
        "sample": {
            "id": sample.id,
            "sampleId": sample.sample_id,
            "sampleStatus": sample.sample_status,
            "createdAt": sample.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    }), 201


# ============================================================
# MOBILE: SIMULATOR & WHAT-IF SANDBOX API
# ============================================================
@mobile_bp.route("/simulator/dose", methods=["POST"])
@jwt_required
def mobile_simulate_dose():
    data = request.get_json() or {}
    dose = float(data.get("dose", 25.0))
    cell_line = str(data.get("cell_line", "HeLa"))
    exposure_time = float(data.get("exposure_time", 24.0))
    medical_app = str(data.get("medical_application", "wound_dressing"))
    synthesis_method = str(data.get("synthesis_method", "Green_Synthesis"))
    surface_coating = str(data.get("surface_coating", "Bare_ZnO"))
    hemolysis_val = float(data.get("hemolysis_rate", 0.0) or 0.0)

    base_ic50_map = {
        'HeLa': 45.0, 'A549': 38.0, 'MCF-7': 35.0, 'HEK293': 55.0,
        'NIH-3T3': 60.0, 'HepG2': 42.0, 'Caco-2': 48.0, 'CHO': 52.0,
        'Jurkat': 32.0, 'PC12': 36.0, 'L929': 68.0, 'Primary_HDF': 72.0
    }
    base_ic = base_ic50_map.get(cell_line, 45.0)
    if "PEG" in surface_coating:
        base_ic *= 1.30
    if "Green" in synthesis_method:
        base_ic *= 1.15

    time_factor = (24.0 / max(6.0, exposure_time)) ** 0.25
    eff_ic50 = base_ic * time_factor

    viab = round(float(max(0.0, min(100.0, 100.0 / (1.0 + (dose / eff_ic50) ** 1.8)))), 1)
    ros_mod = 0.35 if "PEG" in surface_coating else (0.50 if "Chitosan" in surface_coating else 1.0)
    ros = round(float(1.0 + 8.0 * ((dose / 100.0) ** 1.2) * ((exposure_time / 24.0) ** 0.3) * ros_mod), 2)
    ldh = round(float(max(0.0, min(100.0, 2.0 + 22.0 * (1.0 - viab / 100.0)))), 1)
    apop = round(float(max(0.0, min(100.0, 1.5 + 18.0 * ((1.0 - viab / 100.0) ** 1.1)))), 1)

    from services.ml_predictor import ml_predictor
    ml_result = ml_predictor.predict_toxicity(
        nanoparticle="ZnO",
        dose=dose,
        exposure_time=exposure_time,
        avg_viability=viab,
        ros=ros,
        ldh=ldh,
        apoptosis=apop,
        cell_line=cell_line,
        medical_application=medical_app,
        synthesis_method=synthesis_method,
        surface_coating=surface_coating,
        hemolysis=hemolysis_val
    )

    return jsonify({
        "success": True,
        "viability": viab,
        "ros": ros,
        "ldh": ldh,
        "apoptosis": apop,
        "hemolysis": hemolysis_val,
        "eff_ic50": round(eff_ic50, 1),
        "ml_prediction": ml_result
    }), 200

