#!/usr/bin/env python3
"""
Script to analyze Google Cloud Storage bucket structure and estimate database size.
"""

import json
import os
import subprocess
import datetime
import argparse
from collections import defaultdict

def get_bucket_folders(bucket_name):
    """Get all folders from the bucket using gsutil."""
    print(f"Fetching folder structure from gs://{bucket_name}...")
    result = subprocess.run(
        ["gsutil", "ls", "-r", f"gs://{bucket_name}/"], 
        capture_output=True, 
        text=True
    )
    
    if result.returncode != 0:
        print(f"Error accessing bucket: {result.stderr}")
        return []
    
    # Extract directory paths (those ending with /)
    folders = []
    for line in result.stdout.splitlines():
        if line.endswith('/'):
            folders.append(line)
    
    return folders

def analyze_folder_structure(folders, bucket_name):
    """Analyze the folder structure to understand data organization."""
    structure = {
        "bucket": bucket_name,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "categories": defaultdict(lambda: {
            "subcategories": defaultdict(int),
            "page_count": 0,
            "image_count": 0
        })
    }
    
    # Pattern matching for folder structure
    for folder in folders:
        # Remove bucket prefix
        path = folder.replace(f"gs://{bucket_name}/", "")
        
        # Skip root folder
        if not path:
            continue
            
        parts = path.strip('/').split('/')
        
        # Handle different folder structures
        if len(parts) >= 2 and parts[0] == "invaluable-data":
            category = parts[1]
            structure["categories"][category]["detected"] = True
            
            # Check for subcategories
            if len(parts) >= 3:
                if parts[2] == "images":
                    structure["categories"][category]["image_count"] += 1
                else:
                    subcategory = parts[2]
                    structure["categories"][category]["subcategories"][subcategory] += 1
                    
                    # Check for image folders in subcategories
                    if len(parts) >= 4 and parts[3] == "images":
                        structure["categories"][category]["image_count"] += 1
    
    # Count page files
    print("Counting JSON page files...")
    result = subprocess.run(
        ["gsutil", "ls", "-r", f"gs://{bucket_name}/**page_*.json"], 
        capture_output=True, 
        text=True
    )
    
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if not line.endswith('.json'):
                continue
                
            path = line.replace(f"gs://{bucket_name}/", "")
            parts = path.strip('/').split('/')
            
            if len(parts) >= 2 and parts[0] == "invaluable-data":
                category = parts[1]
                structure["categories"][category]["page_count"] += 1
    
    # Convert defaultdict to regular dict for JSON serialization
    result = {
        "bucket": structure["bucket"],
        "timestamp": structure["timestamp"],
        "categories": {}
    }
    
    for category, data in structure["categories"].items():
        result["categories"][category] = {
            "subcategories": dict(data["subcategories"]),
            "page_count": data["page_count"],
            "image_count": data["image_count"]
        }
    
    return result

def estimate_database_size(analysis):
    """Estimate database size based on analysis."""
    # Assumptions
    bytes_per_record = 2000  # Average bytes per record in database
    bytes_per_image_record = 500  # Average bytes per image record
    
    total_pages = 0
    total_images = 0
    
    for category, data in analysis["categories"].items():
        total_pages += data["page_count"]
        total_images += data["image_count"]
    
    # Estimate number of records (96 items per page is the default)
    est_records = total_pages * 96
    
    # Calculate estimated database size
    estimated_db_size_bytes = (est_records * bytes_per_record) + (total_images * bytes_per_image_record)
    estimated_db_size_mb = estimated_db_size_bytes / (1024 * 1024)
    estimated_db_size_gb = estimated_db_size_mb / 1024
    
    return {
        "total_categories": len(analysis["categories"]),
        "total_subcategories": sum(len(data["subcategories"]) for data in analysis["categories"].values()),
        "total_pages": total_pages,
        "total_images": total_images,
        "estimated_records": est_records,
        "estimated_db_size_mb": estimated_db_size_mb,
        "estimated_db_size_gb": estimated_db_size_gb,
        "monthly_cost_estimate": {
            "db_storage": estimated_db_size_gb * 0.17,  # $0.17 per GB for CloudSQL
            "db_instance": 250,  # Estimated cost for db-n1-standard-2
            "image_storage": total_images * 0.2 * 0.026,  # Assuming 200KB per image at $0.026/GB
            "total": (estimated_db_size_gb * 0.17) + 250 + (total_images * 0.2 * 0.026 / 1024)
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Analyze GCS bucket for Invaluable data")
    parser.add_argument("--bucket", default="invaluable-html-archive", help="GCS bucket name")
    parser.add_argument("--output", default="bucket_analysis.json", help="Output JSON file")
    args = parser.parse_args()
    
    bucket_name = args.bucket
    output_file = args.output
    
    folders = get_bucket_folders(bucket_name)
    if not folders:
        print("No folders found or unable to access bucket")
        return
    
    print(f"Found {len(folders)} folders")
    
    # Analyze folder structure
    analysis = analyze_folder_structure(folders, bucket_name)
    
    # Estimate database size
    estimates = estimate_database_size(analysis)
    analysis["estimates"] = estimates
    
    # Save results to file
    with open(output_file, 'w') as f:
        json.dump(analysis, f, indent=2)
    
    print(f"Analysis saved to {output_file}")
    print("\nSummary:")
    print(f"Total categories: {estimates['total_categories']}")
    print(f"Total subcategories: {estimates['total_subcategories']}")
    print(f"Total pages: {estimates['total_pages']}")
    print(f"Total images: {estimates['total_images']}")
    print(f"Estimated records: {estimates['estimated_records']:,}")
    print(f"Estimated database size: {estimates['estimated_db_size_gb']:.2f} GB")
    print(f"Estimated monthly cost: ${estimates['monthly_cost_estimate']['total']:.2f}")

if __name__ == "__main__":
    main()