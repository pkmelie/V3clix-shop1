// api/download/[packId].js - Téléchargement de pack

export default async function handler(req, res) {
  const { packId } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    // Vérifier que le pack existe et n'est pas expiré
    const pack = await getPack(packId);

    if (!pack) {
      res.status(404).json({
        error: 'Pack introuvable',
        message: 'Ce pack n\'existe pas ou a expiré'
      });
      return;
    }

    // Vérifier l'expiration
    if (new Date(pack.expiresAt) < new Date()) {
      res.status(410).json({
        error: 'Pack expiré',
        message: 'Ce lien de téléchargement a expiré'
      });
      return;
    }

    // Dans un système réel, vous feriez :
    // 1. Récupérer le fichier ZIP depuis votre stockage
    // 2. Le streamer au client
    
    // Exemple avec un fichier stocké :
    /*
    const fileStream = await getFileFromStorage(pack.storagePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="pack-${packId}.zip"`);
    fileStream.pipe(res);
    */

    // Pour la démo, rediriger vers une page d'info
    res.status(200).json({
      message: 'Pack prêt au téléchargement',
      packId,
      files: pack.files,
      totalSize: pack.totalSize,
      createdAt: pack.createdAt,
      expiresAt: pack.expiresAt,
      note: 'Dans un système de production, le fichier ZIP serait téléchargé ici'
    });

  } catch (error) {
    console.error('Erreur téléchargement:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}

// Récupérer les infos d'un pack
async function getPack(packId) {
  // Dans un système réel, récupérer depuis la DB
  // Ex: return await db.packs.findOne({ packId });
  
  // Pour la démo, retourner des données fictives
  return {
    packId,
    files: ['temp1', 'plug2', 'res1'],
    totalSize: 80,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    storagePath: `packs/${packId}.zip`
  };
}