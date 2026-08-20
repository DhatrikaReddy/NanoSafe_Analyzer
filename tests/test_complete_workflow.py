"""
tests/test_complete_workflow.py — End-to-End Test Suite for NanoSafe Analyzer Research Workflows

Covers:
1. User Registration & Direct Login
2. Mandatory Researcher Profile Setup Gate
3. "New Analysis" Choice Gateway (/analysis/choice)
4. Patient Search & Enrollment Workflow
5. Patient Experiment Pipeline & Chronological Timeline
6. Personal Preclinical Research & Strict Patient Isolation
7. Dual-Tab History Module
8. Consent Verification & Safety Enforcements
9. Multi-Source Experiment Comparison
10. Multi-Researcher Data Boundary Isolation
"""

import unittest
from datetime import date
from app_factory import create_app
from models import db, User, Role, StudyParticipant, BiologicalSample, SampleExperimentLink, Experiment, History, ParticipantConsentLog


class CompleteWorkflowTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_01_user_registration_and_mandatory_profile_gate(self):
        """Test registration and enforcement of profile completion gate."""
        # 1. Register new researcher
        reg_resp = self.client.post("/auth/register", data={
            "username": "dr_alice_test",
            "email": "alice_test@nanosafe.org",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agree_terms": "on"
        }, follow_redirects=True)
        self.assertEqual(reg_resp.status_code, 200)

        # 2. Verify user in DB and mark verified
        user = User.query.filter_by(username="dr_alice_test").first()
        self.assertIsNotNone(user)
        user.is_verified = True
        user.is_active = True
        user.is_profile_completed = False
        db.session.commit()

        # 3. Sign In
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # 4. Attempt to access workspace without profile completed -> Should redirect to profile setup
        home_resp = self.client.get("/home", follow_redirects=False)
        self.assertEqual(home_resp.status_code, 302)
        self.assertIn("/auth/researcher-profile", home_resp.headers["Location"])

        # 5. Complete Researcher Profile Setup
        profile_resp = self.client.post("/auth/researcher-profile", data={
            "title_salutation": "Dr.",
            "full_name": "Alice Johnson, Ph.D.",
            "institution": "BioNano Institute of Technology",
            "research_role": "Principal Investigator",
            "research_field": "In-Vitro Toxicology & Biocompatibility",
            "gender_pronouns": "She / Her",
            "date_of_birth": "1990-05-12",
            "preferred_language": "en",
            "next_action": "workspace"
        }, follow_redirects=True)
        self.assertEqual(profile_resp.status_code, 200)

        # 6. Verify user is now marked completed
        db.session.refresh(user)
        self.assertTrue(user.is_profile_completed)
        self.assertEqual(user.research_field, "In-Vitro Toxicology & Biocompatibility")

        # 7. Now /home is accessible
        home_resp2 = self.client.get("/home")
        self.assertEqual(home_resp2.status_code, 200)
        self.assertIn(b"NanoSafe Analyzer", home_resp2.data)

    def test_02_new_analysis_gateway_and_patient_search(self):
        """Test choice gateway and patient search page."""
        user = User.query.filter_by(username="dr_alice_test").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # 1. Access choice gateway
        choice_resp = self.client.get("/analysis/choice")
        self.assertEqual(choice_resp.status_code, 200)
        self.assertIn(b"Patient Research", choice_resp.data)
        self.assertIn(b"Personal Research", choice_resp.data)

        # 2. Access patient search page
        search_resp = self.client.get("/participants/search")
        self.assertEqual(search_resp.status_code, 200)
        self.assertIn(b"Search Existing Patient", search_resp.data)

    def test_03_patient_enrollment_and_record_profile(self):
        """Test patient enrollment and chronological experiment timeline."""
        user = User.query.filter_by(username="dr_alice_test").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # 1. Enroll New Patient
        enroll_resp = self.client.post("/participants/new", data={
            "participant_id": "PAT-2026-TEST01",
            "name": "Jane Doe",
            "blood_group": "O+",
            "email": "jane.doe@example.com",
            "phone": "+1-555-0199",
            "age": "34",
            "sex": "Female",
            "study_group": "ZnO Dental Cohort A",
            "consent_status": "Consented",
            "consent_date": "2026-08-18",
            "medical_history": "Healthy volunteer, non-smoker.",
            "research_notes": "Primary gingival fibroblast donor.",
            "next": "record"
        }, follow_redirects=True)
        self.assertEqual(enroll_resp.status_code, 200)

        # Verify in DB
        patient = StudyParticipant.query.filter_by(participant_id="PAT-2026-TEST01", user_id=user.id).first()
        self.assertIsNotNone(patient)
        self.assertEqual(patient.consent_status, "Consented")

        # 2. Register Biological Sample for this Patient
        sample_resp = self.client.post("/participants/samples/new", data={
            "sample_id": "BIO-2026-S1",
            "participant_fk": str(patient.id),
            "sample_type": "Cell Culture",
            "cell_type": "Primary HDF",
            "volume_quantity": "2.0 mL",
            "passage_number": "P1",
            "storage_condition": "-80°C Cryopreservation",
            "storage_location": "Tank A / Rack 1 / Box 2",
            "sample_status": "Active",
            "notes": "Healthy gingival fibroblast primary line."
        }, follow_redirects=True)
        self.assertEqual(sample_resp.status_code, 200)

        sample = BiologicalSample.query.filter_by(sample_id="BIO-2026-S1", user_id=user.id).first()
        self.assertIsNotNone(sample)
        self.assertEqual(sample.participant_fk, patient.id)

        # 3. Create Patient Experiment 1
        exp1_resp = self.client.post("/upload", data={
            "participant_id": str(patient.id),
            "sample_id": str(sample.id),
            "experiment_name": "Jane Doe ZnO Dose Response Assay 1",
            "researcher_name": user.username,
            "cell_line": "Primary HDF",
            "exposure_time": "24 h",
            "synthesis_method": "Green_Synthesis",
            "surface_coating": "PEG_Coated",
            "hemolysis_rate": "0.5",
            "concentration": ["0", "10", "25", "50", "100"],
            "viability": ["100", "95", "82", "58", "25"],
            "ros": ["1.0", "1.2", "1.6", "2.8", "4.5"],
            "ldh": ["1.0", "2.0", "4.5", "12.0", "28.0"],
            "apoptosis": ["0.5", "1.2", "3.0", "8.5", "22.0"],
            "medical_application": "general"
        }, follow_redirects=True)
        self.assertEqual(exp1_resp.status_code, 200)

        # 4. Create Patient Experiment 2
        exp2_resp = self.client.post("/upload", data={
            "participant_id": str(patient.id),
            "sample_id": str(sample.id),
            "experiment_name": "Jane Doe ZnO Chitosan Coating Assay 2",
            "researcher_name": user.username,
            "cell_line": "Primary HDF",
            "exposure_time": "48 h",
            "synthesis_method": "Green_Synthesis",
            "surface_coating": "Chitosan_Coated",
            "hemolysis_rate": "0.3",
            "concentration": ["0", "10", "25", "50", "100"],
            "viability": ["100", "98", "89", "72", "42"],
            "ros": ["1.0", "1.1", "1.3", "1.9", "3.2"],
            "ldh": ["1.0", "1.5", "3.0", "7.0", "18.0"],
            "apoptosis": ["0.5", "0.8", "2.1", "5.0", "14.0"],
            "medical_application": "general"
        }, follow_redirects=True)
        self.assertEqual(exp2_resp.status_code, 200)

        # 5. Verify Patient Detail page shows both experiments chronologically
        detail_resp = self.client.get(f"/participants/{patient.id}")
        self.assertEqual(detail_resp.status_code, 200)
        self.assertIn(b"Experiment 1", detail_resp.data)
        self.assertIn(b"Experiment 2", detail_resp.data)
        self.assertIn(b"Jane Doe ZnO Dose Response Assay 1", detail_resp.data)
        self.assertIn(b"Jane Doe ZnO Chitosan Coating Assay 2", detail_resp.data)

    def test_04_personal_research_and_strict_patient_isolation(self):
        """Test that Personal Preclinical Experiments are isolated and never appear in patient records."""
        user = User.query.filter_by(username="dr_alice_test").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Run unlinked personal research experiment
        pers_resp = self.client.post("/upload", data={
            "participant_id": "",
            "sample_id": "",
            "experiment_name": "ZnO-PEG-Batch4 Preclinical Material Screen",
            "researcher_name": user.username,
            "cell_line": "HeLa",
            "exposure_time": "24 h",
            "synthesis_method": "Sol-Gel",
            "surface_coating": "Bare_ZnO",
            "hemolysis_rate": "1.2",
            "concentration": ["0", "20", "40", "80"],
            "viability": ["100", "85", "60", "20"],
            "ros": ["1.0", "1.8", "3.2", "6.0"],
            "ldh": ["1.0", "5.0", "15.0", "35.0"],
            "apoptosis": ["0.5", "2.0", "7.0", "25.0"],
            "medical_application": "general"
        }, follow_redirects=True)
        self.assertEqual(pers_resp.status_code, 200)

        # Verify in History DB
        pers_hist = History.query.filter_by(sample_name="ZnO-PEG-Batch4 Preclinical Material Screen", user_id=user.id).first()
        self.assertIsNotNone(pers_hist)
        self.assertEqual(pers_hist.participant_id, "")

        # Clear session flash messages
        with self.client.session_transaction() as sess:
            sess.pop('_flashes', None)

        # Verify it does NOT appear in Jane Doe's patient record
        patient = StudyParticipant.query.filter_by(participant_id="PAT-2026-TEST01", user_id=user.id).first()
        detail_resp = self.client.get(f"/participants/{patient.id}")
        self.assertEqual(detail_resp.status_code, 200)
        self.assertNotIn(b"ZnO-PEG-Batch4 Preclinical Material Screen", detail_resp.data)

    def test_05_consent_safety_check(self):
        """Test that non-consented participants cannot be used in experiments."""
        user = User.query.filter_by(username="dr_alice_test").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Enroll patient with Pending consent
        self.client.post("/participants/new", data={
            "participant_id": "PAT-PENDING-01",
            "name": "Bob Pending",
            "consent_status": "Pending",
            "study_group": "Cohort B"
        }, follow_redirects=True)

        pending_patient = StudyParticipant.query.filter_by(participant_id="PAT-PENDING-01", user_id=user.id).first()
        self.assertIsNotNone(pending_patient)

        # Attempt to run experiment with pending consent -> Should block
        blocked_resp = self.client.post("/upload", data={
            "participant_id": str(pending_patient.id),
            "experiment_name": "Blocked Experiment",
            "cell_line": "HeLa",
            "exposure_time": "24 h",
            "concentration": ["0", "10"],
            "viability": ["100", "90"]
        })
        self.assertIn(b"Action Blocked: Participant consent is Pending", blocked_resp.data)

    def test_06_multi_source_comparison(self):
        """Test comparing patient experiment with personal research and manual entry."""
        user = User.query.filter_by(username="dr_alice_test").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = user.id
            sess["username"] = user.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Compare 2 experiments via AJAX
        cmp_resp = self.client.post("/ajax/compare", data={
            "exp_count": "2",
            "exp_0_name": "Patient 001 - Experiment 1",
            "exp_0_cell_line": "Primary HDF",
            "exp_0_exposure_time": "24h",
            "exp_0_mode": "manual",
            "exp_0_concentration[]": ["0", "25", "50", "100"],
            "exp_0_viability[]": ["100", "85", "60", "25"],
            "exp_0_ros[]": ["1.0", "1.5", "2.5", "4.0"],
            "exp_0_ldh[]": ["1.0", "3.0", "8.0", "20.0"],
            "exp_0_apoptosis[]": ["0.5", "2.0", "5.0", "15.0"],

            "exp_1_name": "Personal Research ZnO-PEG",
            "exp_1_cell_line": "HeLa",
            "exp_1_exposure_time": "24h",
            "exp_1_mode": "manual",
            "exp_1_concentration[]": ["0", "25", "50", "100"],
            "exp_1_viability[]": ["100", "92", "75", "45"],
            "exp_1_ros[]": ["1.0", "1.2", "1.7", "2.8"],
            "exp_1_ldh[]": ["1.0", "2.0", "5.0", "12.0"],
            "exp_1_apoptosis[]": ["0.5", "1.0", "3.0", "8.0"],
        })
        self.assertEqual(cmp_resp.status_code, 200)
        json_data = cmp_resp.get_json()
        self.assertTrue(json_data["success"])
        self.assertEqual(len(json_data["results"]), 2)
        self.assertIn("winner", json_data)

    def test_07_data_isolation_between_researchers(self):
        """Verify strict data boundaries: Researcher B cannot see Researcher A's patients or experiments."""
        # 1. Create Researcher B
        self.client.post("/auth/register", data={
            "username": "dr_bob_isolated",
            "email": "bob_isolated@nanosafe.org",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "agree_terms": "on"
        }, follow_redirects=True)

        user_b = User.query.filter_by(username="dr_bob_isolated").first()
        user_b.is_verified = True
        user_b.is_active = True
        user_b.is_profile_completed = True
        user_b.full_name = "Dr. Bob Investigator"
        user_b.institution = "Other University"
        user_b.research_role = "Professor"
        db.session.commit()

        # Login as Researcher B
        with self.client.session_transaction() as sess:
            sess["user_id"] = user_b.id
            sess["username"] = user_b.username
            sess["role"] = "user"
            sess["is_verified"] = True

        # Researcher B searches patients -> Should NOT see Alice's patient PAT-2026-TEST01
        search_b = self.client.get("/participants/search")
        self.assertNotIn(b"PAT-2026-TEST01", search_b.data)
        self.assertNotIn(b"Jane Doe", search_b.data)

        # Researcher B checks history -> Should NOT see Alice's experiments
        hist_b = self.client.get("/history")
        self.assertNotIn(b"Jane Doe ZnO Dose Response Assay 1", hist_b.data)
        self.assertNotIn(b"ZnO-PEG-Batch4 Preclinical Material Screen", hist_b.data)


if __name__ == "__main__":
    unittest.main()
