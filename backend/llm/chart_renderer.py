"""Chart rendering engine - converts chart specs to images (base64 PNG)."""

import base64
import io
from typing import Any, Optional

import matplotlib.pyplot as plt
import pandas as pd


def render_chart_to_base64(
    chart_spec: dict[str, Any],
    data: list[dict[str, Any]],
) -> Optional[str]:
    """
    Render a chart specification and data to base64-encoded PNG.
    
    Args:
        chart_spec: Chart specification from LLM (contains chart_type, title, etc.)
        data: Chart data (list of rows)
        
    Returns:
        Base64-encoded PNG string, or None if rendering fails
    """
    if not data:
        return None
    
    try:
        df = pd.DataFrame(data)
        chart_type = chart_spec.get("chart_type", "bar").lower()
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
        fig.patch.set_facecolor("#ffffff")
        ax.set_facecolor("#f8f9fa")
        
        # Get keys
        x_key = chart_spec.get("x_key")
        y_key = chart_spec.get("y_key")
        title = chart_spec.get("title", "Chart")
        color_by = chart_spec.get("color_by")
        
        if not x_key or not y_key:
            return None
        
        # Ensure columns exist
        if x_key not in df.columns or y_key not in df.columns:
            return None
        
        # Render based on chart type
        if chart_type == "bar":
            _render_bar_chart(ax, df, x_key, y_key, color_by)
        elif chart_type == "line":
            _render_line_chart(ax, df, x_key, y_key, color_by)
        elif chart_type == "pie":
            _render_pie_chart(ax, df, x_key, y_key)
        elif chart_type == "scatter":
            _render_scatter_chart(ax, df, x_key, y_key, color_by)
        else:
            # Default to bar
            _render_bar_chart(ax, df, x_key, y_key, color_by)
        
        # Set title and labels
        ax.set_title(title, fontsize=14, fontweight="bold", pad=20)
        ax.set_xlabel(x_key, fontsize=11, fontweight="500")
        ax.set_ylabel(y_key, fontsize=11, fontweight="500")
        
        # Style improvements
        ax.grid(axis="y", alpha=0.3, linestyle="--")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        
        # Rotate x labels if needed
        if len(df) > 5:
            plt.xticks(rotation=45, ha="right")
        
        plt.tight_layout()
        
        # Convert to base64
        buffer = io.BytesIO()
        fig.savefig(buffer, format="png", bbox_inches="tight")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        
        plt.close(fig)
        
        return image_base64
        
    except Exception as e:
        print(f"❌ Chart rendering failed: {e}")
        return None


def _render_bar_chart(ax, df: pd.DataFrame, x_key: str, y_key: str, color_by: Optional[str]):
    """Render bar chart."""
    if color_by and color_by in df.columns:
        # Grouped bar chart
        grouped = df.groupby([x_key, color_by])[y_key].sum().unstack(fill_value=0)
        grouped.plot(kind="bar", ax=ax, width=0.8)
        ax.legend(title=color_by, bbox_to_anchor=(1.05, 1), loc="upper left")
    else:
        # Simple bar chart
        bar_data = df.groupby(x_key)[y_key].sum()
        ax.bar(range(len(bar_data)), bar_data.values, color="#4338ca", alpha=0.8, edgecolor="#3730a3")
        ax.set_xticks(range(len(bar_data)))
        ax.set_xticklabels(bar_data.index)


def _render_line_chart(ax, df: pd.DataFrame, x_key: str, y_key: str, color_by: Optional[str]):
    """Render line chart."""
    if color_by and color_by in df.columns:
        # Multiple lines
        for category in df[color_by].unique():
            subset = df[df[color_by] == category].sort_values(x_key)
            ax.plot(subset[x_key], subset[y_key], marker="o", label=str(category), linewidth=2)
        ax.legend(title=color_by)
    else:
        # Single line
        sorted_df = df.sort_values(x_key)
        ax.plot(sorted_df[x_key], sorted_df[y_key], marker="o", color="#4338ca", linewidth=2.5, markersize=6)


def _render_pie_chart(ax, df: pd.DataFrame, x_key: str, y_key: str):
    """Render pie chart."""
    pie_data = df.groupby(x_key)[y_key].sum().head(6)  # Limit to 6 segments
    colors = plt.cm.Set3(range(len(pie_data)))
    ax.pie(pie_data.values, labels=pie_data.index, autopct="%1.1f%%", colors=colors, startangle=90)
    ax.axis("equal")


def _render_scatter_chart(ax, df: pd.DataFrame, x_key: str, y_key: str, color_by: Optional[str]):
    """Render scatter chart."""
    if color_by and color_by in df.columns:
        # Colored by category
        for category in df[color_by].unique():
            subset = df[df[color_by] == category]
            ax.scatter(subset[x_key], subset[y_key], label=str(category), s=80, alpha=0.7)
        ax.legend(title=color_by)
    else:
        ax.scatter(df[x_key], df[y_key], s=80, color="#4338ca", alpha=0.7, edgecolors="#3730a3")
