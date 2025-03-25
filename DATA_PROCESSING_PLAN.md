# Invaluable Data Processing Plan

This document outlines the comprehensive plan for managing our large-scale data pipeline from scraping auction data to database storage.

## 1. Data Collection Phase

**Scraping Service**
- Continue using current scraper with image download capability
- Process keywords in batches (100-200 keywords per batch)
- Use Cloud Run with increased memory/CPU for batch processing
- Store raw JSON + images in GCS buckets (as currently implemented)
- Organize by `category/subcategory/page_XXXX.json` and `/images/` subfolder
- Implement logging for completed batches with timestamp and status

**Optimization**
- Run multiple parallel instances (10-20) to increase throughput
- Schedule scraping during low-traffic hours
- Implement retry mechanisms for failed keywords/pages
- Set reasonable timeouts to avoid hung processes

## 2. Data Processing Layer

**ETL Service (Cloud Functions or Batch Jobs)**
- Monitor GCS buckets for new data with Cloud Functions triggers
- Process JSON files to normalize/clean data
- Extract structured metadata (dimensions, prices, materials, etc.)
- Generate thumbnails/resized versions of images
- Enrich data with additional fields (material detection, categorization)
- Output processed data to staging bucket

**Processing Architecture**
- Cloud Functions for small processing tasks
- Dataflow/Beam for complex transformations
- Cloud Scheduler to orchestrate batch processing jobs
- Pub/Sub for event-driven processing

## 3. Database Storage

**Database Options**
- **PostgreSQL/CloudSQL**: For structured auction data and metadata
- **Firestore**: For semi-structured data with complex querying needs
- **BigQuery**: For analytics and large-scale data analysis

**Schema Design**
- `auctions` table: auction metadata, dates, house info
- `lots` table: individual auction items, prices, dimensions
- `images` table: image references, URLs, dimensions, lot associations
- `categories` and `subcategories` tables: hierarchical organization

**Indexes & Performance**
- Create indexes on frequently queried fields
- Partition large tables by date ranges
- Consider materialized views for complex queries

## 4. Monitoring & Maintenance

**Monitoring Services**
- Cloud Monitoring dashboards for scraper health
- Alerts for failed scraping jobs
- Monitoring for database load and query performance
- Storage utilization metrics

**Regular Maintenance**
- Weekly data quality checks
- Monthly cleanup of staging data
- Quarterly optimization of database indexes
- Monitoring for stale data

## 5. Implementation Timeline

**Phase 1 (Weeks 1-2)**
- Configure enhanced scraper deployment
- Set up dedicated GCS buckets with proper IAM
- Create pipeline monitoring

**Phase 2 (Weeks 3-4)**
- Implement ETL processor functions
- Design and create database schema
- Set up initial data loading pipelines

**Phase 3 (Weeks 5-6)**
- Develop transformation logic for specialized fields
- Implement image processing pipeline
- Create database indexes and optimizations

**Phase 4 (Weeks 7-8)**
- Build monitoring dashboards
- Implement automated testing
- Document the system architecture

## 6. Budget Considerations

**Monthly Cost Estimate for Full Production Scale:**

| Service | Cost Calculation | Estimated Monthly Cost |
|---------|------------------|------------------------|
| GCS Storage | 600K keywords × 20 files × 10KB/file = ~120GB<br>600K keywords × 20 files × 5 images × 200KB = ~12TB<br>@ $0.02/GB/month | $240 (storage) |
| Cloud Run | 3 instances × 2vCPU × 24 hours × 30 days<br>@ $0.00002384/vCPU-second | ~$370 |
| Cloud Functions | 600K triggers × 5 functions × 2 seconds × 512MB<br>@ $0.0000025/GB-second | ~$15 |
| CloudSQL/Database | db-n1-standard-2 instance<br>@ $0.0612/hour + storage | ~$250 |
| Image Processing | 600K × 20 pages × 5 images = 60M images<br>@ $0.30 per 1000 images | ~$18,000 (one-time) |
| BigQuery | 1TB processed per month<br>@ $5.00/TB | $5 |
| **TOTAL** | | **~$880/month** + one-time processing |

**Cost-Saving Options:**

1. **Storage Optimizations** (Potential savings: $150-200/month)
   - Store only primary images instead of all 5 images per lot (~80% reduction in image storage)
   - Implement more aggressive image compression (reduce size by 30-50%)
   - Use Nearline storage for older data ($0.01/GB vs $0.02/GB)
   - Set up lifecycle policies to auto-archive data older than 90 days

2. **Compute Optimizations** (Potential savings: $150-250/month)
   - Scale down to 1-2 instances during off-peak hours
   - Use scheduled Cloud Run jobs instead of always-on instances
   - Implement autoscaling based on actual traffic patterns
   - Batch processing jobs during nights/weekends at lower rates

3. **Database Optimizations** (Potential savings: $100-200/month)
   - Start with db-g1-small instance ($45/month) and scale as needed
   - Optimize schema for storage efficiency (proper indexing, normalization)
   - Implement query caching and connection pooling
   - Consider serverless options like Firestore for certain workloads

4. **Minimal Viable Approach** (Total: ~$250/month)
   - 1 Cloud Run instance scaling to 0 when idle (~$100/month)
   - Small database instance (~$45/month)
   - Storage for just JSON data and primary images (~$100/month)
   - Process only the most important categories initially

## 7. Scaling Strategies

- Implement sharding for database tables if they grow beyond 100GB
- Use Cloud CDN for frequently accessed images
- Consider cold storage for rarely accessed historical data
- Implement archiving policies for data older than 1 year
- Add read replicas for database as query volume increases