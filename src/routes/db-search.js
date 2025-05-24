const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/db-search?query=...&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const q = req.query.query || '';
    if (!q) {
      return res.status(400).json({ success: false, error: 'Missing query param' });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;

    // total count
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM lots WHERE fts @@ plainto_tsquery($1)`,
      [q]
    );
    const totalItems = parseInt(countRows[0].count, 10);

    // results
    const { rows } = await db.query(
      `SELECT id, t AS title, d AS description, img_key, hp, eL, eH, currency, auction_id,
              ts_rank_cd(fts, plainto_tsquery($1)) AS rank
       FROM lots
       WHERE fts @@ plainto_tsquery($1)
       ORDER BY rank DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [q, limit, offset]
    );

    // Build image URL
    const bucket = process.env.STORAGE_BUCKET || 'invaluable-html-archive-images';
    const results = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      hammerPrice: r.hp,
      estimateLow: r.eL,
      estimateHigh: r.eH,
      currency: r.currency,
      image: r.img_key ? `https://storage.googleapis.com/${bucket}/${r.img_key}` : null,
      auctionId: r.auction_id
    }));

    return res.json({
      success: true,
      data: results,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        itemsPerPage: limit
      }
    });
  } catch (err) {
    console.error('DB search error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;