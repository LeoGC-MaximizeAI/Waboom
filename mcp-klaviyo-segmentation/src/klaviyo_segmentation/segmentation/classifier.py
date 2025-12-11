"""
Segment Classifier

Implements the 9 customer segments with boolean logic rules:
1. VIP - Top revenue AND high order frequency
2. Loyal Repeat - Regular purchasers with consistent intervals
3. High Potential - High AOV but low frequency
4. At Risk - Previously active, now slowing down
5. Churned - No activity beyond churn threshold
6. One-Time Buyers - Single purchase only
7. Discount-Driven - High discount usage rate
8. Engaged Non-Buyer - Active engagement but no purchases
9. Cold Subscribers - Subscribed but no recent engagement
"""

from typing import Any


class SegmentClassifier:
    """Classify customers into segments based on dynamic thresholds."""

    # Segment definitions with rules
    SEGMENT_RULES = [
        {
            "tag": "VIP",
            "priority": 1,
            "description": "Top revenue customers with high order frequency",
            "rules": [
                ("total_revenue", ">=", "top_10_percent_revenue_threshold"),
                ("order_count", ">=", "median_order_count", 2.0),  # 2x median
            ],
            "operator": "AND",
        },
        {
            "tag": "Loyal Repeat",
            "priority": 2,
            "description": "Regular purchasers with consistent buying patterns",
            "rules": [
                ("order_count", ">=", "median_order_count"),
                ("avg_days_between_orders", "<=", "repeat_interval_median_days"),
                ("days_since_last_order", "<=", "at_risk_threshold_days"),
            ],
            "operator": "AND",
        },
        {
            "tag": "High Potential",
            "priority": 3,
            "description": "High AOV but haven't reached frequency potential",
            "rules": [
                ("average_order_value", ">=", "aov_80p"),
                ("order_count", "<", "median_order_count"),
                ("days_since_last_order", "<=", "churn_threshold_days"),
            ],
            "operator": "AND",
        },
        {
            "tag": "At Risk",
            "priority": 4,
            "description": "Previously valuable customers showing disengagement",
            "rules": [
                ("order_count", ">=", 2),
                ("days_since_last_order", ">", "at_risk_threshold_days"),
                ("days_since_last_order", "<=", "churn_threshold_days"),
            ],
            "operator": "AND",
        },
        {
            "tag": "Churned",
            "priority": 5,
            "description": "Customers with no activity beyond churn threshold",
            "rules": [
                ("order_count", ">=", 1),
                ("days_since_last_order", ">", "churn_threshold_days"),
            ],
            "operator": "AND",
        },
        {
            "tag": "One-Time Buyers",
            "priority": 6,
            "description": "Single purchase customers",
            "rules": [
                ("order_count", "==", 1),
                ("days_since_last_order", "<=", "churn_threshold_days"),
            ],
            "operator": "AND",
        },
        {
            "tag": "Discount-Driven",
            "priority": 7,
            "description": "Customers primarily motivated by discounts",
            "rules": [
                ("average_discount", ">=", "discount_threshold_high"),
                ("order_count", ">=", 2),
            ],
            "operator": "AND",
        },
        {
            "tag": "Engaged Non-Buyer",
            "priority": 8,
            "description": "Active email/site engagement but no purchases",
            "rules": [
                ("order_count", "==", 0),
                ("email_click_count", ">=", "email_engagement_threshold"),
            ],
            "operator": "OR",  # Either email OR site engagement
            "alt_rules": [
                ("order_count", "==", 0),
                ("site_visits_last_90d", ">=", "site_visit_threshold"),
            ],
        },
        {
            "tag": "Cold Subscribers",
            "priority": 9,
            "description": "Subscribed but no recent engagement or purchases",
            "rules": [
                ("order_count", "==", 0),
                ("email_click_count", "<", "email_engagement_threshold"),
                ("days_since_last_email_click", ">", "cold_days_threshold"),
            ],
            "operator": "AND",
        },
    ]

    def __init__(self, thresholds: dict[str, float]):
        """
        Initialize classifier with calculated thresholds.

        Args:
            thresholds: Dynamic thresholds from ThresholdCalculator
        """
        self.thresholds = thresholds

    def classify(self, profile: dict[str, Any]) -> dict[str, Any]:
        """
        Classify a single customer profile.

        Evaluates rules in priority order, returning first match.

        Args:
            profile: Normalized customer profile

        Returns:
            Dict with segment_tag, confidence, matched_rules, and notes
        """
        for segment_def in self.SEGMENT_RULES:
            match, confidence, matched_rules = self._evaluate_segment(profile, segment_def)

            if match:
                return {
                    "profile_id": profile.get("profile_id"),
                    "segment_tag": segment_def["tag"],
                    "confidence": confidence,
                    "matched_rules": matched_rules,
                    "notes": self._generate_notes(profile, segment_def),
                }

        # Fallback to Cold Subscribers if nothing else matches
        return {
            "profile_id": profile.get("profile_id"),
            "segment_tag": "Cold Subscribers",
            "confidence": 0.5,
            "matched_rules": ["default_fallback"],
            "notes": "No specific segment rules matched; defaulted to Cold Subscribers.",
        }

    def _evaluate_segment(
        self, profile: dict[str, Any], segment_def: dict[str, Any]
    ) -> tuple[bool, float, list[str]]:
        """
        Evaluate if a profile matches a segment definition.

        Returns:
            Tuple of (matched, confidence, list of matched rule descriptions)
        """
        rules = segment_def["rules"]
        operator = segment_def.get("operator", "AND")
        alt_rules = segment_def.get("alt_rules")

        # Evaluate main rules
        main_results = [self._evaluate_rule(profile, rule) for rule in rules]
        main_matched = [r for r in main_results if r[0]]

        if operator == "AND":
            main_match = all(r[0] for r in main_results)
        else:  # OR
            main_match = any(r[0] for r in main_results)

        # Check alt rules if present and main didn't match
        if not main_match and alt_rules:
            alt_results = [self._evaluate_rule(profile, rule) for rule in alt_rules]
            if all(r[0] for r in alt_results):
                main_match = True
                main_matched = [r for r in alt_results if r[0]]

        if not main_match:
            return False, 0.0, []

        # Calculate confidence based on how strongly rules match
        confidences = [r[1] for r in main_matched]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.5

        # Get rule descriptions
        matched_descriptions = [r[2] for r in main_matched]

        return True, avg_confidence, matched_descriptions

    def _evaluate_rule(
        self, profile: dict[str, Any], rule: tuple
    ) -> tuple[bool, float, str]:
        """
        Evaluate a single rule against a profile.

        Args:
            profile: Customer profile
            rule: Tuple of (field, operator, threshold_key, [modifier])

        Returns:
            Tuple of (matched, confidence, description)
        """
        field = rule[0]
        op = rule[1]
        threshold_key = rule[2]
        modifier = rule[3] if len(rule) > 3 else 1.0

        # Get profile value
        value = profile.get(field, 0)
        if value is None:
            value = 0

        # Get threshold value
        if isinstance(threshold_key, str):
            threshold = self.thresholds.get(threshold_key, 0) * modifier
        else:
            threshold = threshold_key * modifier

        # Evaluate comparison
        if op == ">=":
            matched = value >= threshold
            # Confidence based on how far above threshold
            confidence = min(1.0, value / threshold) if threshold > 0 else 0.5
        elif op == ">":
            matched = value > threshold
            confidence = min(1.0, value / threshold) if threshold > 0 else 0.5
        elif op == "<=":
            matched = value <= threshold
            confidence = min(1.0, threshold / value) if value > 0 else 0.5
        elif op == "<":
            matched = value < threshold
            confidence = min(1.0, threshold / value) if value > 0 else 0.5
        elif op == "==":
            matched = value == threshold
            confidence = 1.0 if matched else 0.0
        else:
            matched = False
            confidence = 0.0

        description = f"{field} {op} {threshold:.2f} (actual: {value})"

        return matched, confidence, description

    def _generate_notes(
        self, profile: dict[str, Any], segment_def: dict[str, Any]
    ) -> str:
        """Generate explanatory notes for the segment assignment."""
        tag = segment_def["tag"]
        notes_templates = {
            "VIP": (
                f"Top-tier customer with ${profile.get('total_revenue', 0):,.2f} revenue "
                f"and {profile.get('order_count', 0)} orders."
            ),
            "Loyal Repeat": (
                f"Consistent buyer with {profile.get('order_count', 0)} orders, "
                f"averaging {profile.get('avg_days_between_orders', 0):.0f} days between purchases."
            ),
            "High Potential": (
                f"High AOV of ${profile.get('average_order_value', 0):,.2f} suggests "
                f"capacity for increased purchase frequency."
            ),
            "At Risk": (
                f"Last order was {profile.get('days_since_last_order', 0)} days ago. "
                f"Previously had {profile.get('order_count', 0)} orders."
            ),
            "Churned": (
                f"No activity in {profile.get('days_since_last_order', 0)} days "
                f"after {profile.get('order_count', 0)} previous orders."
            ),
            "One-Time Buyers": (
                f"Single purchase of ${profile.get('total_revenue', 0):,.2f}. "
                f"Opportunity for second purchase campaign."
            ),
            "Discount-Driven": (
                f"Average discount of {profile.get('average_discount', 0):.0%}. "
                f"Consider value-based messaging over discounts."
            ),
            "Engaged Non-Buyer": (
                f"{profile.get('email_click_count', 0)} email clicks, "
                f"{profile.get('site_visits_last_90d', 0)} site visits. High conversion potential."
            ),
            "Cold Subscribers": (
                f"No purchases and minimal engagement. "
                f"Consider re-engagement or list hygiene."
            ),
        }
        return notes_templates.get(tag, segment_def.get("description", ""))
