# CLAUDE.md - Scrapper Project Guide

## Build/Run Commands
- Start server: `npm start`
- Start scraper example: `npm run start:scraper`
- Test GCS integration: `npm run test:gcs`
- Run specific example: `node src/examples/[example-name].js`
- Deploy to GCP: `gcloud builds submit --config cloudbuild.yaml`

## Code Style
- **Formatting**: Standard JS style with 2-space indentation
- **Imports**: Group by 3rd party then local, alphabetize within groups
- **Error Handling**: Use try/catch blocks with specific error messages
- **Logging**: Use console.log/error with descriptive prefixes
- **Functions**: Async/await pattern for asynchronous operations
- **Naming**: camelCase for variables/functions, PascalCase for classes

## Project Structure
- Express routes in `src/routes/`
- Core scraper logic in `src/scrapers/invaluable/`
- Example implementations in `src/examples/`
- Storage utilities in `src/utils/`

## Best Practices
- Initialize browser only when needed
- Handle pagination with dedicated managers
- Use proper shutdown handlers for browser instances
- Store results in Google Cloud Storage where appropriate