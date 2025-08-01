document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const streamingToggle = document.getElementById('streaming-toggle');
    const ttsToggle = document.getElementById('tts-toggle');
    
    // Since you're running specifically on localhost:8000, hardcode the base URL
    const baseUrl = 'http://localhost:8000';
    
    let isWaitingForResponse = false;
    let isRecording = false;
    let recognition = null;
    let isSpeaking = false;
    
    // Create a voice feedback element
    const voiceFeedback = document.createElement('div');
    voiceFeedback.className = 'voice-feedback';
    voiceFeedback.textContent = 'Listening...';
    document.querySelector('.chat-container').appendChild(voiceFeedback);
    
    // Initialize text-to-speech
    function initTextToSpeech() {
        if (!('speechSynthesis' in window)) {
            console.error('Text-to-speech not supported in this browser');
            ttsToggle.disabled = true;
            ttsToggle.checked = false;
            return false;
        }
        
        // Load available voices
        function loadVoices() {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                console.log(`Loaded ${voices.length} voices for speech synthesis`);
                return true;
            }
            return false;
        }
        
        // Try to load voices now and also set a listener for when voices change
        if (!loadVoices()) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        
        return true;
    }
    
    // Function to speak text
    function speakText(text) {
        if (!ttsToggle.checked || !('speechSynthesis' in window) || isSpeaking) return;
        
        // Cancel any current speech
        window.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        
        // Try to find a good English voice
        const preferredVoices = [
            'Google US English',
            'Microsoft David - English (United States)',
            'Microsoft Zira - English (United States)',
            'Alex'
        ];
        
        // Find the first preferred voice that's available
        for (const voiceName of preferredVoices) {
            const voice = voices.find(v => v.name === voiceName);
            if (voice) {
                utterance.voice = voice;
                break;
            }
        }
        
        // If no preferred voice is found, try to find any English voice
        if (!utterance.voice) {
            const englishVoice = voices.find(v => v.lang.startsWith('en-'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }
        }
        
        // Set properties
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Add visual indication when speaking
        const lastAiMessage = document.querySelector('.message.ai:last-child');
        if (lastAiMessage) {
            lastAiMessage.classList.add('speaking');
        }
        
        // Handle speech events
        isSpeaking = true;
        
        utterance.onend = function() {
            isSpeaking = false;
            if (lastAiMessage) {
                lastAiMessage.classList.remove('speaking');
            }
        };
        
        utterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            isSpeaking = false;
            if (lastAiMessage) {
                lastAiMessage.classList.remove('speaking');
            }
        };
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
    }
    
    // Initialize speech recognition if available
    function initSpeechRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            micButton.style.display = 'none';
            return false;
        }
        
        // Create recognition object
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Configure
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Handle results
        recognition.onresult = function(event) {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            
            userInput.value = transcript;
            
            // Show what user is saying
            voiceFeedback.textContent = transcript || 'Listening...';
        };
        
        // Handle end of speech
        recognition.onend = function() {
            stopRecording();
            
            // If we got some text, send it after a short delay
            if (userInput.value.trim()) {
                setTimeout(() => {
                    sendMessage();
                }, 500);
            }
        };
        
        // Handle errors
        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            stopRecording();
            
            if (event.error === 'no-speech') {
                voiceFeedback.textContent = 'No speech detected. Try again.';
                setTimeout(() => {
                    voiceFeedback.classList.remove('visible');
                }, 2000);
            }
        };
        
        return true;
    }
    
    // Start recording
    function startRecording() {
        if (!recognition && !initSpeechRecognition()) return;
        
        // Stop any current speech when recording starts
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            isSpeaking = false;
            document.querySelectorAll('.message.ai.speaking').forEach(el => {
                el.classList.remove('speaking');
            });
        }
        
        isRecording = true;
        micButton.classList.add('recording');
        voiceFeedback.textContent = 'Listening...';
        voiceFeedback.classList.add('visible');
        
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            stopRecording();
        }
    }
    
    // Stop recording
    function stopRecording() {
        if (!isRecording) return;
        
        isRecording = false;
        micButton.classList.remove('recording');
        voiceFeedback.classList.remove('visible');
        
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }
    
    // Handle mic button click
    micButton.addEventListener('click', function() {
        if (isWaitingForResponse) return;
        
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
    
    // Handle TTS toggle change
    ttsToggle.addEventListener('change', function() {
        if (this.checked) {
            initTextToSpeech();
        } else {
            // Stop any current speech when TTS is disabled
            if (isSpeaking) {
                window.speechSynthesis.cancel();
                isSpeaking = false;
                document.querySelectorAll('.message.ai.speaking').forEach(el => {
                    el.classList.remove('speaking');
                });
            }
        }
    });
    
    // Auto-resize the textarea as user types
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        // Enable/disable send button based on input
        sendButton.disabled = !this.value.trim();
    });
    
    // Handle Enter key to send message
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isWaitingForResponse && this.value.trim()) {
                sendMessage();
            }
        }
    });
    
    // Handle send button click
    sendButton.addEventListener('click', function() {
        if (!isWaitingForResponse && userInput.value.trim()) {
            sendMessage();
        }
    });
    
    // Function to add a message to the chat
    function addMessage(content, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        
        messageContent.appendChild(paragraph);
        messageElement.appendChild(messageContent);
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageElement;
    }
    
    // Create typing indicator
    function createTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'message ai typing-indicator';
        typingElement.id = 'typing-indicator';
        
        const typingContent = document.createElement('div');
        typingContent.className = 'message-content';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            typingContent.appendChild(dot);
        }
        
        typingElement.appendChild(typingContent);
        chatMessages.appendChild(typingElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return typingElement;
    }
    
    // Remove typing indicator
    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Send message to Grok API
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message || isWaitingForResponse) return;
        
        // Add user message to chat
        addMessage(message, 'user');
        
        // Clear input and reset height
        userInput.value = '';
        userInput.style.height = 'auto';
        
        // Disable input during processing
        isWaitingForResponse = true;
        sendButton.disabled = true;
        micButton.disabled = true;
        
        // Determine if we should use streaming or non-streaming endpoint
        if (streamingToggle.checked) {
            handleStreamingResponse(message);
        } else {
            handleNonStreamingResponse(message);
        }
    }
    
    // Handle non-streaming response
    async function handleNonStreamingResponse(message) {
        try {
            // Create typing indicator
            createTypingIndicator();
            
            const response = await fetch(`${baseUrl}/grok/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Remove typing indicator
            removeTypingIndicator();
            
            // Add AI response to chat
            addMessage(data.content, 'ai');
            
            // Speak the response if TTS is enabled
            speakText(data.content);
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage("I'm sorry, I encountered an error processing your request.", 'ai');
        } finally {
            // Re-enable input
            isWaitingForResponse = false;
            sendButton.disabled = false;
            micButton.disabled = false;
            userInput.focus();
        }
    }
    
    // Handle streaming response
    function handleStreamingResponse(message) {
        // Create message placeholder for streaming content
        const typingIndicator = createTypingIndicator();
        let responseElement = null;
        let fullContent = '';
        
        // Log the URL being used
        console.log(`Connecting to: ${baseUrl}/grok/stream?message=${encodeURIComponent(message)}`);
        
        // Create EventSource for SSE with the correct URL
        const eventSource = new EventSource(`${baseUrl}/grok/stream?message=${encodeURIComponent(message)}`);
        
        eventSource.addEventListener('start', (event) => {
            console.log('Stream started');
        });
        
        eventSource.addEventListener('chunk', (event) => {
            const data = JSON.parse(event.data);
            
            if (!responseElement) {
                // Remove typing indicator and create response element on first chunk
                removeTypingIndicator();
                responseElement = addMessage('', 'ai');
            }
            
            // Append new content
            fullContent += data.content;
            responseElement.querySelector('p').textContent = fullContent;
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
        
        eventSource.addEventListener('complete', (event) => {
            console.log('Stream completed');
            eventSource.close();
            
            // If we didn't get any chunks, but got a complete event
            if (!responseElement) {
                removeTypingIndicator();
                const data = JSON.parse(event.data);
                addMessage(data.content, 'ai');
                fullContent = data.content;
            }
            
            // Speak the full response once streaming is complete
            speakText(fullContent);
            
            // Re-enable input
            isWaitingForResponse = false;
            sendButton.disabled = false;
            micButton.disabled = false;
            userInput.focus();
        });
        
        eventSource.addEventListener('error', (event) => {
            console.error('Stream error', event);
            eventSource.close();
            
            removeTypingIndicator();
            
            // If we didn't create a response element yet, create one with the error
            if (!responseElement) {
                addMessage("I'm sorry, I encountered an error processing your request.", 'ai');
            }
            
            // Re-enable input
            isWaitingForResponse = false;
            sendButton.disabled = false;
            micButton.disabled = false;
            userInput.focus();
        });
    }
    
    // Initialize
    sendButton.disabled = true;
    initSpeechRecognition();
    initTextToSpeech();
    console.log(`Grok Chat initialized. Will connect to: ${baseUrl}`);
}); 