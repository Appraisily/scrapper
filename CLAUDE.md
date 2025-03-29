# CLAUDE.md - Scrapper Project Guide

## Build/Run Commands
- Start server: `npm start`
- Start scraper example: `npm run start:scraper`
- Test GCS integration: `npm run test:gcs`
- Run specific example: `node src/examples/[example-name].js`
- Deploy to GCP: `gcloud builds submit --config cloudbuild.yaml`
- Run specific scraper: `sh scrape_test_keywords.sh [keyword]`

## Code Style
- **Formatting**: Standard JS style with 2-space indentation
- **Imports**: Group by 3rd party then local, alphabetize within groups
- **Error Handling**: Use try/catch blocks with specific error messages
- **Logging**: Use console.log/error with descriptive prefixes (e.g., "[Scraper]", "[Browser]")
- **Functions**: Async/await pattern for asynchronous operations
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Types**: JSDoc comments for function parameters and return types

## Project Structure
- Express routes in `src/routes/`
- Core scraper logic in `src/scrapers/invaluable/`
- Example implementations in `src/examples/`
- Storage utilities in `src/utils/`
- Shell scripts for orchestration in project root

## Best Practices
- Initialize browser only when needed
- Handle pagination with dedicated managers
- Use proper shutdown handlers for browser instances
- Store results in Google Cloud Storage buckets
- Monitor logs in `scrape_logs/` directory
- Use environment variables for sensitive configuration
- Configure resource usage based on environment needs

## Resource Optimization
- Set `MAX_MEMORY_GB` environment variable to match available system memory
- Use `IMAGE_CONCURRENCY` to control parallel image downloads
- Set `ENVIRONMENT=local` for development and `ENVIRONMENT=cloud` for production
- For large jobs, increase memory and adjust concurrency settings:
  ```bash
  MAX_MEMORY_GB=16 IMAGE_CONCURRENCY=12 npm start
  ```
- See `docs/resource-optimization.md` for detailed configuration options