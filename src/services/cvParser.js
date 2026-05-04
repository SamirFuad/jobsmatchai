const pdf = require('pdf-parse');

/**
 * Extract text from a PDF buffer.
 */
async function extractTextFromPdf(buffer) {
  try {
    const data = await pdf(buffer);
    return cleanText(data.text || '');
  } catch (err) {
    throw new Error(`Failed to parse PDF: ${err.message}`);
  }
}

/**
 * Clean and normalize extracted text.
 */
function cleanText(text) {
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ');
  // Remove special characters but keep basic punctuation
  text = text.replace(/[^\w\s.,;:!?@/\\()\-+#&]/g, '');
  // Remove non-ASCII characters
  text = text.replace(/[^\x00-\x7F]/g, '');
  return text.trim();
}

/**
 * Extract email address from text.
 */
function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/**
 * Extract years of experience using regex patterns.
 */
function extractExperienceYears(text) {
  const patterns = [
    /(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)/gi,
    /experience\s*:?\s*(\d+)\+?\s*years?/gi,
    /(\d+)\+?\s*years?\s*(?:in\s+)?(?:the\s+)?(?:industry|field|sector)/gi,
    /over\s+(\d+)\s*years?/gi,
    /more\s+than\s+(\d+)\s*years?/gi,
  ];

  let maxYears = null;
  const textLower = text.toLowerCase();

  for (const pattern of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(textLower)) !== null) {
      const years = parseInt(match[1], 10);
      if (years > 0 && years <= 50) {
        if (maxYears === null || years > maxYears) {
          maxYears = years;
        }
      }
    }
  }

  return maxYears;
}

/**
 * Extract highest education level from text.
 */
function extractEducation(text) {
  const textLower = text.toLowerCase();

  const educationLevels = [
    ['phd', 'PhD'],
    ['ph.d', 'PhD'],
    ['doctorate', 'PhD'],
    ['master', "Master's"],
    ['msc', "Master's"],
    ['m.sc', "Master's"],
    ['mba', "Master's"],
    ['m.s.', "Master's"],
    ['bachelor', "Bachelor's"],
    ['bsc', "Bachelor's"],
    ['b.sc', "Bachelor's"],
    ['b.s.', "Bachelor's"],
    ['b.a.', "Bachelor's"],
    ['diploma', 'Diploma'],
    ['associate', 'Associate'],
    ['certificate', 'Certificate'],
  ];

  for (const [keyword, level] of educationLevels) {
    if (textLower.includes(keyword)) {
      return level;
    }
  }

  return null;
}

module.exports = {
  extractTextFromPdf,
  cleanText,
  extractEmail,
  extractExperienceYears,
  extractEducation,
};
