import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Optional: Prophet if installed
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except Exception:
    PROPHET_AVAILABLE = False

app = FastAPI(title="Smart Inventory API - Simplified Stock Status")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def find_column(cols, candidates):
    cols_lower = {c.lower().strip(): c for c in cols}
    for cand in candidates:
        key = cand.lower()
        if key in cols_lower:
            return cols_lower[key]
    return None


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"filename": file.filename}


@app.get("/dashboard_data")
async def dashboard_data(
    file_name: str,
    forecast_days: int = Query(30, ge=1, le=365),
    lead_time_days: int = Query(5, ge=0, le=180),
    buffer_days: int = Query(7, ge=0, le=180),
):
    file_path = os.path.join(UPLOAD_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {e}")

    # Normalize column names
    df.columns = [c.strip() for c in df.columns]

    # Detect likely column names
    date_col = find_column(df.columns, ["date", "ds", "transaction_date", "sale_date", "order_date"])
    product_col = find_column(df.columns, ["product_id", "product", "item_id", "sku", "product_name", "name"])
    units_col = find_column(df.columns, ["units_sold", "quantity", "qty", "sales", "units"])
    inventory_col = find_column(df.columns, ["inventory_level", "inventory", "stock", "current_stock", "qty_in_stock"])
    store_col = find_column(df.columns, ["store_id", "store"])

    if date_col is None or product_col is None or units_col is None:
        raise HTTPException(status_code=400, detail="CSV must include date, product and units columns")

    # Parse and clean columns
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True)
    df = df.dropna(subset=[date_col])
    df[units_col] = pd.to_numeric(df[units_col], errors="coerce").fillna(0)
    df[product_col] = df[product_col].astype(str)

    if store_col:
        df[store_col] = df[store_col].astype(str)
    else:
        df["_store"] = "SINGLE_STORE"
        store_col = "_store"

    if inventory_col and inventory_col in df.columns:
        df[inventory_col] = pd.to_numeric(df[inventory_col], errors="coerce").fillna(0)

    # Product-level daily aggregation
    product_daily = (
        df.groupby([df[date_col].dt.date, product_col])[units_col]
        .sum()
        .reset_index()
        .rename(columns={date_col: "date", product_col: "product", units_col: "units_sold"})
    )

    # Overall daily sales series
    overall_daily = product_daily.groupby("date")["units_sold"].sum().reset_index()
    overall_daily["date"] = overall_daily["date"].astype(str)
    avg_daily_sales = float(overall_daily["units_sold"].mean()) if len(overall_daily) else 0.0

    # Per-product latest stock if inventory column exists
    per_product_stock = {}
    if inventory_col and inventory_col in df.columns:
        latest_date = df[date_col].max()
        latest_snapshot = df[df[date_col] == latest_date]
        per_product_stock = latest_snapshot.groupby(product_col)[inventory_col].sum().to_dict()

    # Fallback total stock if inventory not present
    current_stock_total = int(sum(per_product_stock.values())) if per_product_stock else max(0, int(product_daily["units_sold"].sum() // 2 + 500))

    # Days to stockout (overall)
    days_to_stockout = float(current_stock_total) / avg_daily_sales if avg_daily_sales > 0 else None
    stockout_date = (datetime.now() + timedelta(days=days_to_stockout)).strftime("%Y-%m-%d") if days_to_stockout else "N/A"

    # --- Simplified Stock Status Logic (user preference) ---
    safety_stock = avg_daily_sales * buffer_days
    forecast_total_need = avg_daily_sales * forecast_days
    reorder_qty = int(max(0, round(forecast_total_need + safety_stock - current_stock_total)))
    reorder_point = int(round(avg_daily_sales * lead_time_days + safety_stock))

    # Status:
    # - Understocked: current < forecast need for chosen horizon
    # - Low Stock: current >= forecast need but < (forecast need + safety_stock)
    # - Healthy: current >= forecast need + safety_stock
    if current_stock_total < forecast_total_need:
        stock_status = "Understocked"
    elif current_stock_total < (forecast_total_need + safety_stock):
        stock_status = "Low Stock"
    else:
        stock_status = "Healthy"
    # --- end simplified logic ---

    # Overall forecast (Prophet if available, else mean fallback)
    overall_forecast = []
    try:
        if PROPHET_AVAILABLE and len(overall_daily) >= 10:
            prophet_df = overall_daily.rename(columns={"date": "ds", "units_sold": "y"})
            prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])
            m = Prophet(daily_seasonality=True, yearly_seasonality=True)
            m.fit(prophet_df)
            future = m.make_future_dataframe(periods=forecast_days)
            fc = m.predict(future)
            fc_tail = fc[["ds", "yhat"]].tail(forecast_days)
            overall_forecast = [
                {"ds": row["ds"].strftime("%Y-%m-%d"), "yhat": float(round(row["yhat"], 2))}
                for _, row in fc_tail.iterrows()
            ]
        else:
            last_date = pd.to_datetime(overall_daily["date"].iloc[-1]) if len(overall_daily) else pd.to_datetime(datetime.now())
            mean_val = avg_daily_sales
            overall_forecast = [
                {"ds": (last_date + pd.Timedelta(days=d)).strftime("%Y-%m-%d"), "yhat": float(round(mean_val, 2))}
                for d in range(1, forecast_days + 1)
            ]
    except Exception:
        last_date = pd.to_datetime(overall_daily["date"].iloc[-1]) if len(overall_daily) else pd.to_datetime(datetime.now())
        mean_val = avg_daily_sales
        overall_forecast = [
            {"ds": (last_date + pd.Timedelta(days=d)).strftime("%Y-%m-%d"), "yhat": float(round(mean_val, 2))}
            for d in range(1, forecast_days + 1)
        ]

    # Helper to compute recent mean for a product
    def product_last_mean(prod_df, lookback_days=7):
        if prod_df.empty:
            return 0.0
        tail = prod_df.tail(lookback_days)
        if len(tail) == 0:
            return float(prod_df["units_sold"].mean() or 0.0)
        return float(tail["units_sold"].mean() or 0.0)

    products = product_daily["product"].unique().tolist()

    # Score products by expected demand over the forecast horizon (recent mean * forecast_days)
    product_scores = {}
    for p in products:
        pdf = product_daily[product_daily["product"] == p].sort_values("date")
        last_mean = product_last_mean(pdf, lookback_days=7)
        product_scores[p] = last_mean * forecast_days

    sorted_desc = sorted(product_scores.items(), key=lambda x: x[1], reverse=True)
    sorted_asc = sorted(product_scores.items(), key=lambda x: x[1])

    top_products = sorted_desc[:12]
    bottom_products = sorted_asc[:12]

    def build_product_record(prod_name):
        pdf = product_daily[product_daily["product"] == prod_name].sort_values("date")
        trend_df = pdf.tail(30)
        trend = [{"date": str(r["date"]), "units_sold": int(r["units_sold"])} for _, r in trend_df.iterrows()]
        last_mean = product_last_mean(pdf, lookback_days=7)
        last_date = pd.to_datetime(pdf["date"].iloc[-1]) if not pdf.empty else pd.to_datetime(datetime.now())

        forecast_list = [
            {"ds": (last_date + pd.Timedelta(days=d)).strftime("%Y-%m-%d"), "yhat": float(round(last_mean, 2))}
            for d in range(1, forecast_days + 1)
        ]

        return {
            "product": prod_name,
            "units_sold": int(pdf["units_sold"].sum()) if not pdf.empty else 0,
            "trend": trend,
            "forecast": forecast_list,
            "current_stock": int(per_product_stock.get(prod_name, 0))
        }

    fast_list = [build_product_record(name) for name, _ in top_products]
    slow_list = [build_product_record(name) for name, _ in bottom_products]

    response = {
        "file_name": file_name,
        "sales_trend": overall_daily.to_dict(orient="records"),
        "forecast": overall_forecast,
        "fast_selling": fast_list,
        "slow_selling": slow_list,
        "total_units_sold": int(product_daily["units_sold"].sum()) if not product_daily.empty else 0,
        "current_stock_total": int(current_stock_total),
        "days_to_stockout": round(days_to_stockout, 1) if days_to_stockout is not None else None,
        "stockout_date": stockout_date,
        "reorder_qty": int(reorder_qty),
        "reorder_point": int(reorder_point),
        "reorder_by_date": "N/A",
        "stock_status": stock_status
    }

    return response