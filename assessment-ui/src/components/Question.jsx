import React from 'react';
import CodeCell from './CodeCell';

const Question = ({ question, questionNumber, onCodeChange, onRunCode, testResults }) => {
    return (
        <div className="question-container" id={question.id}>
            <h3>{`Question ${questionNumber}: ${question.title}`}</h3>
            <p>{question.description}</p>
            <CodeCell
                initialCode={question.initial_code}
                questionId={question.id}
                onCodeChange={onCodeChange}
                onRunCode={onRunCode}
            />
            {/* New Test Results Section */}
            {testResults && (
                <div className="test-results-container">
                    <h4>Test Cases:</h4>
                    <ul>
                        {question.test_cases.map((test, index) => (
                            <li key={index} className={testResults[index] ? 'passed' : 'failed'}>
                                {test.description}: {testResults[index] ? 'Passed ✅' : 'Failed ❌'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default Question;