// api/download/[packId].js - Téléchargement de pack depuis Contabo

import { downloadFile, getSignedDownloadUrl } from '../../lib/contabo-storage.js';

export default async function handler(req, res) {
  const { packId } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    console.log(`📥 Demande de téléchargement: ${packId}`);

    // Récupérer les infos du pack
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
        message: 'Ce lien de téléchargement a expiré (48h dépassées)'
      });
      return;
    }

    console.log(`✅ Pack trouvé: ${pack.packKey}`);

    // Option 1 : Rediriger vers l'URL signée Contabo (RECOMMANDÉ)
    const signedUrl = await getSignedDownloadUrl(pack.packKey, 3600); // 1 heure
    res.redirect(302, signedUrl);

    // Option 2 : Streamer le fichier directement (plus lent mais plus de contrôle)
    /*
    const fileBuffer = await downloadFile(pack.packKey);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="pack-${packId}.zip"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    res.status(200).send(fileBuffer);
    */

  } catch (error) {
    console.error('❌ Erreur téléchargement:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}

// Récupérer les infos d'un pack
async function getPack(packId) {
  // Dans un système réel, récupérer depuis la DB
  // Exemple avec Vercel KV:
  // const kv = createClient({ ... });
  // const packData = await kv.get(`pack:${packId}`);
  // return packData ? JSON.parse(packData) : null;
  
  // Pour la démo, retourner des données fictives
  // En production, ceci DOIT venir d'une vraie DB
  return {
    packId,
    packKey: `packs/pack_${packId}.zip`,
    files: [],
    filesCount: 3,
    totalSize: 50 * 1024 * 1024, // 50 MB
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  };
}