const express = require('express');
const cors = require('cors');
const path = require('path');
const searchRouter = require('./routes/search');
const scraperRouter = require('./routes/scraper');
const furnitureSubcategoriesRouter = require('./routes/furniture-subcategories');
const generalScraperRouter = require('./routes/general-scraper');
const InvaluableScraper = require('./scrapers/invaluable');

const port = process.env.PORT || 8080;
const app = express();

const invaluableScraper = new InvaluableScraper();
let isInitializing = false;

// Graceful shutdown handler
async function shutdown() {
  console.log('Shutting down gracefully...');
  try {
    await invaluableScraper.close();
  } catch (error) {
    console.error('Error closing scraper:', error);
  }
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Add health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invaluable Search API is running' });
});

// Serve client interceptor tool
app.use(express.static(path.join(__dirname, '../public')));

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Lazy initialization of the scraper
async function initializeScraper() {
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  if (invaluableScraper.initialized) {
    return;
  }

  isInitializing = true;
  console.log('Starting Invaluable scraper initialization on demand...');

  try {
    await invaluableScraper.initialize();
    app.locals.invaluableScraper = invaluableScraper;
    console.log('Invaluable scraper initialized successfully');
  } catch (error) {
    console.error('Error initializing Invaluable scraper:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

// Set up middleware to initialize scraper only when needed
app.use(['/api/search', '/api/furniture', '/api/invaluable'], async (req, res, next) => {
  try {
    await initializeScraper();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to initialize scraper',
      message: error.message
    });
  }
});

// Initialize routes without starting the scraper automatically
async function startServer() {
  try {
    // Set up routes
    app.use('/api/search', searchRouter);
    app.use('/api/scraper', scraperRouter);
    app.use('/api/furniture', furnitureSubcategoriesRouter);
    app.use('/api/invaluable', generalScraperRouter);
    
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server is now listening on port ${port}`);
    });

    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();