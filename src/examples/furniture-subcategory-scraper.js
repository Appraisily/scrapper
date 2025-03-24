/**
 * Example script for scraping furniture subcategories
 * 
 * This script demonstrates how to fetch items from specific furniture subcategories
 * in Invaluable.com and handle the pagination efficiently for each subcategory.
 */
const axios = require('axios');
const { encodeFurnitureSubcategory } = require('../scrapers/invaluable/url-builder');

// Base URL for API calls
const API_BASE_URL = process.env.API_URL || 'http://localhost:8080/api';

// Configuration
const CONFIG = {
  // Default subcategory to scrape
  subcategory: process.argv[2] || "Tables, Stands & Consoles",
  
  // Maximum pages to fetch (0 means all available)
  maxPages: parseInt(process.argv[3]) || 10,
  
  // Starting page for scraping
  startPage: parseInt(process.argv[4]) || 1
};

/**
 * Main function to run the scraper
 */
async function main() {
  try {
    console.log('==== Furniture Subcategory Scraper ====');
    console.log(`Subcategory: ${CONFIG.subcategory}`);
    console.log(`Max Pages: ${CONFIG.maxPages}`);
    console.log(`Start Page: ${CONFIG.startPage}`);
    
    // Check if subcategory exists and get its info
    const subcategoryInfo = await getSubcategoryInfo(CONFIG.subcategory);
    console.log('\nSubcategory Info:');
    console.log(JSON.stringify(subcategoryInfo, null, 2));
    
    // Get existing pages for this subcategory
    console.log('\nChecking existing pages...');
    if (subcategoryInfo.existingPages.count > 0) {
      console.log(`Found ${subcategoryInfo.existingPages.count} existing pages`);
      console.log(`First few pages: ${subcategoryInfo.existingPages.pages.slice(0, 5).join(', ')}${subcategoryInfo.existingPages.pages.length > 5 ? '...' : ''}`);
      
      if (subcategoryInfo.existingPages.pages.includes(CONFIG.startPage)) {
        console.log(`WARNING: Start page ${CONFIG.startPage} already exists in storage.`);
      }
    } else {
      console.log('No existing pages found.');
    }
    
    // Start scraping
    console.log('\nStarting scrape...');
    const result = await scrapeSubcategory(CONFIG.subcategory, CONFIG.startPage, CONFIG.maxPages);
    
    console.log('\nScraping completed!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

/**
 * Get information about a subcategory
 * @param {string} subcategoryName - Name of the subcategory
 * @returns {Promise<Object>} - Subcategory information
 */
async function getSubcategoryInfo(subcategoryName) {
  try {
    const response = await axios.get(`${API_BASE_URL}/furniture/info/${encodeURIComponent(subcategoryName)}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting subcategory info: ${error.message}`);
    throw error;
  }
}

/**
 * Scrape a specific furniture subcategory
 * @param {string} subcategoryName - Name of the subcategory
 * @param {number} startPage - Starting page number
 * @param {number} maxPages - Maximum number of pages to scrape
 * @returns {Promise<Object>} - Scraping results
 */
async function scrapeSubcategory(subcategoryName, startPage = 1, maxPages = 10) {
  try {
    const params = {
      startPage,
      maxPages,
      fetchAllPages: 'true'
    };
    
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${API_BASE_URL}/furniture/scrape/${encodeURIComponent(subcategoryName)}?${queryString}`;
    console.log(`Making request to: ${url}`);
    
    const startTime = Date.now();
    const response = await axios.get(url);
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`Request completed in ${duration.toFixed(1)} seconds`);
    return response.data;
  } catch (error) {
    console.error(`Error scraping subcategory: ${error.message}`);
    throw error;
  }
}

/**
 * List all available furniture subcategories
 * @returns {Promise<Array>} - List of subcategories
 */
async function listSubcategories() {
  try {
    const response = await axios.get(`${API_BASE_URL}/furniture/list`);
    return response.data.subcategories;
  } catch (error) {
    console.error(`Error listing subcategories: ${error.message}`);
    throw error;
  }
}

// Run the main function
main().catch(console.error); 