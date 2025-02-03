const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { invaluableScraper, storage } = req.app.locals;
    if (!invaluableScraper) {
      throw new Error('Scraper not initialized');
    }

    console.log('Fetching Invaluable Fine Art data...');
    
    const cookies = [
      {
        name: 'AZTOKEN-PROD',
        value: '4F562873-F229-4346-A846-37E9A451FA9E',
        domain: '.invaluable.com'
      },
      {
        name: 'oas-node-sid',
        value: 's%3A5bWesidbuezM2pxrG0NCTb8RxAkufVPn.2ej%2FP3yUMcct%2FCvjVg%2B8wO2qglFnlyBP5pNhauF1tJI',
        domain: 'www.invaluable.com'
      },
      {
        name: 'cf_clearance',
        value: 'Yq4QHU.y14z93vU3CmLCK80CU7Pq6pgupmW0eM8k548-1738320515-1.2.1.1-ZFXBFgIPHghfvwwfhRbZx27.6zPihqfQ4vGP0VY1v66mKc.wwAOVRiRJhK6ouVt_.wMB30bkeY0r9NK.KUTU4gu7GzZxbyh0EH_gE36kcnHDvGATrI_vFs9y1XHq3PgtlHmBUflqgjcS6x9MC5YpXoeELPYiT0k59IPMn..1cHED7zV6T78hILKinjM6hZ.ZeQwetIN6SPmuvXb7V2z2ddJa64Vg_zUi.euce0SjjJr5ti7tHWoFsTV1DO1MkFwDfUpy1yTCdESho.EwyRgfdfRAlx6njkTmlWNkp1aXcXU',
        domain: '.invaluable.com'
      },
      {
        name: 'AWSALB',
        value: 'xkqLPvsd3G6EmNbyhfowJyRrVvHz9ibRJuaJXnMGBgt5XW9JNg/5gxH94w/TIMDySIidhjVPgsZmHeZjLwAOJzoZdJ9EhRkrccyJRbkWByT5kcXShAI0s6YhJk5qA39buwUX05awBerUkQgAM35IMxL3vERiGeb3uK7wwxEt/BEq8bz2mWQLs0KV1Jn9HhQtO+2TfEXQ/xggAFG+sGsB0veobtUMvzJVt+iWWE2y9F/pt8fXsW2NK6pdvewQtdA=',
        domain: 'www.invaluable.com'
      }
    ];

    const result = await invaluableScraper.searchFurniture(cookies);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const metadata = {
      source: 'invaluable',
      category: 'furniture',
      timestamp,
      searchParams: {
        priceResult: { min: 250 },
        query: 'furniture',
        keyword: 'furniture',
        supercategoryName: 'Furniture'
      },
      cookies: cookies.map(({ name, domain }) => ({ name, domain })),
      status: 'pending_processing'
    };

    const savedData = await storage.saveSearchData(result, metadata);
    
    res.json({
      success: true,
      message: 'Search results saved successfully',
      searchId: savedData.searchId,
      files: savedData.files,
      metadata
    });
  } catch (error) {
    console.error('Invaluable search error:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
});

module.exports = router;