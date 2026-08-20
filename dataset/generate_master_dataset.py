import os
import numpy as np
import pandas as pd

def generate_master_zno_dataset(num_records=10000, seed=42):
    """
    Generates a 10,000+ record scientifically grounded dataset for ZnO nanoparticle
    cytotoxicity, biocompatibility, hemocompatibility, and selectivity evaluation.
    """
    np.random.seed(seed)
    
    cell_lines = [
        {"name": "HeLa", "type": "Cancer", "base_ic50": 45.0, "factor": 1.00},
        {"name": "MCF-7", "type": "Cancer", "base_ic50": 35.0, "factor": 1.25},
        {"name": "A549", "type": "Cancer", "base_ic50": 38.0, "factor": 1.20},
        {"name": "HCT-116", "type": "Cancer", "base_ic50": 32.0, "factor": 1.30},
        {"name": "HepG2", "type": "Cancer", "base_ic50": 42.0, "factor": 1.05},
        {"name": "Jurkat", "type": "Cancer", "base_ic50": 28.0, "factor": 1.35},
        {"name": "HEK293", "type": "Normal", "base_ic50": 60.0, "factor": 0.85},
        {"name": "NIH-3T3", "type": "Normal", "base_ic50": 65.0, "factor": 0.80},
        {"name": "L929", "type": "Normal", "base_ic50": 68.0, "factor": 0.75},
        {"name": "Primary_HDF", "type": "Normal", "base_ic50": 72.0, "factor": 0.70},
        {"name": "PBMCs", "type": "Normal", "base_ic50": 58.0, "factor": 0.88},
        {"name": "Caco-2", "type": "Normal", "base_ic50": 50.0, "factor": 0.95},
        {"name": "CHO", "type": "Normal", "base_ic50": 55.0, "factor": 0.90}
    ]
    
    synthesis_methods = [
        {"name": "Green_Synthesis", "toxicity_multiplier": 0.75, "ic50_boost": 1.25},
        {"name": "Chemical_Precipitation", "toxicity_multiplier": 1.10, "ic50_boost": 0.92},
        {"name": "Sol-Gel", "toxicity_multiplier": 1.00, "ic50_boost": 1.00},
        {"name": "Hydrothermal", "toxicity_multiplier": 0.95, "ic50_boost": 1.05}
    ]
    
    surface_coatings = [
        {"name": "Bare_ZnO", "ros_mod": 1.00, "ldh_mod": 1.00, "hemo_mod": 1.00},
        {"name": "PEG_Coated", "ros_mod": 0.35, "ldh_mod": 0.45, "hemo_mod": 0.30},
        {"name": "Chitosan_Coated", "ros_mod": 0.50, "ldh_mod": 0.55, "hemo_mod": 0.40},
        {"name": "Silica_Coated", "ros_mod": 0.65, "ldh_mod": 0.60, "hemo_mod": 0.50}
    ]
    
    exposure_times = [6, 12, 24, 48, 72]
    
    data = []
    
    for i in range(1, num_records + 1):
        exp_id = f"EXP-ZNO-{i:06d}"
        
        idx = np.random.randint(0, len(cell_lines))
        cell_info = cell_lines[idx]
        cell_name = cell_info["name"]
        cell_type = cell_info["type"]
        base_ic50 = cell_info["base_ic50"]
        cell_factor = cell_info["factor"]
        
        synth_idx = np.random.randint(0, len(synthesis_methods))
        synth = synthesis_methods[synth_idx]
        
        coat_idx = np.random.randint(0, len(surface_coatings))
        coat = surface_coatings[coat_idx]
        
        exposure_time = int(np.random.choice(exposure_times))
        
        # Exposure time scaling
        time_factor = (exposure_time / 24.0) ** 0.35
        
        # Effective IC50 based on synthesis and coating
        effective_ic50 = (base_ic50 * synth["ic50_boost"]) / time_factor
        if coat["name"] == "PEG_Coated":
            effective_ic50 *= 1.30
        elif coat["name"] == "Chitosan_Coated":
            effective_ic50 *= 1.20
            
        # Particle size (nm) and Zeta potential (mV)
        core_size = round(float(np.random.uniform(15.0, 95.0)), 1)
        zeta_potential = round(float(np.random.uniform(-35.0, 35.0)), 1)
        
        # Concentration range: 0.2 to 200.0 µg/mL
        concentration = round(float(np.random.exponential(scale=35.0) + 0.5), 2)
        concentration = min(concentration, 200.0)
        
        # Hill Sigmoidal Dose-Response for MTT Cell Viability (%)
        hill_coeff = np.random.normal(1.65, 0.12)
        viab_mean = 100.0 / (1.0 + (concentration / effective_ic50) ** hill_coeff)
        viab_noise = np.random.normal(0, 2.8)
        cell_viability = round(float(np.clip(viab_mean + viab_noise, 3.0, 100.0)), 2)
        
        # Cytotoxic endpoints modulated by surface coating
        ros_raw = (100.0 - cell_viability) * 0.85 * cell_factor * synth["toxicity_multiplier"] * coat["ros_mod"]
        ros = round(float(np.clip(ros_raw + np.random.normal(0, 3.0), 0.0, 100.0)), 2)
        
        ldh_raw = (100.0 - cell_viability) * 0.75 * cell_factor * synth["toxicity_multiplier"] * coat["ldh_mod"]
        ldh = round(float(np.clip(ldh_raw + np.random.normal(0, 2.5), 0.0, 100.0)), 2)
        
        apop_raw = (100.0 - cell_viability) * 0.70 * cell_factor * synth["toxicity_multiplier"]
        apoptosis = round(float(np.clip(apop_raw + np.random.normal(0, 2.5), 0.0, 100.0)), 2)
        
        # Hemolysis % (Erythrocyte membrane damage per ASTM F756)
        hemo_mean = (concentration / (effective_ic50 * 2.5)) ** 1.4 * 6.0 * coat["hemo_mod"]
        hemolysis = round(float(np.clip(hemo_mean + np.random.normal(0, 0.4), 0.1, 15.0)), 2)
        
        # Comet Assay DNA Olive Tail Moment (Genotoxicity)
        comet_mean = 1.0 + (concentration / effective_ic50) ** 1.2 * 4.5
        comet_tail_moment = round(float(np.clip(comet_mean + np.random.normal(0, 0.5), 1.0, 18.0)), 2)
        
        # Selectivity Index (Normal IC50 / Cancer IC50)
        selectivity_index = round(float(65.0 / effective_ic50), 2) if cell_type == "Cancer" else 1.0
        
        # Toxicity Score (0 - 100)
        base_toxicity = (
            (100.0 - cell_viability) * 0.45 +
            ros * 0.20 +
            ldh * 0.15 +
            apoptosis * 0.10 +
            hemolysis * 0.10
        )
        toxicity_score = round(float(np.clip(base_toxicity * cell_factor * synth["toxicity_multiplier"], 0.0, 100.0)), 2)
        
        # ISO 10993 Cytotoxicity Category
        if cell_viability >= 70.0:
            iso_class = "ISO-Pass (Viable >=70%)"
        elif cell_viability >= 50.0:
            iso_class = "ISO-Warning (Mild Cytotoxicity 50-70%)"
        else:
            iso_class = "ISO-Fail (Severe Cytotoxicity <50%)"
            
        # Risk Stratification
        if toxicity_score < 25.0:
            risk_level = "Low"
        elif toxicity_score < 55.0:
            risk_level = "Moderate"
        else:
            risk_level = "High"
            
        data.append({
            "Experiment_ID": exp_id,
            "Cell_Line": cell_name,
            "Cell_Type": cell_type,
            "Synthesis_Method": synth["name"],
            "Surface_Coating": coat["name"],
            "Core_Size_nm": core_size,
            "Zeta_Potential_mV": zeta_potential,
            "Concentration": concentration,
            "Exposure_Time": exposure_time,
            "Cell_Viability": cell_viability,
            "ROS": ros,
            "LDH": ldh,
            "Apoptosis": apoptosis,
            "Hemolysis": hemolysis,
            "Comet_Tail_Moment": comet_tail_moment,
            "Selectivity_Index": selectivity_index,
            "Toxicity_Score": toxicity_score,
            "IC50": round(float(effective_ic50), 2),
            "Risk_Level": risk_level,
            "ISO_10993_Status": iso_class
        })
        
    df = pd.DataFrame(data)
    return df

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Generating 10,000-record Master ZnO Biocompatibility Dataset...")
    df_10k = generate_master_zno_dataset(10000, seed=42)
    
    master_path = os.path.join(out_dir, 'zno_biocompatibility_master_10k.csv')
    df_10k.to_csv(master_path, index=False)
    print(f"[OK] Successfully saved {len(df_10k)} records to {master_path}")
    
    # Also update standard zno_toxicity_dataset.csv
    standard_path = os.path.join(out_dir, 'zno_toxicity_dataset.csv')
    df_10k.to_csv(standard_path, index=False)
    print(f"[OK] Updated {standard_path} with {len(df_10k)} records")
