// BotCreator.jsx - Composant React avec intégration API complète
import React, { useState, useEffect } from 'react';
import { Package, Check, Loader2, Download, Mail, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.v3clix-shop.com';

export default function BotCreator() {
  const [categories, setCategories] = useState([]);
  const [selections, setSelections] = useState({});
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [step, setStep] = useState('select'); // select, payment, processing, complete, error
  const [purchaseId, setPurchaseId] = useState(null);
  const [packUrl, setPackUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Charger les catégories depuis l'API
  useEffect(() => {
    loadCategories();
  }, []);

  // Polling pour vérifier le statut de génération
  useEffect(() => {
    if (step === 'processing' && purchaseId) {
      const interval = setInterval(() => {
        checkOrderStatus(purchaseId);
      }, 3000); // Vérifier toutes les 3 secondes

      return () => clearInterval(interval);
    }
  }, [step, purchaseId]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      
      if (response.ok) {
        setCategories(data.categories);
      } else {
        throw new Error('Erreur lors du chargement des catégories');
      }
    } catch (err) {
      console.error('Erreur chargement catégories:', err);
      setError('Impossible de charger les catégories. Veuillez réessayer.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const checkOrderStatus = async (orderId) => {
    try {
      const response = await fetch(`${API_URL}/api/order-status/${orderId}`);
      const data = await response.json();
      
      if (response.ok) {
        setProgress(data.progress);
        
        if (data.status === 'completed') {
          setStep('complete');
          setPackUrl(`${API_URL}/api/download/${data.packId}`);
        } else if (data.status === 'failed') {
          setStep('error');
          setError('La génération du pack a échoué. Contactez le support.');
        }
      }
    } catch (err) {
      console.error('Erreur vérification statut:', err);
    }
  };

  const toggleFile = (categoryId, fileId) => {
    setSelections(prev => {
      const categorySelections = prev[categoryId] || [];
      const isSelected = categorySelections.includes(fileId);
      
      return {
        ...prev,
        [categoryId]: isSelected
          ? categorySelections.filter(id => id !== fileId)
          : [...categorySelections, fileId]
      };
    });
  };

  const getTotalSize = () => {
    let totalBytes = 0;
    categories.forEach(cat => {
      const selected = selections[cat.id] || [];
      selected.forEach(fileId => {
        const file = cat.files.find(f => f.id === fileId);
        if (file && file.sizeBytes) {
          totalBytes += file.sizeBytes;
        }
      });
    });
    
    const gb = totalBytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
  };

  const getSelectedCount = () => {
    return Object.values(selections).reduce((acc, arr) => acc + arr.length, 0);
  };

  const handleSubmit = async () => {
    if (!email || getSelectedCount() === 0) {
      setError('Veuillez sélectionner au moins un fichier et entrer votre email');
      return;
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Créer la commande (après paiement en production)
      const response = await fetch(`${API_URL}/api/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          selections,
          // paymentIntentId: 'pi_test_123', // À remplacer par le vrai ID Stripe
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la commande');
      }

      setPurchaseId(data.purchaseId);
      setStep('processing');
      setProgress(10);
    } catch (err) {
      console.error('Erreur soumission:', err);
      setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('select');
    setSelections({});
    setEmail('');
    setProgress(0);
    setError(null);
    setPurchaseId(null);
    setPackUrl('');
  };

  if (loadingCategories) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-xl">Chargement des catégories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <Package className="w-10 h-10 md:w-12 md:h-12 text-purple-400" />
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Créez Votre Pack Bot
            </h1>
          </div>
          <p className="text-gray-300 text-base md:text-lg px-4">
            Sélectionnez les éléments que vous souhaitez inclure dans votre pack personnalisé
          </p>
        </div>

        {/* Message d'erreur global */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-sm text-red-300 hover:text-red-100 mt-1 underline"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <>
            {/* Catégories et fichiers */}
            <div className="space-y-6 md:space-y-8 mb-8">
              {categories.map(category => (
                <div key={category.id} className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 md:p-6 border border-purple-500/20">
                  <div className="mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-purple-300 mb-2">{category.name}</h2>
                    <p className="text-gray-400 text-sm md:text-base">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {category.files.map(file => {
                      const isSelected = (selections[category.id] || []).includes(file.id);
                      return (
                        <button
                          key={file.id}
                          onClick={() => toggleFile(category.id, file.id)}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500/20 scale-105'
                              : 'border-slate-700 bg-slate-800/30 hover:border-purple-500/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-semibold text-white text-sm md:text-base">{file.name}</span>
                            {isSelected && (
                              <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-xs md:text-sm text-gray-400">{file.size}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Résumé et Email */}
            <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-6 md:p-8 border border-purple-500/30">
              <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-6">
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-4 text-purple-300">Votre Sélection</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fichiers sélectionnés:</span>
                      <span className="font-bold text-purple-400">{getSelectedCount()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Taille totale:</span>
                      <span className="font-bold text-purple-400">{getTotalSize()} GB</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-purple-300">
                    Email de livraison *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-gray-500"
                    required
                  />
                  <p className="text-xs md:text-sm text-gray-400 mt-2">
                    Le lien de téléchargement sera envoyé à cette adresse
                  </p>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={getSelectedCount() === 0 || !email || loading}
                className="w-full py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-base md:text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Procéder au paiement'
                )}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-8 md:p-12 border border-purple-500/30 text-center">
            <Loader2 className="w-12 h-12 md:w-16 md:h-16 text-purple-400 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Génération de votre pack...</h2>
            <p className="text-gray-400 mb-8">
              Nous assemblons vos fichiers sélectionnés. Cela peut prendre quelques minutes.
            </p>
            
            <div className="max-w-md mx-auto">
              <div className="h-3 md:h-4 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-purple-400 font-bold mt-4 text-lg md:text-xl">{progress}%</p>
            </div>

            <p className="text-sm text-gray-500 mt-6">
              Ne fermez pas cette page. Vous recevrez également un email.
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-8 md:p-12 border border-purple-500/30 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 md:w-10 md:h-10 text-green-400" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Pack créé avec succès !</h2>
            <p className="text-gray-400 mb-8">
              Un email a été envoyé à <span className="text-purple-400 font-semibold">{email}</span>
            </p>
            
            <div className="bg-slate-900/50 rounded-xl p-4 md:p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                <span className="text-base md:text-lg font-semibold">Lien de téléchargement</span>
              </div>
              <div className="bg-slate-800 rounded-lg p-3 md:p-4 font-mono text-xs md:text-sm break-all text-purple-300 mb-4">
                {packUrl}
              </div>
              <p className="text-xs md:text-sm text-gray-400">
                ⏱️ Valide pendant 7 jours
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={packUrl}
                className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-base md:text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                <Download className="w-5 h-5" />
                Télécharger maintenant
              </a>
              
              <button
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-slate-700 rounded-xl font-bold text-base md:text-lg hover:bg-slate-600 transition-all"
              >
                Créer un nouveau pack
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-8 md:p-12 border border-red-500/30 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 md:w-10 md:h-10 text-red-400" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Une erreur est survenue</h2>
            <p className="text-gray-400 mb-8">
              La génération de votre pack a échoué. Veuillez contacter le support.
            </p>
            
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-base md:text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}