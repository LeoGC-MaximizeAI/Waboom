"""
Brand Guardrails

Validates creative content against brand guidelines and
automatically fixes common issues.
"""

import re
from typing import Any


class BrandGuardrails:
    """Validate and fix creative content for brand compliance."""

    # Default banned words/phrases
    DEFAULT_BANNED = [
        "cheap",
        "dirt cheap",
        "bargain basement",
        "lowest price",
        "beat any price",
        "limited time only",  # Overused
        "act now",
        "don't miss out",  # Too aggressive
        "once in a lifetime",
        "guaranteed",  # Legal issues
        "free money",
        "no risk",
        "100% guaranteed",
        "spam",
        "click here",  # Spam triggers
        "buy now",  # Can be aggressive
        "urgent",
        "!!",  # Multiple exclamation
        "ALL CAPS WORDS",  # Handled separately
    ]

    # Word replacements for auto-fix
    REPLACEMENTS = {
        "cheap": "affordable",
        "dirt cheap": "great value",
        "bargain": "value",
        "buy now": "shop now",
        "click here": "learn more",
        "don't miss out": "discover",
        "act now": "explore",
        "limited time only": "available now",
        "guaranteed": "designed to",
        "urgent": "timely",
    }

    # Tone adjustments
    AGGRESSIVE_PATTERNS = [
        r"(?i)\byou must\b",
        r"(?i)\byou need to\b",
        r"(?i)\bhurry\b",
        r"(?i)\blast chance\b",
        r"(?i)\bfinal notice\b",
    ]

    def __init__(
        self,
        banned_words: list[str] | None = None,
        custom_replacements: dict[str, str] | None = None,
    ):
        """
        Initialize guardrails with optional custom rules.

        Args:
            banned_words: Additional banned words
            custom_replacements: Additional word replacements
        """
        self.banned_words = set(self.DEFAULT_BANNED)
        if banned_words:
            self.banned_words.update(banned_words)

        self.replacements = dict(self.REPLACEMENTS)
        if custom_replacements:
            self.replacements.update(custom_replacements)

    def validate(self, brief: dict[str, Any]) -> dict[str, Any]:
        """
        Validate a creative brief against brand guidelines.

        Args:
            brief: Creative brief to validate

        Returns:
            Validation result with issues found
        """
        issues = []

        # Check subject lines
        for i, subject in enumerate(brief.get("subject_lines", [])):
            subject_issues = self._check_text(subject, f"subject_line_{i}")
            issues.extend(subject_issues)

        # Check headline
        headline_issues = self._check_text(
            brief.get("headline", ""), "headline"
        )
        issues.extend(headline_issues)

        # Check body copy
        body_issues = self._check_text(
            brief.get("body_copy", ""), "body_copy"
        )
        issues.extend(body_issues)

        # Check CTA
        cta_issues = self._check_text(brief.get("cta", ""), "cta")
        issues.extend(cta_issues)

        return {
            "is_compliant": len(issues) == 0,
            "issues": issues,
            "issue_count": len(issues),
        }

    def validate_and_fix(self, brief: dict[str, Any]) -> dict[str, Any]:
        """
        Validate and automatically fix a creative brief.

        Args:
            brief: Creative brief to validate and fix

        Returns:
            Fixed creative brief
        """
        fixed = dict(brief)

        # Fix subject lines
        if "subject_lines" in fixed:
            fixed["subject_lines"] = [
                self._fix_text(s) for s in fixed["subject_lines"]
            ]

        # Fix headline
        if "headline" in fixed:
            fixed["headline"] = self._fix_text(fixed["headline"])

        # Fix body copy
        if "body_copy" in fixed:
            fixed["body_copy"] = self._fix_text(fixed["body_copy"])

        # Fix CTA
        if "cta" in fixed:
            fixed["cta"] = self._fix_text(fixed["cta"])

        return fixed

    def _check_text(self, text: str, field_name: str) -> list[dict[str, Any]]:
        """Check text for issues."""
        issues = []

        if not text:
            return issues

        text_lower = text.lower()

        # Check banned words
        for banned in self.banned_words:
            if banned.lower() in text_lower:
                issues.append({
                    "field": field_name,
                    "type": "banned_word",
                    "word": banned,
                    "severity": "warning",
                    "suggestion": self.replacements.get(banned.lower(), "remove"),
                })

        # Check for ALL CAPS words (more than 3 chars)
        caps_words = re.findall(r"\b[A-Z]{4,}\b", text)
        for word in caps_words:
            issues.append({
                "field": field_name,
                "type": "all_caps",
                "word": word,
                "severity": "warning",
                "suggestion": word.title(),
            })

        # Check for multiple exclamation marks
        if "!!" in text:
            issues.append({
                "field": field_name,
                "type": "excessive_punctuation",
                "word": "!!",
                "severity": "warning",
                "suggestion": "Use single exclamation or period",
            })

        # Check for aggressive patterns
        for pattern in self.AGGRESSIVE_PATTERNS:
            if re.search(pattern, text):
                match = re.search(pattern, text)
                issues.append({
                    "field": field_name,
                    "type": "aggressive_tone",
                    "word": match.group() if match else pattern,
                    "severity": "suggestion",
                    "suggestion": "Consider softer language",
                })

        # Check subject line length
        if field_name.startswith("subject_line") and len(text) > 60:
            issues.append({
                "field": field_name,
                "type": "too_long",
                "word": f"{len(text)} chars",
                "severity": "warning",
                "suggestion": "Keep under 60 characters for mobile",
            })

        return issues

    def _fix_text(self, text: str) -> str:
        """Automatically fix text issues."""
        if not text:
            return text

        fixed = text

        # Apply word replacements (case-insensitive)
        for banned, replacement in self.replacements.items():
            pattern = re.compile(re.escape(banned), re.IGNORECASE)
            fixed = pattern.sub(replacement, fixed)

        # Fix ALL CAPS words (more than 3 chars) to Title Case
        def title_case_caps(match: re.Match) -> str:
            return match.group().title()

        fixed = re.sub(r"\b[A-Z]{4,}\b", title_case_caps, fixed)

        # Reduce multiple exclamation marks to one
        fixed = re.sub(r"!{2,}", "!", fixed)

        # Clean up multiple spaces
        fixed = re.sub(r" {2,}", " ", fixed)

        return fixed.strip()

    def get_compliance_report(
        self, briefs: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Generate compliance report for multiple briefs.

        Args:
            briefs: List of creative briefs

        Returns:
            Compliance report with summary stats
        """
        total_issues = 0
        compliant_count = 0
        issues_by_type: dict[str, int] = {}

        for brief in briefs:
            result = self.validate(brief)
            if result["is_compliant"]:
                compliant_count += 1

            for issue in result["issues"]:
                total_issues += 1
                issue_type = issue["type"]
                issues_by_type[issue_type] = issues_by_type.get(issue_type, 0) + 1

        return {
            "total_briefs": len(briefs),
            "compliant_briefs": compliant_count,
            "compliance_rate": compliant_count / len(briefs) if briefs else 0,
            "total_issues": total_issues,
            "issues_by_type": issues_by_type,
        }
