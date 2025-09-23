#!/usr/bin/env node

/**
 * Blog CLI - Complete Blog Publishing System
 * 
 * This script provides commands to generate and publish blogs from the raw/ directory
 * 
 * Usage: 
 *   node blog-cli.js generate  - Process raw blogs and generate necessary files
 *   node blog-cli.js publish   - Generate files and publish to GitHub
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const RAW_DIR = './raw';
const BLOG_DIR = './blog';
const STATIC_BLOG_DIR = './static-blog';
const BLOG_INDEX_FILE = './blog-index.json';

// Default category configurations
const DEFAULT_CATEGORIES = {
    technical: { name: 'Technical', description: 'Programming, tutorials, technical insights', color: 'blue' },
    philosophical: { name: 'Philosophical', description: 'Deep thoughts, ethics, life reflections', color: 'purple' },
    random: { name: 'Random Thoughts', description: 'Casual observations, personal musings', color: 'green' },
    personal: { name: 'Personal', description: 'Personal experiences and stories', color: 'pink' },
    tutorials: { name: 'Tutorials', description: 'Step-by-step guides and how-tos', color: 'indigo' },
    reviews: { name: 'Reviews', description: 'Book reviews, tool reviews, and opinions', color: 'yellow' },
    adventure: { name: 'Adventure', description: 'Travel stories, outdoor adventures, and explorations', color: 'orange' },
    business: { name: 'Business', description: 'Startup insights, product strategy, and business philosophy', color: 'green' }
};

/**
 * Calculate reading time for markdown content
 * @param {string} content - The markdown content
 * @returns {string} - Formatted reading time (e.g., "5 min read")
 */
function calculateReadTime(content) {
    // Remove frontmatter
    const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    
    // Remove markdown syntax for word count
    const plainText = contentWithoutFrontmatter
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove inline code
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();
    
    // Count words (split by whitespace and filter out empty strings)
    const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;
    
    // Average reading speed: 200-250 words per minute
    // Using 225 as a middle ground
    const readingTimeMinutes = Math.ceil(wordCount / 225);
    
    return `${readingTimeMinutes} min read`;
}

/**
 * Parse markdown frontmatter
 * @param {string} content - The markdown content with frontmatter
 * @returns {object} - Object with frontmatter and content
 */
function parseMarkdownFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: {}, content };
    }
    
    const frontmatterText = match[1];
    const markdownContent = match[2];
    
    const frontmatter = {};
    frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            // Parse arrays
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => 
                    item.trim().replace(/['"]/g, '')
                );
            }
            
            frontmatter[key] = value;
        }
    });
    
    return { frontmatter, content: markdownContent };
}

/**
 * Generate a URL-friendly slug from title
 * @param {string} title - The blog title
 * @returns {string} - URL-friendly slug
 */
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .trim();
}

/**
 * Process a single blog file from raw directory
 * @param {string} filePath - Path to the raw blog file
 * @returns {object} - Processed blog data
 */
function processRawBlog(filePath) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const { frontmatter, content: markdownContent } = parseMarkdownFrontmatter(content);
    
    // Validate required fields
    if (!frontmatter.title) {
        throw new Error(`Missing title in ${fileName}`);
    }
    
    if (!frontmatter.category) {
        throw new Error(`Missing category in ${fileName}`);
    }
    
    if (!frontmatter.date) {
        throw new Error(`Missing date in ${fileName}`);
    }
    
    // Generate slug from title if not provided
    const slug = frontmatter.slug || generateSlug(frontmatter.title);
    
    // Calculate read time if not provided
    const readTime = frontmatter.readTime || calculateReadTime(content);
    
    // Create updated frontmatter with read time
    const updatedFrontmatter = {
        ...frontmatter,
        readTime: readTime
    };
    
    // Generate frontmatter string
    const frontmatterString = Object.entries(updatedFrontmatter)
        .map(([key, value]) => {
            if (Array.isArray(value)) {
                return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
            }
            return `${key}: "${value}"`;
        })
        .join('\n');
    
    // Create final content with updated frontmatter
    const finalContent = `---\n${frontmatterString}\n---\n\n${markdownContent}`;
    
    return {
        slug,
        category: frontmatter.category,
        content: finalContent,
        frontmatter: updatedFrontmatter
    };
}

/**
 * Process all blogs from raw directory
 */
function processRawBlogs() {
    console.log('🔍 Scanning raw blog directory...');
    
    if (!fs.existsSync(RAW_DIR)) {
        console.log(`📁 Creating raw directory: ${RAW_DIR}`);
        fs.mkdirSync(RAW_DIR, { recursive: true });
        return;
    }
    
    const rawFiles = fs.readdirSync(RAW_DIR)
        .filter(file => file.endsWith('.md'));
    
    if (rawFiles.length === 0) {
        console.log('📝 No markdown files found in raw directory');
        return;
    }
    
    console.log(`📝 Found ${rawFiles.length} blog(s) to process:`);
    
    const processedBlogs = [];
    
    rawFiles.forEach(file => {
        const filePath = path.join(RAW_DIR, file);
        console.log(`  📄 Processing: ${file}`);
        
        try {
            const blogData = processRawBlog(filePath);
            processedBlogs.push({ file, ...blogData });
            console.log(`    ✓ Processed: ${blogData.slug} (${blogData.category})`);
        } catch (error) {
            console.error(`    ❌ Error processing ${file}: ${error.message}`);
        }
    });
    
    return processedBlogs;
}

/**
 * Move processed blogs to blog directory
 * @param {array} processedBlogs - Array of processed blog data
 */
function moveBlogsToDirectory(processedBlogs) {
    console.log('\n📁 Moving blogs to blog directory...');
    
    // Ensure blog directory exists
    if (!fs.existsSync(BLOG_DIR)) {
        fs.mkdirSync(BLOG_DIR, { recursive: true });
    }
    
    processedBlogs.forEach(({ file, slug, category, content }) => {
        // Normalize category to lowercase for directory structure
        const normalizedCategory = category.toLowerCase();
        
        // Create category directory if it doesn't exist
        const categoryDir = path.join(BLOG_DIR, normalizedCategory);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
            console.log(`  📁 Created category directory: ${normalizedCategory}`);
        }
        
        // Write blog file
        const blogFilePath = path.join(categoryDir, `${slug}.md`);
        fs.writeFileSync(blogFilePath, content);
        console.log(`  ✓ Moved: ${file} → blog/${normalizedCategory}/${slug}.md`);
        
        // Remove from raw directory
        const rawFilePath = path.join(RAW_DIR, file);
        fs.unlinkSync(rawFilePath);
        console.log(`  🗑️  Removed: raw/${file}`);
    });
}

/**
 * Generate blog index (reuse existing logic)
 */
function generateBlogIndex() {
    console.log('\n🔍 Generating blog index...');
    
    if (!fs.existsSync(BLOG_DIR)) {
        console.error(`Blog directory ${BLOG_DIR} does not exist!`);
        return;
    }
    
    // Create static blog directory if it doesn't exist
    if (!fs.existsSync(STATIC_BLOG_DIR)) {
        fs.mkdirSync(STATIC_BLOG_DIR, { recursive: true });
    }
    
    const categories = {};
    const posts = [];
    
    const categoryDirs = fs.readdirSync(BLOG_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    console.log(`Found categories: ${categoryDirs.join(', ')}`);
    
    categoryDirs.forEach(categoryDir => {
        const categoryPath = path.join(BLOG_DIR, categoryDir);
        const staticCategoryPath = path.join(STATIC_BLOG_DIR, categoryDir);
        
        // Create static category directory
        if (!fs.existsSync(staticCategoryPath)) {
            fs.mkdirSync(staticCategoryPath, { recursive: true });
        }
        
        // Set up category configuration
        categories[categoryDir] = DEFAULT_CATEGORIES[categoryDir] || {
            name: categoryDir.charAt(0).toUpperCase() + categoryDir.slice(1),
            description: `Posts about ${categoryDir}`,
            color: 'gray'
        };
        
        // Scan for markdown files
        const files = fs.readdirSync(categoryPath)
            .filter(file => file.endsWith('.md'));
        
        console.log(`  ${categoryDir}: ${files.length} post(s)`);
        
        // Copy image directories if they exist
        const allItems = fs.readdirSync(categoryPath, { withFileTypes: true });
        const imageDirs = allItems.filter(dirent => dirent.isDirectory() && dirent.name.startsWith('images-'));
        
        imageDirs.forEach(imageDir => {
            const sourceDirPath = path.join(categoryPath, imageDir.name);
            const targetDirPath = path.join(staticCategoryPath, imageDir.name);
            
            try {
                // Create target image directory
                if (!fs.existsSync(targetDirPath)) {
                    fs.mkdirSync(targetDirPath, { recursive: true });
                }
                
                // Copy all image files
                const imageFiles = fs.readdirSync(sourceDirPath);
                imageFiles.forEach(imageFile => {
                    const sourceFilePath = path.join(sourceDirPath, imageFile);
                    const targetFilePath = path.join(targetDirPath, imageFile);
                    
                    fs.copyFileSync(sourceFilePath, targetFilePath);
                });
                
                console.log(`    📁 Copied ${imageDir.name} directory (${imageFiles.length} files)`);
            } catch (error) {
                console.warn(`    ⚠ Failed to copy ${imageDir.name}: ${error.message}`);
            }
        });
        
        files.forEach(file => {
            const filePath = path.join(categoryPath, file);
            const staticFileName = file.replace('.md', '.txt');
            const staticFilePath = path.join(staticCategoryPath, staticFileName);
            const relativePath = path.join('static-blog', categoryDir, staticFileName).replace(/\\/g, '/');
            
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Copy file to static directory with .txt extension
                fs.writeFileSync(staticFilePath, content);
                
                const { frontmatter } = parseMarkdownFrontmatter(content);
                
                const postId = path.basename(file, '.md');
                
                posts.push({
                    id: postId,
                    category: categoryDir,
                    file: relativePath,
                    // Include metadata for easier debugging
                    title: frontmatter.title || postId,
                    date: frontmatter.date || new Date().toISOString().split('T')[0]
                });
                
                console.log(`    ✓ ${file} -> ${staticFileName} (${frontmatter.title || 'No title'})`);
            } catch (error) {
                console.warn(`    ⚠ Failed to parse ${file}: ${error.message}`);
            }
        });
    });
    
    // Sort posts by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const blogIndex = {
        categories,
        posts: posts.map(({ title, date, ...post }) => post) // Remove metadata
    };
    
    console.log(`\n📝 Generated index with ${Object.keys(categories).length} categories and ${posts.length} posts`);
    
    // Write to file
    fs.writeFileSync(BLOG_INDEX_FILE, JSON.stringify(blogIndex, null, 2));
    console.log(`✅ Blog index written to ${BLOG_INDEX_FILE}`);
    
    // Show summary
    console.log('\n📊 Summary:');
    Object.entries(categories).forEach(([key, category]) => {
        const count = posts.filter(p => p.category === key).length;
        console.log(`  ${category.name}: ${count} post(s)`);
    });
}

/**
 * Publish to GitHub
 */
function publishToGitHub() {
    console.log('\n🚀 Publishing to GitHub...');
    
    try {
        // Check if we're in a git repository
        execSync('git status', { stdio: 'pipe' });
        
        // Add all changes
        execSync('git add .', { stdio: 'inherit' });
        
        // Check if there are changes to commit
        try {
            const status = execSync('git status --porcelain', { encoding: 'utf8' });
            if (!status.trim()) {
                console.log('📝 No changes to commit');
                return;
            }
        } catch (error) {
            // This is expected if there are no changes
        }
        
        // Commit changes
        const commitMessage = `Blog update: ${new Date().toISOString().split('T')[0]}`;
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        
        // Push to GitHub
        execSync('git push origin main', { stdio: 'inherit' });
        
        console.log('✅ Successfully published to GitHub!');
        
    } catch (error) {
        console.error('❌ Error publishing to GitHub:', error.message);
        console.log('💡 Make sure you have:');
        console.log('   - Git repository initialized');
        console.log('   - Remote origin configured');
        console.log('   - Proper GitHub authentication');
    }
}

/**
 * Generate command - Process raw blogs and generate necessary files
 */
function generateCommand() {
    console.log('🎯 Blog Generate Command');
    console.log('========================\n');
    
    try {
        // Process raw blogs
        const processedBlogs = processRawBlogs();
        
        if (processedBlogs && processedBlogs.length > 0) {
            // Move blogs to blog directory
            moveBlogsToDirectory(processedBlogs);
        }
        
        // Generate blog index
        generateBlogIndex();
        
        console.log('\n✅ Blog generation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during blog generation:', error.message);
        process.exit(1);
    }
}

/**
 * Publish command - Generate files and publish to GitHub
 */
function publishCommand() {
    console.log('🚀 Blog Publish Command');
    console.log('=======================\n');
    
    try {
        // First run generate command
        generateCommand();
        
        // Then publish to GitHub
        publishToGitHub();
        
        console.log('\n🎉 Blog publishing completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during blog publishing:', error.message);
        process.exit(1);
    }
}

/**
 * Main CLI function
 */
function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'generate':
            generateCommand();
            break;
        case 'publish':
            publishCommand();
            break;
        default:
            console.log('📝 Blog CLI - Complete Blog Publishing System');
            console.log('============================================\n');
            console.log('Usage:');
            console.log('  node blog-cli.js generate  - Process raw blogs and generate necessary files');
            console.log('  node blog-cli.js publish   - Generate files and publish to GitHub\n');
            console.log('Commands:');
            console.log('  generate  - Process all .md files from raw/ directory');
            console.log('            - Calculate read time automatically');
            console.log('            - Move to appropriate blog/ category directory');
            console.log('            - Generate blog-index.json');
            console.log('            - Create static-blog/ files\n');
            console.log('  publish   - Run generate command + publish to GitHub');
            console.log('            - Git add, commit, and push changes\n');
            console.log('Requirements for raw blog files:');
            console.log('  - Must be .md files in raw/ directory');
            console.log('  - Must have frontmatter with: title, category, date');
            console.log('  - Optional: excerpt, tags, slug');
            console.log('  - readTime will be calculated automatically if not provided\n');
            break;
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    calculateReadTime,
    parseMarkdownFrontmatter,
    generateSlug,
    processRawBlog,
    processRawBlogs,
    moveBlogsToDirectory,
    generateBlogIndex,
    publishToGitHub
};
