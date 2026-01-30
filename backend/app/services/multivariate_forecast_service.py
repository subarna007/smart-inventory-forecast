# backend/app/services/multivariate_forecast_service.py
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
import os

MODEL_DIR = "data/models"
os.makedirs(MODEL_DIR, exist_ok=True)

class MultivariateForecastService:
    def __init__(self, file_path):
        self.file_path = file_path
        self.df = pd.read_csv(file_path)
        self.df['date'] = pd.to_datetime(self.df['date'])
        self.df.sort_values('date', inplace=True)

    def _make_features(self, df):
        df = df.copy()
        df['day'] = df['date'].dt.day
        df['month'] = df['date'].dt.month
        df['weekday'] = df['date'].dt.weekday
        df['is_weekend'] = df['weekday'].isin([5,6]).astype(int)

        for col in ['price','discount','competitor_price','inventory_level']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        cat_cols = [c for c in ['category','region','weather','season'] if c in df.columns]
        if cat_cols:
            df = pd.get_dummies(df, columns=cat_cols, drop_first=True)

        df = df.sort_values('date')
        for lag in range(1, 8):
            df[f'lag_{lag}'] = df['units_sold'].shift(lag).fillna(0)

        df['rolling_7'] = df['units_sold'].rolling(7, min_periods=1).mean().fillna(0)
        return df

    def train_for_product(self, store_id, product_id):
        df = self.df[(self.df['store_id'] == store_id) & (self.df['product_id'] == product_id)].copy()
        if df.shape[0] < 14:
            raise ValueError("Not enough data to train (need >=14 rows for this product)")

        df_feat = self._make_features(df)
        X = df_feat.drop(columns=['date','store_id','product_id','units_ordered','units_sold'], errors='ignore')
        y = df_feat['units_sold']

        X_train, X_valid, y_train, y_valid = train_test_split(X, y, test_size=0.2, shuffle=False)
        model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        model.fit(X_train, y_train)

        model_name = f"{store_id}__{product_id}.joblib"
        joblib.dump(model, os.path.join(MODEL_DIR, model_name))
        return {"message": "model_trained", "model_file": model_name}

    def predict_future(self, store_id, product_id, days=30):
        df = self.df[(self.df['store_id'] == store_id) & (self.df['product_id'] == product_id)].copy()
        model_name = f"{store_id}__{product_id}.joblib"
        model_path = os.path.join(MODEL_DIR, model_name)
        if not os.path.exists(model_path):
            self.train_for_product(store_id, product_id)

        model = joblib.load(model_path)

        df_feat = self._make_features(df)
        last_row = df_feat.iloc[-1:].copy()

        preds = []
        current = last_row.copy()
        for day in range(days):
            current['date'] = pd.to_datetime(current['date']) + pd.Timedelta(days=1)
            current['day'] = current['date'].dt.day
            current['month'] = current['date'].dt.month
            current['weekday'] = current['date'].dt.weekday
            current['is_weekend'] = current['weekday'].isin([5,6]).astype(int)

            for lag in range(7,1,-1):
                current[f'lag_{lag}'] = current.get(f'lag_{lag-1}', 0)
            current['lag_1'] = int(current['rolling_7'])
            X_pred = current.drop(columns=['date','store_id','product_id','units_ordered','units_sold'], errors='ignore')

            X_train_cols = model.feature_names_in_ if hasattr(model, "feature_names_in_") else X_pred.columns
            X_pred = X_pred.reindex(columns=X_train_cols, fill_value=0)
            yhat = model.predict(X_pred)[0]
            preds.append({"ds": current['date'].iloc[0].strftime("%Y-%m-%d"), "yhat": float(max(0, yhat))})

            current['lag_1'] = yhat
            current['rolling_7'] = (current['rolling_7'] * 6 + yhat) / 7

        return pd.DataFrame(preds)