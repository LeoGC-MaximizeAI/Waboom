"""
Image Prompt Builder

Generates structured prompts for AI image generation tools
(DALL-E, Midjourney, Stable Diffusion) based on segment
creative briefs.
"""

from typing import Any


class ImagePromptBuilder:
    """Build AI image generation prompts from creative briefs."""

    # Base prompt templates per segment
    PROMPT_TEMPLATES = {
        "VIP": {
            "scene": "An elegant, exclusive setting suggesting VIP access",
            "elements": [
                "velvet rope",
                "gold accents",
                "premium materials",
                "intimate lighting",
            ],
            "mood": "luxurious, exclusive, sophisticated",
            "avoid": "crowded scenes, discount tags, budget aesthetic",
        },
        "Loyal Repeat": {
            "scene": "A warm, welcoming scene suggesting belonging and community",
            "elements": [
                "warm lighting",
                "genuine smiles",
                "comfortable environment",
                "personal touches",
            ],
            "mood": "warm, authentic, appreciative",
            "avoid": "cold, corporate, impersonal settings",
        },
        "High Potential": {
            "scene": "An aspirational lifestyle scene with curated products",
            "elements": [
                "thoughtfully arranged products",
                "lifestyle context",
                "quality details",
                "aspirational setting",
            ],
            "mood": "inspiring, curated, discovery",
            "avoid": "cluttered, overwhelming, sales-focused",
        },
        "At Risk": {
            "scene": "A fresh, renewed scene suggesting positive change",
            "elements": [
                "new beginnings",
                "fresh perspective",
                "inviting doorway",
                "natural light",
            ],
            "mood": "refreshed, optimistic, welcoming",
            "avoid": "aggressive urgency, countdown timers, pressure tactics",
        },
        "Churned": {
            "scene": "A hopeful, humble scene suggesting second chances",
            "elements": [
                "open door",
                "extended hand",
                "soft colors",
                "approachable setting",
            ],
            "mood": "sincere, hopeful, no pressure",
            "avoid": "aggressive sales, desperate tone, over-the-top offers",
        },
        "One-Time Buyers": {
            "scene": "Products beautifully paired together showing completion",
            "elements": [
                "complementary items",
                "complete sets",
                "natural pairings",
                "satisfying arrangement",
            ],
            "mood": "complete, satisfying, natural progression",
            "avoid": "pushy upsell, cluttered display, pressure tactics",
        },
        "Discount-Driven": {
            "scene": "Quality products with smart value messaging",
            "elements": [
                "quality materials visible",
                "value comparison",
                "smart shopper aesthetic",
                "clean presentation",
            ],
            "mood": "smart, savvy, quality-focused",
            "avoid": "cheap aesthetic, bargain bin look, tacky sale signs",
        },
        "Engaged Non-Buyer": {
            "scene": "Trustworthy scene with social proof elements",
            "elements": [
                "customer reviews visible",
                "real testimonials",
                "trust badges",
                "helpful guidance",
            ],
            "mood": "trustworthy, reassuring, helpful",
            "avoid": "high-pressure sales, aggressive CTAs, fake urgency",
        },
        "Cold Subscribers": {
            "scene": "Clean, simple scene with preference/choice elements",
            "elements": [
                "simple options",
                "clean design",
                "clear choices",
                "respectful space",
            ],
            "mood": "respectful, clean, user-controlled",
            "avoid": "cluttered, overwhelming, guilt-tripping",
        },
    }

    # Style modifiers
    STYLE_MODIFIERS = {
        "professional": "clean, corporate, polished",
        "friendly": "warm, approachable, casual",
        "luxury": "high-end, premium, sophisticated",
        "playful": "bright, fun, energetic",
        "minimal": "clean, simple, white space",
    }

    # Technical parameters for different platforms
    PLATFORM_PARAMS = {
        "dalle": {
            "size": "1792x1024",
            "quality": "hd",
            "style": "natural",
        },
        "midjourney": {
            "aspect": "--ar 16:9",
            "quality": "--q 2",
            "style": "--style raw",
        },
        "stable_diffusion": {
            "width": 1024,
            "height": 576,
            "steps": 50,
            "cfg_scale": 7,
        },
    }

    def __init__(self, platform: str = "dalle"):
        """
        Initialize with target platform.

        Args:
            platform: Target platform (dalle, midjourney, stable_diffusion)
        """
        self.platform = platform

    def build(
        self,
        segment_tag: str,
        brief: dict[str, Any],
        style: str = "professional",
    ) -> str:
        """
        Build an image generation prompt.

        Args:
            segment_tag: The segment this image is for
            brief: The creative brief
            style: Style modifier

        Returns:
            Formatted prompt string
        """
        template = self.PROMPT_TEMPLATES.get(segment_tag, {})
        visual_guidance = brief.get("visual_guidance", {})

        # Build prompt components
        scene = template.get("scene", "A professional marketing scene")
        elements = template.get("elements", [])
        mood = template.get("mood", "professional")
        avoid = template.get("avoid", "")

        # Incorporate brief's visual guidance
        colors = visual_guidance.get("colors", "")
        imagery = visual_guidance.get("imagery", "")
        brief_mood = visual_guidance.get("mood", "")

        # Apply style modifier
        style_mod = self.STYLE_MODIFIERS.get(style, "professional")

        # Build the prompt
        prompt_parts = [
            f"Create a marketing hero image: {scene}.",
            f"Include elements: {', '.join(elements[:4])}.",
            f"Color palette: {colors}." if colors else "",
            f"Imagery style: {imagery}." if imagery else "",
            f"Overall mood: {mood}, {brief_mood}, {style_mod}.",
            f"Avoid: {avoid}.",
            "Professional marketing photography style, high quality, well-lit.",
        ]

        prompt = " ".join(p for p in prompt_parts if p)

        # Add platform-specific formatting
        if self.platform == "midjourney":
            params = self.PLATFORM_PARAMS["midjourney"]
            prompt = f"{prompt} {params['aspect']} {params['quality']} {params['style']}"
        elif self.platform == "dalle":
            prompt = f"{prompt} --style vivid"

        return prompt

    def build_batch(
        self,
        briefs: dict[str, dict[str, Any]],
        style: str = "professional",
    ) -> dict[str, str]:
        """
        Build prompts for multiple segments.

        Args:
            briefs: Dict mapping segment tags to briefs
            style: Style modifier for all prompts

        Returns:
            Dict mapping segment tags to prompts
        """
        return {
            segment: self.build(segment, brief, style)
            for segment, brief in briefs.items()
        }

    def build_variations(
        self,
        segment_tag: str,
        brief: dict[str, Any],
        count: int = 3,
    ) -> list[str]:
        """
        Build multiple prompt variations for A/B testing.

        Args:
            segment_tag: The segment
            brief: The creative brief
            count: Number of variations

        Returns:
            List of prompt variations
        """
        variations = []
        styles = list(self.STYLE_MODIFIERS.keys())[:count]

        for style in styles:
            prompt = self.build(segment_tag, brief, style)
            variations.append(prompt)

        return variations

    def get_params(self) -> dict[str, Any]:
        """Get technical parameters for the current platform."""
        return self.PLATFORM_PARAMS.get(self.platform, {})
