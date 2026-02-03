/**
 * SECA JEJUM QUIZ - JavaScript Controller
 * Handles quiz navigation, data collection, and UI interactions
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const quizState = {
    currentStep: 1,
    totalSteps: 42,
    answers: {},
    userData: {
        height: null,
        currentWeight: null,
        targetWeight: null,
        age: null
    }
};

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
        updateUI();

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
        if (quizState.currentStep === 41) {
            setTimeout(initWeightChart, 300);
        }
        if (quizState.currentStep === 42) {
            setTimeout(initCarousel, 300);
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
        bmiLabel.textContent = `Você: ${bmi.toFixed(1)}`;
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


function goToPreviousStep() {
    if (quizState.currentStep > 1) {
        quizState.currentStep--;
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
}

// ============================================
// UI UPDATES
// ============================================

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        const progress = ((quizState.currentStep - 1) / (quizState.totalSteps - 1)) * 100;
        progressBar.style.width = `${progress}%`;
    }
}

function updateBackButton() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (quizState.currentStep > 1 && quizState.currentStep < 38) {
            backBtn.classList.add('visible');
        } else {
            backBtn.classList.remove('visible');
        }
    }
}

function updateStickyWarning() {
    const stickyWarning = document.getElementById('stickyWarning');
    if (stickyWarning) {
        if (quizState.currentStep > 1) {
            stickyWarning.classList.add('hidden');
        } else {
            stickyWarning.classList.remove('hidden');
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
            status = 'abaixo do peso';
        } else if (bmi < 25) {
            status = 'dentro do ideal';
        } else if (bmi < 30) {
            status = 'acima do ideal';
        } else {
            status = 'muito acima do ideal';
        }

        if (elements.bmiResult) {
            elements.bmiResult.innerHTML = `
                <p>O seu IMC é <strong>${bmiRounded}</strong> e está <strong>${status}</strong>!</p>
                <p>É hora de cuidar do seu peso!</p>
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
        "Analisando seu perfil metabólico...",
        "Otimizando cronograma de jejum...",
        "Selecionando alimentos permitidos...",
        "Finalizando seu Plano Personalizado!"
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
            startWeightLabel.textContent = `Seu peso: ${currentWeight}kg`;
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
