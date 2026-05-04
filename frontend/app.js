/* ============================================
   JobsMatch AI — Frontend Application Logic
   Role-Based: Admin / Employer / Searcher
   Mobile-First with Progressive Disclosure
   ============================================ */

const API_BASE = '';  // Same origin

// ---- State ----
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let isLoginMode = true;
let selectedRole = 'searcher';
let jobSkills = [];
let cachedParseResult = null;
let currentEditingJobId = null;
let isMobile = window.innerWidth <= 768;
let userApplications = new Set(); // Track job IDs user applied to
let notifInterval = null;

// ---- DOM Elements ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initAuth();
    initJobForm();
    initCVParser();
    initMatching();
    initCandidates();
    initAdmin();
    initProfile();
    initNotifications();
    initApplications();
    initTalentSearch();
    initBestCandidates();
    initCandidateProfile();
    initMobileTabBar();
    loadInitialData();
    if (authToken) {
        fetchCurrentUser();
    }

    window.addEventListener('resize', () => {
        isMobile = window.innerWidth <= 768;
    });
});

// ============================================
// Navigation
// ============================================

function initNavigation() {
    $$('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    const hamburger = $('#hamburger');
    const navLinks = $('#nav-links');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    $('#hero-start')?.addEventListener('click', () => {
        if (!authToken) {
            openAuthModal(false);
        } else if (currentUser?.role === 'employer') {
            navigateTo('jobs');
        } else {
            navigateTo('cv');
        }
    });

    $('#hero-browse')?.addEventListener('click', () => navigateTo('jobs'));
    $('#nav-logo')?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
}

function navigateTo(page) {
    $$('.nav-link').forEach(l => l.classList.remove('active'));
    $$(`.nav-link[data-page="${page}"]`).forEach(l => l.classList.add('active'));

    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${page}`)?.classList.add('active');

    $('#nav-links')?.classList.remove('open');

    // Update mobile tab bar
    $$('.tab-item').forEach(t => t.classList.remove('active'));
    $$(`.tab-item[data-page="${page}"]`).forEach(t => t.classList.add('active'));

    // Load page-specific data
    if (page === 'jobs') loadJobs();
    if (page === 'matching') checkMatchingReady();
    if (page === 'profile') loadProfileData();
    if (page === 'candidates') loadEmployerJobs();
    if (page === 'talent') { /* talent page loaded on search */ }
    if (page === 'admin') loadAdminData();
}

function updateNavForRole() {
    if (!currentUser) {
        $('#nav-candidates')?.classList.add('hidden');
        $('#nav-talent')?.classList.add('hidden');
        $('#nav-admin')?.classList.add('hidden');
        $('#nav-profile')?.classList.add('hidden');
        $('#btn-add-job')?.classList.add('hidden');
        return;
    }

    const role = currentUser.role;

    // Profile link visible to all logged-in users
    $('#nav-profile')?.classList.remove('hidden');

    // Show/hide nav items based on role — searchers cannot see candidates or talent
    if (role === 'employer' || role === 'admin') {
        $('#nav-candidates')?.classList.remove('hidden');
        $('#nav-talent')?.classList.remove('hidden');
        $('#btn-add-job')?.classList.remove('hidden');
    } else {
        $('#nav-candidates')?.classList.add('hidden');
        $('#nav-talent')?.classList.add('hidden');
        $('#btn-add-job')?.classList.add('hidden');
    }

    if (role === 'admin') {
        $('#nav-admin')?.classList.remove('hidden');
    } else {
        $('#nav-admin')?.classList.add('hidden');
    }

    // Update mobile tab bar based on role
    $('#tab-profile')?.setAttribute('data-page', 'profile');
    const profileLabel = $('#tab-profile span');
    if (profileLabel) profileLabel.textContent = 'Profile';

    if (role === 'employer') {
        $('#tab-matching')?.setAttribute('data-page', 'candidates');
        const matchLabel = $('#tab-matching span');
        if (matchLabel) matchLabel.textContent = 'Talent';
    } else {
        $('#tab-matching')?.setAttribute('data-page', 'matching');
        const matchLabel = $('#tab-matching span');
        if (matchLabel) matchLabel.textContent = 'Match';
    }
}

// ============================================
// Mobile Bottom Tab Bar
// ============================================

function initMobileTabBar() {
    $$('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.dataset.page;
            navigateTo(page);
        });
    });
}

// ============================================
// Authentication
// ============================================

function initAuth() {
    $('#btn-login')?.addEventListener('click', () => openAuthModal(true));
    $('#btn-register')?.addEventListener('click', () => openAuthModal(false));
    $('#btn-logout')?.addEventListener('click', logout);
    $('#modal-close')?.addEventListener('click', closeAuthModal);
    $('#auth-switch-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthMode();
    });

    $('#auth-form')?.addEventListener('submit', handleAuth);

    $('#auth-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#auth-modal')) closeAuthModal();
    });

    // Role selector
    $$('.role-option').forEach(opt => {
        opt.addEventListener('click', () => {
            $$('.role-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedRole = opt.dataset.role;

            // Show/hide employer-specific fields
            if (selectedRole === 'employer') {
                $('#company-group')?.classList.remove('hidden');
                $('#employer-type-group')?.classList.remove('hidden');
            } else {
                $('#company-group')?.classList.add('hidden');
                $('#employer-type-group')?.classList.add('hidden');
            }
        });
    });

    // Employer type selector
    $$('.etype-option').forEach(opt => {
        opt.addEventListener('click', () => {
            $$('.etype-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });
}

function openAuthModal(login) {
    isLoginMode = login;
    updateAuthModal();
    $('#auth-modal').classList.remove('hidden');
    $('#auth-error').classList.add('hidden');
}

function closeAuthModal() {
    $('#auth-modal').classList.add('hidden');
    $('#auth-form').reset();
    selectedRole = 'searcher';
    $$('.role-option').forEach(o => o.classList.remove('selected'));
    $('.role-option[data-role="searcher"]')?.classList.add('selected');
    $('#company-group')?.classList.add('hidden');
    $('#employer-type-group')?.classList.add('hidden');
    $$('.etype-option').forEach(o => o.classList.remove('selected'));
    $('.etype-option[data-etype="company"]')?.classList.add('selected');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthModal();
}

function updateAuthModal() {
    const extraGroups = ['name-group', 'title-group', 'experience-group', 'role-group'];

    if (isLoginMode) {
        $('#modal-title').textContent = 'Sign In';
        $('#modal-subtitle').textContent = 'Welcome back to JobsMatch AI';
        $('#auth-submit').textContent = 'Sign In';
        $('#auth-switch-text').textContent = "Don't have an account?";
        $('#auth-switch-link').textContent = 'Create one';
        extraGroups.forEach(id => $(`#${id}`).classList.add('hidden'));
        $('#company-group')?.classList.add('hidden');
        $('#employer-type-group')?.classList.add('hidden');
    } else {
        $('#modal-title').textContent = 'Create Account';
        $('#modal-subtitle').textContent = 'Start your smart job matching journey';
        $('#auth-submit').textContent = 'Create Account';
        $('#auth-switch-text').textContent = 'Already have an account?';
        $('#auth-switch-link').textContent = 'Sign in';
        extraGroups.forEach(id => $(`#${id}`).classList.remove('hidden'));
        if (selectedRole === 'employer') {
            $('#company-group')?.classList.remove('hidden');
            $('#employer-type-group')?.classList.remove('hidden');
        }
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const btn = $('#auth-submit');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Please wait...';
    $('#auth-error').classList.add('hidden');

    try {
        if (isLoginMode) {
            const res = await apiPost('/api/auth/login', {
                email: $('#auth-email').value,
                password: $('#auth-password').value,
            });
            authToken = res.access_token;
            localStorage.setItem('authToken', authToken);
            await fetchCurrentUser();
            closeAuthModal();
            showToast('Welcome back!', 'success');
        } else {
            const selectedEtype = $('.etype-option.selected')?.dataset?.etype || 'company';
            const body = {
                email: $('#auth-email').value,
                password: $('#auth-password').value,
                full_name: $('#auth-name').value,
                role: selectedRole,
                company_name: selectedRole === 'employer' ? $('#auth-company').value : null,
                employer_type: selectedRole === 'employer' ? selectedEtype : null,
                title: $('#auth-title').value || null,
                experience_years: $('#auth-experience').value ? parseInt($('#auth-experience').value) : null,
            };
            await apiPost('/api/auth/register', body);

            const loginRes = await apiPost('/api/auth/login', {
                email: body.email,
                password: body.password,
            });
            authToken = loginRes.access_token;
            localStorage.setItem('authToken', authToken);
            await fetchCurrentUser();
            closeAuthModal();
            showToast('Account created successfully!', 'success');
        }
    } catch (err) {
        $('#auth-error').textContent = err.message || 'Authentication failed';
        $('#auth-error').classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    }
}

async function fetchCurrentUser() {
    try {
        currentUser = await apiGet('/api/users/me');
        updateUserUI();
        updateNavForRole();
        startNotifPolling();
        loadUserApplications();
    } catch {
        logout();
    }
}

function updateUserUI() {
    if (currentUser) {
        $('#auth-buttons').classList.add('hidden');
        $('#user-menu').classList.remove('hidden');
        $('#user-avatar').textContent = currentUser.full_name?.charAt(0)?.toUpperCase() || 'U';
        $('#user-name').textContent = currentUser.full_name || 'User';
        const roleBadge = $('#user-role-badge');
        if (roleBadge) {
            roleBadge.textContent = currentUser.role;
            roleBadge.className = `user-role-badge badge badge-role-${currentUser.role}`;
        }
    } else {
        $('#auth-buttons').classList.remove('hidden');
        $('#user-menu').classList.add('hidden');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    userApplications = new Set();
    localStorage.removeItem('authToken');
    stopNotifPolling();
    updateNotifBadge(0);
    updateUserUI();
    updateNavForRole();
    navigateTo('dashboard');
    showToast('Logged out', 'info');
}

// ============================================
// Jobs
// ============================================

function initJobForm() {
    $('#btn-add-job')?.addEventListener('click', () => {
        if (!authToken) {
            openAuthModal(true);
            showToast('Please sign in to create jobs', 'info');
            return;
        }
        currentEditingJobId = null;
        $('#job-modal-title').textContent = 'Post a New Job';
        $('#job-form').reset();
        // Pre-fill company for employers
        if (currentUser?.company_name) {
            $('#job-company').value = currentUser.company_name;
        }
        jobSkills = [];
        renderJobSkillTags();
        $('#job-modal').classList.remove('hidden');
    });

    $('#job-modal-close')?.addEventListener('click', () => {
        $('#job-modal').classList.add('hidden');
    });

    $('#job-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#job-modal')) $('#job-modal').classList.add('hidden');
    });

    $('#job-skill-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addJobSkill();
        }
    });

    $('#job-form')?.addEventListener('submit', handleJobSubmit);
    $('#btn-search-jobs')?.addEventListener('click', loadJobs);

    // Toggle duration fields based on employment type
    $('#job-employment-type')?.addEventListener('change', () => {
        const et = $('#job-employment-type').value;
        if (et === 'permanent') {
            $('#duration-group')?.classList.add('hidden');
            $('#job-worker-type').value = 'staff';
        } else {
            $('#duration-group')?.classList.remove('hidden');
            $('#job-worker-type').value = 'freelancer';
        }
    });

    // Debounced search
    let searchTimeout;
    $('#job-search')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadJobs, 300);
    });
}

function addJobSkill() {
    const input = $('#job-skill-input');
    const importance = $('#job-skill-importance').value;
    const name = input.value.trim();

    if (!name) return;
    if (jobSkills.find(s => s.name.toLowerCase() === name.toLowerCase())) {
        showToast('Skill already added', 'info');
        return;
    }

    jobSkills.push({ name, importance });
    renderJobSkillTags();
    input.value = '';
    input.focus();
}

function removeJobSkill(index) {
    jobSkills.splice(index, 1);
    renderJobSkillTags();
}
// Make globally accessible for onclick
window.removeJobSkill = removeJobSkill;

function renderJobSkillTags() {
    const container = $('#job-skills-tags');
    container.innerHTML = jobSkills.map((s, i) => `
        <span class="skill-tag-remove">
            ${s.name}
            <span class="remove-btn" onclick="removeJobSkill(${i})">&times;</span>
        </span>
    `).join('');
}

async function handleJobSubmit(e) {
    e.preventDefault();

    const empType = $('#job-employment-type').value;
    const body = {
        title: $('#job-title').value,
        company: $('#job-company').value,
        description: $('#job-description').value,
        location: $('#job-location-input').value || null,
        job_type: $('#job-type').value,
        employment_type: empType,
        worker_type: $('#job-worker-type').value,
        duration_min: empType !== 'permanent' && $('#job-duration-min').value ? parseInt($('#job-duration-min').value) : null,
        duration_max: empType !== 'permanent' && $('#job-duration-max').value ? parseInt($('#job-duration-max').value) : null,
        salary_min: $('#job-salary-min').value ? parseFloat($('#job-salary-min').value) : null,
        salary_max: $('#job-salary-max').value ? parseFloat($('#job-salary-max').value) : null,
        experience_required: parseInt($('#job-experience').value || '0'),
        skills: jobSkills,
    };

    try {
        if (currentEditingJobId) {
            await apiPut(`/api/jobs/${currentEditingJobId}`, body);
            showToast('Job updated successfully!', 'success');
        } else {
            await apiPost('/api/jobs/', body);
            showToast('Job created successfully!', 'success');
        }

        $('#job-modal').classList.add('hidden');
        $('#job-form').reset();
        jobSkills = [];
        currentEditingJobId = null;
        renderJobSkillTags();
        loadJobs();
    } catch (err) {
        showToast(err.message || 'Failed to save job', 'error');
    }
}

async function openEditJobModal(jobId) {
    try {
        const job = await apiGet(`/api/jobs/${jobId}`);
        currentEditingJobId = jobId;

        $('#job-modal-title').textContent = 'Edit Job Listing';
        $('#job-title').value = job.title;
        $('#job-company').value = job.company;
        $('#job-description').value = job.description;
        $('#job-location-input').value = job.location || '';
        $('#job-type').value = job.job_type || 'remote';
        $('#job-employment-type').value = job.employment_type || 'permanent';
        $('#job-worker-type').value = job.worker_type || 'staff';
        if (job.employment_type && job.employment_type !== 'permanent') {
            $('#duration-group')?.classList.remove('hidden');
            $('#job-duration-min').value = job.duration_min || '';
            $('#job-duration-max').value = job.duration_max || '';
        } else {
            $('#duration-group')?.classList.add('hidden');
        }
        $('#job-salary-min').value = job.salary_min || '';
        $('#job-salary-max').value = job.salary_max || '';
        $('#job-experience').value = job.experience_required;

        jobSkills = job.skills.map(s => ({ name: s.skill_name, importance: s.importance }));
        renderJobSkillTags();

        $('#job-modal').classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load job details', 'error');
    }
}
window.openEditJobModal = openEditJobModal;

async function loadJobs() {
    const search = $('#job-search')?.value || '';
    const location = $('#job-location')?.value || '';

    let url = '/api/jobs/?limit=50';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (location) url += `&location=${encodeURIComponent(location)}`;

    try {
        const data = await apiGet(url);
        renderJobs(data.jobs, data.total);
    } catch (err) {
        console.error('Failed to load jobs:', err);
    }
}

function renderJobs(jobs, total) {
    const grid = $('#jobs-grid');

    $('#stat-jobs').textContent = total;

    if (!jobs || jobs.length === 0) {
        grid.innerHTML = '';
        grid.appendChild(createEmptyState('💼', 'No jobs found', 'Create your first job listing to get started'));
        return;
    }

    grid.innerHTML = jobs.map(job => {
        const badgeClass = job.job_type === 'remote' ? 'badge-remote' :
                          job.job_type === 'onsite' ? 'badge-onsite' : 'badge-hybrid';

        const salary = job.salary_min && job.salary_max
            ? `$${(job.salary_min/1000).toFixed(0)}k - $${(job.salary_max/1000).toFixed(0)}k`
            : job.salary_min ? `From $${(job.salary_min/1000).toFixed(0)}k` : '';

        const skills = (job.skills || []).map(s => {
            const cls = s.importance === 'preferred' ? 'preferred' :
                       s.importance === 'nice_to_have' ? 'nice' : '';
            return `<span class="skill-tag ${cls}">${s.skill_name}</span>`;
        }).join('');

        const isOwner = currentUser && job.created_by === currentUser.id;
        const isAdmin = currentUser && currentUser.role === 'admin';
        const canEdit = isOwner || isAdmin;
        const actionButtons = canEdit ? `
            <div class="job-card-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); openEditJobModal(${job.id})" title="Edit Job">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon-delete" onclick="event.stopPropagation(); confirmDeleteJob(${job.id}, this)" title="Delete Job">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        ` : '';

        // Employment type badges
        const empType = job.employment_type || 'permanent';
        const empBadgeClass = empType === 'permanent' ? 'badge-permanent' :
                              empType === 'contract' ? 'badge-contract' : 'badge-project';
        const empLabel = empType === 'permanent' ? 'Permanent' :
                         empType === 'short_term_project' ? 'Short-Term' :
                         empType === 'long_term_project' ? 'Long-Term' : 'Contract';
        const workerBadge = (job.worker_type === 'freelancer')
            ? '<span class="badge badge-freelancer">Freelancer</span>'
            : '<span class="badge badge-staff">Staff</span>';
        const durationBadge = (job.duration_min || job.duration_max) 
            ? `<span class="badge badge-duration">⏱ ${job.duration_min || '?'}–${job.duration_max || '?'} mo</span>` : '';

        // Best Candidates button (for owner/admin)
        const bestCandidatesBtn = canEdit ? `
            <button class="btn-best-candidates" onclick="event.stopPropagation(); openBestCandidates(${job.id}, '${escapeHTML(job.title)}')">
                ⭐ Best Candidates
            </button>
        ` : '';

        return `
            <div class="job-card" style="position:relative;">
                <div class="job-card-header">
                    <div>
                        <div class="job-card-title">${escapeHTML(job.title)}</div>
                        <div class="job-card-company">${escapeHTML(job.company)}</div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center">
                        ${actionButtons}
                        ${job.job_type ? `<span class="job-card-badge ${badgeClass}">${job.job_type}</span>` : ''}
                    </div>
                </div>
                <div class="job-card-badges">
                    <span class="badge ${empBadgeClass}">${empLabel}</span>
                    ${workerBadge}
                    ${durationBadge}
                </div>
                <div class="job-card-meta">
                    ${job.location ? `<span>📍 ${escapeHTML(job.location)}</span>` : ''}
                    ${salary ? `<span>💰 ${salary}</span>` : ''}
                    <span>🎯 ${job.experience_required}+ years</span>
                </div>
                <div class="job-card-skills">${skills}</div>
                ${bestCandidatesBtn}
                ${currentUser && currentUser.role === 'searcher' ? `
                    <button class="btn-apply ${userApplications.has(job.id) ? 'applied' : ''}" 
                            onclick="event.stopPropagation(); ${userApplications.has(job.id) ? '' : `openApplyModal(${job.id}, '${escapeHTML(job.title)}', '${escapeHTML(job.company)}')`}"
                            ${userApplications.has(job.id) ? 'disabled' : ''}>
                        ${userApplications.has(job.id) ? 
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Applied' :
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Apply Now'}
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function createEmptyState(icon, title, subtitle) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
        <div class="empty-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
    `;
    return div;
}

// ============================================
// CV Parser
// ============================================

function initCVParser() {
    const uploadZone = $('#upload-zone');
    const fileInput = $('#cv-file-input');

    $('#btn-browse-cv')?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadZone?.addEventListener('click', () => fileInput.click());

    uploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone?.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleCVUpload(file);
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleCVUpload(file);
    });

    $('#btn-parse-text')?.addEventListener('click', handleParseText);
    $('#btn-save-skills')?.addEventListener('click', handleSaveSkills);
}

async function handleCVUpload(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please upload a PDF file', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large (max 10MB)', 'error');
        return;
    }

    $('#upload-status').classList.remove('hidden');
    $('#upload-status-text').textContent = 'Analyzing CV...';
    const progressBar = $('#progress-bar');
    progressBar.style.width = '30%';

    const formData = new FormData();
    formData.append('file', file);

    try {
        progressBar.style.width = '60%';

        const endpoint = authToken ? '/api/cv/parse-and-save' : '/api/cv/parse';
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
            body: formData,
        });

        progressBar.style.width = '90%';
        const data = await res.json();

        if (!res.ok) throw new Error(data.detail || 'Upload failed');

        progressBar.style.width = '100%';
        $('#upload-status-text').textContent = 'Analysis complete!';

        if (data.success && data.data) {
            cachedParseResult = data.data;
            displayCVResults(data.data);
            showToast(data.message, 'success');

            if (authToken) {
                await fetchCurrentUser();
            }
        } else {
            showToast(data.message || 'Parsing failed', 'error');
        }
    } catch (err) {
        showToast(err.message || 'Failed to parse CV', 'error');
    } finally {
        setTimeout(() => {
            $('#upload-status').classList.add('hidden');
            progressBar.style.width = '0%';
        }, 2000);
    }
}

async function handleParseText() {
    const text = $('#cv-text-input').value.trim();
    if (!text || text.length < 10) {
        showToast('Please enter more text', 'error');
        return;
    }

    try {
        const data = await apiPost('/api/cv/parse-text', { text });
        if (data.success && data.data) {
            cachedParseResult = data.data;
            displayCVResults(data.data);
            showToast(data.message, 'success');
        }
    } catch (err) {
        showToast(err.message || 'Failed to parse text', 'error');
    }
}

async function handleSaveSkills() {
    if (!authToken) {
        openAuthModal(true);
        showToast('Please sign in to save skills', 'info');
        return;
    }

    if (!cachedParseResult) {
        showToast('No parsed data to save', 'error');
        return;
    }

    try {
        const body = {
            skills: cachedParseResult.extracted_skills,
            experience_years: cachedParseResult.experience_years,
            education_level: cachedParseResult.education_level
        };
        await apiPost('/api/users/me/skills', body);
        showToast('Skills saved to your profile!', 'success');

        const freshUser = await apiGet('/api/users/me');
        currentUser = freshUser;
        updateUserUI();
    } catch (err) {
        showToast(err.message || 'Failed to save skills', 'error');
    }
}

function displayCVResults(data) {
    const resultsCard = $('#cv-results');
    resultsCard.classList.remove('hidden');

    $('#rs-skills').textContent = data.extracted_skills?.length || 0;
    $('#rs-experience').textContent = data.experience_years ? `${data.experience_years}yr` : '-';
    $('#rs-education').textContent = data.education_level || '-';
    $('#rs-words').textContent = data.word_count || 0;

    const skillsCloud = $('#skills-cloud');
    skillsCloud.innerHTML = (data.extracted_skills || []).map((skill, i) => {
        return `<span class="skill-chip" style="animation-delay: ${i * 0.05}s">${escapeHTML(skill)}</span>`;
    }).join('');

    if (data.contact_email) {
        $('#email-result').classList.remove('hidden');
        $('#rs-email').textContent = data.contact_email;
    } else {
        $('#email-result').classList.add('hidden');
    }
}

// ============================================
// Matching (Job Searcher)
// ============================================

function initMatching() {
    $('#btn-run-matching')?.addEventListener('click', runMatching);
    $('#btn-matching-login')?.addEventListener('click', () => openAuthModal(true));
}

function checkMatchingReady() {
    if (authToken && currentUser) {
        const hasSkills = currentUser.skills && currentUser.skills.length > 0;
        if (hasSkills) {
            $('#matching-notice').classList.add('hidden');
        } else {
            $('#matching-notice').classList.remove('hidden');
            $('#matching-notice').querySelector('h3').textContent = 'Upload Your CV First';
            $('#matching-notice').querySelector('p').textContent = 'Go to the CV Parser page and upload your resume to extract your skills.';
            $('#matching-notice').querySelector('button').textContent = 'Go to CV Parser';
            $('#matching-notice').querySelector('button').onclick = () => navigateTo('cv');
        }
    } else {
        $('#matching-notice').classList.remove('hidden');
    }
}

async function runMatching() {
    if (!authToken) {
        openAuthModal(true);
        return;
    }

    const btn = $('#btn-run-matching');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Analyzing...';

    try {
        const data = await apiGet('/api/matching/jobs');

        $('#matching-notice').classList.add('hidden');
        $('#matching-results').classList.remove('hidden');

        const avgScore = data.matches.length > 0
            ? (data.matches.reduce((acc, m) => acc + m.score, 0) / data.matches.length).toFixed(1)
            : 0;

        const bestMatch = data.matches.length > 0 ? data.matches[0].score : 0;

        $('#matching-summary').innerHTML = `
            <div class="summary-card">
                <div class="sc-value">${data.total_jobs_analyzed}</div>
                <div class="sc-label">Jobs Analyzed</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${data.matches.length}</div>
                <div class="sc-label">Matches Found</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${bestMatch}%</div>
                <div class="sc-label">Best Match Score</div>
            </div>
        `;

        if (data.matches.length > 0) {
            $('#matches-list').innerHTML = data.matches.map((match, idx) => `
                <div class="match-card ${isMobile ? 'collapsed' : 'expanded'}" onclick="toggleMatchCard(this)">
                    <div class="match-card-top">
                        <div class="match-card-info">
                            <h3>${escapeHTML(match.job_title)}</h3>
                            <p>${escapeHTML(match.company)}</p>
                            <div class="expand-indicator">Tap to ${isMobile ? 'expand' : 'collapse'} ▾</div>
                        </div>
                        <div class="match-score">
                            <div class="score-circle">${match.score}%</div>
                            <span class="score-label">Match</span>
                        </div>
                    </div>
                    <div class="match-card-details">
                        <div class="match-card-skills">
                            <div class="match-skills-group">
                                <h4>✅ Matched Skills</h4>
                                <div class="skills-list">
                                    ${match.matched_skills.map(s => `<span class="skill-matched">${escapeHTML(s)}</span>`).join('')}
                                    ${match.matched_skills.length === 0 ? '<span style="color:var(--text-muted);font-size:12px">None</span>' : ''}
                                </div>
                            </div>
                            <div class="match-skills-group">
                                <h4>❌ Missing Skills</h4>
                                <div class="skills-list">
                                    ${match.missing_skills.map(s => `<span class="skill-missing">${escapeHTML(s)}</span>`).join('')}
                                    ${match.missing_skills.length === 0 ? '<span style="color:var(--text-muted);font-size:12px">None</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="match-meta">
                            ${match.location ? `<span>📍 ${escapeHTML(match.location)}</span>` : ''}
                            <span>🎯 Exp: ${match.experience_fit}</span>
                            ${match.salary_min ? `<span>💰 $${(match.salary_min/1000).toFixed(0)}k+</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            $('#matches-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>No matches found</h3>
                    <p>Try adding more jobs or updating your skills</p>
                </div>
            `;
        }

        // Skill suggestions
        if (data.skill_suggestions && data.skill_suggestions.length > 0) {
            $('#suggestions-section').classList.remove('hidden');
            $('#suggestions-grid').innerHTML = data.skill_suggestions.map(s => `
                <div class="suggestion-card">
                    <div class="suggestion-priority priority-${s.priority}">
                        ${s.priority === 'high' ? '🔥' : s.priority === 'medium' ? '⚡' : '💡'}
                    </div>
                    <div class="suggestion-info">
                        <h4>${escapeHTML(s.skill)}</h4>
                        <p>${escapeHTML(s.category)}</p>
                    </div>
                    <div class="suggestion-demand">
                        <div class="count">${s.demand_count}</div>
                        <div class="label">jobs need</div>
                    </div>
                </div>
            `).join('');
        }

        showToast(`Found ${data.matches.length} job matches!`, 'success');
    } catch (err) {
        showToast(err.message || 'Matching failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Run Matching
        `;
    }
}

// Progressive Disclosure — toggle match card expansion
function toggleMatchCard(card) {
    if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
    } else {
        card.classList.remove('expanded');
        card.classList.add('collapsed');
    }
}
window.toggleMatchCard = toggleMatchCard;

// ============================================
// Candidate Search (Employer)
// ============================================

function initCandidates() {
    $('#btn-search-candidates')?.addEventListener('click', searchCandidates);
}

async function loadEmployerJobs() {
    if (!authToken || !currentUser) return;
    if (currentUser.role !== 'employer' && currentUser.role !== 'admin') return;

    try {
        const data = await apiGet('/api/jobs/?limit=100');
        const select = $('#candidate-job-select');
        select.innerHTML = '<option value="">— Choose a job posting —</option>';

        const myJobs = currentUser.role === 'admin'
            ? data.jobs
            : data.jobs.filter(j => j.created_by === currentUser.id);

        myJobs.forEach(job => {
            const opt = document.createElement('option');
            opt.value = job.id;
            opt.textContent = `${job.title} — ${job.company}`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load employer jobs:', err);
    }
}

async function searchCandidates() {
    const jobId = $('#candidate-job-select').value;
    if (!jobId) {
        showToast('Please select a job posting first', 'info');
        return;
    }

    const btn = $('#btn-search-candidates');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Searching...';

    try {
        const data = await apiGet(`/api/employer/jobs/${jobId}/candidates`);

        $('#candidate-results').classList.remove('hidden');

        $('#candidate-summary').innerHTML = `
            <div class="summary-card">
                <div class="sc-value">${data.total_candidates_analyzed}</div>
                <div class="sc-label">Applicants</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${data.candidates.length}</div>
                <div class="sc-label">Ranked Matches</div>
            </div>
            <div class="summary-card">
                <div class="sc-value">${data.candidates.length > 0 ? data.candidates[0].score + '%' : '—'}</div>
                <div class="sc-label">Best Fit Score</div>
            </div>
        `;

        if (data.candidates.length > 0) {
            $('#candidates-list').innerHTML = data.candidates.map(c => {
                cacheCandidateData(c);
                const statusClass = c.application_status === 'accepted' ? 'badge-permanent' :
                                    c.application_status === 'rejected' ? 'badge-contract' : 'badge-project';
                const statusLabel = (c.application_status || 'pending').charAt(0).toUpperCase() + (c.application_status || 'pending').slice(1);
                const appliedDate = c.applied_at ? new Date(c.applied_at).toLocaleDateString() : '';
                const coverSnippet = c.cover_letter ? c.cover_letter.substring(0, 120) + (c.cover_letter.length > 120 ? '...' : '') : '';
                const cId = c.user_id || c.id;

                return `
                <div class="match-card ${isMobile ? 'collapsed' : 'expanded'}" onclick="toggleMatchCard(this)">
                    <div class="match-card-top">
                        <div class="match-card-info">
                            <h3>${escapeHTML(c.full_name)}</h3>
                            <p>${escapeHTML(c.title || c.email)}</p>
                            <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
                                <span class="badge ${statusClass}" style="font-size:10px">${statusLabel}</span>
                                ${appliedDate ? `<span style="font-size:11px;color:var(--text-muted)">Applied ${appliedDate}</span>` : ''}
                            </div>
                            <div class="expand-indicator">Tap to view details ▾</div>
                        </div>
                        <div class="match-score">
                            <div class="score-circle">${c.score}%</div>
                            <span class="score-label">Fit</span>
                        </div>
                    </div>
                    <div class="match-card-details">
                        <div class="candidate-meta">
                            ${c.experience_years ? `<span>📅 ${c.experience_years} yrs exp</span>` : ''}
                            ${c.education_level ? `<span>🎓 ${c.education_level}</span>` : ''}
                            <span>🔧 ${c.total_skills} skills</span>
                            <span>🎯 ${c.experience_fit}</span>
                        </div>
                        ${coverSnippet ? `
                            <div style="margin:8px 0;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md);border-left:3px solid var(--info)">
                                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">📝 Cover Letter</div>
                                <div style="font-size:13px;color:var(--text-secondary)">${escapeHTML(coverSnippet)}</div>
                            </div>
                        ` : ''}
                        <div class="match-card-skills">
                            <div class="match-skills-group">
                                <h4>✅ Matched Skills</h4>
                                <div class="skills-list">
                                    ${c.matched_skills.map(s => `<span class="skill-matched">${escapeHTML(s)}</span>`).join('')}
                                    ${c.matched_skills.length === 0 ? '<span style="color:var(--text-muted);font-size:12px">None</span>' : ''}
                                </div>
                            </div>
                            <div class="match-skills-group">
                                <h4>❌ Missing Skills</h4>
                                <div class="skills-list">
                                    ${c.missing_skills.map(s => `<span class="skill-missing">${escapeHTML(s)}</span>`).join('')}
                                    ${c.missing_skills.length === 0 ? '<span style="color:var(--text-muted);font-size:12px">None</span>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="match-meta">
                            <span>📧 ${escapeHTML(c.email)}</span>
                            ${c.phone_number ? `<span>📱 ${escapeHTML(c.phone_number)}</span>` : ''}
                        </div>
                        <div style="margin-top:10px">
                            <button class="btn-view-profile" onclick="event.stopPropagation(); openCandidateProfile(${cId})">
                                👤 View Profile & Contact
                            </button>
                        </div>
                    </div>
                </div>
            `}).join('');
        } else {
            $('#candidates-list').innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>No applicants yet</h3>
                    <p>No one has applied to this job posting yet</p>
                </div>
            `;
        }

        showToast(`Found ${data.candidates.length} applicants!`, 'success');
    } catch (err) {
        showToast(err.message || 'Candidate search failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Search Candidates
        `;
    }
}

// ============================================
// Admin Dashboard
// ============================================

function initAdmin() {
    $('#btn-refresh-admin')?.addEventListener('click', loadAdminData);
    $('#btn-admin-search')?.addEventListener('click', loadAdminUsers);

    // Debounced admin search
    let adminSearchTimeout;
    $('#admin-user-search')?.addEventListener('input', () => {
        clearTimeout(adminSearchTimeout);
        adminSearchTimeout = setTimeout(loadAdminUsers, 300);
    });

    $('#admin-role-filter')?.addEventListener('change', loadAdminUsers);
    $('#admin-status-filter')?.addEventListener('change', loadAdminUsers);
}

async function loadAdminData() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
        const stats = await apiGet('/api/admin/stats');

        $('#admin-stats-grid').innerHTML = `
            <div class="admin-stat-card">
                <div class="stat-value">${stats.total_users}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-value">${stats.active_jobs}</div>
                <div class="stat-label">Active Jobs</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-value">${stats.total_skills}</div>
                <div class="stat-label">Skills in DB</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-value">${stats.users_by_role?.searcher || 0}</div>
                <div class="stat-label">Searchers</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-value">${stats.users_by_role?.employer || 0}</div>
                <div class="stat-label">Employers</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-value">${stats.users_by_status?.suspended || 0}</div>
                <div class="stat-label">Suspended</div>
            </div>
        `;

        await loadAdminUsers();
    } catch (err) {
        showToast(err.message || 'Failed to load admin data', 'error');
    }
}

async function loadAdminUsers() {
    if (!currentUser || currentUser.role !== 'admin') return;

    const search = $('#admin-user-search')?.value || '';
    const role = $('#admin-role-filter')?.value || '';
    const status = $('#admin-status-filter')?.value || '';

    let url = '/api/admin/users?limit=50';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (role) url += `&role=${role}`;
    if (status) url += `&status=${status}`;

    try {
        const data = await apiGet(url);

        $('#admin-users-list').innerHTML = data.users.map(u => `
            <div class="admin-user-row" id="admin-user-${u.id}">
                <div class="admin-user-info">
                    <div class="name">${escapeHTML(u.full_name)}</div>
                    <div class="email">${escapeHTML(u.email)}${u.company_name ? ` · ${escapeHTML(u.company_name)}` : ''}</div>
                </div>
                <div class="admin-user-badges">
                    <span class="badge badge-role-${u.role}">${u.role}</span>
                    <span class="badge badge-status-${u.status}">${u.status}</span>
                    <span class="badge" style="background:rgba(255,255,255,0.04);color:var(--text-muted)">${u.skill_count} skills</span>
                </div>
                <div class="admin-user-actions">
                    ${u.status === 'active' && u.role !== 'admin' ?
                        `<button class="btn btn-danger btn-sm" onclick="adminSuspendUser(${u.id})">Suspend</button>` :
                        u.status === 'suspended' ?
                        `<button class="btn btn-success btn-sm" onclick="adminActivateUser(${u.id})">Activate</button>` : ''}
                    ${u.role !== 'admin' ?
                        `<button class="btn btn-ghost btn-sm" onclick="adminDeleteUser(${u.id})" style="color:var(--error)">Delete</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load admin users:', err);
    }
}

async function adminSuspendUser(userId) {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    try {
        await apiPut(`/api/admin/users/${userId}/suspend`);
        showToast('User suspended', 'success');
        loadAdminUsers();
        loadAdminData();
    } catch (err) {
        showToast(err.message || 'Failed to suspend user', 'error');
    }
}
window.adminSuspendUser = adminSuspendUser;

async function adminActivateUser(userId) {
    try {
        await apiPut(`/api/admin/users/${userId}/activate`);
        showToast('User activated', 'success');
        loadAdminUsers();
        loadAdminData();
    } catch (err) {
        showToast(err.message || 'Failed to activate user', 'error');
    }
}
window.adminActivateUser = adminActivateUser;

async function adminDeleteUser(userId) {
    if (!confirm('Are you sure you want to DELETE this user and all their data? This cannot be undone.')) return;
    try {
        await apiDelete(`/api/admin/users/${userId}`);
        showToast('User deleted', 'success');
        loadAdminUsers();
        loadAdminData();
    } catch (err) {
        showToast(err.message || 'Failed to delete user', 'error');
    }
}
window.adminDeleteUser = adminDeleteUser;

// ============================================
// Applications System
// ============================================

function initApplications() {
    // Apply modal
    $('#apply-modal-close')?.addEventListener('click', () => {
        $('#apply-modal').classList.add('hidden');
    });
    $('#apply-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#apply-modal')) $('#apply-modal').classList.add('hidden');
    });
    $('#apply-form')?.addEventListener('submit', handleApplySubmit);
}

function openApplyModal(jobId, jobTitle, jobCompany) {
    if (!authToken) { openAuthModal(true); return; }
    $('#apply-job-id').value = jobId;
    $('#apply-modal-title').textContent = `Apply to ${jobTitle}`;
    $('#apply-modal-subtitle').textContent = `at ${jobCompany}`;
    $('#apply-cover-letter').value = '';
    $('#apply-modal').classList.remove('hidden');
}
window.openApplyModal = openApplyModal;

async function handleApplySubmit(e) {
    e.preventDefault();
    const btn = $('#btn-submit-apply');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Submitting...';

    try {
        const jobId = parseInt($('#apply-job-id').value, 10);
        const coverLetter = $('#apply-cover-letter').value.trim();

        await apiPost('/api/applications', {
            job_id: jobId,
            cover_letter: coverLetter || null
        });

        userApplications.add(jobId);
        $('#apply-modal').classList.add('hidden');
        showToast('Application submitted successfully! 🎉', 'success');
        loadJobs(); // Re-render to show "Applied" state
    } catch (err) {
        showToast(err.message || 'Failed to submit application', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Submit Application';
    }
}

async function loadUserApplications() {
    if (!authToken || !currentUser || currentUser.role !== 'searcher') return;
    try {
        const apps = await apiGet('/api/applications/my');
        userApplications = new Set(apps.map(a => a.job_id));
    } catch (err) {
        // Silently fail — not critical
    }
}

// ============================================
// Notifications System
// ============================================

function initNotifications() {
    // Toggle dropdown
    $('#btn-notifications')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = $('#notif-dropdown');
        const isHidden = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (isHidden) {
            loadNotifications();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = $('#notif-dropdown');
        const wrap = $('#notif-bell-wrap');
        if (dropdown && wrap && !wrap.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Mark all as read
    $('#btn-mark-all-read')?.addEventListener('click', async () => {
        try {
            await apiPut('/api/notifications/read-all', {});
            loadNotifications();
            updateNotifBadge(0);
        } catch (err) {
            showToast('Failed to mark notifications as read', 'error');
        }
    });

    // Applicant detail modal close
    $('#applicant-modal-close')?.addEventListener('click', () => {
        $('#applicant-modal').classList.add('hidden');
    });
    $('#applicant-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#applicant-modal')) {
            $('#applicant-modal').classList.add('hidden');
        }
    });
}

function startNotifPolling() {
    if (notifInterval) clearInterval(notifInterval);
    pollUnreadCount();
    notifInterval = setInterval(pollUnreadCount, 30000); // Poll every 30s
}

function stopNotifPolling() {
    if (notifInterval) {
        clearInterval(notifInterval);
        notifInterval = null;
    }
}

async function pollUnreadCount() {
    if (!authToken) return;
    try {
        const res = await apiGet('/api/notifications/unread-count');
        updateNotifBadge(res.count);
    } catch (err) {
        // Silent fail
    }
}

function updateNotifBadge(count) {
    const badge = $('#notif-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function loadNotifications() {
    const list = $('#notif-list');
    if (!list) return;

    try {
        const notifications = await apiGet('/api/notifications');

        if (notifications.length === 0) {
            list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
            window._notifCache = {};
            return;
        }

        // Cache notification metadata in a JS object
        window._notifCache = {};
        notifications.forEach(n => {
            window._notifCache[String(n.id)] = n.metadata || {};
        });

        list.innerHTML = notifications.map(n => {
            const meta = n.metadata || {};
            const applicant = meta.applicant || {};
            const avatarContent = applicant.profile_picture
                ? `<img src="${applicant.profile_picture}" alt="">`
                : (applicant.full_name ? applicant.full_name.charAt(0).toUpperCase() : '📋');
            const timeAgo = formatTimeAgo(n.created_at);

            return `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" data-notif-id="${n.id}">
                    <div class="notif-avatar">${avatarContent}</div>
                    <div class="notif-content">
                        <div class="notif-title">${escapeHTML(n.title)}</div>
                        <div class="notif-message">${escapeHTML(n.message || '')}</div>
                        <div class="notif-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers via event delegation
        list.onclick = async (e) => {
            const item = e.target.closest('.notif-item');
            if (!item) return;
            const notifId = item.getAttribute('data-notif-id');
            if (!notifId) return;

            // Mark as read
            try {
                await apiPut(`/api/notifications/${notifId}/read`, {});
                item.classList.remove('unread');
            } catch (err) { /* ignore */ }

            // Get metadata from cache
            const meta = (window._notifCache && window._notifCache[notifId]) || {};

            // Close the dropdown
            $('#notif-dropdown')?.classList.add('hidden');

            // If it's an application notification, open the applicant detail modal
            if (meta.applicant) {
                openApplicantDetailModal(meta);
            }

            // If it's an employer contact notification, show employer info
            if (meta.employer_id) {
                const empName = meta.employer_name || 'An employer';
                const empCompany = meta.employer_company ? ` from ${meta.employer_company}` : '';
                const empEmail = meta.employer_email || '';
                const subject = meta.subject || '';
                showToast(`${empName}${empCompany} contacted you! Check your email.`, 'success');
                if (empEmail) {
                    window.open(`mailto:${empEmail}?subject=Re: ${encodeURIComponent(subject)}`, '_blank');
                }
            }

            // Refresh badge
            pollUnreadCount();
        };

        // Update badge
        const unreadCount = notifications.filter(n => !n.is_read).length;
        updateNotifBadge(unreadCount);
    } catch (err) {
        list.innerHTML = '<div class="notif-empty">Failed to load notifications</div>';
    }
}

function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


function openApplicantDetailModal(meta) {
    const applicant = meta.applicant || {};
    const jobTitle = meta.job_title || 'Unknown Job';

    $('#applicant-job-title').textContent = jobTitle;

    const avatarContent = applicant.profile_picture
        ? `<img src="${applicant.profile_picture}" alt="">`
        : (applicant.full_name ? applicant.full_name.charAt(0).toUpperCase() : '?');

    const skills = (applicant.skills || []).map(s =>
        `<span class="skill-chip">${escapeHTML(s.skill_name)}</span>`
    ).join('');

    const body = $('#applicant-detail-body');
    body.innerHTML = `
        <div class="applicant-detail">
            <div class="applicant-header">
                <div class="applicant-avatar-lg">${avatarContent}</div>
                <div class="applicant-header-info">
                    <h3>${escapeHTML(applicant.full_name || 'Unknown')}</h3>
                    <p>${escapeHTML(applicant.title || 'No title specified')}</p>
                </div>
            </div>

            <div class="applicant-info-grid">
                <div class="applicant-info-item">
                    <span class="label">📧 Email</span>
                    <span class="value">${escapeHTML(applicant.email || '—')}</span>
                </div>
                <div class="applicant-info-item">
                    <span class="label">📱 Phone</span>
                    <span class="value">${escapeHTML(applicant.phone_number || 'Not provided')}</span>
                </div>
                <div class="applicant-info-item">
                    <span class="label">📅 Experience</span>
                    <span class="value">${applicant.experience_years ? applicant.experience_years + ' years' : 'Not specified'}</span>
                </div>
                <div class="applicant-info-item">
                    <span class="label">🎓 Education</span>
                    <span class="value">${escapeHTML(applicant.education_level || 'Not specified')}</span>
                </div>
                <div class="applicant-info-item">
                    <span class="label">🏢 Company</span>
                    <span class="value">${escapeHTML(applicant.company_name || 'Not specified')}</span>
                </div>
                <div class="applicant-info-item">
                    <span class="label">📄 CV</span>
                    <span class="value">${applicant.cv_filename ? escapeHTML(applicant.cv_filename) : 'No CV uploaded'}</span>
                </div>
            </div>

            ${applicant.bio ? `
                <div class="applicant-section">
                    <h4>About</h4>
                    <p>${escapeHTML(applicant.bio)}</p>
                </div>
            ` : ''}

            ${applicant.cover_letter ? `
                <div class="applicant-section">
                    <h4>Cover Letter</h4>
                    <p>${escapeHTML(applicant.cover_letter)}</p>
                </div>
            ` : ''}

            ${skills ? `
                <div class="applicant-section">
                    <h4>Skills</h4>
                    <div class="applicant-skills-cloud">${skills}</div>
                </div>
            ` : ''}

            ${meta.application_id ? `
                <div class="applicant-actions">
                    <button class="btn btn-primary btn-sm" onclick="updateApplicationStatus(${meta.application_id}, 'accepted')">
                        ✓ Accept
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="updateApplicationStatus(${meta.application_id}, 'reviewing')">
                        👁 Reviewing
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="updateApplicationStatus(${meta.application_id}, 'rejected')">
                        ✕ Reject
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    $('#applicant-modal').classList.remove('hidden');
}

async function updateApplicationStatus(appId, status) {
    try {
        await apiPut(`/api/applications/${appId}/status`, { status });
        showToast(`Application ${status}`, 'success');
        $('#applicant-modal').classList.add('hidden');
    } catch (err) {
        showToast(err.message || 'Failed to update status', 'error');
    }
}
window.updateApplicationStatus = updateApplicationStatus;

// ============================================
// Job Delete with Inline Confirmation
// ============================================

function confirmDeleteJob(jobId, buttonEl) {
    const card = buttonEl.closest('.job-card');
    const existing = card.querySelector('.job-delete-confirm');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'job-delete-confirm';
    overlay.innerHTML = `
        <p>Are you sure you want to delete this job listing?</p>
        <div class="confirm-actions">
            <button class="btn btn-danger btn-sm" id="confirm-yes">Delete</button>
            <button class="btn btn-ghost btn-sm" id="confirm-no">Cancel</button>
        </div>
    `;
    card.appendChild(overlay);

    overlay.querySelector('#confirm-yes').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteJob(jobId);
        overlay.remove();
    });

    overlay.querySelector('#confirm-no').addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.remove();
    });
}
window.confirmDeleteJob = confirmDeleteJob;

async function deleteJob(jobId) {
    try {
        await apiDelete(`/api/jobs/${jobId}`);
        showToast('Job deleted successfully', 'success');
        loadJobs();
    } catch (err) {
        showToast(err.message || 'Failed to delete job', 'error');
    }
}
window.deleteJob = deleteJob;

// ============================================
// Profile Page
// ============================================

function initProfile() {
    $('#btn-edit-profile')?.addEventListener('click', openEditProfileModal);
    $('#profile-modal-close')?.addEventListener('click', () => {
        $('#profile-modal').classList.add('hidden');
    });
    $('#profile-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#profile-modal')) $('#profile-modal').classList.add('hidden');
    });
    $('#profile-form')?.addEventListener('submit', handleProfileSave);

    // Avatar upload
    $('#btn-change-avatar')?.addEventListener('click', () => {
        if (!authToken) { openAuthModal(true); return; }
        $('#avatar-file-input').click();
    });
    $('#avatar-file-input')?.addEventListener('change', handleAvatarUpload);

    // Clicking user avatar/name in navbar goes to profile
    $('#user-avatar')?.addEventListener('click', () => {
        if (currentUser) navigateTo('profile');
    });
    $('#user-name')?.addEventListener('click', () => {
        if (currentUser) navigateTo('profile');
    });
}

function loadProfileData() {
    if (!currentUser) return;
    const u = currentUser;

    // Header
    $('#profile-full-name').textContent = u.full_name || 'Your Name';
    $('#profile-title-text').textContent = u.title || 'Add your job title';
    $('#profile-avatar-letter').textContent = u.full_name?.charAt(0)?.toUpperCase() || 'U';

    // Avatar image
    if (u.profile_picture) {
        $('#profile-avatar-img').src = u.profile_picture;
        $('#profile-avatar-img').classList.remove('hidden');
        $('#profile-avatar-letter').classList.add('hidden');
    } else {
        $('#profile-avatar-img').classList.add('hidden');
        $('#profile-avatar-letter').classList.remove('hidden');
    }

    // Role badge
    const roleBadge = $('#profile-role-badge');
    if (roleBadge) {
        roleBadge.textContent = u.role;
        roleBadge.className = `badge badge-role-${u.role}`;
    }

    // Joined date
    if (u.created_at) {
        const d = new Date(u.created_at);
        $('#profile-joined').textContent = `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }

    // Info grid
    $('#profile-email').textContent = u.email || '—';
    $('#profile-phone').textContent = u.phone_number || 'Not set';
    $('#profile-title').textContent = u.title || 'Not set';
    $('#profile-company').textContent = u.company_name || 'Not set';
    $('#profile-experience').textContent = u.experience_years ? `${u.experience_years} years` : 'Not set';
    $('#profile-education').textContent = u.education_level || 'Not set';

    // Bio
    $('#profile-bio').textContent = u.bio || 'No bio added yet. Click "Edit Profile" to tell others about yourself.';

    // Skills
    const skillsCloud = $('#profile-skills-cloud');
    if (u.skills && u.skills.length > 0) {
        $('#profile-skill-count').textContent = `${u.skills.length} skill${u.skills.length !== 1 ? 's' : ''}`;
        skillsCloud.innerHTML = u.skills.map((s, i) =>
            `<span class="skill-chip" style="animation-delay:${i * 0.03}s">${escapeHTML(s.skill_name)}</span>`
        ).join('');
    } else {
        $('#profile-skill-count').textContent = '0 skills';
        skillsCloud.innerHTML = '<p class="text-muted" style="font-size:14px;">No skills extracted yet. Upload your CV to get started.</p>';
    }

    // Account card
    const statusEl = $('#profile-status');
    if (statusEl) {
        statusEl.textContent = u.status || 'Active';
        statusEl.className = `info-value badge badge-status-${u.status || 'active'}`;
    }
    $('#profile-role-text').textContent = u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Searcher';
    $('#profile-cv-status').textContent = u.cv_filename ? u.cv_filename : 'No';
}

function openEditProfileModal() {
    if (!currentUser) { openAuthModal(true); return; }
    const u = currentUser;
    $('#edit-full-name').value = u.full_name || '';
    $('#edit-phone').value = u.phone_number || '';
    $('#edit-title').value = u.title || '';
    $('#edit-company').value = u.company_name || '';
    $('#edit-experience').value = u.experience_years || '';
    $('#edit-education').value = u.education_level || '';
    $('#edit-bio').value = u.bio || '';
    $('#profile-modal').classList.remove('hidden');
}

async function handleProfileSave(e) {
    e.preventDefault();
    const btn = $('#profile-form').querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Saving...';

    try {
        const body = {
            full_name: $('#edit-full-name').value || undefined,
            phone_number: $('#edit-phone').value || null,
            title: $('#edit-title').value || null,
            company_name: $('#edit-company').value || null,
            experience_years: $('#edit-experience').value ? parseInt($('#edit-experience').value) : null,
            education_level: $('#edit-education').value || null,
            bio: $('#edit-bio').value || null,
        };

        const updated = await apiPut('/api/users/me', body);
        currentUser = updated;
        updateUserUI();
        loadProfileData();
        $('#profile-modal').classList.add('hidden');
        showToast('Profile updated successfully!', 'success');
    } catch (err) {
        showToast(err.message || 'Failed to update profile', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image too large (max 2MB)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const maxSize = 200;
            let w = img.width, h = img.height;
            if (w > h) { h = h * maxSize / w; w = maxSize; }
            else { w = w * maxSize / h; h = maxSize; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const resized = canvas.toDataURL('image/jpeg', 0.8);

            try {
                const updated = await apiPut('/api/users/me', { profile_picture: resized });
                currentUser = updated;
                updateUserUI();
                loadProfileData();
                showToast('Profile photo updated!', 'success');
            } catch (err) {
                showToast(err.message || 'Failed to update photo', 'error');
            }
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

// ============================================
// API Helpers
// ============================================

async function apiGet(url) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE}${url}`, { headers });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return data;
}

async function apiPost(url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return data;
}

async function apiPut(url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE}${url}`, {
        method: 'PUT',
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return data;
}

async function apiDelete(url) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE}${url}`, {
        method: 'DELETE',
        headers,
    });

    if (res.status === 204) return {};

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return data;
}

// ============================================
// Utilities
// ============================================

async function loadInitialData() {
    try {
        const data = await apiGet('/api/jobs/?limit=1');
        $('#stat-jobs').textContent = data.total || 0;
    } catch {
        // API not ready yet
    }
}

function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// Find Talent (Global Search — Employer Only)
// ============================================

function initTalentSearch() {
    $('#btn-search-talent')?.addEventListener('click', searchTalent);

    // Enter key triggers search
    ['#talent-search-q', '#talent-search-skills', '#talent-search-education'].forEach(sel => {
        $(sel)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); searchTalent(); }
        });
    });
}

async function searchTalent() {
    const q = $('#talent-search-q')?.value?.trim() || '';
    const skills = $('#talent-search-skills')?.value?.trim() || '';
    const education = $('#talent-search-education')?.value?.trim() || '';

    if (!q && !skills && !education) {
        showToast('Enter at least one search parameter', 'info');
        return;
    }

    const btn = $('#btn-search-talent');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Searching...';

    try {
        let url = '/api/talent/search?limit=50';
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (skills) url += `&skills=${encodeURIComponent(skills)}`;
        if (education) url += `&education=${encodeURIComponent(education)}`;

        const data = await apiGet(url);

        $('#talent-results').classList.remove('hidden');
        $('#talent-results-count').textContent = `Found ${data.results.length} candidates`;

        if (data.results.length > 0) {
            $('#talent-results-grid').innerHTML = data.results.map(u => {
                cacheCandidateData({ ...u, user_id: u.id });
                const avatar = u.profile_picture
                    ? `<img src="${u.profile_picture}" alt="${escapeHTML(u.full_name)}">`
                    : escapeHTML(u.full_name?.charAt(0) || '?');

                const skillTags = (u.skills || []).slice(0, 8).map(s =>
                    `<span class="talent-skill-tag">${escapeHTML(s.skill_name)}</span>`
                ).join('');
                const moreSkills = u.total_skills > 8 ? `<span class="talent-skill-tag">+${u.total_skills - 8}</span>` : '';

                return `
                    <div class="talent-card">
                        <div class="talent-card-header">
                            <div class="talent-avatar">${avatar}</div>
                            <div class="talent-info">
                                <h3>${escapeHTML(u.full_name)}</h3>
                                <p>${escapeHTML(u.title || u.email)}</p>
                            </div>
                        </div>
                        <div class="talent-meta">
                            ${u.experience_years ? `<span>📅 ${u.experience_years} yrs exp</span>` : ''}
                            ${u.education_level ? `<span>🎓 ${escapeHTML(u.education_level)}</span>` : ''}
                            <span>🔧 ${u.total_skills} skills</span>
                        </div>
                        <div class="talent-skills">${skillTags}${moreSkills}</div>
                        <button class="btn-view-profile" style="margin-top:10px;width:100%" onclick="openCandidateProfile(${u.id})">
                            👤 View Profile & Contact
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            $('#talent-results-grid').innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <div class="empty-icon">🔍</div>
                    <h3>No talent found</h3>
                    <p>Try broadening your search terms</p>
                </div>
            `;
        }

        showToast(`Found ${data.results.length} candidates`, 'success');
    } catch (err) {
        showToast(err.message || 'Talent search failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Search
        `;
    }
}

// ============================================
// Best Candidates (Per-Job Top 10)
// ============================================

let currentBestJobId = null;

function initBestCandidates() {
    $('#best-candidates-close')?.addEventListener('click', () => {
        $('#best-candidates-modal').classList.add('hidden');
    });
    $('#best-candidates-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#best-candidates-modal')) $('#best-candidates-modal').classList.add('hidden');
    });
    $('#btn-bc-filter')?.addEventListener('click', () => {
        if (currentBestJobId) loadBestCandidates(currentBestJobId);
    });
    // Enter key on filters
    ['#bc-filter-q', '#bc-filter-skills', '#bc-filter-education'].forEach(sel => {
        $(sel)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (currentBestJobId) loadBestCandidates(currentBestJobId); }
        });
    });
}

async function openBestCandidates(jobId, jobTitle) {
    currentBestJobId = jobId;
    $('#best-candidates-job-title').textContent = jobTitle;
    // Reset filters
    $('#bc-filter-q').value = '';
    $('#bc-filter-skills').value = '';
    $('#bc-filter-education').value = '';
    $('#best-candidates-modal').classList.remove('hidden');
    await loadBestCandidates(jobId);
}
window.openBestCandidates = openBestCandidates;

async function loadBestCandidates(jobId) {
    const body = $('#best-candidates-body');
    body.innerHTML = '<div style="text-align:center;padding:32px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Finding best candidates...</p></div>';

    const q = $('#bc-filter-q')?.value?.trim() || '';
    const skills = $('#bc-filter-skills')?.value?.trim() || '';
    const education = $('#bc-filter-education')?.value?.trim() || '';

    try {
        let url = `/api/talent/best/${jobId}?`;
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (skills) url += `&skills=${encodeURIComponent(skills)}`;
        if (education) url += `&education=${encodeURIComponent(education)}`;

        const data = await apiGet(url);

        if (data.candidates.length === 0) {
            body.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>No matching candidates</h3>
                    <p>No job searchers match the criteria yet</p>
                </div>
            `;
            return;
        }

        body.innerHTML = data.candidates.map((c, idx) => {
            cacheCandidateData(c);
            const rank = idx + 1;
            const cId = c.user_id || c.id;
            const scoreColor = c.score >= 70 ? 'var(--success)' :
                               c.score >= 40 ? 'var(--warning)' : 'var(--error)';

            const matchedSkills = (c.matched_skills || []).slice(0, 6).map(s =>
                `<span class="skill-tag" style="font-size:10px;padding:2px 6px">${escapeHTML(s)}</span>`
            ).join('');
            const missingSkills = (c.missing_skills || []).slice(0, 4).map(s =>
                `<span class="skill-tag" style="font-size:10px;padding:2px 6px;opacity:0.5;text-decoration:line-through">${escapeHTML(s)}</span>`
            ).join('');

            return `
                <div class="bc-card">
                    <div class="bc-rank ${rank <= 3 ? 'top-3' : ''}">${rank}</div>
                    <div class="bc-info">
                        <h4>${escapeHTML(c.full_name)}</h4>
                        <div class="bc-title">${escapeHTML(c.title || c.email)}</div>
                        <div class="bc-meta">
                            ${c.experience_years ? `<span>📅 ${c.experience_years} yrs</span>` : ''}
                            ${c.education_level ? `<span>🎓 ${escapeHTML(c.education_level)}</span>` : ''}
                            <span>🔧 ${c.total_skills} skills</span>
                            <span>🎯 ${c.experience_fit}</span>
                        </div>
                        <div class="bc-skills-row">
                            ${matchedSkills}${missingSkills}
                        </div>
                        <button class="btn-view-profile" style="margin-top:8px" onclick="openCandidateProfile(${cId})">
                            👤 View Profile & Contact
                        </button>
                    </div>
                    <div class="bc-score">
                        <div class="score-circle" style="border-color:${scoreColor};color:${scoreColor}">${c.score}%</div>
                        <span class="score-label">Fit</span>
                    </div>
                </div>
            `;
        }).join('');

        showToast(`Top ${data.candidates.length} candidates loaded`, 'success');
    } catch (err) {
        body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error loading candidates</h3><p>${escapeHTML(err.message)}</p></div>`;
    }
}

// ============================================
// Candidate Profile Modal
// ============================================

// Cache candidate data from search results to avoid extra API calls
window._candidateCache = {};

function initCandidateProfile() {
    $('#candidate-profile-close')?.addEventListener('click', () => {
        $('#candidate-profile-modal').classList.add('hidden');
    });
    $('#candidate-profile-modal')?.addEventListener('click', (e) => {
        if (e.target === $('#candidate-profile-modal')) $('#candidate-profile-modal').classList.add('hidden');
    });
}

function cacheCandidateData(candidate) {
    // Normalize different field shapes from different endpoints
    const id = candidate.user_id || candidate.id;
    window._candidateCache[id] = {
        id,
        full_name: candidate.full_name,
        email: candidate.email,
        title: candidate.title,
        experience_years: candidate.experience_years,
        education_level: candidate.education_level,
        bio: candidate.bio,
        phone_number: candidate.phone_number,
        profile_picture: candidate.profile_picture,
        cv_filename: candidate.cv_filename,
        skills: candidate.skills || [],
        total_skills: candidate.total_skills,
        matched_skills: candidate.matched_skills || [],
        missing_skills: candidate.missing_skills || [],
        score: candidate.score,
        experience_fit: candidate.experience_fit,
        application_status: candidate.application_status,
        cover_letter: candidate.cover_letter,
        applied_at: candidate.applied_at,
    };
}

async function openCandidateProfile(userId) {
    const modal = $('#candidate-profile-modal');
    const body = $('#candidate-profile-body');
    modal.classList.remove('hidden');
    body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Loading profile...</p></div>';

    let c = window._candidateCache[userId];

    // If not cached, try to fetch from talent search API
    if (!c) {
        try {
            const data = await apiGet(`/api/talent/search?q=&skills=&education=&limit=100`);
            const found = data.results.find(r => r.id === userId);
            if (found) {
                cacheCandidateData(found);
                c = window._candidateCache[userId];
            }
        } catch { /* fallback below */ }
    }

    if (!c) {
        body.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Profile not available</h3></div>';
        return;
    }

    const avatar = c.profile_picture
        ? `<img src="${c.profile_picture}" alt="${escapeHTML(c.full_name)}">`
        : escapeHTML(c.full_name?.charAt(0) || '?');

    const skillsHtml = (c.skills || []).map(s => {
        const name = s.skill_name || s;
        return `<span class="skill-tag">${escapeHTML(typeof name === 'string' ? name : name)}</span>`;
    }).join('');

    const matchedHtml = (c.matched_skills || []).map(s =>
        `<span class="skill-matched">${escapeHTML(s)}</span>`
    ).join('');

    const missingHtml = (c.missing_skills || []).map(s =>
        `<span class="skill-missing">${escapeHTML(s)}</span>`
    ).join('');

    body.innerHTML = `
        <div class="cp-header">
            <div class="cp-avatar">${avatar}</div>
            <div>
                <h2 class="cp-name">${escapeHTML(c.full_name)}</h2>
                <p class="cp-title">${escapeHTML(c.title || 'Job Searcher')}</p>
            </div>
        </div>

        <div class="cp-meta-row">
            ${c.experience_years ? `<div class="cp-meta-item">📅 ${c.experience_years} years experience</div>` : ''}
            ${c.education_level ? `<div class="cp-meta-item">🎓 ${escapeHTML(c.education_level)}</div>` : ''}
            ${c.total_skills || (c.skills && c.skills.length) ? `<div class="cp-meta-item">🔧 ${c.total_skills || c.skills.length} skills</div>` : ''}
            ${c.cv_filename ? `<div class="cp-meta-item">📄 CV uploaded</div>` : ''}
            ${c.score !== undefined && c.score !== null ? `<div class="cp-meta-item">🎯 ${c.score}% match fit</div>` : ''}
            ${c.experience_fit ? `<div class="cp-meta-item">📊 ${c.experience_fit}</div>` : ''}
        </div>

        ${c.bio ? `
            <div class="cp-section">
                <h4>About</h4>
                <div class="cp-bio">${escapeHTML(c.bio)}</div>
            </div>
        ` : ''}

        ${skillsHtml ? `
            <div class="cp-section">
                <h4>Skills</h4>
                <div class="cp-skills-grid">${skillsHtml}</div>
            </div>
        ` : ''}

        ${matchedHtml ? `
            <div class="cp-section">
                <h4>✅ Matched Skills</h4>
                <div class="cp-skills-grid">${matchedHtml}</div>
            </div>
        ` : ''}

        ${missingHtml ? `
            <div class="cp-section">
                <h4>❌ Missing Skills</h4>
                <div class="cp-skills-grid">${missingHtml}</div>
            </div>
        ` : ''}

        ${c.cover_letter ? `
            <div class="cp-section">
                <h4>📝 Cover Letter</h4>
                <div class="cp-bio">${escapeHTML(c.cover_letter)}</div>
            </div>
        ` : ''}

        <div class="cp-contact-section">
            <h4>📬 Contact This Candidate</h4>
            <textarea id="cp-contact-message" placeholder="Write a message to the candidate (optional)..."></textarea>
            <div class="cp-contact-actions">
                <button class="btn-contact btn-contact-primary" onclick="contactCandidate(${c.id}, '${escapeHTML(c.email)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    Send & Notify Candidate
                </button>
                <button class="btn-contact btn-contact-email" onclick="window.open('mailto:${escapeHTML(c.email)}', '_blank')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Open Email Client
                </button>
            </div>
        </div>
    `;
}
window.openCandidateProfile = openCandidateProfile;

async function contactCandidate(userId, email) {
    const messageEl = $('#cp-contact-message');
    const message = messageEl?.value?.trim() || '';

    try {
        await apiPost(`/api/talent/contact/${userId}`, {
            message,
            subject: 'Employer is interested in your profile',
        });

        showToast('Candidate notified successfully!', 'success');

        // Also open mailto with the message pre-filled
        const subject = encodeURIComponent('Opportunity from ' + (currentUser?.company_name || currentUser?.full_name || 'An employer'));
        const body = encodeURIComponent(message || 'Hi, I found your profile on JobsMatchAI and would like to discuss an opportunity with you.');
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');

        if (messageEl) messageEl.value = '';
    } catch (err) {
        showToast(err.message || 'Failed to contact candidate', 'error');
    }
}
window.contactCandidate = contactCandidate;
