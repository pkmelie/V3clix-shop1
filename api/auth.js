// api/auth.js - Version simplifiée et testée pour Vercel

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse body
    const { username, password } = req.body;

    // Validation simple
    if (!username || !password) {
      res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Username et password requis'
      });
      return;
    }

    // Get credentials from environment variables
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
    const TOKEN = process.env.API_TOKEN || 'default_token_change_me';

    // Check credentials
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      res.status(200).json({
        success: true,
        token: TOKEN,
        user: { username }
      });
      return;
    }

    // Wrong credentials
    res.status(401).json({
      error: 'Identifiants invalides',
      message: 'Nom d\'utilisateur ou mot de passe incorrect'
    });

  } catch (error) {
    console.error('Error in auth:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}