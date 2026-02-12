/**
 * SECA JEJUM QUIZ - JavaScript Controller
 * Handles quiz navigation, data collection, and UI interactions
 */

// ============================================
// DEBUG SYSTEM
// ============================================
const DEBUG_MODE = window.location.search.includes('debug=true');
const IS_LOCALHOST = window.location.hostname === 'localhost';

function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';

    // Always log to console on localhost or if debug is active
    if (IS_LOCALHOST || DEBUG_MODE) {
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    if (DEBUG_MODE) {
        const debugDiv = document.getElementById('debug-console') || createDebugConsole();
        const entry = document.createElement('div');
        entry.style.cssText = `
            padding: 6px 10px;
            margin: 2px 0;
            background: ${type === 'error' ? '#ffebee' : type === 'warn' ? '#fff3e0' : type === 'success' ? '#e8f5e9' : '#f5f5f5'};
            border-left: 4px solid ${type === 'error' ? '#f44336' : type === 'warn' ? '#ff9800' : type === 'success' ? '#4CAF50' : '#2196F3'};
            font-size: 11px;
            font-family: 'Courier New', monospace;
            color: #333;
            word-wrap: break-word;
        `;
        entry.textContent = `${prefix} [${timestamp}] ${message}`;
        debugDiv.appendChild(entry);
        debugDiv.scrollTop = debugDiv.scrollHeight;

        // Limit to 50 entries
        if (debugDiv.children.length > 50) {
            debugDiv.removeChild(debugDiv.firstChild);
        }
    }
}

function createDebugConsole() {
    const div = document.createElement('div');
    div.id = 'debug-console';
    div.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 250px;
        overflow-y: auto;
        background: white;
        border-top: 3px solid #333;
        z-index: 99999;
        padding: 10px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
        font-family: monospace;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        font-weight: bold;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 2px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <span>🔍 DEBUG CONSOLE (Tracking Diagnostics)</span>
        <button onclick="document.getElementById('debug-console').remove()" style="
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        ">Fechar</button>
    `;
    div.appendChild(header);
    document.body.appendChild(div);

    debugLog('Debug console initialized', 'success');
    return div;
}

// ============================================
// META EVENT HELPERS
// ============================================

function generateEventId() {
    // Generate unique event ID for deduplication
    // Format: timestamp + random string
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getMetaCookies() {
    // Read Meta's tracking cookies for enhanced matching
    const cookies = document.cookie.split(';');
    let fbc = null;
    let fbp = null;

    cookies.forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name === '_fbc') fbc = value;
        if (name === '_fbp') fbp = value;
    });

    debugLog(`Meta cookies: fbc=${fbc ? 'present' : 'null'}, fbp=${fbp ? 'present' : 'null'}`);
    return { fbc, fbp };
}

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://bwpjmowuqkwogbtnheyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cGptb3d1cWt3b2didG5oZXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc5MjEsImV4cCI6MjA4NTczMzkyMX0.RFSrtexhbic7fTn51gTFuJlmSuo5-9Ciyp367f8I_8A';

let supabase = null;
let supabaseRetryCount = 0;
const MAX_SUPABASE_RETRIES = 3;

async function initSupabase() {
    if (supabase) {
        debugLog('Supabase already initialized', 'success');
        return supabase;
    }

    debugLog('Attempting to initialize Supabase...');

    if (!window.supabase) {
        debugLog('⚠️ window.supabase not found! CDN may not have loaded.', 'error');

        if (supabaseRetryCount < MAX_SUPABASE_RETRIES) {
            supabaseRetryCount++;
            debugLog(`Retry ${supabaseRetryCount}/${MAX_SUPABASE_RETRIES} in ${supabaseRetryCount}s...`, 'warn');
            await new Promise(resolve => setTimeout(resolve, 1000 * supabaseRetryCount));
            return initSupabase();
        } else {
            debugLog('❌ CRITICAL: Supabase library failed to load after 3 retries!', 'error');
            debugLog('Tracking will NOT work. Check your internet connection.', 'error');
            return null;
        }
    }

    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        debugLog('✅ Supabase client created successfully!', 'success');
        debugLog(`URL: ${SUPABASE_URL}`, 'info');
        return supabase;
    } catch (err) {
        debugLog(`❌ Error creating Supabase client: ${err.message}`, 'error');
        return null;
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================

function getVisitorId() {
    let id = localStorage.getItem('seca_visitor_id');
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : 'v_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('seca_visitor_id', id);
    }
    return id;
}

const quizState = {
    currentStep: 0,
    totalSteps: 42,
    sessionId: null, // Tracks database ID
    answers: {},
    userData: {
        height: null,
        currentWeight: null,
        targetWeight: null,
        age: null,
        visitorId: getVisitorId()
    }
};

// ============================================
// TRACKING FUNCTIONS
// ============================================

async function initSession() {
    // PREVENT DEBUG/LOCALHOST SESSIONS FROM POLLUTING METRICS
    if (IS_LOCALHOST || DEBUG_MODE) {
        debugLog('⚠️ Tracking DISABLED (localhost or debug mode)', 'warn');
        debugLog('Session will NOT be saved to database', 'warn');
        return;
    }

    debugLog('=== INIT SESSION STARTED ===');
    debugLog(`Visitor ID: ${quizState.userData.visitorId}`);

    const client = await initSupabase();

    if (!client) {
        debugLog('❌ Cannot init session: Supabase client is NULL', 'error');
        debugLog('Session will NOT be tracked in database!', 'error');
        return;
    }

    debugLog('Supabase client ready, creating session record...');

    try {
        const sessionData = {
            device_info: navigator.userAgent,
            current_step: 1,
            user_data: { visitorId: quizState.userData.visitorId }
        };

        debugLog(`Inserting session: ${JSON.stringify(sessionData)}`);

        const { data, error } = await client
            .from('quiz_sessions')
            .insert([sessionData])
            .select()
            .single();

        if (error) {
            debugLog(`❌ Supabase INSERT error: ${error.message}`, 'error');
            debugLog(`Error code: ${error.code}`, 'error');
            debugLog(`Error details: ${JSON.stringify(error)}`, 'error');
            return;
        }

        if (data) {
            quizState.sessionId = data.id;
            debugLog(`✅ Session created successfully! ID: ${data.id}`, 'success');
            debugLog(`Session data: ${JSON.stringify(data)}`, 'success');
            trackMetaEvent('ViewContent', { content_name: 'Quiz Start' });
        } else {
            debugLog('⚠️ No data returned from insert (unexpected)', 'warn');
        }
    } catch (err) {
        debugLog(`❌ CRITICAL ERROR in initSession: ${err.message}`, 'error');
        debugLog(`Stack: ${err.stack}`, 'error');
    }

    debugLog('=== INIT SESSION COMPLETED ===');
}

async function updateSession() {
    // PREVENT DEBUG/LOCALHOST SESSIONS FROM POLLUTING METRICS
    if (IS_LOCALHOST || DEBUG_MODE) {
        debugLog('⚠️ Update tracking DISABLED (localhost or debug mode)', 'warn');
        return;
    }

    debugLog(`=== UPDATE SESSION (Step ${quizState.currentStep}) ===`);

    const client = await initSupabase();
    if (!client) {
        debugLog('❌ Cannot update: Supabase not available', 'error');
        return;
    }

    if (!quizState.sessionId) {
        debugLog('⚠️ No Session ID found. Attempting to init session...', 'warn');
        await initSession();
        if (!quizState.sessionId) {
            debugLog('❌ Still no Session ID after init attempt', 'error');
            return;
        }
    }

    try {
        debugLog(`Updating session ${quizState.sessionId} to step ${quizState.currentStep}`);

        const updateData = {
            current_step: quizState.currentStep,
            updated_at: new Date().toISOString(),
            user_data: quizState.userData,
            answers: quizState.answers
        };

        // Mark completed if we're at the end
        if (quizState.currentStep >= quizState.totalSteps) {
            updateData.completed = true;
            debugLog('🎉 Quiz completed! Marking as complete...', 'success');
            trackMetaEvent('Lead', { content_name: 'Quiz Completed' });
        }

        const { error } = await client
            .from('quiz_sessions')
            .update(updateData)
            .eq('id', quizState.sessionId);

        if (error) {
            debugLog(`❌ Update error: ${error.message}`, 'error');
            debugLog(`Error details: ${JSON.stringify(error)}`, 'error');
        } else {
            debugLog(`✅ Session updated to step ${quizState.currentStep}`, 'success');
        }
    } catch (err) {
        debugLog(`❌ Update exception: ${err.message}`, 'error');
    }
}

// ============================================
// META CAPI / PIXEL TRACKING
// ============================================

async function trackMetaEvent(eventName, customData = {}) {
    // Generate unique event_id for deduplication between Pixel and CAPI
    const eventId = generateEventId();

    debugLog(`📊 Tracking ${eventName} with event_id: ${eventId}`);

    // 1. Browser Pixel (Standard) - WITH event_id
    if (window.fbq) {
        try {
            window.fbq('track', eventName, customData, {
                eventID: eventId  // CRITICAL for deduplication
            });
            debugLog(`✅ Pixel event sent: ${eventName}`, 'success');
        } catch (err) {
            debugLog(`❌ Pixel error: ${err.message}`, 'error');
        }
    } else {
        debugLog('⚠️ Meta Pixel not loaded', 'warn');
    }

    // 2. Server CAPI (Vercel Function) - WITH same event_id
    try {
        const { fbc, fbp } = getMetaCookies();

        const body = {
            event_name: eventName,
            event_id: eventId,  // SAME ID as Pixel for deduplication
            event_source_url: window.location.href,
            user_data: {
                fbc: fbc,  // Meta click ID cookie
                fbp: fbp,  // Meta browser ID cookie
                external_id: quizState.userData.visitorId  // Consistent visitor ID
            },
            custom_data: {
                ...customData,
                session_id: quizState.sessionId
            }
        };

        debugLog(`📡 Sending CAPI: ${JSON.stringify({ event_name: eventName, event_id: eventId })}`);

        // Fire and forget (don't block UX)
        fetch('/api/capi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    debugLog(`✅ CAPI event sent: ${eventName}`, 'success');
                } else {
                    debugLog(`❌ CAPI error: ${JSON.stringify(data)}`, 'error');
                }
            })
            .catch(err => {
                debugLog(`⚠️ CAPI warning: ${err.message}`, 'warn');
            });

    } catch (e) {
        debugLog(`❌ CAPI dispatch failed: ${e.message}`, 'error');
    }
}


// ============================================
// DOM ELEMENTS
// ============================================

let elements = {};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initQuiz();
    setupEventListeners();
});

function initElements() {
    elements = {
        progressBar: document.getElementById('progressBar'),
        backBtn: document.getElementById('backBtn'),
        stickyWarning: document.getElementById('stickyWarning'),
        steps: document.querySelectorAll('.quiz-step'),
        optionCards: document.querySelectorAll('.option-card'),
        foodBtns: document.querySelectorAll('.food-btn'),
        continueBtns: document.querySelectorAll('.continue-btn'),
        faqItems: document.querySelectorAll('.faq-item'),

        // Metric inputs
        heightInput: document.getElementById('heightInput'),
        currentWeightInput: document.getElementById('currentWeightInput'),
        targetWeightInput: document.getElementById('targetWeightInput'),
        ageInput: document.getElementById('ageInput'),
        bmiResult: document.getElementById('bmiResult'),

        // Continue buttons for metrics
        heightContinue: document.getElementById('heightContinue'),
        weightContinue: document.getElementById('weightContinue'),
        targetContinue: document.getElementById('targetContinue'),
        ageContinue: document.getElementById('ageContinue')
    };
}

function initQuiz() {
    updateProgressBar();
    updateBackButton();
    updateStickyWarning();

    // Add visual status indicator
    createStatusIndicator();

    // Start tracking
    debugLog('🚀 Initializing quiz and starting session tracking...');
    initSession();
}

// ============================================
// VISUAL STATUS INDICATOR
// ============================================

function createStatusIndicator() {
    // Only show status indicator in debug mode
    if (!DEBUG_MODE) return;

    const indicator = document.createElement('div');
    indicator.id = 'tracking-status';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9998;
        background: #ff9800;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
    `;
    indicator.textContent = '⏳ Conectando...';
    document.body.appendChild(indicator);

    // Update status after Supabase init
    setTimeout(async () => {
        const client = await initSupabase();
        if (client && quizState.sessionId) {
            indicator.style.background = '#4CAF50';
            indicator.textContent = '✅ Tracking Ativo';
            debugLog('Status indicator: Tracking active', 'success');
        } else {
            indicator.style.background = '#f44336';
            indicator.textContent = '❌ Tracking Offline';
            debugLog('Status indicator: Tracking FAILED', 'error');
        }
    }, 2000);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Event Delegation for dynamic elements and reliability
    document.addEventListener('click', (e) => {
        const target = e.target;

        // Option cards
        const optionCard = target.closest('.option-card');
        if (optionCard) {
            handleOptionSelect(optionCard);
            return;
        }

        // Food buttons
        const foodBtn = target.closest('.food-btn');
        if (foodBtn) {
            handleFoodSelect(foodBtn);
            return;
        }

        // Continue buttons
        const continueBtn = target.closest('.continue-btn');
        if (continueBtn) {
            // Ignore metric buttons handled separately
            if (['heightContinue', 'weightContinue', 'targetContinue', 'ageContinue'].includes(continueBtn.id)) {
                return;
            }
            handleContinue(continueBtn);
            return;
        }

        // FAQ items
        const faqHeader = target.closest('.faq-question');
        if (faqHeader) {
            const faqItem = faqHeader.closest('.faq-item');
            toggleFaq(faqItem);
            return;
        }
    });

    // Back button
    // Check if element exists before adding listener
    if (elements.backBtn) {
        elements.backBtn.addEventListener('click', goToPreviousStep);
    }

    // Metric inputs
    if (elements.heightContinue) {
        elements.heightContinue.addEventListener('click', () => {
            const value = elements.heightInput.value;
            if (value && value >= 100 && value <= 250) {
                quizState.userData.height = parseInt(value);
                goToNextStep();
            } else {
                shakeInput(elements.heightInput);
            }
        });
    }

    if (elements.weightContinue) {
        elements.weightContinue.addEventListener('click', () => {
            const value = elements.currentWeightInput.value;
            if (value && value >= 30 && value <= 300) {
                quizState.userData.currentWeight = parseInt(value);
                goToNextStep();
            } else {
                shakeInput(elements.currentWeightInput);
            }
        });
    }

    if (elements.targetContinue) {
        elements.targetContinue.addEventListener('click', () => {
            const value = elements.targetWeightInput.value;
            if (value && value >= 30 && value <= 200) {
                quizState.userData.targetWeight = parseInt(value);
                calculateAndShowBMI();
                goToNextStep();
            } else {
                shakeInput(elements.targetWeightInput);
            }
        });
    }

    if (elements.ageContinue) {
        elements.ageContinue.addEventListener('click', () => {
            const value = elements.ageInput.value;
            if (value && value >= 18 && value <= 100) {
                quizState.userData.age = parseInt(value);
                goToNextStep();
            } else {
                shakeInput(elements.ageInput);
            }
        });
    }

    // Enter key for metric inputs
    [elements.heightInput, elements.currentWeightInput, elements.targetWeightInput, elements.ageInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const continueBtn = input.closest('.quiz-step').querySelector('.continue-btn');
                    if (continueBtn) continueBtn.click();
                }
            });
        }
    });
}

// ============================================
// NAVIGATION
// ============================================

function goToNextStep() {
    if (quizState.currentStep < quizState.totalSteps) {
        quizState.currentStep++;

        // SKIP STEP 1 (Age Range) - Requested removal
        if (quizState.currentStep === 1) {
            quizState.currentStep = 2;
        }

        // SKIP STEP 41 (Weight Loss Chart) - Requested removal
        if (quizState.currentStep === 41) {
            quizState.currentStep = 42;
        }

        updateUI();
        updateSession(); // Track progress

        // Initialize charts
        if (quizState.currentStep === 12) {
            setTimeout(initLibidoChart, 300);
        }
        if (quizState.currentStep === 38) {
            setTimeout(positionBMIArrow, 300);
        }
        if (quizState.currentStep === 39) {
            setTimeout(animateChartReveal, 300);
        }
        if (quizState.currentStep === 40) {
            setTimeout(startLoadingAnimation, 300);
        }
        // Step 41 skipped
        if (quizState.currentStep === 42) {
            setTimeout(initCarousel, 300);
            setTimeout(initVSL, 500); // Initialize VSL with smart delay
        }
    }
}

// ... existing code ...

// ============================================
// BMI ARROW POSITIONING (Step 38 - Hybrid System)
// ============================================

function positionBMIArrow() {
    const arrow = document.getElementById('bmiArrowNew');
    if (!arrow) return;

    const height = quizState.userData.height;
    const weight = quizState.userData.currentWeight;

    if (!height || !weight) {
        // Default position towards obese
        arrow.style.left = '70%';
        return;
    }

    // Calculate BMI
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);

    // Update arrow label with real BMI
    const bmiLabel = document.getElementById('bmiArrowLabel');
    if (bmiLabel) {
        bmiLabel.textContent = `Tú: ${bmi.toFixed(1)}`;
    }

    // Position arrow based on BMI value
    // BMI scale mapped to 5-zone gradient bar:
    // 0-20%: Turquoise (< 18.5)
    // 20-40%: Green (18.5-25)
    // 40-60%: Yellow (25-30)
    // 60-80%: Orange (30-35)
    // 80-100%: Red (>= 35)

    let position;
    if (bmi < 18.5) {
        // Underweight zone: 0-20%
        position = (bmi / 18.5) * 20;
    } else if (bmi < 25) {
        // Normal zone: 20-40%
        position = 20 + ((bmi - 18.5) / (25 - 18.5)) * 20;
    } else if (bmi < 30) {
        // Overweight zone: 40-60%
        position = 40 + ((bmi - 25) / (30 - 25)) * 20;
    } else if (bmi < 35) {
        // Obesity I zone: 60-80%
        position = 60 + ((bmi - 30) / (35 - 30)) * 20;
    } else {
        // Obesity II zone: 80-100%
        position = 80 + Math.min(((bmi - 35) / 10) * 20, 20);
    }

    // Precise positioning without bias
    // Clamp position between 0% and 100%
    position = Math.max(0, Math.min(100, position));

    arrow.style.left = `${position}%`;
}



// ============================================
// LIBIDO CHART (Step 12)
// ============================================

function initLibidoChart() {
    // Chart is now pure SVG - no JavaScript manipulation needed
    // Trigger entrance animation
    const chartCard = document.querySelector('.libido-chart-card');
    if (chartCard) {
        // Add animation class with slight delay
        setTimeout(() => {
            chartCard.classList.add('chart-animate');
        }, 100);
    }
}

// ============================================
// VSL SMART DELAY (Step 42)
// ============================================

let vslState = {
    revealed: false,
    timer: null,
    countdownTimer: null,
    countdownInterval: null
};

function initVSL() {
    const delayedOffer = document.getElementById('delayed-offer');
    const countdownEl = document.getElementById('countdown-timer');
    const vslCtaBtn = document.getElementById('vsl-cta-btn');

    if (!delayedOffer || vslState.revealed) return;

    debugLog('VSL initialized - Starting 135s delay');

    // Start 135-second (2:15) timer
    vslState.timer = setTimeout(() => {
        revealOffer('Timer completed (2:15)');
    }, 135000); // 135 seconds = 2:15

    // Start 10-minute countdown
    startCountdown(countdownEl);

    // CTA Button Click Handler
    if (vslCtaBtn) {
        vslCtaBtn.addEventListener('click', () => {
            revealOffer('CTA Button clicked');
            // Scroll to offer content
            setTimeout(() => {
                delayedOffer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        });
    }

    // Listen for page visibility change (user leaves tab)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Try to detect video pause via VTurb smartplayer events
    // VTurb fires custom events when video is paused
    const player = document.getElementById('vid-698cf6811e643e3dce3a5abc');
    if (player) {
        // Listen for smartplayer pause event
        player.addEventListener('pause', () => {
            revealOffer('Video paused');
        });

        player.addEventListener('ended', () => {
            revealOffer('Video ended');
        });
    }
}

function handleVisibilityChange() {
    if (document.hidden && !vslState.revealed) {
        revealOffer('User left page');
    }
}

function revealOffer(reason) {
    if (vslState.revealed) return;

    vslState.revealed = true;
    debugLog(`Revealing offer: ${reason}`);

    // Clear timers
    if (vslState.timer) clearTimeout(vslState.timer);
    if (vslState.countdownInterval) clearInterval(vslState.countdownInterval);

    // Show offer with fade-in
    const delayedOffer = document.getElementById('delayed-offer');
    if (delayedOffer) {
        delayedOffer.style.display = 'block';
        delayedOffer.style.opacity = '0';
        setTimeout(() => {
            delayedOffer.style.transition = 'opacity 0.8s ease-in';
            delayedOffer.style.opacity = '1';
        }, 50);
    }

    // Remove countdown
    const countdownEl = document.getElementById('countdown-timer');
    if (countdownEl) countdownEl.style.display = 'none';
}

function startCountdown(element) {
    if (!element) return;

    let timeRemaining = 600; // 10 minutes in seconds
    const totalTime = 600;
    const totalSpots = 20;

    // Elements
    const spotsFill = document.getElementById('spots-fill');
    const spotsTaken = document.getElementById('spots-taken');
    const vslCtaBtn = document.getElementById('vsl-cta-btn');

    function updateDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        element.textContent = `⏰ Esta oferta expira em: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Calculate spots filled (increases as time decreases)
        const elapsed = totalTime - timeRemaining;
        const spotsToShow = Math.min(Math.floor((elapsed / totalTime) * totalSpots), totalSpots);
        const progressPercent = (spotsToShow / totalSpots) * 100;

        if (spotsFill) spotsFill.style.width = `${progressPercent}%`;
        if (spotsTaken) spotsTaken.textContent = spotsToShow;

        // Show CTA button after 2:15 (135 seconds elapsed)
        if (elapsed >= 135 && vslCtaBtn && vslCtaBtn.style.display === 'none') {
            vslCtaBtn.style.display = 'flex';
            vslCtaBtn.style.animation = 'fadeInUp 0.6s ease-out';
        }

        if (timeRemaining === 0) {
            clearInterval(vslState.countdownInterval);
            element.textContent = '⚠️ Oferta expirada!';
            if (spotsFill) spotsFill.style.width = '100%';
            if (spotsTaken) spotsTaken.textContent = totalSpots;
        }

        timeRemaining--;
    }

    updateDisplay();
    vslState.countdownInterval = setInterval(updateDisplay, 1000);
}



function goToPreviousStep() {
    if (quizState.currentStep > 0) {
        quizState.currentStep--;

        // SKIP STEP 1 (Age Range) - Requested removal
        if (quizState.currentStep === 1) {
            quizState.currentStep = 0;
        }

        updateUI();
    }
}

function goToStep(stepNumber) {
    quizState.currentStep = stepNumber;
    updateUI();
}

function updateUI() {
    // Hide all steps
    // Defensive coding: query fresh
    const allSteps = document.querySelectorAll('.quiz-step');
    allSteps.forEach(step => {
        step.classList.remove('active');
    });

    // Show current step
    const currentStepEl = document.querySelector(`[data-step="${quizState.currentStep}"]`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }

    updateProgressBar();
    updateBackButton();
    updateStickyWarning();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle Wide View for Chart Step (Step 39)
    const quizContainer = document.querySelector('.quiz-container');
    if (quizContainer) {
        // Force a reflow or check to ensure it applies
        if (quizState.currentStep === 39) {
            quizContainer.classList.add('wide-view');
            // Also ensure body doesn't restrict it
            document.body.classList.add('wide-body-view');
        } else {
            quizContainer.classList.remove('wide-view');
            document.body.classList.remove('wide-body-view');
        }
    }
}

// ============================================
// UI UPDATES
// ============================================

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        let progress = 0;
        if (quizState.currentStep > 0) {
            progress = ((quizState.currentStep - 1) / (quizState.totalSteps - 1)) * 100;
        }
        progressBar.style.width = `${progress}%`;
    }
}

function updateBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (quizState.currentStep > 0 && quizState.currentStep < 38) {
            backBtn.classList.add('visible');
        } else {
            backBtn.classList.remove('visible');
        }
    }
}

function updateStickyWarning() {
    const stickyWarning = document.getElementById('stickyWarning');
    if (stickyWarning) {
        // Show only on Step 2 (Goal) as requested
        if (quizState.currentStep === 2) {
            stickyWarning.classList.remove('hidden');
        } else {
            stickyWarning.classList.add('hidden');
        }
    }
}

// ============================================
// OPTION HANDLING
// ============================================

function handleOptionSelect(card) {
    // const card = e.currentTarget; // handled by delegation
    const step = card.closest('.quiz-step');
    const stepNumber = parseInt(step.dataset.step);
    const value = card.dataset.value;
    const isMultiple = step.dataset.multiple === 'true';

    // Check if this is an interlude (has continue button)
    const hasContinueBtn = step.querySelector('.continue-btn');
    if (hasContinueBtn && !step.classList.contains('interlude')) {
        // This is a step with manual continue
    }

    if (isMultiple) {
        // Toggle selection for multi-select steps
        card.classList.toggle('selected');

        // Update Continue button state
        const selectedOptions = step.querySelectorAll('.option-card.selected');
        if (hasContinueBtn) {
            hasContinueBtn.disabled = selectedOptions.length === 0;

            // Visual feedback for disabled state
            if (selectedOptions.length > 0) {
                hasContinueBtn.style.opacity = '1';
                hasContinueBtn.style.cursor = 'pointer';
            } else {
                hasContinueBtn.style.opacity = '0.5';
                hasContinueBtn.style.cursor = 'not-allowed';
            }
        }

    } else {
        // Single select logic (default)

        // Clear previous selections in this step
        const siblings = step.querySelectorAll('.option-card');
        siblings.forEach(sibling => sibling.classList.remove('selected'));

        // Select current card
        card.classList.add('selected');

        // Save answer
        quizState.answers[`step_${stepNumber}`] = value;

        // Auto-advance after short delay (except for interludes)
        if (!step.classList.contains('interlude')) {
            setTimeout(() => {
                goToNextStep();
            }, 300);
        }
    }
}

function handleFoodSelect(btn) {
    // const btn = e.currentTarget; // handled by delegation
    btn.classList.toggle('selected');

    // Save all selected foods
    const selectedFoods = [];
    elements.foodBtns.forEach(foodBtn => {
        if (foodBtn.classList.contains('selected')) {
            selectedFoods.push(foodBtn.dataset.value);
        }
    });
    quizState.answers['step_17_foods'] = selectedFoods;
}

function handleContinue(btn) {
    // const btn = e.currentTarget; // handled by delegation

    // Ignore metric buttons as they have their own event listeners
    if (['heightContinue', 'weightContinue', 'targetContinue', 'ageContinue'].includes(btn.id)) {
        return;
    }

    const step = btn.closest('.quiz-step');
    const stepNumber = parseInt(step.dataset.step);
    const isMultiple = step.dataset.multiple === 'true';

    // For food selection step, ensure at least one food is selected
    if (stepNumber === 17) {
        const selectedFoods = step.querySelectorAll('.food-btn.selected');
        if (selectedFoods.length === 0) {
            // Optional: show error or just proceed
        }
    }

    // Generic multi-select data collection
    if (isMultiple) {
        const selectedOptions = [];
        step.querySelectorAll('.option-card.selected').forEach(card => {
            selectedOptions.push(card.dataset.value);
        });
        quizState.answers[`step_${stepNumber}`] = selectedOptions;
    }

    goToNextStep();
}

// ============================================
// BMI CALCULATION
// ============================================

function calculateAndShowBMI() {
    const height = quizState.userData.height;
    const weight = quizState.userData.currentWeight;

    if (height && weight) {
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        const bmiRounded = bmi.toFixed(1);

        let status = '';
        if (bmi < 18.5) {
            status = 'bajo peso';
        } else if (bmi < 25) {
            status = 'peso saludable';
        } else if (bmi < 30) {
            status = 'sobrepeso';
        } else {
            status = 'obesidad';
        }

        if (elements.bmiResult) {
            elements.bmiResult.innerHTML = `
                <p>Tu IMC es <strong>${bmiRounded}</strong> y tienes <strong>${status}</strong>.</p>
                <p>¡Es hora de cuidar tu peso!</p>
            `;
            elements.bmiResult.classList.add('visible');
        }
    }
}

// ============================================
// LOADING SCREEN ANIMATION (Step 40)
// ============================================

function startLoadingAnimation() {
    const progressBar = document.getElementById('loadingProgressBar');
    const percentageText = document.getElementById('loadingPercentage');
    const statusText = document.getElementById('loadingStatus');

    if (!progressBar || !percentageText || !statusText) return;

    const statusMessages = [
        "Analizando tu perfil metabólico...",
        "Optimizando cronograma de ayuno...",
        "Seleccionando alimentos permitidos...",
        "Finalizando tu Plan Personalizado..."
    ];

    let progress = 0;
    let messageIndex = 0;
    const totalDuration = 6000; // 6 seconds
    const interval = 50; // Update every 50ms for smooth animation
    const increment = 100 / (totalDuration / interval);

    // Update status message every 1.5 seconds
    const messageInterval = setInterval(() => {
        messageIndex++;
        if (messageIndex < statusMessages.length) {
            statusText.textContent = statusMessages[messageIndex];
        }
    }, 1500);

    // Animate progress bar
    const progressInterval = setInterval(() => {
        progress += increment;

        if (progress >= 100) {
            progress = 100;
            progressBar.style.width = '100%';
            percentageText.textContent = '100%';

            clearInterval(progressInterval);
            clearInterval(messageInterval);

            // Auto-redirect after 500ms
            setTimeout(() => {
                goToNextStep();
            }, 500);
        } else {
            progressBar.style.width = `${progress}%`;
            percentageText.textContent = `${Math.round(progress)}%`;
        }
    }, interval);
}

// ============================================
// CHECKOUT TRACKING
// ============================================
async function trackCheckoutClick() {
    const CHECKOUT_URL = "https://pay.hotmart.com/L104272039N?checkoutMode=10";

    if (supabase && quizState.sessionId && !IS_LOCALHOST && !DEBUG_MODE) {
        try {
            console.log('Tracking checkout click...');
            // Attempt to track, but don't block indefinitely
            await supabase
                .from('quiz_sessions')
                .update({ clicked_checkout: true })
                .eq('id', quizState.sessionId)
                .then(() => console.log('Tracked successfully'))
                .catch(err => console.error('Tracking failed', err));

            trackMetaEvent('InitiateCheckout', { content_name: 'Hotmart Checkout' });
        } catch (e) {
            console.error('Error tracking checkout:', e);
        }
    } else {
        trackMetaEvent('InitiateCheckout', { content_name: 'Hotmart Checkout (No Session)' });
    }

    // Redirect to checkout
    window.location.href = CHECKOUT_URL;
}

// Attach listener when DOM is ready (or call this in your main init)
document.addEventListener('DOMContentLoaded', () => {
    // Find the checkout button (it's in the final step)
    // Using a delegate or direct find if it exists.
    // It's inside .final-cta button
    const checkoutBtn = document.querySelector('.final-cta button');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', trackCheckoutClick);
    }
});

// ============================================
// CHART REVEAL ANIMATION (Step 39)
// ============================================

function animateChartReveal() {
    const chartWrapper = document.querySelector('.progress-chart-page .animated-chart');
    if (chartWrapper) {
        // Trigger the CSS animation by adding the 'animate' class
        chartWrapper.classList.add('animate');
    }
}

// ============================================
// WEIGHT LOSS CHART
// ============================================

function initWeightChart() {
    // Capture user weight data
    const currentWeight = quizState.userData.currentWeight;
    const targetWeight = quizState.userData.targetWeight;

    // Update SVG labels with actual weights
    const chart = document.querySelector('.weight-chart-final');
    if (chart && currentWeight && targetWeight) {
        // Update "Seu peso" label
        const startWeightLabel = chart.querySelector('#chart-start-weight');
        if (startWeightLabel) {
            startWeightLabel.textContent = `Tu peso: ${currentWeight}kg`;
        }

        // Update "Objetivo" label
        const goalWeightLabel = chart.querySelector('#chart-goal-weight');
        if (goalWeightLabel) {
            goalWeightLabel.textContent = `Objetivo: ${targetWeight}kg`;
        }
    }

    // Trigger animations
    const chartContainer = document.querySelector('.weight-loss-chart');
    const svgLine = chart ? chart.querySelector('line') : null;
    const svgElements = chart ? chart.querySelectorAll('circle, g, path') : null;

    if (chartContainer) {
        // Add animation class to container
        chartContainer.classList.add('chart-visible');
        // Also add chart-animate for entrance effect
        setTimeout(() => {
            chartContainer.classList.add('chart-animate');
        }, 100);
    }

    if (svgLine) {
        // Trigger line animation (left to right)
        svgLine.classList.add('animate-line');
    }

    if (svgElements) {
        // Trigger fade-in animation for other elements
        svgElements.forEach((el, index) => {
            el.classList.add('animate-element');
            // Stagger animation delays
            el.style.animationDelay = `${0.3 + (index * 0.1)}s`;
        });
    }
}

// ============================================
// FAQ ACCORDION
// ============================================

function toggleFaq(item) {
    const isOpen = item.classList.contains('open');

    // Close all FAQ items
    elements.faqItems.forEach(faqItem => {
        faqItem.classList.remove('open');
    });

    // Toggle current item
    if (!isOpen) {
        item.classList.add('open');
    }
}

// ============================================
// CHECKOUT LOGIC
// ============================================

function initCheckout() {
    const checkoutUrl = 'https://pay.hotmart.com/L104272039N?checkoutMode=10';
    const buttons = document.querySelectorAll('.cta-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Track InitiateCheckout
            trackMetaEvent('InitiateCheckout', {
                content_name: 'Plano Personalizado',
                currency: 'USD',
                value: 9.90
            });

            // Update session status if needed
            if (supabase && quizState.sessionId && !IS_LOCALHOST && !DEBUG_MODE) {
                supabase
                    .from('quiz_sessions')
                    .update({ clicked_checkout: true })
                    .eq('id', quizState.sessionId)
                    .then(() => {
                        window.location.href = checkoutUrl;
                    })
                    .catch(() => {
                        window.location.href = checkoutUrl;
                    });
            } else {
                window.location.href = checkoutUrl;
            }
        });
    });
}

// Initialize checkout on load (and re-init on step changes if needed)
document.addEventListener('DOMContentLoaded', initCheckout);


// ============================================
// UTILITIES
// ============================================

function shakeInput(input) {
    input.style.animation = 'none';
    input.offsetHeight; // Trigger reflow
    input.style.animation = 'shake 0.5s ease';
    input.style.borderColor = '#FF5252';

    setTimeout(() => {
        input.style.borderColor = '';
    }, 2000);
}

// ============================================
// CAROUSEL LOGIC (Step 42)
// ============================================

function initCarousel() {
    const track = document.getElementById('storiesTrack');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    const dots = document.querySelectorAll('.dot');

    if (!track) return;

    const slides = track.children;
    const slideCount = slides.length;
    let currentIndex = 0;
    let autoPlayInterval;

    function updateCarousel() {
        // Move track
        const translateValue = -(currentIndex * 100);
        track.style.transform = `translateX(${translateValue}%)`;

        // Update dots
        dots.forEach((dot, index) => {
            if (index === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % slideCount;
        updateCarousel();
        resetAutoPlay();
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + slideCount) % slideCount;
        updateCarousel();
        resetAutoPlay();
    }

    function goToSlide(index) {
        currentIndex = index;
        updateCarousel();
        resetAutoPlay();
    }

    function startAutoPlay() {
        if (autoPlayInterval) clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % slideCount;
            updateCarousel();
        }, 4000);
    }

    function resetAutoPlay() {
        clearInterval(autoPlayInterval);
        startAutoPlay();
    }

    // Event Listeners
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'));
            goToSlide(index);
        });
    });

    // Start
    startAutoPlay();
}

// Add shake animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// ============================================
// DATA EXPORT (for integration)
// ============================================

function getQuizData() {
    return {
        answers: quizState.answers,
        userData: quizState.userData,
        completedAt: new Date().toISOString()
    };
}

// Expose to global scope for potential integrations
window.secaJejumQuiz = {
    getQuizData,
    goToStep,
    state: quizState
};
