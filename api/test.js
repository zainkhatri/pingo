module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
};
