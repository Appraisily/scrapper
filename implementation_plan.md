# Implementation Plan: Hybrid Storage Solution for Invaluable Scraper Data

## Overview

This document outlines the plan to migrate from storing scraped Invaluable data as JSON files in Google Cloud Storage (GCS) to a hybrid approach:
- **PostgreSQL Database**: For structured data (item details, prices, descriptions, etc.)
- **Google Cloud Storage**: For image files

This approach optimizes both query performance for search/filtering and cost-effectiveness for large media storage.

## Current Architecture

- Scraper collects data from Invaluable
- Data saved as JSON files in GCS bucket
- Images saved in GCS bucket
- No dedicated database for structured data

## Target Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Scraper      │────▶│  Cloud Run API  │◄────│    Website      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
        │                        │                        ▲
        │                        ▼                        │
        │            ┌─────────────────┐                  │
        │            │   PostgreSQL    │                  │
        │            │   (Cloud SQL)   │──────────────────┘
        │            └─────────────────┘
        │                    ▲
        ▼                    │
┌─────────────────┐          │
│  GCS Bucket     │──────────┘
│  (Images)       │
└─────────────────┘
```

## Database Schema Design

```sql
-- Items table (main auction items)
CREATE TABLE items (
    item_id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    lot_number VARCHAR(100),
    auction_date TIMESTAMP,
    auction_house VARCHAR(255),
    auction_location VARCHAR(255),
    category VARCHAR(255),
    subcategory VARCHAR(255),
    estimated_price_min NUMERIC,
    estimated_price_max NUMERIC,
    sold_price NUMERIC,
    currency VARCHAR(10),
    source_url TEXT,
    scraped_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Images table
CREATE TABLE images (
    image_id SERIAL PRIMARY KEY,
    item_id VARCHAR(255) REFERENCES items(item_id),
    gcs_url TEXT NOT NULL,
    image_order INT,
    is_primary BOOLEAN DEFAULT false,
    width INT,
    height INT,
    UNIQUE(item_id, gcs_url)
);

-- Item details table (for various additional fields)
CREATE TABLE item_details (
    detail_id SERIAL PRIMARY KEY,
    item_id VARCHAR(255) REFERENCES items(item_id),
    attribute_name VARCHAR(255) NOT NULL,
    attribute_value TEXT,
    UNIQUE(item_id, attribute_name)
);

-- Full-text search index
CREATE INDEX items_fts_idx ON items USING gin(
    to_tsvector('english', 
        coalesce(title, '') || ' ' || 
        coalesce(description, '') || ' ' || 
        coalesce(lot_number, '') || ' ' ||
        coalesce(category, '') || ' ' ||
        coalesce(subcategory, '')
    )
);

-- Price range indexes
CREATE INDEX items_min_price_idx ON items(estimated_price_min);
CREATE INDEX items_max_price_idx ON items(estimated_price_max);
CREATE INDEX items_sold_price_idx ON items(sold_price);
```

## Implementation Steps

### Phase 1: Setup Infrastructure (Week 1)

1. **Set up Cloud SQL PostgreSQL instance**
   - Create instance in same region as your Cloud Run service
   - Configure network settings to allow connections from Cloud Run
   - Set up automated backups

2. **Database initialization**
   - Deploy schema defined above
   - Create application user with appropriate permissions
   - Set up connection pooling

3. **Update Cloud Run service**
   - Add database connection configuration
   - Update service account permissions to access both GCS and Cloud SQL

### Phase 2: Data Migration Tool (Week 2)

1. **Create migration script**
   ```python
   # migration.py structure
   import json
   import os
   from google.cloud import storage
   import psycopg2
   from psycopg2.extras import execute_batch
   
   def parse_json_to_sql(json_file_path):
       """Parse a JSON file and return structured data for SQL insertion"""
       with open(json_file_path, 'r') as f:
           data = json.load(f)
           # Transform data structure to match SQL schema
           # Return item data, image data, and details data
   
   def migrate_data(bucket_name, db_connection_string):
       """Migrate data from GCS JSON files to PostgreSQL"""
       # Connect to storage and database
       storage_client = storage.Client()
       bucket = storage_client.bucket(bucket_name)
       conn = psycopg2.connect(db_connection_string)
       
       # Get all JSON files from bucket
       blobs = list(bucket.list_blobs(prefix='path/to/json/files'))
       
       for blob in blobs:
           # Download JSON file
           # Parse JSON to SQL format
           # Insert into database tables
           
       # Create appropriate indexes after bulk loading
   ```

2. **Test migration process**
   - Verify data integrity
   - Measure performance and optimize

### Phase 3: Update Scraper to Use Hybrid Model (Week 3)

1. **Modify scraper to save structured data to PostgreSQL**
   ```python
   # Update scraper with database connection
   class InvalidableScraper:
       def __init__(self, db_conn_string, gcs_bucket_name):
           self.db_conn = psycopg2.connect(db_conn_string)
           self.storage_client = storage.Client()
           self.bucket = self.storage_client.bucket(gcs_bucket_name)
       
       def save_item(self, item_data):
           # Save structured data to PostgreSQL
           # Save images to GCS
           # Store image references in the database
   ```

2. **Implement transaction handling**
   - Ensure atomic operations (either all data is saved or none)
   - Handle potential failures gracefully

### Phase 4: API Development (Week 4)

1. **Create/update REST API endpoints**
   ```python
   # app.py structure
   from flask import Flask, request, jsonify
   import psycopg2
   from psycopg2.extras import RealDictCursor
   
   app = Flask(__name__)
   
   @app.route('/api/items', methods=['GET'])
   def get_items():
       # Get query parameters
       keyword = request.args.get('q', '')
       min_price = request.args.get('min_price')
       max_price = request.args.get('max_price')
       category = request.args.get('category')
       
       # Construct SQL query with parameters
       query = """
           SELECT i.*, 
                  (SELECT gcs_url FROM images 
                   WHERE item_id = i.item_id AND is_primary = true 
                   LIMIT 1) as primary_image 
           FROM items i
           WHERE 1=1
       """
       
       params = []
       
       # Add filters based on parameters
       if keyword:
           query += " AND to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', %s)"
           params.append(keyword)
       
       if min_price:
           query += " AND (estimated_price_min >= %s OR sold_price >= %s)"
           params.extend([min_price, min_price])
       
       # Return query results
       return jsonify(execute_query(query, params))
   
   @app.route('/api/items/<item_id>', methods=['GET'])
   def get_item(item_id):
       # Get single item with all images and details
       # Return complete item data
   ```

2. **Implement search and filtering capabilities**
   - Full-text search for keywords
   - Numeric filtering for price ranges
   - Categorical filtering

### Phase 5: Testing and Optimization (Week 5)

1. **Load testing**
   - Measure query performance under load
   - Optimize indexes based on common query patterns

2. **Create monitoring**
   - Set up database monitoring
   - Set up API performance monitoring

3. **Final verification**
   - End-to-end testing of scraper → database → API → frontend

## File Structure

```
/
├── scraper/
│   ├── invaluable_scraper.py      # Modified scraper with DB integration
│   ├── database.py                # Database connection and operations
│   └── storage.py                 # GCS operations
├── migration/
│   ├── migration.py               # Main migration script
│   ├── schema.sql                 # SQL schema definition
│   └── validation.py              # Data validation utilities
├── api/
│   ├── app.py                     # Main API application
│   ├── database.py                # Database connection and query helpers
│   ├── routes/
│   │   ├── items.py               # Item-related endpoints
│   │   └── search.py              # Search-related endpoints
│   └── schemas/                   # Request/response schemas
├── docker/
│   ├── scraper.Dockerfile         # Dockerfile for scraper
│   └── api.Dockerfile             # Dockerfile for API
└── terraform/                     # Infrastructure as code (optional)
    ├── main.tf
    ├── cloud_sql.tf
    └── cloud_run.tf
```

## Timeline

| Week | Phase | Main Activities |
|------|-------|----------------|
| 1 | Infrastructure | Set up Cloud SQL, configure networking |
| 2 | Migration Tool | Create and test data migration process |
| 3 | Scraper Update | Modify scraper to use hybrid storage model |
| 4 | API Development | Implement search and filtering APIs |
| 5 | Testing | Load testing, optimization, monitoring |

## Key Considerations

1. **Incremental Migration**: Consider migrating data incrementally while keeping the original JSON files as a backup.

2. **Database Connection Management**: Use connection pooling to efficiently handle multiple concurrent requests.

3. **Cost Management**: Monitor database usage to optimize costs. Consider implementing table partitioning if data volume grows significantly.

4. **Backup Strategy**: Implement regular database backups in addition to existing GCS backups.

5. **Search Performance**: The implementation uses PostgreSQL's built-in full-text search. If search performance becomes a bottleneck, consider adding a dedicated search service like Algolia. 