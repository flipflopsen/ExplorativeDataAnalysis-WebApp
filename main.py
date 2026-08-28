"""
Data Analysis Project Script - Project Name
==========================================
This script demonstrates a basic data analysis workflow using the loaded libraries.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import LinearRegression

def run_analysis():
    print("--- Starting Data Analysis Workflow ---")
    
    # 1. Data Loading Example
    data = pd.DataFrame({
        'FeatureA': np.random.rand(100),
        'FeatureB': np.random.rand(100) * 10,
        'Target': np.random.rand(100) * 5 + (np.random.rand(100) * 2)
    })
    print(f"Data loaded. Shape: {data.shape}")

    # 2. Basic Computation Example
    mean_a = data['FeatureA'].mean()
    print(f"Mean of FeatureA: {mean_a:.4f}")
    
    # 3. Visualization Example
    plt.figure(figsize=(10, 6))
    data['FeatureB'].hist(bins=15)
    plt.title("Distribution of Feature B")
    plt.xlabel("Feature B")
    plt.ylabel("Frequency")
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.show()

    # 4. Simple Machine Learning Example (Dummy setup)
    X = data[['FeatureA', 'FeatureB']].iloc[:95]
    y = data['Target'].iloc[:95]
    model = LinearRegression()
    model.fit(X, y)
    print(f"Model trained successfully. Coefficients: {model.coef_}")
    
    print("--- Analysis Workflow Completed ---")


if __name__ == "__main__":
    run_analysis()
