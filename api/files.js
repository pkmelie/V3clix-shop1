// api/files.js - Route Vercel Serverless
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vérifier le token d'authentification
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Format: "Bearer TOKEN"

  // Remplacez par votre vrai token ou utilisez une variable d'environnement
  const VALID_TOKEN = process.env.API_TOKEN || 'votre-token-secret';

  if (!token || token !== VALID_TOKEN) {
    return res.status(401).json({ 
      error: 'Token invalide',
      message: 'Authentification requise' 
    });
  }

  // Gérer les requêtes GET pour lister les fichiers
  if (req.method === 'GET') {
    try {
      // Exemple de données - remplacez par votre vraie logique
      const files = [
        { id: 1, name: 'document1.pdf', size: 1024, date: new Date().toISOString() },
        { id: 2, name: 'image.jpg', size: 2048, date: new Date().toISOString() }
      ];

      return res.status(200).json({ 
        success: true, 
        files 
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des fichiers:', error);
      return res.status(500).json({ 
        error: 'Erreur serveur', 
        message: error.message 
      });
    }
  }

  // Gérer les requêtes POST pour uploader des fichiers
  if (req.method === 'POST') {
    try {
      const { fileName, fileData } = req.body;

      if (!fileName || !fileData) {
        return res.status(400).json({ 
          error: 'Données manquantes',
          message: 'fileName et fileData sont requis' 
        });
      }

      // Logique de sauvegarde du fichier
      // Note: Sur Vercel, vous devez utiliser un service externe comme:
      // - Vercel Blob Storage
      // - AWS S3
      // - Cloudinary
      // Car le système de fichiers est en lecture seule

      return res.status(200).json({ 
        success: true, 
        message: 'Fichier uploadé avec succès',
        file: { name: fileName, uploadedAt: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      return res.status(500).json({ 
        error: 'Erreur serveur', 
        message: error.message 
      });
    }
  }

  // Méthode non supportée
  return res.status(405).json({ 
    error: 'Méthode non autorisée',
    allowedMethods: ['GET', 'POST', 'OPTIONS']
  });
}