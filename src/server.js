const express = require('express');
const cors    = require('cors');
const path    = require('path');

const searchRouter             = require('./routes/search');
const scraperRouter            = require('./routes/scraper');
const generalScraperRouter     = require('./routes/general-scraper');
const imagesRouter             = require('./routes/image-downloader');
const artistOrchestratorRouter = require('./routes/artist-orchestrator');

const { InvaluableScraper } = require('./scrapers/invaluable');

/* --------------------------------------------------------------------------- */

const port = process.env.PORT || 8080;
const app  = express();

const invaluableScraper = new InvaluableScraper();
let   isInitializing    = false;

/* --------------------------------------------------------------------------- */
/* Graceful shutdown                                                           */
/* --------------------------------------------------------------------------- */

async function shutdown() {
  console.log('Shutting down gracefully…');
  try {
    await invaluableScraper.close();
  } catch (err) {
    console.error('Error closing scraper:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT' , shutdown);

/* --------------------------------------------------------------------------- */
/* Basic middleware / plumbing                                                 */
/* --------------------------------------------------------------------------- */

app.get('/', (_req, res) =>
  res.json({ status: 'ok', message: 'Invaluable Search API is running' })
);

app.post('/admin/shutdown', (_req, res) => {
  res.json({ status: 'ok', message: 'Shutdown initiated' });
  console.log('Shutdown requested via admin endpoint');
  setTimeout(shutdown, 1000);
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/* --------------------------------------------------------------------------- */
/* Lazy browser initialisation                                                 */
/* --------------------------------------------------------------------------- */

async function initializeScraper() {
  if (isInitializing) {
    while (isInitializing) await new Promise(r => setTimeout(r, 100));
    return;
  }
  if (invaluableScraper.initialized) return;

  isInitializing = true;
  console.log('Starting Invaluable scraper initialization on demand…');
  try {
    await invaluableScraper.initialize();
    app.locals.invaluableScraper = invaluableScraper;
    console.log('Invaluable scraper initialised successfully');
  } finally {
    isInitializing = false;
  }
}

// Initialise for any route that actually needs the shared browser
app.use(
  ['/api/search', '/api/scraper', '/api/invaluable', '/api/images'],
  async (req, res, next) => {
    try {
      await initializeScraper();
      next();
    } catch (err) {
      res.status(500).json({
        success: false,
        error  : 'Failed to initialise scraper',
        message: err.message,
      });
    }
  }
);

// Optional initialisation for orchestrator routes (only if ?initGlobalScraper=true)
app.use('/api/orchestrator', async (req, res, next) => {
  if (req.query.initGlobalScraper === 'true') {
    try {
      await initializeScraper();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error  : 'Failed to initialise global scraper',
        message: err.message,
      });
    }
  }
  next();
});

/* --------------------------------------------------------------------------- */
/* Route registration                                                          */
/* --------------------------------------------------------------------------- */

function startServer() {
  try {
    app.use('/api/search'      , searchRouter);
    app.use('/api/scraper'     , scraperRouter);
    app.use('/api/invaluable'  , generalScraperRouter);
    app.use('/api/images'      , imagesRouter);
    app.use('/api/orchestrator', artistOrchestratorRouter);

    const server = app.listen(port, '0.0.0.0', () =>
      console.log(`Server listening on port ${port}`)
    );

    server.on('error', err => {
      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();