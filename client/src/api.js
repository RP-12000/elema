// In development, Vite proxy handles /api → localhost:3001
// In production, VITE_API_URL should be set to your backend URL (e.g. https://your-app.up.railway.app)
const BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiUrl = (path) => `${BASE_URL}${path}`;
