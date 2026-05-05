const express = require('express');
const axios = require('axios');
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mapPlace = (place) => ({
  id: place.place_id,
  name: place.name,
  rating: place.rating,
  userRatingsTotal: place.user_ratings_total,
  priceLevel: place.price_level,
  vicinity: place.vicinity,
  location: place.geometry.location,
  openNow: place.opening_hours?.open_now,
  photo: place.photos?.[0]?.photo_reference || null,
  types: place.types,
});

// GET /api/places/nearby?lat=...&lng=...&radius=1500
// Fetches all pages automatically (up to 60 results — Google's hard limit)
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius = 1500 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    let allResults = [];
    let pageToken = null;

    do {
      const params = {
        location: `${lat},${lng}`,
        radius,
        type: 'restaurant',
        key: GOOGLE_API_KEY,
      };
      if (pageToken) params.pagetoken = pageToken;

      const response = await axios.get(`${PLACES_BASE}/nearbysearch/json`, { params });
      const data = response.data;

      allResults = allResults.concat(data.results.map(mapPlace));
      pageToken = data.next_page_token || null;

      // Google requires ~2s before next_page_token becomes valid
      if (pageToken) await delay(2000);

    } while (pageToken);

    res.json({ restaurants: allResults, total: allResults.length });
  } catch (err) {
    console.error('Places nearby error:', err.message);
    res.status(500).json({ error: 'Failed to fetch nearby restaurants' });
  }
});

// GET /api/places/details/:placeId
router.get('/details/:placeId', async (req, res) => {
  const { placeId } = req.params;

  try {
    const response = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields: [
          'name',
          'rating',
          'formatted_phone_number',
          'formatted_address',
          'opening_hours',
          'price_level',
          'reviews',
          'website',
          'geometry',
          'photos',
          'types',
        ].join(','),
        key: GOOGLE_API_KEY,
      },
    });

    const p = response.data.result;

    const hasParking =
      p.types?.includes('parking') ||
      p.types?.includes('car_parking') ||
      false;

    res.json({
      id: placeId,
      name: p.name,
      rating: p.rating,
      address: p.formatted_address,
      phone: p.formatted_phone_number,
      website: p.website,
      priceLevel: p.price_level,
      openingHours: p.opening_hours?.weekday_text || [],
      isOpenNow: p.opening_hours?.open_now,
      reviews: (p.reviews || []).slice(0, 3).map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
      })),
      location: p.geometry?.location,
      hasParking,
      types: p.types,
    });
  } catch (err) {
    console.error('Places details error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurant details' });
  }
});

// GET /api/places/photo?ref=...&maxwidth=400
router.get('/photo', async (req, res) => {
  const { ref, maxwidth = 400 } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref is required' });

  try {
    const response = await axios.get(`${PLACES_BASE}/photo`, {
      params: { photoreference: ref, maxwidth, key: GOOGLE_API_KEY },
      responseType: 'stream',
    });
    response.data.pipe(res);
  } catch (err) {
    console.error('Photo error:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

module.exports = router;
