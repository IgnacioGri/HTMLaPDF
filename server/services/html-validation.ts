// HTML validation service to prevent malformed content issues
export function validateHtml(htmlContent: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic structure validation
  if (!htmlContent.includes('<html') && !htmlContent.includes('<body')) {
    errors.push('Missing basic HTML structure (html/body tags)');
  }
  
  // Check for unclosed tags that could cause Puppeteer issues
  const openTags = htmlContent.match(/<[^/][^>]*>/g) || [];
  const closeTags = htmlContent.match(/<\/[^>]*>/g) || [];
  
  if (openTags.length > closeTags.length + 10) { // Allow some self-closing tags
    errors.push('Potentially unclosed HTML tags detected');
  }
  
  // Check for problematic content that might hang Puppeteer
  if (htmlContent.includes('document.write') || htmlContent.includes('document.open')) {
    errors.push('Potentially problematic JavaScript detected');
  }
  
  // Check for extremely large inline styles that might slow processing
  const largeInlineStyles = htmlContent.match(/style="[^"]{1000,}"/g);
  if (largeInlineStyles && largeInlineStyles.length > 0) {
    errors.push('Extremely large inline styles detected - may cause performance issues');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeHtml(htmlContent: string): string {
  return htmlContent
    // Remove potentially problematic JavaScript
    .replace(/document\.write\s*\([^)]*\)/g, '')
    .replace(/document\.open\s*\([^)]*\)/g, '')
    .replace(/window\.location\s*=/g, '// window.location=')
    // Clean up problematic CSS that might cause issues
    .replace(/position:\s*fixed/gi, 'position: static')
    .replace(/position:\s*sticky/gi, 'position: static')
    // Remove potential infinite loops in CSS
    .replace(/@media[^{]*\{[^}]*\}/g, '')
    .replace(/animation:\s*[^;]+;/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}