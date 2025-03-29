# Resource Optimization Guide

This document outlines the resource optimization features available in the scraper application, particularly focusing on image downloading performance.

## Environment Variables

The following environment variables can be used to control resource utilization:

| Environment Variable | Description | Default Value |
|---------------------|-------------|---------------|
| `MAX_MEMORY_GB` | Maximum memory available to the application (in GB) | 4 |
| `IMAGE_CONCURRENCY` | Number of concurrent image downloads | Auto-calculated based on memory |
| `ENVIRONMENT` | Deployment environment type (cloud or local) | cloud |

## Resource Configuration Parameters

These parameters can be passed directly in API requests:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `maxMemoryGB` | Set the memory size for this request | `maxMemoryGB=8` |
| `imageConcurrency` | Override the concurrency calculation | `imageConcurrency=10` |
| `environment` | Specify the environment type | `environment=local` |

### Example Usage

```bash
# Using the scrape_all_keywords.sh script with custom resources
MAX_MEMORY_GB=16 IMAGE_CONCURRENCY=12 ./scrape_all_keywords.sh

# Direct API call with resource parameters
curl "https://scrapper-856401495068.us-central1.run.app/api/search?query=furniture&saveToGcs=true&saveImages=true&maxMemoryGB=16&imageConcurrency=12"
```

## Optimization Strategies

### Memory-Based Concurrency

The system dynamically adjusts concurrency based on available memory:

| Memory (GB) | Cloud Run Concurrency | Local Concurrency |
|-------------|----------------------|-------------------|
| 2 | 3 | 2 |
| 4 | 6 | 4 |
| 8 | 10 | 6 |
| 16 | 16 | 6 |

### Browser Optimization

For high-memory environments (≥8GB), additional browser optimizations are applied:

- Single-process browser model
- Disabled zygote process
- Optimized context sizing
- Extended timeout values

### Adaptive Restart Frequency

Browser restarts are scheduled based on environment and memory capacity:

| Memory (GB) | Cloud Run Restart Frequency | Local Restart Frequency |
|-------------|---------------------------|-------------------------|
| 2 | Every 20 images | Every 30 images |
| 4 | Every 30 images | Every 50 images |
| 8 | Every 50 images | Every 100 images |

## Recommendations

### Cloud Run Configurations

| Task Size | Recommended Settings |
|-----------|----------------------|
| Small (< 100 items) | `MAX_MEMORY_GB=4` `IMAGE_CONCURRENCY=6` |
| Medium (100-500 items) | `MAX_MEMORY_GB=8` `IMAGE_CONCURRENCY=10` |
| Large (500+ items) | `MAX_MEMORY_GB=16` `IMAGE_CONCURRENCY=16` |

### Local Development Settings

For local development, use more conservative settings:

```bash
ENVIRONMENT=local MAX_MEMORY_GB=4 IMAGE_CONCURRENCY=3 ./scrape_test_keywords.sh
```

## Troubleshooting

If you encounter memory issues:

1. Reduce `IMAGE_CONCURRENCY` to a lower value
2. Increase `MAX_MEMORY_GB` if more resources are available
3. Set `ENVIRONMENT=local` for more conservative resource usage