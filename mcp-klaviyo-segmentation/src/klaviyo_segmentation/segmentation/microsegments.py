"""
Micro-Segmentation Engine

Creates 3-5 micro-segments within each parent segment based on
behavioral dimensions like discount affinity, category preference,
geography, engagement level, recency, and value tier.
"""

from typing import Any
from collections import defaultdict


class MicroSegmenter:
    """Generate micro-segments within parent segments."""

    # Dimensions to use for micro-segmentation
    DIMENSIONS = [
        "discount_behavior",
        "category_affinity",
        "geography",
        "engagement_level",
        "recency",
        "value_tier",
    ]

    def generate_all(
        self,
        segment_results: list[dict[str, Any]],
        profiles: list[dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Generate micro-segments for all parent segments.

        Args:
            segment_results: List of segment classification results
            profiles: List of normalized customer profiles

        Returns:
            Dict mapping parent segment to list of micro-segments
        """
        # Group profiles by segment
        segment_profiles: dict[str, list[dict]] = defaultdict(list)
        profile_map = {p["profile_id"]: p for p in profiles}

        for result in segment_results:
            pid = result["profile_id"]
            tag = result["segment_tag"]
            if pid in profile_map:
                segment_profiles[tag].append(profile_map[pid])

        # Generate micro-segments for each parent segment
        micro_segments = {}
        for segment_tag, seg_profiles in segment_profiles.items():
            micro_segments[segment_tag] = self._generate_for_segment(
                segment_tag, seg_profiles
            )

        return micro_segments

    def _generate_for_segment(
        self,
        segment_tag: str,
        profiles: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Generate micro-segments for a single parent segment."""
        if len(profiles) < 10:
            # Not enough data for meaningful micro-segments
            return [{
                "name": f"{segment_tag} - All",
                "dimension": "none",
                "count": len(profiles),
                "profile_ids": [p["profile_id"] for p in profiles],
                "characteristics": {},
            }]

        micro_segments = []

        # Choose dimensions based on segment type
        if segment_tag == "VIP":
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))
            micro_segments.extend(self._segment_by_value_tier(profiles, segment_tag))

        elif segment_tag == "Loyal Repeat":
            micro_segments.extend(self._segment_by_recency(profiles, segment_tag))
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))

        elif segment_tag == "High Potential":
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))
            micro_segments.extend(self._segment_by_engagement(profiles, segment_tag))

        elif segment_tag == "At Risk":
            micro_segments.extend(self._segment_by_recency(profiles, segment_tag))
            micro_segments.extend(self._segment_by_value_tier(profiles, segment_tag))

        elif segment_tag == "Churned":
            micro_segments.extend(self._segment_by_value_tier(profiles, segment_tag))
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))

        elif segment_tag == "One-Time Buyers":
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))
            micro_segments.extend(self._segment_by_discount(profiles, segment_tag))

        elif segment_tag == "Discount-Driven":
            micro_segments.extend(self._segment_by_discount(profiles, segment_tag))
            micro_segments.extend(self._segment_by_category(profiles, segment_tag))

        elif segment_tag == "Engaged Non-Buyer":
            micro_segments.extend(self._segment_by_engagement(profiles, segment_tag))
            micro_segments.extend(self._segment_by_geography(profiles, segment_tag))

        elif segment_tag == "Cold Subscribers":
            micro_segments.extend(self._segment_by_geography(profiles, segment_tag))
            micro_segments.extend(self._segment_by_recency(profiles, segment_tag))

        # Filter to top 5 micro-segments by size
        micro_segments.sort(key=lambda x: -x["count"])
        return micro_segments[:5]

    def _segment_by_discount(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by discount behavior."""
        high_discount = []
        medium_discount = []
        low_discount = []

        for p in profiles:
            discount = p.get("average_discount", 0)
            if discount >= 0.25:
                high_discount.append(p)
            elif discount >= 0.10:
                medium_discount.append(p)
            else:
                low_discount.append(p)

        results = []
        if high_discount:
            results.append({
                "name": f"{parent_tag} - Heavy Discount Users",
                "dimension": "discount_behavior",
                "count": len(high_discount),
                "profile_ids": [p["profile_id"] for p in high_discount],
                "characteristics": {"avg_discount": "25%+"},
            })
        if medium_discount:
            results.append({
                "name": f"{parent_tag} - Moderate Discount Users",
                "dimension": "discount_behavior",
                "count": len(medium_discount),
                "profile_ids": [p["profile_id"] for p in medium_discount],
                "characteristics": {"avg_discount": "10-25%"},
            })
        if low_discount:
            results.append({
                "name": f"{parent_tag} - Full Price Buyers",
                "dimension": "discount_behavior",
                "count": len(low_discount),
                "profile_ids": [p["profile_id"] for p in low_discount],
                "characteristics": {"avg_discount": "<10%"},
            })

        return results

    def _segment_by_category(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by top purchase category."""
        category_groups: dict[str, list] = defaultdict(list)

        for p in profiles:
            cat = p.get("top_category") or "Unknown"
            category_groups[cat].append(p)

        results = []
        for cat, cat_profiles in sorted(category_groups.items(), key=lambda x: -len(x[1])):
            if len(cat_profiles) >= 5:  # Minimum size threshold
                results.append({
                    "name": f"{parent_tag} - {cat} Buyers",
                    "dimension": "category_affinity",
                    "count": len(cat_profiles),
                    "profile_ids": [p["profile_id"] for p in cat_profiles],
                    "characteristics": {"top_category": cat},
                })

        return results[:3]  # Top 3 categories

    def _segment_by_geography(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by geographic region."""
        geo_groups: dict[str, list] = defaultdict(list)

        for p in profiles:
            region = p.get("region") or p.get("country") or "Unknown"
            geo_groups[region].append(p)

        results = []
        for region, region_profiles in sorted(geo_groups.items(), key=lambda x: -len(x[1])):
            if len(region_profiles) >= 5:
                results.append({
                    "name": f"{parent_tag} - {region}",
                    "dimension": "geography",
                    "count": len(region_profiles),
                    "profile_ids": [p["profile_id"] for p in region_profiles],
                    "characteristics": {"region": region},
                })

        return results[:3]

    def _segment_by_engagement(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by email engagement level."""
        high_engagement = []
        medium_engagement = []
        low_engagement = []

        for p in profiles:
            clicks = p.get("email_click_count", 0)
            if clicks >= 10:
                high_engagement.append(p)
            elif clicks >= 3:
                medium_engagement.append(p)
            else:
                low_engagement.append(p)

        results = []
        if high_engagement:
            results.append({
                "name": f"{parent_tag} - High Email Engagers",
                "dimension": "engagement_level",
                "count": len(high_engagement),
                "profile_ids": [p["profile_id"] for p in high_engagement],
                "characteristics": {"email_clicks": "10+"},
            })
        if medium_engagement:
            results.append({
                "name": f"{parent_tag} - Moderate Engagers",
                "dimension": "engagement_level",
                "count": len(medium_engagement),
                "profile_ids": [p["profile_id"] for p in medium_engagement],
                "characteristics": {"email_clicks": "3-10"},
            })
        if low_engagement:
            results.append({
                "name": f"{parent_tag} - Low Engagers",
                "dimension": "engagement_level",
                "count": len(low_engagement),
                "profile_ids": [p["profile_id"] for p in low_engagement],
                "characteristics": {"email_clicks": "<3"},
            })

        return results

    def _segment_by_recency(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by recency of last activity."""
        recent = []
        moderate = []
        stale = []

        for p in profiles:
            days = p.get("days_since_last_order", 9999)
            if days <= 30:
                recent.append(p)
            elif days <= 90:
                moderate.append(p)
            else:
                stale.append(p)

        results = []
        if recent:
            results.append({
                "name": f"{parent_tag} - Recently Active",
                "dimension": "recency",
                "count": len(recent),
                "profile_ids": [p["profile_id"] for p in recent],
                "characteristics": {"days_since_order": "0-30"},
            })
        if moderate:
            results.append({
                "name": f"{parent_tag} - Moderately Recent",
                "dimension": "recency",
                "count": len(moderate),
                "profile_ids": [p["profile_id"] for p in moderate],
                "characteristics": {"days_since_order": "31-90"},
            })
        if stale:
            results.append({
                "name": f"{parent_tag} - Stale Activity",
                "dimension": "recency",
                "count": len(stale),
                "profile_ids": [p["profile_id"] for p in stale],
                "characteristics": {"days_since_order": "90+"},
            })

        return results

    def _segment_by_value_tier(
        self, profiles: list[dict], parent_tag: str
    ) -> list[dict[str, Any]]:
        """Segment by customer value tier."""
        # Calculate value percentiles within this segment
        revenues = sorted([p.get("total_revenue", 0) for p in profiles])
        if len(revenues) < 3:
            return []

        p33 = revenues[len(revenues) // 3]
        p66 = revenues[2 * len(revenues) // 3]

        high_value = []
        mid_value = []
        low_value = []

        for p in profiles:
            rev = p.get("total_revenue", 0)
            if rev >= p66:
                high_value.append(p)
            elif rev >= p33:
                mid_value.append(p)
            else:
                low_value.append(p)

        results = []
        if high_value:
            results.append({
                "name": f"{parent_tag} - High Value",
                "dimension": "value_tier",
                "count": len(high_value),
                "profile_ids": [p["profile_id"] for p in high_value],
                "characteristics": {"value_tier": "top_third"},
            })
        if mid_value:
            results.append({
                "name": f"{parent_tag} - Mid Value",
                "dimension": "value_tier",
                "count": len(mid_value),
                "profile_ids": [p["profile_id"] for p in mid_value],
                "characteristics": {"value_tier": "middle_third"},
            })
        if low_value:
            results.append({
                "name": f"{parent_tag} - Lower Value",
                "dimension": "value_tier",
                "count": len(low_value),
                "profile_ids": [p["profile_id"] for p in low_value],
                "characteristics": {"value_tier": "bottom_third"},
            })

        return results
