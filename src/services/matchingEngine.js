const { getAllSkillsFlat } = require('./nlpEngine');

// Scoring weights — identical to Python version
const SKILL_WEIGHT = 0.60;
const EXPERIENCE_WEIGHT = 0.25;
const PREFERRED_WEIGHT = 0.15;

/**
 * Calculate match score (0-100) between a user and a job.
 * @param {Set<string>} userSkills - lowercase user skill names
 * @param {number|null} userExperience
 * @param {object} job - job row with job.skills array of { skill_name, importance }
 * @returns {{ score, matchedSkills, missingSkills, experienceFit }}
 */
function calculateMatchScore(userSkills, userExperience, job) {
  const requiredSkills = new Set();
  const preferredSkills = new Set();
  const niceToHaveSkills = new Set();

  for (const js of job.skills) {
    const skillLower = js.skill_name.toLowerCase();
    if (js.importance === 'required') {
      requiredSkills.add(skillLower);
    } else if (js.importance === 'preferred') {
      preferredSkills.add(skillLower);
    } else {
      niceToHaveSkills.add(skillLower);
    }
  }

  const userSkillsLower = new Set([...userSkills].map((s) => s.toLowerCase()));

  // --- Skill Match Score (60%) ---
  let skillScore;
  const allRequired = new Set([...requiredSkills, ...preferredSkills]);
  if (allRequired.size > 0) {
    const matchedRequired = [...requiredSkills].filter((s) => userSkillsLower.has(s));
    const requiredRatio = requiredSkills.size > 0
      ? matchedRequired.length / requiredSkills.size
      : 1.0;
    skillScore = requiredRatio * SKILL_WEIGHT * 100;
  } else {
    skillScore = SKILL_WEIGHT * 100;
  }

  // --- Experience Score (25%) ---
  let expScore;
  let experienceFit = 'meets';

  if (userExperience !== null && userExperience !== undefined && job.experience_required > 0) {
    if (userExperience >= job.experience_required) {
      expScore = EXPERIENCE_WEIGHT * 100;
      experienceFit = userExperience > job.experience_required ? 'exceeds' : 'meets';
    } else if (userExperience >= job.experience_required - 1) {
      expScore = EXPERIENCE_WEIGHT * 100 * 0.75;
      experienceFit = 'close';
    } else {
      const ratio = userExperience / job.experience_required;
      expScore = EXPERIENCE_WEIGHT * 100 * Math.max(ratio, 0.2);
      experienceFit = 'below';
    }
  } else if (job.experience_required === 0) {
    expScore = EXPERIENCE_WEIGHT * 100;
    experienceFit = 'meets';
  } else {
    expScore = EXPERIENCE_WEIGHT * 100 * 0.5;
    experienceFit = 'unknown';
  }

  // --- Preferred Skills Bonus (15%) ---
  const matchedPreferred = [...preferredSkills].filter((s) => userSkillsLower.has(s));
  const matchedNice = [...niceToHaveSkills].filter((s) => userSkillsLower.has(s));
  const bonusPool = new Set([...preferredSkills, ...niceToHaveSkills]);

  let bonusScore;
  if (bonusPool.size > 0) {
    const bonusRatio = (matchedPreferred.length + matchedNice.length * 0.5) / bonusPool.size;
    bonusScore = PREFERRED_WEIGHT * 100 * Math.min(bonusRatio, 1.0);
  } else {
    bonusScore = PREFERRED_WEIGHT * 100 * 0.5;
  }

  // --- Total Score ---
  const totalScore = Math.round((skillScore + expScore + bonusScore) * 10) / 10;

  // --- Build matched/missing lists ---
  const allJobSkills = new Set([...requiredSkills, ...preferredSkills, ...niceToHaveSkills]);
  const matched = [...userSkills]
    .filter((s) => allJobSkills.has(s.toLowerCase()))
    .sort();
  const missing = [...allJobSkills]
    .filter((s) => !userSkillsLower.has(s))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .sort();

  return { score: totalScore, matchedSkills: matched, missingSkills: missing, experienceFit };
}

/**
 * Match a user against all jobs and return ranked results.
 */
function matchUserToJobs(userSkills, userExperience, jobs, minScore = 0) {
  const userSkillsSet = new Set(userSkills);
  const matches = [];

  for (const job of jobs) {
    if (!job.is_active) continue;

    const { score, matchedSkills, missingSkills, experienceFit } = calculateMatchScore(
      userSkillsSet, userExperience, job
    );

    if (score >= minScore) {
      matches.push({
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        location: job.location || null,
        score,
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        experience_fit: experienceFit,
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Generate skill suggestions from top matches
  const suggestions = generateSkillSuggestions(matches.slice(0, 10), userSkillsSet);

  return {
    matches,
    total_jobs_analyzed: jobs.length,
    skill_suggestions: suggestions,
  };
}

/**
 * Analyze missing skills and suggest which to learn.
 */
function generateSkillSuggestions(topMatches, userSkills) {
  const allSkillsFlat = getAllSkillsFlat();

  // Count how often each missing skill appears
  const missingCounter = {};
  for (const match of topMatches) {
    for (const skill of match.missing_skills) {
      const key = skill.toLowerCase();
      missingCounter[key] = (missingCounter[key] || 0) + 1;
    }
  }

  const entries = Object.entries(missingCounter);
  if (entries.length === 0) return [];

  // Build skill -> category lookup
  const skillCategoryMap = {};
  for (const { name, category } of allSkillsFlat) {
    skillCategoryMap[name.toLowerCase()] = category;
  }

  // Sort by count descending
  entries.sort((a, b) => b[1] - a[1]);
  const maxCount = entries[0][1];

  const suggestions = [];
  for (const [skill, count] of entries.slice(0, 15)) {
    const ratio = count / maxCount;
    let priority;
    if (ratio >= 0.7) priority = 'high';
    else if (ratio >= 0.4) priority = 'medium';
    else priority = 'low';

    suggestions.push({
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      category: skillCategoryMap[skill] || 'general',
      demand_count: count,
      priority,
    });
  }

  return suggestions;
}

/**
 * Generate a detailed skill gap report for a specific job.
 */
function getSkillGapReport(userSkills, userExperience, job) {
  const userSkillsSet = new Set(userSkills);
  const { score, matchedSkills, missingSkills, experienceFit } = calculateMatchScore(
    userSkillsSet, userExperience, job
  );

  // Separate missing into required vs preferred
  const requiredSkillsSet = new Set();
  const preferredSkillsSet = new Set();

  for (const js of job.skills) {
    const skillLower = js.skill_name.toLowerCase();
    if (js.importance === 'required') {
      requiredSkillsSet.add(skillLower);
    } else {
      preferredSkillsSet.add(skillLower);
    }
  }

  const userLower = new Set([...userSkills].map((s) => s.toLowerCase()));
  const missingRequired = [...requiredSkillsSet]
    .filter((s) => !userLower.has(s))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .sort();
  const missingPreferred = [...preferredSkillsSet]
    .filter((s) => !userLower.has(s))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .sort();

  // Generate recommendation
  let recommendation;
  if (score >= 80) {
    recommendation = 'Excellent match! You have most of the required skills. Apply with confidence.';
  } else if (score >= 60) {
    recommendation = `Good match! Consider strengthening: ${missingRequired.slice(0, 3).join(', ')}.`;
  } else if (score >= 40) {
    recommendation = `Partial match. Focus on learning: ${missingRequired.slice(0, 5).join(', ')} to improve your chances.`;
  } else {
    recommendation = 'This job requires skills significantly different from your profile. Consider upskilling first.';
  }

  return {
    job_title: job.title,
    company: job.company,
    overall_score: score,
    matched_skills: matchedSkills,
    missing_required: missingRequired,
    missing_preferred: missingPreferred,
    experience_fit: experienceFit,
    recommendation,
  };
}

module.exports = { calculateMatchScore, matchUserToJobs, generateSkillSuggestions, getSkillGapReport };
