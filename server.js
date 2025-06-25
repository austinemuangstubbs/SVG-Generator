'use strict';

const express = require('express');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

// POST route to proxy SVG generation via OpenAI
app.post('/api/generate-svg', async (req, res) => {
  try {
    const { systemPrompt, userPrompt, screenshot } = req.body || {};

    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: 'systemPrompt and userPrompt are required' });
    }

    // Build user content allowing image input when provided
    const userContent = [
      { type: 'text', text: userPrompt }
    ];
    if (screenshot) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: screenshot // data URL (png/jpg) already base64-encoded
        }
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'o3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 1
    });

    // Extract usage for token/cost reporting
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const imageTokens = usage.image_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens + imageTokens);

    // Updated pricing for o3 (June 2025): $1 per 1M input tokens, $4 per 1M output tokens
    // Divide by 1000 to convert to per-1K token price
    const INPUT_COST_PER_1K = 0.001;  // USD per 1K input tokens (prompt + image)
    const OUTPUT_COST_PER_1K = 0.004; // USD per 1K output tokens (completion)

    const inputCost = ((promptTokens + imageTokens) / 1000) * INPUT_COST_PER_1K;
    const outputCost = (completionTokens / 1000) * OUTPUT_COST_PER_1K;
    const costUSD = Number((inputCost + outputCost).toFixed(6));

    const svgJSON = completion.choices?.[0]?.message?.content || '';
    console.log('svgJSON: ', svgJSON);

    // Remove Markdown-style code fences if present
    let jsonString = svgJSON.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      // If parsing fails, return raw content so frontend can handle
      return res.json({ svg: svgJSON });
    }

    return res.json({
      svg: parsed.svg || '',
      usage: {
        promptTokens,
        imageTokens,
        completionTokens,
        totalTokens,
        costUSD
      }
    });
  } catch (err) {
    console.error('OpenAI request failed:', err);
    return res.status(500).json({ error: 'Failed to generate SVG component' });
  }
});

// Fallback to index.html for all GET requests (single-page style routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend running at http://localhost:${PORT}`);
}); 