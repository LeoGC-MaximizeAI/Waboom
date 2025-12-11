"""
Hypothesis Generator

Generates testable marketing hypotheses for each segment based on
customer behavior patterns and segment characteristics.
"""

from typing import Any


class HypothesisGenerator:
    """Generate marketing hypotheses per segment."""

    # Hypothesis templates per segment
    HYPOTHESIS_TEMPLATES = {
        "VIP": [
            {
                "statement": "VIP customers will respond to exclusive early access more than discount offers",
                "test_method": "A/B test early access vs. 20% discount on new product launch",
                "expected_lift": "15-25% higher conversion on early access",
                "kpis": ["conversion_rate", "revenue_per_email", "repeat_purchase_rate"],
                "action": "Send exclusive early access emails 48 hours before general release",
            },
            {
                "statement": "Personalized product recommendations based on purchase history will increase AOV",
                "test_method": "A/B test personalized vs. best-seller recommendations",
                "expected_lift": "10-20% AOV increase",
                "kpis": ["average_order_value", "items_per_order", "click_through_rate"],
                "action": "Implement AI-powered product recommendations in email campaigns",
            },
            {
                "statement": "VIP customers prefer premium content over promotional messaging",
                "test_method": "A/B test content-led emails vs. promotional emails",
                "expected_lift": "20% higher engagement",
                "kpis": ["open_rate", "click_rate", "unsubscribe_rate"],
                "action": "Create exclusive content series for VIP segment",
            },
        ],
        "Loyal Repeat": [
            {
                "statement": "Loyalty program enrollment will increase purchase frequency",
                "test_method": "Offer loyalty program to 50% of segment, measure 90-day behavior",
                "expected_lift": "25% increase in purchase frequency",
                "kpis": ["purchase_frequency", "customer_lifetime_value", "retention_rate"],
                "action": "Launch targeted loyalty program enrollment campaign",
            },
            {
                "statement": "Subscription offers will convert repeat buyers to recurring revenue",
                "test_method": "A/B test subscription vs. one-time purchase messaging",
                "expected_lift": "10-15% subscription conversion",
                "kpis": ["subscription_rate", "customer_lifetime_value", "churn_rate"],
                "action": "Promote subscription options based on purchase patterns",
            },
        ],
        "High Potential": [
            {
                "statement": "Bundle offers will increase purchase frequency for high-AOV customers",
                "test_method": "A/B test bundle vs. single product recommendations",
                "expected_lift": "30% increase in second purchase rate",
                "kpis": ["second_purchase_rate", "items_per_order", "time_to_second_purchase"],
                "action": "Create curated bundles based on first purchase category",
            },
            {
                "statement": "Post-purchase nurture sequence will accelerate repeat purchase",
                "test_method": "Implement 5-email post-purchase sequence, measure vs. control",
                "expected_lift": "40% faster time to second purchase",
                "kpis": ["days_to_second_purchase", "email_engagement", "second_purchase_rate"],
                "action": "Deploy automated post-purchase nurture flow",
            },
        ],
        "At Risk": [
            {
                "statement": "Win-back campaigns with urgency messaging will re-engage at-risk customers",
                "test_method": "A/B test urgency vs. value-based messaging",
                "expected_lift": "15% reactivation rate",
                "kpis": ["reactivation_rate", "revenue_recovered", "time_to_reactivation"],
                "action": "Launch 3-email win-back sequence with progressive urgency",
            },
            {
                "statement": "Personalized 'we miss you' campaigns outperform generic win-backs",
                "test_method": "A/B test personalized product reminders vs. generic offers",
                "expected_lift": "25% higher click-through rate",
                "kpis": ["click_rate", "conversion_rate", "revenue_per_email"],
                "action": "Create dynamic content blocks showing previously viewed/purchased items",
            },
        ],
        "Churned": [
            {
                "statement": "Deep discounts are necessary to reactivate churned customers",
                "test_method": "Test 10%, 20%, 30% discount tiers on churned segment",
                "expected_lift": "5-10% reactivation at optimal discount level",
                "kpis": ["reactivation_rate", "cost_per_reactivation", "subsequent_ltv"],
                "action": "Implement tiered win-back discount strategy",
            },
            {
                "statement": "Survey-based re-engagement reveals actionable churn reasons",
                "test_method": "Send exit survey to churned segment, analyze responses",
                "expected_lift": "3% response rate with actionable insights",
                "kpis": ["survey_response_rate", "churn_reason_distribution", "product_feedback"],
                "action": "Deploy churn survey with incentive for completion",
            },
        ],
        "One-Time Buyers": [
            {
                "statement": "Second purchase incentive within 30 days maximizes conversion",
                "test_method": "Test timing: 7, 14, 21, 30 days post-purchase",
                "expected_lift": "20% higher second purchase rate at optimal timing",
                "kpis": ["second_purchase_rate", "days_to_second_purchase", "incentive_cost"],
                "action": "Implement timed second purchase automation",
            },
            {
                "statement": "Category-specific follow-up outperforms generic promotions",
                "test_method": "A/B test category-matched vs. best-seller recommendations",
                "expected_lift": "35% higher click-through rate",
                "kpis": ["click_rate", "conversion_rate", "second_purchase_rate"],
                "action": "Create category-specific post-purchase flows",
            },
        ],
        "Discount-Driven": [
            {
                "statement": "Value-based messaging can reduce discount dependency",
                "test_method": "Gradually reduce discount offers, test value messaging",
                "expected_lift": "Maintain 80% of purchases at lower discount levels",
                "kpis": ["purchase_rate_by_discount_level", "average_discount_used", "margin"],
                "action": "Implement discount ladder-down strategy with value messaging",
            },
            {
                "statement": "Flash sale timing affects discount-driven purchase behavior",
                "test_method": "Test flash sale timing: weekday vs. weekend, morning vs. evening",
                "expected_lift": "25% variance in conversion by timing",
                "kpis": ["conversion_rate_by_time", "revenue_per_flash_sale", "urgency_response"],
                "action": "Optimize flash sale calendar based on segment behavior",
            },
        ],
        "Engaged Non-Buyer": [
            {
                "statement": "First purchase incentive converts engaged browsers to buyers",
                "test_method": "Test incentive levels: free shipping, 10%, 15%, 20% off",
                "expected_lift": "25% conversion at optimal incentive",
                "kpis": ["first_purchase_conversion", "cost_per_acquisition", "initial_aov"],
                "action": "Deploy progressive incentive sequence for non-buyers",
            },
            {
                "statement": "Social proof messaging converts engaged non-buyers",
                "test_method": "A/B test social proof vs. product-focused messaging",
                "expected_lift": "15% higher conversion with social proof",
                "kpis": ["conversion_rate", "click_through_rate", "time_to_conversion"],
                "action": "Add reviews and UGC to conversion-focused emails",
            },
        ],
        "Cold Subscribers": [
            {
                "statement": "Re-engagement campaign identifies recoverable subscribers",
                "test_method": "3-email re-engagement sequence before list hygiene",
                "expected_lift": "10-15% re-engagement rate",
                "kpis": ["re_engagement_rate", "email_opens", "unsubscribe_rate"],
                "action": "Launch re-engagement automation before sunset policy",
            },
            {
                "statement": "Channel preference may explain email disengagement",
                "test_method": "Offer SMS/alternative channel opt-in to cold subscribers",
                "expected_lift": "5% channel migration rate",
                "kpis": ["channel_opt_in_rate", "cross_channel_engagement", "list_health"],
                "action": "Test multi-channel re-engagement approach",
            },
        ],
    }

    def generate_all(
        self,
        segment_results: list[dict[str, Any]],
        thresholds: dict[str, float],
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Generate hypotheses for all segments present in results.

        Args:
            segment_results: List of segment classification results
            thresholds: Calculated thresholds (for context)

        Returns:
            Dict mapping segment tags to list of hypotheses
        """
        # Find unique segments in results
        unique_segments = set(r["segment_tag"] for r in segment_results)

        hypotheses = {}
        for segment in unique_segments:
            hypotheses[segment] = self.generate_for_segment(segment, thresholds)

        return hypotheses

    def generate_for_segment(
        self,
        segment_tag: str,
        thresholds: dict[str, float] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Generate hypotheses for a specific segment.

        Args:
            segment_tag: The segment to generate hypotheses for
            thresholds: Optional thresholds for context

        Returns:
            List of hypothesis dicts
        """
        templates = self.HYPOTHESIS_TEMPLATES.get(segment_tag, [])

        # Return copies to avoid mutation
        return [dict(h) for h in templates]

    def prioritize_hypotheses(
        self,
        hypotheses: dict[str, list[dict[str, Any]]],
        segment_sizes: dict[str, int],
    ) -> list[dict[str, Any]]:
        """
        Prioritize hypotheses across segments by potential impact.

        Args:
            hypotheses: Dict of segment -> hypotheses
            segment_sizes: Dict of segment -> customer count

        Returns:
            Sorted list of hypotheses with impact scores
        """
        scored = []

        for segment, hyps in hypotheses.items():
            size = segment_sizes.get(segment, 0)

            for hyp in hyps:
                # Simple impact score: segment size * estimated lift
                # Parse expected lift (e.g., "15-25%" -> 0.20)
                lift_str = hyp.get("expected_lift", "10%")
                try:
                    # Extract first number from lift string
                    import re
                    numbers = re.findall(r"\d+", lift_str)
                    lift = int(numbers[-1]) / 100 if numbers else 0.10
                except Exception:
                    lift = 0.10

                impact_score = size * lift

                scored.append({
                    **hyp,
                    "segment": segment,
                    "segment_size": size,
                    "impact_score": impact_score,
                })

        # Sort by impact score descending
        return sorted(scored, key=lambda x: -x["impact_score"])
