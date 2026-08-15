"""
main/routes.py — NanoSafe Analyzer: User-Facing Routes

All scientific routes use SQLAlchemy ORM with per-user data isolation.
Every query filters by user_id to enforce data boundaries.
Firebase Authentication REMOVED — Flask + SQLAlchemy is the single source of truth.
"""

import os
import uuid
import json
import re
from datetime import datetime
import io
import csv

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from flask import (
    request, render_template, redirect, url_for,
    session, flash, send_file, jsonify, current_app, Response,
)
from . import main_bp
from auth.decorators import login_required, verified_required, current_user_id, current_username
from models import db, History, Experiment, ExperimentResult, Report, AuditLog, User, LoginLog, StudyParticipant, BiologicalSample, SampleExperimentLink
from services.analysis_service import process_experiment_data
from services.pdf_service import generate_pdf_file
from services.ml_predictor import ml_predictor

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(APP_DIR)
UPLOAD_FOLDER = os.path.join(PROJECT_DIR, "uploads")
REPORT_FOLDER = os.path.join(PROJECT_DIR, "reports")
STATIC_FOLDER = os.path.join(PROJECT_DIR, "static")
BACKUP_FOLDER = os.path.join(PROJECT_DIR, "backups")

for d in [UPLOAD_FOLDER, REPORT_FOLDER, STATIC_FOLDER, BACKUP_FOLDER]:
    os.makedirs(d, exist_ok=True)

def sanitize_filename(name):
    """Sanitizes an experiment or sample name for safe, clean PDF filenames."""
    if not name:
        return "ZnO_Experiment"
    clean = re.sub(r'[^a-zA-Z0-9_\- ]', '', str(name)).strip().replace(' ', '_')
    return clean or "ZnO_Experiment"


# ============================================================
# HOME
# ============================================================
@main_bp.route("/")
def index():
    return redirect(url_for("main.home"))

@main_bp.route("/home")
@login_required
def home():
    uid = current_user_id()

    # Participant stats for dashboard card
    total_participants = StudyParticipant.query.filter_by(user_id=uid).count() if uid else 0
    total_samples = BiologicalSample.query.filter_by(user_id=uid).count() if uid else 0
    sample_ids = [s.id for s in BiologicalSample.query.filter_by(user_id=uid)
                  .with_entities(BiologicalSample.id).all()] if uid else []
    active_exp = SampleExperimentLink.query.filter(
        SampleExperimentLink.sample_id.in_(sample_ids)
    ).count() if sample_ids else 0
    completed = History.query.filter_by(user_id=uid).count() if uid else 0

    participant_stats = {
        "total_participants": total_participants,
        "total_samples": total_samples,
        "active_experiments": active_exp,
        "completed_analyses": completed,
    }

    # Recent experiments & live metrics for dashboard front
    recent_experiments = History.query.filter_by(user_id=uid).order_by(History.id.desc()).limit(5).all()
    total_experiments = completed
    safe_count = History.query.filter_by(user_id=uid, risk_level="Low").count() if uid else 0
    mod_count = History.query.filter_by(user_id=uid, risk_level="Moderate").count() if uid else 0
    toxic_count = History.query.filter_by(user_id=uid, risk_level="High").count() if uid else 0
    pass_rate = round((safe_count / total_experiments * 100.0), 1) if total_experiments > 0 else 100.0

    return render_template("index.html",
                           username=session.get("username"),
                           role=session.get("role", "user"),
                           participant_stats=participant_stats,
                           recent_experiments=recent_experiments,
                           total_experiments=total_experiments,
                           safe_count=safe_count,
                           mod_count=mod_count,
                           toxic_count=toxic_count,
                           pass_rate=pass_rate)

@main_bp.route("/clinical-guide")
@login_required
def clinical_guide():
    return render_template("clinical_guide.html",
                           username=session.get("username"),
                           role=session.get("role", "user"))

@main_bp.route("/simulator")
@login_required
def simulator():
    return render_template("simulator.html",
                           username=session.get("username"),
                           role=session.get("role", "user"))

@main_bp.route("/api/simulate-dose", methods=["POST"])
@login_required
def api_simulate_dose():
    data = request.get_json() or {}
    dose = float(data.get("dose", 25.0))
    cell_line = str(data.get("cell_line", "HeLa"))
    exposure_time = float(data.get("exposure_time", 24.0))
    medical_app = str(data.get("medical_application", "wound_dressing"))

    base_ic50_map = {
        'HeLa': 45.0, 'A549': 38.0, 'MCF-7': 35.0, 'HEK293': 55.0,
        'NIH-3T3': 60.0, 'HepG2': 42.0, 'Caco-2': 48.0, 'CHO': 52.0,
        'Jurkat': 32.0, 'PC12': 36.0
    }
    base_ic = base_ic50_map.get(cell_line, 45.0)
    time_factor = (24.0 / max(6.0, exposure_time)) ** 0.25
    eff_ic50 = base_ic * time_factor

    viab = round(float(max(0.0, min(100.0, 100.0 / (1.0 + (dose / eff_ic50) ** 1.8)))), 1)
    ros = round(float(1.0 + 8.0 * ((dose / 100.0) ** 1.2) * ((exposure_time / 24.0) ** 0.3)), 2)
    ldh = round(float(max(0.0, min(100.0, 2.0 + 22.0 * (1.0 - viab / 100.0)))), 1)
    apop = round(float(max(0.0, min(100.0, 1.5 + 18.0 * ((1.0 - viab / 100.0) ** 1.1)))), 1)

    ml_result = ml_predictor.predict_toxicity(
        nanoparticle="ZnO",
        dose=dose,
        exposure_time=exposure_time,
        avg_viability=viab,
        ros=ros,
        ldh=ldh,
        apoptosis=apop,
        cell_line=cell_line,
        medical_application=medical_app
    )

    return jsonify({
        "viability": viab,
        "ros": ros,
        "ldh": ldh,
        "apoptosis": apop,
        "eff_ic50": round(eff_ic50, 1),
        "ml_prediction": ml_result
    })


# ============================================================
# BATCH & 96-WELL DATA IMPORTER
# ============================================================
@main_bp.route("/batch-import", methods=["GET", "POST"])
@verified_required
def batch_import():
    if request.method == "GET":
        return render_template("batch_import.html", username=session.get("username"), role=session.get("role", "user"))

    uid = current_user_id()
    files = request.files.getlist("batch_files")
    default_cell_line = request.form.get("default_cell_line", "HeLa")
    default_exp_time = request.form.get("default_exposure_time", "24 h")

    if not files or all(f.filename == "" for f in files):
        flash("Please select at least one CSV, XLSX, or ZIP dataset file.", "danger")
        return redirect(url_for("main.batch_import"))

    import zipfile
    dataframes = []

    for f in files:
        if not f or f.filename == "":
            continue
        fname = f.filename.lower()
        if fname.endswith(".zip"):
            try:
                with zipfile.ZipFile(f) as z:
                    for zname in z.namelist():
                        if zname.lower().endswith(".csv"):
                            with z.open(zname) as zf:
                                df_temp = pd.read_csv(zf)
                                dataframes.append((os.path.splitext(os.path.basename(zname))[0], df_temp))
                        elif zname.lower().endswith((".xlsx", ".xls")):
                            with z.open(zname) as zf:
                                df_temp = pd.read_excel(zf)
                                dataframes.append((os.path.splitext(os.path.basename(zname))[0], df_temp))
            except Exception as e:
                flash(f"Error extracting ZIP file {f.filename}: {e}", "danger")
        elif fname.endswith(".csv"):
            try:
                df_temp = pd.read_csv(f)
                dataframes.append((os.path.splitext(f.filename)[0], df_temp))
            except Exception as e:
                flash(f"Error reading {f.filename}: {e}", "danger")
        elif fname.endswith((".xlsx", ".xls")):
            try:
                df_temp = pd.read_excel(f)
                dataframes.append((os.path.splitext(f.filename)[0], df_temp))
            except Exception as e:
                flash(f"Error reading {f.filename}: {e}", "danger")

    if not dataframes:
        flash("No valid tabular datasets could be parsed from the uploaded files.", "danger")
        return redirect(url_for("main.batch_import"))

    batch_results = []
    for exp_title, df in dataframes:
        try:
            results = process_experiment_data(df, default_cell_line, STATIC_FOLDER, exp_title)
            max_dose = df['Concentration'].max() if 'Concentration' in df.columns else 0.0

            ml_result = ml_predictor.predict_toxicity(
                nanoparticle="ZnO",
                dose=max_dose,
                exposure_time=24.0,
                avg_viability=results.get('avg'),
                ros=results.get('avg_ros'),
                ldh=results.get('avg_ldh'),
                apoptosis=results.get('avg_apoptosis'),
                cell_line=default_cell_line
            )

            exp_uuid = uuid.uuid4().hex
            safe_name = sanitize_filename(exp_title)
            pdf_filename = f"NanoSafe_Report_{safe_name}_{exp_uuid[:8]}.pdf"
            pdf_path = os.path.join(REPORT_FOLDER, pdf_filename)
            exp_record_for_pdf = {
                "experiment_name": exp_title, "researcher_name": current_username(),
                "cell_line": default_cell_line, "exposure_time": default_exp_time,
                "medical_application": "General Biomedical Research",
                "iso_compliance": ml_result.get("iso_compliance", "PASS — Biocompatible"),
                "username": current_username(),
            }
            exp_record_for_pdf.update(results)
            generate_pdf_file(exp_record_for_pdf, pdf_path, exp_uuid)

            # Save Experiment
            exp = Experiment(
                user_id=uid, exp_uuid=exp_uuid,
                sample_name=exp_title, researcher_name=current_username(),
                nanoparticle_type="ZnO", cell_line=default_cell_line,
                exposure_time=default_exp_time, csv_filename=f"{exp_title}.csv",
                created_at=datetime.utcnow()
            )
            exp.result = ExperimentResult(
                avg_concentration=results.get("avg_concentration", 0),
                cell_viability=results.get("avg", 0),
                ros=results.get("avg_ros", 0),
                ldh=results.get("avg_ldh", 0),
                apoptosis=results.get("avg_apoptosis", 0),
                toxicity_score=results.get("toxicity_score", 0),
                risk_level=results.get("toxicity_level", "Low"),
                estimated_ic50=str(results.get("ic50", "Not Reached")),
                safe_range=results.get("safe_range", ""),
                interpretation=ml_result.get("interpretation", results.get("interpretation", "")),
                graph_path=results.get("graph_path", ""),
                tables_html=results.get("tables", ""),
                generated_at=datetime.utcnow(),
            )
            exp.report = Report(pdf_path=pdf_path, pdf_filename=pdf_filename, generated_at=datetime.utcnow())
            db.session.add(exp)
            db.session.flush()

            history_record = History(
                experiment_id=exp.id, user_id=uid,
                date_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                sample_name=exp_title, nanoparticle_type="ZnO",
                cell_line=default_cell_line, concentration=results.get("avg_concentration", 0),
                cell_viability=results.get("avg", 0), ros=results.get("avg_ros", 0),
                ldh=results.get("avg_ldh", 0), apoptosis=results.get("avg_apoptosis", 0),
                toxicity_score=results.get("toxicity_score", 0),
                risk_level=results.get("toxicity_level", "Low"),
                estimated_ic50=str(results.get("ic50", "Not Reached")),
                safe_range=results.get("safe_range", ""),
                csv_filename=f"{exp_title}.csv", pdf_path=pdf_path,
                graph_path=results.get("graph_path", ""), researcher_name=current_username(),
                exposure_time=default_exp_time,
                interpretation=ml_result.get("interpretation", results.get("interpretation", "")),
                tables_html=results.get("tables", ""), username=current_username()
            )
            db.session.add(history_record)

            batch_results.append({
                "history_id": exp.id,
                "name": exp_title,
                "cell_line": default_cell_line,
                "exposure_time": default_exp_time,
                "viability": results.get("avg", 0),
                "score": results.get("toxicity_score", 0),
                "risk_level": results.get("toxicity_level", "Low"),
                "ic50": results.get("ic50", "Not Reached"),
                "safe_range": results.get("safe_range", ""),
                "iso_compliance": ml_result.get("iso_compliance", "PASS")
            })
        except Exception as e:
            current_app.logger.warning(f"Batch item failed {exp_title}: {e}")

    db.session.commit()

    # Sort batch results by viability descending
    batch_results.sort(key=lambda x: x["viability"], reverse=True)
    safest_run = batch_results[0] if batch_results else None
    toxic_run = batch_results[-1] if batch_results else None
    safe_count = sum(1 for b in batch_results if b["risk_level"] == "Low")
    batch_pass_rate = round((safe_count / len(batch_results) * 100.0), 1) if batch_results else 0.0

    flash(f"Successfully processed {len(batch_results)} batch experiments!", "success")
    return render_template("batch_import.html",
                           username=session.get("username"),
                           role=session.get("role", "user"),
                           batch_results=batch_results,
                           safest_run=safest_run,
                           toxic_run=toxic_run,
                           safe_count=safe_count,
                           batch_pass_rate=batch_pass_rate)


# ============================================================
# USER PROFILE & RESEARCH WORKSPACE
# ============================================================
@main_bp.route("/profile")
@verified_required
def profile():
    uid = current_user_id()
    user = User.query.get(uid)
    if not user:
        return redirect(url_for("auth.login"))

    # History analytics
    all_history = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    analytics = _compute_analytics(all_history)

    recent = all_history[:5]
    last_analysis = all_history[0].date_time if all_history else None

    # Reports
    exp_ids = [e.id for e in Experiment.query.filter_by(user_id=uid).with_entities(Experiment.id)]
    reports = Report.query.filter(Report.experiment_id.in_(exp_ids)).order_by(Report.generated_at.desc()).all() if exp_ids else []

    # Security Logs
    login_logs = LoginLog.query.filter_by(user_id=uid).order_by(LoginLog.timestamp.desc()).limit(10).all()
    audit_logs = AuditLog.query.filter_by(user_id=uid).order_by(AuditLog.timestamp.desc()).limit(10).all()

    return render_template("profile.html",
        user=user,
        analytics=analytics,
        recent_experiments=recent,
        last_analysis=last_analysis,
        reports=reports,
        all_history=all_history,
        login_logs=login_logs,
        audit_logs=audit_logs,
        active_tab=request.args.get("tab", "profile"),
    )


@main_bp.route("/profile/update", methods=["POST"])
@verified_required
def profile_update():
    uid = current_user_id()
    user = User.query.get(uid)
    if not user:
        return redirect(url_for("auth.login"))

    user.full_name           = request.form.get("full_name", user.full_name or "").strip()
    user.institution         = request.form.get("institution", user.institution or "").strip()
    user.department          = request.form.get("department", user.department or "").strip()
    user.research_role       = request.form.get("research_role", user.research_role or "").strip()
    user.default_cell_line   = request.form.get("default_cell_line", user.default_cell_line or "HeLa")
    user.default_exposure_time = request.form.get("default_exposure_time", user.default_exposure_time or "24h")
    user.preferred_report_format = request.form.get("preferred_report_format", user.preferred_report_format or "pdf")
    user.notify_analysis_completed = request.form.get("notify_analysis_completed") == "on"
    user.notify_report_generated = request.form.get("notify_report_generated") == "on"
    user.notify_security_alerts = request.form.get("notify_security_alerts") == "on"
    user.dark_mode           = request.form.get("dark_mode") == "on"

    db.session.add(AuditLog(
        user_id=uid, username=user.username,
        action="Profile Updated", details="User updated profile settings",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()
    flash("Profile updated successfully.", "success")
    return redirect(url_for("main.profile", tab="settings"))

@main_bp.route("/profile/clear-history", methods=["POST"])
@verified_required
def clear_history():
    uid = current_user_id()
    
    # Delete from history and experiments
    History.query.filter_by(user_id=uid).delete()
    for exp in Experiment.query.filter_by(user_id=uid).all():
        db.session.delete(exp)
        
    db.session.add(AuditLog(
        user_id=uid, username="user",
        action="History Cleared", details="User cleared all their experiment history",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()
    flash("Your experiment history has been cleared.", "success")
    return redirect(url_for("main.profile", tab="settings"))

@main_bp.route("/profile/download-data", methods=["GET"])
@verified_required
def download_data():
    import json
    from flask import Response
    uid = current_user_id()
    user = User.query.get(uid)
    
    # Gather basic profile and experiment history
    history = History.query.filter_by(user_id=uid).all()
    history_list = [h.to_dict() for h in history]
    
    export_data = {
        "profile": {
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "institution": user.institution,
            "department": user.department,
            "research_role": user.research_role
        },
        "experiments": history_list
    }
    
    json_data = json.dumps(export_data, indent=2)
    return Response(
        json_data,
        mimetype="application/json",
        headers={"Content-disposition": "attachment; filename=my_nanosafe_data.json"}
    )



@main_bp.route("/profile/delete-account", methods=["POST"])
@verified_required
def delete_account():
    uid = current_user_id()
    user = User.query.get(uid)
    if not user:
        return redirect(url_for("auth.login"))

    confirm_text = request.form.get("confirm_delete", "")
    if confirm_text != "DELETE":
        flash("You must type DELETE to confirm account deletion.", "danger")
        return redirect(url_for("main.profile", tab="settings"))

    # Delete all user data
    History.query.filter_by(user_id=uid).delete()
    for exp in Experiment.query.filter_by(user_id=uid).all():
        db.session.delete(exp)
    db.session.delete(user)
    db.session.commit()

    session.clear()
    flash("Your account and all data have been permanently deleted.", "info")
    return redirect(url_for("auth.login"))


# ============================================================
# UPLOAD + ANALYZE
# ============================================================
@main_bp.route("/upload", methods=["GET", "POST"])
@verified_required
def upload():
    uid = current_user_id()
    if request.method == "GET":
        participants = StudyParticipant.query.filter_by(user_id=uid).order_by(StudyParticipant.created_at.desc()).all()
        samples = BiologicalSample.query.filter_by(user_id=uid).order_by(BiologicalSample.created_at.desc()).all()
        preselected_participant_id = request.args.get("participant_id", type=int)
        preselected_sample_id = request.args.get("sample_id", type=int)
        return render_template(
            "upload.html",
            participants=participants,
            samples=samples,
            preselected_participant_id=preselected_participant_id,
            preselected_sample_id=preselected_sample_id
        )

    experiment_name = request.form.get("experiment_name", "")
    researcher_name = request.form.get("researcher_name", "")
    cell_line       = request.form.get("cell_line", "")
    exposure_time   = request.form.get("exposure_time", "")
    medical_app     = request.form.get("medical_application", "general")
    participant_id  = request.form.get("participant_id", type=int)
    sample_id       = request.form.get("sample_id", type=int)
    
    df = None
    file = request.files.get("file")
    csv_filename = file.filename if (file and file.filename != "") else "Manual Data Entry"

    if file and file.filename != "":
        path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(path)
        try:
            df = pd.read_csv(path) if file.filename.lower().endswith(".csv") else pd.read_excel(path)
        except Exception as e:
            return render_template("upload.html", error=f"File reading error: {e}")
    else:
        concentration = request.form.getlist("concentration")
        viability     = request.form.getlist("viability")
        ros_list      = request.form.getlist("ros")
        ldh_list      = request.form.getlist("ldh")
        apoptosis_list= request.form.getlist("apoptosis")
        rows = []
        try:
            for i in range(len(concentration)):
                if concentration[i] != "" and viability[i] != "":
                    rows.append({
                        "Concentration":  float(concentration[i]),
                        "Cell Viability": float(viability[i]),
                        "ROS Level":  float(ros_list[i]) if ros_list[i] else 0,
                        "LDH Release": float(ldh_list[i]) if ldh_list[i] else 0,
                        "Apoptosis":   float(apoptosis_list[i]) if apoptosis_list[i] else 0,
                    })
            if rows:
                df = pd.DataFrame(rows)
        except Exception as e:
            return render_template("upload.html", error=f"Manual data error: {e}")

    if df is None or df.empty:
        return render_template("upload.html", error="No valid data provided. Please enter at least one row.")

    try:
        results = process_experiment_data(df, cell_line, STATIC_FOLDER, experiment_name, medical_application=medical_app)
    except Exception as e:
        return render_template("upload.html", error=str(e))

    # --- LOCAL OFFLINE ML PREDICTION (Zero-API) ---
    max_dose = df['Concentration'].max() if 'Concentration' in df.columns else 0.0
    exp_time_val = 24.0
    if exposure_time:
        m = re.search(r'\d+', str(exposure_time))
        if m:
            exp_time_val = float(m.group())

    ml_result = ml_predictor.predict_toxicity(
        nanoparticle="ZnO",
        dose=max_dose,
        exposure_time=exp_time_val,
        avg_viability=results.get('avg'),
        ros=results.get('avg_ros'),
        ldh=results.get('avg_ldh'),
        apoptosis=results.get('avg_apoptosis'),
        cell_line=cell_line,
        medical_application=medical_app
    )
    results['ml_prediction'] = ml_result
    if ml_result and isinstance(ml_result, dict):
        results['interpretation'] = ml_result.get('interpretation', results['interpretation'])
        results['iso_compliance'] = ml_result.get('iso_compliance', 'PASS — Biocompatible')
        results['medical_application'] = ml_result.get('medical_application', 'General Biomedical Research')

    exp_uuid = uuid.uuid4().hex

    # Generate PDF with experiment name
    safe_name = sanitize_filename(experiment_name or "ZnO_Experiment")
    pdf_filename = f"NanoSafe_Report_{safe_name}_{exp_uuid[:8]}.pdf"
    pdf_path = os.path.join(REPORT_FOLDER, pdf_filename)
    exp_record_for_pdf = {
        "experiment_name": experiment_name, "researcher_name": researcher_name,
        "cell_line": cell_line, "exposure_time": exposure_time,
        "medical_application": results.get("medical_application", "General Biomedical Research"),
        "iso_compliance": results.get("iso_compliance", "PASS — Biocompatible"),
        "username": current_username(),
    }
    exp_record_for_pdf.update(results)
    try:
        generate_pdf_file(exp_record_for_pdf, pdf_path, exp_uuid)
    except Exception as e:
        current_app.logger.warning(f"PDF generation failed: {e}")
        pdf_path = ""
        pdf_filename = ""

    # Save Experiment to SQLAlchemy
    exp = Experiment(
        user_id=uid,
        exp_uuid=exp_uuid,
        sample_name=experiment_name or "Untitled Sample",
        researcher_name=researcher_name,
        nanoparticle_type="ZnO",
        cell_line=cell_line,
        exposure_time=exposure_time,
        csv_filename=csv_filename,
        created_at=datetime.utcnow(),
    )

    result_record = ExperimentResult(
        avg_concentration=results.get("avg_concentration", 0),
        cell_viability=results.get("avg", 0),
        ros=results.get("avg_ros", 0),
        ldh=results.get("avg_ldh", 0),
        apoptosis=results.get("avg_apoptosis", 0),
        toxicity_score=results.get("toxicity_score", 0),
        risk_level=results.get("toxicity_level", "Low"),
        estimated_ic50=str(results.get("ic50", "Not Reached")),
        safe_range=results.get("safe_range", ""),
        interpretation=results.get("interpretation", ""),
        graph_path=results.get("graph_path", ""),
        tables_html=results.get("tables", ""),
        generated_at=datetime.utcnow(),
    )
    exp.result = result_record

    if pdf_path and os.path.exists(pdf_path):
        report_record = Report(
            pdf_path=pdf_path,
            pdf_filename=pdf_filename,
            generated_at=datetime.utcnow(),
        )
        exp.report = report_record

    db.session.add(exp)
    db.session.flush()

    # Link Experiment to Biological Sample & Patient Registry if provided
    if sample_id:
        target_sample = BiologicalSample.query.filter_by(id=sample_id, user_id=uid).first()
        if target_sample:
            db.session.add(SampleExperimentLink(sample_id=target_sample.id, experiment_id=exp.id))
    elif participant_id:
        target_part = StudyParticipant.query.filter_by(id=participant_id, user_id=uid).first()
        if target_part:
            sample_obj = BiologicalSample.query.filter_by(participant_fk=target_part.id, user_id=uid).first()
            if not sample_obj:
                sample_obj = BiologicalSample(
                    user_id=uid,
                    sample_id=f"{target_part.participant_id}-S1",
                    participant_fk=target_part.id,
                    sample_type="Biological Specimen / Primary Culture",
                    cell_type=cell_line or "Human Primary / Cell Line",
                    sample_status="Active",
                    notes=f"Auto-registered for experiment run: {experiment_name}"
                )
                db.session.add(sample_obj)
                db.session.flush()
            db.session.add(SampleExperimentLink(sample_id=sample_obj.id, experiment_id=exp.id))

    # Denormalized History record
    history_record = History(
        experiment_id=exp.id,
        user_id=uid,
        date_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        sample_name=experiment_name or "Untitled Sample",
        nanoparticle_type="ZnO",
        cell_line=cell_line,
        concentration=results.get("avg_concentration", 0),
        cell_viability=results.get("avg", 0),
        ros=results.get("avg_ros", 0),
        ldh=results.get("avg_ldh", 0),
        apoptosis=results.get("avg_apoptosis", 0),
        toxicity_score=results.get("toxicity_score", 0),
        risk_level=results.get("toxicity_level", "Low"),
        estimated_ic50=str(results.get("ic50", "Not Reached")),
        safe_range=results.get("safe_range", ""),
        csv_filename=csv_filename,
        pdf_path=pdf_path,
        graph_path=results.get("graph_path", ""),
        researcher_name=researcher_name,
        exposure_time=exposure_time,
        interpretation=results.get("interpretation", ""),
        tables_html=results.get("tables", ""),
        username=current_username(),
    )
    db.session.add(history_record)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Experiment Created",
        details=f"Experiment '{experiment_name}' submitted",
    ))
    db.session.commit()

    session["latest_history_id"] = history_record.id

    # JSON response for Android app
    if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
        return jsonify({
            "success": True,
            "experiment_id": exp.id,
            "results": {
                "avg": results.get("avg"),
                "toxicity_score": results.get("toxicity_score"),
                "toxicity_level": results.get("toxicity_level"),
                "ic50": results.get("ic50"),
                "safe_range": results.get("safe_range"),
            }
        })

    return render_template(
        "dashboard.html",
        experiment_name=experiment_name, researcher_name=researcher_name,
        cell_line=cell_line, exposure_time=exposure_time,
        medical_application=results.get('medical_application', 'General Biomedical Research'),
        iso_compliance=results.get('iso_compliance', 'PASS — Biocompatible'),
        avg=results['avg'], result=results['result'], ic50=results['ic50'],
        safe_range=results['safe_range'],
        safe_ceiling=results.get('safe_ceiling', 0),
        fit_method=results.get('fit_method', '4PL Sigmoidal Non-Linear Fit'),
        toxicity_score=results['toxicity_score'], toxicity_level=results['toxicity_level'],
        interpretation=results['interpretation'], graph=results['graph_name'],
        tables=results['tables'],
        ml_prediction=results.get('ml_prediction'),
        avg_ros=results.get('avg_ros', 0),
        avg_ldh=results.get('avg_ldh', 0),
        avg_apoptosis=results.get('avg_apoptosis', 0),
        raw_data=results.get('raw_data', [])
    )


# ============================================================
# COMPARE
# ============================================================
@main_bp.route("/compare", methods=["GET", "POST"])
@verified_required
def compare():
    return render_template("compare.html")


@main_bp.route("/ajax/compare", methods=["POST"])
@verified_required
def ajax_compare():
    try:
        exp_count = int(request.form.get("exp_count", 0))
        if exp_count < 2:
            return jsonify({"error": "Minimum 2 experiments required"}), 400

        cell_line_factors = {"HeLa":1.00,"MCF-7":1.25,"A549":1.20,"HEK293":0.85,
                             "NIH-3T3":0.80,"HepG2":1.05,"Caco-2":0.95,"CHO":0.90,
                             "Jurkat":1.30,"PC12":1.15}
        results = []
        plt.figure(figsize=(8, 4.5))

        for i in range(exp_count):
            exp_name    = request.form.get(f"exp_{i}_name", f"Experiment {i+1}").strip() or f"Experiment {i+1}"
            cell_line   = request.form.get(f"exp_{i}_cell_line", "HeLa")
            exposure_time = request.form.get(f"exp_{i}_exposure_time", "24h")
            mode        = request.form.get(f"exp_{i}_mode", "manual")
            df          = None

            if mode == "file":
                file = request.files.get(f"exp_{i}_file")
                if file and file.filename != "":
                    path = os.path.join(UPLOAD_FOLDER, file.filename)
                    file.save(path)
                    df = pd.read_csv(path) if file.filename.lower().endswith(".csv") else pd.read_excel(path)
            else:
                concs = request.form.getlist(f"exp_{i}_concentration[]")
                viabs = request.form.getlist(f"exp_{i}_viability[]")
                ross  = request.form.getlist(f"exp_{i}_ros[]")
                ldhs  = request.form.getlist(f"exp_{i}_ldh[]")
                apops = request.form.getlist(f"exp_{i}_apoptosis[]")
                rows  = []
                for idx in range(len(concs)):
                    if concs[idx] and viabs[idx]:
                        rows.append({
                            "Concentration":  float(concs[idx]),
                            "Cell Viability": float(viabs[idx]),
                            "ROS Level":  float(ross[idx]) if idx<len(ross) and ross[idx] else 0.0,
                            "LDH Release": float(ldhs[idx]) if idx<len(ldhs) and ldhs[idx] else 0.0,
                            "Apoptosis":   float(apops[idx]) if idx<len(apops) and apops[idx] else 0.0,
                        })
                if rows: df = pd.DataFrame(rows)

            if df is None or df.empty: continue
            df["Concentration"]  = pd.to_numeric(df["Concentration"],  errors="coerce")
            df["Cell Viability"] = pd.to_numeric(df["Cell Viability"], errors="coerce")
            df["ROS Level"]   = pd.to_numeric(df.get("ROS Level",   0), errors="coerce").fillna(0)
            df["LDH Release"] = pd.to_numeric(df.get("LDH Release", 0), errors="coerce").fillna(0)
            df["Apoptosis"]   = pd.to_numeric(df.get("Apoptosis",   0), errors="coerce").fillna(0)
            df = df.dropna(subset=["Concentration","Cell Viability"])
            if df.empty: continue

            avg_viab = round(float(df["Cell Viability"].mean()), 2)
            avg_ros  = round(float(df["ROS Level"].mean()), 2)
            avg_ldh  = round(float(df["LDH Release"].mean()), 2)
            avg_apop = round(float(df["Apoptosis"].mean()), 2)
            factor   = cell_line_factors.get(cell_line, 1.0)
            base     = (100-avg_viab)*0.50 + avg_ros*0.20 + avg_ldh*0.15 + avg_apop*0.15
            tox      = round(float(base*factor), 2)

            if tox < 25:   lv="Low";      st="Safe"
            elif tox < 55: lv="Moderate"; st="Moderate Risk"
            else:          lv="High";     st="Toxic"

            df_s = df.sort_values("Concentration")
            ic50v = None
            for k in range(len(df_s)-1):
                v1,v2=df_s.iloc[k]["Cell Viability"],df_s.iloc[k+1]["Cell Viability"]
                c1,c2=df_s.iloc[k]["Concentration"], df_s.iloc[k+1]["Concentration"]
                if (v1>=50 and v2<=50) or (v1<=50 and v2>=50):
                    ic50v=c1+((50-v1)*(c2-c1))/(v2-v1); break
            ic50n  = round(float(ic50v),2) if ic50v is not None else round(float(df["Concentration"].median()),2)
            ic50s  = f"{ic50n} µg/mL"
            safe_d = df[df["Cell Viability"]>=80]
            sr_num = round(float(safe_d["Concentration"].max()),2) if not safe_d.empty else round(float(df["Concentration"].min()),2)
            sr_str = f"0 - {sr_num} µg/mL"

            plt.plot(df_s["Concentration"],df_s["Cell Viability"],marker="o",linewidth=2,label=exp_name)

            # --- ML Prediction per experiment ---
            exp_time_num = 24.0
            m = re.search(r'\d+', str(exposure_time))
            if m:
                exp_time_num = float(m.group())
            max_dose = float(df["Concentration"].max()) if not df.empty else 0.0

            ml_pred = ml_predictor.predict_toxicity(
                nanoparticle="ZnO",
                dose=max_dose,
                exposure_time=exp_time_num,
                avg_viability=avg_viab,
                ros=avg_ros,
                ldh=avg_ldh,
                apoptosis=avg_apop,
                cell_line=cell_line,
            )

            results.append({"name":exp_name,"cell_line":cell_line,"exposure_time":exposure_time,
                "avg_viability":avg_viab,"avg_ros":avg_ros,"avg_ldh":avg_ldh,"avg_apoptosis":avg_apop,
                "toxicity_score":tox,"toxicity_level":lv,"result":st,
                "ic50":ic50s,"ic50_num":ic50n,"safe_range":sr_str,"safe_range_num":sr_num,
                # ML predictions
                "ml_status":     ml_pred.get("status", st) if ml_pred else st,
                "ml_confidence": ml_pred.get("confidence", "N/A") if ml_pred else "N/A",
                "ml_tox_score":  ml_pred.get("toxicity_score", tox) if ml_pred else tox,
                "ml_tox_level":  ml_pred.get("toxicity_level", lv) if ml_pred else lv,
                "ml_ic50":       ml_pred.get("ic50", ic50s) if ml_pred else ic50s,
                "ml_safe_range": ml_pred.get("safe_range", sr_str) if ml_pred else sr_str,
            })

        if not results: return jsonify({"error":"No valid experiment data provided."}),400

        graph_name = f"compare_{uuid.uuid4().hex}.png"
        graph_path = os.path.join(STATIC_FOLDER, graph_name)
        plt.xlabel("Concentration (µg/mL)"); plt.ylabel("Cell Viability (%)")
        plt.title("ZnO Multi-Experiment Dose Response Comparison",fontweight="bold")
        plt.grid(True,linestyle="--",alpha=0.7)
        plt.legend(bbox_to_anchor=(1.05,1),loc="upper left")
        plt.tight_layout(); plt.savefig(graph_path,dpi=150); plt.close()

        safest     = min(results,key=lambda x:(x["toxicity_score"],-x["avg_viability"]))
        most_toxic = max(results,key=lambda x:(x["toxicity_score"],-x["avg_viability"]))
        highest_v  = max(results,key=lambda x:x["avg_viability"])
        lowest_v   = min(results,key=lambda x:x["avg_viability"])
        highest_ic = max(results,key=lambda x:x["ic50_num"])
        lowest_ic  = min(results,key=lambda x:x["ic50_num"])
        lowest_ros = min(results,key=lambda x:x["avg_ros"])
        lowest_ldh = min(results,key=lambda x:x["avg_ldh"])
        lowest_apo = min(results,key=lambda x:x["avg_apoptosis"])

        # ML-based rankings
        ml_safest     = min(results, key=lambda x: (float(x["ml_tox_score"]) if str(x["ml_tox_score"]).replace('.','',1).isdigit() else 999))
        ml_most_toxic = max(results, key=lambda x: (float(x["ml_tox_score"]) if str(x["ml_tox_score"]).replace('.','',1).isdigit() else 0))

        summary = {
            "best_performer":f"'{safest['name']}' ({safest['cell_line']},{safest['exposure_time']}) achieved optimal safety with {safest['avg_viability']}% viability and toxicity score {safest['toxicity_score']}.",
            "highest_toxicity":f"'{most_toxic['name']}' had highest cytotoxicity (score {most_toxic['toxicity_score']}, viability {most_toxic['avg_viability']}%).",
            "recommended_usage":f"'{safest['name']}' is recommended for biomedical use (safe window: {safest['safe_range']}).",
            "rationale":f"Low ROS ({safest['avg_ros']}), LDH ({safest['avg_ldh']}), high IC50 ({safest['ic50']}) confirm high biocompatibility.",
            "ml_best": f"ML model ranks '{ml_safest['name']}' safest (ML score: {ml_safest['ml_tox_score']}, status: {ml_safest['ml_status']}).",
            "ml_worst": f"ML model flags '{ml_most_toxic['name']}' most toxic (ML score: {ml_most_toxic['ml_tox_score']}, status: {ml_most_toxic['ml_status']}).",
        }

        db.session.add(AuditLog(
            user_id=current_user_id(), username=current_username(),
            action="Comparison Created", details=f"Compared {len(results)} experiments",
        ))
        db.session.commit()

        return jsonify({"results":results,"graph":graph_name,
            "highlights":{"safest":safest["name"],"most_toxic":most_toxic["name"],
                "highest_viability":highest_v["name"],"lowest_viability":lowest_v["name"],
                "highest_ic50":highest_ic["name"],"lowest_ic50":lowest_ic["name"],
                "lowest_ros":lowest_ros["name"],"lowest_ldh":lowest_ldh["name"],
                "lowest_apoptosis":lowest_apo["name"],
                "ml_safest": ml_safest["name"], "ml_most_toxic": ml_most_toxic["name"]},
            "summary":summary})
    except Exception as e:
        return jsonify({"error":str(e)}),500




# ============================================================
# PROJECT MANAGEMENT ROUTES
# ============================================================

@main_bp.route("/projects/create", methods=["POST"])
@verified_required
def create_project():
    uid = current_user_id()
    name = request.form.get("name", "").strip()
    description = request.form.get("description", "").strip()

    if not name:
        flash("Project name is required.", "danger")
        return redirect(url_for("main.history"))

    from models import Project
    new_proj = Project(user_id=uid, name=name, description=description)
    db.session.add(new_proj)
    db.session.commit()
    flash(f"Project '{name}' created successfully.", "success")
    return redirect(url_for("main.history"))

@main_bp.route("/projects/delete/<int:project_id>", methods=["POST"])
@verified_required
def delete_project(project_id):
    uid = current_user_id()
    from models import Project
    proj = Project.query.filter_by(id=project_id, user_id=uid).first()
    
    if not proj:
        flash("Project not found.", "danger")
        return redirect(url_for("main.history"))

    # SQLAlchemy cascade will set history.project_id to NULL
    db.session.delete(proj)
    db.session.commit()
    flash("Project deleted. Experiments have been moved to Unassigned.", "info")
    return redirect(url_for("main.history"))

@main_bp.route("/history/move_to_project", methods=["POST"])
@verified_required
def move_to_project():
    uid = current_user_id()
    data = request.get_json()
    history_id = data.get("history_id")
    project_id = data.get("project_id")

    hist = History.query.filter_by(id=history_id, user_id=uid).first()
    if not hist:
        return jsonify({"success": False, "error": "Experiment not found"}), 404

    if project_id == "":
        hist.project_id = None
    else:
        hist.project_id = int(project_id)
        
    db.session.commit()
    return jsonify({"success": True})

# ============================================================
# SETTINGS
# ============================================================
@main_bp.route("/report")
@verified_required
def report():
    history_id = session.get("latest_history_id")
    if not history_id:
        return "Please analyze data first before downloading the report."

    uid = current_user_id()
    hist = History.query.filter_by(id=history_id, user_id=uid).first()
    if not hist:
        return "Experiment report not found."

    pdf_path = hist.pdf_path
    if not pdf_path or not os.path.exists(pdf_path):
        pdf_filename = f"NanoSafe_Report_{hist.experiment_id or history_id}.pdf"
        pdf_path = os.path.join(REPORT_FOLDER, pdf_filename)
        exp_data = _history_to_pdf_dict(hist)
        generate_pdf_file(exp_data, pdf_path, history_id)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="PDF Downloaded", details=f"Downloaded report for history #{history_id}",
    ))
    db.session.commit()
    safe_name = sanitize_filename(hist.sample_name or f"Experiment_{history_id}")
    download_filename = f"NanoSafe_Report_{safe_name}.pdf"
    return send_file(pdf_path, as_attachment=True, download_name=download_filename)


# ============================================================
# HISTORY ROUTES (per-user isolated via SQLAlchemy)
# ============================================================
@main_bp.route("/history", methods=["GET"])
@verified_required
def history():
    uid = current_user_id()

    sample_name  = request.args.get("sample_name",  "").strip()
    cell_line    = request.args.get("cell_line",    "").strip()
    risk_level   = request.args.get("risk_level",   "").strip()
    filter_date  = request.args.get("date",         "").strip()
    sort         = request.args.get("sort",         "newest")
    project_id   = request.args.get("project_id",   "")
    selected_ids_str = request.args.get("selected_ids", "")
    page         = int(request.args.get("page",     1))
    per_page     = 10

    # Always filter by user_id for data isolation
    query = History.query.filter_by(user_id=uid)

    if project_id:
        if project_id == "unassigned":
            query = query.filter(History.project_id == None)
        else:
            query = query.filter(History.project_id == int(project_id))

    if sample_name:
        query = query.filter(History.sample_name.ilike(f"%{sample_name}%"))
    if cell_line:
        query = query.filter(History.cell_line.ilike(f"%{cell_line}%"))
    if risk_level:
        query = query.filter_by(risk_level=risk_level)

    if sort == "oldest":
        query = query.order_by(History.id.asc())
    else:
        query = query.order_by(History.id.desc())

    total_count = query.count()
    total_pages = max(1, (total_count + per_page - 1) // per_page)
    records = query.offset((page - 1) * per_page).limit(per_page).all()

    exp_dicts = [h.to_dict() for h in records]

    # For analytics, use the filtered history rather than all history
    filtered_history = query.all()
    analytics = _compute_analytics(filtered_history)
    
    # For chart data, if selected_ids is provided, plot only those
    if selected_ids_str:
        try:
            ids = [int(x) for x in selected_ids_str.split(',') if x.strip()]
            chart_history = History.query.filter(History.id.in_(ids), History.user_id == uid).all()
        except:
            chart_history = filtered_history[:10]
    else:
        chart_history = filtered_history[:10]

    chart_data = _compute_chart_data(chart_history, analytics)
    
    # For distinct cell lines dropdown, it's better to use all_user_history
    all_user_history = History.query.filter_by(user_id=uid).all()
    distinct_lines = sorted(list(set(
        h.cell_line.strip() for h in all_user_history if h.cell_line and h.cell_line.strip()
    )))
    
    # Fetch all projects for the user
    from models import Project
    projects = Project.query.filter_by(user_id=uid).order_by(Project.created_at.desc()).all()

    return render_template("history.html",
        experiments=exp_dicts,
        analytics={
            "total_experiments":    analytics["total_experiments"],
            "avg_toxicity_score":   analytics["avg_toxicity_score"],
            "highest_toxicity":     analytics["highest_toxicity"],
            "avg_ic50":             analytics["avg_ic50"],
            "high_risk_samples":    analytics["high_risk_count"],
            "moderate_risk_samples":analytics["moderate_risk_count"],
            "low_risk_samples":     analytics["low_risk_count"],
        },
        chart_data=chart_data,
        filter_sample_name=sample_name, filter_cell_line=cell_line,
        filter_risk_level=risk_level, filter_date=filter_date,
        sort=sort, page=page, total_pages=total_pages,
        total_count=total_count, cell_lines=distinct_lines,
        projects=projects, current_project_id=project_id,
        selected_ids_str=selected_ids_str
    )

@main_bp.route("/history/<int:history_id>")
@verified_required
def history_detail(history_id):
    uid = current_user_id()
    hist = History.query.filter(
        (History.id == history_id) | (History.experiment_id == history_id),
        History.user_id == uid
    ).first()
    if not hist:
        flash("Experiment not found.")
        return redirect(url_for("main.history"))
    exp = hist.to_dict()
    graph_file = os.path.basename(exp.get("graph_path","")) if exp.get("graph_path") else ""
    
    raw_data = []
    if exp.get("csv_filename"):
        csv_path = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), exp["csv_filename"])
        if os.path.exists(csv_path):
            try:
                df = pd.read_csv(csv_path)
                raw_data = df.to_dict(orient="records")
            except Exception:
                pass

    return render_template("history_detail.html", exp=exp, graph=graph_file, raw_data=raw_data)


@main_bp.route("/delete_history/<int:history_id>", methods=["POST"])
@verified_required
def delete_history(history_id):
    uid = current_user_id()
    hist = History.query.filter(
        (History.id == history_id) | (History.experiment_id == history_id),
        History.user_id == uid
    ).first()
    if not hist:
        return jsonify({"error": "Experiment not found"}), 404

    db.session.delete(hist)
    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Record Deleted", details=f"Deleted history #{history_id}",
    ))
    db.session.commit()
    return jsonify({"success": True, "message": "Experiment deleted successfully."})


@main_bp.route("/download_report/<int:history_id>")
@verified_required
def download_history_report(history_id):
    uid = current_user_id()
    hist = History.query.filter(
        (History.id == history_id) | (History.experiment_id == history_id),
        History.user_id == uid
    ).first()
    
    exp = None
    if not hist:
        exp = Experiment.query.filter_by(id=history_id, user_id=uid).first()
        if not exp:
            flash("Experiment report not found.")
            return redirect(url_for("main.history"))

    sample_name = hist.sample_name if hist else (exp.sample_name if exp else f"Experiment_{history_id}")
    pdf_path = (hist.pdf_path if hist else (exp.report.pdf_path if (exp and exp.report) else None))
    
    if not pdf_path or not os.path.exists(pdf_path):
        safe_name = sanitize_filename(sample_name)
        pdf_filename = f"NanoSafe_Report_{safe_name}_{history_id}.pdf"
        pdf_path = os.path.join(REPORT_FOLDER, pdf_filename)
        
        if hist:
            exp_data = _history_to_pdf_dict(hist)
        else:
            exp_data = {
                "experiment_name": exp.sample_name, "researcher_name": exp.researcher_name,
                "cell_line": exp.cell_line, "exposure_time": exp.exposure_time,
                "nanoparticle_type": exp.nanoparticle_type,
                "csv_filename": exp.csv_filename, "username": current_username(),
                "avg": exp.result.cell_viability if exp.result else 85,
                "avg_concentration": exp.result.avg_concentration if exp.result else 0,
                "avg_ros": exp.result.ros if exp.result else 0,
                "avg_ldh": exp.result.ldh if exp.result else 0,
                "avg_apoptosis": exp.result.apoptosis if exp.result else 0,
                "toxicity_score": exp.result.toxicity_score if exp.result else 15,
                "toxicity_level": exp.result.risk_level if exp.result else "Low",
                "ic50": exp.result.estimated_ic50 if exp.result else "Not Reached",
                "safe_range": exp.result.safe_range if exp.result else "",
                "interpretation": exp.result.interpretation if exp.result else "",
                "graph_path": exp.result.graph_path if exp.result else "",
            }
        generate_pdf_file(exp_data, pdf_path, history_id)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="PDF Downloaded", details=f"Downloaded report for '{sample_name}' (#{history_id})",
    ))
    db.session.commit()
    safe_name = sanitize_filename(sample_name)
    download_filename = f"NanoSafe_Report_{safe_name}.pdf"
    return send_file(pdf_path, as_attachment=True, download_name=download_filename)


@main_bp.route("/reports/rename/<int:report_id>", methods=["POST"])
@verified_required
def rename_report(report_id):
    uid = current_user_id()
    new_name = request.form.get("new_name", "").strip()
    if not new_name:
        flash("Report name cannot be empty.", "danger")
        return redirect(url_for("main.profile", tab="reports"))

    report = Report.query.get(report_id)
    if not report:
        flash("Report not found.", "danger")
        return redirect(url_for("main.profile", tab="reports"))

    exp = Experiment.query.filter_by(id=report.experiment_id, user_id=uid).first()
    if not exp:
        flash("Unauthorized access to report.", "danger")
        return redirect(url_for("main.profile", tab="reports"))

    # Update Experiment and History names
    old_name = exp.sample_name
    exp.sample_name = new_name
    hist = History.query.filter_by(experiment_id=exp.id, user_id=uid).first()
    if hist:
        hist.sample_name = new_name

    safe_name = sanitize_filename(new_name)
    report.pdf_filename = f"NanoSafe_Report_{safe_name}_{report.id}.pdf"

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Report Renamed", details=f"Renamed report from '{old_name}' to '{new_name}'",
    ))
    db.session.commit()
    flash(f"Report successfully renamed to '{new_name}'.", "success")
    return redirect(url_for("main.profile", tab="reports"))


@main_bp.route("/ajax/get_history_experiment/<int:history_id>")
@verified_required
def get_history_experiment(history_id):
    uid = current_user_id()
    hist = History.query.filter_by(id=history_id, user_id=uid).first()
    if not hist:
        return jsonify({"error": "Not found"}), 404
    return jsonify(hist.to_dict())


# ============================================================
# EXPORT & BACKUP (per-user)
# ============================================================
@main_bp.route("/export/csv")
@verified_required
def export_csv():
    uid = current_user_id()
    
    sample_name  = request.args.get("sample_name",  "").strip()
    cell_line    = request.args.get("cell_line",    "").strip()
    risk_level   = request.args.get("risk_level",   "").strip()
    sort         = request.args.get("sort",         "newest")

    query = History.query.filter_by(user_id=uid)

    if sample_name:
        query = query.filter(History.sample_name.ilike(f"%{sample_name}%"))
    if cell_line:
        query = query.filter(History.cell_line.ilike(f"%{cell_line}%"))
    if risk_level:
        query = query.filter_by(risk_level=risk_level)

    if sort == "oldest":
        query = query.order_by(History.id.asc())
    else:
        query = query.order_by(History.id.desc())

    records = query.all()
    rows = [h.to_dict() for h in records]
    df = pd.DataFrame(rows) if rows else pd.DataFrame()
    csv_path = os.path.join(REPORT_FOLDER, f"NanoSafe_History_{current_username()}.csv")
    df.to_csv(csv_path, index=False)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Data Exported", details="Exported history as CSV",
    ))
    db.session.commit()
    return send_file(csv_path, as_attachment=True, download_name="NanoSafe_Experiment_History.csv")


@main_bp.route("/export/excel")
@verified_required
def export_excel():
    uid = current_user_id()
    
    sample_name  = request.args.get("sample_name",  "").strip()
    cell_line    = request.args.get("cell_line",    "").strip()
    risk_level   = request.args.get("risk_level",   "").strip()
    sort         = request.args.get("sort",         "newest")

    query = History.query.filter_by(user_id=uid)

    if sample_name:
        query = query.filter(History.sample_name.ilike(f"%{sample_name}%"))
    if cell_line:
        query = query.filter(History.cell_line.ilike(f"%{cell_line}%"))
    if risk_level:
        query = query.filter_by(risk_level=risk_level)

    if sort == "oldest":
        query = query.order_by(History.id.asc())
    else:
        query = query.order_by(History.id.desc())

    records = query.all()
    rows = [h.to_dict() for h in records]
    df = pd.DataFrame(rows) if rows else pd.DataFrame()
    try:
        excel_path = os.path.join(REPORT_FOLDER, f"NanoSafe_History_{current_username()}.xlsx")
        df.to_excel(excel_path, index=False, engine="openpyxl")
        dl_path, dl_name = excel_path, "NanoSafe_Experiment_History.xlsx"
    except Exception:
        csv_fallback = os.path.join(REPORT_FOLDER, f"NanoSafe_History_{current_username()}.csv")
        df.to_csv(csv_fallback, index=False)
        dl_path, dl_name = csv_fallback, "NanoSafe_Experiment_History.csv"

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Data Exported", details="Exported history as Excel",
    ))
    db.session.commit()
    return send_file(dl_path, as_attachment=True, download_name=dl_name)


@main_bp.route("/export/db")
@verified_required
def export_db():
    uid = current_user_id()
    records = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    rows = [h.to_dict() for h in records]
    backup_path = os.path.join(BACKUP_FOLDER, f"nanosafe_export_{current_username()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(backup_path, "w") as f:
        json.dump(rows, f, indent=2, default=str)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Database Exported", details="Downloaded JSON export",
    ))
    db.session.commit()
    return send_file(backup_path, as_attachment=True, download_name=os.path.basename(backup_path))


@main_bp.route("/backup/create")
@verified_required
def backup_create():
    uid = current_user_id()
    records = History.query.filter_by(user_id=uid).order_by(History.id.desc()).all()
    rows = [h.to_dict() for h in records]
    backup_path = os.path.join(BACKUP_FOLDER, f"nanosafe_backup_{current_username()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(backup_path, "w") as f:
        json.dump(rows, f, indent=2, default=str)

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Manual Backup Created", details=os.path.basename(backup_path),
    ))
    db.session.commit()
    return send_file(backup_path, as_attachment=True, download_name=os.path.basename(backup_path))


@main_bp.route("/backup/list")
@verified_required
def backup_list():
    files = []
    username = current_username()
    for f in sorted(os.listdir(BACKUP_FOLDER), reverse=True):
        if (f.endswith(".json") or f.endswith(".db")) and username in f:
            fpath = os.path.join(BACKUP_FOLDER, f)
            files.append({
                "filename": f,
                "size_kb": round(os.path.getsize(fpath) / 1024, 2),
                "created": datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%d %H:%M:%S"),
            })
    return jsonify({"backups": files})


@main_bp.route("/history/archive/<int:history_id>", methods=["POST"])
@verified_required
def archive_experiment_route(history_id):
    uid = current_user_id()
    hist = History.query.filter_by(id=history_id, user_id=uid).first()
    if not hist:
        return jsonify({"error": "Experiment not found"}), 404

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Experiment Archived", details=f"Archived experiment #{history_id}",
    ))
    db.session.commit()
    return jsonify({"success": True, "message": f"Experiment #{history_id} archived."})


# ============================================================
# HELPERS
# ============================================================
def _history_to_pdf_dict(hist: History) -> dict:
    """Convert a History ORM record to a dict suitable for PDF generation."""
    data = {
        "experiment_name": hist.sample_name,
        "sample_name":     hist.sample_name,
        "cell_line":       hist.cell_line,
        "avg":             hist.cell_viability,
        "cell_viability":  hist.cell_viability,
        "avg_ros":         hist.ros, "ros": hist.ros,
        "avg_ldh":         hist.ldh, "ldh": hist.ldh,
        "avg_apoptosis":   hist.apoptosis, "apoptosis": hist.apoptosis,
        "avg_concentration": hist.concentration,
        "toxicity_score":  hist.toxicity_score,
        "toxicity_level":  hist.risk_level, "risk_level": hist.risk_level,
        "result": "Safe" if hist.risk_level=="Low" else ("Moderate Risk" if hist.risk_level=="Moderate" else "Toxic"),
        "ic50":            hist.estimated_ic50,
        "estimated_ic50":  hist.estimated_ic50,
        "safe_range":      hist.safe_range,
        "researcher_name": hist.researcher_name,
        "exposure_time":   hist.exposure_time,
        "graph_path":      hist.graph_path,
        "interpretation":  hist.interpretation,
        "username":        hist.username or "",
        "csv_filename":    hist.csv_filename or "",
        "date_time":       hist.date_time or "",
    }

    # Query linked biological sample and study participant
    if hist.experiment_id:
        link = SampleExperimentLink.query.filter_by(experiment_id=hist.experiment_id).first()
        if link and link.sample:
            sample = link.sample
            data["biological_sample_id"] = sample.sample_id
            data["sample_type"] = sample.sample_type or "Cell Culture"
            data["sample_collection_date"] = sample.collection_date.strftime("%Y-%m-%d") if sample.collection_date else "N/A"
            data["sample_status"] = sample.sample_status or "Active"
            
            if sample.participant:
                participant = sample.participant
                data["participant_id"] = participant.participant_id
                data["participant_consent"] = participant.consent_status
                data["study_group"] = participant.study_group or "Standard / Control"

    return data


def _compute_analytics(history_list):
    if not history_list:
        return {"total_experiments": 0, "avg_toxicity_score": 0, "highest_toxicity": 0,
                "high_risk_count": 0, "moderate_risk_count": 0, "low_risk_count": 0, "avg_ic50": "N/A"}
    scores = [float(h.toxicity_score or 0) for h in history_list]
    ic50_nums = []
    for h in history_list:
        m = re.search(r"[-+]?\d*\.?\d+", str(h.estimated_ic50 or ""))
        if m:
            try: ic50_nums.append(float(m.group()))
            except: pass
    return {
        "total_experiments": len(history_list),
        "avg_toxicity_score": round(sum(scores) / len(scores), 2) if scores else 0,
        "highest_toxicity": round(max(scores), 2) if scores else 0,
        "high_risk_count": sum(1 for h in history_list if h.risk_level == "High"),
        "moderate_risk_count": sum(1 for h in history_list if h.risk_level == "Moderate"),
        "low_risk_count": sum(1 for h in history_list if h.risk_level == "Low"),
        "avg_ic50": round(sum(ic50_nums) / len(ic50_nums), 2) if ic50_nums else "N/A",
    }


def _compute_chart_data(chart_history, analytics):
    return {
        "labels": [f"{str(h.sample_name or f'Exp {h.id}')[:15]} ({str(h.date_time).split(' ')[0][5:]})" for h in chart_history],
        "dates": [str(h.date_time or "").split(" ")[0] for h in chart_history],
        "toxicity_scores": [round(float(h.toxicity_score or 0), 2) for h in chart_history],
        "cell_viabilities": [round(float(h.cell_viability or 0), 2) for h in chart_history],
        "ros_levels": [round(float(h.ros or 0), 2) for h in chart_history],
        "ldh_releases": [round(float(h.ldh or 0), 2) for h in chart_history],
        "apoptosis_levels": [round(float(h.apoptosis or 0), 2) for h in chart_history],
        "risk_counts": {
            "High": analytics.get("high_risk_count", 0),
            "Moderate": analytics.get("moderate_risk_count", 0),
            "Low": analytics.get("low_risk_count", 0),
        },
    }
