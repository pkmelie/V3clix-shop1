// api/products.js - API pour récupérer le catalogue depuis CSV

import { loadProducts } from '../lib/csv-manager.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    console.log(`📚 Chargement du catalogue depuis CSV${category ? ` - catégorie: ${category}` : ''}`);

    // Charger les produits depuis le CSV
    let products = await loadProducts();

    // Filtrer par catégorie si spécifié
    if (category) {
      products = products.filter(p => p.category === category);
    }

    // Organiser par catégorie
    const catalog = {
      templates: [],
      plugins: [],
      resources: [],
      docs: []
    };

    products.forEach(product => {
      const item = {
        id: product.id,
        name: product.name,
        description: product.description,
        file: product.file_path,
        size: Math.ceil(product.file_size / 1024 / 1024), // Convertir en MB
        price: product.price / 100, // Convertir en euros
        category: product.category
      };

      if (catalog[product.category]) {
        catalog[product.category].push(item);
      }
    });

    console.log(`✅ ${products.length} produits chargés depuis CSV`);

    res.status(200).json({
      success: true,
      catalog,
      stats: {
        total: products.length,
        templates: catalog.templates.length,
        plugins: catalog.plugins.length,
        resources: catalog.resources.length,
        docs: catalog.docs.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération catalogue:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      message: error.message
    });
  }
}