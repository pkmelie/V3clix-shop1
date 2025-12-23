// api/upload-file.js - Upload de fichiers vers Contabo (Admin uniquement)

import { uploadFile, listFiles } from '../lib/contabo-storage.js';
import formidable from 'formidable';

// Désactiver le body parser par défaut pour gérer multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    // Vérifier l'authentification admin
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({
        error: 'Non autorisé',
        message: 'Token admin requis'
      });
      return;
    }

    // Parser le formulaire multipart
    const form = formidable({
      maxFileSize: 500 * 1024 * 1024, // 500 MB max
      keepExtensions: true
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const uploadedFile = files.file[0];
    const category = fields.category?.[0] || 'other';
    
    if (!uploadedFile) {
      res.status(400).json({
        error: 'Aucun fichier',
        message: 'Veuillez sélectionner un fichier'
      });
      return;
    }

    console.log(`📤 Upload de ${uploadedFile.originalFilename} vers ${category}/`);

    // Lire le fichier
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // Uploader vers Contabo
    const fileKey = await uploadFile(
      fileBuffer, 
      uploadedFile.originalFilename,
      category
    );

    // Nettoyer le fichier temporaire
    fs.unlinkSync(uploadedFile.filepath);

    console.log(`✅ Fichier uploadé: ${fileKey}`);

    res.status(200).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      file: {
        key: fileKey,
        name: uploadedFile.originalFilename,
        size: uploadedFile.size,
        category
      }
    });

  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({
      error: 'Erreur upload',
      message: error.message
    });
  }
}