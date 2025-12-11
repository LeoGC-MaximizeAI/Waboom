"""
Dynamic Threshold Calculator

Calculates segment thresholds from actual customer data rather than
using hardcoded values. This ensures segmentation adapts to each
Klaviyo account's specific customer distribution.
"""

from typing import Any
import numpy as np


class ThresholdCalculator:
    """Calculate dynamic thresholds from customer data."""

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize with optional config overrides.

        Args:
            config: Optional overrides for threshold percentiles
        """
        self.config = config or {}

    def calculate(self, profiles: list[dict[str, Any]]) -> dict[str, float]:
        """
        Calculate all thresholds from profile data.

        Args:
            profiles: List of normalized customer profiles

        Returns:
            Dict of threshold values
        """
        if not profiles:
            return self.get_defaults()

        # Extract metrics arrays
        revenues = np.array([p.get("total_revenue", 0) for p in profiles])
        order_counts = np.array([p.get("order_count", 0) for p in profiles])
        aovs = np.array([
            p.get("average_order_value", 0) for p in profiles
            if p.get("average_order_value", 0) > 0
        ])
        discounts = np.array([
            p.get("average_discount", 0) for p in profiles
            if p.get("order_count", 0) > 0
        ])

        # Calculate days between orders for repeat customers
        repeat_intervals = [
            p.get("avg_days_between_orders", 0) for p in profiles
            if p.get("order_count", 0) > 1 and p.get("avg_days_between_orders", 0) > 0
        ]

        # VIP threshold: top 10% by revenue (configurable)
        vip_percentile = self.config.get("vip_revenue_percentile", 90)
        top_10_revenue = float(np.percentile(revenues, vip_percentile)) if len(revenues) > 0 else 1000

        # Median order count (for "above median" comparisons)
        median_orders = float(np.median(order_counts)) if len(order_counts) > 0 else 2

        # Repeat interval median (for "faster than typical" comparisons)
        repeat_median = float(np.median(repeat_intervals)) if repeat_intervals else 30

        # AOV percentiles
        aov_80p = float(np.percentile(aovs, 80)) if len(aovs) > 0 else 100
        aov_median = float(np.median(aovs)) if len(aovs) > 0 else 50

        # Discount threshold (configurable)
        discount_high = self.config.get("high_discount_threshold", 0.25)
        discount_median = float(np.median(discounts)) if len(discounts) > 0 else 0.10

        # Time-based thresholds (configurable)
        churn_days = self.config.get("churn_days", 180)
        at_risk_days = self.config.get("at_risk_days", 90)

        return {
            # Revenue thresholds
            "top_10_percent_revenue_threshold": top_10_revenue,
            "revenue_median": float(np.median(revenues)) if len(revenues) > 0 else 100,
            # Order count thresholds
            "median_order_count": median_orders,
            "high_order_count": float(np.percentile(order_counts, 75)) if len(order_counts) > 0 else 5,
            # Timing thresholds
            "repeat_interval_median_days": repeat_median,
            "churn_threshold_days": churn_days,
            "at_risk_threshold_days": at_risk_days,
            # AOV thresholds
            "aov_80p": aov_80p,
            "aov_median": aov_median,
            # Discount thresholds
            "discount_threshold_high": discount_high,
            "discount_median": discount_median,
            # Engagement thresholds
            "email_engagement_threshold": 5,  # clicks
            "site_visit_threshold": 3,  # visits in 90 days
            "cold_days_threshold": 90,  # days since last engagement
        }

    def get_defaults(self) -> dict[str, float]:
        """Get default thresholds when no data is available."""
        return {
            "top_10_percent_revenue_threshold": 1000.0,
            "revenue_median": 200.0,
            "median_order_count": 2.0,
            "high_order_count": 5.0,
            "repeat_interval_median_days": 45.0,
            "churn_threshold_days": 180.0,
            "at_risk_threshold_days": 90.0,
            "aov_80p": 150.0,
            "aov_median": 75.0,
            "discount_threshold_high": 0.25,
            "discount_median": 0.10,
            "email_engagement_threshold": 5.0,
            "site_visit_threshold": 3.0,
            "cold_days_threshold": 90.0,
        }
