# backend/app/services/inventory_service.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class InventoryService:
    def __init__(self, file_path):
        self.df = pd.read_csv(file_path)

    def load_data(self, store_id=None, product_id=None):
        df_filtered = self.df.copy()
        if store_id:
            df_filtered = df_filtered[df_filtered['store_id'] == store_id]
        if product_id:
            df_filtered = df_filtered[df_filtered['product_id'] == product_id]
        return df_filtered

    def calculate_safety_stock(self, df, service_level=1.65):
        std_dev = df['units_sold'].std()
        return service_level * std_dev if not np.isnan(std_dev) else 0

    def calculate_reorder_point(self, df, lead_time_days=3, service_level=1.65):
        avg_daily_demand = df['units_sold'].mean()
        safety_stock = self.calculate_safety_stock(df, service_level)
        return (avg_daily_demand * lead_time_days) + safety_stock

    def calculate_eoq(self, df, ordering_cost=100, holding_cost_per_unit=2):
        annual_demand = df['units_sold'].sum() * 12  # rough estimate
        if holding_cost_per_unit <= 0:
            return 0
        eoq = np.sqrt((2 * annual_demand * ordering_cost) / holding_cost_per_unit)
        return eoq

    def get_inventory_recommendations(self, store_id=None, product_id=None, current_stock=0):
        df_filtered = self.load_data(store_id, product_id)
        if df_filtered.empty:
            return {"error": "No data found for given filters"}

        avg_daily_demand = df_filtered['units_sold'].mean()
        safety_stock = self.calculate_safety_stock(df_filtered)
        reorder_point = self.calculate_reorder_point(df_filtered)
        eoq = self.calculate_eoq(df_filtered)

        days_of_stock = current_stock / avg_daily_demand if avg_daily_demand > 0 else float('inf')

        status = "OK"
        if current_stock <= reorder_point:
            status = "Reorder Needed"

        return {
            "store_id": store_id,
            "product_id": product_id,
            "avg_daily_demand": round(avg_daily_demand, 2),
            "safety_stock": round(safety_stock, 2),
            "reorder_point": round(reorder_point, 2),
            "eoq": round(eoq, 2),
            "current_stock": current_stock,
            "days_of_stock": round(days_of_stock, 2),
            "status": status
        }

# Standalone function (if needed)
def calculate_reorder_quantity(current_stock, reorder_point, eoq):
    if current_stock <= reorder_point:
        return max(0, eoq - current_stock)
    return 0