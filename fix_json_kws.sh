#!/bin/bash

# This script fixes the keywords file by removing extra quotes and commas

INPUT_FILE="KWs.txt"
OUTPUT_FILE="clean_KWs.txt"
TEMP_FILE=$(mktemp)

# Extract clean keywords from JSON array
jq -r '.[]' "$INPUT_FILE" > "$OUTPUT_FILE"

# Count lines
count=$(wc -l < "$OUTPUT_FILE")
echo "Extracted $count clean keywords to $OUTPUT_FILE"

echo "Sample keywords:"
head -n 5 "$OUTPUT_FILE"