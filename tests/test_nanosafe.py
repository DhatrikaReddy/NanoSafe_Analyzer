import os
import sys
import unittest
import json
import shutil
import tempfile
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Add Flask root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app_factory import create_app
from models import (
    db, User, Role, EmailVerificationToken, History, Experiment, 
    ExperimentResult, Report, StudyParticipant, BiologicalSample, 
    SampleExperimentLink, ParticipantConsentLog, AuditLog
)
from services.analysis_service import compute_4pl_ic50, process_experiment_data
from auth.validators import strong_password

class NanoSafeTestCase(unittest.TestCase):
    def setUp(self):
        # Use in-memory SQLite for testing
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app.config["DEBUG"] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        
        # Recreate tables in memory
        db.drop_all()
        db.create_all()
        
        # Seed standard roles
        self.user_role = Role(name="user", description="Research user")
        self.admin_role = Role(name="admin", description="Full administrator")
        db.session.add(self.user_role)
        db.session.add(self.admin_role)
        db.session.commit()

        # Create temporary folder for reports/graphs
        self.temp_dir = tempfile.mkdtemp()
        self.app.config["UPLOAD_FOLDER"] = os.path.join(self.temp_dir, "uploads")
        self.app.config["STATIC_FOLDER"] = os.path.join(self.temp_dir, "static")
        self.app.config["REPORT_FOLDER"] = os.path.join(self.temp_dir, "reports")
        os.makedirs(self.app.config["UPLOAD_FOLDER"], exist_ok=True)
        os.makedirs(self.app.config["STATIC_FOLDER"], exist_ok=True)
        os.makedirs(self.app.config["REPORT_FOLDER"], exist_ok=True)

    def tearDown(self):
        db.session.remove()
        self.ctx.pop()
        shutil.rmtree(self.temp_dir)

    # ────────────────────────────────────────────────────────────
    # 1. REGISTRATION & OTP VERIFICATION TESTS
    # ────────────────────────────────────────────────────────────
    def test_registration_flow_success(self):
        """Verify successful user registration without SMTP does not rollback."""
        # Clean session
        with self.client.session_transaction() as sess:
            sess.clear()
            
        response = self.client.post("/auth/register", data={
            "full_name": "Test Researcher",
            "username": "tester",
            "email": "tester@nanosafe.local",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertEqual(response.status_code, 302)  # Should redirect to verify-otp
        
        # Verify DB entry
        user = User.query.filter_by(username="tester").first()
        self.assertIsNotNone(user)
        self.assertFalse(user.is_verified)
        self.assertFalse(user.is_active)
        
        # Verify Token created
        token = EmailVerificationToken.query.filter_by(user_id=user.id).first()
        self.assertIsNotNone(token)
        self.assertEqual(token.attempts, 0)
        
        # Verify dev_otp set in session
        with self.client.session_transaction() as sess:
            self.assertIn("dev_otp", sess)
            self.assertEqual(sess["user_id"], user.id)

    def test_duplicate_registration(self):
        """Verify duplicate email/username registrations are rejected."""
        # Create first user
        u1 = User(username="tester1", email="tester1@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        db.session.add(u1)
        db.session.commit()

        # Try duplicate username
        response = self.client.post("/auth/register", data={
            "full_name": "Another Tester",
            "username": "tester1",
            "email": "unique@nanosafe.local",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertIn(b"Username already exists", response.data)

        # Try duplicate email
        response = self.client.post("/auth/register", data={
            "full_name": "Another Tester",
            "username": "unique",
            "email": "tester1@nanosafe.local",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        self.assertIn(b"Email already registered", response.data)

    def test_otp_verification_limits_and_expiry(self):
        """Test OTP rate-limiting failed attempts and expiry checks."""
        # Register user
        self.client.post("/auth/register", data={
            "full_name": "Test User",
            "username": "testotp",
            "email": "testotp@nanosafe.local",
            "password": "Password123!",
            "confirm_password": "Password123!"
        })
        user = User.query.filter_by(username="testotp").first()
        token = EmailVerificationToken.query.filter_by(user_id=user.id).first()

        # Submit wrong OTPs and verify attempt increment
        for i in range(1, 5):
            self.client.post("/auth/verify-otp", data={"otp": "000000"})
            db.session.refresh(token)
            self.assertEqual(token.attempts, i)

        # 5th attempt locks it out
        response = self.client.post("/auth/verify-otp", data={"otp": "000000"})
        self.assertIn(b"Too many incorrect attempts", response.data)
        
        # Test expired OTP
        token.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.session.commit()
        response = self.client.post("/auth/verify-otp", data={"otp": "123456"})
        self.assertIn(b"Invalid or expired verification code", response.data)

    # ────────────────────────────────────────────────────────────
    # 2. IC50 DIVISION-BY-ZERO PROTECTION TESTS
    # ────────────────────────────────────────────────────────────
    def test_ic50_division_by_zero_handling(self):
        """Ensure zero denominator during linear interpolation does not crash."""
        df = pd.DataFrame([
            {"Concentration": 10.0, "Cell Viability": 50.0},
            {"Concentration": 20.0, "Cell Viability": 50.0}
        ])
        df_sorted = df.sort_values("Concentration")
        
        # Calling compute_4pl_ic50 on this dataset must return None and fallback method string
        ic50_val, hill_slope, fit_r2, fit_method = compute_4pl_ic50(df_sorted)
        self.assertIsNone(ic50_val)
        self.assertEqual(fit_method, "IC50 unavailable for this dataset")

    def test_ic50_never_crosses_50(self):
        """Test datasets that never drop viability below 50%."""
        df = pd.DataFrame([
            {"Concentration": 10.0, "Cell Viability": 90.0},
            {"Concentration": 20.0, "Cell Viability": 85.0},
            {"Concentration": 30.0, "Cell Viability": 80.0}
        ])
        ic50_val, _, _, fit_method = compute_4pl_ic50(df)
        self.assertIsNone(ic50_val)
        self.assertIn("IC50 Not Reached", fit_method)

    # ────────────────────────────────────────────────────────────
    # 3. DATABASE CASCADE & FILE CLEANUP TESTS
    # ────────────────────────────────────────────────────────────
    def test_delete_history_cascades_and_removes_files(self):
        """Verify deleting a history record deletes experiment records and physical files."""
        # Create User
        u = User(username="cleanup_user", email="cleanup@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        db.session.add(u)
        db.session.commit()
        
        # Write dummy files
        graph_file = os.path.join(self.app.config["STATIC_FOLDER"], "dummy_graph.png")
        pdf_file = os.path.join(self.app.config["REPORT_FOLDER"], "dummy_report.pdf")
        with open(graph_file, "w") as f: f.write("png data")
        with open(pdf_file, "w") as f: f.write("pdf data")
        
        self.assertTrue(os.path.exists(graph_file))
        self.assertTrue(os.path.exists(pdf_file))
        
        # Save Experiment and History
        exp = Experiment(user_id=u.id, exp_uuid="uuid123", sample_name="Test Sample")
        db.session.add(exp)
        db.session.flush()
        
        exp.result = ExperimentResult(experiment_id=exp.id, toxicity_score=45.0)
        exp.report = Report(experiment_id=exp.id, pdf_path=pdf_file, pdf_filename="dummy_report.pdf")
        
        hist = History(
            experiment_id=exp.id, user_id=u.id, sample_name="Test Sample",
            pdf_path=pdf_file, graph_path=graph_file
        )
        db.session.add(hist)
        db.session.commit()
        
        # Log in user
        with self.client.session_transaction() as sess:
            sess["user_id"] = u.id
            sess["username"] = u.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Call delete endpoint
        response = self.client.post(f"/delete_history/{hist.id}")
        self.assertEqual(response.status_code, 200)
        
        # Verify files are deleted
        self.assertFalse(os.path.exists(graph_file))
        self.assertFalse(os.path.exists(pdf_file))
        
        # Verify DB entries are removed via cascade
        self.assertIsNone(Experiment.query.get(exp.id))
        self.assertIsNone(ExperimentResult.query.filter_by(experiment_id=exp.id).first())
        self.assertIsNone(Report.query.filter_by(experiment_id=exp.id).first())
        self.assertIsNone(History.query.get(hist.id))

    # ────────────────────────────────────────────────────────────
    # 4. CONSENT SAFETY WORKFLOW TESTS
    # ────────────────────────────────────────────────────────────
    def test_consent_withdrawal_blocks_new_experiments(self):
        """Verify that withdrawing participant consent blocks experiment creation."""
        # Create User & Participant
        u = User(username="consent_user", email="consent@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        db.session.add(u)
        db.session.commit()

        p = StudyParticipant(user_id=u.id, participant_id="PAT-009", name="Anonymous Participant", consent_status="Withdrawn")
        db.session.add(p)
        db.session.commit()
        
        # Log in user
        with self.client.session_transaction() as sess:
            sess["user_id"] = u.id
            sess["username"] = u.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Try to post experiment linked to withdrawn participant
        response = self.client.post("/upload", data={
            "experiment_name": "ZnO Test Run",
            "cell_line": "HeLa",
            "exposure_time": "24h",
            "participant_id": p.id,
            "concentration": [10, 20],
            "viability": [90, 80]
        })
        self.assertIn(b"Participant consent is Withdrawn", response.data)

    def test_consent_logs_creation(self):
        """Verify consent logs are created when consent status changes."""
        u = User(username="consent_log_user", email="consentlog@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        db.session.add(u)
        db.session.commit()

        p = StudyParticipant(user_id=u.id, participant_id="PAT-999", name="Subject X", consent_status="Consented")
        db.session.add(p)
        db.session.commit()

        # Update consent via participants blueprint route
        with self.client.session_transaction() as sess:
            sess["user_id"] = u.id
            sess["username"] = u.username
            sess["role"] = "user"
            sess["is_verified"] = True

        self.client.post(f"/participants/{p.id}/edit", data={
            "participant_id": "PAT-999",
            "name": "Subject X",
            "consent_status": "Withdrawn",
            "consent_reason": "Withdrew from study protocol"
        })

        # Verify ParticipantConsentLog entry exists
        log = ParticipantConsentLog.query.filter_by(participant_fk=p.id).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.old_status, "Consented")
        self.assertEqual(log.new_status, "Withdrawn")
        self.assertIn("Withdrew from study protocol", log.reason)

    # ────────────────────────────────────────────────────────────
    # 5. SECURITY & DATA ISOLATION TESTS
    # ────────────────────────────────────────────────────────────
    def test_user_resource_isolation(self):
        """Ensure users cannot access another user's participant records."""
        # Create User 1 & Participant
        u1 = User(username="user1", email="u1@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        # Create User 2
        u2 = User(username="user2", email="u2@nanosafe.local", password_hash="hash", is_verified=True, is_active=True)
        db.session.add_all([u1, u2])
        db.session.commit()

        p1 = StudyParticipant(user_id=u1.id, participant_id="PAT-U1", name="U1 Patient", consent_status="Consented")
        db.session.add(p1)
        db.session.commit()

        # Log in as User 2
        with self.client.session_transaction() as sess:
            sess["user_id"] = u2.id
            sess["username"] = u2.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Try to view User 1's participant details
        response = self.client.get(f"/participants/{p1.id}")
        self.assertEqual(response.status_code, 404)  # Isolated!

    # ────────────────────────────────────────────────────────────
    # 6. ADMIN DASHBOARD & CONTROLS TESTS
    # ────────────────────────────────────────────────────────────
    def test_admin_login_and_dashboard_access(self):
        """Verify that admin can log in and access the dashboard."""
        admin_user = User(username="admin_test", email="admin_test@nanosafe.local", password_hash="hash", role_id=1, is_verified=True, is_active=True)
        db.session.add(admin_user)
        db.session.commit()

        with self.client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["username"] = admin_user.username
            sess["role"] = "admin"
            sess["is_verified"] = True

        response = self.client.get("/admin/dashboard")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"System Overview", response.data)
        self.assertIn(b"admin_test", response.data)

    def test_normal_user_blocked_from_admin(self):
        """Ensure non-admin users cannot access admin pages or APIs."""
        normal_user = User(username="normal_test", email="normal_test@nanosafe.local", password_hash="hash", role_id=2, is_verified=True, is_active=True)
        db.session.add(normal_user)
        db.session.commit()

        with self.client.session_transaction() as sess:
            sess["user_id"] = normal_user.id
            sess["username"] = normal_user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Non-admin tries to access dashboard
        response = self.client.get("/admin/dashboard")
        self.assertEqual(response.status_code, 302)  # Redirects to main.home

        # Non-admin tries to access analytics data API
        response = self.client.get("/admin/analytics-data")
        self.assertEqual(response.status_code, 302)

    def test_admin_user_management_api(self):
        """Verify admin user management operations: list, search, toggle, delete."""
        admin_user = User(username="admin_mgr", email="admin_mgr@nanosafe.local", password_hash="hash", role_id=1, is_verified=True, is_active=True)
        target_user = User(username="target_researcher", email="target@nanosafe.local", password_hash="hash", role_id=2, is_verified=True, is_active=True)
        db.session.add_all([admin_user, target_user])
        db.session.commit()

        with self.client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["username"] = admin_user.username
            sess["role"] = "admin"
            sess["is_verified"] = True

        # 1. View users list
        response = self.client.get("/admin/users")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"target_researcher", response.data)

        # 2. Search users
        response = self.client.get("/admin/users?search=target")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"target_researcher", response.data)

        # 3. Toggle Active state
        response = self.client.post(f"/admin/users/{target_user.id}/toggle-active")
        self.assertEqual(response.status_code, 200)
        db.session.refresh(target_user)
        self.assertFalse(target_user.is_active)

        # 4. Toggle Verified state
        response = self.client.post(f"/admin/users/{target_user.id}/toggle-verified")
        self.assertEqual(response.status_code, 200)
        db.session.refresh(target_user)
        self.assertFalse(target_user.is_verified)

        # 5. Change Role
        response = self.client.post(f"/admin/users/{target_user.id}/change-role", data={"role": "admin"})
        self.assertEqual(response.status_code, 200)
        db.session.refresh(target_user)
        self.assertEqual(target_user.role, "admin")

        # 6. Delete user
        response = self.client.post(f"/admin/users/{target_user.id}/delete")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(User.query.get(target_user.id))

    def test_admin_monitoring_and_logs(self):
        """Verify admin can view audit logs, experiments, reports, security, and profile."""
        admin_user = User(username="admin_monitor", email="admin_monitor@nanosafe.local", password_hash="hash", role_id=1, is_verified=True, is_active=True)
        db.session.add(admin_user)
        db.session.commit()

        # Let's perform an action that writes a log
        log_entry = AuditLog(user_id=admin_user.id, username=admin_user.username, action="Manual Experiment Entry", details="Inserted manual data block")
        db.session.add(log_entry)
        db.session.commit()

        with self.client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["username"] = admin_user.username
            sess["role"] = "admin"
            sess["is_verified"] = True

        # View audit logs
        response = self.client.get("/admin/audit-log")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Manual Experiment Entry", response.data)

        # View experiments monitoring
        response = self.client.get("/admin/experiments")
        self.assertEqual(response.status_code, 200)

        # View reports monitoring
        response = self.client.get("/admin/reports")
        self.assertEqual(response.status_code, 200)

        # View security monitoring
        response = self.client.get("/admin/security")
        self.assertEqual(response.status_code, 200)

        # View analytics dashboard
        response = self.client.get("/admin/analytics")
        self.assertEqual(response.status_code, 200)

        # View admin profile
        response = self.client.get("/admin/profile")
        self.assertEqual(response.status_code, 200)

    def test_sensitive_credentials_hidden_in_logs(self):
        """Ensure no passwords, OTP values, or keys are exposed inside the audit logs."""
        # Query all logs to verify masks
        logs = AuditLog.query.all()
        for log in logs:
            desc_lower = (log.description or "").lower()
            action_lower = (log.action or "").lower()
            # None should contain raw passwords, OTP codes (e.g. 6 digits), or secret tokens
            self.assertNotIn("password123", desc_lower)
            self.assertNotIn("otp", desc_lower)
            self.assertNotIn("token", desc_lower)

if __name__ == "__main__":
    unittest.main()
