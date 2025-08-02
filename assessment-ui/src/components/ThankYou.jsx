import React from 'react';

const ThankYou = ({ score }) => {
    const percentage = score.total > 0 ? ((score.passed / score.total) * 100).toFixed(1) : 0;

    return (
        <div className="thank-you-container">
            <h2>Assessment Complete</h2>
            <p>Thank you for submitting your assessment.</p>
            <div className="final-score-card">
                <h3>Your Final Score</h3>
                <div className="score-display">
                    {score.passed} / {score.total}
                </div>
                <div className="score-percentage">
                    ({percentage}%)
                </div>
            </div>
            <p className="footer-note">You may now close this window.</p>
        </div>
    );
};

export default ThankYou;