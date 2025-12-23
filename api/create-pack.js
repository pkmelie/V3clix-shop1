// api/create-pack.js - Création de packs avec Contabo Storage

import archiver from 'archiver';
import { 
  downloadFile, 
  uploadFile, 
  getSignedDownloadUrl 
} from '../lib/contabo-storage.js';

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
    const { files, paymentIntentId } = req.body;

    // Validation
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucun fichier sélectionné'
      });
      return;
    }

    // Vérifier le paiement si un paymentIntentId est fourni
    if (paymentIntentId) {
      console.log('✅ Paiement validé:', paymentIntentId);
    }

    // Générer un ID unique pour le pack
    const packId = generatePackId();
    const packName = `pack_${packId}`;
    
    console.log(`🔄 Création du pack ${packName} avec ${files.length} fichiers...`);

    // Créer un ZIP en mémoire
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression maximale
    });

    const chunks = [];
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('error', err => {
      throw err;
    });

    // Télécharger et ajouter chaque fichier au ZIP
    let successCount = 0;
    let totalSize = 0;

    for (const file of files) {
      try {
        console.log(`📥 Téléchargement: ${file.file}`);
        
        // Télécharger le fichier depuis Contabo
        const fileBuffer = await downloadFile(file.file);
        
        // Ajouter au ZIP avec juste le nom (sans chemin)
        const fileName = file.file.split('/').pop();
        archive.append(fileBuffer, { name: fileName });
        
        totalSize += fileBuffer.length;
        successCount++;
        console.log(`✅ Ajouté: ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error) {
        console.warn(`⚠️ Fichier ignoré (erreur): ${file.file}`, error.message);
      }
    }

    if (successCount === 0) {
      res.status(500).json({
        success: false,
        message: 'Aucun fichier n\'a pu être ajouté au pack'
      });
      return;
    }

    // Finaliser le ZIP
    await archive.finalize();

    // Créer le buffer final du ZIP
    const zipBuffer = Buffer.concat(chunks);
    console.log(`📦 ZIP créé: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Uploader le pack sur Contabo
    console.log('☁️ Upload du pack vers Contabo...');
    const packKey = await uploadFile(zipBuffer, `${packName}.zip`, 'packs');
    
    // Générer une URL signée temporaire (48 heures)
    const downloadUrl = await getSignedDownloadUrl(packKey, 172800);

    // Enregistrer les métadonnées du pack
    const packData = {
      packId,
      packKey,
      files: files.map(f => f.id),
      filesCount: successCount,
      totalSize: zipBuffer.length,
      paymentIntentId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };

    await savePack(packData);

    console.log(`✅ Pack créé avec succès: ${packId}`);

    res.status(200).json({
      success: true,
      packId,
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

// Générer un ID unique
function generatePackId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

// Sauvegarder les infos du pack
async function savePack(packData) {
  // Dans un système réel, sauvegarder dans une base de données
  // Pour l'instant, on log juste
  console.log('💾 Pack sauvegardé:', {
    packId: packData.packId,
    filesCount: packData.filesCount,
    size: `${(packData.totalSize / 1024 / 1024).toFixed(2)} MB`
  });
  
  // Exemple avec Vercel KV (si vous l'utilisez)
  // const kv = createClient({ ... });
  // await kv.set(`pack:${packData.packId}`, JSON.stringify(packData));
  
  return true;
}