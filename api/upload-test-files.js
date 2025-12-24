// api/upload-test-files.js - Upload de fichiers de test sur Contabo

import { uploadFile } from '../lib/contabo-storage.js';
import archiver from 'archiver';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const results = [];

    // Créer des fichiers ZIP de test
    const testFiles = [
      { name: 'landing-page.zip', folder: 'templates', content: 'Landing Page Template' },
      { name: 'analytics-pro.zip', folder: 'plugins', content: 'Analytics Pro Plugin' },
      { name: 'icons-pack.zip', folder: 'resources', content: 'Icons Pack Resource' },
      { name: 'api-guide.zip', folder: 'docs', content: 'API Documentation' }
    ];

    for (const file of testFiles) {
      try {
        console.log(`📤 Création de ${file.folder}/${file.name}...`);

        // Créer un ZIP simple avec du contenu texte
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks = [];

        archive.on('data', chunk => chunks.push(chunk));
        archive.on('error', err => { throw err; });

        // Ajouter un fichier README.txt dans le ZIP
        archive.append(`${file.content}\n\nCeci est un fichier de test.\nDate: ${new Date().toISOString()}`, {
          name: 'README.txt'
        });

        // Ajouter un fichier index.html de démo
        archive.append(`<!DOCTYPE html>
<html>
<head>
    <title>${file.content}</title>
</head>
<body>
    <h1>${file.content}</h1>
    <p>Fichier de démonstration créé le ${new Date().toLocaleString('fr-FR')}</p>
</body>
</html>`, {
          name: 'index.html'
        });

        await archive.finalize();
        const zipBuffer = Buffer.concat(chunks);

        console.log(`📦 ZIP créé: ${(zipBuffer.length / 1024).toFixed(2)} KB`);

        // Upload sur Contabo
        const filePath = `${file.folder}/${file.name}`;
        const uploadedKey = await uploadFile(zipBuffer, file.name, file.folder);

        results.push({
          success: true,
          file: filePath,
          key: uploadedKey,
          size: `${(zipBuffer.length / 1024).toFixed(2)} KB`
        });

        console.log(`✅ Uploadé: ${uploadedKey}`);

      } catch (error) {
        console.error(`❌ Erreur pour ${file.folder}/${file.name}:`, error);
        results.push({
          success: false,
          file: `${file.folder}/${file.name}`,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.status(200).json({
      success: true,
      message: `${successCount}/${testFiles.length} fichiers uploadés`,
      results
    });

  } catch (error) {
    console.error('❌ Erreur upload test files:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload',
      error: error.message
    });
  }
}