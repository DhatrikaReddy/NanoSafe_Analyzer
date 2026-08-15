import os
import json
import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder

def train_tflite_model():
    print("Loading dataset...")
    base_dir = os.path.dirname(__file__)
    dataset_path = os.path.join(base_dir, '..', 'dataset', 'zno_toxicity_dataset.csv')
    df = pd.read_csv(dataset_path)

    df.drop_duplicates(inplace=True)
    df.dropna(inplace=True)

    categorical_features = ['Cell_Line']
    numerical_features = ['Concentration', 'Exposure_Time', 'ROS', 'LDH', 'Apoptosis', 'Cell_Viability']
    target = 'Toxicity_Score'

    # Preprocessing
    scaler = StandardScaler()
    scaled_nums = scaler.fit_transform(df[numerical_features])
    
    encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
    encoded_cats = encoder.fit_transform(df[categorical_features])
    
    cell_line_categories = encoder.categories_[0].tolist()
    
    X = np.hstack((scaled_nums, encoded_cats))
    y = df[target].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Build Keras Model
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation='relu', input_shape=(X.shape[1],)),
        tf.keras.layers.Dense(32, activation='relu'),
        tf.keras.layers.Dense(16, activation='relu'),
        tf.keras.layers.Dense(1, activation='linear')
    ])

    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    
    # Train
    print("Training Keras model...")
    model.fit(X_train, y_train, epochs=200, batch_size=32, validation_data=(X_test, y_test), verbose=1)

    loss, mae = model.evaluate(X_test, y_test)
    print(f"Test MAE: {mae:.4f}")

    # Save .h5 for backend
    h5_path = os.path.join(base_dir, 'nanosafe_model.h5')
    model.save(h5_path)
    print(f"Saved {h5_path}")

    # Convert to TFLite for React Native
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    
    tflite_path = os.path.join(base_dir, 'nanosafe_model.tflite')
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
    print(f"Saved {tflite_path}")
    
    # Save preprocessing parameters so both React Native and Backend know how to scale inputs
    prep_params = {
        "numerical_features": numerical_features,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_scale": scaler.scale_.tolist(),
        "categorical_features": categorical_features,
        "cell_lines": cell_line_categories
    }
    
    prep_path = os.path.join(base_dir, 'preprocessing_params.json')
    with open(prep_path, 'w') as f:
        json.dump(prep_params, f, indent=4)
    print(f"Saved {prep_path}")

if __name__ == "__main__":
    train_tflite_model()
