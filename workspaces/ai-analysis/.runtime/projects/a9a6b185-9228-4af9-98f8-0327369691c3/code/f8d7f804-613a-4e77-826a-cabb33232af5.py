# Reproduce this experiment from its immutable project artifact.
from pathlib import Path
import pandas as pd
from sklearn.pipeline import Pipeline

RUN_CONFIG = {'task': 'clustering', 'features': ['quantity', 'unit_price', 'paid_amount'], 'algorithm': 'kmeans', 'random_state': 42, 'metrics': {'silhouette': 0.5560275698887369, 'clusters': 4}}
SOURCE_PATH = Path(__file__).resolve().parents[1] / 'datasets/extracts/07638a02-3493-4e68-bfa7-b533ff0b1f7e.parquet'
frame = pd.read_parquet(SOURCE_PATH)
features = RUN_CONFIG['features']
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

x = frame[features]
model = Pipeline([('impute', SimpleImputer(strategy='median')), ('scale', StandardScaler()), ('model', KMeans(n_clusters=RUN_CONFIG['metrics']['clusters'], random_state=RUN_CONFIG['random_state'], n_init='auto'))])
labels = model.fit_predict(x)
print(pd.Series(labels).value_counts().sort_index().to_dict())
