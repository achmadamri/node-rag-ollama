import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });
        const $ = cheerio.load(response.data);
        
        // Find the main article content
        // Try different selectors that might contain the main content
        const contentSelectors = [
            'div.detail__body-text',    // Detik article content
            'div.itp_bodycontent',      // Alternative Detik selector
            'div.article-content',      // Generic article content
            'div.content-text',         // Another common selector
            'article'                   // Fallback
        ];
        
        let content = '';
        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                // Remove unwanted elements
                element.find('script, style, iframe, .ads, .advertisement').remove();
                
                // Get the text and clean it up
                content = element.text()
                    .trim()
                    // Replace multiple spaces/newlines with single space
                    .replace(/\s+/g, ' ')
                    // Clean up punctuation
                    .replace(/\s+([.,!?])/g, '$1')
                    .replace(/([.,!?])([^\s])/g, '$1 $2')
                    // Remove any remaining special characters
                    .replace(/[^\w\s.,!?-]/g, '')
                    .trim();
                
                break;
            }
        }
        
        return content;
    } catch (error) {
        console.error(`Error fetching article content from ${url}:`, error.message);
        return '';
    }
}

async function crawlWebsite(url, outputDir = 'crawled_data') {
    try {
        // Create output directory if it doesn't exist
        const outputPath = path.join(__dirname, outputDir);
        await fs.mkdir(outputPath, { recursive: true });

        // Fetch the webpage
        console.log(`Crawling main page: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            }
        });
        const $ = cheerio.load(response.data);

        // Extract news articles
        const articles = [];
        const articlePromises = [];
        
        // Find articles using multiple selectors
        const articleSelectors = [
            'article',
            '.article-box',
            '.news-item',
            '.l_content article',  // Detik specific
            '[data-component-name="newsfeed-item"]' // Another Detik specific
        ];
        
        for (const selector of articleSelectors) {
            $(selector).each((i, element) => {
                const $element = $(element);
                
                // Try multiple selectors for title and link
                const titleSelectors = ['h1', 'h2', 'h3', '.title', '.article-title'];
                const linkSelectors = ['a', 'a.article-link', 'a.title-link'];
                
                let articleTitle = '';
                let articleLink = '';
                
                // Find title
                for (const titleSelector of titleSelectors) {
                    const titleElement = $element.find(titleSelector).first();
                    if (titleElement.length > 0) {
                        articleTitle = titleElement.text().trim();
                        break;
                    }
                }
                
                // Find link
                for (const linkSelector of linkSelectors) {
                    const linkElement = $element.find(linkSelector).first();
                    if (linkElement.length > 0) {
                        articleLink = linkElement.attr('href');
                        if (articleLink && !articleLink.startsWith('http')) {
                            articleLink = new URL(articleLink, url).toString();
                        }
                        break;
                    }
                }
                
                if (articleTitle && articleLink) {
                    // Create promise for fetching article content
                    const promise = fetchArticleContent(articleLink).then(content => {
                        if (content) {
                            articles.push({
                                title: articleTitle,
                                link: articleLink,
                                content: content
                            });
                        }
                    });
                    articlePromises.push(promise);
                }
            });
        }
        
        // Wait for all article content to be fetched
        console.log('Fetching article contents...');
        await Promise.all(articlePromises);
        console.log(`Found ${articles.length} articles with content`);

        // Create filename from URL
        const filename = `${new URL(url).hostname}-${Date.now()}.txt`;
        const filePath = path.join(outputPath, filename);

        // Format content as text
        const content = `Page URL: ${url}
Total Articles Found: ${articles.length}
Crawled at: ${new Date().toISOString()}

${articles.map((article, index) => {
    return `--- Article ${index + 1} ---
Title: ${article.title}
Link: ${article.link}
Content: ${article.content}
`;
}).join('\n')}`;

        // Write to file in text format
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`Data saved to: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Error during crawling:', error);
        throw error;
    }
}

// Example usage
const url = 'https://www.detik.com/'; // Changed to a more accessible news site
crawlWebsite(url)
    .then(filePath => console.log('Crawling completed successfully!'))
    .catch(error => console.error('Crawling failed:', error));
