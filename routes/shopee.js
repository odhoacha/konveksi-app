const express = require('express');
const https   = require('https');
const db      = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── Hardcoded product list (shop_id fixed for koncoturuu) ───
const SHOP_ID = 242304264;
const PRODUCTS = [
  { item_id: 18765357002, name: 'Kumala Daster Bigsize' },
  { item_id: 26341263082, name: 'Jennie Daster Busui' },
  { item_id: 42609291065, name: 'Sabina Daster Bigsize Busui' },
  { item_id: 24457420750, name: 'Kumala Daster Long' },
  { item_id: 55654601320, name: 'Nara Piyama Busui' },
  { item_id: 4033942454,  name: 'Gamila Piyama Rayon' },
];

// ─── Fetch one product from Shopee internal API ───────────────
function fetchShopeeItem(item_id) {
  return new Promise((resolve, reject) => {
    const url = `https://shopee.co.id/api/v4/item/get?itemid=${item_id}&shopid=${SHOP_ID}`;
    const options = {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':         `https://shopee.co.id/shop/${SHOP_ID}/`,
        'Accept':          'application/json',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'x-requested-with': 'XMLHttpRequest',
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

// ─── Parse variants + stock from Shopee response ─────────────
function parseProduct(raw, fallbackName) {
  const item = raw?.data?.item;
  if (!item) return null;

  const name   = item.name || fallbackName;
  const models = item.models || [];

  // If no variants, use top-level stock
  if (!models.length) {
    return {
      name,
      total_stock: item.stock || 0,
      variants: [{ name: 'Default', stock: item.stock || 0 }]
    };
  }

  const variants = models.map(m => ({
    name:  m.name || m.model_id,
    stock: m.stock || 0,
  }));

  const total_stock = variants.reduce((s, v) => s + v.stock, 0);
  return { name, total_stock, variants };
}

// ─── GET /api/shopee/stock ────────────────────────────────────
// Fetch all 6 products in parallel, return stock data
router.get('/stock', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      PRODUCTS.map(p => fetchShopeeItem(p.item_id))
    );

    const products = results.map((result, i) => {
      const p = PRODUCTS[i];
      if (result.status === 'rejected') {
        return {
          item_id:     p.item_id,
          name:        p.name,
          error:       result.reason?.message || 'Gagal fetch',
          total_stock: null,
          variants:    [],
        };
      }
      const parsed = parseProduct(result.value, p.name);
      if (!parsed) {
        return {
          item_id:     p.item_id,
          name:        p.name,
          error:       'Data tidak ditemukan dari Shopee',
          total_stock: null,
          variants:    [],
        };
      }
      return { item_id: p.item_id, ...parsed };
    });

    res.json({ products, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error('SHOPEE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
