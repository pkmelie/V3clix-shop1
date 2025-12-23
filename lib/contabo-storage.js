// lib/contabo-storage.js - Gestion du stockage Contabo Object Storage (S3-compatible)

import AWS from 'aws-sdk';

// Configuration du client S3 pour Contabo
const s3 = new AWS.S3({
  endpoint: process.env.CONTABO_ENDPOINT, // Ex: https://eu2.contabostorage.com
  accessKeyId: process.env.CONTABO_ACCESS_KEY,
  secretAccessKey: process.env.CONTABO_SECRET_KEY,
  s3ForcePathStyle: true, // Obligatoire pour Contabo
  signatureVersion: 'v4',
  region: process.env.CONTABO_REGION || 'eu-central-1'
});

const BUCKET_NAME = process.env.CONTABO_BUCKET_NAME;

/**
 * Uploader un fichier vers Contabo
 * @param {Buffer} fileBuffer - Contenu du fichier
 * @param {string} fileName - Nom du fichier
 * @param {string} folder - Dossier (ex: 'templates', 'plugins')
 * @returns {Promise<string>} URL du fichier uploadé
 */
export async function uploadFile(fileBuffer, fileName, folder = '') {
  const key = folder ? `${folder}/${fileName}` : fileName;
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: getContentType(fileName),
    ACL: 'private' // Fichiers privés
  };

  try {
    const result = await s3.upload(params).promise();
    console.log('✅ Fichier uploadé:', result.Key);
    return result.Key;
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    throw new Error(`Erreur upload vers Contabo: ${error.message}`);
  }
}

/**
 * Télécharger un fichier depuis Contabo
 * @param {string} key - Chemin du fichier (ex: 'templates/file.zip')
 * @returns {Promise<Buffer>} Contenu du fichier
 */
export async function downloadFile(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };

  try {
    const result = await s3.getObject(params).promise();
    return result.Body;
  } catch (error) {
    console.error('❌ Erreur download:', error);
    throw new Error(`Fichier introuvable: ${key}`);
  }
}

/**
 * Vérifier si un fichier existe
 * @param {string} key - Chemin du fichier
 * @returns {Promise<boolean>}
 */
export async function fileExists(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };

  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Lister les fichiers d'un dossier
 * @param {string} prefix - Préfixe (dossier)
 * @returns {Promise<Array>} Liste des fichiers
 */
export async function listFiles(prefix = '') {
  const params = {
    Bucket: BUCKET_NAME,
    Prefix: prefix
  };

  try {
    const result = await s3.listObjectsV2(params).promise();
    return result.Contents.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified
    }));
  } catch (error) {
    console.error('❌ Erreur list:', error);
    throw new Error(`Erreur liste fichiers: ${error.message}`);
  }
}

/**
 * Supprimer un fichier
 * @param {string} key - Chemin du fichier
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
    console.log('✅ Fichier supprimé:', key);
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    throw new Error(`Erreur suppression: ${error.message}`);
  }
}

/**
 * Générer une URL signée temporaire (pour téléchargement)
 * @param {string} key - Chemin du fichier
 * @param {number} expiresIn - Durée de validité en secondes (défaut: 48h)
 * @returns {Promise<string>} URL signée
 */
export async function getSignedDownloadUrl(key, expiresIn = 172800) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn // 172800 = 48 heures
  };

  try {
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('❌ Erreur URL signée:', error);
    throw new Error(`Erreur génération URL: ${error.message}`);
  }
}

/**
 * Créer un pack ZIP de plusieurs fichiers
 * @param {Array} fileKeys - Liste des chemins de fichiers
 * @param {string} packName - Nom du pack
 * @returns {Promise<string>} Chemin du pack créé
 */
export async function createZipPack(fileKeys, packName) {
  // Note: Pour créer un ZIP, vous aurez besoin de la bibliothèque 'archiver'
  // Cette fonction sera implémentée dans api/create-pack.js
  const archiver = require('archiver');
  const { Readable } = require('stream');
  
  // Créer un stream pour le ZIP
  const archive = archiver('zip', {
    zlib: { level: 9 } // Compression maximale
  });

  const chunks = [];
  
  // Capturer les données du ZIP
  archive.on('data', chunk => chunks.push(chunk));
  
  // Télécharger chaque fichier et l'ajouter au ZIP
  for (const fileKey of fileKeys) {
    try {
      const fileBuffer = await downloadFile(fileKey);
      const fileName = fileKey.split('/').pop(); // Extraire juste le nom
      archive.append(fileBuffer, { name: fileName });
    } catch (error) {
      console.warn(`⚠️ Fichier ignoré (introuvable): ${fileKey}`);
    }
  }

  // Finaliser le ZIP
  await archive.finalize();

  // Créer le buffer final
  const zipBuffer = Buffer.concat(chunks);

  // Uploader le pack sur Contabo
  const packKey = `packs/${packName}.zip`;
  await uploadFile(zipBuffer, `${packName}.zip`, 'packs');

  return packKey;
}

/**
 * Obtenir le type de contenu selon l'extension
 */
function getContentType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    'zip': 'application/zip',
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg'
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Calculer la taille totale d'un dossier
 * @param {string} prefix - Préfixe (dossier)
 * @returns {Promise<number>} Taille en bytes
 */
export async function getFolderSize(prefix) {
  const files = await listFiles(prefix);
  return files.reduce((total, file) => total + file.size, 0);
}