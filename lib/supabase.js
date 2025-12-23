// lib/supabase.js - Client Supabase pour V3Clix Shop

import { createClient } from '@supabase/supabase-js';

// Créer le client Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Variables Supabase manquantes');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================
// PRODUCTS - Gestion du catalogue
// ============================================

/**
 * Récupérer tous les produits actifs
 */
export async function getProducts(category = null) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Erreur récupération produits: ${error.message}`);
  return data;
}

/**
 * Récupérer un produit par ID
 */
export async function getProduct(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Produit introuvable: ${error.message}`);
  return data;
}

/**
 * Créer un nouveau produit
 */
export async function createProduct(productData) {
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single();

  if (error) throw new Error(`Erreur création produit: ${error.message}`);
  return data;
}

/**
 * Mettre à jour un produit
 */
export async function updateProduct(id, updates) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erreur mise à jour produit: ${error.message}`);
  return data;
}

/**
 * Supprimer un produit (soft delete)
 */
export async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw new Error(`Erreur suppression produit: ${error.message}`);
}

/**
 * Incrémenter le compteur de téléchargement
 */
export async function incrementDownloadCount(productId) {
  const { error } = await supabase.rpc('increment_download_count', {
    product_id: productId
  });

  if (error) console.error('Erreur incrémentation:', error);
}

// ============================================
// CUSTOMERS - Gestion des clients
// ============================================

/**
 * Créer ou récupérer un client par email
 */
export async function getOrCreateCustomer(email, name = null, stripeCustomerId = null) {
  // Chercher le client existant
  let { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single();

  // Si le client n'existe pas, le créer
  if (error && error.code === 'PGRST116') {
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert([{
        email,
        name,
        stripe_customer_id: stripeCustomerId
      }])
      .select()
      .single();

    if (createError) throw new Error(`Erreur création client: ${createError.message}`);
    return newCustomer;
  }

  if (error) throw new Error(`Erreur récupération client: ${error.message}`);
  return customer;
}

/**
 * Mettre à jour les stats d'un client
 */
export async function updateCustomerStats(customerId, amount) {
  const { error } = await supabase
    .from('customers')
    .update({
      total_spent: supabase.raw(`total_spent + ${amount}`),
      orders_count: supabase.raw('orders_count + 1')
    })
    .eq('id', customerId);

  if (error) console.error('Erreur mise à jour stats client:', error);
}

// ============================================
// ORDERS - Gestion des commandes
// ============================================

/**
 * Créer une nouvelle commande
 */
export async function createOrder(orderData) {
  // Générer un numéro de commande
  const { data: orderNumber } = await supabase.rpc('generate_order_number');

  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...orderData,
      order_number: orderNumber
    }])
    .select()
    .single();

  if (error) throw new Error(`Erreur création commande: ${error.message}`);
  return data;
}

/**
 * Mettre à jour une commande
 */
export async function updateOrder(orderId, updates) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error(`Erreur mise à jour commande: ${error.message}`);
  return data;
}

/**
 * Récupérer une commande par Stripe Payment Intent
 */
export async function getOrderByPaymentIntent(paymentIntentId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (error) throw new Error(`Commande introuvable: ${error.message}`);
  return data;
}

/**
 * Ajouter des items à une commande
 */
export async function addOrderItems(orderId, items) {
  const orderItems = items.map(item => ({
    order_id: orderId,
    product_id: item.id,
    product_name: item.name,
    product_category: item.category,
    file_path: item.file_path,
    file_size: item.file_size,
    price: item.price
  }));

  const { data, error } = await supabase
    .from('order_items')
    .insert(orderItems)
    .select();

  if (error) throw new Error(`Erreur ajout items: ${error.message}`);
  return data;
}

// ============================================
// PACKS - Gestion des packs générés
// ============================================

/**
 * Créer un pack
 */
export async function createPack(packData) {
  // Générer un pack_id
  const { data: packId } = await supabase.rpc('generate_pack_id');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48); // Expire dans 48h

  const { data, error } = await supabase
    .from('packs')
    .insert([{
      pack_id: packId,
      ...packData,
      expires_at: expiresAt.toISOString()
    }])
    .select()
    .single();

  if (error) throw new Error(`Erreur création pack: ${error.message}`);
  return data;
}

/**
 * Récupérer un pack par pack_id
 */
export async function getPack(packId) {
  const { data, error } = await supabase
    .from('packs')
    .select('*, orders(*)')
    .eq('pack_id', packId)
    .eq('status', 'active')
    .single();

  if (error) return null;

  // Vérifier expiration
  if (new Date(data.expires_at) < new Date()) {
    await supabase
      .from('packs')
      .update({ status: 'expired' })
      .eq('id', data.id);
    return null;
  }

  return data;
}

/**
 * Incrémenter le compteur de téléchargement du pack
 */
export async function incrementPackDownload(packId) {
  const { error } = await supabase
    .from('packs')
    .update({
      download_count: supabase.raw('download_count + 1'),
      last_downloaded_at: new Date().toISOString()
    })
    .eq('pack_id', packId);

  if (error) console.error('Erreur incrémentation pack:', error);
}

// ============================================
// LOGS - Historique et analytics
// ============================================

/**
 * Logger un téléchargement
 */
export async function logDownload(packId, orderId, ipAddress, userAgent) {
  await supabase
    .from('download_logs')
    .insert([{
      pack_id: packId,
      order_id: orderId,
      ip_address: ipAddress,
      user_agent: userAgent
    }]);
}

/**
 * Logger une action admin
 */
export async function logAdminAction(action, details, adminEmail, ipAddress) {
  await supabase
    .from('admin_logs')
    .insert([{
      action,
      details,
      admin_email: adminEmail,
      ip_address: ipAddress
    }]);
}

// ============================================
// STATS - Statistiques et analytics
// ============================================

/**
 * Récupérer les statistiques du dashboard
 */
export async function getDashboardStats() {
  // Total produits
  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Total commandes payées
  const { count: ordersCount, data: orders } = await supabase
    .from('orders')
    .select('amount', { count: 'exact' })
    .eq('status', 'paid');

  // Revenu total
  const totalRevenue = orders?.reduce((sum, o) => sum + o.amount, 0) || 0;

  // Clients
  const { count: customersCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  // Téléchargements aujourd'hui
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: todayDownloads } = await supabase
    .from('download_logs')
    .select('*', { count: 'exact', head: true })
    .gte('downloaded_at', today.toISOString());

  return {
    productsCount: productsCount || 0,
    ordersCount: ordersCount || 0,
    totalRevenue: totalRevenue / 100, // Convertir en euros
    customersCount: customersCount || 0,
    todayDownloads: todayDownloads || 0
  };
}

/**
 * Récupérer les commandes récentes
 */
export async function getRecentOrders(limit = 10) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(email, name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erreur récupération commandes: ${error.message}`);
  return data;
}

/**
 * Récupérer les produits les plus vendus
 */
export async function getTopProducts(limit = 10) {
  const { data, error } = await supabase
    .from('product_stats')
    .select('*')
    .order('order_count', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erreur récupération top produits: ${error.message}`);
  return data;
}