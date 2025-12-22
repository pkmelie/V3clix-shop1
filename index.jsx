import React, { useState, useEffect } from 'react';
import { Package, Check, Loader2, Download, Mail } from 'lucide-react';

export default function BotCreator() {
  const [categories, setCategories] = useState([]);
  const [selections, setSelections] = useState({});
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select'); // select, payment, processing, complete
  const [packUrl, setPackUrl] = useState('');
  const [progress, setProgress] = useState(0);

  // Simulation de chargement des catégories (à remplacer par votre API)
  useEffect(() => {
    const mockCategories = [
      {
        id: 'templates',
        name: 'Templates Discord',
        description: 'Templates de serveur prêts à l\'emploi',
        files: [
          { id: 'temp1', name: 'Template Gaming', size: '250 MB' },
          { id: 'temp2', name: 'Template Communauté', size: '180 MB' },
          { id: 'temp3', name: 'Template RP', size: '320 MB' }
        ]
      },
      {
        id: 'bots',
        name: 'Bots Discord',
        description: 'Bots configurés et personnalisables',
        files: [
          { id: 'bot1', name: 'Bot Modération', size: '450 MB' },
          { id: 'bot2', name: 'Bot Musique', size: '380 MB' },
          { id: 'bot3', name: 'Bot Économie', size: '520 MB' },
          { id: 'bot4', name: 'Bot Ticket', size: '290 MB' }
        ]
      },
      {
        id: 'assets',
        name: 'Assets & Design',
        description: 'Ressources graphiques et visuelles',
        files: [
          { id: 'asset1', name: 'Pack Icons', size: '120 MB' },
          { id: 'asset2', name: 'Bannières', size: '95 MB' },
          { id: 'asset3', name: 'Emojis Custom', size: '75 MB' }
        ]
      },
      {
        id: 'docs',
        name: 'Documentation',
        description: 'Guides et tutoriels',
        files: [
          { id: 'doc1', name: 'Guide Installation', size: '15 MB' },
          { id: 'doc2', name: 'Guide Configuration', size: '22 MB' },
          { id: 'doc3', name: 'Guide Avancé', size: '38 MB' }
        ]
      }
    ];
    setCategories(mockCategories);
  }, []);

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
    let total = 0;
    categories.forEach(cat => {
      const selected = selections[cat.id] || [];
      selected.forEach(fileId => {
        const file = cat.files.find(f => f.id === fileId);
        if (file) {
          const size = parseFloat(file.size);
          total += size;
        }
      });
    });
    return total.toFixed(2);
  };

  const getSelectedCount = () => {
    return Object.values(selections).reduce((acc, arr) => acc + arr.length, 0);
  };

  const handleSubmit = async () => {
    if (!email || getSelectedCount() === 0) return;
    
    setLoading(true);
    setStep('processing');
    
    // Simulation de la progression
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    // Simulation d'appel API
    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setStep('complete');
      setPackUrl('https://v3clix-shop.com/download/pack_abc123');
      setLoading(false);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <Package className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Créez Votre Pack Bot
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Sélectionnez les éléments que vous souhaitez inclure dans votre pack personnalisé
          </p>
        </div>

        {step === 'select' && (
          <>
            {/* Catégories et fichiers */}
            <div className="space-y-8 mb-8">
              {categories.map(category => (
                <div key={category.id} className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-purple-500/20">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-purple-300 mb-2">{category.name}</h2>
                    <p className="text-gray-400">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <span className="font-semibold text-white">{file.name}</span>
                            {isSelected && (
                              <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-sm text-gray-400">{file.size}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Résumé et Email */}
            <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-8 border border-purple-500/30">
              <div className="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-xl font-bold mb-4 text-purple-300">Votre Sélection</h3>
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
                    Email de livraison
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-gray-500"
                  />
                  <p className="text-sm text-gray-400 mt-2">
                    Le lien de téléchargement sera envoyé à cette adresse
                  </p>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={getSelectedCount() === 0 || !email}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Procéder au paiement
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-12 border border-purple-500/30 text-center">
            <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Génération de votre pack...</h2>
            <p className="text-gray-400 mb-8">Nous assemblons vos fichiers sélectionnés</p>
            
            <div className="max-w-md mx-auto">
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-purple-400 font-bold mt-4">{progress}%</p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-slate-800/70 backdrop-blur rounded-2xl p-12 border border-purple-500/30 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            
            <h2 className="text-3xl font-bold mb-4">Pack créé avec succès !</h2>
            <p className="text-gray-400 mb-8">
              Un email a été envoyé à <span className="text-purple-400 font-semibold">{email}</span>
            </p>
            
            <div className="bg-slate-900/50 rounded-xl p-6 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <span className="text-lg font-semibold">Lien de téléchargement</span>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm break-all text-purple-300 mb-4">
                {packUrl}
              </div>
              <p className="text-sm text-gray-400">
                ⏱️ Valide pendant 7 jours
              </p>
            </div>

            <button
              onClick={() => window.open(packUrl, '_blank')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              <Download className="w-5 h-5" />
              Télécharger maintenant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}