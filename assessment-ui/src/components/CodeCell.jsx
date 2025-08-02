import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

const CodeCell = ({ initialCode, questionId, onCodeChange, onRunCode }) => {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    const handleEditorChange = (value) => {
        setCode(value);
        onCodeChange(questionId, value);
    };

    const handleRun = async () => {
        setIsRunning(true);
        setOutput('');
        setError('');
        
        // Pass the questionId up to the App component's handler
        const result = await onRunCode(code, questionId);
        
        setOutput(result.stdout || '');
        setError(result.stderr || '');
        
        setIsRunning(false);
    };

    const handleClear = () => {
        setOutput('');
        setError('');
    };

    return (
        <div className="code-cell">
            <div className="editor-container">
                <Editor
                    height="200px"
                    language="python"
                    theme="vs-dark"
                    value={code}
                    onChange={handleEditorChange}
                    options={{ minimap: { enabled: false } }}
                />
            </div>
            <div className="cell-controls">
                <button onClick={handleRun} disabled={isRunning}>
                    {isRunning ? 'Running...' : '▶ Run'}
                </button>
                <button onClick={handleClear} disabled={isRunning}>Clear Output</button>
            </div>
            {(output || error) && (
                <div className="output-area">
                    {output && <pre className="output-stdout">{output}</pre>}
                    {error && <pre className="output-stderr">{error}</pre>}
                </div>
            )}
        </div>
    );
};

export default CodeCell;