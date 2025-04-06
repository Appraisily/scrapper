# Code Review & Cleanup Report

This report outlines potential areas for improvement, cleanup, and refactoring within the `scrapper` repository based on its current file structure and common practices.

## 1. Script Redundancy & Organization

**Issue:** Numerous shell scripts (`.sh`) and PowerShell scripts (`.ps1`) exist, primarily in the root directory, with potentially overlapping functionality. This makes it hard to know which script to use for which task and increases maintenance overhead.

**Examples:**
*   **Keyword Scraping:** `test_scrape.sh`, `process_all_KWs.sh`, `scrape_test_keywords.sh` (potentially obsolete).
*   **Furniture Subcategories:** `scripts/scrape-furniture-subcategories.sh` vs `scrape_all_furniture_subcategories.sh` / `scrape_all_furniture_subcategories.ps1` in root.
*   **Folder Listing:** `list-all-folders.sh`, `list-folders-recursive.sh`, `list-folders.sh`.
*   **PowerShell vs Bash:** Several `.ps1` files exist alongside `.sh` equivalents (e.g., `scrape_all_furniture_subcategories.ps1`, `test-gcs.ps1`).

**Recommendations:**
*   **Consolidate Scripts:** Merge scripts with similar functions where possible.
*   **Standardize on Bash:** Consider removing `.ps1` scripts and ensuring `.sh` scripts are compatible across environments (like WSL/Git Bash on Windows) for consistency. Use `bash ./script.sh` for execution if needed.
*   **Centralize Scripts:** Move all operational/utility scripts from the root into the `scripts/` directory.
*   **Organize `scripts/`:** Create subdirectories within `scripts/` for clarity (e.g., `scripts/run/`, `scripts/analyze/`, `scripts/setup/`, `scripts/tests/`).
*   **Adopt Configuration:** Instead of hardcoding URLs/buckets in multiple scripts, use environment variables (via `.env` file loaded at the start of scripts) or a shared configuration file.

## 2. Potentially Unnecessary/Temporary Files

**Issue:** Several files appear to be temporary, related to specific debugging sessions, old backups, or intermediate outputs. These clutter the repository.

**Candidates for Deletion/Review:**
*   `KWs_backup.txt`: Is this backup of the (now small) `KWs.txt` still needed?
*   `debug_image_download.sh` & `image_download_debug_response.txt`: Seem like leftovers from a debugging session.
*   `har_images.har`: Very large HAR file, likely for debugging. Can probably be deleted or added to `.gitignore`.
*   `firearms_queries_results/`: Directory with old results. Delete if no longer needed.
*   `CLAUDE.md`: Appears to be an AI interaction log. Can likely be removed.
*   `gcloud-folders-command.txt`: Content likely incorporated into the folder listing scripts.
*   `index.js` (root): A 4-line file, potentially unused boilerplate.

**Recommendations:**
*   Review the listed files/directories and delete those that are confirmed to be unnecessary.
*   Add patterns for temporary/log/output files (like `*.har`, `*_debug_*.txt`, `*.out`) to `.gitignore`.

## 3. Source Code Structure & Complexity

**Issue:** Some source code files, particularly routes and utilities, are very large, indicating potential violations of the single responsibility principle and making them harder to maintain and test. The structure of routes and utilities could also be clearer.

**Specific Files/Areas:**
*   `src/routes/search.js` (37KB, 911 lines): Extremely large for a route handler. Contains logic that could likely be extracted into separate services or utility functions.
*   `src/utils/search-storage.js` (40KB, 1055 lines): Massive utility file. Needs breaking down into smaller, more focused modules based on functionality (e.g., GCS interaction, data formatting, logging).
*   `src/scrapers/invaluable/pagination/`: Contains several potentially complex and large files (`index.js`, `pagination-manager.js` both 22KB). Review for potential simplification or refactoring. Is there redundant logic between `index.js` and `pagination-manager.js`?
*   `src/routes/`: Contains multiple files related to scraping (`search.js`, `furniture-subcategories.js`, `general-scraper.js`, `scraper.js`). Could potentially be reorganized, maybe under an `api/` subdirectory, for better clarity on API endpoints.
*   `browser-interceptor.js` & `client-interceptor.html` (root): These seem related to the scraping implementation but are located in the root. Consider moving them into the relevant part of the `src/` directory structure (perhaps `src/scrapers/invaluable/` or a dedicated `src/interceptors/` directory).

**Recommendations:**
*   **Refactor Large Files:** Aggressively refactor `src/routes/search.js` and `src/utils/search-storage.js` into smaller, single-purpose modules/functions/classes.
*   **Review Pagination Logic:** Analyze the pagination code in `src/scrapers/invaluable/pagination/` for simplification opportunities.
*   **Organize Routes:** Consider structuring API routes more explicitly, perhaps within `src/routes/api/v1/` or similar.
*   **Relocate Root JS/HTML:** Move `browser-interceptor.js` and `client-interceptor.html` into the `src/` directory structure.

## 4. Documentation Organization

**Issue:** Documentation and planning files (`.md`, `.txt`) are scattered between the root directory and the `docs/` directory.

**Examples in Root:** `CURL.md`, `FURNITURE_SUBCATEGORIES.md`, `pagination-test-commands.md`, `README-pagination.md`, `DATA_PROCESSING_PLAN.md`, `SCRAPE_PROCESS.md`, `scheduler-config.txt`.

**Recommendation:**
*   Consolidate all relevant user/developer documentation into the `docs/` directory. Keep only essential files like `README.md` and potentially `CONTRIBUTING.md` or `LICENSE` in the root.

## 5. Robustness & Configuration

**Issue:** The main processing script (`process_all_KWs.sh`) currently stops on the first error (e.g., a 504 timeout from the service). For very long runs, this might not be ideal. Configuration is also hardcoded.

**Recommendations:**
*   **Error Handling:** Consider adding options to `process_all_KWs.sh` for retries on transient errors (like 504s) or an option to log errors and continue with the next keyword instead of stopping completely.
*   **Configuration:** Implement centralized configuration (e.g., using `.env` files) for parameters like `SERVICE_URL` and `TARGET_BUCKET` used across multiple scripts.
*   **Prerequisites:** Document dependencies like `jq` clearly in the main `README.md`.

---

Addressing these points should significantly improve the repository's maintainability, clarity, and robustness. 