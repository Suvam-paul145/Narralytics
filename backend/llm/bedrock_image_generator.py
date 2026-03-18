"""Amazon Bedrock image generation integration (optional feature)."""

import base64
import json
import io
from typing import Optional

import boto3

from config import settings


def get_bedrock_client():
    """Get Bedrock runtime client."""
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.AWS_REGION or "us-east-1"
    )


def generate_chart_illustration(
    chart_title: str,
    chart_insight: str,
    chart_type: str,
) -> Optional[str]:
    """
    Generate an AI illustration based on chart context using Amazon Nova Canvas.
    
    Args:
        chart_title: Title of the chart
        chart_insight: Data insight/finding
        chart_type: Type of chart (bar, line, pie, etc.)
        
    Returns:
        Base64-encoded PNG image, or None if generation fails
    """
    try:
        client = get_bedrock_client()
        
        # Create artistic prompt from chart context
        prompt = f"""
Create a professional business chart illustration for:
Title: {chart_title}
Type: {chart_type}
Insight: {chart_insight}

Style: Modern, clean, corporate. Use blues, grays, and whites.
Do NOT include actual data points - create an artistic representation of the chart type.
"""
        
        # Call Amazon Nova Canvas (via Bedrock)
        response = client.invoke_model(
            modelId="amazon.nova-canvas-1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {
                    "text": prompt,
                    "negativeText": "blurry, low quality, text heavy"
                },
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "quality": "standard",
                    "cfgScale": 7.5,
                    "height": 512,
                    "width": 768
                }
            })
        )
        
        # Parse response
        response_body = json.loads(response["body"].read())
        images = response_body.get("images", [])
        
        if images:
            return images[0]  # Returns base64-encoded PNG
        return None
        
    except Exception as e:
        print(f"❌ Bedrock image generation failed: {e}")
        return None


def generate_dashboard_banner(
    dataset_name: str,
    chart_count: int,
) -> Optional[str]:
    """Generate a decorative banner for PDF report header."""
    try:
        client = get_bedrock_client()
        
        prompt = f"""
Create a professional business analytics dashboard banner for:
Dataset: {dataset_name}
Charts Generated: {chart_count}

Style: Corporate, modern, minimalist. Blues and whites. No text.
Include subtle chart-like visual elements (bars, lines, pie slices) in background.
"""
        
        response = client.invoke_model(
            modelId="amazon.nova-canvas-1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {
                    "text": prompt,
                },
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "quality": "standard",
                    "cfgScale": 7.5,
                    "height": 200,
                    "width": 1200
                }
            })
        )
        
        response_body = json.loads(response["body"].read())
        images = response_body.get("images", [])
        return images[0] if images else None
        
    except Exception as e:
        print(f"⚠️ Banner generation failed: {e}")
        return None
