const axios = require('axios');
const https = require('https');
const tough = require('tough-cookie');

class HttpClient {
    constructor(config) {
        this.baseUrl = config.environment.baseUrl;
        this.username = config.environment.username;
        this.password = config.environment.password;
        this.timeout = config.options.timeout || 30000;
        this.maxRetries = config.options.maxRetries || 2;
        this.cookieJar = new tough.CookieJar();
        this.isAuthenticated = false;

        // Create axios instance with custom config
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            httpsAgent: new https.Agent({
                rejectUnauthorized: config.options.strictSSL !== false
            }),
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });

        // Add request interceptor for cookies
        this.client.interceptors.request.use(
            (config) => {
                const cookies = this.cookieJar.getCookieStringSync(this.baseUrl);
                if (cookies) {
                    config.headers.Cookie = cookies;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Add response interceptor for cookies
        this.client.interceptors.response.use(
            (response) => {
                const setCookies = response.headers['set-cookie'];
                if (setCookies) {
                    setCookies.forEach(cookie => {
                        this.cookieJar.setCookieSync(cookie, this.baseUrl);
                    });
                }
                return response;
            },
            (error) => Promise.reject(error)
        );
    }

    async authenticate() {
        try {
            console.log('Authenticating with server...');
            
            // Try to fetch a basic endpoint to test if authentication is needed
            // Adjust this based on your actual authentication flow
            const testResponse = await this.client.get('/');
            
            // If we get redirected to login or get 401/403, we need to authenticate
            if (testResponse.status === 401 || testResponse.status === 403) {
                // Implement your actual authentication logic here
                // This might be:
                // 1. Form-based login
                // 2. Basic Auth
                // 3. Token-based auth
                
                // Example for form-based login:
                const loginResponse = await this.client.post('/system/sling/login', 
                    new URLSearchParams({
                        'j_username': this.username,
                        'j_password': this.password,
                        'j_validate': 'true'
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                if (loginResponse.status === 200) {
                    console.log('Authentication successful');
                    this.isAuthenticated = true;
                } else {
                    throw new Error('Authentication failed');
                }
            } else {
                console.log('Already authenticated or no authentication required');
                this.isAuthenticated = true;
            }

            return true;
        } catch (error) {
            console.error('Authentication error:', error.message);
            // For testing purposes, continue even if auth fails
            // Remove this in production
            this.isAuthenticated = true;
            return true;
        }
    }

    async fetch(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : this.baseUrl + url;
        let lastError;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const startTime = Date.now();
                
                const response = await this.client.get(url, {
                    ...options,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'API-Comparison-Tool/1.0',
                        ...options.headers
                    }
                });

                const endTime = Date.now();
                const responseTime = endTime - startTime;

                return {
                    status: response.status,
                    data: response.data,
                    responseTime,
                    success: response.status >= 200 && response.status < 300,
                    headers: response.headers
                };
            } catch (error) {
                lastError = error;
                
                if (attempt < this.maxRetries) {
                    console.log(`  Retry attempt ${attempt + 1}/${this.maxRetries} for ${url}`);
                    await this.sleep(1000 * (attempt + 1)); // Exponential backoff
                }
            }
        }

        // All retries failed
        return {
            status: lastError.response?.status || 500,
            data: lastError.response?.data || { error: lastError.message },
            responseTime: 0,
            success: false,
            error: lastError.message
        };
    }

    async fetchJson(url) {
        const response = await this.fetch(url);
        
        if (response.success && response.data) {
            // If response is already parsed JSON, return it
            if (typeof response.data === 'object') {
                return response;
            }
            
            // If response is string, try to parse it
            if (typeof response.data === 'string') {
                try {
                    response.data = JSON.parse(response.data);
                } catch (e) {
                    console.error('Failed to parse JSON response:', e.message);
                }
            }
        }

        return response;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    close() {
        // Clean up resources if needed
        this.isAuthenticated = false;
    }
}

module.exports = HttpClient;
