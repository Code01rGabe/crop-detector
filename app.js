const webcamElement = document.getElementById('webcam');
const imagePreview = document.getElementById('image-preview');
const placeholderText = document.getElementById('placeholder-text');
const btnWebcam = document.getElementById('btn-webcam');
const btnCapture = document.getElementById('btn-capture');
const fileUpload = document.getElementById('file-upload');
const statusDiv = document.getElementById('status');
const langSelect = document.getElementById('language-select');
const historyList = document.getElementById('history-list');
const btnClearHistory = document.getElementById('btn-clear-history');

// Option 3 DOM Accessors
const zoomContainer = document.getElementById('zoom-container');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValueDisplay = document.getElementById('zoom-value');

let stream = null;
let model = null;
let currentLanguage = 'en';
let currentDetectedDisease = ''; 
let db = null;
let videoTrack = null; // References active optical capabilities

// Points directly to your local project weights root
const MODEL_URL = "./model/";

// 1. Core Boot Execution
async function initApp() {
    try {
        updateLanguageUI();
        
        statusDiv.innerText = diseaseDatabase[currentLanguage]["loading_model"];
        
        // Load the converted Teachable Machine file structures locally via browser cache
        model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
        tf.getBackend(); // Force WebGL warm-up for rapid execution

        statusDiv.innerText = diseaseDatabase[currentLanguage]["ready"];
    } catch (error) {
        statusDiv.innerText = "Model loading paused. Scan records are still operational offline.";
        console.error("Model loading issue:", error);
    }
}

// 2. Local IndexedDB Lifecycle Setup
function initDatabase() {
    console.log("🔄 Step 1: Attempting to open CropDetectorDB...");
    const request = indexedDB.open("CropDetectorDB", 1);

    request.onupgradeneeded = (event) => {
        const localDb = event.target.result;
        localDb.createObjectStore("scans", { keyPath: "id", autoIncrement: true });
        console.log("📦 Step 1b: Object store 'scans' created successfully!");
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log("✅ Step 2: Database opened successfully inside browser storage!");
        loadHistoryFromDB(); // Print past records safely offline
    };

    request.onerror = (event) => {
        console.error("❌ Database open blocked or failed:", event.target.error);
    };
}

// 3. Write Records to Local Hardware Storage
function saveScanToDB(diseaseKey, confidenceValue) {
    if (!db) return;

    const transaction = db.transaction(["scans"], "readwrite");
    const store = transaction.objectStore("scans");
    
    const scanEntry = {
        diseaseKey: diseaseKey,
        confidence: confidenceValue,
        timestamp: new Date().toLocaleString()
    };

    store.add(scanEntry);
    transaction.oncomplete = () => {
        console.log("💾 Scan entry committed to disk storage:", scanEntry);
        loadHistoryFromDB(); 
    };
}

// 4. Extract and Render Local Scan Storage Cards (Option 1 Enhanced Clicks)
function loadHistoryFromDB() {
    if (!db) return;

    historyList.innerHTML = ""; 
    const transaction = db.transaction(["scans"], "readonly");
    const store = transaction.objectStore("scans");
    const request = store.openCursor(null, "prev");

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const entry = cursor.value;
            const data = diseaseDatabase[currentLanguage]["diseases"][entry.diseaseKey] || { name: entry.diseaseKey.replace(/_/g, ' ') };
            
            const logCard = document.createElement("div");
            // Interactive pointers added alongside standard CSS layout definitions
            logCard.style.cssText = "background: #252525; padding: 10px; border-radius: 6px; font-size: 13px; border-left: 3px solid #2196f3; display: flex; flex-direction: column; cursor: pointer; transition: background 0.2s;";
            logCard.setAttribute('data-key', entry.diseaseKey);
            logCard.setAttribute('data-confidence', entry.confidence);
            
            logCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #fff; pointer-events: none;">
                    <span>${data.name}</span>
                    <span style="color: #4caf50;">${entry.confidence}</span>
                </div>
                <span style="color: #777; font-size: 10px; margin-top: 4px; pointer-events: none;">📅 ${entry.timestamp}</span>
            `;
            
            // Option 1: Triggers display updates directly out of historical archive selections
            logCard.addEventListener('click', (e) => {
                const targetKey = e.currentTarget.getAttribute('data-key');
                const targetConfidence = e.currentTarget.getAttribute('data-confidence');
                currentDetectedDisease = targetKey;
                displayResult(targetKey, targetConfidence);
            });

            // Subtle hover response highlight entries
            logCard.addEventListener('mouseenter', () => logCard.style.background = "#2e2e2e");
            logCard.addEventListener('mouseleave', () => logCard.style.background = "#252525");

            historyList.appendChild(logCard);
            cursor.continue();
        } else if (historyList.innerHTML === "") {
            historyList.innerHTML = `<p style="color:#666; font-size:12px; margin:0;">${currentLanguage === 'en' ? 'No recent records.' : 'Hakuna rekodi hivi karibuni.'}</p>`;
        }
    };
}

// Wipe All Records from Laptop Drive
btnClearHistory.addEventListener('click', () => {
    if (!db) return;
    const transaction = db.transaction(["scans"], "readwrite");
    transaction.objectStore("scans").clear();
    transaction.oncomplete = () => loadHistoryFromDB();
});

// 5. Localization Controls Mapping
langSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateLanguageUI();
    loadHistoryFromDB(); 
    
    if (currentDetectedDisease) {
        displayResult(currentDetectedDisease, document.getElementById('confidence-level').innerText);
    }
});

function updateLanguageUI() {
    if(currentLanguage === 'sw') {
        document.getElementById('app-title').innerText = "AI Kichunguzi cha Magonjwa ya Mimea";
        document.getElementById('lbl-organic').innerText = "Tiba ya Kiasili:";
        document.getElementById('lbl-chemical').innerText = "Chaguo la Kemikali:";
        document.getElementById('lbl-prevention').innerText = "Kinga:";
        document.getElementById('lbl-history').innerText = "Historia ya Vipimo";
        btnClearHistory.innerText = "Futa Historia";
        if(model && (statusDiv.innerText.includes("Ready") || statusDiv.innerText.includes("Tayari"))) {
            statusDiv.innerText = diseaseDatabase['sw']["ready"];
        }
    } else {
        document.getElementById('app-title').innerText = "AI Crop Disease Detector";
        document.getElementById('lbl-organic').innerText = "Organic Treatment:";
        document.getElementById('lbl-chemical').innerText = "Chemical Option:";
        document.getElementById('lbl-prevention').innerText = "Prevention:";
        document.getElementById('lbl-history').innerText = "Scan History";
        btnClearHistory.innerText = "Clear History";
        if(model && (statusDiv.innerText.includes("Ready") || statusDiv.innerText.includes("Tayari"))) {
            statusDiv.innerText = diseaseDatabase['en']["ready"];
        }
    }
}

// 6. Laptop Hardware Streams & Option 3 Media Capabilities Engine
btnWebcam.addEventListener('click', async () => {
    if (stream) { stopWebcam(); return; }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        webcamElement.srcObject = stream;
        webcamElement.classList.remove('hidden');
        imagePreview.classList.add('hidden');
        placeholderText.classList.add('hidden');
        btnCapture.classList.remove('hidden');
        btnWebcam.innerText = currentLanguage === 'en' ? "Stop Webcam" : "Zima Kamera";
        btnWebcam.style.backgroundColor = "#f44336";

        // Option 3 focal evaluation hook
        videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        
        if ('zoom' in capabilities) {
            zoomContainer.classList.remove('hidden');
            zoomSlider.min = capabilities.zoom.min;
            zoomSlider.max = capabilities.zoom.max;
            zoomSlider.step = capabilities.zoom.step || 0.1;
            zoomSlider.value = videoTrack.getConstraints().zoom || 1;
            zoomValueDisplay.innerText = Number(zoomSlider.value).toFixed(1) + "x";
        } else {
            console.log("Digital zoom scaling constraints not supported by current lens device.");
            zoomContainer.classList.add('hidden'); 
        }

    } catch (err) {
        alert("Camera access failed. Please utilize the standard File Upload instead.");
    }
});

// Option 3 Listener handles immediate video stream alteration constraints
zoomSlider.addEventListener('input', async (e) => {
    if (!videoTrack) return;
    const currentZoomVal = e.target.value;
    zoomValueDisplay.innerText = Number(currentZoomVal).toFixed(1) + "x";
    try {
        await videoTrack.applyConstraints({ advanced: [{ zoom: currentZoomVal }] });
    } catch (err) {
        console.error("Zoom structural constraint modification failed:", err);
    }
});

function stopWebcam() {
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; videoTrack = null; }
    webcamElement.classList.add('hidden');
    placeholderText.classList.remove('hidden');
    btnCapture.classList.add('hidden');
    zoomContainer.classList.add('hidden'); // Close slider alongside active video matrix
    btnWebcam.innerText = currentLanguage === 'en' ? "Start Webcam" : "Washa Kamera";
    btnWebcam.style.backgroundColor = "#4caf50";
}

// 7. Local File Reader Actions
fileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        stopWebcam();
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            placeholderText.classList.add('hidden');
            imagePreview.onload = () => runInference(imagePreview);
        }
        reader.readAsDataURL(file);
    }
});

btnCapture.addEventListener('click', () => runInference(webcamElement));

// 8. Core TensorFlow.js Local Compute Processing
async function runInference(inputElement) {
    if (!model) return;
    
    statusDiv.innerText = diseaseDatabase[currentLanguage]["scanning"];
    const prediction = await model.predict(inputElement);
    
    let highestPrediction = prediction[0];
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > highestPrediction.probability) {
            highestPrediction = prediction[i];
        }
    }
    
    const confidencePercentage = (highestPrediction.probability * 100).toFixed(1) + "%";
    currentDetectedDisease = highestPrediction.className; 
    
    statusDiv.innerText = diseaseDatabase[currentLanguage]["scan_complete"];
    displayResult(currentDetectedDisease, confidencePercentage);
    saveScanToDB(currentDetectedDisease, confidencePercentage);
}

function displayResult(diseaseKey, confidenceValue) {
    const data = diseaseDatabase[currentLanguage]["diseases"][diseaseKey] || {
        "name": diseaseKey.replace(/_/g, ' '),
        "organic": "No organic guidelines stored in current dictionary profile.",
        "chemical": "No chemical compound records matched.",
        "prevention": "No preventative mapping fields present."
    };
    
    document.getElementById('prediction-result').classList.remove('hidden');
    document.getElementById('disease-name').innerText = data.name;
    document.getElementById('confidence-level').innerText = confidenceValue;
    document.getElementById('treatment-organic').innerText = data.organic;
    document.getElementById('treatment-chemical').innerText = data.chemical;
    document.getElementById('treatment-prevention').innerText = data.prevention;
}

// 9. Offline Service Worker Handshake
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service worker activated securely:', reg.scope))
            .catch(err => console.log('Service worker cache failed to load:', err));
    });
}

// Fire both initializations independently on boot!
initDatabase();
initApp();