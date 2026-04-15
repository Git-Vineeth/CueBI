from __future__ import annotations
"""
CueBI — Chart Recommender
Analyses the SQL result shape and recommends the best chart type.
Returns an ECharts-compatible config that the frontend renders directly.

Logic:
- 2 cols, col1 = date/time, col2 = numeric  →  Line chart
- 2 cols, col1 = category, col2 = numeric   →  Bar chart (horizontal if > 8 items)
- 2 cols, numeric/numeric                   →  Scatter
- 1 col numeric + context implies "parts"   →  Pie chart
- 3+ cols                                   →  Grouped bar or table
- Default                                   →  Table (always safe)
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ChartConfig:
    chart_type: str                     # line | bar | bar_horizontal | pie | scatter | table
    title: str = ""
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    x_data: list[Any] = field(default_factory=list)
    series: list[dict] = field(default_factory=list)
    echarts_option: dict = field(default_factory=dict)  # ready-to-use ECharts option


# ── Date/time detection helpers ───────────────────────────────

DATE_KEYWORDS = {
    "date", "time", "month", "year", "week", "day", "quarter",
    "created_at", "updated_at", "timestamp", "period", "fy", "fiscal"
}
NUMERIC_TYPES = {"int", "float", "numeric", "decimal", "double", "bigint", "real"}


def _looks_like_date(col_name: str, values: list[Any]) -> bool:
    name_lower = col_name.lower()
    if any(kw in name_lower for kw in DATE_KEYWORDS):
        return True
    if values:
        sample = str(values[0])
        if len(sample) >= 7 and ("-" in sample or "/" in sample):
            return True
    return False


def _looks_like_numeric(values: list[Any]) -> bool:
    if not values:
        return False
    try:
        float(str(values[0]))
        return True
    except (ValueError, TypeError):
        return False


def _looks_like_part_of_whole(col_name: str) -> bool:
    """Detects columns that imply 'share of total' (good for pie charts)."""
    keywords = {"category", "type", "status", "region", "state", "city", "channel", "source", "product"}
    return any(kw in col_name.lower() for kw in keywords)


# ── Main recommender ──────────────────────────────────────────

def recommend_chart(
    columns: list[str],
    rows: list[list[Any]],
    question: str = "",
) -> ChartConfig:
    """
    Recommend the best chart for a given result set.

    Args:
        columns: Column names from the SQL result
        rows: Row data from the SQL result
        question: Original question (used for context hints)

    Returns:
        ChartConfig with chart_type and ready-to-use echarts_option
    """
    if not columns or not rows:
        return ChartConfig(chart_type="table", title="No data")

    n_cols = len(columns)
    n_rows = len(rows)
    col1 = columns[0]
    col1_values = [r[0] for r in rows]

    question_lower = question.lower()
    pie_hints = {"breakdown", "distribution", "share", "proportion", "split", "by category", "by type", "by state", "by region"}
    wants_pie = any(h in question_lower for h in pie_hints)

    # ── 2-column results ──────────────────────────────────────
    if n_cols == 2:
        col2 = columns[1]
        col2_values = [r[1] for r in rows]
        col2_numeric = _looks_like_numeric(col2_values)

        if col2_numeric:
            x_labels = [str(v) for v in col1_values]
            y_values = [_to_number(v) for v in col2_values]

            # Time series → line
            if _looks_like_date(col1, col1_values):
                return _make_line_chart(col1, col2, x_labels, y_values)

            # Pie for category breakdowns (≤ 10 slices looks good)
            if (wants_pie or _looks_like_part_of_whole(col1)) and n_rows <= 10:
                return _make_pie_chart(col2, x_labels, y_values)

            # Horizontal bar if many categories
            if n_rows > 8:
                return _make_bar_chart(col1, col2, x_labels, y_values, horizontal=True)

            # Standard bar
            return _make_bar_chart(col1, col2, x_labels, y_values)

    # ── Single numeric column (e.g. SELECT COUNT(*)) ──────────
    if n_cols == 1 and rows:
        return ChartConfig(
            chart_type="table",
            title=columns[0],
            echarts_option={},
        )

    # ── 3+ columns → grouped bar (first col = X, rest = series) ─
    if n_cols >= 3:
        x_labels = [str(r[0]) for r in rows]
        series = []
        for i, col in enumerate(columns[1:], 1):
            y_vals = [_to_number(r[i]) for r in rows]
            series.append({"name": col, "type": "bar", "data": y_vals})

        if _looks_like_date(columns[0], [r[0] for r in rows]):
            for s in series:
                s["type"] = "line"

        option = {
            "tooltip": {"trigger": "axis"},
            "legend": {"data": columns[1:]},
            "xAxis": {"type": "category", "data": x_labels, "axisLabel": {"rotate": 30 if len(x_labels) > 6 else 0}},
            "yAxis": {"type": "value"},
            "series": series,
        }
        return ChartConfig(
            chart_type="grouped_bar",
            title=f"{columns[0]} comparison",
            x_axis=columns[0],
            echarts_option=option,
        )

    # Default: table
    return ChartConfig(chart_type="table", title="Result")


# ── Chart builders ────────────────────────────────────────────

def _make_line_chart(x_col, y_col, x_labels, y_values) -> ChartConfig:
    option = {
        "tooltip": {"trigger": "axis"},
        "xAxis": {"type": "category", "data": x_labels, "axisLabel": {"rotate": 30}},
        "yAxis": {"type": "value", "name": y_col},
        "series": [{"name": y_col, "type": "line", "data": y_values, "smooth": True}],
        "grid": {"left": "10%", "right": "5%", "bottom": "15%"},
    }
    return ChartConfig(
        chart_type="line",
        title=f"{y_col} over {x_col}",
        x_axis=x_col,
        y_axis=y_col,
        x_data=x_labels,
        series=[{"name": y_col, "data": y_values}],
        echarts_option=option,
    )


def _make_bar_chart(x_col, y_col, x_labels, y_values, horizontal=False) -> ChartConfig:
    if horizontal:
        option = {
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {"type": "value", "name": y_col},
            "yAxis": {"type": "category", "data": x_labels, "inverse": True},
            "series": [{"name": y_col, "type": "bar", "data": y_values}],
            "grid": {"left": "20%", "right": "5%"},
        }
        chart_type = "bar_horizontal"
    else:
        option = {
            "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
            "xAxis": {"type": "category", "data": x_labels, "axisLabel": {"rotate": 30 if len(x_labels) > 5 else 0}},
            "yAxis": {"type": "value", "name": y_col},
            "series": [{"name": y_col, "type": "bar", "data": y_values}],
            "grid": {"left": "10%", "right": "5%", "bottom": "15%"},
        }
        chart_type = "bar"

    return ChartConfig(
        chart_type=chart_type,
        title=f"{y_col} by {x_col}",
        x_axis=x_col,
        y_axis=y_col,
        x_data=x_labels,
        series=[{"name": y_col, "data": y_values}],
        echarts_option=option,
    )


def _make_pie_chart(label_col, labels, values) -> ChartConfig:
    pie_data = [{"name": l, "value": v} for l, v in zip(labels, values)]
    option = {
        "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
        "legend": {"orient": "vertical", "left": "left"},
        "series": [{
            "type": "pie",
            "radius": "60%",
            "data": pie_data,
            "emphasis": {"itemStyle": {"shadowBlur": 10}},
        }],
    }
    return ChartConfig(
        chart_type="pie",
        title=f"{label_col} breakdown",
        echarts_option=option,
    )


def _to_number(v: Any) -> float:
    try:
        return float(str(v).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0