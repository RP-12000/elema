require('dotenv').config();
const express = require('express');
const cors = require('cors');

const placesRouter = require('./routes/places');
const visionRouter = require('./routes/vision');
const allergyRouter = require('./routes/allergy');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',
    /\.netlify\.app$/,
  ],
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api/places', placesRouter);
app.use('/api/vision', visionRouter);
app.use('/api/allergy', allergyRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
