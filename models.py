"""
models.py — NanoSafe Analyzer: SQLAlchemy ORM Models
Normalized, production-ready database schema.
Designed to work with SQLite (dev) and PostgreSQL (production) via DATABASE_URL.
"""

from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


# ============================================================
# ROLES TABLE
# ============================================================
class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)  # 'admin', 'user'
    description = db.Column(db.String(200), default="")

    users = db.relationship("User", back_populates="role_obj", lazy="dynamic")

    def __init__(self, name=None, description="", **kwargs):
        super().__init__(**kwargs)
        if name is not None:
            self.name = name
        self.description = description

    def __repr__(self):
        return f"<Role {self.name}>"


# ============================================================
# USERS TABLE
# ============================================================
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    firebase_uid = db.Column(db.String(128), unique=True, nullable=True, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(254), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(256), nullable=False)

    # Role relationship
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False, default=1)
    role_obj = db.relationship("Role", back_populates="users")

    # Account status
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_profile_completed = db.Column(db.Boolean, default=False, nullable=True)

    # Profile
    full_name = db.Column(db.String(120), default="")
    institution = db.Column(db.String(200), default="")
    department = db.Column(db.String(200), default="")
    research_role = db.Column(db.String(100), default="")  # e.g. PhD Student, PI
    research_field = db.Column(db.String(150), default="") # e.g. Nanomedicine, Toxicology

    # Personal Information & Contact
    title_salutation = db.Column(db.String(20), default="")
    gender_pronouns = db.Column(db.String(50), default="")
    date_of_birth = db.Column(db.String(50), default="")
    secondary_email = db.Column(db.String(120), default="")
    office_address = db.Column(db.String(255), default="")
    city_state = db.Column(db.String(100), default="")
    country = db.Column(db.String(100), default="")
    preferred_language = db.Column(db.String(50), default="")
    bio = db.Column(db.Text, default="")

    # Research Preferences
    default_cell_line = db.Column(db.String(80), default="HeLa")
    default_exposure_time = db.Column(db.String(50), default="24h")
    preferred_report_format = db.Column(db.String(20), default="pdf")
    dark_mode = db.Column(db.Boolean, default=False)

    # Notification Preferences
    notify_analysis_completed = db.Column(db.Boolean, default=True)
    notify_report_generated = db.Column(db.Boolean, default=True)
    notify_security_alerts = db.Column(db.Boolean, default=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    remember_token = db.Column(db.String(128), nullable=True, unique=True)    # Relationships
    experiments = db.relationship("Experiment", back_populates="owner", lazy="dynamic",
                                  cascade="all, delete-orphan")
    login_logs = db.relationship("LoginLog", back_populates="user", lazy="dynamic",
                                 cascade="all, delete-orphan")

    @property
    def role(self):
        return self.role_obj.name if self.role_obj else "user"

    @property
    def is_admin(self):
        return self.role == "admin"

    def __init__(self, username=None, email=None, password_hash=None, role_id=1,
                 is_verified=False, is_active=True, is_profile_completed=False, full_name="", firebase_uid=None,
                 created_at=None, institution="", department="", research_role="", research_field="",
                 default_cell_line="HeLa", default_exposure_time="24h",
                 preferred_report_format="pdf", dark_mode=False,
                 notify_analysis_completed=True, notify_report_generated=True, notify_security_alerts=True):
        if username is not None:
            self.username = username
        if email is not None:
            self.email = email
        if password_hash is not None:
            self.password_hash = password_hash
        self.role_id = role_id
        self.is_verified = is_verified
        self.is_active = is_active
        self.is_profile_completed = is_profile_completed
        self.full_name = full_name
        self.institution = institution
        self.department = department
        self.research_role = research_role
        self.research_field = research_field
        self.default_cell_line = default_cell_line
        self.default_exposure_time = default_exposure_time
        self.preferred_report_format = preferred_report_format
        self.dark_mode = dark_mode
        self.notify_analysis_completed = notify_analysis_completed
        self.notify_report_generated = notify_report_generated
        self.notify_security_alerts = notify_security_alerts
        if firebase_uid is not None:
            self.firebase_uid = firebase_uid
        if created_at is not None:
            self.created_at = created_at

    def __repr__(self):
        return f"<User {self.username} [{self.role}]>"


# ============================================================
# OTP VERIFICATION TABLE
# ============================================================
class EmailVerificationToken(db.Model):
    __tablename__ = "email_verification_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    otp_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)

    user = db.relationship("User", backref=db.backref("verification_tokens", lazy="dynamic", cascade="all, delete-orphan"))

    def __init__(self, user_id: int, otp_hash: str, expires_at, attempts=0):
        self.user_id = user_id
        self.otp_hash = otp_hash
        self.expires_at = expires_at
        self.attempts = attempts

    def __repr__(self):
        return f"<EmailVerificationToken user={self.user_id}>"


# ============================================================
# PASSWORD RESET TABLE
# ============================================================
class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token = db.Column(db.String(128), unique=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy="dynamic", cascade="all, delete-orphan"))

    def __init__(self, user_id: int, token: str, expires_at):
        self.user_id = user_id
        self.token = token
        self.expires_at = expires_at

    def __repr__(self):
        return f"<PasswordResetToken user={self.user_id}>"

# ============================================================
# EXPERIMENTS TABLE
# ============================================================
class Experiment(db.Model):
    __tablename__ = "experiments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    exp_uuid = db.Column(db.String(64), unique=True, nullable=False)

    # Metadata
    sample_name = db.Column(db.String(200), default="Untitled Sample")
    researcher_name = db.Column(db.String(120), default="")
    nanoparticle_type = db.Column(db.String(50), default="ZnO")
    cell_line = db.Column(db.String(100), default="")
    exposure_time = db.Column(db.String(50), default="")
    synthesis_method = db.Column(db.String(80), default="Green_Synthesis")
    surface_coating = db.Column(db.String(80), default="Bare_ZnO")
    hemolysis_rate = db.Column(db.Float, default=0.0)
    hemocompatibility_status = db.Column(db.String(50), default="Non-Hemolytic (<2%)")
    selectivity_index = db.Column(db.Float, default=1.0)
    comet_tail_moment = db.Column(db.Float, default=1.0)
    csv_filename = db.Column(db.String(200), default="Manual Entry")

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    owner = db.relationship("User", back_populates="experiments")
    result = db.relationship("ExperimentResult", back_populates="experiment",
                             uselist=False, cascade="all, delete-orphan")
    report = db.relationship("Report", back_populates="experiment",
                             uselist=False, cascade="all, delete-orphan")
    history = db.relationship("History", back_populates="experiment",
                              uselist=False, cascade="all, delete-orphan")

    def __init__(self, user_id=None, exp_uuid=None, sample_name="Untitled Sample",
                 researcher_name="", nanoparticle_type="ZnO", cell_line="",
                 exposure_time="", synthesis_method="Green_Synthesis", surface_coating="Bare_ZnO",
                 hemolysis_rate=0.0, hemocompatibility_status="Non-Hemolytic (<2%)",
                 selectivity_index=1.0, comet_tail_moment=1.0, csv_filename="Manual Entry", created_at=None, **kwargs):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.exp_uuid = exp_uuid
        self.sample_name = sample_name
        self.researcher_name = researcher_name
        self.nanoparticle_type = nanoparticle_type
        self.cell_line = cell_line
        self.exposure_time = exposure_time
        self.synthesis_method = synthesis_method
        self.surface_coating = surface_coating
        self.hemolysis_rate = hemolysis_rate
        self.hemocompatibility_status = hemocompatibility_status
        self.selectivity_index = selectivity_index
        self.comet_tail_moment = comet_tail_moment
        self.csv_filename = csv_filename
        if created_at is not None:
            self.created_at = created_at

    def __repr__(self):
        return f"<Experiment #{self.id} '{self.sample_name}' user={self.user_id}>"


# ============================================================
# EXPERIMENT RESULTS TABLE
# ============================================================
class ExperimentResult(db.Model):
    __tablename__ = "experiment_results"

    id = db.Column(db.Integer, primary_key=True)
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id"), nullable=False, unique=True)

    # Measurements
    avg_concentration = db.Column(db.Float, default=0.0)
    cell_viability = db.Column(db.Float, default=0.0)
    ros = db.Column(db.Float, default=0.0)
    ldh = db.Column(db.Float, default=0.0)
    apoptosis = db.Column(db.Float, default=0.0)
    hemolysis_rate = db.Column(db.Float, default=0.0)
    hemocompatibility_status = db.Column(db.String(50), default="Non-Hemolytic (<2%)")
    selectivity_index = db.Column(db.Float, default=1.0)
    comet_tail_moment = db.Column(db.Float, default=1.0)
    synthesis_method = db.Column(db.String(80), default="Green_Synthesis")
    surface_coating = db.Column(db.String(80), default="Bare_ZnO")

    # Analysis outputs
    toxicity_score = db.Column(db.Float, default=0.0)
    risk_level = db.Column(db.String(20), default="Low")  # Low, Moderate, High
    estimated_ic50 = db.Column(db.String(50), default="Not Reached")
    safe_range = db.Column(db.String(100), default="")
    interpretation = db.Column(db.Text, default="")

    # Files
    graph_path = db.Column(db.String(300), default="")
    tables_html = db.Column(db.Text, default="")

    # Timestamps
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    experiment = db.relationship("Experiment", back_populates="result")

    def __init__(self, experiment_id=None, avg_concentration=0.0, cell_viability=0.0,
                 ros=0.0, ldh=0.0, apoptosis=0.0, hemolysis_rate=0.0,
                 hemocompatibility_status="Non-Hemolytic (<2%)", selectivity_index=1.0,
                 comet_tail_moment=1.0, synthesis_method="Green_Synthesis",
                 surface_coating="Bare_ZnO", toxicity_score=0.0, risk_level="Low",
                 estimated_ic50="Not Reached", safe_range="", interpretation="",
                 graph_path="", tables_html="", generated_at=None, **kwargs):
        super().__init__(**kwargs)
        self.experiment_id = experiment_id
        self.avg_concentration = avg_concentration
        self.cell_viability = cell_viability
        self.ros = ros
        self.ldh = ldh
        self.apoptosis = apoptosis
        self.hemolysis_rate = hemolysis_rate
        self.hemocompatibility_status = hemocompatibility_status
        self.selectivity_index = selectivity_index
        self.comet_tail_moment = comet_tail_moment
        self.synthesis_method = synthesis_method
        self.surface_coating = surface_coating
        self.toxicity_score = toxicity_score
        self.risk_level = risk_level
        self.estimated_ic50 = estimated_ic50
        self.safe_range = safe_range
        self.interpretation = interpretation
        self.graph_path = graph_path
        self.tables_html = tables_html
        if generated_at is not None:
            self.generated_at = generated_at

    def __repr__(self):
        return f"<Result experiment={self.experiment_id} risk={self.risk_level}>"


# ============================================================
# REPORTS TABLE
# ============================================================
class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id"), nullable=False, unique=True)

    pdf_path = db.Column(db.String(300), default="")
    pdf_filename = db.Column(db.String(200), default="")
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    experiment = db.relationship("Experiment", back_populates="report")

    def __init__(self, experiment_id=None, pdf_path="", pdf_filename="", generated_at=None, **kwargs):
        super().__init__(**kwargs)
        self.experiment_id = experiment_id
        self.pdf_path = pdf_path
        self.pdf_filename = pdf_filename
        if generated_at is not None:
            self.generated_at = generated_at

    def __repr__(self):
        return f"<Report experiment={self.experiment_id}>"


# ============================================================
# PROJECTS TABLE (For Folder Organization)
# ============================================================
class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", backref=db.backref("projects", lazy="dynamic", cascade="all, delete-orphan"))
    histories = db.relationship("History", back_populates="project", lazy="dynamic")

    def __init__(self, user_id=None, name="", description="", created_at=None, **kwargs):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.name = name
        self.description = description
        if created_at is not None:
            self.created_at = created_at

    def __repr__(self):
        return f"<Project #{self.id} '{self.name}' user={self.user_id}>"


# ============================================================
# HISTORY TABLE (denormalized flat view for history page)
# ============================================================
class History(db.Model):
    __tablename__ = "history"

    id = db.Column(db.Integer, primary_key=True)
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id"),
                              nullable=True, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True, index=True)

    # Denormalized fields for fast history page queries
    date_time = db.Column(db.String(30), default="")
    sample_name = db.Column(db.String(200), default="")
    nanoparticle_type = db.Column(db.String(50), default="ZnO")
    cell_line = db.Column(db.String(100), default="")
    concentration = db.Column(db.Float, default=0.0)
    cell_viability = db.Column(db.Float, default=0.0)
    ros = db.Column(db.Float, default=0.0)
    ldh = db.Column(db.Float, default=0.0)
    apoptosis = db.Column(db.Float, default=0.0)
    hemolysis_rate = db.Column(db.Float, default=0.0)
    hemocompatibility_status = db.Column(db.String(50), default="Non-Hemolytic (<2%)")
    selectivity_index = db.Column(db.Float, default=1.0)
    comet_tail_moment = db.Column(db.Float, default=1.0)
    synthesis_method = db.Column(db.String(80), default="Green_Synthesis")
    surface_coating = db.Column(db.String(80), default="Bare_ZnO")
    toxicity_score = db.Column(db.Float, default=0.0)
    risk_level = db.Column(db.String(20), default="Low")
    estimated_ic50 = db.Column(db.String(50), default="Not Reached")
    safe_range = db.Column(db.String(100), default="")
    csv_filename = db.Column(db.String(200), default="")
    pdf_path = db.Column(db.String(300), default="")
    graph_path = db.Column(db.String(300), default="")
    researcher_name = db.Column(db.String(120), default="")
    exposure_time = db.Column(db.String(50), default="")
    interpretation = db.Column(db.Text, default="")
    tables_html = db.Column(db.Text, default="")
    username = db.Column(db.String(80), default="")
    participant_id = db.Column(db.String(50), default="")    # e.g. "PAT-2026-001" or ""
    participant_name = db.Column(db.String(150), default="") # e.g. "Jane D."
    study_group = db.Column(db.String(100), default="")      # e.g. "Wound Care Cohort A"

    experiment = db.relationship("Experiment", back_populates="history")
    project = db.relationship("Project", back_populates="histories")

    def to_dict(self):
        return {
            "id": self.id,
            "experiment_id": self.experiment_id,
            "date_time": self.date_time,
            "sample_name": self.sample_name,
            "nanoparticle_type": self.nanoparticle_type,
            "cell_line": self.cell_line,
            "concentration": self.concentration,
            "cell_viability": self.cell_viability,
            "ros": self.ros,
            "ldh": self.ldh,
            "apoptosis": self.apoptosis,
            "hemolysis_rate": self.hemolysis_rate or 0.0,
            "hemocompatibility_status": self.hemocompatibility_status or "Non-Hemolytic (<2%)",
            "selectivity_index": self.selectivity_index or 1.0,
            "comet_tail_moment": self.comet_tail_moment or 1.0,
            "synthesis_method": self.synthesis_method or "Green_Synthesis",
            "surface_coating": self.surface_coating or "Bare_ZnO",
            "toxicity_score": self.toxicity_score,
            "risk_level": self.risk_level,
            "estimated_ic50": self.estimated_ic50,
            "safe_range": self.safe_range,
            "csv_filename": self.csv_filename,
            "pdf_path": self.pdf_path,
            "graph_path": self.graph_path,
            "researcher_name": self.researcher_name,
            "exposure_time": self.exposure_time,
            "interpretation": self.interpretation,
            "tables_html": self.tables_html,
            "username": self.username,
            "participant_id": self.participant_id or "",
            "participant_name": self.participant_name or "",
            "study_group": self.study_group or "",
        }

    def __init__(self, experiment_id=None, user_id=None, date_time="", sample_name="",
                 nanoparticle_type="ZnO", cell_line="", concentration=0.0, cell_viability=0.0,
                 ros=0.0, ldh=0.0, apoptosis=0.0, hemolysis_rate=0.0,
                 hemocompatibility_status="Non-Hemolytic (<2%)", selectivity_index=1.0,
                 comet_tail_moment=1.0, synthesis_method="Green_Synthesis",
                 surface_coating="Bare_ZnO", toxicity_score=0.0, risk_level="Low",
                 estimated_ic50="Not Reached", safe_range="", csv_filename="", pdf_path="",
                 graph_path="", researcher_name="", exposure_time="", interpretation="",
                 tables_html="", username="", participant_id="", participant_name="",
                 study_group="", **kwargs):
        super().__init__(**kwargs)
        self.experiment_id = experiment_id
        self.user_id = user_id
        self.date_time = date_time
        self.sample_name = sample_name
        self.nanoparticle_type = nanoparticle_type
        self.cell_line = cell_line
        self.concentration = concentration
        self.cell_viability = cell_viability
        self.ros = ros
        self.ldh = ldh
        self.apoptosis = apoptosis
        self.hemolysis_rate = hemolysis_rate
        self.hemocompatibility_status = hemocompatibility_status
        self.selectivity_index = selectivity_index
        self.comet_tail_moment = comet_tail_moment
        self.synthesis_method = synthesis_method
        self.surface_coating = surface_coating
        self.toxicity_score = toxicity_score
        self.risk_level = risk_level
        self.estimated_ic50 = estimated_ic50
        self.safe_range = safe_range
        self.csv_filename = csv_filename
        self.pdf_path = pdf_path
        self.graph_path = graph_path
        self.researcher_name = researcher_name
        self.exposure_time = exposure_time
        self.interpretation = interpretation
        self.tables_html = tables_html
        self.username = username
        self.participant_id = participant_id
        self.participant_name = participant_name
        self.study_group = study_group

    def __repr__(self):
        return f"<History #{self.id} '{self.sample_name}'>"


# ============================================================
# COMPARISONS TABLE
# ============================================================
class Comparison(db.Model):
    __tablename__ = "comparisons"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    experiment_count = db.Column(db.Integer, default=0)
    graph_path = db.Column(db.String(300), default="")
    results_json = db.Column(db.Text, default="")  # JSON blob of comparison results

    def __repr__(self):
        return f"<Comparison #{self.id} user={self.user_id}>"


# ============================================================
# LOGIN LOGS TABLE
# ============================================================
class LoginLog(db.Model):
    __tablename__ = "login_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    username_attempted = db.Column(db.String(80), default="")
    ip_address = db.Column(db.String(45), default="")
    success = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    user_agent = db.Column(db.String(200), default="")

    user = db.relationship("User", back_populates="login_logs")

    def __repr__(self):
        return f"<LoginLog user={self.username_attempted} success={self.success}>"


# ============================================================
# AUDIT LOGS TABLE
# ============================================================
class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    username = db.Column(db.String(80), default="system")
    action = db.Column(db.String(100), nullable=False, index=True)
    module = db.Column(db.String(100), default="")
    resource_id = db.Column(db.String(100), default="")
    description = db.Column(db.Text, default="")
    status = db.Column(db.String(50), default="")
    ip_address = db.Column(db.String(45), default="")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __init__(self, user_id=None, username="system", action="", details="", description="", module="", resource_id="", status="", ip_address="", timestamp=None):
        self.user_id = user_id
        self.username = username
        self.action = action
        self.resource_id = resource_id
        self.description = description or details
        self.ip_address = ip_address
        if timestamp:
            self.timestamp = timestamp

        # Auto-classify module if not provided
        if not module:
            action_lower = action.lower()
            if any(x in action_lower for x in ["login", "logout", "verified", "register", "password", "otp", "profile"]):
                module = "Authentication"
            elif any(x in action_lower for x in ["experiment", "upload", "import"]):
                module = "Experiments"
            elif any(x in action_lower for x in ["comparison", "compare", "ic50", "toxicity"]):
                module = "Analysis"
            elif any(x in action_lower for x in ["report", "pdf"]):
                module = "Reports"
            elif any(x in action_lower for x in ["participant", "consent"]):
                module = "Participants"
            elif any(x in action_lower for x in ["sample", "vial"]):
                module = "Samples"
            elif any(x in action_lower for x in ["admin", "role", "deactivate", "activate", "clear user", "delete user"]):
                module = "Administration"
            else:
                module = "System"
        self.module = module

        # Auto-classify status if not provided
        if not status:
            details_lower = (details or description or "").lower()
            if any(x in details_lower for x in ["failed", "error", "invalid", "deny", "danger", "incorrect", "locked"]):
                status = "Failed"
            else:
                status = "Success"
        self.status = status

    @property
    def details(self):
        return self.description

    def __repr__(self):
        return f"<AuditLog [{self.action}] by {self.username}>"


def log_audit_event(action, module, description, status, resource_id=None, user_id=None, username=None):
    """
    Log an audit event with automated request IP, session user ID, and username resolving.
    Committed immediately to ensure persistence.
    """
    from flask import session, request
    
    # Try resolving user context
    resolved_user_id = user_id
    resolved_username = username
    
    # If not explicitly provided, try getting from flask session
    try:
        if not resolved_user_id and "user_id" in session:
            resolved_user_id = session["user_id"]
        if not resolved_username and "username" in session:
            resolved_username = session["username"]
    except Exception:
        pass
        
    if not resolved_username:
        resolved_username = "system"
        
    # Try resolving client IP address
    ip = ""
    try:
        if request:
            ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
            if "," in ip:
                ip = ip.split(",")[0].strip()
    except Exception:
        pass
        
    try:
        log_entry = AuditLog(
            user_id=resolved_user_id,
            username=resolved_username,
            action=action,
            module=module,
            resource_id=str(resource_id) if resource_id is not None else "",
            description=description,
            status=status,
            ip_address=ip
        )
        db.session.add(log_entry)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[AuditLog Error] Failed to write log: {e}")


# ============================================================
# STUDY PARTICIPANTS TABLE
# ============================================================
class StudyParticipant(db.Model):
    """Clinical patient and study participant profile for ZnO biocompatibility and assay tracking."""
    __tablename__ = "study_participants"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Patient & Participant Identification
    participant_id = db.Column(db.String(50), nullable=False)   # e.g. P-001, PAT-2024-003
    name = db.Column(db.String(150), nullable=True, default="") # Patient / Participant full name
    blood_group = db.Column(db.String(10), nullable=True, default="") # A+, B+, O+, AB+, A-, B-, O-, AB-
    email = db.Column(db.String(120), nullable=True, default="")
    phone = db.Column(db.String(30), nullable=True, default="")
    
    # Demographics & Clinical Profile
    age = db.Column(db.Integer, nullable=True)
    sex = db.Column(db.String(20), nullable=True)               # Male/Female/Other/Prefer not to say
    study_group = db.Column(db.String(100), nullable=True)      # e.g. Control, Treatment A
    medical_history = db.Column(db.Text, nullable=True, default="") # Pre-existing conditions, allergies, indications
    
    # Consent & Governance
    consent_status = db.Column(db.String(20), nullable=False, default="Pending")  # Consented/Pending/Withdrawn
    consent_date = db.Column(db.Date, nullable=True)             # Date consent obtained / signed
    consent_updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    research_notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    samples = db.relationship("BiologicalSample", back_populates="participant",
                              lazy="dynamic", cascade="all, delete-orphan")
    consent_logs = db.relationship("ParticipantConsentLog", back_populates="participant",
                                   lazy="dynamic", cascade="all, delete-orphan",
                                   order_by="ParticipantConsentLog.timestamp.desc()")
    user = db.relationship("User", backref=db.backref("study_participants", lazy="dynamic",
                                                       cascade="all, delete-orphan"))

    def __init__(self, user_id=None, participant_id="", name="", blood_group="",
                 email="", phone="", age=None, sex=None, study_group=None,
                 medical_history="", consent_status="Pending", consent_date=None,
                 consent_updated_at=None, research_notes="", created_at=None, **kwargs):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.participant_id = participant_id
        self.name = name
        self.blood_group = blood_group
        self.email = email
        self.phone = phone
        self.age = age
        self.sex = sex
        self.study_group = study_group
        self.medical_history = medical_history
        self.consent_status = consent_status
        self.consent_date = consent_date
        self.consent_updated_at = consent_updated_at or datetime.utcnow()
        self.research_notes = research_notes
        if created_at is not None:
            self.created_at = created_at

    def __repr__(self):
        return f"<StudyParticipant {self.participant_id} - '{self.name}' [{self.consent_status}]>"


# ============================================================
# PARTICIPANT CONSENT AUDIT LOG TABLE
# ============================================================
class ParticipantConsentLog(db.Model):
    """Audit log tracking all changes and lifecycle events of participant consent."""
    __tablename__ = "participant_consent_logs"

    id = db.Column(db.Integer, primary_key=True)
    participant_fk = db.Column(db.Integer, db.ForeignKey("study_participants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    
    old_status = db.Column(db.String(30), nullable=True)
    new_status = db.Column(db.String(30), nullable=False)
    reason = db.Column(db.Text, default="")
    changed_by = db.Column(db.String(100), default="")
    ip_address = db.Column(db.String(45), default="")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    participant = db.relationship("StudyParticipant", back_populates="consent_logs")
    user = db.relationship("User", backref=db.backref("consent_actions", lazy="dynamic"))

    def __init__(self, participant_fk=None, user_id=None, old_status=None,
                 new_status="Pending", reason="", changed_by="", ip_address="",
                 timestamp=None, **kwargs):
        super().__init__(**kwargs)
        self.participant_fk = participant_fk
        self.user_id = user_id
        self.old_status = old_status
        self.new_status = new_status
        self.reason = reason
        self.changed_by = changed_by
        self.ip_address = ip_address
        if timestamp is not None:
            self.timestamp = timestamp

    def __repr__(self):
        return f"<ParticipantConsentLog {self.old_status}->{self.new_status} at {self.timestamp}>"



# ============================================================
# BIOLOGICAL SAMPLES TABLE
# ============================================================
class BiologicalSample(db.Model):
    """Biological sample collected from a study participant for ZnO cytotoxicity experiments."""
    __tablename__ = "biological_samples"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Sample identification
    sample_id = db.Column(db.String(50), nullable=False)        # e.g. S-001, BIO-2024-001
    participant_fk = db.Column(db.Integer, db.ForeignKey("study_participants.id",
                                                          ondelete="SET NULL"), nullable=True)

    # Sample metadata
    researcher_id = db.Column(db.String(80), default="")
    study_id = db.Column(db.String(80), default="")
    sample_type = db.Column(db.String(100), default="")         # Blood/Tissue/Cell Culture/Serum/Plasma
    sample_category = db.Column(db.String(80), default="Primary Cell Culture")
    cell_type = db.Column(db.String(100), default="")           # HeLa/MCF-7/A549/etc.
    source = db.Column(db.String(150), default="")              # Hospital Biorepository / Cell Line Bank
    volume_quantity = db.Column(db.String(50), default="1.0 mL")
    passage_number = db.Column(db.String(30), default="P1")
    storage_condition = db.Column(db.String(80), default="-80°C Cryopreservation")
    storage_location = db.Column(db.String(100), default="Tank A / Rack 2 / Box 4")
    collection_date = db.Column(db.Date, nullable=True)
    collection_time = db.Column(db.String(30), default="")
    sample_status = db.Column(db.String(30), default="Active")  # Active/Processing/Completed/Archived
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    participant = db.relationship("StudyParticipant", back_populates="samples")
    experiment_links = db.relationship("SampleExperimentLink", back_populates="sample",
                                       lazy="dynamic", cascade="all, delete-orphan")
    user = db.relationship("User", backref=db.backref("biological_samples", lazy="dynamic",
                                                       cascade="all, delete-orphan"))

    def __init__(self, user_id=None, sample_id="", participant_fk=None, researcher_id="",
                 study_id="", sample_type="", sample_category="Primary Cell Culture",
                 cell_type="", source="", volume_quantity="1.0 mL", passage_number="P1",
                 storage_condition="-80°C Cryopreservation", storage_location="Tank A / Rack 2 / Box 4",
                 collection_date=None, collection_time="", sample_status="Active", notes="",
                 created_at=None, **kwargs):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.sample_id = sample_id
        self.participant_fk = participant_fk
        self.researcher_id = researcher_id
        self.study_id = study_id
        self.sample_type = sample_type
        self.sample_category = sample_category
        self.cell_type = cell_type
        self.source = source
        self.volume_quantity = volume_quantity
        self.passage_number = passage_number
        self.storage_condition = storage_condition
        self.storage_location = storage_location
        self.collection_date = collection_date
        self.collection_time = collection_time
        self.sample_status = sample_status
        self.notes = notes
        if created_at is not None:
            self.created_at = created_at

    def __repr__(self):
        return f"<BiologicalSample {self.sample_id} [{self.sample_status}]>"


# ============================================================
# SAMPLE → EXPERIMENT LINK TABLE (many-to-many join)
# ============================================================
class SampleExperimentLink(db.Model):
    """Links a biological sample to one or more ZnO nanoparticle experiments."""
    __tablename__ = "sample_experiment_links"

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey("biological_samples.id",
                                                      ondelete="CASCADE"), nullable=False)
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id",
                                                          ondelete="CASCADE"), nullable=False)
    linked_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    sample = db.relationship("BiologicalSample", back_populates="experiment_links")
    experiment = db.relationship("Experiment",
                                  backref=db.backref("sample_links", lazy="dynamic",
                                                     cascade="all, delete-orphan"))

    def __init__(self, sample_id=None, experiment_id=None, linked_at=None, **kwargs):
        super().__init__(**kwargs)
        self.sample_id = sample_id
        self.experiment_id = experiment_id
        if linked_at is not None:
            self.linked_at = linked_at

    def __repr__(self):
        return f"<SampleExperimentLink sample={self.sample_id} exp={self.experiment_id}>"
