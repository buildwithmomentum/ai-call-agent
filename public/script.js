// =================== File Overview ===================
// This file implements OpenAI Realtime API and WebRTC for voice-to-voice interactions.
// It is organized into sections for global variables, utility functions, and event listeners
// to help frontend developers adapt it to their framework.

// =================== Global Variables ===================
let localStream;           // Global variable for user audio stream
let pcConn;                // Global peer connection object
let greetingSent = false;  // Flag to prevent duplicate greeting messages
let functionData = null;   // Stores backend function configuration data
let currentCallLog = null; // Object to temporarily store call log data
// Add global transcript accumulator
let aiTranscript = "";
// Add global variable to temporarily store finished transcript messages with timestamp
let transcriptMessages = [];
// Add new global variable for RTC data channel
let rtcDataChannel = null;

// =================== Utility Functions ===================

// Get current date and time with GMT offset
function getCurrentDateTime() {
    const now = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const day = daysOfWeek[now.getDay()];
    const offset = -now.getTimezoneOffset() / 60;
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
    
    const formattedDateTime = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return {
        dateTime: `${formattedDateTime} GMT${offsetStr}`
    };
}

// Fetch the function configuration from the backend for a given agentId
async function getFunctionData(agentId) {
    try {
        const response = await fetch(`/tools/function-data/${agentId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch function data');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching function data:', error);
        throw error;
    }
}

// Execute the function call based on OpenAI realtime instructions
// Execute the function call based on OpenAI realtime instructions
async function executeFunction(functionCall, functionConfig, agentId) {
  try {
    // Handle end_call and get_current_time without configuration lookup
    if (functionCall.name === "end_call") {
      // Return response immediately
      const response = {
        status: "success",
        data: [
          {
            context:
              "Call ending initiated. Quickly say goodbye before it ends in 5 seconds.",
            metadata: {
              timestamp: new Date().toISOString(),
              action: "end_call",
            },
          },
        ],
      };

      // Set a timeout to end the call after 5 seconds
      setTimeout(() => {
        endCall();
      }, 8000);

      return response;
    }
    if (functionCall.name === "get_current_time") {
      const now = new Date();
      const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const day = daysOfWeek[now.getDay()];
      const offset = -now.getTimezoneOffset() / 60;
      const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;
      const formattedDateTime = now.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return {
        status: "success",
        data: [
          {
            context: `The current time is ${formattedDateTime} GMT${offsetStr}. Today is ${day}.`,
            metadata: {
              timestamp: now.toISOString(),
              action: "get_current_time",
              timeData: {
                dayOfWeek: day,
                formattedDateTime: formattedDateTime,
                timeZone: `GMT${offsetStr}`,
                iso8601: now.toISOString(),
              },
            },
          },
        ],
      };
    }

    // Find the matching function configuration
    const funcData = functionConfig.find((f) => f.name === functionCall.name);
    if (!funcData) {
      throw new Error(
        `No configuration found for function: ${functionCall.name}`
      );
    }

    const {
      data: { req_url, req_type, body, headers, query },
    } = funcData;
    const args = JSON.parse(functionCall.arguments);

    // Handle request based on method type and body requirements
    const requestOptions = {
      method: req_type,
      headers: { ...headers, "Content-Type": "application/json" },
    };

    // Handle POST, PATCH, PUT requests with body
    if (["POST", "PATCH", "PUT"].includes(req_type.toUpperCase()) && body) {
      let processedBody = { ...body };  // Clone the body object

      // Process each field in the body recursively
      const processBodyField = (obj) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            processBodyField(obj[key]); // Recursively process nested objects
          } else if (typeof obj[key] === 'string') {
            // Replace placeholders in string values
            obj[key] = obj[key]

            .replace(/{{voice_agent_id}}/g, agentId);
            
            // Replace other argument placeholders
            Object.entries(args).forEach(([argKey, argValue]) => {
              obj[key] = obj[key].replace(`{{${argKey}}}`, argValue);
            });
          }
        });
      };

      processBodyField(processedBody);
      requestOptions.body = JSON.stringify(processedBody);
    }

    // Replace voice_agent_id in the base URL first
    let finalUrl = req_url
      .replace(/{{voice_agent_id}}/g, agentId);

    // Handle GET requests with query parameters
    if (
      req_type.toUpperCase() === "GET" &&
      (query || Object.keys(args).length > 0)
    ) {
      let queryParams = new URLSearchParams();

      if (query) {
        let queryConfig = { ...query };
        Object.entries(queryConfig).forEach(([key, value]) => {
          let processedValue = value
            .toString()
           
            .replace(/{{voice_agent_id}}/g, agentId);
          Object.entries(args).forEach(([argKey, argValue]) => {
            processedValue = processedValue.replace(
              `{{${argKey}}}`,
              argValue
            );
          });
          queryParams.append(key, processedValue);
        });
      }

      // Add remaining args to query params
      Object.entries(args).forEach(([key, value]) => {
        if (!queryParams.has(key)) {
          queryParams.append(key, value);
        }
      });

      finalUrl = `${finalUrl}${
        finalUrl.includes("?") ? "&" : "?"
      }${queryParams.toString()}`;
    }

    console.log(`Executing ${functionCall.name} with URL:`, finalUrl);

    const response = await fetch(finalUrl, requestOptions);
    console.log(`${functionCall.name} Response Status:`, response.status);

    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`${functionCall.name} Response Data:`, result);

    // Format the response in a consistent way for the AI
    return {
      status: "success",
      data: [
        {
          context:
            typeof result === "string"
              ? result
              : result.bookedSlots
              ? JSON.stringify(result.bookedSlots)
              : Array.isArray(result)
              ? result.map((item) => item.context || item).join("\n")
              : JSON.stringify(result),
          metadata: {
            timestamp: new Date().toISOString(),
            action: functionCall.name,
          },
        },
      ],
    };
  } catch (error) {
    console.error("Function execution error:", error);
    return { error: error.message };
  }
}

// Updated helper to compute call duration in a human-readable format (e.g., "2 min 8 sec 203 ms")
function calculateDuration(callStart, callEnd) {
    const diffMillis = new Date(callEnd) - new Date(callStart);
    const minutes = Math.floor(diffMillis / 60000);
    const seconds = Math.floor((diffMillis % 60000) / 1000);
    const milliseconds = diffMillis % 1000;
    return `${minutes} min ${seconds} sec ${milliseconds} ms`;
}

// End the call, close peer connection and release audio resources
function endCall() {
    greetingSent = false;
    // Set call_end in the temporary log and send it to the backend
    if (currentCallLog) {
        currentCallLog.call_end = new Date().toISOString();
        // Calculate duration and add it into currentCallLog (now in valid format)
        currentCallLog.duration = calculateDuration(currentCallLog.call_start, currentCallLog.call_end);
        // Add the transcript messages to the call log
        currentCallLog.transcript = transcriptMessages;
        storeCallLog();
        // Optionally clear transcriptMessages after storing the log
        transcriptMessages = [];
        currentCallLog = null;
    }
    
    // Close the peer connection if it exists
    if (pcConn) {
        pcConn.close();
        pcConn = null;
        console.log("Peer connection closed.");
    }
    // Stop all tracks of the local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
        console.log("Local media stream stopped.");
    }
    // Optionally update UI to show call is ended
    document.getElementById('function-call-log').innerText = "Call ended.";
    // Revert buttons: show "Start Call", hide "End Call"
    document.getElementById('start-btn').style.display = 'inline-flex';
    document.getElementById('stop-btn').style.display = 'none';
}

// Function to send the stored call log to the backend
async function storeCallLog() {
    const requestBody = JSON.stringify(currentCallLog);
    console.log("Request body being sent:", requestBody);  
    try {
        await fetch('/call-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
        });
        console.log("Call log stored successfully.");
    } catch (error) {
        console.error("Error storing call log:", error);
    }
}

// =================== RTC Connection Setup ===================
//initializes RTC connection, fetches data, and sets up events.
async function connectRTC(agentId) {
    // Fetch function data
    try {
        functionData = await getFunctionData(agentId);
        console.log('Fetched function data:', functionData);
    } catch (error) {
        document.getElementById('function-call-log').innerText = "Failed to fetch function data.";
        return;
    }
    
    // Get ephemeral key from server
    const tokenResponse = await fetch(`/realtime/session/${agentId}`);
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // Create the peer connection and assign it globally
    const pc = new RTCPeerConnection();
    pcConn = pc;

    // Set up remote audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = e => { audioEl.srcObject = e.streams[0]; };

    // Set up local audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(localStream.getTracks()[0]);

    // Set up RTC data channel and its event listener
    const dc = pc.createDataChannel("oai-events");
    rtcDataChannel = dc;  // New: assign data channel to global variable
    dc.addEventListener("message", async (e) => {
        const realtimeEvent = JSON.parse(e.data);
        console.log('Realtime Event:', realtimeEvent);  // Add this line to debug
        
        // Add handler for user input transcription
        if (realtimeEvent.type === "conversation.item.input_audio_transcription.completed") {
            if (realtimeEvent.transcript) {
                const currentTime = new Date().toISOString();
                transcriptMessages.push({
                    role: "user",
                    transcript: "User: " + realtimeEvent.transcript.trim(),
                    time: currentTime
                });
                console.log("User transcript stored:", realtimeEvent.transcript.trim());
                appendMessageToChat(realtimeEvent.transcript.trim(), false);
            }
            return;
        }

        if ((realtimeEvent.type === "session.created" || realtimeEvent.type === "session.updated") && !greetingSent) {
            greetingSent = true;
            const greetingEvent = {
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [{
                        type: "input_text",
                        text: "Introduce yourself by saying your name and greeting the customer, patient, or client appropriately based on the business type and context."
                    }]
                }
            };
            dc.send(JSON.stringify(greetingEvent));
            const responseEvent = {
                type: "response.create",
                response: { modalities: ["audio", "text"] }
            };
            dc.send(JSON.stringify(responseEvent));
        }
        if (realtimeEvent.type === "error") { greetingSent = false; }
        if (realtimeEvent.type === "response.done" &&
            realtimeEvent.response?.output?.[0]?.type === "function_call") {
            const fc = realtimeEvent.response.output[0];
            document.getElementById('function-call-log').innerText = `Function ${fc.name} called`;
            const result = await executeFunction(fc, functionData, agentId);
            console.log('Function Result:', result);  // Add this line to debug
            
            let contextInfo;
            if (result.error) {
                contextInfo = `Error: ${result.error}`;
            } else if (result.data && result.data[0]) {
                contextInfo = result.data[0].context;
            } else {
                contextInfo = "No relevant information found.";
            }
            
            const functionResult = {
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: fc.call_id,
                    output: JSON.stringify({ information: contextInfo })
                }
            };
            
            console.log('Sending Function Result:', functionResult);  // Add this line to debug
            dc.send(JSON.stringify(functionResult));
            dc.send(JSON.stringify({ type: "response.create" }));
            return;
        }
        
        // Handle audio transcript delta updates: accumulate transcript text
        if (realtimeEvent.type === "response.audio_transcript.delta") {
            aiTranscript += realtimeEvent.delta;
            const chatBox = document.getElementById('chat-box');
            let currentAiMessage = chatBox.lastElementChild;
            if (!currentAiMessage || !currentAiMessage.classList.contains('ai')) {
                currentAiMessage = document.createElement('div');
                currentAiMessage.className = 'chat-message ai';
                currentAiMessage.innerHTML = `
                    <span class="message-prefix">AI : </span>
                    <span class="message-text">${aiTranscript}</span>
                `;
                chatBox.appendChild(currentAiMessage);
            } else {
                currentAiMessage.querySelector('.message-text').textContent = aiTranscript;
            }
            chatBox.scrollTop = chatBox.scrollHeight;
            return;
        }
        
        // Handle final audio transcript done event: use only the done event transcript and store a single AI message
        if (realtimeEvent.type === "response.audio_transcript.done") {
            // Overwrite any accumulated delta text with the final transcript
            aiTranscript = realtimeEvent.transcript;
            const currentTime = new Date().toISOString();
            transcriptMessages.push({ role: "ai", transcript: "AI: " + aiTranscript, time: currentTime });
            // Update or create final AI message
            const chatBox = document.getElementById('chat-box');
            let currentAiMessage = chatBox.lastElementChild;
            if (!currentAiMessage || !currentAiMessage.classList.contains('ai')) {
                currentAiMessage = document.createElement('div');
                currentAiMessage.className = 'chat-message ai';
                currentAiMessage.innerHTML = `
                    <span class="message-prefix">AI : </span>
                    <span class="message-text">${aiTranscript}</span>
                `;
                chatBox.appendChild(currentAiMessage);
            } else {
                // Update only the message text, preserve prefix and timestamp
                currentAiMessage.querySelector('.message-text').textContent = aiTranscript;
            }
            chatBox.scrollTop = chatBox.scrollHeight;
            // Reset accumulator for future transcripts
            aiTranscript = "";
            return;
        }
        
       
    });

    // Start session using SDP
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp"
        },
    });
    const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);
    console.log("Connected to Realtime API for voice-to-voice interaction.");
    
    // Initialize temporary call log data
    currentCallLog = {
        voice_agent_id: agentId,
        call_start: new Date().toISOString(),
        call_end: null,
        transcript: null,
        status: "completed"
    };
    
    // Toggle buttons: show "End Call", hide "Start Call"
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'inline-flex';
}

// Add new function to handle transcript display
function appendMessageToChat(message, isAi = false) {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isAi ? 'ai' : 'user'}`;
    
    // Add prefix and message without timestamp
    messageDiv.innerHTML = `
        <span class="message-prefix">${isAi ? 'AI : ' : 'User : '}</span>
        <span class="message-text">${message}</span>
    `;
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// =================== Event Listeners and RTC Setup ===================

// Listener for the start button: initializes RTC connection, fetches data, and sets up events.
document.getElementById('start-btn')?.addEventListener('click', async function() {
    try {
        // Retrieve agentId from the input field. its is for <<Testing Only>>
        const agentId = document.getElementById('chat-input').value.trim();
        if (!agentId) {
            console.error("Agent ID is required");
            document.getElementById('function-call-log').innerText = "Please enter an Agent ID.";
            return;
        }

        await connectRTC(agentId);
    } catch (error) {
        console.error("Error in voice-to-voice connection:", error);
    }
});

// Updated mute and unmute event listeners for toggling button visibility
document.getElementById('mute-btn')?.addEventListener('click', function() {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = false);
        console.log("Microphone muted.");
    }
    document.getElementById('mute-btn').style.display = 'none';
    document.getElementById('unmute-btn').style.display = 'inline-flex';
});

document.getElementById('unmute-btn')?.addEventListener('click', function() {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = true);
        console.log("Microphone unmuted.");
    }
    document.getElementById('mute-btn').style.display = 'inline-flex';
    document.getElementById('unmute-btn').style.display = 'none';
});

// Listener for the stop button: terminates the call and cleans up resources.
document.getElementById('stop-btn')?.addEventListener('click', endCall);

// =================== Integration Notes ===================
// Frontend developers: Direct DOM manipulations and event setups are kept plain.
// You can easily convert these parts to your framework's components or lifecycle methods.

