const express = require('express');
const OpenAI = require('openai');
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── POST /api/vision/detect-obstacles ───────────────────────────────────────
// Body: { image: "data:image/jpeg;base64,..." }
// Returns: { hasObstacle, obstacleType, severity, action, distance }
router.post('/detect-obstacles', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'image (base64) is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an obstacle detection assistant helping visually impaired users navigate safely.
Analyze the image and respond with a JSON object in this exact format:
{
  "hasObstacle": true/false,
  "obstacleType": "description of obstacle or null",
  "severity": "none" | "low" | "medium" | "high",
  "action": "short spoken instruction for the user (e.g. 'Step slightly to the right', 'Stop, wall ahead', 'Path is clear')",
  "distance": "estimated distance like 'very close', '1-2 meters', 'far away' or null"
}
Rules:
- severity "high": immediate danger (wall, step, moving person/vehicle very close)
- severity "medium": caution needed (furniture, pole, parked bike within 2m)
- severity "low": minor obstacle (small object, slight narrowing of path)
- severity "none": path is clear
- action must be under 15 words, imperative, spoken naturally
- Be concise. The action field will be read aloud to the user.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image, detail: 'low' },
            },
            {
              type: 'text',
              text: 'Detect any obstacles in my path. Respond only with the JSON object.',
            },
          ],
        },
      ],
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('Vision obstacle error:', err.message);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// ─── POST /api/vision/describe-scene ─────────────────────────────────────────
// Body: { image: "data:image/jpeg;base64,..." }
// Returns: { description, landmarks, suggestions }
router.post('/describe-scene', async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'image (base64) is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a scene description assistant for visually impaired users.
Describe the scene in the image clearly and helpfully. Respond with a JSON object:
{
  "description": "2-3 sentence natural description of the scene, focusing on what's relevant for navigation",
  "landmarks": ["list of notable landmarks or reference points visible"],
  "suggestions": "one practical navigation suggestion based on the scene"
}
Focus on: spatial layout, exits/entrances, people, vehicles, signage, lighting conditions.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image, detail: 'high' },
            },
            {
              type: 'text',
              text: 'Describe this scene for a visually impaired person. Respond only with the JSON object.',
            },
          ],
        },
      ],
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error('Vision scene error:', err.message);
    res.status(500).json({ error: 'Failed to describe scene' });
  }
});

module.exports = router;
