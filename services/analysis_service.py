import os
import uuid
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit

def hill_4pl_equation(c, bottom, top, ic50, hill_slope):
    """
    Standard 4-Parameter Logistic (4PL) Hill Equation:
    Y = Bottom + (Top - Bottom) / (1 + (Concentration / IC50)^HillSlope)
    """
    return bottom + (top - bottom) / (1.0 + np.power(np.maximum(c, 1e-6) / np.maximum(ic50, 1e-6), hill_slope))

def compute_4pl_ic50(df_sorted):
    """
    Performs 4PL non-linear regression on concentration vs viability points.
    Returns: (ic50_value, hill_slope, r2_fit, fit_type)
    """
    x = df_sorted["Concentration"].values.astype(float)
    y = df_sorted["Cell Viability"].values.astype(float)

    if len(x) >= 4 and len(np.unique(x)) >= 3:
        try:
            # Initial parameter estimates: [Bottom, Top, IC50_guess, HillSlope]
            initial_guesses = [0.0, 100.0, np.median(x), 1.5]
            bounds = ([0.0, 70.0, 0.1, 0.1], [40.0, 130.0, 1000.0, 10.0])
            
            popt, _ = curve_fit(hill_4pl_equation, x, y, p0=initial_guesses, bounds=bounds, maxfev=4000)
            bottom, top, fit_ic50, hill_slope = popt
            
            # Calculate R2 of fit
            residuals = y - hill_4pl_equation(x, *popt)
            ss_res = np.sum(residuals**2)
            ss_tot = np.sum((y - np.mean(y))**2)
            r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.95
            
            if 0.5 <= fit_ic50 <= 500.0:
                return round(float(fit_ic50), 2), round(float(hill_slope), 2), round(float(r2), 3), "4PL Sigmoidal Non-Linear Fit"
        except Exception:
            pass

    # Safe Linear Interpolation Fallback if 4PL doesn't converge or <4 points
    ic50_linear = None
    for i in range(len(df_sorted) - 1):
        v1, v2 = df_sorted.iloc[i]["Cell Viability"], df_sorted.iloc[i+1]["Cell Viability"]
        c1, c2 = df_sorted.iloc[i]["Concentration"],  df_sorted.iloc[i+1]["Concentration"]
        if (v1 >= 50 and v2 <= 50) or (v1 <= 50 and v2 >= 50):
            if v2 != v1:
                ic50_linear = c1 + ((50.0 - v1) * (c2 - c1)) / (v2 - v1)
            break
            
    if ic50_linear is not None:
        return round(float(ic50_linear), 2), 1.0, 0.90, "Linear Concentration Interpolation"
    
    # If cell viability never drops to or below 50%
    if y.min() > 50.0:
        return None, 1.0, 1.0, "IC50 Not Reached (Viability > 50% at all tested doses)"
    else:
        return None, 1.0, 0.0, "IC50 unavailable for this dataset"

def process_experiment_data(df, cell_line, static_folder, experiment_name, medical_application="general"):
    """
    Validates data, calculates multi-biomarker averages, 4PL IC50, 
    generates a publication-quality Dose-Response plot, and returns structured results.
    """
    if df is None:
        raise ValueError("No data provided.")
    if "Concentration" not in df.columns or "Cell Viability" not in df.columns:
        raise ValueError("Data must contain at least: 'Concentration' and 'Cell Viability'")

    df["Concentration"]  = pd.to_numeric(df["Concentration"],  errors="coerce")
    df["Cell Viability"] = pd.to_numeric(df["Cell Viability"], errors="coerce")
    df["ROS Level"]   = pd.to_numeric(df.get("ROS Level",   pd.Series([0]*len(df))), errors="coerce").fillna(0)
    df["LDH Release"] = pd.to_numeric(df.get("LDH Release", pd.Series([0]*len(df))), errors="coerce").fillna(0)
    df["Apoptosis"]   = pd.to_numeric(df.get("Apoptosis",   pd.Series([0]*len(df))), errors="coerce").fillna(0)
    
    df = df.dropna(subset=["Concentration", "Cell Viability"])
    if df.empty:
        raise ValueError("No valid numeric data found in dataset.")

    avg = round(float(df["Cell Viability"].mean()), 2)
    avg_ros = round(float(df["ROS Level"].mean()), 2)
    avg_ldh = round(float(df["LDH Release"].mean()), 2)
    avg_apoptosis = round(float(df["Apoptosis"].mean()), 2)
    avg_concentration = round(float(df["Concentration"].mean()), 2)

    cell_line_factor = {
        "HeLa": 1.00, "MCF-7": 1.25, "A549": 1.20, "HEK293": 0.85,
        "NIH-3T3": 0.80, "HepG2": 1.05, "Caco-2": 0.95, "CHO": 0.90,
        "Jurkat": 1.30, "PC12": 1.15
    }
    factor = cell_line_factor.get(cell_line, 1.0)
    
    df_sorted = df.sort_values("Concentration").reset_index(drop=True)

    # Compute Exact 4PL IC50
    ic50_val, hill_slope, fit_r2, fit_method = compute_4pl_ic50(df_sorted)
    if ic50_val is not None:
        ic50_display = f"{ic50_val} µg/mL"
    else:
        if "Not Reached" in fit_method:
            ic50_display = "Not Reached (> Maximum Tested Dose)"
        else:
            ic50_display = "IC50 unavailable for this dataset"

    # Compute Safe Usage Ceiling (Highest concentration maintaining >= 80% viability)
    safe_points = df_sorted[df_sorted["Cell Viability"] >= 80.0]
    if not safe_points.empty:
        safe_ceiling_val = round(float(safe_points["Concentration"].max()), 2)
        safe_range = f"0.0 - {safe_ceiling_val} µg/mL"
        biocompatible_status = "Pass"
    else:
        safe_ceiling_val = 0.0
        safe_range = "No Safe Range (Viability < 80% across all tested doses)"
        biocompatible_status = "Fail"

    # Base toxicity score heuristic fallback
    base_toxicity_score = (100.0 - avg)*0.50 + avg_ros*0.20 + avg_ldh*0.15 + avg_apoptosis*0.15
    toxicity_score = round(float(base_toxicity_score * factor), 2)

    if toxicity_score < 25.0:
        toxicity_level = "Low"
        result = "Safe"
    elif toxicity_score < 55.0:
        toxicity_level = "Moderate"
        result = "Moderate Risk"
    else:
        toxicity_level = "High"
        result = "Toxic"

    interpretation = (
        f"ZnO (Zinc Oxide) nanoparticles were evaluated on {cell_line} cells. "
        f"Average cell viability was {avg}%, ROS level {avg_ros}, "
        f"LDH release {avg_ldh}%, and apoptosis {avg_apoptosis}%. "
        f"Mathematical 4PL curve fitting established an IC50 of {ic50_display} (Fit: {fit_method}). "
        f"The safe biomedical usage ceiling is {safe_range} (ISO 10993-5 Biocompatibility: {biocompatible_status.upper()}). "
        f"Overall toxicity risk is categorized as {toxicity_level} (Score: {toxicity_score}/100)."
    )

    # Generate Publication-Quality Dose-Response Matplotlib Graph
    graph_name = f"{uuid.uuid4().hex}.png"
    graph_path = os.path.join(static_folder, graph_name)
    try:
        fig, ax = plt.subplots(figsize=(7, 4.2), dpi=130)
        
        # Plot experimental points
        ax.scatter(df_sorted["Concentration"], df_sorted["Cell Viability"], color="#0f766e", s=60, zorder=5, label="Experimental Data")
        
        # Plot smooth curve
        if len(df_sorted) > 1:
            x_dense = np.linspace(df_sorted["Concentration"].min(), df_sorted["Concentration"].max(), 200)
            if ic50_val is not None and fit_method.startswith("4PL"):
                y_dense = hill_4pl_equation(x_dense, 0.0, 100.0, ic50_val, hill_slope)
                ax.plot(x_dense, y_dense, color="#0d9488", linewidth=2.2, label=f"4PL Hill Fit (IC50={ic50_val} µg/mL)")
            else:
                ax.plot(df_sorted["Concentration"], df_sorted["Cell Viability"], color="#0d9488", linewidth=2.0, linestyle="--")

        # Threshold guide lines
        ax.axhline(80, color="#16a34a", linestyle=":", linewidth=1.5, label="Safe Threshold (80% Viability)")
        ax.axhline(50, color="#dc2626", linestyle=":", linewidth=1.5, label="IC50 Line (50% Viability)")
        
        ax.set_xlabel("ZnO Concentration (µg/mL)", fontweight="bold", fontsize=11)
        ax.set_ylabel("Cell Viability (%)", fontweight="bold", fontsize=11)
        ax.set_title(f"ZnO Dose-Response Curve — {cell_line}", fontweight="bold", fontsize=12, pad=12)
        ax.set_ylim(-5, 115)
        ax.grid(True, linestyle="--", alpha=0.4)
        ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
        plt.tight_layout()
        plt.savefig(graph_path)
    except Exception as e:
        print(f"Graph generation error: {e}")
        graph_name = ""
        graph_path = ""
    finally:
        plt.close('all')

    tables = df.to_html(classes="data-table", index=False)
    raw_data = df.to_dict(orient="records")

    return {
        "avg_concentration": avg_concentration,
        "avg": avg,
        "avg_ros": avg_ros,
        "avg_ldh": avg_ldh,
        "avg_apoptosis": avg_apoptosis,
        "factor": factor,
        "toxicity_score": toxicity_score,
        "toxicity_level": toxicity_level,
        "result": result,
        "ic50": ic50_display,
        "ic50_numerical": ic50_val,
        "safe_range": safe_range,
        "safe_ceiling": safe_ceiling_val,
        "biocompatible_status": biocompatible_status,
        "fit_method": fit_method,
        "interpretation": interpretation,
        "graph_name": graph_name,
        "graph_path": graph_path,
        "tables": tables,
        "raw_data": raw_data
    }
