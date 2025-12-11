"""
Creative Brief Generator

Generates marketing creative briefs for each segment including:
- Primary emotion and positioning
- Subject lines
- Headlines and body copy
- Visual guidance
"""

from typing import Any


class BriefGenerator:
    """Generate creative briefs per segment."""

    # Brief templates per segment
    BRIEF_TEMPLATES = {
        "VIP": {
            "primary_emotion": "Exclusivity & Recognition",
            "positioning": "You're part of our inner circle - get first access to what matters",
            "subject_lines": [
                "Your exclusive early access is ready",
                "For our VIPs only: First look inside",
                "[Name], you've earned something special",
                "Private access: Before anyone else",
                "The VIP experience awaits you",
            ],
            "headline": "Welcome to the Inner Circle",
            "body_copy": (
                "As one of our most valued customers, you get access to new arrivals "
                "48 hours before everyone else. No codes needed - your VIP status "
                "does the talking."
            ),
            "cta": "Shop Your Early Access",
            "visual_guidance": {
                "style": "Premium, luxurious",
                "colors": "Deep jewel tones, gold accents",
                "imagery": "Exclusive, behind-the-scenes, velvet rope aesthetic",
                "mood": "Sophisticated, confident, elevated",
            },
            "tone": "Confident, exclusive, warm appreciation",
        },
        "Loyal Repeat": {
            "primary_emotion": "Belonging & Appreciation",
            "positioning": "Thank you for being part of our story",
            "subject_lines": [
                "A thank you from us to you",
                "You're the reason we do this",
                "Something special for our regulars",
                "We noticed (and we appreciate you)",
                "For customers like you",
            ],
            "headline": "Because Loyalty Deserves Recognition",
            "body_copy": (
                "You've been with us through it all, and that means everything. "
                "Here's a little something to say thanks - and a sneak peek at "
                "what's coming next."
            ),
            "cta": "See What's New",
            "visual_guidance": {
                "style": "Warm, authentic",
                "colors": "Warm neutrals, soft earth tones",
                "imagery": "Community, togetherness, genuine moments",
                "mood": "Grateful, friendly, trusted",
            },
            "tone": "Warm, appreciative, familiar",
        },
        "High Potential": {
            "primary_emotion": "Discovery & Aspiration",
            "positioning": "There's so much more to explore",
            "subject_lines": [
                "We think you'll love this",
                "Based on your great taste...",
                "Your next favorite is waiting",
                "Discover more of what you love",
                "We picked these just for you",
            ],
            "headline": "Curated Just for You",
            "body_copy": (
                "Your first purchase showed us you have great taste. "
                "We've handpicked a collection we think you'll love - "
                "each piece chosen to complement what you already own."
            ),
            "cta": "Explore Your Picks",
            "visual_guidance": {
                "style": "Aspirational, curated",
                "colors": "Clean, modern palette",
                "imagery": "Thoughtfully arranged products, lifestyle context",
                "mood": "Inspiring, personalized, exciting",
            },
            "tone": "Excited, personalized, guiding",
        },
        "At Risk": {
            "primary_emotion": "FOMO & Reconnection",
            "positioning": "We miss you - and things have changed",
            "subject_lines": [
                "It's been a while...",
                "Things are different now",
                "We've saved something for you",
                "Before you go...",
                "A lot has changed since your last visit",
            ],
            "headline": "We've Been Saving This for You",
            "body_copy": (
                "We noticed it's been a while since your last visit. "
                "A lot has changed - new arrivals, improved everything, "
                "and this exclusive offer just for you."
            ),
            "cta": "See What's New",
            "visual_guidance": {
                "style": "Fresh, renewed",
                "colors": "Bright, optimistic",
                "imagery": "New products, transformation, before/after",
                "mood": "Inviting, curious, gentle urgency",
            },
            "tone": "Friendly, not pushy, genuine",
        },
        "Churned": {
            "primary_emotion": "Nostalgia & Second Chance",
            "positioning": "We'd love another chance",
            "subject_lines": [
                "We miss you (and we mean it)",
                "Here's what you've been missing",
                "Can we win you back?",
                "Things are better now",
                "A fresh start?",
            ],
            "headline": "We'd Love to Make Things Right",
            "body_copy": (
                "Whatever happened, we want to earn your trust back. "
                "We've been working hard to improve, and we'd love "
                "to show you what's changed."
            ),
            "cta": "Give Us Another Chance",
            "visual_guidance": {
                "style": "Humble, hopeful",
                "colors": "Soft, approachable",
                "imagery": "Open doors, fresh starts, welcoming",
                "mood": "Sincere, hopeful, low pressure",
            },
            "tone": "Humble, genuine, not desperate",
        },
        "One-Time Buyers": {
            "primary_emotion": "Curiosity & Completion",
            "positioning": "Your collection isn't complete yet",
            "subject_lines": [
                "The perfect partner to your purchase",
                "Don't stop now",
                "You started something great",
                "This goes perfectly with what you got",
                "Complete the look",
            ],
            "headline": "Your Purchase Deserves a Partner",
            "body_copy": (
                "Love what you got? We thought so. Here's what our customers "
                "typically pair it with - and right now, you can get it "
                "with something special."
            ),
            "cta": "Complete Your Collection",
            "visual_guidance": {
                "style": "Complementary, cohesive",
                "colors": "Matching previous purchase aesthetic",
                "imagery": "Product pairings, complete sets, lifestyle shots",
                "mood": "Satisfying, completing, natural next step",
            },
            "tone": "Helpful, suggestive, not pushy",
        },
        "Discount-Driven": {
            "primary_emotion": "Smart Savings & Value",
            "positioning": "Smart shoppers know value when they see it",
            "subject_lines": [
                "The smart shopper's guide",
                "Maximum value, minimum spend",
                "You know a good deal",
                "Your deal radar is going off",
                "Smart savings inside",
            ],
            "headline": "You Know Value When You See It",
            "body_copy": (
                "We know you appreciate a smart deal - and we respect that. "
                "Here's how to get the most value: quality that lasts, "
                "at prices that make sense."
            ),
            "cta": "Shop Smart Deals",
            "visual_guidance": {
                "style": "Value-focused, quality emphasis",
                "colors": "Trust colors - blue, green",
                "imagery": "Value comparison, quality details, smart choices",
                "mood": "Confident, savvy, smart",
            },
            "tone": "Respectful, value-focused, not cheap",
        },
        "Engaged Non-Buyer": {
            "primary_emotion": "Confidence & Trust",
            "positioning": "Ready when you are",
            "subject_lines": [
                "Still thinking about it?",
                "Here's what others are saying",
                "The reviews are in",
                "Let us help you decide",
                "Questions? We have answers",
            ],
            "headline": "Let's Make This Easy",
            "body_copy": (
                "We noticed you've been browsing - and we get it, "
                "decisions are hard. Here's what real customers say, "
                "plus a little something to help you take the leap."
            ),
            "cta": "See What Others Say",
            "visual_guidance": {
                "style": "Social proof, trustworthy",
                "colors": "Trustworthy, calming",
                "imagery": "Reviews, testimonials, real customers",
                "mood": "Reassuring, helpful, no pressure",
            },
            "tone": "Helpful, understanding, confidence-building",
        },
        "Cold Subscribers": {
            "primary_emotion": "Curiosity & Relevance",
            "positioning": "Is this still working for you?",
            "subject_lines": [
                "Still interested?",
                "Let's make sure you see what matters",
                "A quick check-in",
                "Want to stay in the loop?",
                "Should we keep in touch?",
            ],
            "headline": "Let's Make Sure You're Getting What You Want",
            "body_copy": (
                "We want to send you things you actually care about. "
                "Take a second to update your preferences, or let us know "
                "if you'd rather part ways - no hard feelings."
            ),
            "cta": "Update Your Preferences",
            "visual_guidance": {
                "style": "Clean, respectful",
                "colors": "Neutral, professional",
                "imagery": "Simple, clean, preference options",
                "mood": "Respectful, low pressure, honest",
            },
            "tone": "Respectful, honest, giving control",
        },
    }

    def __init__(self, brand_voice: str = "professional"):
        """
        Initialize with brand voice setting.

        Args:
            brand_voice: Tone modifier (professional, friendly, luxury, playful)
        """
        self.brand_voice = brand_voice

    def generate(
        self,
        segment_tag: str,
        hypotheses: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Generate a creative brief for a segment.

        Args:
            segment_tag: The segment to generate a brief for
            hypotheses: Optional hypotheses to incorporate

        Returns:
            Creative brief dict
        """
        template = self.BRIEF_TEMPLATES.get(segment_tag)
        if not template:
            return self._default_brief(segment_tag)

        brief = dict(template)
        brief["segment"] = segment_tag

        # Adjust for brand voice
        brief = self._apply_brand_voice(brief)

        # Incorporate hypotheses if provided
        if hypotheses:
            brief["related_hypotheses"] = [h.get("statement") for h in hypotheses[:2]]

        return brief

    def _apply_brand_voice(self, brief: dict[str, Any]) -> dict[str, Any]:
        """Adjust brief tone based on brand voice setting."""
        if self.brand_voice == "luxury":
            brief["visual_guidance"]["style"] = (
                brief["visual_guidance"].get("style", "") + ", elevated, premium"
            )
            brief["tone"] = brief.get("tone", "") + ", refined"

        elif self.brand_voice == "playful":
            brief["visual_guidance"]["colors"] = "Bright, energetic"
            brief["tone"] = brief.get("tone", "") + ", fun, energetic"

        elif self.brand_voice == "friendly":
            brief["tone"] = brief.get("tone", "") + ", conversational, warm"

        return brief

    def _default_brief(self, segment_tag: str) -> dict[str, Any]:
        """Generate a default brief for unknown segments."""
        return {
            "segment": segment_tag,
            "primary_emotion": "Connection",
            "positioning": "We're here when you're ready",
            "subject_lines": [
                f"Something for you",
                f"Check this out",
                f"You might like this",
            ],
            "headline": "Something Worth Your Time",
            "body_copy": "We've got something we think you'll appreciate.",
            "cta": "Learn More",
            "visual_guidance": {
                "style": "Clean, professional",
                "colors": "Brand colors",
                "imagery": "Product focused",
                "mood": "Neutral, approachable",
            },
            "tone": "Professional, friendly",
        }
