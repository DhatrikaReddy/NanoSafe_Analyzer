import os
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error, accuracy_score, classification_report

def derive_risk_category(score):
    if score < 25.0:
        return "Low"
    elif score < 55.0:
        return "Moderate"
    else:
        return "High"

def train_and_save_model():
    print("==================================================")
    print(" TRAINING LOCAL SCENARIO-ACCURATE ML MODEL SUITE ")
    print(" (100% Offline, Zero-API Architecture)           ")
    print("==================================================")
    
    dataset_path = os.path.join(os.path.dirname(__file__), '..', 'dataset', 'zno_toxicity_dataset.csv')
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    df = pd.read_csv(dataset_path)
    print(f"Loaded dataset with {len(df)} records.")
    
    df.drop_duplicates(inplace=True)
    df.dropna(subset=['Concentration', 'Cell_Viability', 'Toxicity_Score', 'IC50'], inplace=True)
    
    # Feature definitions
    categorical_features = ['Cell_Line']
    numerical_features = ['Concentration', 'Exposure_Time', 'ROS', 'LDH', 'Apoptosis', 'Cell_Viability']
    feature_cols = categorical_features + numerical_features
    
    X = df[feature_cols]
    y_toxicity = df['Toxicity_Score']
    y_ic50 = df['IC50']
    
    # Derive categorical risk ground truth
    df['Risk_Level'] = df['Toxicity_Score'].apply(derive_risk_category)
    y_risk = df['Risk_Level']

    # Train/Test Splits
    X_train, X_test, y_tox_train, y_tox_test = train_test_split(X, y_toxicity, test_size=0.2, random_state=42)
    _, _, y_ic50_train, y_ic50_test = train_test_split(X, y_ic50, test_size=0.2, random_state=42)
    _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)

    # Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ]
    )

    # 1. Toxicity Score Regressor (Random Forest)
    print("\n--- Training Model 1: Toxicity Score Regressor ---")
    tox_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=120, max_depth=16, random_state=42, n_jobs=-1))
    ])
    tox_pipeline.fit(X_train, y_tox_train)
    y_tox_pred = tox_pipeline.predict(X_test)
    tox_r2 = r2_score(y_tox_test, y_tox_pred)
    tox_mae = mean_absolute_error(y_tox_test, y_tox_pred)
    tox_mse = mean_squared_error(y_tox_test, y_tox_pred)
    print(f"Toxicity Model R2: {tox_r2:.4f}, MAE: {tox_mae:.4f}")

    # 2. Risk Level Classifier (Random Forest Classifier)
    print("\n--- Training Model 2: Risk Stratification Classifier ---")
    risk_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1))
    ])
    risk_pipeline.fit(X_train, y_risk_train)
    y_risk_pred = risk_pipeline.predict(X_test)
    risk_acc = accuracy_score(y_risk_test, y_risk_pred)
    print(f"Risk Classifier Accuracy: {risk_acc*100.0:.2f}%")

    # 3. IC50 Numerical Estimator (Gradient Boosting / Random Forest)
    print("\n--- Training Model 3: IC50 Numerical Estimator ---")
    ic50_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', GradientBoostingRegressor(n_estimators=120, max_depth=6, learning_rate=0.08, random_state=42))
    ])
    ic50_pipeline.fit(X_train, y_ic50_train)
    y_ic50_pred = ic50_pipeline.predict(X_test)
    ic50_r2 = r2_score(y_ic50_test, y_ic50_pred)
    ic50_mae = mean_absolute_error(y_ic50_test, y_ic50_pred)
    print(f"IC50 Model R2: {ic50_r2:.4f}, MAE: {ic50_mae:.4f} µg/mL")

    # Model Bundle for Local Offline Inference
    bundle = {
        "toxicity_model": tox_pipeline,
        "risk_classifier": risk_pipeline,
        "ic50_model": ic50_pipeline,
        "feature_names": feature_cols,
        "numerical_features": numerical_features,
        "categorical_features": categorical_features,
        "classes": ["Low", "Moderate", "High"],
        "metadata": {
            "dataset_rows": len(df),
            "tox_r2": round(tox_r2, 4),
            "tox_mae": round(tox_mae, 4),
            "risk_accuracy": round(risk_acc, 4),
            "ic50_r2": round(ic50_r2, 4),
            "ic50_mae": round(ic50_mae, 4)
        }
    }

    # Save to trained_model.pkl
    model_path = os.path.join(os.path.dirname(__file__), 'trained_model.pkl')
    joblib.dump(bundle, model_path, compress=3)
    print(f"\n[OK] Saved multi-target ML bundle to {model_path}")

    # Save metrics JSON
    metrics = {
        "architecture": "Offline Local Multi-Model Ensemble (Zero API)",
        "dataset_name": "ZnO Biocompatibility & Cytotoxicity Dataset",
        "total_samples": len(df),
        "input_features": feature_cols,
        "models": {
            "toxicity_regressor": {
                "algorithm": "RandomForestRegressor(n_estimators=120)",
                "testing_r2": round(tox_r2, 4),
                "testing_mae": round(tox_mae, 4),
                "testing_mse": round(tox_mse, 4)
            },
            "risk_classifier": {
                "algorithm": "RandomForestClassifier(n_estimators=100)",
                "accuracy": round(risk_acc, 4)
            },
            "ic50_estimator": {
                "algorithm": "GradientBoostingRegressor(n_estimators=120)",
                "testing_r2": round(ic50_r2, 4),
                "testing_mae": round(ic50_mae, 4)
            }
        }
    }
    
    metrics_path = os.path.join(os.path.dirname(__file__), 'model_metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)
    print(f"[OK] Saved model metrics to {metrics_path}")

if __name__ == "__main__":
    train_and_save_model()
