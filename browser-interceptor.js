// Invaluable API Interceptor with Pagination Support
// Run this in browser console on Invaluable site
(function() {
    // Keep track of intercepted pages
    window.interceptedPages = window.interceptedPages || {};
    
    // Check if already running
    if (window.invaluableInterceptorActive) {
        console.log('🔍 Interceptor already active');
        return;
    }
    
    window.invaluableInterceptorActive = true;
    window.apiEndpoint = 'https://valuer-dev-856401495068.us-central1.run.app/api/search';
    
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch(...args);
        
        // Clone the response so we can read it multiple times
        const clone = response.clone();
        
        // Check if it's a catResults API call
        if (response.url.includes('catResults')) {
            try {
                console.log('Intercepted catResults API call');
                const data = await clone.json();
                
                // Try to determine current page
                let pageNum = 'unknown';
                try {
                    const url = new URL(window.location.href);
                    pageNum = url.searchParams.get('page') || '1';
                } catch (e) {}
                
                // Store this page
                window.interceptedPages[pageNum] = data;
                
                console.log(`📄 Page ${pageNum} data intercepted with ${data?.results?.[0]?.hits?.length || 0} items`);
                console.log('Pages collected:', Object.keys(window.interceptedPages).sort());
                console.log('Total items:', getTotalItems());
                
                // Add visual feedback
                showInterceptionNotification(pageNum, data);
            } catch (e) {
                console.error('Error intercepting API data:', e);
            }
        }
        
        return response;
    };
    
    // Get all pages
    window.getAllInterceptedPages = function() {
        return Object.values(window.interceptedPages);
    };
    
    // Calculate total items across all pages
    function getTotalItems() {
        return Object.values(window.interceptedPages).reduce((sum, page) => 
            sum + (page?.results?.[0]?.hits?.length || 0), 0);
    }
    
    // Export all pages as JSON string
    window.exportAllPages = function() {
        const pages = Object.values(window.interceptedPages);
        if (pages.length === 0) {
            console.log("No pages collected yet");
            return null;
        }
        
        // Combine the pages
        let combined = JSON.parse(JSON.stringify(pages[0]));
        for (let i = 1; i < pages.length; i++) {
            if (pages[i]?.results?.[0]?.hits) {
                combined.results[0].hits = [
                    ...combined.results[0].hits,
                    ...pages[i].results[0].hits
                ];
            }
        }
        
        // Update metadata
        if (combined.results?.[0]?.meta) {
            combined.results[0].meta.totalHits = combined.results[0].hits.length;
        }
        
        console.log(`Combined ${pages.length} pages with total ${combined.results[0].hits.length} items`);
        return combined;
    };
    
    // Send all collected data to the API
    window.sendToAPI = async function(endpoint = `${window.apiEndpoint}/combine-pages`) {
        const combinedData = window.exportAllPages();
        if (!combinedData) return;
        
        try {
            // Get search parameters from URL
            const url = new URL(window.location.href);
            const searchParams = {};
            for (const [key, value] of url.searchParams.entries()) {
                searchParams[key] = value;
            }
            
            console.log(`Sending data to ${endpoint}...`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pages: Object.values(window.interceptedPages),
                    searchParams
                })
            });
            
            const result = await response.json();
            console.log('API Response:', result);
            return result;
        } catch (error) {
            console.error('Error sending to API:', error);
        }
    };
    
    // Clear collected pages
    window.clearInterceptedPages = function() {
        window.interceptedPages = {};
        console.log('Cleared all intercepted pages');
    };
    
    // Shows a visual notification for the intercepted page
    function showInterceptionNotification(pageNum, data) {
        // Create notification div if it doesn't exist
        let notificationContainer = document.getElementById('invaluable-interceptor-notification');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'invaluable-interceptor-notification';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
                width: 300px;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification for this page
        const notification = document.createElement('div');
        const itemCount = data?.results?.[0]?.hits?.length || 0;
        const totalPages = Object.keys(window.interceptedPages).length;
        const totalItems = getTotalItems();
        
        notification.style.cssText = `
            background-color: #4CAF50;
            color: white;
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            animation: fadeIn 0.3s, fadeOut 0.5s 5s forwards;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong>Page ${pageNum} Intercepted</strong>
                <span onclick="this.parentNode.parentNode.remove()" style="cursor: pointer;">✖</span>
            </div>
            <div>Items on page: ${itemCount}</div>
            <div>Total pages: ${totalPages}</div>
            <div>Total items: ${totalItems}</div>
        `;
        
        notificationContainer.prepend(notification);
        
        // Remove notification after 6 seconds
        setTimeout(() => {
            notification.remove();
        }, 6000);
    }
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    console.log(`
    🔍 Invaluable API Interceptor activated! Available commands:
    
    window.getAllInterceptedPages()   - Get all collected pages as array
    window.exportAllPages()           - Combine and export all pages
    window.sendToAPI()                - Send combined data to API
    window.clearInterceptedPages()    - Clear all collected pages
    
    Collected pages: ${Object.keys(window.interceptedPages).length}
    API endpoint: ${window.apiEndpoint}
    `);
})(); 