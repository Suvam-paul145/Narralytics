#!/usr/bin/env python3
"""
Intelligent Quota Management for Gemini API
Handles rate limits, quota exhaustion, and provides fallback responses
"""

import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class QuotaManagerError(Exception):
    """Custom exception for quota manager errors"""
    pass


class QuotaManager:
    """Manages API quotas and provides intelligent fallbacks"""
    
    # Constants for better maintainability
    DEFAULT_DAILY_LIMIT = 20
    SAFETY_BUFFER = 2
    DEFAULT_RETRY_DELAY = 3600  # 1 hour
    QUOTA_FILE_NAME = "llm_quota_status.json"
    
    def __init__(self, quota_file: Optional[str] = None, daily_limit: int = DEFAULT_DAILY_LIMIT):
        """
        Initialize QuotaManager
        
        Args:
            quota_file: Custom path for quota status file
            daily_limit: Maximum daily requests allowed
        """
        self.quota_file = Path(quota_file or self.QUOTA_FILE_NAME)
        self.daily_limit = daily_limit
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until: Optional[datetime] = None
        
        self.load_quota_status()
    
    def load_quota_status(self) -> None:
        """Load quota status from file with better error handling"""
        try:
            if self.quota_file.exists():
                with self.quota_file.open('r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.daily_requests = data.get('daily_requests', 0)
                    
                    # Parse datetime strings safely
                    last_reset_str = data.get('last_reset', datetime.now().isoformat())
                    self.last_reset = datetime.fromisoformat(last_reset_str)
                    
                    quota_exhausted_str = data.get('quota_exhausted_until')
                    self.quota_exhausted_until = (
                        datetime.fromisoformat(quota_exhausted_str) 
                        if quota_exhausted_str else None
                    )
            else:
                self._initialize_quota()
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to load quota status: {e}. Initializing fresh quota.")
            self._initialize_quota()
        except Exception as e:
            logger.error(f"Unexpected error loading quota status: {e}")
            self._initialize_quota()
    
    def _initialize_quota(self) -> None:
        """Initialize quota with default values"""
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until = None
        self.save_quota_status()
    
    def save_quota_status(self) -> None:
        """Save quota status to file with atomic write"""
        try:
            # Ensure directory exists
            self.quota_file.parent.mkdir(parents=True, exist_ok=True)
            
            data = {
                'daily_requests': self.daily_requests,
                'last_reset': self.last_reset.isoformat(),
                'quota_exhausted_until': (
                    self.quota_exhausted_until.isoformat() 
                    if self.quota_exhausted_until else None
                ),
                'daily_limit': self.daily_limit
            }
            
            # Atomic write using temporary file
            temp_file = self.quota_file.with_suffix('.tmp')
            with temp_file.open('w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            
            temp_file.replace(self.quota_file)
            
        except Exception as e:
            logger.error(f"Failed to save quota status: {e}")
    
    def reset_daily_quota(self) -> None:
        """Reset daily quota counter"""
        self.daily_requests = 0
        self.last_reset = datetime.now()
        self.quota_exhausted_until = None
        self.save_quota_status()
        logger.info("Daily quota reset successfully")
    
    def check_daily_reset(self) -> None:
        """Check if we need to reset daily quota"""
        now = datetime.now()
        if now.date() > self.last_reset.date():
            self.reset_daily_quota()
    
    def is_quota_available(self) -> bool:
        """Check if we have quota available"""
        self.check_daily_reset()
        
        # Check if we're still in exhausted period
        if self.quota_exhausted_until and datetime.now() < self.quota_exhausted_until:
            return False
        
        # Check against daily limit with safety buffer
        return self.daily_requests < (self.daily_limit - self.SAFETY_BUFFER)
    
    def record_request(self) -> None:
        """Record a successful API request"""
        self.daily_requests += 1
        self.save_quota_status()
        logger.debug(f"Recorded request. Daily count: {self.daily_requests}/{self.daily_limit}")
    
    def record_quota_exhausted(self, retry_delay_seconds: int = DEFAULT_RETRY_DELAY) -> None:
        """Record quota exhaustion with retry delay"""
        self.quota_exhausted_until = datetime.now() + timedelta(seconds=retry_delay_seconds)
        self.save_quota_status()
        logger.warning(f"Quota exhausted. Retry available at: {self.quota_exhausted_until}")
    
    def get_quota_status(self) -> Dict[str, Any]:
        """Get current quota status information"""
        self.check_daily_reset()
        return {
            'daily_requests': self.daily_requests,
            'daily_limit': self.daily_limit,
            'requests_remaining': max(0, self.daily_limit - self.daily_requests),
            'quota_available': self.is_quota_available(),
            'quota_exhausted_until': (
                self.quota_exhausted_until.isoformat() 
                if self.quota_exhausted_until else None
            ),
            'last_reset': self.last_reset.isoformat()
        }
    
    def get_fallback_response(self, request_type: str, **kwargs) -> Dict[str, Any]:
        """Generate intelligent fallback responses when quota is exhausted"""
        
        fallback_handlers = {
            "prompt_enhancement": self._get_prompt_enhancement_fallback,
            "auto_dashboard": self._get_auto_dashboard_fallback,
            "chat": self._get_chat_fallback,
            "query_generation": self._get_query_generation_fallback,
            "report_summary": self._get_report_summary_fallback,
        }
        
        handler = fallback_handlers.get(request_type)
        if handler:
            return handler(**kwargs)
        
        return {"error": "Quota exhausted", "fallback": True}
    
    def _get_prompt_enhancement_fallback(self, raw_prompt: str, schema: Dict, **kwargs) -> str:
        """Smart fallback for prompt enhancement"""
        # Use schema information to enhance the prompt without AI
        numeric_cols = schema.get('numeric_columns', [])
        date_cols = schema.get('date_columns', [])
        categorical_cols = schema.get('categorical_columns', [])
        
        enhanced = raw_prompt.lower()
        
        # Simple keyword mapping with better pattern matching
        patterns = [
            (['trend', 'over time'], date_cols, numeric_cols, 
             lambda: f"Show {numeric_cols[0]} trends over {date_cols[0]}"),
            (['total', 'sum'], numeric_cols, None,
             lambda: f"Calculate total {numeric_cols[0]}"),
            (['by', 'group'], categorical_cols and numeric_cols, None,
             lambda: f"Show {numeric_cols[0]} grouped by {categorical_cols[0]}"),
        ]
        
        for keywords, required_cols, secondary_cols, formatter in patterns:
            if any(keyword in enhanced for keyword in keywords) and required_cols:
                if secondary_cols is None or secondary_cols:
                    return formatter()
        
        return raw_prompt  # Return original if no enhancement possible
    
    def _get_auto_dashboard_fallback(self, schema: Dict, **kwargs) -> List[Dict[str, Any]]:
        """Generate basic dashboard without AI"""
        charts = []
        numeric_cols = schema.get('numeric_columns', [])
        date_cols = schema.get('date_columns', [])
        categorical_cols = schema.get('categorical_columns', [])
        
        chart_generators = [
            self._generate_trend_chart,
            self._generate_category_chart,
            self._generate_distribution_chart,
        ]
        
        chart_id = 1
        for generator in chart_generators:
            chart = generator(chart_id, numeric_cols, date_cols, categorical_cols)
            if chart:
                charts.append(chart)
                chart_id += 1
        
        return charts[:6]  # Return up to 6 charts
    
    def _generate_trend_chart(self, chart_id: int, numeric_cols: List[str], 
                            date_cols: List[str], categorical_cols: List[str]) -> Optional[Dict[str, Any]]:
        """Generate trend chart if conditions are met"""
        if not (date_cols and numeric_cols):
            return None
            
        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} Over Time",
            "chart_type": "line",
            "x_key": date_cols[0],
            "y_key": numeric_cols[0],
            "sql": f"SELECT {date_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} FROM data GROUP BY {date_cols[0]} ORDER BY {date_cols[0]}",
            "insight": f"Shows the trend of {numeric_cols[0]} over time",
            "category": "trend"
        }
    
    def _generate_category_chart(self, chart_id: int, numeric_cols: List[str], 
                               date_cols: List[str], categorical_cols: List[str]) -> Optional[Dict[str, Any]]:
        """Generate category breakdown chart if conditions are met"""
        if not (categorical_cols and numeric_cols):
            return None
            
        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} by {categorical_cols[0].title()}",
            "chart_type": "bar",
            "x_key": categorical_cols[0],
            "y_key": numeric_cols[0],
            "sql": f"SELECT {categorical_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} FROM data GROUP BY {categorical_cols[0]} ORDER BY {numeric_cols[0]} DESC",
            "insight": f"Breakdown of {numeric_cols[0]} across different {categorical_cols[0]} categories",
            "category": "comparison"
        }
    
    def _generate_distribution_chart(self, chart_id: int, numeric_cols: List[str], 
                                   date_cols: List[str], categorical_cols: List[str]) -> Optional[Dict[str, Any]]:
        """Generate distribution chart if conditions are met"""
        if not numeric_cols:
            return None
            
        return {
            "chart_id": f"chart_{chart_id}",
            "title": f"{numeric_cols[0].title()} Distribution",
            "chart_type": "bar",
            "x_key": "range",
            "y_key": "count",
            "sql": f"SELECT CASE WHEN {numeric_cols[0]} < (SELECT AVG({numeric_cols[0]}) FROM data) THEN 'Below Average' ELSE 'Above Average' END as range, COUNT(*) as count FROM data GROUP BY range",
            "insight": f"Distribution of {numeric_cols[0]} values",
            "category": "distribution"
        }
    
    def _get_chat_fallback(self, message: str, schema: Dict, **kwargs) -> Dict[str, Any]:
        """Generate basic chat response without AI"""
        numeric_cols = schema.get('numeric_columns', [])
        
        message_lower = message.lower()
        
        # Define response patterns
        response_patterns = [
            (['total'], numeric_cols, 
             f"I can help you calculate the total {numeric_cols[0]}. Due to high demand, I'm using a simplified analysis mode.",
             f"SELECT SUM({numeric_cols[0]}) as total_{numeric_cols[0]} FROM data"),
            (['average'], numeric_cols,
             f"I can show you the average {numeric_cols[0]} from your dataset.",
             f"SELECT AVG({numeric_cols[0]}) as avg_{numeric_cols[0]} FROM data"),
            (['count'], True,
             "I can provide the total number of records in your dataset.",
             "SELECT COUNT(*) as total_records FROM data"),
        ]
        
        for keywords, condition, answer, sql in response_patterns:
            if any(keyword in message_lower for keyword in keywords) and condition:
                return {
                    "answer": answer,
                    "supporting_sql": sql,
                    "needs_data": True,
                    "cannot_answer": False
                }
        
        return {
            "answer": "I'm currently in simplified mode due to high API usage. I can still help with basic data queries like totals, averages, and counts.",
            "cannot_answer": False
        }
    
    def _get_query_generation_fallback(self, prompt: str, schema: Dict, **kwargs) -> Dict[str, Any]:
        """Generate basic query response without AI"""
        numeric_cols = schema.get('numeric_columns', [])
        categorical_cols = schema.get('categorical_columns', [])
        date_cols = schema.get('date_columns', [])
        
        prompt_lower = prompt.lower()
        
        # Simple pattern matching for common queries
        if 'trend' in prompt_lower and date_cols and numeric_cols:
            return {
                "cannot_answer": False,
                "options": [{
                    "label": "Option A",
                    "approach": "Time series analysis using available date and numeric columns",
                    "sql": f"SELECT {date_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} FROM data GROUP BY {date_cols[0]} ORDER BY {date_cols[0]}",
                    "chart_type": "line",
                    "x_key": date_cols[0],
                    "y_key": numeric_cols[0],
                    "title": f"{numeric_cols[0].title()} Trend",
                    "insight": "Basic trend analysis (simplified mode)"
                }]
            }
        
        if categorical_cols and numeric_cols:
            return {
                "cannot_answer": False,
                "options": [{
                    "label": "Option A",
                    "approach": "Category comparison using available columns",
                    "sql": f"SELECT {categorical_cols[0]}, SUM({numeric_cols[0]}) as {numeric_cols[0]} FROM data GROUP BY {categorical_cols[0]} ORDER BY {numeric_cols[0]} DESC LIMIT 10",
                    "chart_type": "bar",
                    "x_key": categorical_cols[0],
                    "y_key": numeric_cols[0],
                    "title": f"{numeric_cols[0].title()} by {categorical_cols[0].title()}",
                    "insight": "Category breakdown (simplified mode)"
                }]
            }
        
        return {
            "cannot_answer": True,
            "reason": "Currently in simplified mode. Please try a basic query like 'show trends' or 'compare by category'."
        }
    
    def _get_report_summary_fallback(self, dataset_name: str, charts: List[Dict], **kwargs) -> str:
        """Generate basic report summary without AI"""
        chart_count = len(charts)
        chart_types = list(set(chart.get('chart_type', 'unknown') for chart in charts))
        
        return f"""Executive Summary for {dataset_name}

This report presents {chart_count} key visualizations analyzing your dataset. The analysis includes {', '.join(chart_types)} charts providing insights into your data patterns and trends.

Key findings are presented in the charts below, showing data relationships and patterns that can inform business decisions.

Note: This summary was generated in simplified mode due to high API usage. For detailed AI-powered insights, please try again later."""


# Global quota manager instance
quota_manager = QuotaManager()