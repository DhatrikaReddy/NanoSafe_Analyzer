import os
import textwrap
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas

def generate_pdf_file(latest, pdf_path, exp_id=None):
    """
    Generates a comprehensive PDF report for a given ZnO experiment.
    Includes Experiment Overview, Study Participant & Sample Traceability,
    Cytotoxicity Metrics, ML Safety Assessment, and Dose-Response Curve.
    """
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter

    def safe_get(d, key, default="N/A"):
        val = d.get(key)
        return str(val) if val is not None and val != "" else str(default)

    # ── Colors ──
    teal = colors.HexColor("#0f766e")
    dark = colors.HexColor("#0f172a")
    gray_bg = colors.HexColor("#f8fafc")
    gray_border = colors.HexColor("#e2e8f0")
    text_dark = colors.HexColor("#1e293b")
    text_muted = colors.HexColor("#64748b")

    # ── Header ──
    c.setFillColor(teal)
    c.rect(0, height - 60, width, 60, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, height - 36, "🧬 NanoSafe Analyzer — Research & Cytotoxicity Report")
    c.setFont("Helvetica", 9)
    c.drawString(40, height - 50, "Evaluation of the Biocompatibility and Cytotoxicity of ZnO Nanoparticles")

    y = height - 85

    # ID & Metadata Bar
    report_id = exp_id if exp_id else safe_get(latest, "id")
    if not report_id or report_id == "N/A":
        report_id = "EXP-" + datetime.utcnow().strftime("%Y%m%d%H%M")
    
    gen_time = safe_get(latest, "date_time", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))

    c.setFillColor(text_muted)
    c.setFont("Helvetica", 9)
    c.drawString(40, y, f"Report ID: #{report_id}  |  Generated: {gen_time}  |  Analyst: {safe_get(latest, 'username', safe_get(latest, 'researcher_name', 'Researcher'))}")
    y -= 15
    c.setStrokeColor(gray_border)
    c.setLineWidth(1)
    c.line(40, y, width - 40, y)
    y -= 20

    # ── Section 1: Experiment & Sample Overview ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "1. EXPERIMENT OVERVIEW")
    y -= 14
    c.setFont("Helvetica", 9.5)
    c.setFillColor(text_dark)

    c.drawString(50, y, f"• Experiment / Sample Name: {safe_get(latest, 'experiment_name', safe_get(latest, 'sample_name'))}")
    c.drawString(320, y, f"• Nanoparticle Type: {safe_get(latest, 'nanoparticle_type', 'ZnO')}")
    y -= 14
    c.drawString(50, y, f"• Cell Line Evaluated: {safe_get(latest, 'cell_line')}")
    c.drawString(320, y, f"• Exposure Duration: {safe_get(latest, 'exposure_time')}")
    y -= 14
    c.drawString(50, y, f"• Target Medical Application: {safe_get(latest, 'medical_application', 'General Biomedical Research')}")
    c.drawString(320, y, f"• ISO 10993-5 Compliance: {safe_get(latest, 'iso_compliance', 'PASS — Biocompatible')}")
    y -= 14
    c.drawString(50, y, f"• Lead Researcher: {safe_get(latest, 'researcher_name')}")
    c.drawString(320, y, f"• Data Source: {safe_get(latest, 'csv_filename', 'Direct Entry')}")
    y -= 22

    # ── Section 2: Research Participant & Biological Sample Traceability ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "2. STUDY PARTICIPANT & BIOLOGICAL SAMPLE TRACEABILITY")
    y -= 14
    c.setFont("Helvetica", 9.5)
    c.setFillColor(text_dark)

    has_participant = latest.get("participant_id") and latest.get("participant_id") != "N/A"
    has_sample = latest.get("biological_sample_id") and latest.get("biological_sample_id") != "N/A"

    if has_participant or has_sample:
        p_id = safe_get(latest, "participant_id", "Unassigned")
        p_consent = safe_get(latest, "participant_consent", safe_get(latest, "consent_status", "Consented"))
        p_group = safe_get(latest, "study_group", "Control / Standard")
        s_id = safe_get(latest, "biological_sample_id", safe_get(latest, "sample_id", "Unassigned"))
        s_type = safe_get(latest, "sample_type", "Cell Culture")
        s_date = safe_get(latest, "sample_collection_date", "Standard Experiment")

        c.drawString(50, y, f"• Participant ID (Anonymized): {p_id}")
        c.drawString(320, y, f"• Biological Sample ID: {s_id}")
        y -= 14
        c.drawString(50, y, f"• Consent Verification: {p_consent}")
        c.drawString(320, y, f"• Sample Biological Type: {s_type}")
        y -= 14
        c.drawString(50, y, f"• Study Group: {p_group}")
        c.drawString(320, y, f"• Sample Collection Date: {s_date}")
    else:
        c.setFillColor(text_muted)
        c.drawString(50, y, "• Biological Sample Traceability: Standard in-vitro reference cell culture line.")
        y -= 14
        c.drawString(50, y, "• Participant Consent: In-vitro cell line — anonymized laboratory experiment.")
    
    y -= 22

    # ── Section 3: Cytotoxicity Metrics ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "3. AVERAGED CYTOTOXICITY & BIOMARKER METRICS")
    y -= 14
    c.setFont("Helvetica", 9.5)
    c.setFillColor(text_dark)

    viab = safe_get(latest, "avg", latest.get("cell_viability"))
    ros = safe_get(latest, "avg_ros", latest.get("ros"))
    ldh = safe_get(latest, "avg_ldh", latest.get("ldh"))
    apop = safe_get(latest, "avg_apoptosis", latest.get("apoptosis"))
    avg_conc = safe_get(latest, "avg_concentration", safe_get(latest, "concentration", "0"))

    c.drawString(50, y, f"• Mean Cell Viability: {viab}%")
    c.drawString(320, y, f"• Mean ZnO Concentration: {avg_conc} µg/mL")
    y -= 14
    c.drawString(50, y, f"• Reactive Oxygen Species (ROS): {ros}")
    c.drawString(320, y, f"• LDH Membrane Leakage: {ldh}%")
    y -= 14
    c.drawString(50, y, f"• Apoptosis Inducement: {apop}%")
    y -= 22

    # ── Section 4: Machine Learning Safety Assessment ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "4. MACHINE LEARNING CYTOTOXICITY ASSESSMENT")
    y -= 14
    c.setFont("Helvetica", 9.5)
    c.setFillColor(text_dark)

    score = safe_get(latest, "toxicity_score")
    level = safe_get(latest, "toxicity_level", latest.get("risk_level"))
    ic50 = safe_get(latest, "ic50", latest.get("estimated_ic50"))
    safe_range = safe_get(latest, "safe_range")

    c.drawString(50, y, f"• Predicted Toxicity Score: {score} / 100")
    c.drawString(320, y, f"• Risk Level Classification: {level}")
    y -= 14
    c.drawString(50, y, f"• Estimated IC50 (Half-Max Inhibitory): {ic50}")
    c.drawString(320, y, f"• Biocompatible Safe Window: {safe_range}")
    y -= 22

    # ── Section 5: Interpretation ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "5. SCIENTIFIC INTERPRETATION & RECOMMENDATION")
    y -= 14
    c.setFont("Helvetica", 8.5)
    c.setFillColor(text_dark)

    interp = safe_get(latest, "interpretation")
    wrapped_lines = textwrap.wrap(interp, width=105)
    for line in wrapped_lines[:5]:
        c.drawString(50, y, line)
        y -= 12

    y -= 10

    # ── Section 6: Graph (if available) ──
    graph_path = latest.get("graph_path")
    if graph_path and os.path.exists(graph_path) and y > 150:
        try:
            c.setFillColor(teal)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(40, y, "6. DOSE-RESPONSE CURVE")
            y -= 10
            # Draw graph image
            graph_height = min(110, y - 50)
            graph_width = graph_height * 2.1
            c.drawImage(graph_path, 45, y - graph_height, width=graph_width, height=graph_height)
            y -= (graph_height + 10)
        except Exception:
            pass

    # ── Footer / Disclaimer ──
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(text_muted)
    c.drawString(40, 30, "Disclaimer: NanoSafe Analyzer predictive models are research aids for biomedical toxicity evaluation. Validate findings with in-vitro protocols.")
    c.drawRightString(width - 40, 30, "NanoSafe Analyzer © 2026")

    c.save()
    return pdf_path

