import os
import numpy as np
import pandas as pd

def generate_zno_dataset(num_records=5000, seed=42):
    """
    Generates a biologically realistic dataset for ZnO nanoparticle cytotoxicity
    and biocompatibility evaluation.
    """
    np.random.seed(seed)
    
    cell_lines = [
        "HeLa", "MCF-7", "A549", "HEK293", "NIH-3T3",
        "HepG2", "Caco-2", "CHO", "Jurkat", "PC12"
    ]
    
    # Sensitivity factors & baseline IC50 (µg/mL) for each cell line
    cell_line_props = {
        "HeLa":    {"factor": 1.00, "ic50_base": 45.0},
        "MCF-7":   {"factor": 1.25, "ic50_base": 35.0},
        "A549":    {"factor": 1.20, "ic50_base": 38.0},
        "HEK293":  {"factor": 0.85, "ic50_base": 60.0},
        "NIH-3T3": {"factor": 0.80, "ic50_base": 65.0},
        "HepG2":   {"factor": 1.05, "ic50_base": 42.0},
        "Caco-2":  {"factor": 0.95, "ic50_base": 50.0},
        "CHO":     {"factor": 0.90, "ic50_base": 55.0},
        "Jurkat":  {"factor": 1.30, "ic50_base": 30.0},
        "PC12":    {"factor": 1.15, "ic50_base": 40.0}
    }
    
    exposure_times = [6, 12, 24, 48, 72]
    
    data = []
    
    for i in range(1, num_records + 1):
        exp_id = f"EXP-ZNO-{i:05d}"
        cell_line = np.random.choice(cell_lines)
        props = cell_line_props[cell_line]
        factor = props["factor"]
        ic50_base = props["ic50_base"]
        
        exposure_time = int(np.random.choice(exposure_times))
        
        # Exposure duration affects effective potency
        time_factor = (exposure_time / 24.0) ** 0.35
        effective_ic50 = ic50_base / time_factor
        
        # Concentration ranges from 0.5 to 200.0 µg/mL
        concentration = round(float(np.random.uniform(0.5, 200.0)), 2)
        
        # Sigmoidal dose-response curve for Cell Viability (%)
        hill_coefficient = np.random.normal(1.6, 0.15)
        viability_mean = 100.0 / (1.0 + (concentration / effective_ic50) ** hill_coefficient)
        viability_noise = np.random.normal(0, 3.5)
        cell_viability = round(float(np.clip(viability_mean + viability_noise, 5.0, 100.0)), 2)
        
        # Cytotoxic response metrics (ROS, LDH, Apoptosis)
        ros_mean = (100.0 - cell_viability) * 0.85 * factor
        ros_noise = np.random.normal(0, 4.0)
        ros = round(float(np.clip(ros_mean + ros_noise, 0.0, 100.0)), 2)
        
        ldh_mean = (100.0 - cell_viability) * 0.75 * factor
        ldh_noise = np.random.normal(0, 3.5)
        ldh = round(float(np.clip(ldh_mean + ldh_noise, 0.0, 100.0)), 2)
        
        apoptosis_mean = (100.0 - cell_viability) * 0.70 * factor
        apoptosis_noise = np.random.normal(0, 3.0)
        apoptosis = round(float(np.clip(apoptosis_mean + apoptosis_noise, 0.0, 100.0)), 2)
        
        # Rule-based Toxicity Score formula calculation
        base_toxicity = (
            (100.0 - cell_viability) * 0.50 +
            ros * 0.20 +
            ldh * 0.15 +
            apoptosis * 0.15
        )
        toxicity_score = round(float(base_toxicity * factor), 2)
        
        # IC50 & Safe Range values
        ic50_val = round(float(effective_ic50), 2)
        safe_max_conc = round(float(effective_ic50 * 0.45), 2)
        safe_range_str = f"0 - {safe_max_conc}"
        
        data.append({
            "Experiment_ID": exp_id,
            "Cell_Line": cell_line,
            "Concentration": concentration,
            "Exposure_Time": exposure_time,
            "ROS": ros,
            "LDH": ldh,
            "Apoptosis": apoptosis,
            "Cell_Viability": cell_viability,
            "Toxicity_Score": toxicity_score,
            "IC50": ic50_val,
            "Safe_Range": safe_range_str
        })
        
    df = pd.DataFrame(data)
    return df

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "dataset")
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, "zno_toxicity_dataset.csv")
    
    print(f"Generating 5,000 ZnO toxicity records...")
    df = generate_zno_dataset(5000)
    df.to_csv(csv_path, index=False)
    print(f"Dataset successfully created at: {csv_path}")
