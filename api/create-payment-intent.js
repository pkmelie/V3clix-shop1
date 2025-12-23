// api/create-payment-intent.js - Créer un PaymentIntent Stripe

// Installer Stripe : npm install stripe
// Ou utiliser l'import direct pour Vercel
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
console.log('Stripe key starts with:', process.env.STRIPE_SECRET_KEY?.slice(0, 8));


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
    const { amount, email, name, items } = req.body;

    // Validation
    if (!amount || !email || !items || items.length === 0) {
      res.status(400).json({
        error: 'Données manquantes',
        message: 'Montant, email et items requis'
      });
      return;
    }

    // Vérifier que le montant est cohérent
    const expectedAmount = items.length * 500; // 5€ par item = 500 centimes
    if (amount !== expectedAmount) {
      res.status(400).json({
        error: 'Montant invalide',
        message: 'Le montant ne correspond pas aux items sélectionnés'
      });
      return;
    }

    // Créer le PaymentIntent avec Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // en centimes
      currency: 'eur',
      receipt_email: email,
      description: `Pack V3Clix - ${items.length} fichier(s)`,
      metadata: {
        customer_name: name,
        customer_email: email,
        items_count: items.length,
        items: JSON.stringify(items)
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Retourner le client secret
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Erreur Stripe:', error);
    res.status(500).json({
      error: 'Erreur de paiement',
      message: error.message
    });
  }
}