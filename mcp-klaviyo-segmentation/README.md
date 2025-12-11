# Klaviyo Segmentation MCP Server

A Model Context Protocol (MCP) server that provides VIP customer segmentation and marketing automation tools using Klaviyo data. This server handles all the heavy data processing locally, allowing Claude to work with large datasets (300K+ profiles) without burning context tokens.

## What This Does

Instead of you manually fetching data and processing it in conversation, you simply tell Claude:

```
Analyze my Klaviyo segments and create marketing briefs
```

And Claude calls:
```
analyze_segments() → get_segment_summary() → generate_creative_briefs()
```

All the heavy lifting happens in the MCP server. Claude only sees concise summaries.

## Features

- **9 Customer Segments** with dynamic threshold calculation:
  - VIP, Loyal Repeat, High Potential, At Risk, Churned
  - One-Time Buyers, Discount-Driven, Engaged Non-Buyer, Cold Subscribers

- **Marketing Automation Outputs**:
  - Testable hypotheses per segment
  - Micro-segments (3-5 per parent segment)
  - Creative briefs with copy and visual guidance
  - AI image generation prompts
  - Ops-ready CSV/JSON exports

## Installation

### Option 1: Install from GitHub (Recommended)

```bash
# Install directly from GitHub
pip install git+https://github.com/LeoGC-MaximizeAI/Waboom.git#subdirectory=mcp-klaviyo-segmentation

# Or with uvx (for Claude Desktop)
uvx --from git+https://github.com/LeoGC-MaximizeAI/Waboom.git#subdirectory=mcp-klaviyo-segmentation klaviyo-segmentation-mcp
```

### Option 2: Install Locally

```bash
# Clone the repo
git clone https://github.com/LeoGC-MaximizeAI/Waboom.git
cd Waboom/mcp-klaviyo-segmentation

# Install in development mode
pip install -e .
```

## Configuration

### 1. Get Your Klaviyo API Key

1. Log into Klaviyo
2. Go to **Settings** → **API Keys**
3. Create a new **Private API Key** with these scopes:
   - `profiles:read`
   - `events:read`
   - `lists:read`
   - `segments:read`

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "klaviyo-segmentation": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/LeoGC-MaximizeAI/Waboom.git#subdirectory=mcp-klaviyo-segmentation",
        "klaviyo-segmentation-mcp"
      ],
      "env": {
        "KLAVIYO_API_KEY": "pk_your_private_key_here"
      }
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "klaviyo-segmentation": {
      "command": "klaviyo-segmentation-mcp",
      "env": {
        "KLAVIYO_API_KEY": "pk_your_private_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After saving the config, restart Claude Desktop to load the MCP server.

## Usage

Once configured, you can ask Claude things like:

### Run Segmentation Analysis
```
Analyze my Klaviyo customer segments
```

### Get Segment Details
```
Show me details about my VIP segment
```

### Generate Marketing Content
```
Create creative briefs for my At Risk and Churned segments
```

### Export for Activation
```
Export the segmentation results as CSV for our ESP
```

### Analyze Single Customer
```
Analyze customer john@example.com and tell me what segment they're in
```

## Available Tools

| Tool | Description |
|------|-------------|
| `analyze_segments` | Run full segmentation pipeline on Klaviyo data |
| `get_segment_summary` | Get counts and metrics per segment |
| `generate_creative_briefs` | Create marketing briefs with copy and visuals |
| `export_ops_csv` | Export as CSV/JSON for ESP activation |
| `get_customer_analysis` | Analyze a single customer by email |
| `get_segment_hypotheses` | Get testable marketing hypotheses |
| `configure_thresholds` | View or customize segmentation thresholds |

## Segment Definitions

### VIP
- **Rule**: Top 10% revenue AND 2x median order count
- **Action**: Exclusive access, premium treatment

### Loyal Repeat
- **Rule**: Above median orders AND consistent purchase interval AND recent activity
- **Action**: Loyalty rewards, subscription offers

### High Potential
- **Rule**: Top 20% AOV AND below median order count AND not churned
- **Action**: Bundle offers, nurture sequences

### At Risk
- **Rule**: 2+ orders AND 90-180 days since last order
- **Action**: Win-back campaigns, urgency messaging

### Churned
- **Rule**: Has ordered AND 180+ days since last order
- **Action**: Deep discounts, re-engagement

### One-Time Buyers
- **Rule**: Exactly 1 order AND not churned
- **Action**: Second purchase incentives

### Discount-Driven
- **Rule**: 25%+ average discount AND 2+ orders
- **Action**: Value messaging, discount ladder-down

### Engaged Non-Buyer
- **Rule**: 0 orders AND high email engagement OR site visits
- **Action**: First purchase incentives, social proof

### Cold Subscribers
- **Rule**: 0 orders AND low engagement
- **Action**: Re-engagement or list hygiene

## Dynamic Thresholds

All thresholds are calculated from your actual data:

- `top_10_percent_revenue_threshold`: 90th percentile of revenue
- `median_order_count`: Median orders across all customers
- `repeat_interval_median_days`: Median days between orders for repeat buyers
- `aov_80p`: 80th percentile of AOV
- `discount_threshold_high`: Configurable (default 25%)

This means the segmentation adapts to YOUR customer distribution, not arbitrary cutoffs.

## Development

```bash
# Clone and install dev dependencies
git clone https://github.com/LeoGC-MaximizeAI/Waboom.git
cd Waboom/mcp-klaviyo-segmentation
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/
ruff check src/
```

## Architecture

```
src/klaviyo_segmentation/
├── server.py           # MCP server entry point
├── klaviyo_client.py   # Klaviyo API client
├── segmentation/
│   ├── classifier.py   # 9 segment rules
│   ├── thresholds.py   # Dynamic threshold calculation
│   ├── hypotheses.py   # Marketing hypothesis generation
│   └── microsegments.py# Micro-segmentation engine
├── creative/
│   ├── briefs.py       # Creative brief generation
│   ├── guardrails.py   # Brand compliance
│   └── image_prompts.py# AI image prompts
└── output/
    └── formatters.py   # CSV/JSON/Klaviyo export
```

## License

MIT
