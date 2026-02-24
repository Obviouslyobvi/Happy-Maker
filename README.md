# Happy-Maker

Evidence-based Cognitive Reappraisal Trainer powered by Claude.

Optimism is a trainable skill. This tool applies the ABCDE reappraisal framework (from CBT and positive psychology) to your specific stressors, identifies cognitive distortions, and builds a personalized 7-day protocol targeting the neural pathways that drive pessimistic thinking.

Grounded in research from Harvard/BU (Lee et al., 2019), Rozanski's 229,391-participant meta-analysis, and Blackburn's Nobel Prize-winning telomere research at UCSF.

## Setup

```bash
npm install
```

Create a `.env` file (or export the variable) with your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Run

```bash
npm start
```

Open `http://localhost:3000` in your browser.

## How It Works

1. Describe your current challenge, stress level, and available daily time
2. Receive a structured assessment: cognitive distortion diagnosis, ABCDE reappraisal, 3 realistic reframes, a personalized daily protocol, and a 7-day training plan
3. Continue the conversation to refine the plan, work through new situations, or go deeper on any area

## Stack

- **Backend**: Node.js + Express, streaming responses via SSE
- **AI**: Claude API (Anthropic SDK)
- **Frontend**: Vanilla HTML/CSS/JS with a dark-themed conversational UI
