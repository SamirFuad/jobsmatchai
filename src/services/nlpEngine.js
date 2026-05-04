const fs = require('fs');
const path = require('path');
const {
  extractTextFromPdf,
  extractEmail,
  extractExperienceYears,
  extractEducation,
} = require('./cvParser');

const SKILLS_DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'skills_database.json');

/**
 * Load the curated skills database from JSON.
 */
function loadSkillsDatabase() {
  try {
    const raw = fs.readFileSync(SKILLS_DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      programming: [], frameworks: [], databases: [],
      cloud: [], soft_skills: [], data_science: [], tools: [],
    };
  }
}

/**
 * Get flat list of { name, category } objects.
 */
function getAllSkillsFlat() {
  const db = loadSkillsDatabase();
  const skills = [];
  for (const [category, skillList] of Object.entries(db)) {
    for (const skill of skillList) {
      skills.push({ name: skill, category });
    }
  }
  return skills;
}

/**
 * Extract skills from text using keyword matching.
 * Uses lookahead/lookbehind boundaries for ALL skills to prevent
 * false positives (e.g. "Java" matching inside "JavaScript").
 */
function extractSkillsFromText(text) {
  const textLower = text.toLowerCase();
  const foundSkills = [];
  const seen = new Set();

  for (const { name, category } of getAllSkillsFlat()) {
    const skillLower = name.toLowerCase();

    if (seen.has(skillLower)) continue;

    // Quick pre-check: skip if the skill text isn't even present as a substring
    if (!textLower.includes(skillLower)) continue;

    // Use letter-based boundaries to prevent partial word matches:
    // "java" should NOT match inside "javascript"
    // "c++" SHOULD match even though + is not a word char
    const escaped = escapeRegex(skillLower);
    const pattern = new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'i');

    if (pattern.test(textLower)) {
      foundSkills.push({ name, category });
      seen.add(skillLower);
    }
  }

  return foundSkills;
}

/**
 * Full CV parsing pipeline from PDF bytes.
 */
async function parseCv(fileBuffer) {
  const rawText = await extractTextFromPdf(fileBuffer);

  if (!rawText || rawText.trim().length < 10) {
    return {
      raw_text: rawText || '',
      extracted_skills: [],
      experience_years: null,
      education_level: null,
      contact_email: null,
      word_count: 0,
    };
  }

  const skillTuples = extractSkillsFromText(rawText);
  const skillNames = skillTuples.map((s) => s.name);

  return {
    raw_text: rawText,
    extracted_skills: skillNames,
    experience_years: extractExperienceYears(rawText),
    education_level: extractEducation(rawText),
    contact_email: extractEmail(rawText),
    word_count: rawText.split(/\s+/).length,
  };
}

/**
 * Parse structured data from raw text (text-only pipeline).
 */
function parseCvFromText(text) {
  const skillTuples = extractSkillsFromText(text);
  const skillNames = skillTuples.map((s) => s.name);

  return {
    raw_text: text,
    extracted_skills: skillNames,
    experience_years: extractExperienceYears(text),
    education_level: extractEducation(text),
    contact_email: extractEmail(text),
    word_count: text.split(/\s+/).length,
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  loadSkillsDatabase,
  getAllSkillsFlat,
  extractSkillsFromText,
  parseCv,
  parseCvFromText,
};
