// lib/csv-manager.js - Gestion des fichiers CSV sur Contabo

import { downloadFile, uploadFile, fileExists } from './contabo-storage.js';
import Papa from 'papaparse';

// ============================================
// PRODUCTS - Gestion du catalogue
// ============================================

/**
 * Charger le catalogue depuis products.csv
 */
export async function loadProducts() {
  try {
    const csvBuffer = await downloadFile('data/products.csv');
    const csvString = csvBuffer.toString('utf-8');
    
    const result = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim()
    });

    if (result.errors.length > 0) {
      console.warn('Erreurs parsing CSV:', result.errors);
    }

    // Filtrer les produits actifs
    const products = result.data.filter(p => p.is_active === true || p.is_active === 'true');

    return products;
  } catch (error) {
    console.error('Erreur chargement products.csv:', error);
    throw new Error('Impossible de charger le catalogue');
  }
}

/**
 * Récupérer un produit par ID
 */
export async function getProduct(productId) {
  const products = await loadProducts();
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    throw new Error(`Produit ${productId} introuvable`);
  }
  
  return product;
}

/**
 * Récupérer plusieurs produits par IDs
 */
export async function getProducts(productIds) {
  const allProducts = await loadProducts();
  return allProducts.filter(p => productIds.includes(p.id));
}

/**
 * Sauvegarder le catalogue (admin uniquement)
 */
export async function saveProducts(products) {
  const csv = Papa.unparse(products, {
    header: true,
    columns: ['id', 'name', 'description', 'category', 'file_path', 'file_size', 'price', 'is_active']
  });

  const csvBuffer = Buffer.from(csv, 'utf-8');
  await uploadFile(csvBuffer, 'products.csv', 'data');
  
  console.log('✅ Catalogue sauvegardé');
}

/**
 * Ajouter un nouveau produit
 */
export async function addProduct(newProduct) {
  const products = await loadProducts();
  
  // Générer un ID si nécessaire
  if (!newProduct.id) {
    const prefix = newProduct.category.substring(0, 4);
    const timestamp = Date.now().toString(36);
    newProduct.id = `${prefix}_${timestamp}`;
  }

  products.push(newProduct);
  await saveProducts(products);
  
  return newProduct;
}

// ============================================
// ORDERS - Gestion des commandes
// ============================================

/**
 * Charger les commandes depuis orders.csv
 */
export async function loadOrders() {
  try {
    // Vérifier si le fichier existe
    const exists = await fileExists('data/orders.csv');
    
    if (!exists) {
      console.log('Fichier orders.csv n\'existe pas, création...');
      await initOrdersFile();
      return [];
    }

    const csvBuffer = await downloadFile('data/orders.csv');
    const csvString = csvBuffer.toString('utf-8');
    
    const result = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim()
    });

    // Filtrer les lignes de commentaires
    const orders = result.data.filter(row => row.order_id && !String(row.order_id).startsWith('#'));

    return orders;
  } catch (error) {
    console.error('Erreur chargement orders.csv:', error);
    return [];
  }
}

/**
 * Initialiser le fichier orders.csv
 */
async function initOrdersFile() {
  const headers = [
    'order_id',
    'order_number',
    'customer_email',
    'customer_name',
    'stripe_payment_intent_id',
    'amount',
    'status',
    'pack_id',
    'pack_file_path',
    'download_url',
    'items_count',
    'total_size',
    'created_at',
    'paid_at'
  ];

  const csv = Papa.unparse([headers], { header: false });
  const csvBuffer = Buffer.from(csv, 'utf-8');
  
  await uploadFile(csvBuffer, 'orders.csv', 'data');
  console.log('✅ Fichier orders.csv initialisé');
}

/**
 * Sauvegarder les commandes
 */
export async function saveOrders(orders) {
  const csv = Papa.unparse(orders, {
    header: true
  });

  const csvBuffer = Buffer.from(csv, 'utf-8');
  await uploadFile(csvBuffer, 'orders.csv', 'data');
  
  console.log('✅ Commandes sauvegardées');
}

/**
 * Créer une nouvelle commande
 */
export async function createOrder(orderData) {
  const orders = await loadOrders();
  
  // Générer un order_id
  const orderId = orders.length > 0 
    ? Math.max(...orders.map(o => parseInt(o.order_id) || 0)) + 1 
    : 1;

  // Générer un order_number
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderNumber = `ORD-${dateStr}-${random}`;

  const newOrder = {
    order_id: orderId,
    order_number: orderNumber,
    created_at: date.toISOString(),
    status: 'pending',
    ...orderData
  };

  orders.push(newOrder);
  await saveOrders(orders);

  console.log(`✅ Commande créée: ${orderNumber}`);
  return newOrder;
}

/**
 * Mettre à jour une commande
 */
export async function updateOrder(orderNumber, updates) {
  const orders = await loadOrders();
  const index = orders.findIndex(o => o.order_number === orderNumber);

  if (index === -1) {
    throw new Error(`Commande ${orderNumber} introuvable`);
  }

  orders[index] = {
    ...orders[index],
    ...updates
  };

  await saveOrders(orders);
  console.log(`✅ Commande ${orderNumber} mise à jour`);
  
  return orders[index];
}

/**
 * Récupérer une commande par Payment Intent ID
 */
export async function getOrderByPaymentIntent(paymentIntentId) {
  const orders = await loadOrders();
  const order = orders.find(o => o.stripe_payment_intent_id === paymentIntentId);
  
  if (!order) {
    throw new Error(`Commande avec PaymentIntent ${paymentIntentId} introuvable`);
  }
  
  return order;
}

/**
 * Récupérer une commande par pack_id
 */
export async function getOrderByPackId(packId) {
  const orders = await loadOrders();
  const order = orders.find(o => o.pack_id === packId);
  
  return order;
}

// ============================================
// CUSTOMERS - Statistiques clients simples
// ============================================

/**
 * Récupérer les stats d'un client par email
 */
export async function getCustomerStats(email) {
  const orders = await loadOrders();
  const customerOrders = orders.filter(o => o.customer_email === email);

  const totalSpent = customerOrders
    .filter(o => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + (parseInt(o.amount) || 0), 0);

  return {
    email,
    ordersCount: customerOrders.length,
    totalSpent,
    firstOrder: customerOrders[0]?.created_at,
    lastOrder: customerOrders[customerOrders.length - 1]?.created_at
  };
}

// ============================================
// STATS - Statistiques globales
// ============================================

/**
 * Récupérer les statistiques du dashboard
 */
export async function getDashboardStats() {
  const products = await loadProducts();
  const orders = await loadOrders();

  const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'completed');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (parseInt(o.amount) || 0), 0);

  // Clients uniques
  const uniqueCustomers = new Set(paidOrders.map(o => o.customer_email));

  // Commandes aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.created_at?.startsWith(today));

  return {
    productsCount: products.length,
    ordersCount: paidOrders.length,
    totalRevenue: totalRevenue / 100, // Convertir en euros
    customersCount: uniqueCustomers.size,
    todayOrders: todayOrders.length
  };
}

/**
 * Récupérer les commandes récentes
 */
export async function getRecentOrders(limit = 10) {
  const orders = await loadOrders();
  
  // Trier par date décroissante
  const sorted = orders.sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return sorted.slice(0, limit);
}

/**
 * Récupérer les produits les plus vendus
 */
export async function getTopProducts(limit = 10) {
  const orders = await loadOrders();
  const products = await loadProducts();

  // Compter les ventes par produit (approximatif - on compte les items)
  const productCounts = {};

  orders.forEach(order => {
    // Si on a stocké les items_ids dans le CSV (recommandé)
    if (order.items_ids) {
      const items = order.items_ids.split(',');
      items.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });
    }
  });

  // Créer le classement
  const topProducts = Object.entries(productCounts)
    .map(([id, count]) => {
      const product = products.find(p => p.id === id);
      return {
        ...product,
        salesCount: count,
        revenue: count * (product?.price || 0)
      };
    })
    .filter(p => p.id)
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, limit);

  return topProducts;
}