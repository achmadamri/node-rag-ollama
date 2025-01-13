import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure axios with retry logic
axios.defaults.timeout = 10000; // 10 seconds timeout
axios.defaults.maxRedirects = 5;

const DETIK_SECTIONS = [
    // 'https://www.detik.com',
    'https://news.detik.com',
    // 'https://finance.detik.com',
    // 'https://hot.detik.com',
    // 'https://sport.detik.com',
    // 'https://health.detik.com'
];

async function fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                }
            });
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

async function getArticleContent(url) {
    try {
        console.log(`Fetching article: ${url}`);
        const response = await fetchWithRetry(url);
        const $ = cheerio.load(response.data);
        
        // Remove unwanted elements
        $('script, style, iframe, .ads, .advertisement, .social-share, .related-articles').remove();
        
        // Try different content selectors specific to Detik
        const contentSelectors = [
            'div.detail__body-text',
            'div.itp_bodycontent',
            'div.detail__body',
            'div.detail-text',
            'article'
        ];
        
        let content = '';
        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                content = element.text()
                    .trim()
                    .replace(/\s+/g, ' ')
                    .replace(/\s+([.,!?])/g, '$1')
                    .replace(/([.,!?])([^\s])/g, '$1 $2')
                    .replace(/[^\w\s.,!?-]/g, '')
                    .trim();
                break;
            }
        }
        
        // Get article metadata
        const title = $('h1.detail__title, h1.title, .article-title').first().text().trim();
        const date = $('div.detail__date, .date').first().text().trim();
        
        return {
            title,
            date,
            content,
            url
        };
    } catch (error) {
        console.error(`Error fetching article from ${url}:`, error.message);
        return null;
    }
}

async function getArticleLinks(url) {
    try {
        console.log(`Scanning section: ${url}`);
        const response = await fetchWithRetry(url);
        const $ = cheerio.load(response.data);
        const links = new Set();
        
        // Detik-specific article link selectors
        const articleSelectors = [
            'article a',
            '.list-content a',
            '.media__link',
            '.media__title a',
            'h2 a, h3 a'
        ];
        
        articleSelectors.forEach(selector => {
            $(selector).each((_, element) => {
                const link = $(element).attr('href');
                if (link && link.includes('detik.com') && !link.includes('#')) {
                    links.add(link);
                }
            });
        });
        
        return Array.from(links);
    } catch (error) {
        console.error(`Error getting article links from ${url}:`, error.message);
        return [];
    }
}

async function scrapeDetikNews(outputDir = 'crawled_data') {
    try {
        // Create output directory
        const outputPath = path.join(__dirname, outputDir);
        await fs.mkdir(outputPath, { recursive: true });
        
        // Get article links from all sections
        const allLinks = new Set();
        for (const section of DETIK_SECTIONS) {
            const links = await getArticleLinks(section);
            links.forEach(link => allLinks.add(link));
        }
        
        console.log(`Found ${allLinks.size} unique articles`);
        
        // Fetch and process articles
        const articles = [];
        let counter = 0;
        
        for (const link of allLinks) {
            counter++;
            console.log(`Processing article ${counter} of ${allLinks.size}`);
            
            const article = await getArticleContent(link);
            if (article && article.content.length > 100) { // Only include articles with substantial content
                articles.push(article);
            }
            
            // Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Save to file
        const timestamp = Date.now();
        const filename = `detik-news-${timestamp}.txt`;
        const filePath = path.join(outputPath, filename);
        
        const content = `Page URL: ${DETIK_SECTIONS.join(', ')}
Total Articles Found: ${articles.length}
Crawled at: ${new Date().toISOString()}

${articles.map((article, index) => {
    return `--- Article ${index + 1} ---
Title: ${article.title}
Link: ${article.url}
Date: ${article.date}
Content: ${article.content}
`;
}).join('\n')}`;
        
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Data saved to: ${filePath}`);
        return filePath;
        
    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    }
}

// Run the scraper
scrapeDetikNews()
    .then(filePath => console.log('Scraping completed successfully!'))
    .catch(error => console.error('Scraping failed:', error));
