import React from 'react';
import Timer from './Timer';

const AssessmentHeader = ({ title, durationMinutes, onTimeUp, score }) => {
    return (
        <header className="assessment-header">
            <h1>{title}</h1>
            <div className="header-meta">
                <div className="score">
                    Score: {score.passed} / {score.total}
                </div>
                <Timer initialMinutes={durationMinutes} onTimeUp={onTimeUp} />
            </div>
        </header>
    );
};

export default AssessmentHeader;