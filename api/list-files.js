// api/list-files.js - Liste tous les fichiers sur Contabo

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const s3Client = new S3Client({
      endpoint: process.env.CONTABO_ENDPOINT,
      region: process.env.CONTABO_REGION || 'EU',
      credentials: {
        accessKeyId: process.env.CONTABO_ACCESS_KEY,
        secretAccessKey: process.env.CONTABO_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    console.log('📂 Listing files from:', process.env.CONTABO_BUCKET);

    // Lister tous les fichiers
    const command = new ListObjectsV2Command({
      Bucket: process.env.CONTABO_BUCKET,
      MaxKeys: 1000
    });

    const response = await s3Client.send(command);

    const files = (response.Contents || []).map(file => ({
      key: file.Key,
      size: `${(file.Size / 1024).toFixed(2)} KB`,
      lastModified: file.LastModified,
      folder: file.Key.split('/')[0] || 'root'
    }));

    // Grouper par dossier
    const byFolder = files.reduce((acc, file) => {
      const folder = file.folder;
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(file);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      totalFiles: files.length,
      files,
      byFolder,
      bucket: process.env.CONTABO_BUCKET,
      endpoint: process.env.CONTABO_ENDPOINT
    });

  } catch (error) {
    console.error('❌ Erreur list files:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
}