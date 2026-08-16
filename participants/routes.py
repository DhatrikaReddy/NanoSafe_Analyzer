"""
participants/routes.py — NanoSafe Analyzer: Study Participants & Biological Samples Routes

Research participant and biological sample tracking for the ZnO Biocompatibility &
Cytotoxicity Study. No PII is stored or processed by the ML model.
All queries are isolated by user_id.
"""

import io
import csv
from datetime import datetime, date
import pandas as pd

from flask import (
    request, render_template, redirect, url_for,
    session, flash, jsonify, Response
)
from . import participants_bp
from auth.decorators import verified_required, current_user_id, current_username
from models import (
    db, StudyParticipant, BiologicalSample, SampleExperimentLink,
    Experiment, ExperimentResult, Report, History, AuditLog,
    ParticipantConsentLog
)


# ============================================================
# HELPER
# ============================================================
def _get_participant_stats(uid):
    """Return dashboard stat dict for the current user."""
    total_participants = StudyParticipant.query.filter_by(user_id=uid).count()
    total_samples = BiologicalSample.query.filter_by(user_id=uid).count()

    # Active experiments = experiments linked to samples belonging to this user
    sample_ids = [s.id for s in BiologicalSample.query.filter_by(user_id=uid)
                  .with_entities(BiologicalSample.id).all()]
    active_links = SampleExperimentLink.query.filter(
        SampleExperimentLink.sample_id.in_(sample_ids)
    ).count() if sample_ids else 0

    completed = History.query.filter_by(user_id=uid).count()

    return {
        "total_participants": total_participants,
        "total_samples": total_samples,
        "active_experiments": active_links,
        "completed_analyses": completed,
    }


# ============================================================
# PARTICIPANTS LIST
# ============================================================
@participants_bp.route("/")
@verified_required
def participants_list():
    uid = current_user_id()

    search = request.args.get("search", "").strip()
    filter_consent = request.args.get("consent_status", "").strip()
    filter_group = request.args.get("study_group", "").strip()
    filter_sex = request.args.get("sex", "").strip()
    sort = request.args.get("sort", "newest")

    query = StudyParticipant.query.filter_by(user_id=uid)

    if search:
        query = query.filter(StudyParticipant.participant_id.ilike(f"%{search}%"))
    if filter_consent:
        query = query.filter_by(consent_status=filter_consent)
    if filter_group:
        query = query.filter(StudyParticipant.study_group.ilike(f"%{filter_group}%"))
    if filter_sex:
        query = query.filter_by(sex=filter_sex)

    if sort == "oldest":
        query = query.order_by(StudyParticipant.created_at.asc())
    else:
        query = query.order_by(StudyParticipant.created_at.desc())

    participants = query.all()
    stats = _get_participant_stats(uid)

    # Sample counts per participant
    sample_counts = {}
    for p in participants:
        sample_counts[p.id] = p.samples.count()

    # Distinct study groups for filter dropdown
    groups = db.session.query(StudyParticipant.study_group).filter_by(
        user_id=uid).filter(StudyParticipant.study_group.isnot(None)).distinct().all()
    study_groups = sorted([g[0] for g in groups if g[0]])

    return render_template(
        "participants/participants_list.html",
        participants=participants,
        sample_counts=sample_counts,
        stats=stats,
        study_groups=study_groups,
        search=search,
        filter_consent=filter_consent,
        filter_group=filter_group,
        filter_sex=filter_sex,
        sort=sort,
    )


# ============================================================
# ============================================================
# CREATE PARTICIPANT
# ============================================================
@participants_bp.route("/new", methods=["GET", "POST"])
@verified_required
def participant_new():
    uid = current_user_id()

    if request.method == "POST":
        pid = request.form.get("participant_id", "").strip()
        name = request.form.get("name", "").strip()
        blood_group = request.form.get("blood_group", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        age_str = request.form.get("age", "").strip()
        sex = request.form.get("sex", "").strip()
        study_group = request.form.get("study_group", "").strip()
        medical_history = request.form.get("medical_history", "").strip()
        consent_status = request.form.get("consent_status", "Pending").strip()
        consent_date_str = request.form.get("consent_date", "").strip()
        research_notes = request.form.get("research_notes", "").strip()

        if not pid:
            flash("Participant ID is required.", "danger")
            return render_template("participants/participant_form.html",
                                   action="new", form_data=request.form)

        # Duplicate check (per user)
        existing = StudyParticipant.query.filter_by(
            user_id=uid, participant_id=pid).first()
        if existing:
            flash(f"Participant ID '{pid}' already exists. Use a unique ID.", "danger")
            return render_template("participants/participant_form.html",
                                   action="new", form_data=request.form)

        age = None
        if age_str:
            try:
                age = int(age_str)
                if age < 0 or age > 150:
                    raise ValueError
            except ValueError:
                flash("Age must be a valid number between 0 and 150.", "danger")
                return render_template("participants/participant_form.html",
                                       action="new", form_data=request.form)

        consent_date = None
        if consent_date_str:
            try:
                consent_date = datetime.strptime(consent_date_str, "%Y-%m-%d").date()
            except ValueError:
                pass
        elif consent_status == "Consented":
            consent_date = date.today()

        participant = StudyParticipant(
            user_id=uid,
            participant_id=pid,
            name=name,
            blood_group=blood_group,
            email=email,
            phone=phone,
            age=age,
            sex=sex or None,
            study_group=study_group or None,
            medical_history=medical_history,
            consent_status=consent_status,
            consent_date=consent_date,
            consent_updated_at=datetime.utcnow(),
            research_notes=research_notes,
        )
        db.session.add(participant)
        db.session.flush()

        # Record Initial Consent Audit Trail Entry
        db.session.add(ParticipantConsentLog(
            participant_fk=participant.id,
            user_id=uid,
            old_status=None,
            new_status=consent_status,
            reason="Initial enrollment & consent registration",
            changed_by=current_username(),
            ip_address=request.remote_addr or "",
        ))

        db.session.add(AuditLog(
            user_id=uid, username=current_username(),
            action="Participant Created",
            details=f"Patient / Participant '{name or pid}' ({pid}) enrolled with status '{consent_status}'",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()
        flash(f"Participant {name or pid} added successfully.", "success")
        return redirect(url_for("participants.participants_list"))

    return render_template("participants/participant_form.html",
                           action="new", form_data={})


# ============================================================
# PARTICIPANT DETAIL
# ============================================================
@participants_bp.route("/<int:participant_pk>")
@verified_required
def participant_detail(participant_pk):
    uid = current_user_id()
    participant = StudyParticipant.query.filter_by(
        id=participant_pk, user_id=uid).first_or_404()

    samples = BiologicalSample.query.filter_by(
        participant_fk=participant_pk, user_id=uid).order_by(
        BiologicalSample.created_at.desc()).all()

    consent_logs = participant.consent_logs.all()

    # Build the full chain: Sample → linked Experiments → Results → Reports
    chain_data = []
    for sample in samples:
        links = SampleExperimentLink.query.filter_by(sample_id=sample.id).all()
        exp_entries = []
        for link in links:
            exp = Experiment.query.get(link.experiment_id)
            if not exp or exp.user_id != uid:
                continue
            result = ExperimentResult.query.filter_by(experiment_id=exp.id).first()
            report = Report.query.filter_by(experiment_id=exp.id).first()
            history = History.query.filter_by(experiment_id=exp.id).first()
            exp_entries.append({
                "experiment": exp,
                "result": result,
                "report": report,
                "history": history,
                "linked_at": link.linked_at,
            })
        chain_data.append({
            "sample": sample,
            "experiments": exp_entries,
        })

    # Compute Chart Analytics for Linked Experiments & Samples
    exp_names = []
    viability_scores = []
    ros_scores = []
    ldh_scores = []
    apoptosis_scores = []
    toxicity_scores = []
    risk_colors = []

    for entry in chain_data:
        for exp_entry in entry["experiments"]:
            res = exp_entry["result"]
            exp = exp_entry["experiment"]
            if res:
                label = f"{exp.sample_name or 'Exp'} (#{exp.id})"
                exp_names.append(label)
                viability_scores.append(float(res.cell_viability or 0))
                ros_scores.append(float(res.ros or 0))
                ldh_scores.append(float(res.ldh or 0))
                apoptosis_scores.append(float(res.apoptosis or 0))
                tox_score = float(res.toxicity_score or 0)
                toxicity_scores.append(tox_score)
                if tox_score < 25:
                    risk_colors.append("#16a34a")
                elif tox_score < 55:
                    risk_colors.append("#f59e0b")
                else:
                    risk_colors.append("#dc2626")

    sample_status_dist = {}
    sample_type_dist = {}
    for s in samples:
        st = s.sample_status or "Active"
        sample_status_dist[st] = sample_status_dist.get(st, 0) + 1
        tp = s.sample_type or "Unspecified"
        sample_type_dist[tp] = sample_type_dist.get(tp, 0) + 1

    chart_data = {
        "exp_labels": exp_names,
        "viability": viability_scores,
        "ros": ros_scores,
        "ldh": ldh_scores,
        "apoptosis": apoptosis_scores,
        "toxicity_scores": toxicity_scores,
        "risk_colors": risk_colors,
        "sample_status": sample_status_dist,
        "sample_types": sample_type_dist,
        "has_experiment_data": len(exp_names) > 0,
    }

    return render_template(
        "participants/participant_detail.html",
        participant=participant,
        samples=samples,
        chain_data=chain_data,
        consent_logs=consent_logs,
        chart_data=chart_data,
    )


# ============================================================
# EDIT PARTICIPANT
# ============================================================
@participants_bp.route("/<int:participant_pk>/edit", methods=["GET", "POST"])
@verified_required
def participant_edit(participant_pk):
    uid = current_user_id()
    participant = StudyParticipant.query.filter_by(
        id=participant_pk, user_id=uid).first_or_404()

    if request.method == "POST":
        pid = request.form.get("participant_id", "").strip()
        name = request.form.get("name", "").strip()
        blood_group = request.form.get("blood_group", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        age_str = request.form.get("age", "").strip()
        sex = request.form.get("sex", "").strip()
        study_group = request.form.get("study_group", "").strip()
        medical_history = request.form.get("medical_history", "").strip()
        consent_status = request.form.get("consent_status", "Pending").strip()
        consent_date_str = request.form.get("consent_date", "").strip()
        consent_reason = request.form.get("consent_reason", "").strip()
        research_notes = request.form.get("research_notes", "").strip()

        if not pid:
            flash("Participant ID is required.", "danger")
            return render_template("participants/participant_form.html",
                                   action="edit", participant=participant,
                                   form_data=request.form)

        # Duplicate check (exclude self)
        conflict = StudyParticipant.query.filter(
            StudyParticipant.user_id == uid,
            StudyParticipant.participant_id == pid,
            StudyParticipant.id != participant_pk,
        ).first()
        if conflict:
            flash(f"Participant ID '{pid}' is already used by another entry.", "danger")
            return render_template("participants/participant_form.html",
                                   action="edit", participant=participant,
                                   form_data=request.form)

        age = None
        if age_str:
            try:
                age = int(age_str)
                if age < 0 or age > 150:
                    raise ValueError
            except ValueError:
                flash("Age must be a valid number between 0 and 150.", "danger")
                return render_template("participants/participant_form.html",
                                       action="edit", participant=participant,
                                       form_data=request.form)

        consent_date = participant.consent_date
        if consent_date_str:
            try:
                consent_date = datetime.strptime(consent_date_str, "%Y-%m-%d").date()
            except ValueError:
                pass
        elif consent_status == "Consented" and not consent_date:
            consent_date = date.today()

        # Audit consent status changes
        old_consent_status = participant.consent_status
        if old_consent_status != consent_status or consent_reason:
            log_reason = consent_reason or f"Consent updated: {old_consent_status} → {consent_status}"
            db.session.add(ParticipantConsentLog(
                participant_fk=participant.id,
                user_id=uid,
                old_status=old_consent_status,
                new_status=consent_status,
                reason=log_reason,
                changed_by=current_username(),
                ip_address=request.remote_addr or "",
            ))
            participant.consent_updated_at = datetime.utcnow()

            db.session.add(AuditLog(
                user_id=uid, username=current_username(),
                action="Consent Status Changed",
                details=f"Participant '{pid}' consent: {old_consent_status} -> {consent_status}. Reason: {log_reason}",
                ip_address=request.remote_addr or "",
            ))

        participant.participant_id = pid
        participant.name = name
        participant.blood_group = blood_group
        participant.email = email
        participant.phone = phone
        participant.age = age
        participant.sex = sex or None
        participant.study_group = study_group or None
        participant.medical_history = medical_history
        participant.consent_status = consent_status
        if consent_status == "Withdrawn":
            from models import BiologicalSample, SampleExperimentLink
            samples = BiologicalSample.query.filter_by(participant_fk=participant.id).all()
            for s in samples:
                s.sample_status = "Archived"
                if "Consent Withdrawn" not in (s.notes or ""):
                    s.notes = (s.notes or "") + " [Consent Withdrawn]"
                
                links = SampleExperimentLink.query.filter_by(sample_id=s.id).all()
                for link in links:
                    exp = link.experiment
                    if exp:
                        if "Consent Withdrawn" not in (exp.sample_name or ""):
                            exp.sample_name += " [Consent Withdrawn]"
                        if exp.result:
                            if "consent withdrawn" not in (exp.result.interpretation or "").lower():
                                exp.result.interpretation = (exp.result.interpretation or "") + " [Warning: Participant consent withdrawn for this sample]"
                        if exp.history:
                            if "Consent Withdrawn" not in (exp.history.sample_name or ""):
                                exp.history.sample_name += " [Consent Withdrawn]"
                            if "consent withdrawn" not in (exp.history.interpretation or "").lower():
                                exp.history.interpretation = (exp.history.interpretation or "") + " [Warning: Participant consent withdrawn for this sample]"

        participant.consent_date = consent_date
        participant.research_notes = research_notes

        db.session.add(AuditLog(
            user_id=uid, username=current_username(),
            action="Participant Updated",
            details=f"Patient / Participant '{name or pid}' ({pid}) details updated",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()
        flash(f"Participant {name or pid} updated successfully.", "success")
        return redirect(url_for("participants.participant_detail", participant_pk=participant_pk))

    return render_template("participants/participant_form.html",
                           action="edit", participant=participant,
                           form_data={})


# ============================================================
# DELETE PARTICIPANT
# ============================================================
@participants_bp.route("/<int:participant_pk>/delete", methods=["POST"])
@verified_required
def participant_delete(participant_pk):
    uid = current_user_id()
    participant = StudyParticipant.query.filter_by(
        id=participant_pk, user_id=uid).first_or_404()

    pid = participant.participant_id
    db.session.delete(participant)
    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Participant Deleted",
        details=f"Study participant '{pid}' deleted",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()
    flash(f"Participant {pid} and all associated samples have been deleted.", "info")
    return redirect(url_for("participants.participants_list"))


# ============================================================
# SAMPLES LIST
# ============================================================
@participants_bp.route("/samples")
@verified_required
def samples_list():
    uid = current_user_id()

    search = request.args.get("search", "").strip()
    filter_participant = request.args.get("participant_id", "").strip()
    filter_type = request.args.get("sample_type", "").strip()
    filter_status = request.args.get("sample_status", "").strip()
    sort = request.args.get("sort", "newest")

    query = BiologicalSample.query.filter_by(user_id=uid)

    if search:
        query = query.filter(BiologicalSample.sample_id.ilike(f"%{search}%"))
    if filter_status:
        query = query.filter_by(sample_status=filter_status)
    if filter_type:
        query = query.filter(BiologicalSample.sample_type.ilike(f"%{filter_type}%"))
    if filter_participant:
        # Filter by participant_id string via join
        participant = StudyParticipant.query.filter_by(
            user_id=uid, participant_id=filter_participant).first()
        if participant:
            query = query.filter_by(participant_fk=participant.id)
        else:
            query = query.filter(False)  # No match

    if sort == "oldest":
        query = query.order_by(BiologicalSample.created_at.asc())
    else:
        query = query.order_by(BiologicalSample.created_at.desc())

    samples = query.all()

    # Participant lookup map for display
    all_participants = StudyParticipant.query.filter_by(user_id=uid).all()
    participant_map = {p.id: p for p in all_participants}

    # Linked experiment count per sample
    link_counts = {}
    for s in samples:
        link_counts[s.id] = s.experiment_links.count()

    stats = _get_participant_stats(uid)

    return render_template(
        "participants/samples_list.html",
        samples=samples,
        participant_map=participant_map,
        link_counts=link_counts,
        all_participants=all_participants,
        stats=stats,
        search=search,
        filter_participant=filter_participant,
        filter_type=filter_type,
        filter_status=filter_status,
        sort=sort,
    )


# ============================================================
# CREATE SAMPLE
# ============================================================
@participants_bp.route("/samples/new", methods=["GET", "POST"])
@verified_required
def sample_new():
    uid = current_user_id()
    # Only show consented participants
    consented_participants = StudyParticipant.query.filter_by(
        user_id=uid, consent_status="Consented").order_by(
        StudyParticipant.participant_id).all()
    user_experiments = Experiment.query.filter_by(user_id=uid).order_by(
        Experiment.created_at.desc()).all()

    if request.method == "POST":
        sid = request.form.get("sample_id", "").strip()
        participant_fk_str = request.form.get("participant_fk", "").strip()
        sample_type = request.form.get("sample_type", "").strip()
        cell_type = request.form.get("cell_type", "").strip()
        collection_date_str = request.form.get("collection_date", "").strip()
        sample_status = request.form.get("sample_status", "Active").strip()
        notes = request.form.get("notes", "").strip()
        linked_exp_ids = request.form.getlist("linked_experiments")

        if not sid:
            flash("Sample ID is required.", "danger")
            return render_template("participants/sample_form.html",
                                   action="new", form_data=request.form,
                                   consented_participants=consented_participants,
                                   user_experiments=user_experiments)

        # Duplicate check
        existing = BiologicalSample.query.filter_by(
            user_id=uid, sample_id=sid).first()
        if existing:
            flash(f"Sample ID '{sid}' already exists. Use a unique ID.", "danger")
            return render_template("participants/sample_form.html",
                                   action="new", form_data=request.form,
                                   consented_participants=consented_participants,
                                   user_experiments=user_experiments)

        participant_fk = None
        if participant_fk_str:
            try:
                participant_fk = int(participant_fk_str)
                # Validate participant belongs to user and has consent
                pt = StudyParticipant.query.filter_by(
                    id=participant_fk, user_id=uid).first()
                if not pt:
                    flash("Selected participant not found.", "danger")
                    return render_template("participants/sample_form.html",
                                           action="new", form_data=request.form,
                                           consented_participants=consented_participants,
                                           user_experiments=user_experiments)
                if pt.consent_status != "Consented":
                    flash("Cannot associate a sample with a participant who has not consented.", "danger")
                    return render_template("participants/sample_form.html",
                                           action="new", form_data=request.form,
                                           consented_participants=consented_participants,
                                           user_experiments=user_experiments)
            except ValueError:
                participant_fk = None

        collection_date = None
        if collection_date_str:
            try:
                collection_date = datetime.strptime(collection_date_str, "%Y-%m-%d").date()
            except ValueError:
                flash("Invalid collection date format.", "danger")
                return render_template("participants/sample_form.html",
                                       action="new", form_data=request.form,
                                       consented_participants=consented_participants,
                                       user_experiments=user_experiments)

        sample = BiologicalSample(
            user_id=uid,
            sample_id=sid,
            participant_fk=participant_fk,
            sample_type=sample_type,
            cell_type=cell_type,
            collection_date=collection_date,
            sample_status=sample_status,
            notes=notes,
        )
        db.session.add(sample)
        db.session.flush()  # get sample.id

        # Link experiments
        for exp_id_str in linked_exp_ids:
            try:
                exp_id = int(exp_id_str)
                exp = Experiment.query.filter_by(id=exp_id, user_id=uid).first()
                if exp:
                    link = SampleExperimentLink(
                        sample_id=sample.id,
                        experiment_id=exp_id,
                    )
                    db.session.add(link)
            except (ValueError, TypeError):
                pass

        db.session.add(AuditLog(
            user_id=uid, username=current_username(),
            action="Sample Created",
            details=f"Biological sample '{sid}' created",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()
        flash(f"Sample {sid} created successfully.", "success")
        return redirect(url_for("participants.samples_list"))

    return render_template("participants/sample_form.html",
                           action="new", form_data={},
                           consented_participants=consented_participants,
                           user_experiments=user_experiments)


# ============================================================
# EDIT SAMPLE
# ============================================================
@participants_bp.route("/samples/<int:sample_pk>/edit", methods=["GET", "POST"])
@verified_required
def sample_edit(sample_pk):
    uid = current_user_id()
    sample = BiologicalSample.query.filter_by(
        id=sample_pk, user_id=uid).first_or_404()

    consented_participants = StudyParticipant.query.filter_by(
        user_id=uid, consent_status="Consented").order_by(
        StudyParticipant.participant_id).all()
    user_experiments = Experiment.query.filter_by(user_id=uid).order_by(
        Experiment.created_at.desc()).all()
    linked_exp_ids = [str(lnk.experiment_id) for lnk in sample.experiment_links.all()]

    if request.method == "POST":
        sid = request.form.get("sample_id", "").strip()
        participant_fk_str = request.form.get("participant_fk", "").strip()
        sample_type = request.form.get("sample_type", "").strip()
        cell_type = request.form.get("cell_type", "").strip()
        collection_date_str = request.form.get("collection_date", "").strip()
        sample_status = request.form.get("sample_status", "Active").strip()
        notes = request.form.get("notes", "").strip()
        new_linked_exp_ids = request.form.getlist("linked_experiments")

        if not sid:
            flash("Sample ID is required.", "danger")
            return render_template("participants/sample_form.html",
                                   action="edit", sample=sample, form_data=request.form,
                                   consented_participants=consented_participants,
                                   user_experiments=user_experiments,
                                   linked_exp_ids=linked_exp_ids)

        # Duplicate check (exclude self)
        conflict = BiologicalSample.query.filter(
            BiologicalSample.user_id == uid,
            BiologicalSample.sample_id == sid,
            BiologicalSample.id != sample_pk,
        ).first()
        if conflict:
            flash(f"Sample ID '{sid}' is already used by another sample.", "danger")
            return render_template("participants/sample_form.html",
                                   action="edit", sample=sample, form_data=request.form,
                                   consented_participants=consented_participants,
                                   user_experiments=user_experiments,
                                   linked_exp_ids=linked_exp_ids)

        participant_fk = None
        if participant_fk_str:
            try:
                participant_fk = int(participant_fk_str)
                pt = StudyParticipant.query.filter_by(
                    id=participant_fk, user_id=uid).first()
                if pt and pt.consent_status != "Consented":
                    flash("Cannot associate with a non-consented participant.", "danger")
                    return render_template("participants/sample_form.html",
                                           action="edit", sample=sample, form_data=request.form,
                                           consented_participants=consented_participants,
                                           user_experiments=user_experiments,
                                           linked_exp_ids=linked_exp_ids)
            except ValueError:
                participant_fk = None

        collection_date = None
        if collection_date_str:
            try:
                collection_date = datetime.strptime(collection_date_str, "%Y-%m-%d").date()
            except ValueError:
                flash("Invalid collection date format.", "danger")
                return render_template("participants/sample_form.html",
                                       action="edit", sample=sample, form_data=request.form,
                                       consented_participants=consented_participants,
                                       user_experiments=user_experiments,
                                       linked_exp_ids=linked_exp_ids)

        sample.sample_id = sid
        sample.participant_fk = participant_fk
        sample.sample_type = sample_type
        sample.cell_type = cell_type
        sample.collection_date = collection_date
        sample.sample_status = sample_status
        sample.notes = notes

        # Update experiment links: delete old, add new
        SampleExperimentLink.query.filter_by(sample_id=sample_pk).delete()
        for exp_id_str in new_linked_exp_ids:
            try:
                exp_id = int(exp_id_str)
                exp = Experiment.query.filter_by(id=exp_id, user_id=uid).first()
                if exp:
                    db.session.add(SampleExperimentLink(
                        sample_id=sample_pk,
                        experiment_id=exp_id,
                    ))
            except (ValueError, TypeError):
                pass

        db.session.add(AuditLog(
            user_id=uid, username=current_username(),
            action="Sample Updated",
            details=f"Biological sample '{sid}' updated",
            ip_address=request.remote_addr or "",
        ))
        db.session.commit()
        flash(f"Sample {sid} updated successfully.", "success")
        return redirect(url_for("participants.samples_list"))

    return render_template("participants/sample_form.html",
                           action="edit", sample=sample, form_data={},
                           consented_participants=consented_participants,
                           user_experiments=user_experiments,
                           linked_exp_ids=linked_exp_ids)


# ============================================================
# DELETE SAMPLE
# ============================================================
@participants_bp.route("/samples/<int:sample_pk>/delete", methods=["POST"])
@verified_required
def sample_delete(sample_pk):
    uid = current_user_id()
    sample = BiologicalSample.query.filter_by(
        id=sample_pk, user_id=uid).first_or_404()

    sid = sample.sample_id
    db.session.delete(sample)
    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Sample Deleted",
        details=f"Biological sample '{sid}' deleted",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()
    flash(f"Sample {sid} and its experiment links have been removed.", "info")
    return redirect(url_for("participants.samples_list"))


# ============================================================
# API: PARTICIPANT STATS (for dashboard card AJAX)
# ============================================================
@participants_bp.route("/api/stats")
@verified_required
def api_stats():
    uid = current_user_id()
    return jsonify(_get_participant_stats(uid))


# ============================================================
# EXPORT PARTICIPANTS CSV
# ============================================================
@participants_bp.route("/export/csv")
@verified_required
def export_participants_csv():
    uid = current_user_id()

    search = request.args.get("search", "").strip()
    filter_consent = request.args.get("consent_status", "").strip()
    filter_group = request.args.get("study_group", "").strip()
    filter_sex = request.args.get("sex", "").strip()
    sort = request.args.get("sort", "newest")

    query = StudyParticipant.query.filter_by(user_id=uid)

    if search:
        query = query.filter(StudyParticipant.participant_id.ilike(f"%{search}%"))
    if filter_consent:
        query = query.filter_by(consent_status=filter_consent)
    if filter_group:
        query = query.filter(StudyParticipant.study_group.ilike(f"%{filter_group}%"))
    if filter_sex:
        query = query.filter_by(sex=filter_sex)

    if sort == "oldest":
        query = query.order_by(StudyParticipant.created_at.asc())
    else:
        query = query.order_by(StudyParticipant.created_at.desc())

    participants = query.all()

    rows = []
    for p in participants:
        rows.append({
            "Participant_ID": p.participant_id,
            "Age": p.age if p.age is not None else "",
            "Sex": p.sex or "",
            "Study_Group": p.study_group or "",
            "Consent_Status": p.consent_status,
            "Total_Samples": p.samples.count(),
            "Research_Notes": (p.research_notes or "").replace("\r\n", " ").replace("\n", " "),
            "Created_At": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else "",
        })

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=[
        "Participant_ID", "Age", "Sex", "Study_Group", "Consent_Status",
        "Total_Samples", "Research_Notes", "Created_At"
    ])

    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_data = csv_buffer.getvalue()

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Data Exported",
        details=f"Exported {len(rows)} study participants as CSV",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    filename = f"NanoSafe_Study_Participants_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================
# EXPORT BIOLOGICAL SAMPLES CSV
# ============================================================
@participants_bp.route("/samples/export/csv")
@verified_required
def export_samples_csv():
    uid = current_user_id()

    search = request.args.get("search", "").strip()
    filter_participant = request.args.get("participant_id", "").strip()
    filter_type = request.args.get("sample_type", "").strip()
    filter_status = request.args.get("sample_status", "").strip()
    sort = request.args.get("sort", "newest")

    query = BiologicalSample.query.filter_by(user_id=uid)

    if search:
        query = query.filter(BiologicalSample.sample_id.ilike(f"%{search}%"))
    if filter_status:
        query = query.filter_by(sample_status=filter_status)
    if filter_type:
        query = query.filter(BiologicalSample.sample_type.ilike(f"%{filter_type}%"))
    if filter_participant:
        participant = StudyParticipant.query.filter_by(
            user_id=uid, participant_id=filter_participant).first()
        if participant:
            query = query.filter_by(participant_fk=participant.id)
        else:
            query = query.filter(False)

    if sort == "oldest":
        query = query.order_by(BiologicalSample.created_at.asc())
    else:
        query = query.order_by(BiologicalSample.created_at.desc())

    samples = query.all()

    rows = []
    for s in samples:
        participant_id_str = s.participant.participant_id if s.participant else ""
        participant_consent_str = s.participant.consent_status if s.participant else ""

        # Collect linked experiment names
        exp_links = s.experiment_links.all()
        linked_exp_names = []
        for lnk in exp_links:
            if lnk.experiment:
                linked_exp_names.append(f"#{lnk.experiment_id} {lnk.experiment.sample_name}")

        rows.append({
            "Sample_ID": s.sample_id,
            "Participant_ID": participant_id_str,
            "Participant_Consent": participant_consent_str,
            "Sample_Type": s.sample_type or "",
            "Cell_Type": s.cell_type or "",
            "Collection_Date": s.collection_date.strftime("%Y-%m-%d") if s.collection_date else "",
            "Sample_Status": s.sample_status or "Active",
            "Linked_Experiments_Count": len(exp_links),
            "Linked_Experiments": "; ".join(linked_exp_names),
            "Notes": (s.notes or "").replace("\r\n", " ").replace("\n", " "),
            "Created_At": s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else "",
        })

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=[
        "Sample_ID", "Participant_ID", "Participant_Consent", "Sample_Type", "Cell_Type",
        "Collection_Date", "Sample_Status", "Linked_Experiments_Count",
        "Linked_Experiments", "Notes", "Created_At"
    ])

    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_data = csv_buffer.getvalue()

    db.session.add(AuditLog(
        user_id=uid, username=current_username(),
        action="Data Exported",
        details=f"Exported {len(rows)} biological samples as CSV",
        ip_address=request.remote_addr or "",
    ))
    db.session.commit()

    filename = f"NanoSafe_Biological_Samples_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================
# DOWNLOAD SAMPLE IMPORT CSV TEMPLATE
# ============================================================
@participants_bp.route("/samples/import/template")
@verified_required
def sample_import_template():
    template_rows = [
        {
            "Sample_ID": "S-001",
            "Participant_ID": "P-001",
            "Sample_Type": "Cell Culture",
            "Cell_Type": "HeLa",
            "Collection_Date": "2024-03-15",
            "Sample_Status": "Active",
            "Notes": "Passage 4 fresh isolate for ZnO cytotoxicity assay"
        },
        {
            "Sample_ID": "S-002",
            "Participant_ID": "P-002",
            "Sample_Type": "Primary Cell Culture",
            "Cell_Type": "MCF-7",
            "Collection_Date": "2024-03-16",
            "Sample_Status": "Active",
            "Notes": "Cryopreserved vial recovered"
        },
        {
            "Sample_ID": "S-003",
            "Participant_ID": "",
            "Sample_Type": "Blood",
            "Cell_Type": "Primary cells",
            "Collection_Date": "2024-03-18",
            "Sample_Status": "Processing",
            "Notes": "Unassigned control baseline"
        }
    ]

    df = pd.DataFrame(template_rows)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_data = csv_buffer.getvalue()

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=NanoSafe_Sample_Import_Template.csv"}
    )


# ============================================================
# BULK SAMPLE IMPORT (CSV / EXCEL)
# ============================================================
@participants_bp.route("/samples/bulk-import", methods=["GET", "POST"])
@verified_required
def sample_bulk_import():
    uid = current_user_id()
    consented_participants = StudyParticipant.query.filter_by(
        user_id=uid, consent_status="Consented").order_by(
        StudyParticipant.participant_id).all()

    if request.method == "POST":
        file = request.files.get("file")
        csv_text = request.form.get("csv_text", "").strip()

        df = None
        if file and file.filename:
            fname = file.filename.lower()
            try:
                if fname.endswith(".csv"):
                    df = pd.read_csv(file)
                elif fname.endswith((".xlsx", ".xls")):
                    df = pd.read_excel(file)
                else:
                    flash("Unsupported file format. Please upload a .csv or .xlsx file.", "danger")
                    return render_template("participants/bulk_import.html",
                                           consented_participants=consented_participants)
            except Exception as e:
                flash(f"Error reading file: {str(e)}", "danger")
                return render_template("participants/bulk_import.html",
                                       consented_participants=consented_participants)
        elif csv_text:
            try:
                df = pd.read_csv(io.StringIO(csv_text))
            except Exception as e:
                flash(f"Error parsing pasted CSV text: {str(e)}", "danger")
                return render_template("participants/bulk_import.html",
                                       consented_participants=consented_participants)
        else:
            flash("Please choose a CSV/Excel file or paste CSV text to import.", "warning")
            return render_template("participants/bulk_import.html",
                                   consented_participants=consented_participants)

        if df is None or df.empty:
            flash("The uploaded file contains no rows.", "warning")
            return render_template("participants/bulk_import.html",
                                   consented_participants=consented_participants)

        # Normalize column headers
        col_map = {}
        for col in df.columns:
            clean_col = str(col).strip().lower().replace(" ", "_")
            if clean_col in ["sample_id", "sampleid", "sample"]:
                col_map[col] = "Sample_ID"
            elif clean_col in ["participant_id", "participantid", "participant"]:
                col_map[col] = "Participant_ID"
            elif clean_col in ["sample_type", "type"]:
                col_map[col] = "Sample_Type"
            elif clean_col in ["cell_type", "cell_line", "cellline"]:
                col_map[col] = "Cell_Type"
            elif clean_col in ["collection_date", "date"]:
                col_map[col] = "Collection_Date"
            elif clean_col in ["sample_status", "status"]:
                col_map[col] = "Sample_Status"
            elif clean_col in ["notes", "research_notes", "note"]:
                col_map[col] = "Notes"
        
        df = df.rename(columns=col_map)

        if "Sample_ID" not in df.columns:
            flash("Missing required column 'Sample_ID' in the uploaded file.", "danger")
            return render_template("participants/bulk_import.html",
                                   consented_participants=consented_participants)

        # Cache existing participant lookup and sample IDs for fast check
        user_participants = {p.participant_id.strip().upper(): p for p in StudyParticipant.query.filter_by(user_id=uid).all()}
        existing_sample_ids = set(s[0].strip().upper() for s in db.session.query(BiologicalSample.sample_id).filter_by(user_id=uid).all())

        imported_samples = []
        errors = []
        seen_in_batch = set()

        for idx, row in df.iterrows():
            row_num = idx + 2  # 1-indexed header + 1
            raw_sid = str(row.get("Sample_ID", "")).strip()

            if not raw_sid or raw_sid.lower() == "nan":
                errors.append(f"Row {row_num}: Missing Sample ID — skipped.")
                continue

            sid_upper = raw_sid.upper()
            if sid_upper in existing_sample_ids or sid_upper in seen_in_batch:
                errors.append(f"Row {row_num}: Sample ID '{raw_sid}' already exists — skipped.")
                continue

            seen_in_batch.add(sid_upper)

            # Check participant & consent
            participant_fk = None
            raw_pid = str(row.get("Participant_ID", "")).strip()
            if raw_pid and raw_pid.lower() != "nan":
                pt = user_participants.get(raw_pid.upper())
                if not pt:
                    errors.append(f"Row {row_num} ({raw_sid}): Participant ID '{raw_pid}' not found — sample imported as unassigned.")
                elif pt.consent_status != "Consented":
                    errors.append(f"Row {row_num} ({raw_sid}): Participant '{raw_pid}' has consent status '{pt.consent_status}' (not Consented) — sample imported as unassigned.")
                else:
                    participant_fk = pt.id

            # Parse collection date
            collection_date = None
            raw_date = str(row.get("Collection_Date", "")).strip()
            if raw_date and raw_date.lower() != "nan":
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
                    try:
                        collection_date = datetime.strptime(raw_date.split()[0], fmt).date()
                        break
                    except ValueError:
                        pass

            sample_type = str(row.get("Sample_Type", "")).strip()
            if sample_type.lower() == "nan":
                sample_type = ""

            cell_type = str(row.get("Cell_Type", "")).strip()
            if cell_type.lower() == "nan":
                cell_type = ""

            sample_status = str(row.get("Sample_Status", "Active")).strip()
            if sample_status.lower() == "nan" or not sample_status:
                sample_status = "Active"

            notes = str(row.get("Notes", "")).strip()
            if notes.lower() == "nan":
                notes = ""

            sample = BiologicalSample(
                user_id=uid,
                sample_id=raw_sid,
                participant_fk=participant_fk,
                sample_type=sample_type,
                cell_type=cell_type,
                collection_date=collection_date,
                sample_status=sample_status,
                notes=notes,
            )
            imported_samples.append(sample)

        if imported_samples:
            db.session.add_all(imported_samples)
            db.session.add(AuditLog(
                user_id=uid, username=current_username(),
                action="Bulk Samples Imported",
                details=f"Successfully imported {len(imported_samples)} biological samples via bulk upload",
                ip_address=request.remote_addr or "",
            ))
            db.session.commit()

            msg = f"✅ Successfully imported {len(imported_samples)} biological sample{'s' if len(imported_samples) != 1 else ''}!"
            if errors:
                msg += f" (Note: {len(errors)} notice{'s' if len(errors) != 1 else ''}: {'; '.join(errors[:3])}{'...' if len(errors) > 3 else ''})"
            flash(msg, "success")
            return redirect(url_for("participants.samples_list"))
        else:
            flash(f"No samples could be imported. Errors: {'; '.join(errors[:5])}", "danger")
            return render_template("participants/bulk_import.html",
                                   consented_participants=consented_participants,
                                   errors=errors)

    return render_template("participants/bulk_import.html",
                           consented_participants=consented_participants)


