// api/create-pack.js - Création de packs avec Contabo + CSV

import archiver from 'archiver';
import { downloadFile, uploadFile, getSignedDownloadUrl } from '../lib/contabo-storage.js';
import { getOrderByPaymentIntent, updateOrder, getProducts } from '../lib/csv-manager.js';

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
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      res.status(400).json({
        success: false,
        message: 'Payment Intent ID requis'
      });
      return;
    }

    console.log(`🔄 Création du pack pour paiement: ${paymentIntentId}`);

    // 1. Récupérer la commande depuis le CSV
    const order = await getOrderByPaymentIntent(paymentIntentId);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
      return;
    }

    if (order.status !== 'paid' && order.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Paiement non validé'
      });
      return;
    }

    // Vérifier si le pack existe déjà
    if (order.pack_id) {
      res.status(200).json({
        success: true,
        packId: order.pack_id,
        downloadUrl: order.download_url,
        message: 'Pack déjà créé'
      });
      return;
    }

    console.log(`📦 Création du pack pour commande: ${order.order_number}`);

    // 2. Récupérer les produits commandés
    const productIds = order.items_ids ? order.items_ids.split(',') : [];
    const products = await getProducts(productIds);

    if (products.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucun produit trouvé pour cette commande'
      });
      return;
    }

    console.log(`📦 ${products.length} fichiers à inclure dans le pack`);

    // 3. Créer le ZIP en mémoire
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('error', err => { throw err; });

    let successCount = 0;
    let totalSize = 0;

    // 4. Télécharger et ajouter chaque fichier au ZIP
    for (const product of products) {
      try {
        console.log(`📥 Téléchargement: ${product.file_path}`);
        
        const fileBuffer = await downloadFile(product.file_path);
        const fileName = product.file_path.split('/').pop();
        
        archive.append(fileBuffer, { name: fileName });
        
        totalSize += fileBuffer.length;
        successCount++;
        
        console.log(`✅ Ajouté: ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error) {
        console.warn(`⚠️ Fichier ignoré: ${product.file_path}`, error.message);
      }
    }

    if (successCount === 0) {
      res.status(500).json({
        success: false,
        message: 'Aucun fichier n\'a pu être ajouté au pack'
      });
      return;
    }

    // 5. Finaliser le ZIP
    await archive.finalize();
    const zipBuffer = Buffer.concat(chunks);
    
    console.log(`📦 ZIP créé: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 6. Générer un pack_id unique
    const packId = 'pack_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    // 7. Uploader le pack sur Contabo
    const packFileName = `${order.order_number}.zip`;
    const packKey = await uploadFile(zipBuffer, packFileName, 'packs');
    
    console.log(`☁️ Pack uploadé: ${packKey}`);

    // 8. Générer une URL signée (48 heures)
    const downloadUrl = await getSignedDownloadUrl(packKey, 172800);

    // 9. Mettre à jour la commande dans le CSV
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await updateOrder(order.order_number, {
      pack_id: packId,
      pack_file_path: packKey,
      download_url: downloadUrl,
      total_size: zipBuffer.length,
      status: 'completed',
      paid_at: new Date().toISOString()
    });

    console.log(`✅ Pack créé avec succès: ${packId}`);

    res.status(200).json({
      success: true,
      packId: packId,
      downloadUrl,
      filesCount: successCount,
      totalSize: `${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`,
      expiresIn: '48 heures'
    });

  } catch (error) {
    console.error('❌ Erreur création pack:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du pack',
      error: error.message
    });
  }
}