// api/files.js - Version simplifiée et testée pour Vercel

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

  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const validToken = process.env.API_TOKEN || 'default_token_change_me';

    if (!token || token !== validToken) {
      res.status(401).json({ 
        error: 'Token invalide',
        message: 'Authentification requise'
      });
      return;
    }

    // Handle GET request
    if (req.method === 'GET') {
      // Mock data - remplacez par votre vraie logique
      const files = [
        {
          id: 1,
          name: 'Pack Premium.zip',
          size: 15728640, // 15 MB
          date: new Date().toISOString(),
          type: 'pack',
          downloads: 42
        },
        {
          id: 2,
          name: 'Guide Complet.pdf',
          size: 2097152, // 2 MB
          date: new Date(Date.now() - 86400000).toISOString(),
          type: 'document',
          downloads: 18
        },
        {
          id: 3,
          name: 'Templates Pro.zip',
          size: 5242880, // 5 MB
          date: new Date(Date.now() - 172800000).toISOString(),
          type: 'pack',
          downloads: 27
        }
      ];

      res.status(200).json({
        success: true,
        files: files,
        total: files.length
      });
      return;
    }

    // Handle POST request (upload)
    if (req.method === 'POST') {
      const { fileName, fileData, fileType } = req.body;

      if (!fileName) {
        res.status(400).json({
          error: 'Données manquantes',
          message: 'fileName requis'
        });
        return;
      }

      // Simuler un upload réussi
      res.status(200).json({
        success: true,
        message: 'Fichier uploadé',
        file: {
          id: Date.now(),
          name: fileName,
          type: fileType || 'unknown',
          uploadedAt: new Date().toISOString()
        }
      });
      return;
    }

    // Method not allowed
    res.status(405).json({
      error: 'Méthode non autorisée',
      allowedMethods: ['GET', 'POST']
    });

  } catch (error) {
    console.error('Error in files:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}