"""
MCP Server for Klaviyo Customer Segmentation

This server exposes tools for analyzing customer data from Klaviyo,
segmenting customers, and generating marketing automation outputs.
"""

import asyncio
import json
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .klaviyo_client import KlaviyoClient
from .segmentation.classifier import SegmentClassifier
from .segmentation.thresholds import ThresholdCalculator
from .segmentation.hypotheses import HypothesisGenerator
from .segmentation.microsegments import MicroSegmenter
from .creative.briefs import BriefGenerator
from .creative.guardrails import BrandGuardrails
from .creative.image_prompts import ImagePromptBuilder
from .output.formatters import OutputFormatter

# Initialize the MCP server
server = Server("klaviyo-segmentation")

# Global state for the current analysis session
_session_state: dict[str, Any] = {}


def get_klaviyo_client() -> KlaviyoClient:
    """Get Klaviyo client with API key from environment."""
    api_key = os.environ.get("KLAVIYO_API_KEY")
    if not api_key:
        raise ValueError(
            "KLAVIYO_API_KEY environment variable is required. "
            "Set it in your MCP server configuration."
        )
    return KlaviyoClient(api_key)


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available segmentation tools."""
    return [
        Tool(
            name="analyze_segments",
            description=(
                "Run the full VIP segmentation pipeline on a Klaviyo account. "
                "Fetches all profiles and events, calculates dynamic thresholds, "
                "classifies customers into 9 segments (VIP, Loyal Repeat, High Potential, "
                "At Risk, Churned, One-Time Buyers, Discount-Driven, Engaged Non-Buyer, "
                "Cold Subscribers), generates hypotheses, and creates micro-segments. "
                "Returns a summary with segment counts and key insights."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "list_id": {
                        "type": "string",
                        "description": "Optional Klaviyo list ID to filter profiles. If not provided, analyzes all profiles.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of profiles to analyze (default: 10000, max: 100000)",
                        "default": 10000,
                    },
                    "include_events_days": {
                        "type": "integer",
                        "description": "Number of days of event history to fetch (default: 365)",
                        "default": 365,
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="get_segment_summary",
            description=(
                "Get a summary of the most recent segmentation analysis. "
                "Returns counts, percentages, and key metrics for each segment. "
                "Must run analyze_segments first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "segment_name": {
                        "type": "string",
                        "description": "Optional specific segment to get details for (e.g., 'VIP', 'At Risk')",
                        "enum": [
                            "VIP",
                            "Loyal Repeat",
                            "High Potential",
                            "At Risk",
                            "Churned",
                            "One-Time Buyers",
                            "Discount-Driven",
                            "Engaged Non-Buyer",
                            "Cold Subscribers",
                        ],
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="generate_creative_briefs",
            description=(
                "Generate marketing creative briefs for specified segments. "
                "Includes messaging strategy, subject lines, headlines, body copy, "
                "visual guidance, and AI image generation prompts. "
                "Must run analyze_segments first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "segments": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": [
                                "VIP",
                                "Loyal Repeat",
                                "High Potential",
                                "At Risk",
                                "Churned",
                                "One-Time Buyers",
                                "Discount-Driven",
                                "Engaged Non-Buyer",
                                "Cold Subscribers",
                            ],
                        },
                        "description": "List of segments to generate briefs for. If empty, generates for all segments.",
                    },
                    "brand_voice": {
                        "type": "string",
                        "description": "Brand voice/tone to use (e.g., 'professional', 'friendly', 'luxury')",
                        "default": "professional",
                    },
                    "include_image_prompts": {
                        "type": "boolean",
                        "description": "Whether to include AI image generation prompts",
                        "default": True,
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="export_ops_csv",
            description=(
                "Export segmentation results as an ops-ready CSV for ESP activation. "
                "Includes segment assignments, creative copy, and campaign metadata. "
                "Must run analyze_segments first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "include_profiles": {
                        "type": "boolean",
                        "description": "Whether to include individual profile rows (can be large)",
                        "default": False,
                    },
                    "format": {
                        "type": "string",
                        "description": "Output format",
                        "enum": ["csv", "json", "klaviyo_import"],
                        "default": "csv",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="get_customer_analysis",
            description=(
                "Analyze a single customer by email or profile ID. "
                "Returns their segment, micro-segments, hypotheses, and recommended actions."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Customer email address",
                    },
                    "profile_id": {
                        "type": "string",
                        "description": "Klaviyo profile ID",
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="get_segment_hypotheses",
            description=(
                "Get testable marketing hypotheses for segments. "
                "Each hypothesis includes the hypothesis statement, test methodology, "
                "expected lift, and KPIs to measure. Must run analyze_segments first."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "segment_name": {
                        "type": "string",
                        "description": "Specific segment to get hypotheses for",
                        "enum": [
                            "VIP",
                            "Loyal Repeat",
                            "High Potential",
                            "At Risk",
                            "Churned",
                            "One-Time Buyers",
                            "Discount-Driven",
                            "Engaged Non-Buyer",
                            "Cold Subscribers",
                        ],
                    },
                },
                "required": [],
            },
        ),
        Tool(
            name="configure_thresholds",
            description=(
                "View or customize the threshold configuration used for segmentation. "
                "Thresholds determine segment boundaries (e.g., what revenue makes a VIP). "
                "By default, thresholds are calculated dynamically from your data."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "show_current": {
                        "type": "boolean",
                        "description": "Show current threshold values",
                        "default": True,
                    },
                    "custom_thresholds": {
                        "type": "object",
                        "description": "Custom threshold overrides",
                        "properties": {
                            "vip_revenue_percentile": {
                                "type": "number",
                                "description": "Percentile for VIP revenue threshold (default: 90)",
                            },
                            "churn_days": {
                                "type": "integer",
                                "description": "Days since last order to consider churned (default: 180)",
                            },
                            "at_risk_days": {
                                "type": "integer",
                                "description": "Days since last order to consider at risk (default: 90)",
                            },
                            "high_discount_threshold": {
                                "type": "number",
                                "description": "Average discount % to flag as discount-driven (default: 0.25)",
                            },
                        },
                    },
                },
                "required": [],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    global _session_state

    try:
        if name == "analyze_segments":
            return await _analyze_segments(arguments)
        elif name == "get_segment_summary":
            return await _get_segment_summary(arguments)
        elif name == "generate_creative_briefs":
            return await _generate_creative_briefs(arguments)
        elif name == "export_ops_csv":
            return await _export_ops_csv(arguments)
        elif name == "get_customer_analysis":
            return await _get_customer_analysis(arguments)
        elif name == "get_segment_hypotheses":
            return await _get_segment_hypotheses(arguments)
        elif name == "configure_thresholds":
            return await _configure_thresholds(arguments)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _analyze_segments(args: dict[str, Any]) -> list[TextContent]:
    """Run full segmentation pipeline."""
    global _session_state

    list_id = args.get("list_id")
    limit = min(args.get("limit", 10000), 100000)
    events_days = args.get("include_events_days", 365)

    client = get_klaviyo_client()

    # Fetch profiles
    profiles = await client.get_profiles(list_id=list_id, limit=limit)
    if not profiles:
        return [TextContent(type="text", text="No profiles found in Klaviyo account.")]

    # Fetch events for all profiles
    profile_ids = [p["id"] for p in profiles]
    events_map = await client.get_events_for_profiles(profile_ids, days=events_days)

    # Normalize profiles
    normalized = []
    for profile in profiles:
        profile_events = events_map.get(profile["id"], [])
        normalized.append(client.normalize_profile(profile, profile_events))

    # Calculate thresholds
    threshold_calc = ThresholdCalculator()
    thresholds = threshold_calc.calculate(normalized)

    # Classify segments
    classifier = SegmentClassifier(thresholds)
    segment_results = [classifier.classify(p) for p in normalized]

    # Generate hypotheses
    hypothesis_gen = HypothesisGenerator()
    hypotheses = hypothesis_gen.generate_all(segment_results, thresholds)

    # Generate micro-segments
    micro_segmenter = MicroSegmenter()
    micro_segments = micro_segmenter.generate_all(segment_results, normalized)

    # Store in session state
    _session_state = {
        "profiles": normalized,
        "thresholds": thresholds,
        "segment_results": segment_results,
        "hypotheses": hypotheses,
        "micro_segments": micro_segments,
        "analysis_complete": True,
    }

    # Build summary
    segment_counts = {}
    for result in segment_results:
        tag = result["segment_tag"]
        segment_counts[tag] = segment_counts.get(tag, 0) + 1

    total = len(segment_results)
    summary_lines = [
        f"## Segmentation Analysis Complete",
        f"",
        f"**Total Profiles Analyzed:** {total:,}",
        f"",
        f"### Segment Distribution",
        f"",
    ]

    for tag, count in sorted(segment_counts.items(), key=lambda x: -x[1]):
        pct = (count / total) * 100
        summary_lines.append(f"- **{tag}**: {count:,} ({pct:.1f}%)")

    summary_lines.extend([
        f"",
        f"### Key Thresholds (Calculated from Your Data)",
        f"",
        f"- VIP Revenue Threshold: ${thresholds['top_10_percent_revenue_threshold']:,.2f}",
        f"- Median Order Count: {thresholds['median_order_count']:.1f}",
        f"- Median Days Between Orders: {thresholds['repeat_interval_median_days']:.0f}",
        f"- High AOV Threshold (80th %ile): ${thresholds['aov_80p']:,.2f}",
        f"",
        f"Use `get_segment_summary`, `generate_creative_briefs`, or `export_ops_csv` for more details.",
    ])

    return [TextContent(type="text", text="\n".join(summary_lines))]


async def _get_segment_summary(args: dict[str, Any]) -> list[TextContent]:
    """Get segment summary."""
    global _session_state

    if not _session_state.get("analysis_complete"):
        return [TextContent(
            type="text",
            text="No analysis data available. Run `analyze_segments` first."
        )]

    segment_name = args.get("segment_name")
    segment_results = _session_state["segment_results"]
    profiles = _session_state["profiles"]
    micro_segments = _session_state["micro_segments"]

    if segment_name:
        # Filter to specific segment
        filtered = [r for r in segment_results if r["segment_tag"] == segment_name]
        if not filtered:
            return [TextContent(type="text", text=f"No customers in segment: {segment_name}")]

        # Get profile details for this segment
        segment_profiles = [
            p for p, r in zip(profiles, segment_results)
            if r["segment_tag"] == segment_name
        ]

        avg_revenue = sum(p["total_revenue"] for p in segment_profiles) / len(segment_profiles)
        avg_orders = sum(p["order_count"] for p in segment_profiles) / len(segment_profiles)
        avg_aov = sum(p["average_order_value"] for p in segment_profiles) / len(segment_profiles)

        micro = micro_segments.get(segment_name, [])

        lines = [
            f"## {segment_name} Segment Details",
            f"",
            f"**Count:** {len(filtered):,}",
            f"",
            f"### Metrics",
            f"- Average Revenue: ${avg_revenue:,.2f}",
            f"- Average Orders: {avg_orders:.1f}",
            f"- Average AOV: ${avg_aov:,.2f}",
            f"",
            f"### Micro-Segments",
        ]

        for ms in micro[:5]:
            lines.append(f"- {ms['name']}: {ms['count']:,} customers")

        return [TextContent(type="text", text="\n".join(lines))]

    # Return all segments summary
    segment_counts = {}
    segment_revenue = {}
    for profile, result in zip(profiles, segment_results):
        tag = result["segment_tag"]
        segment_counts[tag] = segment_counts.get(tag, 0) + 1
        segment_revenue[tag] = segment_revenue.get(tag, 0) + profile["total_revenue"]

    lines = ["## All Segments Summary", ""]
    for tag in sorted(segment_counts.keys()):
        count = segment_counts[tag]
        revenue = segment_revenue[tag]
        avg = revenue / count if count > 0 else 0
        lines.append(f"### {tag}")
        lines.append(f"- Count: {count:,}")
        lines.append(f"- Total Revenue: ${revenue:,.2f}")
        lines.append(f"- Avg Revenue/Customer: ${avg:,.2f}")
        lines.append("")

    return [TextContent(type="text", text="\n".join(lines))]


async def _generate_creative_briefs(args: dict[str, Any]) -> list[TextContent]:
    """Generate creative briefs."""
    global _session_state

    if not _session_state.get("analysis_complete"):
        return [TextContent(
            type="text",
            text="No analysis data available. Run `analyze_segments` first."
        )]

    segments = args.get("segments", [])
    brand_voice = args.get("brand_voice", "professional")
    include_image_prompts = args.get("include_image_prompts", True)

    brief_gen = BriefGenerator(brand_voice=brand_voice)
    guardrails = BrandGuardrails()
    image_builder = ImagePromptBuilder()

    segment_results = _session_state["segment_results"]
    hypotheses = _session_state["hypotheses"]

    # Get unique segments
    unique_segments = set(r["segment_tag"] for r in segment_results)
    if segments:
        unique_segments = unique_segments.intersection(set(segments))

    output_lines = ["## Creative Briefs", ""]

    for segment in sorted(unique_segments):
        brief = brief_gen.generate(segment, hypotheses.get(segment, []))

        # Apply guardrails
        compliant_brief = guardrails.validate_and_fix(brief)

        output_lines.extend([
            f"### {segment}",
            f"",
            f"**Primary Emotion:** {compliant_brief['primary_emotion']}",
            f"**Positioning:** {compliant_brief['positioning']}",
            f"",
            f"**Subject Lines:**",
        ])
        for sl in compliant_brief["subject_lines"][:3]:
            output_lines.append(f"- {sl}")

        output_lines.extend([
            f"",
            f"**Headline:** {compliant_brief['headline']}",
            f"",
            f"**Body Copy:**",
            f"> {compliant_brief['body_copy']}",
            f"",
        ])

        if include_image_prompts:
            image_prompt = image_builder.build(segment, compliant_brief)
            output_lines.extend([
                f"**Image Generation Prompt:**",
                f"```",
                f"{image_prompt}",
                f"```",
                f"",
            ])

        output_lines.append("---")
        output_lines.append("")

    return [TextContent(type="text", text="\n".join(output_lines))]


async def _export_ops_csv(args: dict[str, Any]) -> list[TextContent]:
    """Export as ops CSV."""
    global _session_state

    if not _session_state.get("analysis_complete"):
        return [TextContent(
            type="text",
            text="No analysis data available. Run `analyze_segments` first."
        )]

    include_profiles = args.get("include_profiles", False)
    output_format = args.get("format", "csv")

    formatter = OutputFormatter()

    profiles = _session_state["profiles"]
    segment_results = _session_state["segment_results"]
    hypotheses = _session_state["hypotheses"]
    micro_segments = _session_state["micro_segments"]

    if output_format == "csv":
        output = formatter.to_csv(
            profiles if include_profiles else None,
            segment_results,
            hypotheses,
            include_profiles=include_profiles
        )
    elif output_format == "json":
        output = formatter.to_json(segment_results, hypotheses, micro_segments)
    else:  # klaviyo_import
        output = formatter.to_klaviyo_import(profiles, segment_results)

    return [TextContent(type="text", text=output)]


async def _get_customer_analysis(args: dict[str, Any]) -> list[TextContent]:
    """Analyze single customer."""
    email = args.get("email")
    profile_id = args.get("profile_id")

    if not email and not profile_id:
        return [TextContent(
            type="text",
            text="Please provide either 'email' or 'profile_id' to look up the customer."
        )]

    client = get_klaviyo_client()

    # Fetch profile
    if email:
        profile = await client.get_profile_by_email(email)
    else:
        profile = await client.get_profile_by_id(profile_id)

    if not profile:
        return [TextContent(type="text", text="Customer not found.")]

    # Fetch events
    events = await client.get_events_for_profile(profile["id"], days=365)

    # Normalize
    normalized = client.normalize_profile(profile, events)

    # Get thresholds (use session if available, otherwise calculate from this profile)
    if _session_state.get("thresholds"):
        thresholds = _session_state["thresholds"]
    else:
        threshold_calc = ThresholdCalculator()
        thresholds = threshold_calc.get_defaults()

    # Classify
    classifier = SegmentClassifier(thresholds)
    result = classifier.classify(normalized)

    # Generate hypotheses for this segment
    hypothesis_gen = HypothesisGenerator()
    segment_hypotheses = hypothesis_gen.generate_for_segment(result["segment_tag"])

    lines = [
        f"## Customer Analysis",
        f"",
        f"**Email:** {normalized['email']}",
        f"**Profile ID:** {normalized['profile_id']}",
        f"",
        f"### Segment Assignment",
        f"**Segment:** {result['segment_tag']}",
        f"**Confidence:** {result['confidence']:.0%}",
        f"",
        f"### Key Metrics",
        f"- Total Revenue: ${normalized['total_revenue']:,.2f}",
        f"- Order Count: {normalized['order_count']}",
        f"- Average Order Value: ${normalized['average_order_value']:,.2f}",
        f"- Days Since Last Order: {normalized['days_since_last_order']}",
        f"- Email Engagement: {normalized['email_click_count']} clicks",
        f"",
        f"### Recommended Actions",
    ]

    for hyp in segment_hypotheses[:2]:
        lines.append(f"- {hyp['action']}")

    return [TextContent(type="text", text="\n".join(lines))]


async def _get_segment_hypotheses(args: dict[str, Any]) -> list[TextContent]:
    """Get segment hypotheses."""
    global _session_state

    if not _session_state.get("analysis_complete"):
        return [TextContent(
            type="text",
            text="No analysis data available. Run `analyze_segments` first."
        )]

    segment_name = args.get("segment_name")
    hypotheses = _session_state["hypotheses"]

    if segment_name:
        segment_hyps = hypotheses.get(segment_name, [])
        if not segment_hyps:
            return [TextContent(type="text", text=f"No hypotheses for segment: {segment_name}")]

        lines = [f"## Hypotheses for {segment_name}", ""]
        for i, hyp in enumerate(segment_hyps, 1):
            lines.extend([
                f"### Hypothesis {i}",
                f"**Statement:** {hyp['statement']}",
                f"**Test Method:** {hyp['test_method']}",
                f"**Expected Lift:** {hyp['expected_lift']}",
                f"**KPIs:** {', '.join(hyp['kpis'])}",
                f"",
            ])
        return [TextContent(type="text", text="\n".join(lines))]

    # Return all hypotheses
    lines = ["## All Segment Hypotheses", ""]
    for segment, hyps in hypotheses.items():
        lines.append(f"### {segment}")
        for hyp in hyps[:2]:
            lines.append(f"- {hyp['statement']}")
        lines.append("")

    return [TextContent(type="text", text="\n".join(lines))]


async def _configure_thresholds(args: dict[str, Any]) -> list[TextContent]:
    """Configure thresholds."""
    global _session_state

    show_current = args.get("show_current", True)
    custom = args.get("custom_thresholds", {})

    if custom:
        if "custom_config" not in _session_state:
            _session_state["custom_config"] = {}
        _session_state["custom_config"].update(custom)

    lines = ["## Threshold Configuration", ""]

    if show_current and _session_state.get("thresholds"):
        thresholds = _session_state["thresholds"]
        lines.extend([
            "### Current Thresholds (from data)",
            f"- VIP Revenue (top 10%): ${thresholds['top_10_percent_revenue_threshold']:,.2f}",
            f"- Median Order Count: {thresholds['median_order_count']:.1f}",
            f"- Repeat Interval Median: {thresholds['repeat_interval_median_days']:.0f} days",
            f"- AOV 80th Percentile: ${thresholds['aov_80p']:,.2f}",
            f"- High Discount Threshold: {thresholds['discount_threshold_high']:.0%}",
            "",
        ])

    if _session_state.get("custom_config"):
        lines.extend([
            "### Custom Overrides",
            json.dumps(_session_state["custom_config"], indent=2),
        ])

    if not show_current and not custom:
        lines.append("Use `show_current: true` to see thresholds or provide `custom_thresholds` to override.")

    return [TextContent(type="text", text="\n".join(lines))]


def main():
    """Run the MCP server."""
    asyncio.run(stdio_server(server))


if __name__ == "__main__":
    main()
