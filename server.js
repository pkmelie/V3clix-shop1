// server.js - API Backend pour Contabo
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration
const CONFIG = {
  PORT: process.env.PORT || 3001,
  STORAGE_PATH: '/var/www/storage', // Chemin de stockage sur Contabo
  PACKS_PATH: '/var/www/packs', // Packs générés
  DOMAIN: 'https://api.v3clix-shop.com',
  PACK_EXPIRY_DAYS: 7,
  FRONTEND_URL: 'https://v3clix-shop.com'
};

app.use(cors({
  origin: CONFIG.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Base de données en mémoire (à remplacer par PostgreSQL)
const packs = new Map();
const purchases = new Map();

// Middleware de vérification d'achat
const verifyPurchase = (req, res, next) => {
  const { purchaseId } = req.params;
  const purchase = purchases.get(purchaseId);
  
  if (!purchase) {
    return res.status(404).json({ error: 'Achat non trouvé' });
  }
  
  req.purchase = purchase;
  next();
};

// 1. Récupérer la structure des fichiers disponibles
app.get('/api/categories', async (req, res) => {
  try {
    const categories = [];
    const dirs = await fs.readdir(CONFIG.STORAGE_PATH);
    
    for (const dir of dirs) {
      const dirPath = path.join(CONFIG.STORAGE_PATH, dir);
      const stat = await fs.stat(dirPath);
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(dirPath);
        const fileDetails = await Promise.all(
          files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const fileStat = await fs.stat(filePath);
            return {
              id: crypto.createHash('md5').update(filePath).digest('hex'),
              name: file,
              size: `${(fileStat.size / (1024 * 1024)).toFixed(2)} MB`,
              path: filePath
            };
          })
        );
        
        categories.push({
          id: crypto.createHash('md5').update(dir).digest('hex'),
          name: dir,
          description: `Catégorie ${dir}`,
          files: fileDetails
        });
      }
    }
    
    res.json({ categories });
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 2. Créer une commande (après paiement)
app.post('/api/create-order', async (req, res) => {
  try {
    const { email, selections, paymentIntentId } = req.body;
    
    // Vérifier le paiement (Stripe, PayPal, etc.)
    // TODO: Implémenter vérification paiement
    
    const purchaseId = crypto.randomBytes(16).toString('hex');
    const purchase = {
      id: purchaseId,
      email,
      selections,
      createdAt: Date.now(),
      status: 'pending'
    };
    
    purchases.set(purchaseId, purchase);
    
    res.json({ 
      purchaseId,
      message: 'Commande créée avec succès'
    });
  } catch (error) {
    console.error('Erreur création commande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 3. Générer le pack (appelé après paiement validé)
app.post('/api/generate-pack/:purchaseId', verifyPurchase, async (req, res) => {
  try {
    const { purchase } = req;
    
    // Créer un token unique pour le téléchargement
    const downloadToken = crypto.randomBytes(32).toString('hex');
    const packId = crypto.randomBytes(16).toString('hex');
    const packName = `pack_${packId}.zip`;
    const packPath = path.join(CONFIG.PACKS_PATH, packName);
    
    // Générer le pack en arrière-plan
    generatePackAsync(purchase, packPath, downloadToken);
    
    res.json({ 
      packId,
      message: 'Génération du pack en cours',
      status: 'processing'
    });
  } catch (error) {
    console.error('Erreur génération pack:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonction de génération asynchrone
async function generatePackAsync(purchase, packPath, downloadToken) {
  try {
    // Créer le dossier packs s'il n'existe pas
    await fs.mkdir(CONFIG.PACKS_PATH, { recursive: true });
    
    const output = fsSync.createWriteStream(packPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', async () => {
      console.log(`Pack créé: ${archive.pointer()} bytes`);
      
      // Sauvegarder les infos du pack
      const expiryDate = Date.now() + (CONFIG.PACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const pack = {
        id: path.basename(packPath, '.zip').replace('pack_', ''),
        purchaseId: purchase.id,
        path: packPath,
        token: downloadToken,
        createdAt: Date.now(),
        expiryDate,
        downloaded: false
      };
      
      packs.set(downloadToken, pack);
      
      // Envoyer l'email avec Resend
      const downloadUrl = `${CONFIG.DOMAIN}/api/download/${downloadToken}`;
      await sendPackEmail(purchase.email, downloadUrl, pack.id);
      
      // Mettre à jour le statut
      purchase.status = 'completed';
      purchase.packId = pack.id;
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    
    // Ajouter les fichiers sélectionnés
    for (const [categoryId, fileIds] of Object.entries(purchase.selections)) {
      for (const fileId of fileIds) {
        // Récupérer le chemin du fichier depuis la catégorie
        // TODO: Mapper les IDs aux chemins réels
        const filePath = getFilePathFromId(fileId);
        if (filePath && fsSync.existsSync(filePath)) {
          const fileName = path.basename(filePath);
          archive.file(filePath, { name: fileName });
        }
      }
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('Erreur génération pack async:', error);
    purchase.status = 'failed';
  }
}

// Fonction helper pour récupérer le chemin depuis l'ID
function getFilePathFromId(fileId) {
  // TODO: Implémenter mapping ID -> chemin
  // Pour l'instant, retourne un chemin d'exemple
  return path.join(CONFIG.STORAGE_PATH, 'exemple', 'fichier.zip');
}

// Envoyer l'email avec Resend
async function sendPackEmail(email, downloadUrl, packId) {
  try {
    await resend.emails.send({
      from: 'V3clix Shop <noreply@v3clix-shop.com>',
      to: email,
      subject: '🎉 Votre pack personnalisé est prêt !',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
              .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Votre Pack est Prêt !</h1>
              </div>
              <div class="content">
                <p>Bonjour,</p>
                <p>Votre pack personnalisé <strong>#${packId}</strong> a été généré avec succès !</p>
                
                <div style="text-align: center;">
                  <a href="${downloadUrl}" class="button">📥 Télécharger mon pack</a>
                </div>
                
                <div class="info-box">
                  <strong>⏱️ Informations importantes :</strong>
                  <ul>
                    <li>Ce lien est valide pendant <strong>7 jours</strong></li>
                    <li>Le téléchargement est sécurisé et réservé à vous seul</li>
                    <li>Taille estimée : 4-5 GB</li>
                  </ul>
                </div>
                
                <p>Si vous rencontrez un problème, contactez notre support à support@v3clix-shop.com</p>
                
                <p>Merci de votre confiance ! 🚀</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} V3clix Shop - Tous droits réservés</p>
                <p>Ce lien expire le ${new Date(Date.now() + CONFIG.PACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </body>
        </html>
      `
    });
    console.log(`Email envoyé à ${email}`);
  } catch (error) {
    console.error('Erreur envoi email:', error);
  }
}

// 4. Télécharger le pack (lien sécurisé)
app.get('/api/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const pack = packs.get(token);
    
    if (!pack) {
      return res.status(404).json({ error: 'Pack non trouvé ou expiré' });
    }
    
    // Vérifier l'expiration
    if (Date.now() > pack.expiryDate) {
      packs.delete(token);
      await fs.unlink(pack.path).catch(() => {});
      return res.status(410).json({ error: 'Le lien a expiré' });
    }
    
    // Envoyer le fichier
    res.download(pack.path, `pack_${pack.id}.zip`, async (err) => {
      if (err) {
        console.error('Erreur téléchargement:', err);
      } else {
        // Marquer comme téléchargé
        pack.downloaded = true;
        pack.downloadedAt = Date.now();
      }
    });
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 5. Vérifier le statut d'un pack
app.get('/api/pack-status/:purchaseId', verifyPurchase, (req, res) => {
  const { purchase } = req;
  res.json({
    status: purchase.status,
    packId: purchase.packId || null
  });
});

// Nettoyage automatique des packs expirés (toutes les heures)
setInterval(async () => {
  console.log('Nettoyage des packs expirés...');
  const now = Date.now();
  
  for (const [token, pack] of packs.entries()) {
    if (now > pack.expiryDate) {
      try {
        await fs.unlink(pack.path);
        packs.delete(token);
        console.log(`Pack ${pack.id} supprimé (expiré)`);
      } catch (error) {
        console.error(`Erreur suppression pack ${pack.id}:`, error);
      }
    }
  }
}, 60 * 60 * 1000);

// Démarrage du serveur
app.listen(CONFIG.PORT, () => {
  console.log(`🚀 API démarrée sur le port ${CONFIG.PORT}`);
  console.log(`📁 Stockage: ${CONFIG.STORAGE_PATH}`);
  console.log(`📦 Packs: ${CONFIG.PACKS_PATH}`);
});

module.exports = app;