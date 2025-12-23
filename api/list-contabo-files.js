// api/list-contabo-files.js - Lister les fichiers sur Contabo

import { listFiles, getFolderSize } from '../lib/contabo-storage.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  try {
    const { category } = req.query;

    // Lister par catégorie ou tout
    const categories = category ? [category] : ['templates', 'plugins', 'resources', 'docs'];
    
    const filesByCategory = {};

    for (const cat of categories) {
      try {
        const files = await listFiles(`${cat}/`);
        
        filesByCategory[cat] = files.map(file => ({
          id: file.key.replace(/[^a-zA-Z0-9]/g, '_'),
          name: file.key.split('/').pop(),
          file: file.key,
          size: Math.ceil(file.size / 1024 / 1024), // Convertir en MB
          lastModified: file.lastModified,
          category: cat
        }));

        console.log(`✅ ${cat}: ${filesByCategory[cat].length} fichiers`);
      } catch (error) {
        console.warn(`⚠️ Erreur pour ${cat}:`, error.message);
        filesByCategory[cat] = [];
      }
    }

    // Calculer les stats totales
    const totalFiles = Object.values(filesByCategory).reduce(
      (sum, files) => sum + files.length, 
      0
    );

    res.status(200).json({
      success: true,
      files: filesByCategory,
      stats: {
        totalFiles,
        categories: Object.keys(filesByCategory).length
      }
    });

  } catch (error) {
    console.error('❌ Erreur liste fichiers:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}