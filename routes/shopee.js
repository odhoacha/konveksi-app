const express = require('express');
const https   = require('https');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const SHOP_ID = 242304264;
const PRODUCTS = [
  { item_id: 18765357002, name: 'Kumala Daster Bigsize' },
  { item_id: 26341263082, name: 'Jennie Daster Busui' },
  { item_id: 42609291065, name: 'Sabina Daster Bigsize Busui' },
  { item_id: 24457420750, name: 'Kumala Daster Long' },
  { item_id: 55654601320, name: 'Nara Piyama Busui' },
  { item_id: 4033942454,  name: 'Gamila Piyama Rayon' },
];

// ─── Core fetch with browser-like headers ─────────────────────
function fetchShopee(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'shopee.co.id',
      path,
      method: 'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer':         'https://shopee.co.id/',
        'Connection':      'keep-alive',
        'sec-ch-ua':       '"Chromium";v="124", "Google Chrome";v="124"',
        'sec-ch-ua-mobile':'?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest':  'empty',
        'sec-fetch-mode':  'cors',
        'sec-fetch-site':  'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        'if-none-match':   '',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Parse variants from any known Shopee response shape ──────
function parseProduct(raw, fallbackName) {
  // Try multiple known API shapes
  const item = raw?.data?.item       // v4 shape
             || raw?.item            // v2 shape
             || raw?.data            // flat shape
             || null;

  if (!item) return null;

  const name   = item.name || fallbackName;

  // models = variants (v4), tierVariations+models (v2)
  const models = item.models || item.tier_variations?.[0]?.options || [];

  if (!models.length) {
    const stock = item.stock ?? item.stock_quantity ?? 0;
    return {
      name,
      total_stock: stock,
      variants: [{ name: 'Default', stock }]
    };
  }

  // v4 models have stock directly
  if (item.models?.[0]?.stock !== undefined) {
    const variants = item.models.map(m => ({
      name:  m.name || String(m.model_id),
      stock: m.stock ?? 0,
    }));
    return { name, total_stock: variants.reduce((s,v) => s + v.stock, 0), variants };
  }

  // fallback: use item-level stock, no variant breakdown
  const stock = item.stock ?? item.stock_quantity ?? 0;
  return { name, total_stock: stock, variants: [{ name: 'Total', stock }] };
}

// ─── GET /api/shopee/debug — raw Shopee response (temp) ───────
router.get('/debug', async (req, res) => {
  const item_id = req.query.item_id || PRODUCTS[0].item_id;

  // Try multiple API versions
  const paths = [
    `/api/v4/item/get?itemid=${item_id}&shopid=${SHOP_ID}`,
    `/api/v2/item/get?itemid=${item_id}&shopid=${SHOP_ID}`,
    `/api/v4/pdp/get_pc?item_id=${item_id}&shop_id=${SHOP_ID}`,
  ];

  const results = {};
  for (const path of paths) {
    try {
      const r = await fetchShopee(path);
      results[path] = {
        status: r.status,
        // Show first 800 chars of body so we can see the structure
        body_preview: r.body.slice(0, 800),
      };
    } catch (e) {
      results[path] = { error: e.message };
    }
  }

  res.json(results);
});

// ─── GET /api/shopee/stock ────────────────────────────────────
router.get('/stock', async (req, res) => {
  try {
    const results = await Promise.allSettled(
      PRODUCTS.map(async p => {
        // Try v4 first, fall back to v2
        const paths = [
          `/api/v4/item/get?itemid=${p.item_id}&shopid=${SHOP_ID}`,
          `/api/v2/item/get?itemid=${p.item_id}&shopid=${SHOP_ID}`,
        ];

        let lastBody = null;
        for (const path of paths) {
          const r = await fetchShopee(path);
          if (r.status === 200) {
            try {
              const json = JSON.parse(r.body);
              const parsed = parseProduct(json, p.name);
              if (parsed) return { item_id: p.item_id, ...parsed };
              lastBody = json;
            } catch (_) {}
          }
        }

        // If we got a body but couldn't parse, return it for debugging
        return {
          item_id: p.item_id,
          name: p.name,
          error: 'Data tidak ditemukan dari Shopee',
          debug_keys: lastBody ? Object.keys(lastBody) : [],
          total_stock: null,
          variants: [],
        };
      })
    );

    const products = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : {
        item_id: PRODUCTS[i].item_id,
        name:    PRODUCTS[i].name,
        error:   r.reason?.message,
        total_stock: null,
        variants: [],
      }
    );

    res.json({ products, fetched_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;