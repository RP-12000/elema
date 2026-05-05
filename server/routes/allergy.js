const express = require('express');
const OpenAI  = require('openai');
const router  = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/allergy/check
// Body: { cuisineTypes: string[], allergens: string[] }
// Returns: { risk: 'none'|'low'|'high', warnings: string[] }
router.post('/check', async (req, res) => {
  const { cuisineTypes = [], allergens = [] } = req.body;

  if (!allergens.length || !cuisineTypes.length) {
    return res.json({ risk: 'none', warnings: [] });
  }

  // Deduplicate and clean
  const cuisine  = cuisineTypes
    .filter((t) => !['point_of_interest', 'establishment', 'food', 'restaurant'].includes(t))
    .map((t) => t.replace(/_/g, ' '))
    .slice(0, 6)
    .join(', ') || 'restaurant';

  const allergenList = allergens.join(', ');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',   // cheaper model — no vision needed here
      messages: [
        {
          role: 'system',
          content: `You are a food allergy safety assistant. Given a restaurant cuisine type and a list of allergens, assess the risk.
Respond ONLY with a JSON object in this exact format:
{
  "risk": "none" | "low" | "high",
  "warnings": ["short warning string", ...]
}
- "high": the cuisine commonly contains the allergen as a core ingredient
- "low": the allergen may appear in some dishes but is not typical
- "none": very unlikely to be present
Keep each warning under 10 words. Return at most 3 warnings.`,
        },
        {
          role: 'user',
          content: `Cuisine: ${cuisine}\nAllergens: ${allergenList}`,
        },
      ],
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('Allergy check error:', err.message);
    res.status(500).json({ error: 'Failed to check allergens' });
  }
});

module.exports = router;
