import pandas as pd

def get_nepali_holidays():
    holidays = {
        "holiday": [
            "Dashain",
            "Tihar",
            "New Year"
        ],
        "ds": [
            "2024-10-10",
            "2024-11-03",
            "2024-04-14"
        ]
    }

    # Convert to DataFrame and ensure ds column is datetime
    holidays_df = pd.DataFrame(holidays)
    holidays_df["ds"] = pd.to_datetime(holidays_df["ds"])

    return holidays_df