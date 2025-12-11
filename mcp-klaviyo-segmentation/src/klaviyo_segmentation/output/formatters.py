"""
Output Formatters

Formats segmentation results for various outputs:
- CSV for ops activation
- JSON for API consumption
- Klaviyo import format for direct ESP upload
"""

import csv
import json
import io
from typing import Any


class OutputFormatter:
    """Format segmentation results for various outputs."""

    def to_csv(
        self,
        profiles: list[dict[str, Any]] | None,
        segment_results: list[dict[str, Any]],
        hypotheses: dict[str, list[dict[str, Any]]],
        include_profiles: bool = False,
    ) -> str:
        """
        Format results as CSV.

        Args:
            profiles: List of customer profiles (optional)
            segment_results: List of segment classification results
            hypotheses: Dict of segment -> hypotheses
            include_profiles: Whether to include individual profile rows

        Returns:
            CSV string
        """
        output = io.StringIO()

        if include_profiles and profiles:
            # Individual profile export
            fieldnames = [
                "profile_id",
                "email",
                "segment_tag",
                "confidence",
                "total_revenue",
                "order_count",
                "days_since_last_order",
                "notes",
            ]

            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()

            # Create lookup for segment results
            result_map = {r["profile_id"]: r for r in segment_results}

            for profile in profiles:
                pid = profile.get("profile_id")
                result = result_map.get(pid, {})

                writer.writerow({
                    "profile_id": pid,
                    "email": profile.get("email", ""),
                    "segment_tag": result.get("segment_tag", "Unknown"),
                    "confidence": f"{result.get('confidence', 0):.2f}",
                    "total_revenue": f"{profile.get('total_revenue', 0):.2f}",
                    "order_count": profile.get("order_count", 0),
                    "days_since_last_order": profile.get("days_since_last_order", 0),
                    "notes": result.get("notes", ""),
                })

        else:
            # Segment summary export
            fieldnames = [
                "segment_name",
                "customer_count",
                "total_revenue",
                "avg_revenue",
                "primary_hypothesis",
                "recommended_action",
            ]

            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()

            # Aggregate by segment
            segment_stats: dict[str, dict] = {}
            for result in segment_results:
                tag = result["segment_tag"]
                if tag not in segment_stats:
                    segment_stats[tag] = {
                        "count": 0,
                        "total_revenue": 0,
                    }
                segment_stats[tag]["count"] += 1

            # Add revenue if profiles provided
            if profiles:
                profile_map = {p["profile_id"]: p for p in profiles}
                for result in segment_results:
                    pid = result["profile_id"]
                    tag = result["segment_tag"]
                    if pid in profile_map:
                        segment_stats[tag]["total_revenue"] += profile_map[pid].get(
                            "total_revenue", 0
                        )

            # Write rows
            for tag, stats in sorted(segment_stats.items()):
                hyps = hypotheses.get(tag, [])
                primary_hyp = hyps[0] if hyps else {}

                writer.writerow({
                    "segment_name": tag,
                    "customer_count": stats["count"],
                    "total_revenue": f"{stats['total_revenue']:.2f}",
                    "avg_revenue": f"{stats['total_revenue'] / stats['count']:.2f}"
                    if stats["count"] > 0
                    else "0.00",
                    "primary_hypothesis": primary_hyp.get("statement", ""),
                    "recommended_action": primary_hyp.get("action", ""),
                })

        return output.getvalue()

    def to_json(
        self,
        segment_results: list[dict[str, Any]],
        hypotheses: dict[str, list[dict[str, Any]]],
        micro_segments: dict[str, list[dict[str, Any]]],
    ) -> str:
        """
        Format results as JSON.

        Args:
            segment_results: List of segment classification results
            hypotheses: Dict of segment -> hypotheses
            micro_segments: Dict of segment -> micro-segments

        Returns:
            JSON string
        """
        # Aggregate segment stats
        segment_stats: dict[str, dict] = {}
        for result in segment_results:
            tag = result["segment_tag"]
            if tag not in segment_stats:
                segment_stats[tag] = {
                    "name": tag,
                    "count": 0,
                    "profile_ids": [],
                }
            segment_stats[tag]["count"] += 1
            segment_stats[tag]["profile_ids"].append(result["profile_id"])

        # Build output structure
        output = {
            "summary": {
                "total_profiles": len(segment_results),
                "segment_count": len(segment_stats),
            },
            "segments": [],
        }

        for tag, stats in sorted(segment_stats.items(), key=lambda x: -x[1]["count"]):
            segment_data = {
                "name": tag,
                "count": stats["count"],
                "percentage": round(stats["count"] / len(segment_results) * 100, 1),
                "hypotheses": hypotheses.get(tag, []),
                "micro_segments": [
                    {
                        "name": ms["name"],
                        "count": ms["count"],
                        "dimension": ms["dimension"],
                    }
                    for ms in micro_segments.get(tag, [])
                ],
            }
            output["segments"].append(segment_data)

        return json.dumps(output, indent=2)

    def to_klaviyo_import(
        self,
        profiles: list[dict[str, Any]],
        segment_results: list[dict[str, Any]],
    ) -> str:
        """
        Format for Klaviyo profile import (to set segment property).

        Args:
            profiles: List of customer profiles
            segment_results: List of segment classification results

        Returns:
            CSV string ready for Klaviyo import
        """
        output = io.StringIO()

        fieldnames = [
            "email",
            "custom_segment",
            "custom_segment_confidence",
            "custom_segment_notes",
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        # Create lookup
        result_map = {r["profile_id"]: r for r in segment_results}

        for profile in profiles:
            pid = profile.get("profile_id")
            result = result_map.get(pid, {})

            email = profile.get("email")
            if not email:
                continue

            writer.writerow({
                "email": email,
                "custom_segment": result.get("segment_tag", ""),
                "custom_segment_confidence": f"{result.get('confidence', 0):.2f}",
                "custom_segment_notes": result.get("notes", "")[:200],  # Truncate
            })

        return output.getvalue()

    def to_ops_rows(
        self,
        segment_results: list[dict[str, Any]],
        briefs: dict[str, dict[str, Any]],
        image_prompts: dict[str, str],
    ) -> list[dict[str, Any]]:
        """
        Format as ops-ready rows for ESP activation.

        Args:
            segment_results: List of segment classification results
            briefs: Dict of segment -> creative brief
            image_prompts: Dict of segment -> image prompt

        Returns:
            List of ops row dicts
        """
        # Count by segment
        segment_counts: dict[str, int] = {}
        for result in segment_results:
            tag = result["segment_tag"]
            segment_counts[tag] = segment_counts.get(tag, 0) + 1

        rows = []
        for segment_tag, count in sorted(segment_counts.items(), key=lambda x: -x[1]):
            brief = briefs.get(segment_tag, {})
            image_prompt = image_prompts.get(segment_tag, "")

            subject_lines = brief.get("subject_lines", [])

            rows.append({
                "segment_id": segment_tag.lower().replace(" ", "_"),
                "segment_name": segment_tag,
                "customer_count": count,
                "email_subject_line": subject_lines[0] if subject_lines else "",
                "email_subject_line_alt": subject_lines[1] if len(subject_lines) > 1 else "",
                "hero_headline": brief.get("headline", ""),
                "hero_body_copy": brief.get("body_copy", ""),
                "cta_text": brief.get("cta", ""),
                "primary_emotion": brief.get("primary_emotion", ""),
                "image_generation_prompt": image_prompt,
                "esp_segment_key": f"segment_{segment_tag.lower().replace(' ', '_')}",
                "priority_score": self._calculate_priority(segment_tag, count),
            })

        return rows

    def _calculate_priority(self, segment_tag: str, count: int) -> int:
        """Calculate priority score for segment activation."""
        # Base priority by segment type
        base_priorities = {
            "VIP": 100,
            "At Risk": 90,
            "High Potential": 85,
            "Loyal Repeat": 80,
            "One-Time Buyers": 70,
            "Churned": 65,
            "Engaged Non-Buyer": 60,
            "Discount-Driven": 50,
            "Cold Subscribers": 40,
        }

        base = base_priorities.get(segment_tag, 50)

        # Adjust for segment size (larger = higher priority)
        size_bonus = min(count // 100, 10)

        return base + size_bonus
