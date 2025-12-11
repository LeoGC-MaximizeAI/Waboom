"""
Klaviyo API Client

Handles all communication with Klaviyo's API including:
- Profile fetching with pagination (handles 300K+ profiles)
- Event fetching for order history, email engagement, site activity
- Data normalization to standard format
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx


class KlaviyoClient:
    """Client for Klaviyo API v2023-10-15."""

    BASE_URL = "https://a.klaviyo.com/api"
    API_VERSION = "2023-10-15"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Klaviyo-API-Key {api_key}",
            "revision": self.API_VERSION,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def get_profiles(
        self,
        list_id: Optional[str] = None,
        limit: int = 10000,
        page_size: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Fetch profiles from Klaviyo with pagination.

        This handles large datasets efficiently by:
        - Using cursor-based pagination
        - Fetching in parallel batches where possible
        - Respecting rate limits

        Args:
            list_id: Optional list to filter by
            limit: Maximum profiles to fetch
            page_size: Profiles per API call (max 100)

        Returns:
            List of raw Klaviyo profile objects
        """
        profiles = []
        cursor = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(profiles) < limit:
                # Build URL
                if list_id:
                    url = f"{self.BASE_URL}/lists/{list_id}/profiles"
                else:
                    url = f"{self.BASE_URL}/profiles"

                params = {"page[size]": min(page_size, limit - len(profiles))}
                if cursor:
                    params["page[cursor]"] = cursor

                # Make request
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                # Extract profiles
                batch = data.get("data", [])
                if not batch:
                    break

                profiles.extend(batch)

                # Get next cursor
                links = data.get("links", {})
                next_link = links.get("next")
                if not next_link:
                    break

                # Extract cursor from next link
                cursor = self._extract_cursor(next_link)
                if not cursor:
                    break

                # Small delay to respect rate limits
                await asyncio.sleep(0.1)

        return profiles[:limit]

    async def get_events_for_profiles(
        self,
        profile_ids: list[str],
        days: int = 365,
        event_types: Optional[list[str]] = None,
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Fetch events for multiple profiles efficiently.

        Uses batched requests to handle large profile lists.

        Args:
            profile_ids: List of Klaviyo profile IDs
            days: Number of days of history to fetch
            event_types: Filter to specific event types

        Returns:
            Dict mapping profile_id to list of events
        """
        if event_types is None:
            event_types = [
                "Placed Order",
                "Ordered Product",
                "Opened Email",
                "Clicked Email",
                "Viewed Product",
                "Active on Site",
            ]

        events_map: dict[str, list[dict]] = {pid: [] for pid in profile_ids}
        since_date = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"

        # Process in batches to avoid overwhelming the API
        batch_size = 50
        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(profile_ids), batch_size):
                batch_ids = profile_ids[i : i + batch_size]

                # Fetch events for this batch in parallel
                tasks = [
                    self._fetch_profile_events(client, pid, since_date, event_types)
                    for pid in batch_ids
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for pid, result in zip(batch_ids, results):
                    if isinstance(result, list):
                        events_map[pid] = result

                # Rate limit pause between batches
                await asyncio.sleep(0.5)

        return events_map

    async def _fetch_profile_events(
        self,
        client: httpx.AsyncClient,
        profile_id: str,
        since_date: str,
        event_types: list[str],
    ) -> list[dict[str, Any]]:
        """Fetch events for a single profile."""
        events = []
        cursor = None

        while True:
            url = f"{self.BASE_URL}/events"
            params = {
                "filter": f"equals(profile_id,\"{profile_id}\"),greater-or-equal(datetime,{since_date})",
                "page[size]": 100,
            }
            if cursor:
                params["page[cursor]"] = cursor

            try:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()
                data = response.json()

                batch = data.get("data", [])
                events.extend(batch)

                links = data.get("links", {})
                next_link = links.get("next")
                if not next_link:
                    break

                cursor = self._extract_cursor(next_link)
                if not cursor:
                    break

            except Exception:
                break

        return events

    async def get_events_for_profile(
        self, profile_id: str, days: int = 365
    ) -> list[dict[str, Any]]:
        """Fetch events for a single profile."""
        result = await self.get_events_for_profiles([profile_id], days=days)
        return result.get(profile_id, [])

    async def get_profile_by_email(self, email: str) -> Optional[dict[str, Any]]:
        """Look up a profile by email address."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.BASE_URL}/profiles"
            params = {"filter": f'equals(email,"{email}")'}

            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()

            profiles = data.get("data", [])
            return profiles[0] if profiles else None

    async def get_profile_by_id(self, profile_id: str) -> Optional[dict[str, Any]]:
        """Fetch a profile by ID."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.BASE_URL}/profiles/{profile_id}"

            response = await client.get(url, headers=self.headers)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()

            return data.get("data")

    def normalize_profile(
        self,
        raw_profile: dict[str, Any],
        events: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Normalize a Klaviyo profile and events into our standard format.

        This transforms the raw Klaviyo API response into a flat structure
        that the segmentation engine can process efficiently.
        """
        attrs = raw_profile.get("attributes", {})
        props = attrs.get("properties", {})

        # Extract profile ID
        profile_id = raw_profile.get("id", "")

        # Parse dates
        created_at = self._parse_date(attrs.get("created"))
        current_date = datetime.utcnow()

        # Process events to calculate metrics
        order_events = [e for e in events if self._get_event_type(e) in ["Placed Order", "Ordered Product"]]
        email_open_events = [e for e in events if self._get_event_type(e) == "Opened Email"]
        email_click_events = [e for e in events if self._get_event_type(e) == "Clicked Email"]
        site_events = [e for e in events if self._get_event_type(e) in ["Active on Site", "Viewed Product"]]

        # Calculate order metrics
        order_dates = sorted([
            self._parse_date(e.get("attributes", {}).get("datetime"))
            for e in order_events
            if self._get_event_type(e) == "Placed Order"
        ])
        order_dates = [d for d in order_dates if d]

        first_order_date = order_dates[0] if order_dates else None
        last_order_date = order_dates[-1] if order_dates else None

        days_since_last_order = (
            (current_date - last_order_date).days if last_order_date else 9999
        )

        # Calculate average days between orders
        avg_days_between = 0
        if len(order_dates) > 1:
            intervals = [
                (order_dates[i + 1] - order_dates[i]).days
                for i in range(len(order_dates) - 1)
            ]
            avg_days_between = sum(intervals) / len(intervals) if intervals else 0

        # Calculate revenue metrics
        total_revenue = sum(
            float(e.get("attributes", {}).get("event_properties", {}).get("value", 0) or 0)
            for e in order_events
            if self._get_event_type(e) == "Placed Order"
        )
        order_count = len([e for e in order_events if self._get_event_type(e) == "Placed Order"])
        aov = total_revenue / order_count if order_count > 0 else 0

        # Extract categories from ordered products
        categories = []
        for e in order_events:
            event_props = e.get("attributes", {}).get("event_properties", {})
            cats = event_props.get("categories", [])
            if isinstance(cats, list):
                categories.extend(cats)
            items = event_props.get("items", [])
            for item in items:
                if item.get("categories"):
                    categories.extend(item["categories"])

        # Get top category
        category_counts = {}
        for cat in categories:
            category_counts[cat] = category_counts.get(cat, 0) + 1
        top_category = max(category_counts, key=category_counts.get) if category_counts else None

        # Calculate discount metrics
        discounts = []
        for e in order_events:
            event_props = e.get("attributes", {}).get("event_properties", {})
            discount = event_props.get("discount_value") or event_props.get("discount", 0)
            if discount:
                discounts.append(float(discount))
        avg_discount = sum(discounts) / len(discounts) if discounts else 0

        # Email engagement
        email_click_count = len(email_click_events)
        email_open_count = len(email_open_events)

        # Last email click
        email_click_dates = [
            self._parse_date(e.get("attributes", {}).get("datetime"))
            for e in email_click_events
        ]
        email_click_dates = [d for d in email_click_dates if d]
        last_email_click = max(email_click_dates) if email_click_dates else None
        days_since_last_email_click = (
            (current_date - last_email_click).days if last_email_click else 9999
        )

        # Site activity (last 90 days)
        ninety_days_ago = current_date - timedelta(days=90)
        recent_site_events = [
            e for e in site_events
            if self._parse_date(e.get("attributes", {}).get("datetime"))
            and self._parse_date(e.get("attributes", {}).get("datetime")) > ninety_days_ago
        ]
        site_visits_90d = len(recent_site_events)

        return {
            "profile_id": profile_id,
            "email": attrs.get("email", ""),
            "first_name": attrs.get("first_name", ""),
            "last_name": attrs.get("last_name", ""),
            "phone_number": attrs.get("phone_number", ""),
            "city": attrs.get("location", {}).get("city", ""),
            "region": attrs.get("location", {}).get("region", ""),
            "country": attrs.get("location", {}).get("country", ""),
            "timezone": attrs.get("location", {}).get("timezone", ""),
            # Order metrics
            "first_order_date": first_order_date.isoformat() if first_order_date else None,
            "last_order_date": last_order_date.isoformat() if last_order_date else None,
            "order_count": order_count,
            "total_revenue": total_revenue,
            "average_order_value": aov,
            "days_since_last_order": days_since_last_order,
            "avg_days_between_orders": avg_days_between,
            # Category
            "purchased_categories": list(set(categories)),
            "top_category": top_category,
            # Discount
            "average_discount": avg_discount,
            # Email engagement
            "email_click_count": email_click_count,
            "email_open_count": email_open_count,
            "days_since_last_email_click": days_since_last_email_click,
            # Site activity
            "site_visits_last_90d": site_visits_90d,
            # Custom properties (pass through)
            "traffic_source": props.get("traffic_source") or props.get("$source"),
            "acquisition_source": props.get("acquisition_source"),
            "subscription_status": props.get("subscription_status", "subscribed"),
            "predicted_clv": float(props.get("predicted_clv", 0) or 0),
            "churn_risk_score": float(props.get("churn_risk_score", 0) or 0),
            # Metadata
            "created_at": created_at.isoformat() if created_at else None,
            "customer_lifetime_days": (
                (current_date - created_at).days if created_at else 0
            ),
        }

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse ISO date string."""
        if not date_str:
            return None
        try:
            # Handle various ISO formats
            date_str = date_str.replace("Z", "+00:00")
            if "+" in date_str:
                date_str = date_str.split("+")[0]
            return datetime.fromisoformat(date_str)
        except (ValueError, TypeError):
            return None

    def _get_event_type(self, event: dict[str, Any]) -> str:
        """Extract event type from event object."""
        return event.get("attributes", {}).get("metric", {}).get("name", "")

    def _extract_cursor(self, next_link: str) -> Optional[str]:
        """Extract cursor from pagination link."""
        if "page[cursor]=" in next_link:
            return next_link.split("page[cursor]=")[1].split("&")[0]
        return None
