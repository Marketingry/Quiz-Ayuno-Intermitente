
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bwpjmowuqkwogbtnheyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cGptb3d1cWt3b2didG5oZXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc5MjEsImV4cCI6MjA4NTczMzkyMX0.RFSrtexhbic7fTn51gTFuJlmSuo5-9Ciyp367f8I_8A';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyze() {
    console.log("Fetching data...");

    // Fetch all sessions
    const { data: sessions, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    const total = sessions.length;
    console.log(`Total Sessions: ${total}`);

    // Step Analysis
    const stepCounts = {};
    for (let i = 0; i <= 42; i++) {
        stepCounts[i] = sessions.filter(s => s.current_step >= i).length;
    }

    const checkoutClicks = sessions.filter(s => s.clicked_checkout).length;
    const completed = sessions.filter(s => s.completed).length;

    const output = `
--- Funnel Analysis ---
Step 0 (Diagnosis): ${stepCounts[0]} (${(stepCounts[0] / total * 100).toFixed(1)}%)
Step 2 (Goal): ${stepCounts[2]} (Conv: ${(stepCounts[2] / stepCounts[0] * 100).toFixed(1)}%)
Step 10: ${stepCounts[10]} (Conv: ${(stepCounts[10] / stepCounts[2] * 100).toFixed(1)}%)
Step 20: ${stepCounts[20]} (Conv: ${(stepCounts[20] / stepCounts[10] * 100).toFixed(1)}%)
Step 30: ${stepCounts[30]} (Conv: ${(stepCounts[30] / stepCounts[20] * 100).toFixed(1)}%)
Step 40: ${stepCounts[40]} (Conv: ${(stepCounts[40] / stepCounts[30] * 100).toFixed(1)}%)
Step 42 (End): ${stepCounts[42]} (Conv: ${(stepCounts[42] / stepCounts[40] * 100).toFixed(1)}%)

Checkout Clicks: ${checkoutClicks} (Conv from End: ${(checkoutClicks / stepCounts[42] * 100).toFixed(1)}%)
Actual Rate (Checkout/Total): ${(checkoutClicks / total * 100).toFixed(1)}%
    `;

    console.log(output);

    // Write to file
    try {
        const fs = await import('fs');
        fs.writeFileSync('analysis_result.txt', output);
        console.log("Analysis saved to analysis_result.txt");
    } catch (e) {
        console.error("Error writing file:", e);
    }
}

analyze();
