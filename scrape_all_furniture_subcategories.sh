#!/bin/bash

# Script to scrape all furniture subcategories from Invaluable
# This script will execute each curl command sequentially

API_BASE_URL="https://valuer-dev-856401495068.us-central1.run.app/api/furniture/scrape"

echo "Starting scraping of all furniture subcategories..."
echo "==============================================="

# Function to URL encode spaces in subcategory names
urlencode() {
  local string="$1"
  echo "${string// /%20}"
}

# Tables, Stands & Consoles
SUBCATEGORY=$(urlencode "Tables, Stands & Consoles")
echo "Scraping: Tables, Stands & Consoles"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Tables, Stands & Consoles. Waiting 5 seconds before next request...\n"
sleep 5

# Chairs
echo "Scraping: Chairs"
curl "${API_BASE_URL}/Chairs?fetchAllPages=true"
echo -e "\n\nCompleted Chairs. Waiting 5 seconds before next request...\n"
sleep 5

# Cabinets & Storage
SUBCATEGORY=$(urlencode "Cabinets & Storage")
echo "Scraping: Cabinets & Storage"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Cabinets & Storage. Waiting 5 seconds before next request...\n"
sleep 5

# Desks, Secretaries & Bureaus
SUBCATEGORY=$(urlencode "Desks, Secretaries & Bureaus")
echo "Scraping: Desks, Secretaries & Bureaus"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Desks, Secretaries & Bureaus. Waiting 5 seconds before next request...\n"
sleep 5

# Sofas & Settees
SUBCATEGORY=$(urlencode "Sofas & Settees")
echo "Scraping: Sofas & Settees"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Sofas & Settees. Waiting 5 seconds before next request...\n"
sleep 5

# Stools & Benches
SUBCATEGORY=$(urlencode "Stools & Benches")
echo "Scraping: Stools & Benches"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Stools & Benches. Waiting 5 seconds before next request...\n"
sleep 5

# Candelabra, Incense Burners & Lamps
SUBCATEGORY=$(urlencode "Candelabra, Incense Burners & Lamps")
echo "Scraping: Candelabra, Incense Burners & Lamps"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Candelabra, Incense Burners & Lamps. Waiting 5 seconds before next request...\n"
sleep 5

# Mirrors & Looking Glasses
SUBCATEGORY=$(urlencode "Mirrors & Looking Glasses")
echo "Scraping: Mirrors & Looking Glasses"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Mirrors & Looking Glasses. Waiting 5 seconds before next request...\n"
sleep 5

# Beds & Bedroom Sets
SUBCATEGORY=$(urlencode "Beds & Bedroom Sets")
echo "Scraping: Beds & Bedroom Sets"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Beds & Bedroom Sets. Waiting 5 seconds before next request...\n"
sleep 5

# Carts, Bar & Tea trolleys
SUBCATEGORY=$(urlencode "Carts, Bar & Tea trolleys")
echo "Scraping: Carts, Bar & Tea trolleys"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Carts, Bar & Tea trolleys. Waiting 5 seconds before next request...\n"
sleep 5

# Bookcases & Display Cases
SUBCATEGORY=$(urlencode "Bookcases & Display Cases")
echo "Scraping: Bookcases & Display Cases"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Bookcases & Display Cases. Waiting 5 seconds before next request...\n"
sleep 5

# Buffets & Sideboards
SUBCATEGORY=$(urlencode "Buffets & Sideboards")
echo "Scraping: Buffets & Sideboards"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Buffets & Sideboards. Waiting 5 seconds before next request...\n"
sleep 5

# Dry Bars & Wine Storage
SUBCATEGORY=$(urlencode "Dry Bars & Wine Storage")
echo "Scraping: Dry Bars & Wine Storage"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Dry Bars & Wine Storage. Waiting 5 seconds before next request...\n"
sleep 5

# Vanities & Accessories
SUBCATEGORY=$(urlencode "Vanities & Accessories")
echo "Scraping: Vanities & Accessories"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Vanities & Accessories. Waiting 5 seconds before next request...\n"
sleep 5

# Coat & Umbrella Stands
SUBCATEGORY=$(urlencode "Coat & Umbrella Stands")
echo "Scraping: Coat & Umbrella Stands"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Coat & Umbrella Stands. Waiting 5 seconds before next request...\n"
sleep 5

# Other Furniture
SUBCATEGORY=$(urlencode "Other Furniture")
echo "Scraping: Other Furniture"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Other Furniture. Waiting 5 seconds before next request...\n"
sleep 5

# Unknown
echo "Scraping: Unknown"
curl "${API_BASE_URL}/Unknown?fetchAllPages=true"
echo -e "\n\nCompleted Unknown. Waiting 5 seconds before next request...\n"
sleep 5

# Credenzas
echo "Scraping: Credenzas"
curl "${API_BASE_URL}/Credenzas?fetchAllPages=true"
echo -e "\n\nCompleted Credenzas. Waiting 5 seconds before next request...\n"
sleep 5

# Entertainment Centers
SUBCATEGORY=$(urlencode "Entertainment Centers")
echo "Scraping: Entertainment Centers"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Entertainment Centers. Waiting 5 seconds before next request...\n"
sleep 5

# Fireplace Tools & Screens
SUBCATEGORY=$(urlencode "Fireplace Tools & Screens")
echo "Scraping: Fireplace Tools & Screens"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Fireplace Tools & Screens. Waiting 5 seconds before next request...\n"
sleep 5

# Garment Racks & Clothes Valets
SUBCATEGORY=$(urlencode "Garment Racks & Clothes Valets")
echo "Scraping: Garment Racks & Clothes Valets"
curl "${API_BASE_URL}/${SUBCATEGORY}?fetchAllPages=true"
echo -e "\n\nCompleted Garment Racks & Clothes Valets. Waiting 5 seconds before next request...\n"
sleep 5

# Beds
echo "Scraping: Beds"
curl "${API_BASE_URL}/Beds?fetchAllPages=true"
echo -e "\n\nCompleted Beds. Waiting 5 seconds before next request...\n"
sleep 5

# Wardrobes
echo "Scraping: Wardrobes"
curl "${API_BASE_URL}/Wardrobes?fetchAllPages=true"
echo -e "\n\nCompleted Wardrobes\n"

echo "==============================================="
echo "All furniture subcategories have been scraped!" 