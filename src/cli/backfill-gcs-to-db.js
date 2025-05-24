// Backfill script: read JSON results in GCS and write metadata into PostgreSQL
// Usage: npm run backfill -- <optional:prefix>

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { pool } = require('../db');
const { obfuscateLot } = require('../utils/field-map');
require('dotenv').config();

(async () => {
  const bucketName = process.env.STORAGE_BUCKET || 'invaluable-html-archive-images';
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const prefix = process.argv[2] || 'invaluable-data/';
  console.log(`Starting backfill from gs://${bucketName}/${prefix}`);

  // Fetch list of JSON files under prefix recursively
  const [files] = await bucket.getFiles({ prefix });
  const jsonFiles = files.filter(f => f.name.endsWith('.json'));
  console.log(`Found ${jsonFiles.length} JSON files`);

  for (const file of jsonFiles) {
    try {
      // Downloads file into memory (assuming reasonable size per page)
      const [contents] = await file.download();
      const json = JSON.parse(contents.toString());
      // Expect standardizedResponse shape with data.lots array.
      const lots = json?.data?.lots || [];
      if (lots.length === 0) continue;

      // Derive auction id and other info from file path pattern
      const parts = file.name.split('/');
      // invaluable-data/{category}/{subcategory?}/page_XXXX.json
      const category = parts[1] || 'uncategorized';
      let subcategory = null;
      if (parts.length === 4) subcategory = parts[2];

      // Ensure auction row exist: for this simple script, we'll group by category+subcategory as auction surrogate
      const auctionKey = `${category}${subcategory ? '-' + subcategory : ''}`;

      // Upsert auction
      const auctionRes = await pool.query(
        `INSERT INTO auctions (source_auction, title, sale_date)
         VALUES ($1, $2, NOW())
         ON CONFLICT (source_auction) DO UPDATE SET title=EXCLUDED.title
         RETURNING id`,
        [auctionKey, auctionKey]
      );
      const auctionId = auctionRes.rows[0].id;

      // Insert lots
      for (const lot of lots) {
        const obf = obfuscateLot(lot);
        const sourceLot = obf.ln || lot.lotNumber || lot.lot_number || 'unknown';
        const imgKey = lot.imagePath || lot.image || null;

        await pool.query(
          `INSERT INTO lots (auction_id, source_lot, t, d, hp, eL, eH, currency, img_key, raw_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (auction_id, source_lot) DO UPDATE SET t=EXCLUDED.t`,
          [
            auctionId,
            sourceLot,
            obf.t || lot.title,
            obf.d || lot.description,
            obf.hp || null,
            obf.eL || null,
            obf.eH || null,
            obf.c || lot.currency || 'USD',
            imgKey,
            lot
          ]
        );
      }
      console.log(`Processed ${lots.length} lots from ${file.name}`);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err.message);
    }
  }

  console.log('Backfill complete');
  await pool.end();
})();