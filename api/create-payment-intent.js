// api/create-payment-intent.js - Créer un PaymentIntent avec CSV

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
import { getProducts, createOrder } from '../lib/csv-manager.js';

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
    const { email, name, productIds } = req.body;

    // Validation
    if (!email || !productIds || productIds.length === 0) {
      res.status(400).json({
        error: 'Données manquantes',
        message: 'Email et produits requis'
      });
      return;
    }

    console.log(`💳 Création paiement pour ${email} avec ${productIds.length} produits`);

    // 1. Récupérer les produits depuis le CSV
    const products = await getProducts(productIds);

    if (products.length === 0) {
      res.status(400).json({
        error: 'Aucun produit valide',
        message: 'Les produits sélectionnés sont introuvables'
      });
      return;
    }

    // Calculer le montant total
    const totalAmount = products.reduce((sum, p) => sum + parseInt(p.price), 0);

    console.log(`💰 Montant total: ${totalAmount / 100}€ pour ${products.length} produits`);

    // 2. Créer un client Stripe
    const stripeCustomer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'v3clix-shop'
      }
    });

    // 3. Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      customer: stripeCustomer.id,
      receipt_email: email,
      description: `Pack V3Clix - ${products.length} fichier(s)`,
      metadata: {
        customer_email: email,
        items_count: products.length,
        items_ids: productIds.join(',')
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`✅ PaymentIntent créé: ${paymentIntent.id}`);

    // 4. Créer la commande dans le CSV
    const order = await createOrder({
      customer_email: email,
      customer_name: name,
      stripe_payment_intent_id: paymentIntent.id,
      amount: totalAmount,
      status: 'pending',
      items_count: products.length,
      items_ids: productIds.join(','), // Sauvegarder les IDs des produits
      items_names: products.map(p => p.name).join(' | ') // Optionnel : pour référence
    });

    console.log(`📝 Commande créée: ${order.order_number}`);

    // 5. Retourner le client secret
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderNumber: order.order_number
    });

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.status(500).json({
      error: 'Erreur de paiement',
      message: error.message
    });
  }
}