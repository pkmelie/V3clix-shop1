// api/auth.js - Authentification
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { username, password } = req.body;

      // Remplacez par votre vraie logique d'authentification
      // Utilisez des variables d'environnement pour les credentials
      const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Générer un token (en production, utilisez JWT)
        const token = process.env.API_TOKEN || 'votre-token-secret';
        
        return res.status(200).json({
          success: true,
          token: token,
          user: { username, role: 'admin' }
        });
      }

      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Nom d\'utilisateur ou mot de passe incorrect'
      });
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      return res.status(500).json({
        error: 'Erreur serveur',
        message: error.message
      });
    }
  }

  return res.status(405).json({ 
    error: 'Méthode non autorisée' 
  });
}