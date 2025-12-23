// api/download/[packId].js - Téléchargement de pack avec CSV

import { getSignedDownloadUrl } from '../../lib/contabo-storage.js';
import { getOrderByPackId } from '../../lib/csv-manager.js';

export default async function handler(req, res) {
  const { packId } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    console.log(`📥 Demande de téléchargement: ${packId}`);

    // Récupérer la commande associée au pack
    const order = await getOrderByPackId(packId);

    if (!order) {
      res.status(404).json({
        error: 'Pack introuvable',
        message: 'Ce pack n\'existe pas'
      });
      return;
    }

    if (!order.pack_file_path) {
      res.status(404).json({
        error: 'Pack non disponible',
        message: 'Le pack n\'a pas encore été généré'
      });
      return;
    }

    console.log(`✅ Pack trouvé: ${order.pack_file_path}`);

    // Générer une nouvelle URL signée (1 heure)
    const signedUrl = await getSignedDownloadUrl(order.pack_file_path, 3600);

    // Rediriger vers l'URL signée Contabo
    res.redirect(302, signedUrl);

    // Note: Dans une version plus avancée, vous pourriez logger le téléchargement
    // await logDownload(packId, order.order_number);

  } catch (error) {
    console.error('❌ Erreur téléchargement:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}