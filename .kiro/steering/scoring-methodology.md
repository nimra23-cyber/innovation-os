# Scoring Methodology

## Purpose
This file is the single source of truth for all scoring in InnovationOS. All agents must apply these rubrics consistently across every idea submission.

## Score Definitions

All scores are integers between 0 and 100 (inclusive). Higher scores indicate stronger performance on that dimension.

### Innovation Score (0–100)
Measures the novelty and differentiation potential of the idea relative to the current market.

**Factors (in order of weight):**
1. **Uniqueness** (30%): How distinct is this idea from existing solutions? Does it introduce a new approach, technology, or business model?
2. **Problem-Solution Fit** (25%): How well does the proposed solution address the stated problem in a novel way?
3. **Market Differentiation** (25%): How clearly differentiated is the solution from current competitors?
4. **Technology or Process Innovation** (20%): Does the idea leverage emerging technology or a novel process that creates a defensible advantage?

### Problem Clarity Score (0–100)
Measures how well-defined and validated the problem statement is.

**Factors:**
1. **Specificity** (35%): Is the problem statement specific and well-scoped, or vague and broad?
2. **Target Audience Definition** (30%): Is the target audience clearly and narrowly defined?
3. **Evidence of Pain** (35%): Does the submission indicate awareness of real user pain points?

### Market Demand Score (0–100)
Measures the size, urgency, and accessibility of the target market.

**Factors:**
1. **Market Size Indication** (35%): Does the idea address a large enough addressable market?
2. **Demand Urgency** (30%): Is the problem urgent enough that users would pay or act to solve it now?
3. **Accessibility** (35%): Can the target market be reached with available resources?

### Technical Feasibility Score (0–100)
Measures how buildable the solution is with current technology and realistic resources.

**Factors:**
1. **Technology Readiness** (30%): Are the required technologies mature and accessible?
2. **Team Skill Requirements** (25%): Are the required skills commonly available?
3. **Infrastructure Complexity** (25%): How complex is the required infrastructure?
4. **Development Time Estimate** (20%): Can a realistic MVP be built within 3–6 months?

### Market Feasibility Score (0–100)
Measures commercial viability from a market perspective.

**Factors:**
1. **Target Market Size** (35%): Is the addressable market substantial?
2. **Demand Signals** (30%): Are there indicators of existing or growing demand?
3. **Competitive Density** (20%): Is the market oversaturated, or is there room for a new entrant?
4. **Market Maturity** (15%): Is the market ready for the proposed solution?

### Financial Feasibility Score (0–100)
Measures the financial viability and path to revenue.

**Factors:**
1. **Development Cost Estimate** (35%): Is the estimated development cost achievable for an early-stage team?
2. **Time-to-Revenue Estimate** (35%): How quickly can the business generate its first revenue?
3. **Funding Accessibility** (30%): Is the idea suitable for bootstrapping, grants, or early-stage investment?

## Composite Score Formula

### Launch Readiness Score (0–100)
The Launch Readiness Score is the primary overall readiness indicator.

**Formula:**
```
LaunchReadinessScore = round(
  TechnicalFeasibilityScore × 0.25 +
  MarketFeasibilityScore    × 0.30 +
  FinancialFeasibilityScore × 0.20 +
  InnovationScore           × 0.25
)
```

**Weights rationale:**
- Market Feasibility (30%) is weighted highest because market demand is the most critical predictor of startup success.
- Technical Feasibility (25%) and Innovation (25%) are equally weighted as complementary dimensions.
- Financial Feasibility (20%) is weighted slightly lower as early-stage funding challenges are often surmountable with a strong idea.

## Score Interpretation Guide

| Range | Label | Meaning |
|-------|-------|---------|
| 80–100 | Excellent | Strong performance; focus on execution |
| 60–79 | Good | Solid foundation with specific areas to strengthen |
| 40–59 | Fair | Meaningful potential; key gaps need addressing before progressing |
| 20–39 | Developing | Significant work needed; use recommendations to prioritize improvements |
| 0–19 | Early Stage | Fundamental rethinking may be needed in this dimension |

**Important:** A score below 40 indicates an area for improvement, not failure. Many successful startups had early ideas that scored poorly on one or more dimensions before iteration and validation.
