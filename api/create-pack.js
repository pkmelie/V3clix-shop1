// api/create-pack.js - Création de packs personnalisés

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const { files } = req.body;

    // Validation
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucun fichier sélectionné'
      });
      return;
    }

    // Générer un ID unique pour le pack
    const packId = generatePackId();
    
    // Calculer la taille totale
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    // Dans un système réel, vous feriez :
    // 1. Créer une archive ZIP avec les fichiers sélectionnés
    // 2. L'uploader sur un service de stockage (AWS S3, Cloudflare R2, etc.)
    // 3. Générer un lien de téléchargement sécurisé

    // Pour l'instant, on simule la création
    const downloadUrl = generateDownloadUrl(packId);

    // Enregistrer l'info du pack (dans une vraie DB)
    await savePack({
      packId,
      files: files.map(f => f.id),
      totalSize,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48h
    });

    // Optionnel : Envoyer un email avec le lien
    // await sendEmail(email, downloadUrl);

    res.status(200).json({
      success: true,
      packId,
      downloadUrl,
      filesCount: files.length,
      totalSize: `${totalSize} MB`,
      expiresIn: '48 heures'
    });

  } catch (error) {
    console.error('Erreur création pack:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du pack',
      error: error.message
    });
  }
}

// Générer un ID unique
function generatePackId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pack_${timestamp}${random}`;
}

// Générer l'URL de téléchargement
function generateDownloadUrl(packId) {
  // Dans un système réel, ceci serait une URL signée temporaire
  // Ex: https://storage.example.com/packs/pack_xyz123?expires=...&signature=...
  
  // Pour la démo, on retourne une URL vers une route API
  return `/api/download/${packId}`;
}

// Sauvegarder les infos du pack
async function savePack(packData) {
  // Dans un système réel, sauvegarder dans une base de données
  // Ex: await db.packs.insert(packData);
  
  // Pour la démo, on log juste
  console.log('Pack créé:', packData);
  
  // Vous pouvez utiliser Vercel KV, Supabase, MongoDB, etc.
  return true;
}