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
app.use(express.json());

// POST route to proxy SVG generation via OpenAI
app.post('/api/generate-svg', async (req, res) => {
  try {
    const { systemPrompt, userPrompt } = req.body || {};

    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: 'systemPrompt and userPrompt are required' });
    }

    const completion = await openai.chat.completions.create({
      model: 'o3', // GPT-4.1 equivalent (update if official model string differs)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 1
    });

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

    return res.json({ svg: parsed.svg || '' });
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