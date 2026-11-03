"""
scripts/generate_examiner_guide.py
Generates an authoritative, comprehensive Project Defense & Viva Voce Guide PDF for NanoSafe Analyzer.
"""

import os
import sys
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y'."""
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "NanoSafe Analyzer — Comprehensive Project Defense & Examiner Viva Voce Guide")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(54, 742, letter[0] - 54, 742)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 54, 34, page_text)
        self.drawString(54, 34, "Confidential — Academic & Examination Defense Documentation")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, 44, letter[0] - 54, 44)

        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0f766e")
    dark_navy = colors.HexColor("#0f172a")
    text_dark = colors.HexColor("#1e293b")
    text_muted = colors.HexColor("#475569")
    accent_teal = colors.HexColor("#0d9488")
    card_bg = colors.HexColor("#f8fafc")

    doc_title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=dark_navy,
        spaceAfter=6
    )

    doc_sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=accent_teal,
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=dark_navy,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_dark,
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13.5,
        textColor=text_dark,
        spaceAfter=4
    )

    q_style = ParagraphStyle(
        'Question',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0369a1"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    a_style = ParagraphStyle(
        'Answer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_dark,
        leftIndent=15,
        spaceAfter=3
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=text_dark
    )

    callout_text = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=primary_color
    )

    story = []

    # ─────────────────────────────────────────────────────────────
    # COVER / HEADER TITLE BLOCK
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("NANOSAFE ANALYZER", doc_title_style))
    story.append(Paragraph("AI-Driven Multi-Biomarker Nanoparticle Biocompatibility & Cytotoxicity Assessment System", doc_sub_style))
    story.append(Paragraph("<b>Comprehensive Project Defense, Technical Architecture & Examiner Viva Voce Master Guide</b>", body_style))
    story.append(Paragraph(f"<i>Author & Researcher:</i> Dhatrika Akepati &nbsp;|&nbsp; <i>Project Lead:</i> NanoSafe Analyzer Team &nbsp;|&nbsp; <i>Date:</i> {datetime.now().strftime('%B %Y')}", body_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=14))

    # Executive Summary Card
    summary_text = (
        "<b>Executive Defense Summary:</b> NanoSafe Analyzer is a full-stack, enterprise-grade biomedical platform "
        "designed to predict, quantify, and simulate the cytotoxicity and biocompatibility of metal-oxide nanoparticles "
        "(specifically Zinc Oxide, ZnO) in physiological systems. It replaces conventional, expensive, and time-intensive "
        "wet-lab screening by integrating <b>4-Parameter Logistic (4PL) regression non-linear curve fitting</b>, "
        "<b>Machine Learning toxicity scoring</b>, and regulatory compliance standards (<b>ISO 10993-5</b> & <b>ASTM F756</b>). "
        "The system operates across both a <b>Pro Web Application</b> (Flask, Jinja2, HTML5/CSS3) and a native <b>Mobile App</b> "
        "(React Native, Expo SDK 57), backed by a unified <b>SQLite relational database</b> with 100% data and feature parity."
    )
    summary_table = Table([[Paragraph(summary_text, callout_text)]], colWidths=[504])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdfa")),
        ('BOX', (0,0), (-1,-1), 1, primary_color),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 1: PROBLEM STATEMENT & DOMAIN SCIENCE
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("1. The Scientific Problem & Clinical Significance", h1_style))
    story.append(Paragraph(
        "<b>Why Zinc Oxide (ZnO) Nanoparticles?</b> ZnO nanoparticles are widely applied in modern medicine: "
        "antimicrobial wound dressings, dental root sealers, targeted oncology drug delivery carriers, and bone tissue scaffolds. "
        "However, their high surface-to-volume ratio causes rapid cellular uptake and intracellular dissolution of toxic Zn²⁺ ions, "
        "which can overwhelm mitochondrial defenses, produce excessive Reactive Oxygen Species (ROS), rupture cell membranes (LDH leakage), "
        "and trigger apoptosis.", body_style
    ))
    story.append(Paragraph(
        "<b>The Challenge in Traditional Research:</b> Standard in-vitro testing requires weeks of continuous culturing, pipetting, "
        "and expensive spectrophotometric assays. A dose that is therapeutic in wound care (30 µg/mL) may be severely cytotoxic in vascular "
        "contact. NanoSafe Analyzer provides immediate, in-silico toxicological characterization, identifying safe therapeutic windows "
        "before proceeding to in-vivo animal trials.", body_style
    ))

    # Biomarkers Table
    story.append(Paragraph("<b>Primary Biomarkers Monitored by NanoSafe:</b>", body_bold))
    biomarkers_data = [
        [Paragraph("Biomarker", table_header), Paragraph("Assay Technique", table_header), Paragraph("Biological Significance", table_header), Paragraph("Safe Threshold", table_header)],
        [Paragraph("Cell Viability", table_cell), Paragraph("MTT / CCK-8 Assay", table_cell), Paragraph("Percentage of metabolically active living cells.", table_cell), Paragraph("≥ 80.0% (ISO 10993-5)", table_cell)],
        [Paragraph("ROS Level", table_cell), Paragraph("DCFH-DA Fluorescence", table_cell), Paragraph("Intracellular oxidative stress fold-increase over control.", table_cell), Paragraph("≤ 1.5× baseline", table_cell)],
        [Paragraph("LDH Release", table_cell), Paragraph("Cytosolic Leakage Assay", table_cell), Paragraph("Direct marker of cell membrane lysis and physical necrosis.", table_cell), Paragraph("≤ 10.0%", table_cell)],
        [Paragraph("Apoptosis", table_cell), Paragraph("Annexin V / Flow Cytometry", table_cell), Paragraph("Programmed cell death triggered by caspase cascades.", table_cell), Paragraph("≤ 8.0%", table_cell)],
        [Paragraph("Hemolysis Rate", table_cell), Paragraph("ASTM F756 Red Blood Cell", table_cell), Paragraph("Erythrocyte membrane rupture in blood-contacting devices.", table_cell), Paragraph("< 2.0% (Non-hemolytic)", table_cell)],
        [Paragraph("IC50 Value", table_cell), Paragraph("4PL Non-Linear Regression", table_cell), Paragraph("Half-maximal inhibitory concentration (potency index).", table_cell), Paragraph("Wide margin above target", table_cell)],
    ]
    t_bio = Table(biomarkers_data, colWidths=[90, 105, 205, 104])
    t_bio.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_bio)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 2: MATHEMATICAL & MACHINE LEARNING ALGORITHMS
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("2. Mathematical Modeling & Machine Learning Engine", h1_style))
    story.append(Paragraph(
        "<b>A. 4-Parameter Logistic (4PL) Non-Linear Curve Fitting:</b><br/>"
        "Biological dose-response relationships are sigmoidal (S-shaped), not linear. NanoSafe Analyzer implements "
        "the standard pharmacological 4PL equation solved via Levenberg-Marquardt least-squares optimization (`scipy.optimize.curve_fit`):", body_style
    ))
    story.append(Paragraph(
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>y = D + (A - D) / [ 1 + (x / C)^B ]</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>A:</b> Minimum response / top asymptote (uninhibited cell viability = 100%).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>D:</b> Maximum inhibition / bottom asymptote (complete cell mortality = 0%).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>C:</b> <b>IC50</b> (concentration producing 50% response / inflection point).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>B:</b> <b>Hill slope factor</b> (steepness of the dose-response curve).<br/>"
        "If the mathematical fit produces negative slopes or non-convergent matrices, the engine automatically falls back to an "
        "interpolated log-linear cubic hermite spline to guarantee non-stop system availability.", body_style
    ))
    story.append(Paragraph(
        "<b>B. Machine Learning Predictive Classifier:</b><br/>"
        "Trained on over 10,000 standardized experimental records (`zno_biocompatibility_master_10k.csv`) and validated against "
        "real-world nanotoxicity benchmarks (MeOxNP dataset), the ML model predicts toxicity levels based on 7 core descriptors:<br/>"
        "1. Core Size (nm) &nbsp;|&nbsp; 2. Zeta Potential (mV) &nbsp;|&nbsp; 3. Concentration (µg/mL) &nbsp;|&nbsp; "
        "4. Exposure Time (h) &nbsp;|&nbsp; 5. Synthesis Method &nbsp;|&nbsp; 6. Surface Coating &nbsp;|&nbsp; 7. Target Cell Line.", body_style
    ))
    story.append(Paragraph(
        "<b>C. Regulatory Classification Tiers (ISO 10993-5):</b><br/>"
        "• <b>Low Risk (Safe / ISO-Pass):</b> Viability ≥ 80%, ROS ≤ 1.5×, LDH ≤ 10%, Apoptosis ≤ 8%. Biocompatible.<br/>"
        "• <b>Moderate Risk (Warning):</b> Viability 70% – 79.9%, ROS 1.5× – 3.0×, LDH 10% – 20%. Low-dose surveillance.<br/>"
        "• <b>High Risk (Toxic / ISO-Fail):</b> Viability < 70%, ROS > 3.0×, LDH > 20%, Apoptosis > 15%. Severely cytotoxic.", body_style
    ))
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 3: SYSTEM ARCHITECTURE & FULL TECH STACK
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("3. End-to-End System Architecture & Technology Stack", h1_style))
    story.append(Paragraph(
        "The system follows a modern decoupled architecture: a Python Flask backend powering both server-rendered web clients "
        "and a reactive mobile app through a unified REST API and shared database.", body_style
    ))

    arch_data = [
        [Paragraph("Layer", table_header), Paragraph("Technology Used", table_header), Paragraph("Architectural Role & Description", table_header)],
        [Paragraph("Backend API & Logic", table_cell), Paragraph("Python 3.11, Flask, Jinja2", table_cell), Paragraph("Modular application factory (`app_factory.py`), Blueprints (`main`, `auth`, `admin`, `mobile`, `participants`), JWT bearer auth, CORS headers.", table_cell)],
        [Paragraph("Scientific Engine", table_cell), Paragraph("NumPy, Pandas, SciPy, Scikit-Learn", table_cell), Paragraph("4PL curve optimization, IC50 interpolation, matrix normalization, Random Forest ML prediction pipeline.", table_cell)],
        [Paragraph("Relational Database", table_cell), Paragraph("SQLite 3, SQLAlchemy ORM", table_cell), Paragraph("Single shared database `nanosafe.db` with 16 normalized tables, foreign keys, cascade deletes, and security audit trail.", table_cell)],
        [Paragraph("Web Application", table_cell), Paragraph("HTML5, CSS3, Vanilla JS (ES6+)", table_cell), Paragraph("Enterprise dark/light responsive interface, CSRF protection (`X-CSRFToken`), SVG curve rendering, PDF report generation (`ReportLab`).", table_cell)],
        [Paragraph("Mobile Application", table_cell), Paragraph("React Native 0.86, Expo SDK 57", table_cell), Paragraph("Cross-platform (iOS & Android) with Metro bundler, Expo Go support, native Modal drawer navigation, dynamic host Wi-Fi IP detection.", table_cell)],
        [Paragraph("Security & Auth", table_cell), Paragraph("Bcrypt, PyJWT, Python-Secrets", table_cell), Paragraph("Bcrypt salted password hashing, 365-day mobile JWT tokens, 6-digit email OTP verification, role-based access control (Admin/User).", table_cell)],
    ]
    t_arch = Table(arch_data, colWidths=[90, 130, 284])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), dark_navy),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 4: WEB VS MOBILE PARITY MAPPING
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("4. Complete Feature Parity: Web App vs Mobile App", h1_style))
    story.append(Paragraph(
        "Every page and feature developed in the Web Application is fully implemented in the Mobile Application, "
        "reading and writing to the exact same database (`nanosafe.db`) in real time:", body_style
    ))

    parity_data = [
        [Paragraph("System Feature", table_header), Paragraph("Web Application Route", table_header), Paragraph("Mobile App Component", table_header), Paragraph("Shared Data & Functionality", table_header)],
        [Paragraph("Authentication", table_cell), Paragraph("`/auth/login`, `/auth/register`", table_cell), Paragraph("`LoginScreen.js`, `RegisterScreen.js`", table_cell), Paragraph("Bcrypt auth, 6-digit OTP email verification, auto profile completion check.", table_cell)],
        [Paragraph("Command Center", table_cell), Paragraph("`/home`", table_cell), Paragraph("`DashboardScreen.js`", table_cell), Paragraph("Live KPI metrics (Pass Rate, Total Experiments, Avg Viability, Avg Toxicity).", table_cell)],
        [Paragraph("New Analysis", table_cell), Paragraph("`/analysis/choice`, `/upload`", table_cell), Paragraph("`NewAnalysisScreen.js`", table_cell), Paragraph("Manual multi-dose entry & 96-well CSV upload, 4PL IC50 fitting, SVG dose curve.", table_cell)],
        [Paragraph("Dose Simulator", table_cell), Paragraph("`/simulator`", table_cell), Paragraph("`SimulatorScreen.js`", table_cell), Paragraph("Real-time what-if sandbox, ZnO sliders, coating & synthesis routes, ML prediction.", table_cell)],
        [Paragraph("Experiment History", table_cell), Paragraph("`/history`", table_cell), Paragraph("`HistoryScreen.js`", table_cell), Paragraph("Search, risk filter tabs (All/Safe/Moderate/Risk), assay modal, curve chart, PDF export.", table_cell)],
        [Paragraph("Multi-Compare", table_cell), Paragraph("`/compare`", table_cell), Paragraph("`CompareScreen.js`", table_cell), Paragraph("Multi-experiment curve overlay, side-by-side metric comparison, comparative report.", table_cell)],
        [Paragraph("Study Participants", table_cell), Paragraph("`/participants/`", table_cell), Paragraph("`ParticipantsScreen.js`", table_cell), Paragraph("Patient ID generation (`PAT-2026-XXX`), consent logs (GCP/ISO 14155), linked assays.", table_cell)],
        [Paragraph("Biological Samples", table_cell), Paragraph("`/samples/`", table_cell), Paragraph("`SamplesScreen.js`", table_cell), Paragraph("Sample inventory (Blood, Tissue, Cryo), barcode tagging, participant linking.", table_cell)],
        [Paragraph("Clinical Standards", table_cell), Paragraph("`/clinical-guide`", table_cell), Paragraph("`ClinicalGuideScreen.js`", table_cell), Paragraph("ISO 10993-5 tiers, ASTM F756 hemolysis criteria, medical application ranges, FAQs.", table_cell)],
        [Paragraph("Researcher Profile", table_cell), Paragraph("`/profile`", table_cell), Paragraph("`ProfileScreen.js`", table_cell), Paragraph("User metadata (Institution, Department, Role, Bio, Salutation, Avatar storage).", table_cell)],
        [Paragraph("Database Explorer", table_cell), Paragraph("`/admin/database`", table_cell), Paragraph("CLI: `python view_db.py`", table_cell), Paragraph("Live inspection of all 16 SQLite tables, record search, and row schemas.", table_cell)],
    ]
    t_par = Table(parity_data, colWidths=[80, 110, 120, 194])
    t_par.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, card_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_par)
    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 5: TOP 30 VIVA VOCE QUESTIONS & MODEL ANSWERS
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("5. Comprehensive Viva Voce Questions & Expert Model Answers", h1_style))
    story.append(Paragraph(
        "These 30 questions are organized into 5 core academic categories to prepare you for any theoretical, "
        "architectural, or implementation inquiry from your examiner:", body_style
    ))

    viva_qas = [
        # Category A: Biomedical Science & Problem Domain
        ("Q1: What is the primary biomedical objective of the NanoSafe Analyzer project?",
         "NanoSafe Analyzer is an AI-assisted toxicological screening platform. It quantitatively evaluates the cytotoxicity and biocompatibility of Zinc Oxide (ZnO) nanoparticles across multiple mammalian cell lines (such as HeLa, MCF-7, Caco-2, and HEK293) to determine safe therapeutic concentration thresholds for biomedical applications (e.g., wound dressings, dental cements, bone scaffolds) in accordance with ISO 10993-5 standards."),

        ("Q2: Why did you focus on Zinc Oxide (ZnO) nanoparticles rather than other nanomaterials?",
         "ZnO nanoparticles possess potent broad-spectrum antibacterial and anti-inflammatory properties, making them one of the most clinically promising metal oxides. However, their high surface reactivity and dissolution into intracellular Zn²⁺ ions present a high risk of cytotoxicity. A software platform that accurately maps their safe therapeutic window addresses a critical clinical bottleneck."),

        ("Q3: What are the primary biological mechanisms by which nanoparticles cause toxicity?",
         "Nanoparticle toxicity primarily occurs via: (1) Intracellular Zn²⁺ ion dissolution triggering mitochondrial depolarization; (2) Overproduction of Reactive Oxygen Species (ROS) causing lipid peroxidation; (3) Cell membrane physical rupture leading to Lactate Dehydrogenase (LDH) leakage; and (4) Caspase enzyme activation leading to programmed cell death (apoptosis)."),

        ("Q4: Explain what IC50 means and how it is used in your system.",
         "IC50 (Half-Maximal Inhibitory Concentration) is the quantitative concentration of an agent required to inhibit a biological process or reduce cell viability by 50%. In NanoSafe Analyzer, IC50 represents the potency benchmark of nanoparticle toxicity: formulations with a high IC50 (e.g. >80 µg/mL) are significantly safer than those with a low IC50 (e.g. <20 µg/mL)."),

        ("Q5: What are the international standards implemented in your assessment engine?",
         "We implement two major international regulatory standards: (1) ISO 10993-5 (Biological evaluation of medical devices — Tests for in vitro cytotoxicity), where viability ≥80% is biocompatible, 70–79% is moderate risk, and <70% is severely cytotoxic; and (2) ASTM F756 (Standard Practice for Assessment of Hemolytic Properties of Materials), classifying hemolysis into Non-hemolytic (<2%), Slightly Hemolytic (2–5%), and Hemolytic (>5%)."),

        ("Q6: How does surface coating influence nanoparticle safety in your analysis?",
         "Surface coating alters nanoparticle surface charge and prevents rapid ion leaching. For instance, PEG (Polyethylene Glycol) coating creates a steric hydration barrier that suppresses ROS generation by up to 65% compared to bare ZnO. Our system explicitly incorporates surface coating (Bare ZnO, PEG, Chitosan, Silica) as an essential input descriptor in both 4PL fitting and ML prediction."),

        # Category B: Mathematical Modeling & Machine Learning
        ("Q7: Why did you use 4-Parameter Logistic (4PL) regression instead of standard linear regression?",
         "Biological cellular responses follow a sigmoidal (S-shaped) saturation curve characterized by threshold effects at low doses and plateau inhibition at high doses. Linear regression violates biological dose-response kinetics and generates impossible values (e.g. >100% or negative viability). The 4PL non-linear model accurately estimates the top asymptote, bottom asymptote, Hill slope, and the inflection point (IC50)."),

        ("Q8: How does the backend solve the 4PL equation mathematically?",
         "The backend uses the Levenberg-Marquardt non-linear least-squares algorithm (`scipy.optimize.curve_fit`). It minimizes the sum of squared residuals between observed experimental viability and the theoretical 4PL curve, bounding the parameters logically (top asymptote between 90-110%, bottom asymptote between 0-10%)."),

        ("Q9: What happens if an experiment has incomplete or noisy data where 4PL fails to converge?",
         "We implemented a resilient dual-tier mathematical architecture. If `curve_fit` raises a `RuntimeError` (convergence failure) or produces a singular matrix, the system automatically falls back to log-linear cubic hermite spline interpolation to compute the effective IC50, ensuring zero runtime crashes and 100% API availability."),

        ("Q10: What Machine Learning models are used, and what dataset were they trained on?",
         "We utilized Random Forest and Gradient Boosted decision tree ensembles trained on `zno_biocompatibility_master_10k.csv` (10,000 synthesized and curated experimental records across varied synthesis routes, cell lines, and coatings) and benchmarked against real-world MeOxNP academic datasets. The model achieves high accuracy in predicting multi-class risk levels (Low, Moderate, High)."),

        ("Q11: What features are passed into the ML prediction pipeline?",
         "Seven normalized features: (1) Core Size (nm), (2) Zeta Potential (mV), (3) Exposure Concentration (µg/mL), (4) Exposure Time (6, 12, 24, 48, 72 hours), (5) Synthesis Method (Hydrothermal, Sol-Gel, Green Synthesis, Chemical Precipitation), (6) Surface Coating (Bare, PEG, Chitosan, Silica), and (7) Biological Cell Line (HeLa, MCF-7, HEK293, etc.)."),

        ("Q12: How is the composite 'Toxicity Score' (0 to 100) calculated?",
         "The Toxicity Score is a weighted multi-biomarker index synthesized from: Viability deficit (40%), ROS elevation factor (25%), LDH membrane leakage (15%), Apoptosis percentage (15%), and Hemolysis (5%). A score of 0 represents complete biocompatibility, while 100 represents acute cell destruction."),

        # Category C: Backend Architecture & Database Design
        ("Q13: Describe the overall architecture of your backend application.",
         "The backend is constructed using Python 3.11 and the Flask framework adopting the Application Factory pattern (`create_app()` in `app_factory.py`). The application logic is segregated into 5 modular Blueprints: `main` (user research workflows), `auth` (session & JWT authentication), `admin` (supervisory console & DB explorer), `participants` (clinical study management), and `mobile` (RESTful API for the React Native client)."),

        ("Q14: How is data consistency maintained between the Web App and the Mobile App?",
         "Both Web and Mobile interfaces connect to the exact same centralized SQLite relational database (`nanosafe.db`) governed by SQLAlchemy ORM. The mobile app communicates via authenticated REST API endpoints (`/mobile/v1/*`), while the web app uses Flask route handlers. Any record inserted or updated on mobile immediately reflects on the web portal, and vice versa."),

        ("Q15: Explain the structure of your database schema. What are the key tables?",
         "The database consists of 16 normalized tables: `users` (credentials & profiles), `roles` (admin/user permissions), `history` (summary experiment records), `experiments` & `experiment_results` (detailed multi-dose raw assay readings), `study_participants` (clinical cohorts & demographics), `biological_samples` (specimen metadata), `sample_experiment_links` (many-to-many associations), `participant_consent_logs` (GCP compliance), and `audit_logs` (security traceability)."),

        ("Q16: How do you handle authentication securely across both Web and Mobile?",
         "For the Web App, authentication uses secure HTTP-only server-side session cookies protected by CSRF tokens (`Flask-WTF` meta tags). For the Mobile App, authentication utilizes stateless JSON Web Tokens (JWT) signed with HMAC-SHA256 containing user ID, role, and expiration, passed in the `Authorization: Bearer <token>` header and validated by our custom `@jwt_required` decorator."),

        ("Q17: How are user passwords secured in the database?",
         "Passwords are never stored in plaintext. They are hashed using `bcrypt` (or `pbkdf2:sha256`) with a unique cryptographic salt per user. Verification occurs through constant-time comparison (`verify_password_bcrypt`), defending against rainbow table attacks and timing analysis."),

        ("Q18: What is the purpose of the Security Audit Log (`audit_logs`) table?",
         "The `AuditLog` table enforces regulatory traceability (FDA 21 CFR Part 11 / ISO 14155). Every critical event—including user registration, password changes, experiment creation, sample linking, and consent status modifications—is logged with a timestamp, user ID, IP address, action code, and human-readable description."),

        # Category D: Mobile App & Cross-Platform Engineering
        ("Q19: What mobile technology was selected and why?",
         "We chose React Native with Expo SDK 57. React Native enables a truly native UI and high-performance rendering on both iOS and Android from a single JavaScript/JSX codebase. Expo provides robust tooling, native module bridging, and rapid development via Expo Go."),

        ("Q20: How does the mobile application dynamically connect to the backend server on local Wi-Fi?",
         "In `src/api/client.js`, the app dynamically parses the host IP from the Expo Go bundler connection (`Constants.expoConfig?.hostUri`). When running on a physical iPhone or Android device over Wi-Fi, it extracts the development machine's IP (e.g. `172.20.10.2`) and routes all Axios API calls to `http://172.20.10.2:5000/mobile/v1`, avoiding hardcoded localhost failures."),

        ("Q21: How did you fix the Expo SDK version incompatibility on iOS?",
         "On iOS, Expo Go strictly requires project SDK alignment with the installed store binary. We upgraded the mobile project from SDK 54 to SDK 57 (`expo@~57.0.31`, `react-native@0.86.3`, and `react@19.2.3`), updated all native dependencies using Expo's bundled native module registry, and resolved peer dependency constraints using `.npmrc` legacy resolution."),

        ("Q22: Why did the mobile navigation sidebar fail previously, and how did you resolve it?",
         "Previously, the drawer was rendered as an absolute sibling inside a `SafeAreaView`. On iOS, native `ScrollView`s and SVG canvas elements intercepted touch gestures, causing z-index stacking failures. We re-engineered `SidebarDrawer.js` using a native React Native `<Modal transparent>`, guaranteeing that the drawer renders on the highest window layer above all screen content, and added a responsive `<Menu size={22} />` button with touch hit-slop."),

        ("Q23: How are dose-response curve charts rendered on the mobile app?",
         "We built a custom SVG charting component (`DoseResponseCurveChart`) using `react-native-svg`. It computes mathematical viewbox coordinates dynamically from experimental doses and response values, drawing grid lines, data point circles, and smooth multi-segment polyline curves directly on the canvas without relying on heavy webview wrappers."),

        ("Q24: How does the mobile app manage user sessions offline or between restarts?",
         "The app uses `@react-native-async-storage/async-storage` combined with React Context (`AuthContext`). Upon successful login, the JWT access token and user metadata are serialized into local device storage. An Axios request interceptor attaches the bearer token to all outgoing requests, while a response interceptor automatically handles 401 expiration by resetting the session."),

        # Category E: Clinical Studies, Governance & Security
        ("Q25: What is the clinical purpose of the Study Participants and Biological Samples modules?",
         "These modules translate laboratory in-silico findings into clinical cohort trials. Researchers can register patient cohorts (e.g., Wound Care Cohort A, Dental Implant Cohort), record blood group, track ISO 14155 / Good Clinical Practice (GCP) informed consent, log cryopreserved biological specimens (Blood, Tissue, Saliva), and link them directly to specific experimental assays."),

        ("Q26: How does the Dose Simulator ('What-If Sandbox') differ from standard analysis?",
         "Standard analysis evaluates raw lab data provided via manual entry or 96-well CSV uploads. The Dose Simulator is an interactive predictive sandbox: researchers adjust sliders (ZnO concentration 0–100 µg/mL, core size, exposure time) and dropdowns (coating, synthesis method, cell line), and the system dynamically computes and predicts live viability, ROS, LDH, IC50, and ISO compliance in real time without running wet-lab assays."),

        ("Q27: How are scientific reports generated and exported?",
         "Reports are generated server-side using the Python `ReportLab` engine (`services/pdf_service.py`). It compiles experimental metadata, tabular dose readings, mathematical 4PL parameters, automated clinical safety suggestions, and compliance signatures into a downloadable PDF report matching international laboratory documentation standards."),

        ("Q28: What CSRF protection mechanism is implemented for asynchronous API calls?",
         "For the Web App, all asynchronous JavaScript `fetch()` calls pass the CSRF token in the `X-CSRFToken` request header retrieved dynamically from `<meta name=\"csrf-token\" content=\"{{ csrf_token() }}\">`. This protects state-changing endpoints from Cross-Site Request Forgery while allowing seamless real-time UI updates."),

        ("Q29: How is the database inspected without third-party desktop tools?",
         "We created two native inspection paths: (1) An in-app Web SQL Database Explorer (`/admin/database`) built into the Admin Panel that renders table schemas, record counts, and live row filtering; and (2) A lightweight terminal utility script (`python view_db.py [table_name]`) that prints ASCII table data directly in PowerShell/CMD."),

        ("Q30: What are the future enhancements planned for NanoSafe Analyzer?",
         "Future milestones include: (1) Integrating Deep Neural Networks (Graph Convolutional Networks, GCN) to model nanoparticle crystal lattice structures directly from SMILES chemical notations; (2) Adding Computer Vision (YOLO/U-Net) to automatically segment particle diameters from Transmission Electron Microscopy (TEM) micrographs; and (3) Cloud deployment on AWS/GCP with automated CI/CD pipelines.")
    ]

    for idx, (q, a) in enumerate(viva_qas, 1):
        story.append(Paragraph(f"<b>{q}</b>", q_style))
        story.append(Paragraph(a, a_style))
        if idx in [6, 12, 18, 24]:
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceBefore=4, spaceAfter=8))

    story.append(Spacer(1, 14))

    # ─────────────────────────────────────────────────────────────
    # SECTION 6: LIVE PRESENTATION SCRIPT & DEMO FLOW
    # ─────────────────────────────────────────────────────────────
    story.append(Paragraph("6. Live Presentation Script & Demonstration Roadmap", h1_style))
    story.append(Paragraph(
        "Use this structured script to present your project with confidence during your oral defense:", body_style
    ))

    story.append(Paragraph("<b>Phase 1: The 2-Minute Elevator Pitch</b>", h2_style))
    story.append(Paragraph(
        "<i>\"Respected examiner, traditional evaluation of nanoparticle toxicity relies on slow, expensive wet-lab cell assays that often take weeks. "
        "In our project, <b>NanoSafe Analyzer</b>, we have developed a comprehensive AI-powered biomedical software system that evaluates the biocompatibility "
        "of Zinc Oxide nanoparticles across mammalian cell lines in seconds.<br/>"
        "We achieve this by combining <b>4-Parameter Logistic non-linear curve fitting</b> to compute the IC50 value with a <b>Machine Learning classifier</b> "
        "trained on over 10,000 experimental records. The entire system is built with complete feature and database parity across both an enterprise <b>Web Application</b> "
        "and a native <b>Mobile App</b> built with React Native and Expo SDK 57, connected to a single relational SQLite database.\"</i>", body_style
    ))

    story.append(Paragraph("<b>Phase 2: Step-by-Step Live Demo Roadmap</b>", h2_style))
    demo_steps = [
        ("Step 1: Dashboard Overview", "Show the live KPI metrics on both Web (`/home`) and Mobile (`DashboardScreen`). Point out the identical active experiment counts, pass rate, and average viability."),
        ("Step 2: New Analysis (Dose-Response)", "Navigate to New Experiment. Enter sample doses (e.g., 10, 25, 50, 100 µg/mL). Click Calculate. Point to the generated 4PL curve, the calculated IC50, and the ISO 10993-5 pass/fail status."),
        ("Step 3: Real-Time Dose Simulator", "Open the Dose Simulator on your phone. Move the concentration slider and change coatings (e.g. Bare ZnO vs PEG-Coated). Explain how PEG suppresses toxicity and restores biocompatibility dynamically."),
        ("Step 4: History & Multi-Compare", "Show Experiment History. Filter by 'Safe' or 'High Risk'. Open the Compare screen to demonstrate overlaying multiple dose-response curves on a single chart."),
        ("Step 5: Database Parity Proof", "Open the SQL Database Explorer (`/admin/database` or `python view_db.py users`). Show that experiments created on your phone immediately exist in the SQLite database alongside web records."),
        ("Step 6: PDF Report Export", "Click 'Download PDF Report'. Open the generated PDF to show clinical suggestions, regulatory compliance stamps, and biomarker telemetry.")
    ]

    for s_title, s_desc in demo_steps:
        story.append(Paragraph(f"• <b>{s_title}:</b> {s_desc}", bullet_style))

    story.append(Spacer(1, 14))

    # Concluding Signature Block
    story.append(HRFlowable(width="100%", thickness=1, color=primary_color, spaceBefore=8, spaceAfter=10))
    story.append(Paragraph("<b>End of Comprehensive Examiner & Defense Guide</b><br/><i>NanoSafe Analyzer — Developed with Academic Rigor & Technical Excellence</i>", callout_text))

    # Build the PDF
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] Master PDF successfully generated at: {filename}")

if __name__ == '__main__':
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    downloads_dir = os.path.join(project_root, 'static', 'downloads')
    os.makedirs(downloads_dir, exist_ok=True)
    out_pdf = os.path.join(downloads_dir, 'NanoSafe_Project_Defense_Viva_Guide.pdf')
    build_pdf(out_pdf)
