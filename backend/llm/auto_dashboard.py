import json
import logging
from functools import lru_cache
from typing import Dict, List, Optional, Any

from google import genai

from config import settings
from llm.genai_client import generate_with_retry
from llm.quota_manager import quota_manager

logger = logging.getLogger(__name__)

# Constants for better maintainability
DEFAULT_MODEL = "gemini-2.5-flash"
MIN_CHARTS = 6
MAX_CHARTS = 10
MAX_PIE_CATEGORIES = 6
TABLE_NAME = "data"

# Chart type constants
CHART_TYPES = {
    "LINE": "line",
    "BAR": "bar", 
    "PIE": "pie",
    "SCATTER": "scatter"
}

# Data type constants
DTYPE_NUMERIC = "numeric"
DTYPE_DATETIME = "datetime"
DTYPE_CATEGORICAL = "categorical"


@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    """Get the Google GenAI client with API key configuration.
    
    Returns:
        genai.Client: Configured GenAI client
        
    Raises:
        RuntimeError: If GEMINI_API_KEY is not configured
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    
    try:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize GenAI client: {e}")
        raise RuntimeError(f"GenAI client initialization failed: {e}") from e


def _parse_json_payload(raw: str) -> Dict[str, Any]:
    """Parse JSON payload from model response, handling markdown code blocks.
    
    Args:
        raw: Raw response text from the model
        
    Returns:
        Dict[str, Any]: Parsed JSON payload
        
    Raises:
        ValueError: If no valid JSON is found in the response
        json.JSONDecodeError: If JSON parsing fails
    """
    if not raw or not raw.strip():
        raise ValueError("Empty or whitespace-only response")
    
    text = raw.strip()
    
    # Handle markdown code blocks
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 3:  # Proper markdown block
            text = parts[1]
            # Remove language identifier if present
            if text.startswith("json"):
                text = text[4:].strip()
        else:
            # Malformed markdown, try to extract content
            text = text[3:].strip()
    
    # Find JSON boundaries
    start = text.find("{")
    end = text.rfind("}")
    
    if start == -1 or end == -1 or start >= end:
        raise ValueError("Model response did not contain valid JSON boundaries")
    
    json_text = text[start:end + 1]
    
    try:
        parsed = json.loads(json_text)
        if not isinstance(parsed, dict):
            raise ValueError("JSON response is not a dictionary")
        return parsed
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {json_text[:200]}...")
        raise ValueError(f"Invalid JSON in model response: {e}") from e


def _format_column_info(column: Dict[str, Any]) -> str:
    """Format column information for the prompt.
    
    Args:
        column: Column metadata dictionary
        
    Returns:
        str: Formatted column description
    """
    if not column or "name" not in column or "dtype" not in column:
        return "  - [Invalid column data]"
    
    base_info = f"  - {column['name']} ({column['dtype']})"
    dtype = column["dtype"]
    
    if dtype == DTYPE_NUMERIC:
        min_val = column.get('min')
        max_val = column.get('max')
        if min_val is not None and max_val is not None:
            base_info += f" range: {min_val} to {max_val}"
    elif dtype == DTYPE_DATETIME:
        min_date = column.get('min_date')
        max_date = column.get('max_date')
        if min_date and max_date:
            base_info += f" dates: {min_date} to {max_date}"
    elif dtype == DTYPE_CATEGORICAL:
        sample_values = column.get('sample_values', [])
        if sample_values:
            # Limit samples to avoid overly long prompts
            samples = ', '.join(str(val) for val in sample_values[:3])
            base_info += f" samples: {samples}"
            if len(sample_values) > 3:
                base_info += f" (+{len(sample_values) - 3} more)"
    
    return base_info


def _validate_schema(schema: Dict[str, Any]) -> bool:
    """Validate that the schema contains required fields.
    
    Args:
        schema: Dataset schema to validate
        
    Returns:
        bool: True if schema is valid, False otherwise
    """
    required_fields = ["columns", "row_count", "date_columns", "numeric_columns", "categorical_columns"]
    
    if not isinstance(schema, dict):
        return False
    
    for field in required_fields:
        if field not in schema:
            logger.warning(f"Schema missing required field: {field}")
            return False
    
    columns = schema.get("columns", [])
    if not isinstance(columns, list) or not columns:
        logger.warning("Schema has no valid columns")
        return False
    
    return True


def build_auto_dashboard_prompt(schema: Dict[str, Any]) -> str:
    """Build the prompt for auto-dashboard generation.
    
    Args:
        schema: Dataset schema containing columns and metadata
        
    Returns:
        str: Formatted prompt for the LLM
        
    Raises:
        ValueError: If schema is invalid
    """
    if not _validate_schema(schema):
        raise ValueError("Invalid schema provided")
    
    columns_text = "\n".join(_format_column_info(column) for column in schema["columns"])
    row_count = schema.get("row_count", 0)
    
    # Format column lists safely
    date_cols = ", ".join(schema.get("date_columns", [])) or "None"
    numeric_cols = ", ".join(schema.get("numeric_columns", [])) or "None"  
    categorical_cols = ", ".join(schema.get("categorical_columns", [])) or "None"

    return f"""
You are a senior BI analyst generating an automatic dashboard for a newly uploaded dataset.

=== DATASET INFO ===
Total rows: {row_count:,}
Columns:
{columns_text}

Date columns: {date_cols}
Numeric columns: {numeric_cols}
Categorical columns: {categorical_cols}

=== YOUR TASK ===
Generate between {MIN_CHARTS} and {MAX_CHARTS} chart specifications that cover the most valuable business insights
this dataset can reveal. Cover a variety of chart types.

Priority order:
1. Time-series trends (if date columns exist)
2. Category comparisons (if categorical + numeric exist)
3. Distributions and proportions
4. Correlations between numeric columns
5. Top-N rankings

=== RULES ===
- Only use columns listed above, exact names only
- {CHART_TYPES["LINE"]} chart: time-based X axis only
- {CHART_TYPES["BAR"]} chart: categorical X axis, numeric Y axis
- {CHART_TYPES["PIE"]} chart: max {MAX_PIE_CATEGORIES} categories, add LIMIT {MAX_PIE_CATEGORIES} to SQL
- {CHART_TYPES["SCATTER"]} chart: two numeric columns
- All SQL queries must target table named exactly: {TABLE_NAME}
- Always ROUND aggregated floats: ROUND(SUM(col), 2) AS col
- Always alias aggregations
- DO NOT include forecasting or predictions
- DO NOT fabricate data or insights

=== OUTPUT ===
Return valid JSON only:
{{
  "charts": [
    {{
      "chart_id": "c1",
      "title": "Short executive title",
      "chart_type": "{CHART_TYPES["BAR"]}|{CHART_TYPES["LINE"]}|{CHART_TYPES["PIE"]}|{CHART_TYPES["SCATTER"]}",
      "sql": "SELECT ...",
      "x_key": "column_name",
      "y_key": "column_name",
      "color_by": null,
      "insight": "One sentence business finding with a specific number",
      "category": "trend|comparison|distribution|correlation|ranking"
    }}
  ]
}}
"""


def _validate_chart_response(charts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Validate and filter chart specifications from the model response.
    
    Args:
        charts: List of chart specifications from the model
        
    Returns:
        List[Dict[str, Any]]: Validated chart specifications
    """
    if not isinstance(charts, list):
        logger.warning("Charts response is not a list")
        return []
    
    valid_charts = []
    required_fields = {"chart_id", "title", "chart_type", "sql"}
    valid_chart_types = set(CHART_TYPES.values())
    
    for i, chart in enumerate(charts):
        if not isinstance(chart, dict):
            logger.warning(f"Chart {i} is not a dictionary")
            continue
            
        # Check required fields
        missing_fields = required_fields - set(chart.keys())
        if missing_fields:
            logger.warning(f"Chart {i} missing required fields: {missing_fields}")
            continue
            
        # Validate chart type
        chart_type = chart.get("chart_type", "").lower()
        if chart_type not in valid_chart_types:
            logger.warning(f"Chart {i} has invalid chart_type: {chart_type}")
            continue
            
        # Basic SQL validation
        sql = chart.get("sql", "").strip()
        if not sql or not sql.upper().startswith("SELECT"):
            logger.warning(f"Chart {i} has invalid SQL: {sql[:50]}...")
            continue
            
        valid_charts.append(chart)
    
    return valid_charts


def generate_auto_dashboard(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate automatic dashboard charts based on dataset schema.
    
    Args:
        schema: Dataset schema containing columns and metadata
        
    Returns:
        List[Dict[str, Any]]: List of validated chart specifications, empty list on failure
    """
    if not schema:
        logger.warning("No schema provided")
        return []
    
    try:
        prompt = build_auto_dashboard_prompt(schema)
    except ValueError as e:
        logger.error(f"Invalid schema: {e}")
        return []
    
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model=DEFAULT_MODEL,
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        
        if not response or not response.text:
            logger.error("Empty response from GenAI model")
            return []
        
        payload = _parse_json_payload(response.text)
        raw_charts = payload.get("charts", [])
        
        if not raw_charts:
            logger.warning("No charts found in model response")
            return []
        
        # Validate and filter charts
        valid_charts = _validate_chart_response(raw_charts)
        
        if not valid_charts:
            logger.warning("No valid charts after validation")
        else:
            logger.info(f"Successfully generated {len(valid_charts)} valid chart specifications")
        
        return valid_charts
        
    except RuntimeError as e:
        logger.error(f"Configuration error: {e}")
        return []
    except ValueError as e:
        logger.error(f"Response parsing error: {e}")
        return []
    except Exception as e:
        logger.exception(f"Auto-dashboard generation failed: {e}")
        
        # Use intelligent fallback if quota exhausted
        if "QUOTA_EXHAUSTED" in str(e):
            logger.info("Using fallback dashboard generation due to quota exhaustion")
            return quota_manager.get_fallback_response("auto_dashboard", schema=schema)
        
        return []
