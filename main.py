# main.py
import uvicorn
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Tuple

from fastapi.middleware.cors import CORSMiddleware
from jupyter_client.manager import KernelManager, KernelClient

# --- Pydantic Models for API validation ---
class SessionRequest(BaseModel):
    session_id: str

class CodeExecutionRequest(BaseModel):
    code: str
    session_id: str
    question_id: str # <-- ADD THIS LINE
class SubmissionItem(BaseModel):
    question_id: str
    code: str
    output: str

class SubmissionPayload(BaseModel):
    session_id: str
    answers: List[SubmissionItem]

class FinalScore(BaseModel):
    passed: int
    total: int

# UPDATED: The main submission payload now includes the final score
class SubmissionPayload(BaseModel):
    session_id: str
    answers: List[SubmissionItem]
    final_score: FinalScore # <-- ADD THIS FIELD

# --- FastAPI App & Global Kernel Manager ---
app = FastAPI()

# This dictionary is the heart of our stateful, isolated system.
# It maps a user's session_id to their personal kernel manager and client.
# { "session_id_1": (KernelManager, KernelClient), "session_id_2": ... }
USER_KERNELS: Dict[str, Tuple[KernelManager, KernelClient]] = {}

# --- CORS Configuration: CRITICAL for LAN ---
# This allows your React frontend to talk to this backend.
origins = [
    "http://localhost:5174", # The default address for the React dev server
    "http://127.0.0.1:5174",
    # "http://10.150.20.62", # <-- YOUR SERVER'S LAN IP (if serving React on default port)
    # "http://10.150.20.62:5173", # <-- YOUR SERVER'S LAN IP (for React dev server)
    # "http://10.150.20.62:8000", # <-- YOUR SERVER'S LAN IP (if co-hosting)
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In main.py

# ... other imports ...

# NEW ASSESSMENT DATA WITH NUMPY AND TEST CASES
ASSESSMENT_DATA = {
    "title": "NumPy Basics Assessment",
    "duration_minutes": 30,
    "questions": [
        {
            "id": "q1",
            "title": "Question 1: Array Creation",
            "description": "Create a NumPy function `create_array()` that takes no arguments and returns a 1D NumPy array containing the integers from 0 to 9.",
            "initial_code": "import numpy as np\n\ndef create_array():\n  # Your code here\n  pass\n",
            "test_cases": [
                {
                    # Test if the function returns the correct array
                    "description": "Returns the correct 1D array",
                    "code_to_run": "result = create_array()\nprint(np.array_equal(result, np.arange(10)))",
                    "expected_output": "True"
                },
                {
                    # Test if the return type is a numpy array
                    "description": "Returns a NumPy ndarray",
                    "code_to_run": "result = create_array()\nprint(isinstance(result, np.ndarray))",
                    "expected_output": "True"
                }
            ]
        },
        {
            "id": "q2",
            "title": "Question 2: Array Operations",
            "description": "Create a function `double_elements(arr)` that takes a 1D NumPy array `arr` and returns a new array where each element is doubled.",
            "initial_code": "import numpy as np\n\ndef double_elements(arr):\n  # Your code here\n  pass\n",
            "test_cases": [
                {
                    "description": "Works with a simple positive array",
                    "code_to_run": "test_arr = np.array([1, 2, 3])\nresult = double_elements(test_arr)\nprint(np.array_equal(result, np.array([2, 4, 6])))",
                    "expected_output": "True"
                },
                {
                    "description": "Works with an array including zero and negative numbers",
                    "code_to_run": "test_arr = np.array([-1, 0, 5])\nresult = double_elements(test_arr)\nprint(np.array_equal(result, np.array([-2, 0, 10])))",
                    "expected_output": "True"
                }
            ]
        },
        {
            "id": "q3",
            "title": "Question 3: Filtering Arrays",
            "description": "Create a function `get_evens(arr)` that takes a 1D NumPy array `arr` of integers and returns a new array containing only the even numbers from the original array.",
            "initial_code": "import numpy as np\n\ndef get_evens(arr):\n  # Your code here\n  pass\n",
            "test_cases": [
                {
                    "description": "Correctly filters a mixed array",
                    "code_to_run": "test_arr = np.arange(10)\nresult = get_evens(test_arr)\nprint(np.array_equal(result, np.array([0, 2, 4, 6, 8])))",
                    "expected_output": "True"
                },
                {
                    "description": "Returns an empty array if no evens are present",
                    "code_to_run": "test_arr = np.array([1, 3, 5, 9])\nresult = get_evens(test_arr)\nprint(np.array_equal(result, np.array([])))",
                    "expected_output": "True"
                },
                {
                    "description": "Handles an array of all even numbers",
                    "code_to_run": "test_arr = np.array([2, 6, 10])\nresult = get_evens(test_arr)\nprint(np.array_equal(result, np.array([2, 6, 10])))",
                    "expected_output": "True"
                }
            ]
        }
    ]
}

# --- API Endpoints ---
@app.get("/api/assessment")
async def get_assessment_data():
    return JSONResponse(content=ASSESSMENT_DATA)

@app.post("/api/session/start")
async def start_session(request: SessionRequest):
    """Initializes a dedicated kernel for a user session."""
    session_id = request.session_id
    if session_id not in USER_KERNELS:
        print(f"Starting new kernel for session: {session_id}")
        km = KernelManager()
        await asyncio.to_thread(km.start_kernel)
        kc = km.client()
        await asyncio.to_thread(kc.start_channels)
        try:
            await asyncio.to_thread(kc.wait_for_ready, timeout=30)
        except RuntimeError:
            km.shutdown_kernel()
            raise HTTPException(status_code=500, detail="Kernel failed to start in time.")
            
        USER_KERNELS[session_id] = (km, kc)
        return JSONResponse(content={"message": f"Session {session_id} started successfully."})
    return JSONResponse(content={"message": f"Session {session_id} already exists."})

# In main.py, DELETE your current @app.post("/api/execute") function
# and add these TWO new functions in its place.

# A helper function to make the execution logic reusable and cleaner
async def run_code_on_kernel(kc: KernelClient, code: str, timeout: int = 20):
    # Execute the code and get the message ID for tracking
    msg_id = kc.execute(code)
    
    stdout = []
    stderr = []
    result_display_data = [] 

    while True:
        try:
            msg = await asyncio.to_thread(kc.get_iopub_msg, timeout=timeout)

            # Only process messages that are children of our request
            if msg.get('parent_header', {}).get('msg_id') != msg_id:
                continue

            msg_type = msg['header']['msg_type']
            content = msg.get('content', {})

            if msg_type == 'stream':
                if content['name'] == 'stdout':
                    stdout.append(content['text'])
                else:
                    stderr.append(content['text'])
            elif msg_type == 'error':
                stderr.append('\n'.join(content.get('traceback', [])))
            elif msg_type == 'execute_result':
                result_display_data.append(content['data'].get('text/plain', ''))
            elif msg_type == 'status' and content.get('execution_state') == 'idle':
                # This idle message signals the end of this execution.
                break
        except Exception:
            stderr.append(f"\n[Kernel did not respond for {timeout} seconds]")
            break
            
    full_stdout = "".join(stdout) + "".join(result_display_data)
    return full_stdout, "".join(stderr)


# The new, complete /api/execute endpoint with grading
@app.post("/api/execute")
async def execute_code(request: CodeExecutionRequest):
    session_id = request.session_id
    if session_id not in USER_KERNELS:
        raise HTTPException(status_code=404, detail="User session not found.")

    _km, kc = USER_KERNELS[session_id]
    
    # We need a helper to find the question data from ASSESSMENT_DATA
    question_data = next((q for q in ASSESSMENT_DATA["questions"] if q["id"] == request.question_id), None)
    if not question_data:
        raise HTTPException(status_code=404, detail="Question not found.")

    # --- Step 1: Run the student's code and capture their output ---
    student_stdout, student_stderr = await run_code_on_kernel(kc, request.code)

    # If the student's code itself has an error, fail all tests and return
    if student_stderr:
        return JSONResponse(content={
            "stdout": student_stdout,
            "stderr": student_stderr,
            "test_results": [False] * len(question_data.get("test_cases", []))
        })
        
    # --- Step 2: Execute the hidden test cases ---
    test_results = []
    for test in question_data.get("test_cases", []):
        # Combine the student's functions with our test code
        full_test_code = f"{request.code}\n\n{test['code_to_run']}"
        test_stdout, test_stderr = await run_code_on_kernel(kc, full_test_code, timeout=5)
        
        # If the test itself errors out, it's a failure
        if test_stderr:
            passed = False
        else:
            # Check if the stripped output of the test matches the expectation
            passed = test_stdout.strip() == test['expected_output']
        
        test_results.append(passed)

    # --- Step 3: Package everything up and send it to the frontend ---
    final_payload = {
        "stdout": student_stdout,
        "stderr": student_stderr,
        "test_results": test_results
    }
    
    return JSONResponse(content=final_payload)

@app.post("/api/submit")
async def submit_assessment(payload: SubmissionPayload):
    """Saves submission (including final score) and shuts down the user's dedicated kernel."""
    session_id = payload.session_id
    
    # The submission dictionary now automatically includes the score
    submission_dict = payload.dict()
    print(f"Received final submission for session: {session_id}")
    print(json.dumps(submission_dict, indent=2))
    
    # Save the complete submission to a file
    with open(f"submission_{session_id}.json", "w") as f:
        json.dump(submission_dict, f, indent=2)
    
    # Clean up the kernel (this logic is unchanged)
    if session_id in USER_KERNELS:
        print(f"Shutting down kernel for session: {session_id}")
        km, kc = USER_KERNELS.pop(session_id)
        if kc.is_alive(): await asyncio.to_thread(kc.stop_channels)
        if km.is_alive(): await asyncio.to_thread(km.shutdown_kernel)
            
    return JSONResponse(content={"message": "Submission received successfully!"})