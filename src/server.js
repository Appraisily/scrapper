const express = require('express');
const cors = require('cors');
const artistsRouter = require('./routes/artists');
const searchRouter = require('./routes/search');
const InvaluableScraper = require('./scrapers/invaluable');
const storage = require('./utils/storage');

const port = process.env.PORT || 8080;

const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT'];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const app = express();

let invaluableScraper = null;
let initializingInvaluable = false;

// Graceful shutdown handler
async function shutdown() {
  console.log('Shutting down gracefully...');
  if (invaluableScraper) {
    try {
      await invaluableScraper.close();
    } catch (error) {
      console.error('Error closing scraper:', error);
    }
  }
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Add health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invaluable Scraper API is running' });
});

app.use(cors());
app.use(express.json());

app.locals.storage = storage;

async function initializeScraper() {
  if (initializingInvaluable) {
    while (initializingInvaluable) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  initializingInvaluable = true;
  console.log('Starting Invaluable scraper initialization...');

  try {
    invaluableScraper = new InvaluableScraper();
    await invaluableScraper.initialize();
    app.locals.invaluableScraper = invaluableScraper;
    console.log('Invaluable scraper initialized successfully');
  } catch (error) {
    console.error('Error initializing Invaluable scraper:', error);
    throw error;
  } finally {
    initializingInvaluable = false;
  }
}

// Initialize scraper and set up routes
async function startServer() {
  try {
    await initializeScraper();
    
    app.use('/api/invaluable/artists', artistsRouter);
    app.use('/api/invaluable', searchRouter);
    
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server is now listening on port ${port}`);
      console.log('Google Cloud Project:', process.env.GOOGLE_CLOUD_PROJECT);
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