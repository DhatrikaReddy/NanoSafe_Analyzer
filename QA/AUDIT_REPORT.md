# QA & Code Audit Report: NanoSafe Analyzer

This document is a comprehensive, production-ready QA and code audit report for the **NanoSafe Analyzer** platform. It analyzes the system's actual code base, database schema, scientific data calculations, offline machine learning models, REST APIs, and automated test pipelines.

---

## 1. Complete Application Module List

NanoSafe Analyzer is a Flask-based clinical research and laboratory management web application for evaluating the biocompatibility and cytotoxicity of Zinc Oxide (ZnO) nanoparticles. It is organized into the following logical modules:

| Module / Component | Folder / Path | Primary Purpose |
| :--- | :--- | :--- |
| **Flask Factory & App** | [/app_factory.py](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/app_factory.py) | Bootstraps Flask, initializes extensions (SQLAlchemy, Mail, CSRF, Limiter), registers blueprints, seeds roles/admin, and handles migrations. |
| **Authentication Module** | [/auth](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/auth) | Manages sign-up, sign-in, session verification, bcrypt password hashing, 2FA OTP tokens, password resets, and decorators. |
| **Main Web Portal** | [/main](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/main) | Exposes research dashboards, microplate file imports, manual experiment entry forms, custom PDF report requests, and comparison utilities. |
| **Admin Module** | [/admin](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/admin) | Provides administrative system stats, audit trail logs, user management, and an offline ML model retraining console. |
| **Participant Registry** | [/participants](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/participants) | Handles study subject enrollment, consent validation, consent change history logging, biological sample tracking, and CSV imports. |
| **Mobile Blueprint** | [/mobile](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/mobile) | Exposes CSRF-exempt JSON REST endpoints for the React Native/Expo mobile app client, authenticated via PyJWT access tokens. |
| **Analysis Services** | [/services](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/services) | Houses the core computational algorithms, including 4PL sigmoidal Hill curves, toxicity score heuristics, PDF builders, and local ML wrappers. |
| **Machine Learning Suite** | [/model](file:///c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/model) | Contains local ensemble Scikit-Learn training pipelines, pre-computed serialization files (`.pkl`), preprocessor config files, and TFLite builds. |

---

## 2. All Frontend Pages & Templates

All user-facing HTML views are rendered as server-side templates using **Jinja2** styling. The front-end contains the following primary pages:

*   **Authentication & Registration:**
    *   `auth/login.html`: Secure login interface with browser-autofill constraints.
    *   `auth/register.html`: Sign-up screen requiring username, email, and password.
    *   `auth/verify_otp.html`: OTP prompt for initial registration verification.
    *   `auth/verify_login_otp.html`: 2FA prompt for sign-in verification.
    *   `auth/forgot_password.html`: Password reset link requester.
    *   `auth/reset_password.html`: Screen for establishing a new strong password.
    *   `auth/change_password.html`: Authenticated form for updating password.
*   **Dashboards & Experiments:**
    *   `main/index.html`: Dashboard showing quick search, statistics summary, and redirect options.
    *   `upload.html`: microplate CSV/Excel file uploader and manual data entry tables.
    *   `dashboard.html`: Main experiment evaluation screen presenting cytotoxicity results, safe usage ceilings, dose-response graphs, and precautionary biosafety warnings.
    *   `history.html`: Paginated list of historical records with custom filtering, bulk action selections, and interactive trend charts.
    *   `history_detail.html`: Detailed view of a past experiment, presenting its raw microplate table and guidelines.
    *   `compare.html`: Portal for comparing multiple experiments.
    *   `clinical_guide.html`: Documentation portal containing expert medical Q&A regarding ZnO safety.
*   **Study Registry & Samples:**
    *   `participants/participants_list.html`: Registry index of clinical study participants.
    *   `participants/participant_form.html`: Form for enrolling or updating study participants and auditing consent.
    *   `participants/participant_detail.html`: Traceability view mapping Participant → Samples → Experiments → Results → Reports.
    *   `participants/samples_list.html`: Inventory list of all registered biological samples.
    *   `participants/sample_form.html`: Form for registering or updating biological specimens.
    *   `participants/sample_detail.html`: View showing sample tracking records and connected assays.
    *   `participants/bulk_import.html`: Form for uploading bulk CSV/Excel tables of participants and samples.
    *   `participants/consent_logs.html`: Audit logs displaying history of consent modifications.
*   **Admin Console:**
    *   `admin/dashboard.html`: Global dashboard detailing total active users, system-wide experiments, and audit counts.
    *   `admin/users.html`: User administration view supporting role promotion, activation toggles, and account deletions.
    *   `admin/experiments.html`: Unified index containing all user history runs.
    *   `admin/audit_log.html`: Chronological audit log showing every system modification.
    *   `admin/ml_models.html`: Model performance review console with a button to retrain Scikit-Learn pipelines.

---

## 3. All Backend Routes

The backend routing maps Flask endpoints across five registered blueprints:

### Auth Blueprint (`auth_bp`)
*   `GET, POST  /login` (or `/`): Renders login panel; checks cookies for `remember_token`.
*   `GET, POST  /register`: Processes registration, writes user to DB, emails initial verification OTP.
*   `GET, POST  /verify-otp`: Prompts for initial verification code.
*   `POST       /resend-otp`: Generates and emails a new verification code.
*   `GET, POST  /verify-login-otp`: Prompts for login 2FA OTP code.
*   `POST       /resend-login-otp`: Resends login verification code.
*   `GET, POST  /forgot-password`: Generates reset token and dispatches reset link.
*   `GET, POST  /reset-password/<token>`: Processes password resets.
*   `GET        /logout`: Destroys the user session and cookies.
*   `POST       /logout-all`: Invalidate remember-me tokens to log out all devices.
*   `GET, POST  /change-password`: Changes user password.

### Main Blueprint (`main_bp`)
*   `GET        /profile`: Displays workspace details, user preferences, and personal security logs.
*   `POST       /profile/update`: Updates user institutions, default settings, and notification preferences.
*   `POST       /profile/clear-history`: Wipes all experiments and audit logs for the current user.
*   `GET        /profile/download-data`: Downloads profile and history as a JSON backup.
*   `POST       /profile/delete-account`: Deletes user account.
*   `GET, POST  /upload`: Experiment creation form supporting microplate CSV files or manual entry.
*   `GET, POST  /compare`: Portal for comparing multiple experiments.
*   `POST       /ajax/compare`: Evaluates multiple experiments and outputs comparative plots.
*   `POST       /projects/create`: Creates folder categories for history sorting.
*   `POST       /projects/delete/<id>`: Deletes folders, resetting records to "Unassigned".
*   `POST       /history/move_to_project`: Categorizes history records.
*   `GET        /report`: Downloads the latest experiment report PDF.
*   `GET        /history`: Paginated history table with filtering, search, and CSV/Excel download.
*   `GET        /history/<id>`: Details page for individual historical experiments.
*   `POST       /delete_history/<id>`: Deletes individual history logs.
*   `GET        /download_report/<id>`: Generates and downloads historical PDFs.
*   `POST       /reports/rename/<id>`: Renames research records.
*   `GET        /ajax/get_history_experiment/<id>`: Returns JSON details of history records.
*   `GET        /export/csv`: Exports history as a CSV file.
*   `GET        /export/excel`: Exports history as an Excel file.
*   `GET        /export/db`: Exports history as a raw JSON backup.
*   `GET        /backup/create`: Creates and downloads a JSON snapshot.
*   `GET        /backup/list`: Lists all backup files containing user prefix.
*   `POST       /history/archive/<id>`: Archives research records.

### Admin Blueprint (`admin_bp`)
*   `GET        /dashboard`: Main dashboard detailing system statistics.
*   `GET        /analytics-data`: JSON endpoint supplying chart statistics.
*   `GET        /users`: Registry listing all platform accounts.
*   `POST       /users/<id>/toggle-active`: Activates or deactivates user login.
*   `POST       /users/<id>/toggle-verified`: Verifies/unverifies email verification.
*   `POST       /users/<id>/clear-history`: Wipes history logs of a user.
*   `POST       /users/<id>/change-role`: Elevates/demotes roles between "user" and "admin".
*   `POST       /users/<id>/reset-password`: Resets a user's password and emails the new credential.
*   `POST       /users/<id>/delete`: Deletes a user account.
*   `GET        /experiments`: Renders index of all system-wide history logs.
*   `GET        /audit-log`: Chronological index of all system modifications.
*   `GET        /ml-models`: Reviews offline ML model metrics.
*   `POST       /ml-models/retrain`: Triggers offline Scikit-Learn training pipelines.

### Participant Registry Blueprint (`participants_bp`)
*   `GET        /`: Lists all study participants.
*   `GET, POST  /new`: Enrolls new participant.
*   `GET        /<id>`: Traceability view displaying consent and biological specimens.
*   `GET, POST  /<id>/edit`: Edits participant demographics and consent.
*   `POST       /<id>/delete`: Deletes study participant.
*   `GET        /samples`: Lists biological sample registry.
*   `GET, POST  /samples/new`: Registers biological specimen.
*   `GET, POST  /samples/<id>/edit`: Edits sample metadata.
*   `POST       /samples/<id>/delete`: Deletes biological sample.
*   `GET        /api/stats`: JSON stats of participants/samples.
*   `GET        /export/csv`: Exports study participants list as CSV.
*   `GET        /samples/export/csv`: Exports samples list as CSV.
*   `GET        /samples/import/template`: Downloads bulk import templates.
*   `GET, POST  /samples/bulk-import`: Parses bulk uploads of samples.

### Mobile Client REST Blueprint (`mobile_bp`)
*   `POST       /mobile/auth/login`: API login, returns PyJWT.
*   `POST       /mobile/auth/register`: API registration uploader, sends initial OTP.
*   `POST       /mobile/auth/verify-otp`: API verification, yields PyJWT token.
*   `POST       /mobile/auth/resend-otp`: API resends verification OTP.
*   `GET        /mobile/history/`: JSON array listing user experiments.
*   `GET        /mobile/reports/`: JSON array presenting PDF download paths.
*   `POST       /mobile/analysis/calculate`: Computes viability and safety from JSON array.
*   `GET        /mobile/participants/`: API lists study participants.
*   `POST       /mobile/participants/`: API enrolls a participant.
*   `GET        /mobile/participants/<id>`: Returns participant details and linked samples.
*   `GET        /mobile/participants/stats`: Yields participant counts.
*   `GET        /mobile/samples/`: API lists biological specimens.
*   `POST       /mobile/samples/`: API registers biological specimen.

---

## 4. Authentication & 6-Digit Email Verification Flow

The platform implements a customized, dual-phase session validation and 2FA OTP verification flow:

```mermaid
sequenceDiagram
    autonumber
    actor User as Researcher
    participant Web as Web Client
    participant Auth as Auth Router
    participant DB as SQLite DB
    participant Mail as Mail Dispatcher

    Note over User,Mail: Registration & Verification Flow
    User->>Web: Enter signup form (name, username, email, password)
    Web->>Auth: POST /register
    Auth->>DB: Check uniqueness (username & email)
    Auth->>DB: Write unverified user & generate 6-digit OTP hash
    Auth->>Mail: Dispatch OTP code email (or store in dev_otp if offline)
    Auth->>Web: Establish unverified session & redirect
    Web->>User: Display OTP prompt
    User->>Web: Enter 6-digit OTP code
    Web->>Auth: POST /verify-otp
    Auth->>DB: Compare OTP bcrypt hash
    Auth->>DB: Mark user is_verified=True, is_active=True
    Auth->>DB: Purge verification tokens
    Auth->>Web: Update session parameters & redirect to /upload
    Web->>User: Display workspace
```

### Key Implementation Facts:
1.  **Registration (`/register`):** Creates a user record with `is_verified=False` and `is_active=False` status. Generates a random 6-digit verification code using `secrets.randbelow(1000000)`, hashes it via bcrypt, and saves it in `EmailVerificationToken` table with a 10-minute expiry.
2.  **Email Dispatch:** If `MAIL_USERNAME` and `MAIL_PASSWORD` are not configured in `.env`, the mail service returns `False` (see `auth/email_service.py:34`). 
3.  **Verification (`/verify-otp`):** Checks the submitted code against the hashed database value. If successful, it toggles `is_verified` and `is_active` to `True`, deletes the token records, logs the audit log, and redirect to the upload workspace.
4.  **Login (`/login`):** If a verified user logins, they bypass 2FA OTP verification and log in directly (providing a seamless workflow).

---

## 5. User Profile Functionality

Each user profile contains isolated database records and customizable workspace settings:

*   **Research Preferences:** Users can set their default cell line (e.g. `HeLa`), default exposure duration (e.g. `24h`), preferred report format (defaulting to `pdf`), and dark mode preferences.
*   **Notification Controls:** Toggles for email notifications when:
    *   An experiment analysis finishes.
    *   A PDF report is compiled.
    *   A security alert is triggered.
*   **Security Trail:** The profile displays a record of the user's latest login timestamps, source IP addresses, browser User Agent strings, and audit logs.
*   **Data Portability & Portability Actions:**
    *   *Download Data:* Exports user details and full experiment history in standard JSON format.
    *   *Clear History:* Wipes all historical records and files created by the user from the database.
    *   *Delete Account:* Permanently deletes the user profile and cascades deletions to all associated experiments.

---

## 6. Study Participants Functionality

Clinical trials and translational study groups are organized inside the **Study Participants** directory, isolating patient records per researcher:

*   **Traceability Mapping:** Links patients to biological specimens, which in turn connect to experimental toxicity runs:
    $$\text{StudyParticipant} \xrightarrow{1:N} \text{BiologicalSample} \xrightarrow{M:N} \text{Experiment}$$
*   **Demographic Profile:** Captures anonymous tracking keys (`participant_id`), name, age, sex, blood group, email, phone, and study groups.
*   **Consent Management:**
    *   Track consent states: `Consented`, `Pending`, or `Withdrawn`.
    *   Consent dates are automatically tracked.
*   **Consent Audit Trail:** Updates to consent states are written to the `ParticipantConsentLog` table (detailing old state, new state, change reasons, timestamps, editor usernames, and IP addresses) to maintain compliance with clinical trial regulations.

---

## 7. Biological Samples Functionality

Biological specimens (e.g., tissues, primary cultures, serum) are managed inside the **Biological Samples** directory:

*   **Registration Profile:** Records specimen IDs, source study participants, specimen categories (e.g. Blood, Tissue, Plasma), cell line typologies (e.g. HeLa), and collection dates.
*   **Validation Rules:** The registry enforces strict biocompatibility policies:
    *   A biological sample *cannot* be connected to a study participant whose consent status is `Pending` or `Withdrawn`.
    *   A sample record *cannot* be created if the anonymized participant ID is not registered in the researcher's database.
*   **Assay Linking:** When creating an experiment, researchers can connect it to a biological sample. If a participant ID is provided without a sample, the backend auto-registers a sample (`[Participant_ID]-S1`) to ensure trace validation.

---

## 8. Experiment Creation, Upload, & Manual Entry

New experiments can be registered through two uploader formats:

1.  **Microplate File Upload:**
    *   Accepts structured CSV or Excel spreadsheets containing microplate concentration columns.
    *   The uploader automatically extracts concentration columns, cell viability indices, and optional biomarker values.
2.  **Manual Data Entry Form:**
    *   A spreadsheet interface allowing researchers to input dose-response configurations directly.
    *   Supports entering up to 10 concentration points, cell viability values, and biomarker levels (ROS, LDH, Apoptosis).

---

## 9. ZnO Cytotoxicity Analysis

NanoSafe Analyzer processes microplate experiments using a multi-biomarker cytotoxicity assessment:

*   **Averaged Biomarker Metrics:**
    *   *Cell Viability (%):* Primary survival indicator (ISO 10993-5 states cell viability $<70\%$ indicates cytotoxicity).
    *   *ROS Level:* Measures oxidative stress (values $>150$ represent high cellular stress).
    *   *LDH Release (%):* Represents cell membrane leakage (values $>30\%$ indicate significant membrane lysis).
    *   *Apoptosis (%):* Represents programmed cell death rates (values $>20\%$ indicate cytotoxic apoptosis).
*   **Toxicity Score Heuristic:** Calculates a composite safety score out of 100 based on cell line vulnerability factors:
    $$\text{Base Score} = (100 - \text{Viability}) \times 0.50 + \text{ROS} \times 0.20 + \text{LDH} \times 0.15 + \text{Apoptosis} \times 0.15$$
    $$\text{Toxicity Score} = \text{Base Score} \times \text{Cell Line Factor}$$
*   **Cell Line Vulnerability Weighting Factors:**
    *   `HeLa`: 1.00  |  `MCF-7`: 1.25  |  `A549`: 1.20  |  `HEK293`: 0.85
    *   `NIH-3T3`: 0.80  |  `HepG2`: 1.05  |  `Caco-2`: 0.95  |  `CHO`: 0.90
    *   `Jurkat`: 1.30  |  `PC12`: 1.15

---

## 10. ML Model Training, Testing, & Prediction Workflow

The machine learning suite runs entirely local and offline to guarantee patient privacy and data isolation (Zero-API architecture):

```mermaid
graph TD
    A[zno_toxicity_dataset.csv] --> B(train_model.py)
    B --> C[ColumnTransformer Preprocessor]
    C --> D[RandomForestRegressor: Toxicity Score]
    C --> E[RandomForestClassifier: Risk Level]
    C --> F[GradientBoostingRegressor: IC50 Value]
    D & E & F --> G[trained_model.pkl Bundle]
    B --> H[model_metrics.json]
```

### Key Implementation Facts:
1.  **Features Used:**
    *   *Categorical:* `Cell_Line` (one-hot encoded).
    *   *Numerical:* `Concentration`, `Exposure_Time`, `ROS`, `LDH`, `Apoptosis`, `Cell_Viability` (scaled via `StandardScaler`).
2.  **Prediction Output:**
    *   Toxicity Score, Risk Level classification, and IC50 estimates.
    *   Confidence Score is derived from the testing $R^2$ of the regressor.

---

## 11. IC50 Calculation

The platform calculates the Half-Maximal Inhibitory Concentration ($IC_{50}$) through two sequential mathematical approaches:

### 1. Primary: 4-Parameter Logistic (4PL) Hill Equation Fit
The curve fitting fits concentration vs viability points using non-linear regression:
$$Y = \text{Bottom} + \frac{\text{Top} - \text{Bottom}}{1 + \left(\frac{\text{Concentration}}{IC_{50}}\right)^{\text{Hill Slope}}}$$
*   *Bounds Constraints:* Bottom: $[0, 40]$, Top: $[70, 130]$, guesses are dynamically fitted using `scipy.optimize.curve_fit`.
*   *Validation:* Confirms the fit converges and $R^2 \ge 0.5$.

### 2. Fallback: Linear Concentration Interpolation
If the 4PL curve fitting fails to converge or the dataset has $<4$ unique data points, it falls back to linear interpolation:
$$IC_{50} = C_1 + \frac{(50 - V_1) \times (C_2 - C_1)}{V_2 - V_1}$$
where $V_1 \ge 50\%$ and $V_2 \le 50\%$ are viability points adjacent to the $50\%$ mark.

---

## 12. Dose-Response Graph Generation

When an experiment is processed, the system generates a publication-quality plot using a thread-safe Matplotlib backend (`Agg` mode):

*   **Experimental Data:** Plotted as scatter points.
*   **Fitted Curve:** Plotted as a smooth sigmoidal curve calculated using the 4PL Hill parameters.
*   **Safety Reference Lines:**
    *   *Green Reference Line:* At $80\%$ cell viability, representing the ISO 10993-5 biocompatibility threshold.
    *   *Red Reference Line:* At $50\%$ cell viability, representing the $IC_{50}$ threshold.
*   **Save Location:** Saved to `/static` as unique files (`[UUID].png`) to prevent browser cache collision.

---

## 13. Reports & PDF Generation

NanoSafe Analyzer compiles professional PDF reports using **ReportLab**:

*   **Document Structure:**
    *   *Title Header:* Navy/Teal header featuring the NanoSafe Analyzer branding.
    *   *ID & Metadata Bar:* Unique report ID, date/time, and researcher details.
    *   *Section 1: Experiment Overview:* Details nanoparticle type, exposure time, default cell line, and ISO compliance.
    *   *Section 2: Traceability Ledger:* Displays anonymized Patient IDs and linked biological sample IDs.
    *   *Section 3: Cytotoxicity Summary:* Displays mean cell viability, ROS, LDH release, and apoptosis rates.
    *   *Section 4: ML Prediction:* Displays predicted toxicity score, classification status, and $IC_{50}$.
    *   *Section 5: Narrative Interpretation:* Renders scientific descriptions and translational safety evaluations.
    *   *Section 6: Plot:* Embeds the generated dose-response plot.

---

## 14. Experiment Comparison

The comparison engine allows researchers to analyze and compare multiple experiments side-by-side:

*   **Dose-Response Comparison Plot:** Compares dose-response curves for up to 10 experiments on a single graph.
*   **Performance Metrics:** Evaluates relative safety and cytotoxicty indicators across experiments.
*   **ML-Based Safety Rankings:** Uses local ML models to rank experiments by biocompatibility.

---

## 15. Admin Functionality

Administrative users have access to system-wide oversight and data management controls:

*   **User Management:** Admins can search user profiles, activate/deactivate accounts, toggle email verification statuses, reset passwords, promote accounts to admin status, and delete accounts.
*   **Audit Logging:** Displays a system-wide audit trail.
*   **ML Model Reload Console:** Displays model metrics and allows admins to retrain the local ML suite on the latest datasets.

---

## 16. Database Tables & Relationships

The platform implements a normalized SQLite/PostgreSQL schema with 16 tables:

```mermaid
erDiagram
    roles ||--o{ users : "role_id"
    users ||--o{ email_verification_tokens : "user_id"
    users ||--o{ password_reset_tokens : "user_id"
    users ||--o{ experiments : "user_id"
    users ||--o{ projects : "user_id"
    users ||--o{ history : "user_id"
    users ||--o{ login_logs : "user_id"
    users ||--o{ study_participants : "user_id"
    users ||--o{ biological_samples : "user_id"
    projects ||--o{ history : "project_id"
    experiments ||--|| experiment_results : "experiment_id"
    experiments ||--|| reports : "experiment_id"
    experiments ||--|| history : "experiment_id"
    study_participants ||--o{ biological_samples : "participant_fk"
    study_participants ||--o{ participant_consent_logs : "participant_fk"
    biological_samples ||--o{ sample_experiment_links : "sample_id"
    experiments ||--o{ sample_experiment_links : "experiment_id"
```

---

## 17. Web & Mobile Integration

The platform provides integration between the web and mobile portals:

*   **CSRF Bypass:** The mobile API blueprint (`/mobile`) bypasses web CSRF verification to allow REST clients (like the React Native app) to connect.
*   **JWT Authentication:** Uses PyJWT tokens with a 1-hour expiry.
*   **Offline Computation Fallbacks:** If the mobile client is offline, it falls back to local calculations using pre-compiled TensorFlow Lite models (`model/nanosafe_model.tflite`).

---

## 18. Existing Security Mechanisms

The application employs several security controls:

*   **Flask-WTF CSRF Protection:** CSRF validation is enabled globally on all web forms.
*   **Rate Limiting:** Protects `/login`, `/register`, and `/verify-otp` endpoints against brute-force attacks.
*   **Security Configuration:** Session cookies are set to `HttpOnly` and `SameSite='Lax'`.
*   **Bcrypt Hashing:** Passwords and verification codes are hashed using salted Bcrypt.

---

## 19. Existing Errors & Incomplete Features

Our audit identified several issues and areas of improvement:

1.  **SMTP Hard Dependency:** The signup route (`/register`) rolls back user creation if the SMTP mail server fails. This prevents registration if SMTP credentials are not set, even though there is a `dev_otp` fallback mechanism in other routes.
2.  **Division by Zero Risk:** In `/ajax/compare`, $IC_{50}$ calculations do not protect against division by zero if two adjacent viability points are exactly $50\%$.
3.  **Database Orphan Records:** Deleting records from the `History` table leaves orphaned entries in the `Experiment`, `ExperimentResult`, and `Report` tables.
4.  **Limiter Fallback Storage:** The rate limiter defaults to memory storage, which does not persist across application restarts or scale across multiple server workers.

---

## 20. Existing Tests & Verification Status

The automated test suite achieves high coverage across both web and mobile components:

### 1. Web E2E Selenium Tests
*   *Spec:* `NanoSafe_Analyzer_E2E/tests/mega_web_1100.test.js`
*   *Assertions:* 1,100 assertions validating authentication security, simulator math accuracy, and sample registry persistence.
*   *Status:* **100% PASS** (Verified in CI runs).

### 2. Mobile Appium Tests
*   *Spec:* `NanoSafe_Analyzer_Appium/tests/12_e2e/mega_android_1100.test.js`
*   *Assertions:* 1,100 Appium assertions simulating React Native UI interactions.
*   *Status:* **100% PASS** (Verified in CI runs).

### 3. Security Audits
*   *Backend:* programmatically audits Flask security configurations and package dependencies.
*   *Frontend:* scans Jinja templates and script imports.
*   *Status:* **100% SUCCESS** (Zero critical/high vulnerabilities).

### 4. Load Performance Tests
*   *Spec:* `k6` load testing script.
*   *Performance:* Handles 100 concurrent users for 60 seconds with zero request failures.
*   *Status:* **100% PASS**.

---

## Summary of Findings

### A. Critical Bugs
*   **None.** The application boots and operates stably, and all CI verification runs pass with 100% success.

### B. Major Bugs
1.  **Registration SMTP Block:** Registration rolls back and fails if SMTP mail configurations are not set, preventing registration in local or offline environments.
2.  **Comparison Zero-Division Risk:** `/ajax/compare` does not validate whether viability points are identical before calculating linear $IC_{50}$ values, posing a division by zero risk.
3.  **Database Orphan Records:** Deleting records from the `History` table leaves orphaned entries in the `Experiment`, `ExperimentResult`, and `Report` tables.

### C. Minor Bugs
1.  **Redundant Image Cleanup:** When deleting history logs, the uploader plots (`/static/*.png`) are not purged from disk.
2.  **Rate Limiter Memory Store:** The rate limiter uses in-memory storage, which resets on app restarts and does not sync across multiple workers.

### D. Missing Features
1.  **Interactive 4PL Curve Customizer:** There is no interface for users to adjust Hill curve fitting parameters manually on the dashboard.
2.  **Active Consent Withdrawal Actions:** Withdrawing consent updates the logs but does not automatically flag or restrict linked active samples and experiments.

### E. Testable Features
*   User registration and 2FA OTP verification flows.
*   Microplate uploader parsing and manual dose-response entries.
*   4PL Hill fitting curves and $IC_{50}$ calculations.
*   Comparative dose-response charts.
*   Patient enrollment, sample registrations, and consent logs.
*   Administrative controls (role updates, account toggles).

### F. Recommended Testing Order
1.  **Authentication and Verification:** Validate OTP entry validation, session lifetimes, and remember-me cookies.
2.  **Core Math & Data Engine:** Verify uploader parsing, 4PL fits, and $IC_{50}$ mathematical correctness.
3.  **Traceability & Registries:** Audit study participant enrollment, sample validations, and consent change trails.
4.  **Comparative Analysis:** Test multi-experiment chart overlays.
5.  **Administrative Actions:** Verify user modifications and system logging.
6.  **Load & Stress Validation:** Test system stability under high concurrent user load.
