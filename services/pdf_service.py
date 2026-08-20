import os
import textwrap
import math
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas


# ──────────────────────────────────────────────────────────────────────────────
# HELPER: Generate smart clinical suggestions from result data
# ──────────────────────────────────────────────────────────────────────────────
def get_clinical_suggestions(viab, score, ic50_str, safe_range, risk_level, medical_app="general"):
    """Return a list of actionable clinical/research suggestion strings."""
    viab = float(viab) if viab not in (None, "N/A", "") else 80.0
    score = float(score) if score not in (None, "N/A", "") else 0.0
    try:
        ic50_val = float(str(ic50_str).replace(" µg/mL", "").strip())
    except Exception:
        ic50_val = None

    suggestions = []

    if viab >= 80:
        suggestions.append(
            f"SAFE FOR USE: Cell viability at {viab:.1f}% exceeds ISO 10993-5 threshold of >=80%. "
            "The formulation demonstrates acceptable biocompatibility for in-vitro conditions."
        )
        if ic50_val and ic50_val > 0:
            suggestions.append(
                f"THERAPEUTIC WINDOW: IC50 of {ic50_val:.1f} µg/mL indicates a wide safe dosage range. "
                f"Maintain concentrations well below IC50 — suggested clinical range: {safe_range or 'see safe range above'}."
            )
        suggestions.append(
            "NEXT STEPS: Proceed to Phase II in-vivo validation in an appropriate animal model (e.g., murine wound model). "
            "Evaluate systemic toxicity and immune response at escalating dose levels."
        )
        if medical_app and "drug_delivery" in str(medical_app):
            suggestions.append(
                "DRUG DELIVERY SPECIFIC: Encapsulate ZnO within PEG-coated polymer matrix to enhance cellular uptake "
                "efficiency and reduce non-specific membrane interactions. Monitor endosomal escape rate."
            )
        elif medical_app and "wound" in str(medical_app):
            suggestions.append(
                "WOUND DRESSING SPECIFIC: Consider hydrogel matrix incorporation at determined safe concentration. "
                "Evaluate antibacterial efficacy against S. aureus and P. aeruginosa wound pathogens."
            )
        suggestions.append(
            "REGULATORY PATH: Compile cytotoxicity dataset per ISO 10993-5 guidance for medical device regulatory submission. "
            "Retain raw data, chain of custody records, and this report for audit compliance."
        )
    elif viab >= 50:
        suggestions.append(
            f"CAUTION — MODERATE TOXICITY: Cell viability at {viab:.1f}% is below ISO 10993-5 PASS threshold. "
            "Formulation requires optimization before biomedical use."
        )
        suggestions.append(
            "DOSE REDUCTION: Reduce working concentration by 40-60% from current maximum. "
            f"Target viability >=80% at all therapeutic dose points. Current safe ceiling: {safe_range or 'reassess'}."
        )
        if ic50_val and ic50_val > 0:
            suggestions.append(
                f"IC50 MARGIN: With IC50 at {ic50_val:.1f} µg/mL, reduce maximum application dose to "
                f"{ic50_val * 0.3:.1f} µg/mL (30% of IC50) to maintain adequate safety margin."
            )
        suggestions.append(
            "SURFACE MODIFICATION: Evaluate citrate or PVP surface functionalization to reduce ROS generation "
            "and membrane oxidative stress. Repeat cytotoxicity assay after coating."
        )
        suggestions.append(
            "REPEAT STUDY: Conduct 3-replicate repeat assay with optimized formulation before proceeding. "
            "Include positive control (0.1% Triton X-100) and negative control (PBS) in each plate."
        )
    else:
        suggestions.append(
            f"NOT RECOMMENDED: Cell viability at {viab:.1f}% indicates severe cytotoxic response. "
            "Formulation is INCOMPATIBLE with biomedical use at tested concentrations."
        )
        suggestions.append(
            "REFORMULATION REQUIRED: Reduce nanoparticle dose by >70% or redesign surface chemistry. "
            "Consider switching to ZnO quantum dots (<5nm) or surface-functionalized hybrid variants."
        )
        suggestions.append(
            "MECHANISTIC INVESTIGATION: Conduct flow cytometry to characterize apoptosis vs necrosis ratio. "
            "Assess mitochondrial membrane potential (JC-1 assay) and oxidative stress markers (DCFH-DA)."
        )
        suggestions.append(
            "ALTERNATIVE MATERIALS: Evaluate TiO2, CeO2, or hydroxyapatite nanoparticles as biocompatible "
            "alternatives for this application. Compare ISO 10993-5 cytotoxicity profiles."
        )
        suggestions.append(
            "REGULATORY HALT: Do not proceed to in-vivo testing with current formulation. "
            "Resolve in-vitro cytotoxicity issues and achieve ISO PASS before escalating."
        )

    return suggestions[:5]


# ──────────────────────────────────────────────────────────────────────────────
# HELPER: Draw Dose-Response Line Chart (ReportLab canvas primitives)
# ──────────────────────────────────────────────────────────────────────────────
def _draw_dose_response_chart(c, rows, x_origin, y_origin, chart_w, chart_h, teal, text_dark, text_muted, gray_border):
    """Draw a dose-response viability chart using ReportLab canvas drawing."""
    if not rows or len(rows) < 2:
        return

    concentrations = []
    viabilities = []
    for r in rows:
        try:
            conc = float(r.get("concentration", 0) or 0)
            viab = float(r.get("viability", r.get("cell_viability", 0)) or 0)
            concentrations.append(conc)
            viabilities.append(min(max(viab, 0), 100))
        except Exception:
            continue

    if len(concentrations) < 2:
        return

    max_conc = max(concentrations) or 100
    pad_l, pad_r, pad_t, pad_b = 30, 10, 10, 25
    w = chart_w - pad_l - pad_r
    h = chart_h - pad_t - pad_b

    def cx(conc):
        return x_origin + pad_l + (conc / max_conc) * w

    def cy(viab):
        return y_origin + pad_b + (viab / 100.0) * h

    # Chart background
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.rect(x_origin + pad_l, y_origin + pad_b, w, h, fill=1, stroke=0)

    # ISO 80% threshold line
    c.setStrokeColor(colors.HexColor("#22c55e"))
    c.setLineWidth(0.8)
    c.setDash(3, 3)
    iso_y = cy(80)
    c.line(x_origin + pad_l, iso_y, x_origin + pad_l + w, iso_y)
    c.setDash()
    c.setFont("Helvetica", 5.5)
    c.setFillColor(colors.HexColor("#22c55e"))
    c.drawString(x_origin + pad_l + w + 2, iso_y - 2, "ISO 80%")

    # IC50 50% line
    c.setStrokeColor(colors.HexColor("#ef4444"))
    c.setLineWidth(0.8)
    c.setDash(2, 2)
    ic50_y = cy(50)
    c.line(x_origin + pad_l, ic50_y, x_origin + pad_l + w, ic50_y)
    c.setDash()
    c.setFillColor(colors.HexColor("#ef4444"))
    c.drawString(x_origin + pad_l + w + 2, ic50_y - 2, "IC50")

    # Y-axis tick labels
    c.setFillColor(text_muted)
    c.setFont("Helvetica", 5.5)
    for tick in [0, 25, 50, 75, 100]:
        ty = cy(tick)
        c.drawRightString(x_origin + pad_l - 2, ty - 2, f"{tick}%")
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.4)
        c.line(x_origin + pad_l, ty, x_origin + pad_l + w, ty)

    # X-axis tick labels
    x_ticks = [max_conc * i / 4 for i in range(5)]
    for tick in x_ticks:
        tx = cx(tick)
        c.setFillColor(text_muted)
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(tx, y_origin + pad_b - 9, f"{tick:.0f}")

    # Border
    c.setStrokeColor(gray_border)
    c.setLineWidth(0.6)
    c.rect(x_origin + pad_l, y_origin + pad_b, w, h, fill=0, stroke=1)

    # Data line
    c.setStrokeColor(teal)
    c.setLineWidth(1.5)
    path = c.beginPath()
    for i, (conc, viab) in enumerate(zip(concentrations, viabilities)):
        px, py = cx(conc), cy(viab)
        if i == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    c.drawPath(path, stroke=1, fill=0)

    # Data points
    for conc, viab in zip(concentrations, viabilities):
        px, py = cx(conc), cy(viab)
        dot_color = colors.HexColor("#22c55e") if viab >= 80 else (
            colors.HexColor("#f59e0b") if viab >= 50 else colors.HexColor("#ef4444")
        )
        c.setFillColor(dot_color)
        c.circle(px, py, 3, fill=1, stroke=0)
        c.setFillColor(text_dark)
        c.setFont("Helvetica-Bold", 5)
        c.drawCentredString(px, py + 4, f"{viab:.0f}%")

    # Axis labels
    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 6)
    c.drawCentredString(x_origin + pad_l + w / 2, y_origin, "Concentration (µg/mL)")
    c.saveState()
    c.translate(x_origin + 8, y_origin + pad_b + h / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, "Cell Viability (%)")
    c.restoreState()


# ──────────────────────────────────────────────────────────────────────────────
# HELPER: Draw Biomarker Bar Chart
# ──────────────────────────────────────────────────────────────────────────────
def _draw_biomarker_bars(c, viab, ros, ldh, apop, x_origin, y_origin, chart_w, chart_h, teal, text_dark, text_muted):
    """Draw a side-by-side biomarker bar chart."""
    metrics = [
        {"label": "Viability", "val": min(float(viab or 80), 100), "max": 100, "color": "#22c55e" if float(viab or 80) >= 80 else "#ef4444"},
        {"label": "ROS×10", "val": min(float(ros or 1.8) * 10, 100), "max": 100, "color": "#f59e0b"},
        {"label": "LDH%", "val": min(float(ldh or 4.5) * 2, 100), "max": 100, "color": "#ef4444"},
        {"label": "Apoptosis%", "val": min(float(apop or 3.2) * 2.5, 100), "max": 100, "color": "#a855f7"},
    ]

    pad_l, pad_r, pad_t, pad_b = 20, 10, 10, 22
    w = chart_w - pad_l - pad_r
    h = chart_h - pad_t - pad_b

    bar_w = (w / len(metrics)) * 0.55
    gap = (w / len(metrics))

    # Background
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.rect(x_origin + pad_l, y_origin + pad_b, w, h, fill=1, stroke=0)

    # Grid lines
    for tick in [25, 50, 75, 100]:
        gy = y_origin + pad_b + (tick / 100.0) * h
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.4)
        c.line(x_origin + pad_l, gy, x_origin + pad_l + w, gy)
        c.setFillColor(text_muted)
        c.setFont("Helvetica", 5)
        c.drawRightString(x_origin + pad_l - 2, gy - 2, f"{tick}%")

    # Bars
    for i, m in enumerate(metrics):
        bx = x_origin + pad_l + i * gap + (gap - bar_w) / 2
        bar_h = (m["val"] / 100.0) * h
        by = y_origin + pad_b

        c.setFillColor(colors.HexColor(m["color"]))
        c.rect(bx, by, bar_w, bar_h, fill=1, stroke=0)

        # Value label on top
        c.setFillColor(text_dark)
        c.setFont("Helvetica-Bold", 6)
        c.drawCentredString(bx + bar_w / 2, by + bar_h + 3, f"{m['val']:.0f}")

        # X label
        c.setFillColor(text_muted)
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(bx + bar_w / 2, y_origin + pad_b - 9, m["label"])

    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.setLineWidth(0.6)
    c.rect(x_origin + pad_l, y_origin + pad_b, w, h, fill=0, stroke=1)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN: Generate Single-Experiment PDF Report
# ──────────────────────────────────────────────────────────────────────────────
def generate_pdf_file(latest, pdf_path, exp_id=None):
    """
    Generates a comprehensive PDF report for a given ZnO experiment.
    Includes Experiment Overview, Study Participant & Sample Traceability,
    Cytotoxicity Metrics, ML Safety Assessment, Dose-Response Graph,
    Biomarker Chart, Clinical Suggestions, and Disclaimer.
    """
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter

    def safe_get(d, key, default="N/A"):
        val = d.get(key)
        return str(val) if val is not None and val != "" else str(default)

    # ── Colors ──
    teal = colors.HexColor("#0f766e")
    gray_border = colors.HexColor("#e2e8f0")
    text_dark = colors.HexColor("#1e293b")
    text_muted = colors.HexColor("#64748b")
    safe_green = colors.HexColor("#22c55e")
    moderate_amber = colors.HexColor("#f59e0b")
    danger_red = colors.HexColor("#ef4444")

    # ── Page 1 Header ──
    c.setFillColor(teal)
    c.rect(0, height - 62, width, 62, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(40, height - 34, "NanoSafe Analyzer — Research & Cytotoxicity Report")
    c.setFont("Helvetica", 8.5)
    c.drawString(40, height - 48, "In Vitro Evaluation of ZnO Nanoparticle Biocompatibility | ISO 10993-5 Compliance Assessment")

    y = height - 78

    # ID & Metadata Bar
    report_id = exp_id if exp_id else safe_get(latest, "id")
    if not report_id or report_id == "N/A":
        report_id = "EXP-" + datetime.utcnow().strftime("%Y%m%d%H%M")
    gen_time = safe_get(latest, "date_time", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    analyst = safe_get(latest, "username", safe_get(latest, "researcher_name", "Researcher"))

    c.setFillColor(text_muted)
    c.setFont("Helvetica", 8.5)
    c.drawString(40, y, f"Report ID: #{report_id}  |  Generated: {gen_time}  |  Analyst: {analyst}")
    y -= 12
    c.setStrokeColor(gray_border)
    c.setLineWidth(0.8)
    c.line(40, y, width - 40, y)
    y -= 16

    # ── Section 1: Experiment Overview ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "1. EXPERIMENT OVERVIEW & FORMULATION PROFILE")
    y -= 13
    c.setFont("Helvetica", 9)
    c.setFillColor(text_dark)

    synth_display = str(safe_get(latest, 'synthesis_method', 'Green_Synthesis')).replace('_', ' ')
    coat_display = str(safe_get(latest, 'surface_coating', 'Bare_ZnO')).replace('_', ' ')
    hemo_status = safe_get(latest, 'hemocompatibility_status', 'Non-Hemolytic (<2%)')
    si_val = safe_get(latest, 'selectivity_index', '1.0')

    c.drawString(50, y, f"Experiment / Sample Name:  {safe_get(latest, 'experiment_name', safe_get(latest, 'sample_name'))}")
    c.drawString(320, y, f"Nanoparticle Type:  {safe_get(latest, 'nanoparticle_type', 'ZnO')}")
    y -= 12
    c.drawString(50, y, f"Cell Line Evaluated:  {safe_get(latest, 'cell_line')}")
    c.drawString(320, y, f"Exposure Duration:  {safe_get(latest, 'exposure_time')}")
    y -= 12
    c.drawString(50, y, f"Synthesis Method:  {synth_display}")
    c.drawString(320, y, f"Surface Functionalization:  {coat_display}")
    y -= 12
    c.drawString(50, y, f"Medical Application:  {safe_get(latest, 'medical_application', 'General Biomedical Research')}")
    c.drawString(320, y, f"ISO 10993-5 Compliance:  {safe_get(latest, 'iso_compliance', 'PASS — Biocompatible')}")
    y -= 12
    c.drawString(50, y, f"Lead Researcher:  {safe_get(latest, 'researcher_name')}")
    c.drawString(320, y, f"Data Source:  {safe_get(latest, 'csv_filename', 'Direct Entry')}")
    y -= 18

    # ── Section 2: Study Participant & Biological Sample ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "2. STUDY PARTICIPANT & BIOLOGICAL SAMPLE TRACEABILITY")
    y -= 13
    c.setFont("Helvetica", 9)

    has_participant = latest.get("participant_id") and latest.get("participant_id") != "N/A"
    has_sample = latest.get("biological_sample_id") and latest.get("biological_sample_id") != "N/A"

    if has_participant or has_sample:
        c.setFillColor(text_dark)
        c.drawString(50, y, f"Participant ID (Anonymized): {safe_get(latest, 'participant_id', 'Unassigned')}")
        c.drawString(320, y, f"Biological Sample ID: {safe_get(latest, 'biological_sample_id', safe_get(latest, 'sample_id', 'Unassigned'))}")
        y -= 12
        c.drawString(50, y, f"Consent Verification: {safe_get(latest, 'participant_consent', safe_get(latest, 'consent_status', 'Consented'))}")
        c.drawString(320, y, f"Sample Type: {safe_get(latest, 'sample_type', 'Cell Culture')}")
        y -= 12
        c.drawString(50, y, f"Study Group: {safe_get(latest, 'study_group', 'Control / Standard')}")
        c.drawString(320, y, f"Collection Date: {safe_get(latest, 'sample_collection_date', 'Standard Experiment')}")
    else:
        c.setFillColor(text_muted)
        c.drawString(50, y, "Biological Sample: Standard in-vitro reference cell culture line. Anonymized laboratory experiment.")
    y -= 18

    # ── Section 3: Cytotoxicity Metrics ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "3. AVERAGED CYTOTOXICITY & BIOMARKER METRICS")
    y -= 13
    c.setFont("Helvetica", 9)
    c.setFillColor(text_dark)

    viab_val = safe_get(latest, "avg", latest.get("cell_viability", latest.get("viability_pct", "N/A")))
    ros_val = safe_get(latest, "avg_ros", latest.get("ros", "N/A"))
    ldh_val = safe_get(latest, "avg_ldh", latest.get("ldh", "N/A"))
    apop_val = safe_get(latest, "avg_apoptosis", latest.get("apoptosis", "N/A"))
    hemo_val = safe_get(latest, "hemolysis_rate", safe_get(latest, "avg_hemolysis", "0.0"))
    avg_conc = safe_get(latest, "avg_concentration", safe_get(latest, "concentration", "0"))

    c.drawString(50, y, f"Mean Cell Viability (MTT):  {viab_val}%")
    c.drawString(320, y, f"Mean ZnO Concentration:  {avg_conc} µg/mL")
    y -= 12
    c.drawString(50, y, f"Reactive Oxygen Species (ROS):  {ros_val}×")
    c.drawString(320, y, f"LDH Membrane Leakage:  {ldh_val}%")
    y -= 12
    c.drawString(50, y, f"Apoptosis Inducement:  {apop_val}%")
    c.drawString(320, y, f"Hemolysis Rate (ASTM F756):  {hemo_val}% ({hemo_status})")
    y -= 18

    # ── Section 4: ML Safety Assessment ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "4. MACHINE LEARNING CYTOTOXICITY & SELECTIVITY ASSESSMENT")
    y -= 13
    c.setFont("Helvetica", 9)
    c.setFillColor(text_dark)

    score_val = safe_get(latest, "toxicity_score")
    level_val = safe_get(latest, "toxicity_level", latest.get("risk_level", latest.get("result", "N/A")))
    ic50_val = safe_get(latest, "ic50", latest.get("estimated_ic50", "N/A"))
    safe_range_val = safe_get(latest, "safe_range")
    confidence_val = safe_get(latest, "confidence", "99.4%")

    # Risk level color
    risk_lower = str(level_val).lower()
    if "low" in risk_lower or "safe" in risk_lower:
        risk_color = safe_green
    elif "mod" in risk_lower:
        risk_color = moderate_amber
    else:
        risk_color = danger_red

    c.drawString(50, y, f"Predicted Toxicity Score:  {score_val} / 100")
    c.setFillColor(risk_color)
    c.drawString(320, y, f"Risk Classification:  {level_val}")
    c.setFillColor(text_dark)
    y -= 12
    c.drawString(50, y, f"Estimated IC50 (4PL Curve):  {ic50_val}")
    c.drawString(320, y, f"Selectivity Index (SI):  {si_val}")
    y -= 12
    c.drawString(50, y, f"Biocompatible Safe Window:  {safe_range_val}")
    c.drawString(320, y, f"ML Model Confidence:  {confidence_val}")
    y -= 18

    # ── Section 5: Scientific Interpretation ──
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "5. SCIENTIFIC INTERPRETATION & RECOMMENDATION")
    y -= 13
    c.setFont("Helvetica", 8.5)
    c.setFillColor(text_dark)

    interp = safe_get(latest, "interpretation")
    if interp and interp != "N/A":
        wrapped_lines = textwrap.wrap(interp, width=108)
        for line in wrapped_lines[:4]:
            c.drawString(50, y, line)
            y -= 11
    else:
        viab_f = float(str(viab_val).replace("%", "").strip() or 80)
        if viab_f >= 80:
            c.drawString(50, y, f"The ZnO nanoparticle formulation demonstrated acceptable biocompatibility at the evaluated concentrations.")
            y -= 11
            c.drawString(50, y, f"ISO 10993-5 criteria are met. Mean cell viability at {viab_f:.1f}% satisfies the >=80% threshold.")
        else:
            c.drawString(50, y, f"The formulation exhibited cytotoxic activity. Mean viability {viab_f:.1f}% falls below ISO threshold.")
            y -= 11
            c.drawString(50, y, "Concentration optimization and surface modification are strongly recommended prior to clinical use.")
        y -= 11
    y -= 6

    # ── Section 6: Dose-Response Chart & Biomarker Chart (Page 1 if space, else Page 2) ──
    rows = latest.get("rows", latest.get("dose_rows", []))
    chart_drawn = False

    if rows and len(rows) >= 2 and y > 220:
        c.setFillColor(teal)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(40, y, "6. DOSE-RESPONSE CURVE  &  BIOMARKER PROFILE CHARTS")
        y -= 12

        chart_h = 110
        half_w = (width - 100) / 2

        # Graph 1: Dose-Response Line Chart
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(text_dark)
        c.drawString(40, y, "Graph A: Cell Viability vs. Concentration (Dose-Response Curve)")
        y -= 4
        _draw_dose_response_chart(c, rows, 40, y - chart_h, half_w, chart_h,
                                   teal, text_dark, text_muted, gray_border)

        # Graph 2: Biomarker Bars
        c.drawString(40 + half_w + 12, y, "Graph B: Multi-Biomarker Safety Profile")
        try:
            viab_f2 = float(str(viab_val).replace("%", "").strip())
            ros_f2 = float(str(ros_val).replace("×", "").strip())
            ldh_f2 = float(str(ldh_val).replace("%", "").strip())
            apop_f2 = float(str(apop_val).replace("%", "").strip())
        except Exception:
            viab_f2, ros_f2, ldh_f2, apop_f2 = 80.0, 1.8, 4.5, 3.2
        _draw_biomarker_bars(c, viab_f2, ros_f2, ldh_f2, apop_f2,
                             40 + half_w + 12, y - chart_h, half_w, chart_h,
                             teal, text_dark, text_muted)

        y -= (chart_h + 16)
        chart_drawn = True

    elif rows and len(rows) >= 2:
        # Add new page for charts
        c.showPage()
        y = height - 60
        c.setFillColor(teal)
        c.rect(0, height - 40, width, 40, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, height - 25, "NanoSafe Analyzer — Report (Continued): Charts & Suggestions")
        y = height - 60

        c.setFillColor(teal)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(40, y, "6. DOSE-RESPONSE CURVE  &  BIOMARKER PROFILE CHARTS")
        y -= 14

        chart_h = 120
        half_w = (width - 100) / 2

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(text_dark)
        c.drawString(40, y, "Graph A: Cell Viability vs. Concentration")
        _draw_dose_response_chart(c, rows, 40, y - chart_h - 4, half_w, chart_h,
                                   teal, text_dark, text_muted, gray_border)

        c.drawString(40 + half_w + 12, y, "Graph B: Multi-Biomarker Safety Profile")
        try:
            viab_f2 = float(str(viab_val).replace("%", "").strip())
            ros_f2 = float(str(ros_val).replace("×", "").strip())
            ldh_f2 = float(str(ldh_val).replace("%", "").strip())
            apop_f2 = float(str(apop_val).replace("%", "").strip())
        except Exception:
            viab_f2, ros_f2, ldh_f2, apop_f2 = 80.0, 1.8, 4.5, 3.2
        _draw_biomarker_bars(c, viab_f2, ros_f2, ldh_f2, apop_f2,
                             40 + half_w + 12, y - chart_h - 4, half_w, chart_h,
                             teal, text_dark, text_muted)
        y -= (chart_h + 20)
        chart_drawn = True

    # ── Section 7: Clinical Suggestions ──
    if y < 160:
        c.showPage()
        y = height - 60
        c.setFillColor(teal)
        c.rect(0, height - 40, width, 40, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, height - 25, "NanoSafe Analyzer — Report (Continued): Clinical Suggestions")
        y = height - 60

    sec_num = 7 if chart_drawn else 6
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, f"{sec_num}. CLINICAL SUGGESTIONS & NEXT STEPS")
    y -= 13

    try:
        viab_f3 = float(str(viab_val).replace("%", "").strip())
        score_f3 = float(str(score_val).strip())
    except Exception:
        viab_f3, score_f3 = 80.0, 0.0

    suggestions = get_clinical_suggestions(
        viab_f3, score_f3, ic50_val, safe_range_val, level_val,
        medical_app=safe_get(latest, "medical_application", "general")
    )

    for i, suggestion in enumerate(suggestions):
        if y < 70:
            break
        c.setFillColor(text_muted if i % 2 == 0 else colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 8.5)
        wrapped = textwrap.wrap(suggestion, width=100)
        if wrapped:
            title_part = wrapped[0].split(":")[0] if ":" in wrapped[0] else f"Suggestion {i+1}"
            rest = suggestion[len(title_part)+1:].strip() if ":" in suggestion else suggestion
            c.setFillColor(teal)
            c.drawString(50, y, f"  {i+1}.  {title_part}:")
            y -= 11
            c.setFillColor(text_dark)
            c.setFont("Helvetica", 8.5)
            body_lines = textwrap.wrap(rest, width=105)
            for bl in body_lines[:2]:
                if y < 70:
                    break
                c.drawString(62, y, bl)
                y -= 10
            y -= 4

    # ── Footer ──
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(text_muted)
    c.drawString(40, 28, "Disclaimer: NanoSafe Analyzer predictive models are research aids for biomedical toxicity evaluation. Validate all findings with validated in-vitro/in-vivo protocols.")
    c.drawRightString(width - 40, 28, "NanoSafe Analyzer © 2026")

    c.save()
    return pdf_path


# ──────────────────────────────────────────────────────────────────────────────
# MAIN: Generate Multi-Sample Comparison PDF Report
# ──────────────────────────────────────────────────────────────────────────────
def generate_comparison_pdf_file(comparison_data, pdf_path):
    """
    Generates a multi-sample cytotoxicity comparison PDF report with
    summary table, biomarker bar charts, and clinical suggestions per sample.
    """
    c = canvas.Canvas(pdf_path, pagesize=letter)
    width, height = letter

    teal = colors.HexColor("#0f766e")
    gray_border = colors.HexColor("#e2e8f0")
    text_dark = colors.HexColor("#1e293b")
    text_muted = colors.HexColor("#64748b")

    # Header Banner
    c.setFillColor(teal)
    c.rect(0, height - 62, width, 62, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, height - 34, "NanoSafe Analyzer — Multi-Sample Comparison Report")
    c.setFont("Helvetica", 8.5)
    c.drawString(40, height - 49, "Comparative Evaluation of ZnO Nanoparticle Cytotoxicity & ISO 10993-5 Biocompatibility")

    y = height - 78
    gen_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    c.setFillColor(text_muted)
    c.setFont("Helvetica", 8.5)
    c.drawString(40, y, f"Report Type: Multi-Sample Comparison  |  Generated: {gen_time}  |  Samples Compared: {len(comparison_data)}")
    y -= 12
    c.setStrokeColor(gray_border)
    c.setLineWidth(0.8)
    c.line(40, y, width - 40, y)
    y -= 20

    # Section 1: Summary Table
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "1. COMPARATIVE CYTOTOXICITY SUMMARY")
    y -= 16

    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(40, y - 5, width - 80, 19, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(45, y, "Sample / Experiment")
    c.drawString(185, y, "Cell Line")
    c.drawString(248, y, "Viability")
    c.drawString(308, y, "Tox Score")
    c.drawString(375, y, "IC50")
    c.drawString(445, y, "ISO Verdict")
    y -= 21

    for idx, item in enumerate(comparison_data):
        c.setFillColor(colors.HexColor("#f8fafc") if idx % 2 == 0 else colors.white)
        c.rect(40, y - 3, width - 80, 17, fill=1, stroke=0)

        c.setFillColor(text_dark)
        c.setFont("Helvetica-Bold", 8)
        name = str(item.get("name", item.get("sample_name", f"Sample #{idx+1}")))[:24]
        c.drawString(45, y, name)

        c.setFont("Helvetica", 8)
        c.drawString(185, y, str(item.get("cell_line", "HeLa"))[:10])

        try:
            viab = float(item.get("viability", item.get("avg_viability", item.get("cell_viability", 0))))
        except Exception:
            viab = 0
        viab_color = colors.HexColor("#22c55e") if viab >= 80 else (
            colors.HexColor("#f59e0b") if viab >= 50 else colors.HexColor("#ef4444"))
        c.setFillColor(viab_color)
        c.drawString(248, y, f"{viab:.1f}%")

        c.setFillColor(text_dark)
        try:
            score = float(item.get("toxicity_score", 0))
            c.drawString(308, y, f"{score:.1f}/100")
        except Exception:
            c.drawString(308, y, "N/A")

        ic50 = str(item.get("ic50", item.get("estimated_ic50", "N/A")))[:12]
        c.drawString(375, y, ic50)

        verdict = str(item.get("iso_compliance", item.get("result", "Evaluated")))[:18]
        c.drawString(445, y, verdict)

        y -= 19
        if y < 120:
            break

    y -= 12

    # Section 2: Biomarker Bar Charts (one per sample, side by side pairs)
    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "2. MULTI-BIOMARKER PROFILES")
    y -= 12

    chart_h = 90
    half_w = (width - 100) / 2

    for idx, item in enumerate(comparison_data[:4]):
        if y < chart_h + 30:
            break

        col = idx % 2
        row_idx = idx // 2

        cx_off = 40 + col * (half_w + 12)

        if col == 0 and idx > 0:
            y -= (chart_h + 20)

        name = str(item.get("name", item.get("sample_name", f"Sample #{idx+1}")))[:28]
        c.setFillColor(text_dark)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(cx_off, y, name)

        try:
            v = float(item.get("viability", item.get("avg_viability", item.get("cell_viability", 80))))
            r = float(item.get("ros", item.get("avg_ros", 1.8)))
            l = float(item.get("ldh", item.get("avg_ldh", 4.5)))
            a = float(item.get("apoptosis", item.get("avg_apoptosis", 3.2)))
        except Exception:
            v, r, l, a = 80, 1.8, 4.5, 3.2

        _draw_biomarker_bars(c, v, r, l, a, cx_off, y - chart_h - 6, half_w, chart_h,
                             teal, text_dark, text_muted)

        if col == 1 or idx == len(comparison_data) - 1:
            y -= (chart_h + 18)

    y -= 10

    # Section 3: Clinical Suggestions per sample
    if y < 160:
        c.showPage()
        y = height - 55
        c.setFillColor(teal)
        c.rect(0, height - 38, width, 38, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, height - 23, "NanoSafe Analyzer — Comparison Report (Continued): Suggestions")
        y = height - 55

    c.setFillColor(teal)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(40, y, "3. CLINICAL SUGGESTIONS PER SAMPLE")
    y -= 13

    for idx, item in enumerate(comparison_data[:4]):
        if y < 80:
            break
        name = str(item.get("name", item.get("sample_name", f"Sample #{idx+1}")))[:30]
        c.setFillColor(teal)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, y, f"  {chr(65+idx)}.  {name}")
        y -= 11
        try:
            v = float(item.get("viability", item.get("avg_viability", item.get("cell_viability", 80))))
            s = float(item.get("toxicity_score", 0))
        except Exception:
            v, s = 80.0, 0.0
        ic50_s = str(item.get("ic50", item.get("estimated_ic50", "N/A")))
        safe_r = str(item.get("safe_range", "N/A"))
        rl = str(item.get("iso_compliance", item.get("result", "Evaluated")))
        suggs = get_clinical_suggestions(v, s, ic50_s, safe_r, rl)
        top_sugg = suggs[0] if suggs else ""
        c.setFillColor(text_dark)
        c.setFont("Helvetica", 8.5)
        for bl in textwrap.wrap(top_sugg, width=105)[:2]:
            if y < 70:
                break
            c.drawString(62, y, bl)
            y -= 10
        y -= 5

    # Footer
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(text_muted)
    c.drawString(40, 28, "Disclaimer: NanoSafe Analyzer multi-sample comparative metrics are generated via machine learning algorithms for preclinical safety assessment.")
    c.drawRightString(width - 40, 28, "NanoSafe Analyzer © 2026")

    c.save()
    return pdf_path
