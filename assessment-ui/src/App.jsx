// src/App.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Import all necessary components
import AssessmentHeader from './components/AssessmentHeader';
import Question from './components/Question';
import ThankYou from './components/ThankYou'; // <-- The new completion screen component

// Import all API functions
import * as api from './services/api';

// Import the stylesheet
import './App.css';

function App() {
    // State for the assessment data itself
    const [assessment, setAssessment] = useState(null);
    const [sessionId, setSessionId] = useState(null);

    // State for user interactions
    const [answers, setAnswers] = useState({}); // Tracks the code in each cell
    const [scores, setScores] = useState({}); // Tracks test case results: { q1: [true, false] }
    
    // State for UI control
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false); // <-- New state to control showing the Thank You page
    const [statusMessage, setStatusMessage] = useState('Initializing...');
    
    // A ref to prevent the session initialization effect from running twice in development
    const sessionStarted = useRef(false);

    // Effect to initialize the user's session and load assessment data
    useEffect(() => {
        if (sessionStarted.current) return;
        sessionStarted.current = true;

        const initializeSession = async () => {
            // Get or create a unique session ID for the user
            let currentSessionId = localStorage.getItem('assessmentSessionId');
            if (!currentSessionId) {
                currentSessionId = crypto.randomUUID();
                localStorage.setItem('assessmentSessionId', currentSessionId);
            }
            setSessionId(currentSessionId);

            try {
                // Start the kernel session on the backend
                setStatusMessage(`Initializing Session...`);
                await api.startSession(currentSessionId);

                // Fetch the assessment questions
                setStatusMessage('Loading Assessment Data...');
                const { data } = await api.getAssessment();
                setAssessment(data);
                
                // Pre-populate the answers state with the initial code for each question
                const initialAnswers = {};
                data.questions.forEach(q => {
                    initialAnswers[q.id] = q.initial_code;
                });
                setAnswers(initialAnswers);
            } catch (error) {
                console.error("Initialization failed:", error);
                setStatusMessage(`Error: ${error.response?.data?.detail || error.message}. Please refresh.`);
            } finally {
                setIsLoading(false);
            }
        };

        initializeSession();
    }, []);

    // Callback to update the code for a question when the user types in an editor
    const handleCodeChange = useCallback((questionId, code) => {
        setAnswers(prev => ({ ...prev, [questionId]: code }));
    }, []);

    // Callback to execute code for a cell, called from the CodeCell component
    const handleRunCode = useCallback(async (code, questionId) => {
        if (!sessionId) {
            return { stderr: "Session is not ready. Please wait or refresh." };
        }
        try {
            const { data } = await api.executeCode(code, sessionId, questionId);
            
            // If the backend returns test results, update the scores state
            if (data.test_results) {
                setScores(prevScores => ({
                    ...prevScores,
                    [questionId]: data.test_results
                }));
            }

            // Return the output to be displayed by the CodeCell
            return { stdout: data.stdout, stderr: data.stderr };
        } catch (err) {
            return { stderr: err.response?.data?.detail || 'Failed to execute code.' };
        }
    }, [sessionId]);

    // A helper function to calculate the current score
    const calculateTotalScore = () => {
        let passed = 0;
        let total = 0;
        
        // Count passed tests from the live 'scores' state
        Object.values(scores).forEach(results => {
            results.forEach(passed_test => {
                if (passed_test) { passed += 1; }
            });
        });

        // Get the total possible number of tests from the initial assessment data
        if (assessment) {
            assessment.questions.forEach(q => {
                total += q.test_cases?.length || 0;
            });
        }
        
        return { passed, total };
    };

    // Callback for the final submission button
    const handleSubmit = async () => {
    if (!sessionId || !window.confirm("Are you sure you want to submit your final answers?")) return;

    setIsSubmitting(true);

    const finalScore = calculateTotalScore();

    // ===================================================================
    // === THIS IS THE CORRECTED PAYLOAD CONSTRUCTION ===
    // ===================================================================
    const submissionPayload = {
        session_id: sessionId, // <-- Add the session_id directly to the payload
        answers: Object.keys(answers).map(questionId => ({
            question_id: questionId,
            code: answers[questionId],
            output: "Submission output not collected" 
        })),
        final_score: finalScore
    };
    // ===================================================================

    try {
        // The API call is now much cleaner
        const { data } = await api.submitAssessment(submissionPayload);
        
        console.log("Submission successful:", data.message);
        setIsSubmitted(true);
        localStorage.removeItem('assessmentSessionId');
    } catch (error) {
        alert('Failed to submit assessment.');
        // Log the detailed validation error from FastAPI for debugging
        if (error.response && error.response.data.detail) {
            console.error("Validation Error:", error.response.data.detail);
        } else {
            console.error(error);
        }
    } finally {
        setIsSubmitting(false);
    }
};
    
    // Callback for when the timer runs out
    const handleTimeUp = () => {
        alert("Time is up! Your assessment will be submitted automatically.");
        handleSubmit();
    }

    const currentScore = calculateTotalScore();

    // Render a loading screen while initializing
    if (isLoading || !assessment) {
        return <div className="loading-screen">{statusMessage}</div>;
    }

    // --- MAIN RENDER LOGIC ---

    // If the assessment has been submitted, show the final score screen
    if (isSubmitted) {
        return <ThankYou score={currentScore} />;
    }

    // Otherwise, render the main assessment interface
    return (
        <div className="app-container">
            <AssessmentHeader 
                title={assessment.title} 
                durationMinutes={assessment.duration_minutes} 
                onTimeUp={handleTimeUp}
                score={currentScore}
            />
            <main>
                {assessment.questions.map((q, index) => (
                    <Question 
                        key={q.id} 
                        question={q} 
                        questionNumber={index + 1}
                        onCodeChange={handleCodeChange}
                        onRunCode={handleRunCode}
                        testResults={scores[q.id]}
                    />
                ))}
            </main>
            <footer>
                <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Final Assessment'}
                </button>
            </footer>
        </div>
    );
}

export default App;