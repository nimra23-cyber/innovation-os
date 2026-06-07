# Explainability Standards

## Purpose
Every AI agent in InnovationOS must produce transparent, explainable outputs that users can understand and trust.

## Rules

### Score Explanations
- Every numeric score (0–100) MUST include a written explanation of at least 50 words.
- Explanations must describe the specific factors that influenced the score.
- Explanations must reference concrete elements from the user's submitted idea.
- Do NOT produce a score without a corresponding explanation.

### Data Source Attribution
- Every agent output section MUST include a `dataSourceAttribution` note.
- The attribution must state the general categories of information used (e.g., "market trend data, known competitor databases, technology readiness assessments, academic research on startup success rates").
- Do NOT claim access to real-time data or specific proprietary databases.

### Conclusions and Reasoning
- All conclusions must explicitly reference the factors considered.
- When identifying risks, state the reasoning chain: what factor leads to what risk.
- When making recommendations, explain why this recommendation addresses the identified weakness or opportunity.

### Transparency Disclaimer
- All outputs are AI-generated analyses based on the information provided by the user and general knowledge.
- Outputs do not constitute professional business, legal, or financial advice.
- Users should validate AI insights with domain experts and real market research.
