// ==========================================================================
// 1. COMPONENT DOM ACCESSORS & HANDLES
// ==========================================================================
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

const zoomContainer = document.getElementById('zoom-container');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValueDisplay = document.getElementById('zoom-value');

const processingCanvas = document.getElementById('processing-canvas');
const locationDisplay = document.getElementById('location-display');
const btnExportReport = document.getElementById('btn-export-report');

const searchHistoryInput = document.getElementById('search-history');
const analyticsContainer = document.getElementById('analytics-chart-container');

let stream = null;
let model = null;
let currentLanguage = 'en';
let currentDetectedDisease = ''; 
let db = null;
let videoTrack = null;
let currentGPS = "Nairobi, KE";
let allCachedScans = []; 

const MODEL_URL = "./model/";

// ==========================================================================
// 2. LIFECYCLE BOOT LOOPS
// ==========================================================================
async function initApp() {
    try {
        updateLanguageUI();
        statusDiv.innerText = diseaseDatabase[currentLanguage]["loading_model"];
        model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
        tf.getBackend();
        statusDiv.innerText = diseaseDatabase[currentLanguage]["ready"];
        fetchCoordinates();
    } catch (error) {
        statusDiv.innerText = "Console Engine Offline";
    }
}

function fetchCoordinates() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentGPS = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                if (locationDisplay) locationDisplay.innerText = currentGPS;
            },
            (error) => {
                currentGPS = "Nairobi, KE";
                if (locationDisplay) locationDisplay.innerText = currentGPS;
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// ==========================================================================
// 3. PERSISTENT TRANSACTION LAYERS (INDEXEDDB)
// ==========================================================================
function initDatabase() {
    const request = indexedDB.open("CropDetectorDB", 1);
    request.onupgradeneeded = (e) => {
        e.target.result.createObjectStore("scans", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadHistoryFromDB();
    };
}

function saveScanToDB(diseaseKey, confidenceValue) {
    if (!db) return;
    const transaction = db.transaction(["scans"], "readwrite");
    const store = transaction.objectStore("scans");
    
    const scanEntry = {
        diseaseKey: diseaseKey,
        confidence: confidenceValue,
        timestamp: new Date().toLocaleString(),
        coordinates: currentGPS
    };

    store.add(scanEntry);
    transaction.oncomplete = () => loadHistoryFromDB();
}

function loadHistoryFromDB() {
    if (!db) return;
    allCachedScans = []; 
    const transaction = db.transaction(["scans"], "readonly");
    const request = transaction.objectStore("scans").openCursor(null, "prev");

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            allCachedScans.push(cursor.value);
            cursor.continue();
        } else {
            renderHistoryCards(allCachedScans);
            calculateAnalytics(allCachedScans);
        }
    };
}

// ==========================================================================
// 4. UI COMPONENT COMPILERS & RENDERERS
// ==========================================================================
function displayResult(diseaseKey, confidenceValue) {
    const data = diseaseDatabase[currentLanguage]["diseases"][diseaseKey] || {
        "name": diseaseKey.replace(/_/g, ' '),
        "organic": "No systemic documentation written.",
        "chemical": "No chemical compounds assigned.",
        "prevention": "No preventative guidelines loaded."
    };
    
    document.getElementById('prediction-result').classList.remove('hidden');
    document.getElementById('disease-name').innerText = data.name.toUpperCase();
    document.getElementById('confidence-level').innerText = confidenceValue;
    
    const numericScore = parseFloat(confidenceValue);
    const ringFill = document.getElementById('ring-progress-fill');
    if (ringFill && !isNaN(numericScore)) {
        ringFill.setAttribute('stroke-dasharray', `${numericScore}, 100`);
    }

    if (locationDisplay) locationDisplay.innerText = currentGPS;
    document.getElementById('treatment-organic').innerText = data.organic;
    document.getElementById('treatment-chemical').innerText = data.chemical;
    document.getElementById('treatment-prevention').innerText = data.prevention;
}

function renderHistoryCards(scanArray) {
    historyList.innerHTML = "";
    if (scanArray.length === 0) {
        historyList.innerHTML = `<p style="color:var(--text-secondary); font-size:12px; margin:0; padding:12px; text-align:center;">${currentLanguage === 'en' ? 'Registry empty.' : 'Hakuna kumbukumbu.'}</p>`;
        return;
    }

    scanArray.forEach(entry => {
        const data = diseaseDatabase[currentLanguage]["diseases"][entry.diseaseKey] || { name: entry.diseaseKey.replace(/_/g, ' ') };
        const savedGPS = entry.coordinates || "N/A";
        
        const logCard = document.createElement("div");
        logCard.className = "ledger-entry-row";
        logCard.setAttribute('data-key', entry.diseaseKey);
        logCard.setAttribute('data-confidence', entry.confidence);
        logCard.setAttribute('data-gps', savedGPS);
        
        logCard.innerHTML = `
            <div class="ledger-meta">
                <span class="ledger-title">${data.name}</span>
                <div class="ledger-sub">
                    <span>📅 ${entry.timestamp.split(',')[0]}</span>
                    <span>📍 ${savedGPS}</span>
                </div>
            </div>
            <span class="ledger-pct">${entry.confidence}</span>
        `;
        
        logCard.addEventListener('click', (e) => {
            const targetKey = e.currentTarget.getAttribute('data-key');
            const targetConfidence = e.currentTarget.getAttribute('data-confidence');
            const targetGPS = e.currentTarget.getAttribute('data-gps');
            currentDetectedDisease = targetKey;
            currentGPS = targetGPS;
            displayResult(targetKey, targetConfidence);
        });
        historyList.appendChild(logCard);
    });
}

function calculateAnalytics(scanArray) {
    analyticsContainer.innerHTML = "";
    if (scanArray.length === 0) {
        analyticsContainer.innerHTML = `<p style="color:var(--text-secondary); font-size:12px; margin:0;">${currentLanguage === 'en' ? 'Awaiting scan registers.' : 'Piga picha ili kuona takwimu.'}</p>`;
        return;
    }

    const counts = {};
    scanArray.forEach(entry => { counts[entry.diseaseKey] = (counts[entry.diseaseKey] || 0) + 1; });
    const totalScans = scanArray.length;

    for (const [key, val] of Object.entries(counts)) {
        const data = diseaseDatabase[currentLanguage]["diseases"][key] || { name: key.replace(/_/g, ' ') };
        const percentageWidth = ((val / totalScans) * 100).toFixed(0);

        const chartRow = document.createElement("div");
        chartRow.className = "analytics-bar-row";
        chartRow.innerHTML = `
            <div class="analytics-row-meta">
                <span>${data.name}</span>
                <span class="metric-count">${val} (${percentageWidth}%)</span>
            </div>
            <div class="bar-track-bg">
                <div class="bar-fill-progress" style="width: ${percentageWidth}%;"></div>
            </div>
        `;
        analyticsContainer.appendChild(chartRow);
    }
}

// ==========================================================================
// 5. LEDGER TRANSACTIONS FILTERS & CONFIGS
// ==========================================================================
searchHistoryInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allCachedScans.filter(entry => {
        const data = diseaseDatabase[currentLanguage]["diseases"][entry.diseaseKey] || { name: entry.diseaseKey.replace(/_/g, ' ') };
        return data.name.toLowerCase().includes(query) || (entry.coordinates || "").toLowerCase().includes(query);
    });
    renderHistoryCards(filtered);
});

btnClearHistory.addEventListener('click', () => {
    if (!db) return;
    const transaction = db.transaction(["scans"], "readwrite");
    transaction.objectStore("scans").clear();
    transaction.oncomplete = () => loadHistoryFromDB();
});

// ==========================================================================
// 6. MULTILINGUAL PROTOCOL SWITCHER
// ==========================================================================
langSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateLanguageUI();
    loadHistoryFromDB(); 
    if (currentDetectedDisease) {
        displayResult(currentDetectedDisease, document.getElementById('confidence-level').innerText);
    }
});

function updateLanguageUI() {
    const isSw = currentLanguage === 'sw';
    document.getElementById('lbl-history').innerText = isSw ? "Historia ya Vipimo" : "Metrics & Analytics Deck";
    searchHistoryInput.placeholder = isSw ? "Chuja kumbukumbu..." : "search by disease or coordinates";
    btnExportReport.innerText = isSw ? "Nakili Ripoti ya WhatsApp" : "Copy WhatsApp Field Report";
    btnClearHistory.innerText = isSw ? "Futa Historia" : "Clear History";
}

// ==========================================================================
// 7. VIDEO STREAMS & OPTICAL FOCUS MANAGEMENT
// ==========================================================================
btnWebcam.addEventListener('click', async () => {
    if (stream) { stopWebcam(); return; }
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        webcamElement.srcObject = stream;
        webcamElement.classList.remove('hidden');
        imagePreview.classList.add('hidden');
        placeholderText.classList.add('hidden');
        btnCapture.classList.remove('hidden');
        btnWebcam.innerText = currentLanguage === 'en' ? "Stop Webcam" : "Zima Kamera";
        btnWebcam.className = "btn btn-glass";

        videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if ('zoom' in capabilities) {
            zoomContainer.classList.remove('hidden');
            zoomSlider.min = capabilities.zoom.min;
            zoomSlider.max = capabilities.zoom.max;
            zoomSlider.step = capabilities.zoom.step || 0.1;
            zoomSlider.value = videoTrack.getConstraints().zoom || 1;
            zoomValueDisplay.innerText = Number(zoomSlider.value).toFixed(1) + "x";
        }
    } catch (err) {
        alert("Camera sensor connection isolated.");
    }
});

zoomSlider.addEventListener('input', async (e) => {
    if (!videoTrack) return;
    const currentZoomVal = e.target.value;
    zoomValueDisplay.innerText = Number(currentZoomVal).toFixed(1) + "x";
    try { await videoTrack.applyConstraints({ advanced: [{ zoom: currentZoomVal }] }); } catch (err) {}
});

function stopWebcam() {
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; videoTrack = null; }
    webcamElement.classList.add('hidden');
    placeholderText.classList.remove('hidden');
    btnCapture.classList.add('hidden');
    zoomContainer.classList.add('hidden'); 
    btnWebcam.innerText = currentLanguage === 'en' ? "Washa Kamera / Start Webcam" : "Washa Kamera";
    btnWebcam.className = "btn btn-blue";
}

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

// ==========================================================================
// 8. IMAGE INFERENCE PROCESSING PIXEL INTERCEPTOR
// ==========================================================================
async function runInference(inputElement) {
    if (!model) return;
    statusDiv.innerText = diseaseDatabase[currentLanguage]["scanning"];
    fetchCoordinates();

    const ctx = processingCanvas.getContext('2d');
    processingCanvas.width = inputElement.videoWidth || inputElement.naturalWidth || 224;
    processingCanvas.height = inputElement.videoHeight || inputElement.naturalHeight || 224;
    ctx.drawImage(inputElement, 0, 0, processingCanvas.width, processingCanvas.height);
    
    const imageData = ctx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);
    const pixels = imageData.data;
    const contrastFactor = 1.32; 
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i]     = contrastFactor * (pixels[i] - 128) + 128;     
        pixels[i + 1] = contrastFactor * (pixels[i + 1] - 128) + 128; 
        pixels[i + 2] = contrastFactor * (pixels[i + 2] - 128) + 128; 
    }
    ctx.putImageData(imageData, 0, 0);

    const prediction = await model.predict(processingCanvas);
    let highestPrediction = prediction[0];
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > highestPrediction.probability) { highestPrediction = prediction[i]; }
    }
    
    const confidencePercentage = (highestPrediction.probability * 100).toFixed(0) + "%";
    currentDetectedDisease = highestPrediction.className; 
    
    statusDiv.innerText = diseaseDatabase[currentLanguage]["scan_complete"];
    displayResult(currentDetectedDisease, confidencePercentage);
    saveScanToDB(currentDetectedDisease, confidencePercentage);
}

// ==========================================================================
// 9. RE-EXPORT FIELD LOGS (WHATSAPP OUTBOUND SHUTTLE)
// ==========================================================================
btnExportReport.addEventListener('click', () => {
    const dName = document.getElementById('disease-name').innerText;
    const cLevel = document.getElementById('confidence-level').innerText;
    const tOrganic = document.getElementById('treatment-organic').innerText;
    const tChemical = document.getElementById('treatment-chemical').innerText;
    const tPrev = document.getElementById('treatment-prevention').innerText;

    const textReportTemplate = 
`🌱 *MimeaHub Field Diagnostic Report* 🌱
----------------------------------------
• *Disease Identified:* ${dName}
• *AI Confidence Score:* ${cLevel}
• *Field Coordinates:* GPS (${currentGPS})
• *Timestamp:* ${new Date().toLocaleString()}

🌿 *Organic Recommendation:*
${tOrganic}

🧪 *Chemical Inputs Option:*
${tChemical}

🛡️ *Prevention Guideline:*
${tPrev}

_Generated securely completely offline via MimeaHub AI Client App._`;

    navigator.clipboard.writeText(textReportTemplate).then(() => {
        const oldText = btnExportReport.innerText;
        btnExportReport.innerText = "✅ Report Saved to Clipboard!";
        setTimeout(() => { btnExportReport.innerText = oldText; }, 2000);
    });
});

// ==========================================================================
// 10. LIGHT/DARK MATRIX PERSISTENCE
// ==========================================================================
const themeToggleBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('mimeahub-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('mimeahub-theme', newTheme);
});

// Start Apps
initDatabase();
initApp();