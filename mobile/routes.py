from flask import request, jsonify, current_app

from . import mobile_bp
from .jwt_utils import jwt_required
from services.analysis_service import process_experiment_data

import jwt
import secrets
from datetime import datetime, timedelta
from auth.routes import hash_password_bcrypt, verify_password_bcrypt
from auth.email_service import send_otp_email
from models import (
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

    secret = current_app.config.get("JWT_SECRET_KEY")
    expires_hours = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 1)
    
    token = jwt.encode({
        "uid": user.id,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours)
    }, secret, algorithm="HS256")
    
    return jsonify({
        "accessToken": token,
        "username": user.username,
        "role": user.role  # user.role is already a string property (e.g. 'user', 'admin')
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
    for t in tokens:
        if t.expires_at > datetime.utcnow() and verify_password_bcrypt(otp, t.otp_hash):
            valid_token = t
            break

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
    secret = current_app.config.get("JWT_SECRET_KEY")
    expires_hours = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_HOURS", 1)
    
    session_token = jwt.encode({
        "uid": user.id,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours)
    }, secret, algorithm="HS256")

    return jsonify({
        "success": True, 
        "message": "Email verified successfully",
        "accessToken": session_token,
        "username": user.username,
        "role": user.role
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

@mobile_bp.route("/history/", methods=["GET"])
@jwt_required
def history():
    uid = request.uid
    # Fetch from SQLAlchemy, user-isolated
    records = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    res = []
    for h in records:
        res.append({
            "id": str(h.id),
            "name": h.sample_name or "Untitled",
            "date": str(h.date_time or "").split(" ")[0],
            "toxicityScore": float(h.toxicity_score or 0),
            "result": h.risk_level or "Unknown"
        })
    return jsonify(res), 200

@mobile_bp.route("/reports/", methods=["GET"])
@jwt_required
def reports():
    uid = request.uid
    records = History.query.filter_by(user_id=uid).filter(History.pdf_path != "").order_by(History.id.desc()).all()
    res = []
    for h in records:
        if h.pdf_path:
            res.append({
                "id": str(h.id),
                "experimentName": h.sample_name or "Untitled",
                "date": str(h.date_time or "").split(" ")[0],
                "downloadUrl": f"/download_report/{h.id}"
            })
    return jsonify(res), 200

@mobile_bp.route("/analysis/calculate", methods=["POST"])
@jwt_required
def calculate():
    data = request.get_json() or {}
    import pandas as pd
    rows = data.get("rows", [])
    df = pd.DataFrame(rows)
    try:
        results = process_experiment_data(df, "HeLa", current_app.config["STATIC_FOLDER"], "Manual API")
        return jsonify({
            "experimentId": "temp_api",
            "toxicityScore": results["toxicity_score"],
            "resultLevel": results["result"],
            "ic50": results["ic50"],
            "viabilityAvg": results["avg"],
            "rosAvg": results["avg_ros"]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@mobile_bp.route("/analysis/upload", methods=["POST"])
@jwt_required
def upload():
    return jsonify({"error": "File upload via API requires multipart parsing logic"}), 400

@mobile_bp.route("/compare/evaluate", methods=["POST"])
@jwt_required
def evaluate():
    return jsonify({"error": "Not implemented yet"}), 501


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
    for p in participants:
        results.append({
            "id": p.id,
            "participantId": p.participant_id,
            "age": p.age,
            "sex": p.sex,
            "studyGroup": p.study_group,
            "consentStatus": p.consent_status,
            "consentDate": p.consent_date.strftime("%Y-%m-%d") if p.consent_date else None,
            "totalSamples": p.samples.count(),
            "researchNotes": p.research_notes,
            "createdAt": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else None,
        })
    return jsonify({"success": True, "participants": results}), 200


@mobile_bp.route("/participants/", methods=["POST"])
@jwt_required
def mobile_participant_create():
    uid = request.uid
    data = request.get_json() or {}

    pid = (data.get("participantId") or data.get("participant_id") or "").strip()
    if not pid:
        return jsonify({"error": "participantId is required"}), 400

    # Duplicate check
    existing = StudyParticipant.query.filter_by(user_id=uid, participant_id=pid).first()
    if existing:
        return jsonify({"error": f"Participant ID '{pid}' already exists."}), 400

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

    participant = StudyParticipant(
        user_id=uid,
        participant_id=pid,
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
            "participantConsent": s.participant.consent_status if s.participant else None,
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

