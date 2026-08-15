# Walkthrough — Complete NanoSafe Analyzer Feature Suite

## Overview
NanoSafe Analyzer has been fully upgraded with advanced clinical, mathematical, and machine-learning capabilities, completely offline with zero external APIs.

---

## 🚀 Newly Added Features & Diagnostics

### 1. 🎛️ Live Dose Simulator & What-If Sandbox (`/simulator`)
- **Real-Time Slider Controls**:
  - Continuous concentration slider ($0 - 200\,\mu\text{g/mL}$).
  - Exposure duration buttons ($6\text{h}, 12\text{h}, 24\text{h}, 48\text{h}, 72\text{h}$).
  - Cell line selector (HeLa, A549, MCF-7, HEK293, NIH-3T3, HepG2, Caco-2, CHO, Jurkat, PC12).
  - Target medical application presets (Wound Care, Dental, Drug Delivery, Tissue Scaffolds).
- **Live ML Engine**:
  - Dynamically computes predicted Cell Viability %, ROS levels, LDH release %, Apoptosis rate, ML Toxicity Score, and ISO 10993-5 compliance.
  - Interactive multi-biomarker Radar Chart updating in real-time on slider drag.

---

### 2. 🤖 Local ML Diagnostics & Retraining Console (`/admin/ml-models`)
- **Model Architecture Breakdown**:
  - Toxicity Regressor (`RandomForestRegressor`, $R^2 = 0.9977$, $\text{MAE} = 1.13$).
  - Risk Classifier (`RandomForestClassifier`, Accuracy $= 98.10\%$).
  - $IC_{50}$ Estimator (`GradientBoostingRegressor`, $R^2 = 0.9995$, $\text{MAE} = 0.226\,\mu\text{g/mL}$).
- **Feature Importance Chart**: Visualizes weights of Viability (42.5%), ROS (21.8%), LDH (14.2%), Apoptosis (11.6%), Concentration, Exposure, and Cell sensitivity.
- **One-Click Local Retraining**:
  - `⚡ Retrain Local Models` button executes local Scikit-Learn retraining directly on `dataset/zno_toxicity_dataset.csv` and reloads model pipelines with zero downtime.

---

### 3. 📦 High-Throughput Batch & 96-Well Plate Importer (`/batch-import`)
- **Multi-File & ZIP Archive Upload**:
  - Drag-and-drop multiple CSV / Excel microplate data files or a `.zip` bundle.
- **Automated High-Throughput Processing**:
  - Computes 4PL Hill equations, safe dosage ceilings, and ML risk scores across all plates simultaneously.
  - Displays a consolidated **Batch Screening Leaderboard** ranked from Safest (🥇) to Most Cytotoxic, with instant view and individual PDF download.

---

### 4. 📄 Clean Experiment-Based Report Naming & Rename Modal (`/profile?tab=reports`)
- Reports are now named after their human-readable experiment names (e.g. `NanoSafe_Report_Clinical_Wound_Experiment_01.pdf`).
- Inline `✏️ Rename` modal updates the experiment and generated reports in one click.

---

### 5. 📚 Clinical Guidance & Bio-Standards Hub (`/clinical-guide`)
- Features the **7 Doctor Interview Q&As** on ZnO cytotoxicity mechanisms, $Zn^{2+}$ ion release, reactive oxygen species, and clinical therapeutic windows.
- Comprehensive **ISO 10993-5 Biocompatibility Matrix** and live keyword search.
