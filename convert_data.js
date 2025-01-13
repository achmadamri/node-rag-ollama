import fs from 'fs';

// Function to extract articles from the raw text
function extractArticles(rawText) {
    const articles = [];
    const lines = rawText.split('\n');
    let currentArticle = '';

    for (let line of lines) {
        line = line.trim();
        
        // Skip empty lines
        if (!line) continue;

        // If we find a new article marker, save the previous one and start a new one
        if (line.startsWith('--- Article')) {
            if (currentArticle) {
                articles.push(currentArticle.trim());
            }
            currentArticle = '';
            continue;
        }

        // Skip lines that are just markers or don't contain content
        if (line.startsWith('Page Title:') || 
            line.startsWith('URL:') || 
            line.startsWith('Articles Found:') ||
            line.match(/^\d+ Komentar/)) {
            continue;
        }

        // Add the line to current article
        if (currentArticle) {
            currentArticle += ' ';
        }
        currentArticle += line;
    }

    // Don't forget to add the last article
    if (currentArticle) {
        articles.push(currentArticle.trim());
    }

    return articles;
}

// Read the input file
const inputFile = './crawled_data/www.detik.com-1736517785601.txt';
const outputFile = './crawled_data/processed_articles.json';

try {
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const articles = extractArticles(rawData);
    
    // Create the output format
    const output = {
        documents: articles.map(article => article.replace(/\s+/g, ' ').trim())
    };

    // Write to output file
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`Successfully processed ${articles.length} articles and saved to ${outputFile}`);
} catch (error) {
    console.error('Error processing file:', error);
}
