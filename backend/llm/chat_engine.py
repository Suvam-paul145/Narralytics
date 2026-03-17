import json
import logging
from functools import lru_cache
from typing import Dict, List, Optional, Union

from google import genai

from config import settings
from llm.genai_client import generate_with_retry
from llm.quota_manager import quota_manager

# Configure logger for this module
logger = logging.getLogger(__name__)


class ChatEngineError(Exception):
    """Custom exception for chat engine specific errors"""
    pass


class JSONParsingError(ChatEngineError):
    """Raised when JSON parsing fails"""
    pass


@lru_cache(maxsize=1)
def _get_client() -> genai.Client:
    """Get the Google GenAI client with API key configuration
    
    Returns:
        genai.Client: Configured Google GenAI client
        
    Raises:
        RuntimeError: If GEMINI_API_KEY is not configured
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _parse_json_payload(raw: str) -> Dict:
    """Parse JSON from model response, handling various formats
    
    Args:
        raw: Raw response text from the model
        
    Returns:
        Dict: Parsed JSON data
        
    Raises:
        JSONParsingError: If JSON parsing fails
    """
    if not raw or not raw.strip():
        raise JSONParsingError("Empty response from model")
        
    text = raw.strip()
    
    # Handle code block format
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) < 2:
            raise JSONParsingError("Malformed code block in response")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:].strip()
    
    # Find JSON boundaries
    start = text.find("{")
    end = text.rfind("}")
    
    if start == -1 or end == -1 or start >= end:
        raise JSONParsingError("No valid JSON object found in response")
    
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        raise JSONParsingError(f"Invalid JSON format: {e}") from e


def build_chat_system_prompt(schema: Dict, dataset_filename: str) -> str:
    """Build system prompt for chat interactions
    
    Args:
        schema: Dataset schema information
        dataset_filename: Name of the dataset file
        
    Returns:
        str: Formatted system prompt
    """
    # Validate required schema fields
    required_fields = ['columns', 'row_count', 'date_columns', 'numeric_columns', 'categorical_columns']
    missing_fields = [field for field in required_fields if field not in schema]
    if missing_fields:
        logger.warning(f"Missing schema fields: {missing_fields}")
    
    # Build columns summary with error handling
    columns_summary = "No columns available"
    if schema.get("columns"):
        try:
            columns_summary = ", ".join([
                f"{column['name']} ({column.get('dtype', 'unknown')})" 
                for column in schema["columns"]
            ])
        except (KeyError, TypeError) as e:
            logger.error(f"Error building columns summary: {e}")
            columns_summary = "Column information unavailable"
    
    return f"""
You are a senior business analyst embedded in a BI platform.
You are answering questions about a dataset called "{dataset_filename}".

=== DATASET CONTEXT ===
Rows: {schema.get('row_count', 0)}
Columns: {columns_summary}
Date columns: {', '.join(schema.get('date_columns', []))}
Numeric columns: {', '.join(schema.get('numeric_columns', []))}
Categorical columns: {', '.join(schema.get('categorical_columns', []))}

SQL table name: data

=== YOUR BEHAVIOR ===
1. Answer in 2-4 sentences of executive-ready language
2. If the question requires specific numbers, generate a supporting SQL query
3. For explicit forecast requests, set needs_forecast=true
4. If the dataset cannot answer the question, say exactly what is missing
5. Maintain conversation context for natural follow-ups
6. Never invent statistics

=== OUTPUT ===
Return valid JSON only:
{{
  "cannot_answer": false,
  "answer": "2-4 sentence response",
  "supporting_sql": "SELECT ... or null",
  "needs_data": true,
  "needs_forecast": false
}}
Or:
{{ "cannot_answer": true, "reason": "specific explanation" }}
"""


def get_chat_response(
    schema: Dict, 
    dataset_filename: str, 
    message: str, 
    history: List[Dict]
) -> Dict:
    """Generate chat response using AI model with fallback handling
    
    Args:
        schema: Dataset schema information
        dataset_filename: Name of the dataset file
        message: User's message/question
        history: Conversation history
        
    Returns:
        Dict: Response containing answer or error information
    """
    if not message or not message.strip():
        return {
            "cannot_answer": True, 
            "reason": "Empty message provided"
        }
    
    try:
        system_prompt = build_chat_system_prompt(schema, dataset_filename)
        
        # Convert history to new format with validation
        contents = []
        valid_history = history[-10:] if history else []  # Limit history for performance
        
        for turn in valid_history:
            if not isinstance(turn, dict) or 'role' not in turn or 'content' not in turn:
                logger.warning(f"Invalid history turn format: {turn}")
                continue
                
            contents.append({
                "role": turn["role"],
                "parts": [{"text": turn["content"]}]
            })
        
        # Add current message
        contents.append({
            "role": "user", 
            "parts": [{"text": f"{system_prompt}\n\nUser: {message}"}]
        })

        client = _get_client()
        response = generate_with_retry(
            client=client,
            model='models/gemini-2.5-flash',
            contents=contents
        )
        
        return _parse_json_payload(response.text)
        
    except JSONParsingError as e:
        logger.error(f"JSON parsing failed: {e}")
        return {
            "cannot_answer": True, 
            "reason": "Failed to parse AI response format"
        }
    except Exception as exc:
        logger.error(f"Chat engine failed: {exc}")
        
        # Use intelligent fallback if quota exhausted
        if "QUOTA_EXHAUSTED" in str(exc):
            logger.info("Using quota manager fallback for chat response")
            return quota_manager.get_fallback_response(
                "chat", 
                message=message, 
                schema=schema
            )
        
        return {
            "cannot_answer": True, 
            "reason": f"AI service error: {str(exc)}"
        }


def refine_chat_answer(
    dataset_filename: str,
    question: str,
    draft_answer: str,
    sql_result: List[Dict],
) -> str:
    """Refine chat answer using SQL query results
    
    Args:
        dataset_filename: Name of the dataset file
        question: Original user question
        draft_answer: Initial AI-generated answer
        sql_result: Results from SQL query execution
        
    Returns:
        str: Refined answer incorporating SQL results
    """
    if not sql_result:
        logger.warning("No SQL results provided for answer refinement")
        return draft_answer
    
    # Limit result size for performance and token efficiency
    limited_results = sql_result[:10]
    
    prompt = f"""
You are refining an analyst answer for dataset "{dataset_filename}".

Question: {question}
Draft answer: {draft_answer}
SQL result rows: {json.dumps(limited_results, default=str)}

Rewrite the answer in 2-4 sentences using the exact figures from the SQL result.
Return only the final answer text.
"""
    
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model='models/gemini-2.5-flash',
            contents=[{"role": "user", "parts": [{"text": prompt}]}]
        )
        
        refined_answer = response.text.strip()
        if not refined_answer:
            logger.warning("Empty response from refinement, using draft answer")
            return draft_answer
            
        return refined_answer
        
    except Exception as e:
        logger.error(f"Answer refinement failed: {e}")
        
        # Use intelligent fallback if quota exhausted
        if "QUOTA_EXHAUSTED" in str(e):
            logger.info("Using fallback refinement due to quota exhaustion")
            return f"Based on the data analysis: {draft_answer}"
        
        return draft_answer
