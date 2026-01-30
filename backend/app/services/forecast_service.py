import pandas as pd
from prophet import Prophet

class ForecastService:
    def __init__(self, file_path):
        self.file_path = file_path
        self.model = Prophet()

    def prepare_data(self):
        df = pd.read_csv(self.file_path)
        df.rename(columns={'date': 'ds', 'sales': 'y'}, inplace=True)
        df['ds'] = pd.to_datetime(df['ds'])
        return df

    def generate_forecast(self, days=30):
        df = self.prepare_data()
        self.model.fit(df)
        future = self.model.make_future_dataframe(periods=days)
        forecast = self.model.predict(future)
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]