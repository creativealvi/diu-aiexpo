const statusText = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const muteBtn = document.getElementById("muteBtn");
const stopBtn = document.getElementById("stopBtn");

// Create audio visualizer
const visualizer = document.querySelector('.visualizer');
const BAR_COUNT = 20;
for (let i = 0; i < BAR_COUNT; i++) {
  const bar = document.createElement('div');
  bar.className = 'bar';
  visualizer.appendChild(bar);
}
const bars = visualizer.querySelectorAll('.bar');

// Create two recognition instances - one for English and one for Bengali
const englishRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
const bengaliRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

// Set proper language codes
englishRecognition.lang = 'en-US';
bengaliRecognition.lang = 'bn-IN';

// Configure both recognitions
[englishRecognition, bengaliRecognition].forEach(recognition => {
  recognition.interimResults = true;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;
});

let currentRecognition = englishRecognition;
let isListening = false;
let voices = [];
let audioContext;
let analyser;
let microphone;
let animationFrame;
let isSpeaking = false;
let speechTimeout = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Get available voices
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

// Initialize audio context for visualization
async function initAudioContext() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    updateVisualization();
  } catch (err) {
    console.error('Error accessing microphone:', err);
    statusText.innerText = "Microphone access is required. Please allow access and refresh the page.";
  }
}

function updateVisualization() {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  const step = Math.floor(dataArray.length / BAR_COUNT);
  
  bars.forEach((bar, index) => {
    const dataPoint = dataArray[index * step];
    const height = (dataPoint / 255) * 40 + 3;
    bar.style.height = `${height}px`;
  });
  
  animationFrame = requestAnimationFrame(updateVisualization);
}

function switchLanguage() {
  if (currentRecognition) {
    try {
      currentRecognition.stop();
    } catch (error) {
      console.error('Error stopping recognition during language switch:', error);
    }
  }

  currentRecognition = (currentRecognition === englishRecognition) ? bengaliRecognition : englishRecognition;
  
  if (currentRecognition === bengaliRecognition) {
    statusText.innerText = "বাংলায় শুনছি...";
    langBtn.querySelector('span').textContent = "Switch to English";
  } else {
    statusText.innerText = "Listening in English...";
    langBtn.querySelector('span').textContent = "বাংলায় যান";
  }
  
  if (isListening && !isSpeaking) {
    setTimeout(() => {
      safeStartRecognition();
    }, 500);
  }
}

function safeStartRecognition() {
  if (!currentRecognition) return;
  
  try {
    if (currentRecognition.state === 'running') {
      console.log('Recognition already running, skipping start');
      return;
    }
    currentRecognition.start();
    retryCount = 0;
  } catch (error) {
    console.error('Error in safeStartRecognition:', error);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => safeStartRecognition(), RETRY_DELAY);
    } else {
      console.error('Max retries reached, stopping recognition attempts');
      statusText.innerText = "Speech recognition failed. Please refresh the page.";
      isListening = false;
      startBtn.style.display = "flex";
    }
  }
}

function restartRecognition() {
  try {
    englishRecognition.stop();
    bengaliRecognition.stop();
  } catch (error) {
    console.error('Error stopping recognition:', error);
  }

  if (isListening && !isSpeaking) {
    setTimeout(() => {
      safeStartRecognition();
    }, 500);
  }
}

// Set up event handlers for both recognitions
[englishRecognition, bengaliRecognition].forEach(recognition => {
  recognition.onstart = function() {
    isListening = true;
    if (!isSpeaking) {
      statusText.innerText = recognition === bengaliRecognition ? "বাংলায় শুনছি..." : "Listening...";
    }
    muteBtn.querySelector('span').textContent = "Stop Speech";
    muteBtn.querySelector('.icon').textContent = "⏹️";
    startBtn.style.display = "none";
    if (!audioContext) initAudioContext();
  };

  recognition.onend = function() {
    if (isListening && !isSpeaking && recognition === currentRecognition) {
      setTimeout(() => {
        if (recognition === currentRecognition && isListening && !isSpeaking) {
          safeStartRecognition();
        }
      }, 500);
    } else if (!isListening) {
      statusText.innerText = "Click Start to begin listening";
      startBtn.style.display = "flex";
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    }
  };

  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    
    switch (event.error) {
      case 'not-allowed':
        statusText.innerText = "Please enable microphone access";
        isListening = false;
        startBtn.style.display = "flex";
        break;
        
      case 'no-speech':
        statusText.innerText = "No speech detected. Please check your microphone and speak clearly.";
        setTimeout(() => {
          if (isListening) safeStartRecognition();
        }, RETRY_DELAY);
        break;
        
      case 'aborted':
        console.log('Recognition aborted, attempting restart...');
        setTimeout(() => {
          if (isListening) safeStartRecognition();
        }, RETRY_DELAY);
        break;
        
      default:
        statusText.innerText = `Error: ${event.error}`;
        startBtn.style.display = "flex";
    }
  };

  recognition.onresult = function(event) {
    if (isSpeaking) return;
    
    const result = event.results[event.results.length - 1];
    const userText = result[0].transcript;
    
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }
    
    if (result.isFinal) {
      statusText.innerText = `You: "${userText}"`;
      speechTimeout = setTimeout(() => {
        sendToBot(userText);
      }, 1500);
    } else {
      statusText.innerText = `Listening: ${userText}`;
    }
  };
});

startBtn.onclick = function() {
  isListening = true;
  retryCount = 0;
  safeStartRecognition();
  startBtn.style.display = "none";
};

muteBtn.onclick = function() {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    if (isListening) {
      setTimeout(() => {
        safeStartRecognition();
      }, 500);
    }
  }
};

stopBtn.onclick = function() {
  isListening = false;
  try {
    englishRecognition.stop();
    bengaliRecognition.stop();
  } catch (error) {
    console.error('Error stopping recognition:', error);
  }
  speechSynthesis.cancel();
  if (speechTimeout) {
    clearTimeout(speechTimeout);
  }
  statusText.innerText = "Session Ended";
  startBtn.style.display = "flex";
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
};

function sendToBot(text) {
  statusText.innerText = "Processing...";
  
  fetch("/.netlify/functions/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text })
  })
  .then(res => {
    if (!res.ok) {
      throw new Error(res.status >= 500 ? 'Server error. Please try again later.' : 'Network response was not ok');
    }
    return res.json();
  })
  .then(data => {
    speak(data.reply);
  })
  .catch((error) => {
    console.error('Error:', error);
    statusText.innerText = "Connection error. Please try again.";
    speak("Sorry, I couldn't process your request at the moment. Please check your internet connection and try again.");
  });
}

function removeEmojis(text) {
  return text
    .replace(/🔇/g, '')
    .replace(/🔊/g, '')
    .replace(/❌/g, '')
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

function speak(text) {
  const cleanText = removeEmojis(text);
  const speech = new SpeechSynthesisUtterance(cleanText);
  
  speech.lang = currentRecognition === bengaliRecognition ? 'bn-IN' : 'en-US';
  
  if (currentRecognition === bengaliRecognition) {
    // Try to find a female Bengali voice
    const bengaliVoice = voices.find(voice => 
      (voice.lang.includes('bn') || voice.lang.includes('hi-IN')) && 
      (voice.name.toLowerCase().includes('female') || voice.name.includes('woman'))
    ) || voices.find(voice => voice.lang.includes('bn') || voice.lang.includes('hi-IN'));
    
    if (bengaliVoice) {
      speech.voice = bengaliVoice;
    }
    speech.rate = 0.9;
    speech.pitch = 1.2; // Slightly higher pitch for more feminine voice
  } else {
    const englishVoice = voices.find(voice => 
      voice.name.includes('female') || 
      voice.name.includes('Samantha') || 
      voice.name.includes('Google US English Female')
    );
    if (englishVoice) {
      speech.voice = englishVoice;
    }
    speech.rate = 1.1;
    speech.pitch = 1.1;
  }
  
  speech.volume = 1.0;
  
  speech.onstart = () => {
    isSpeaking = true;
    statusText.innerText = `DIAA: "${text}"`;
    try {
      currentRecognition.stop();
    } catch (error) {
      console.error('Error stopping recognition during speech:', error);
    }
  };
  
  speech.onend = () => {
    isSpeaking = false;
    setTimeout(() => {
      if (isListening) {
        safeStartRecognition();
      }
    }, 1000);
  };

  speechSynthesis.speak(speech);
}

const langBtn = document.createElement('button');
langBtn.id = 'langBtn';
langBtn.innerHTML = `
  <div class="icon">🌐</div>
  <span>বাংলায় যান</span>
`;
langBtn.onclick = switchLanguage;
document.querySelector('.controls').appendChild(langBtn);

window.addEventListener('load', () => {
  setTimeout(() => {
    safeStartRecognition();
  }, 1000);
});