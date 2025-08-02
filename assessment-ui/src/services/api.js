import axios from 'axios';

// The frontend (e.g., on port 5174) talks to the backend (on port 8000)
const API_BASE_URL = 'http://localhost:8000/api'; 

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getAssessment = () => apiClient.get('/assessment');
export const startSession = (sessionId) => apiClient.post('/session/start', { session_id: sessionId });
export const executeCode = (code, sessionId, questionId) => apiClient.post('/execute', { code, session_id: sessionId, question_id: questionId });
export const submitAssessment = (payload) => 
    apiClient.post('/submit', payload);