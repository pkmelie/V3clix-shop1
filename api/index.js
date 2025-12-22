// api/index.js - Format Vercel Serverless
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Exemple de routes
  if (req.method === 'GET' && req.url === '/api/products') {
    return res.json({ products: [] });
  }

  if (req.method === 'POST' && req.url === '/api/orders') {
    return res.json({ success: true });
  }

  res.status(404).json({ error: 'Not found' });
};