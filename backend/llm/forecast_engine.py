import numpy as np

from sqlite.executor import execute_query


def generate_simple_forecast(db_path: str, historical_sql: str, periods: int = 3) -> dict:
    try:
        data = execute_query(db_path, historical_sql)
        if len(data) < 4:
            return {
                "success": False,
                "reason": "Not enough historical data points for a reliable forecast (need at least 4)",
            }

        keys = list(data[0].keys())
        x_key = keys[0]
        y_key = keys[1]

        x_values = list(range(len(data)))
        y_values = [float(row[y_key]) for row in data]

        slope, intercept = np.polyfit(x_values, y_values, 1)

        forecast_points = []
        for index in range(1, periods + 1):
            x_future = len(data) + index - 1
            y_forecast = slope * x_future + intercept
            margin = abs(y_forecast) * 0.15
            forecast_points.append(
                {
                    "period": f"Forecast +{index}",
                    "value": round(y_forecast, 2),
                    "lower_bound": round(y_forecast - margin, 2),
                    "upper_bound": round(y_forecast + margin, 2),
                }
            )

        return {
            "success": True,
            "historical": data,
            "forecast": forecast_points,
            "method": "Linear extrapolation",
            "confidence_note": "Estimate based on historical trend. +/-15% confidence range shown.",
            "disclaimer": "This is a statistical estimate, not a guaranteed prediction.",
            "y_key": y_key,
            "x_key": x_key,
        }
    except Exception as exc:
        return {"success": False, "reason": str(exc)}
