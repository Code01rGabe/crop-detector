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

// Option 2 & 3 Accessors
const searchHistoryInput = document.getElementById('search-history');
const analyticsContainer = document.getElementById('analytics-chart-container');

let stream = null;
let model = null;
let currentLanguage = 'en';
let currentDetectedDisease = ''; 
let db = null;
let videoTrack = null;
let currentGPS = "Not Available";
let allCachedScans = []; // Local reference array to manage rapid search operations without querying disk constantly

const MODEL_URL = "./model/";

// 1. Core Boot Execution
async function initApp() {
    try {
        updateLanguageUI();
        statusDiv.innerText = diseaseDatabase[currentLanguage]["loading_model"];
        model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
        tf.getBackend();
        statusDiv.innerText = diseaseDatabase[currentLanguage]["ready"];
        fetchCoordinates();
    } catch (error) {
        statusDiv.innerText = "Model loading paused. Scan records are still operational offline.";
        console.error("Model loading issue:", error);
    }
}

// 2. Geolocation Processing
function fetchCoordinates() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentGPS = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                locationDisplay.innerText = `${currentLanguage === 'en' ? 'Location' : 'Mahali'}: ${currentGPS}`;
            },
            (error) => {
                currentGPS = "Offline/Protected";
                locationDisplay.innerText = `${currentLanguage === 'en' ? 'Location' : 'Mahali'}: ${currentGPS}`;
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

// 3. Local IndexedDB Setup
function initDatabase() {
    const request = indexedDB.open("CropDetectorDB", 1);
    request.onupgradeneeded = (event) => {
        event.target.result.createObjectStore("scans", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = (event) => {
        db = event.target.result;
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

// 4. Extract Records & Compute Option 2 (Analytics) & Option 3 (Fuzzy Engine)
function loadHistoryFromDB() {
    if (!db) return;

    allCachedScans = []; // Wipe internal registry cache
    const transaction = db.transaction(["scans"], "readonly");
    const store = transaction.objectStore("scans");
    const request = store.openCursor(null, "prev");

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            allCachedScans.push(cursor.value);
            cursor.continue();
        } else {
            // Cursor run complete! Render UI layouts from memory cache arrays
            renderHistoryCards(allCachedScans);
            calculateAnalytics(allCachedScans);
        }
    };
}

// Option 3 Modular Renderer handles list compilation matching dynamic filter inputs
function renderHistoryCards(scanArray) {
    historyList.innerHTML = "";
    
    if (scanArray.length === 0) {
        historyList.innerHTML = `<p style="color:#666; font-size:12px; margin:0;">${currentLanguage === 'en' ? 'No matching records found.' : 'Hakuna rekodi zilizopatikana.'}</p>`;
        return;
    }

    scanArray.forEach(entry => {
        const data = diseaseDatabase[currentLanguage]["diseases"][entry.diseaseKey] || { name: entry.diseaseKey.replace(/_/g, ' ') };
        const savedGPS = entry.coordinates || "N/A";
        
        const logCard = document.createElement("div");
        logCard.style.cssText = "background: #252525; padding: 10px; border-radius: 6px; font-size: 13px; border-left: 3px solid #2196f3; display: flex; flex-direction: column; cursor: pointer; transition: background 0.2s;";
        logCard.setAttribute('data-key', entry.diseaseKey);
        logCard.setAttribute('data-confidence', entry.confidence);
        logCard.setAttribute('data-gps', savedGPS);
        
        logCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-weight: bold; color: #fff; pointer-events: none;">
                <span>${data.name}</span>
                <span style="color: #4caf50;">${entry.confidence}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #777; font-size: 10px; margin-top: 4px; pointer-events: none;">
                <span>📅 ${entry.timestamp}</span>
                <span>📍 ${savedGPS}</span>
            </div>
        `;
        
        logCard.addEventListener('click', (e) => {
            const targetKey = e.currentTarget.getAttribute('data-key');
            const targetConfidence = e.currentTarget.getAttribute('data-confidence');
            const targetGPS = e.currentTarget.getAttribute('data-gps');
            currentDetectedDisease = targetKey;
            currentGPS = targetGPS;
            displayResult(targetKey, targetConfidence);
        });

        logCard.addEventListener('mouseenter', () => logCard.style.background = "#2e2e2e");
        logCard.addEventListener('mouseleave', () => logCard.style.background = "#252525");

        historyList.appendChild(logCard);
    });
}

// Option 3 Fuzzy Event Listener updates display dynamically on keyboard inputs
searchHistoryInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    const filteredResults = allCachedScans.filter(entry => {
        const data = diseaseDatabase[currentLanguage]["diseases"][entry.diseaseKey] || { name: entry.diseaseKey.replace(/_/g, ' ') };
        const matchDisease = data.name.toLowerCase().includes(query);
        const matchGPS = (entry.coordinates || "").toLowerCase().includes(query);
        const matchTime = entry.timestamp.toLowerCase().includes(query);
        return matchDisease || matchGPS || matchTime;
    });

    renderHistoryCards(filteredResults);
});

// Option 2 Metrics Loop: Tallies aggregate values and builds clean inline progress bars
function calculateAnalytics(scanArray) {
    analyticsContainer.innerHTML = "";
    if (scanArray.length === 0) {
        analyticsContainer.innerHTML = `<p style="color:#666; font-size:12px; margin:0;">${currentLanguage === 'en' ? 'Scan fields to compile trend charts.' : 'Piga picha ili kuona takwimu.'}</p>`;
        return;
    }

    const counts = {};
    scanArray.forEach(entry => {
        counts[entry.diseaseKey] = (counts[entry.diseaseKey] || 0) + 1;
    });

    const totalScans = scanArray.length;

    // Loop through aggregates and append styled layout bars directly
    for (const [key, val] of Object.entries(counts)) {
        const data = diseaseDatabase[currentLanguage]["diseases"][key] || { name: key.replace(/_/g, ' ') };
        const percentageWidth = ((val / totalScans) * 100).toFixed(0);

        const chartRow = document.createElement("div");
        chartRow.style.cssText = "display: flex; flex-direction: column; gap: 4px; font-size: 12px;";
        chartRow.innerHTML = `
            <div style="display: flex; justify-content: space-between; color: #ccc;">
                <span>${data.name}</span>
                <span style="font-weight:bold; color:#4caf50;">${val} (${percentageWidth}%)</span>
            </div>
            <div style="width: 100%; background: #222; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="width: ${percentageWidth}%; background: #4caf50; height: 100%; border-radius: 4px; transition: width 0.5s ease-out;"></div>
            </div>
        `;
        analyticsContainer.appendChild(chartRow);
    }
}

btnClearHistory.addEventListener('click', () => {
    if (!db) return;
    const transaction = db.transaction(["scans"], "readwrite");
    transaction.objectStore("scans").clear();
    transaction.oncomplete = () => loadHistoryFromDB();
});

// 5. Localization & Framework Updates
langSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateLanguageUI();
    loadHistoryFromDB(); 
    locationDisplay.innerText = `${currentLanguage === 'en' ? 'Location' : 'Mahali'}: ${currentGPS}`;
    if (currentDetectedDisease) {
        displayResult(currentDetectedDisease, document.getElementById('confidence-level').innerText);
    }
});

function updateLanguageUI() {
    const isSw = currentLanguage === 'sw';
    document.getElementById('app-title').innerText = isSw ? "AI Kichunguzi cha Magonjwa ya Mimea" : "AI Crop Disease Detector";
    document.getElementById('lbl-organic').innerText = isSw ? "Tiba ya Kiasili:" : "Organic Treatment:";
    document.getElementById('lbl-chemical').innerText = isSw ? "Chaguo la Kemikali:" : "Chemical Option:";
    document.getElementById('lbl-prevention').innerText = isSw ? "Kinga:" : "Prevention:";
    document.getElementById('lbl-history').innerText = isSw ? "Historia ya Vipimo" : "Scan History";
    document.getElementById('lbl-analytics').innerText = isSw ? "Takwimu za Mazao" : "Crop Health Trends";
    searchHistoryInput.placeholder = isSw ? "🔍 Tafuta kwa ugonjwa au mahali..." : "🔍 Search by disease or location...";
    btnExportReport.innerText = isSw ? "📋 Nakili Ripoti ya WhatsApp" : "📋 Copy WhatsApp Field Report";
    btnClearHistory.innerText = isSw ? "Futa Historia" : "Clear History";
    if(model && (statusDiv.innerText.includes("Ready") || statusDiv.innerText.includes("Tayari"))) {
        statusDiv.innerText = diseaseDatabase[currentLanguage]["ready"];
    }
}

// 6. Camera Stream Handling & Zoom Controls
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
        alert("Camera access failed. Please utilize the standard File Upload instead.");
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
    btnWebcam.innerText = currentLanguage === 'en' ? "Start Webcam" : "Washa Kamera";
    btnWebcam.style.backgroundColor = "#4caf50";
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

// 7. Core TensorFlow.js Inference & Option 1 Canvas Manipulation
async function runInference(inputElement) {
    if (!model) return;
    statusDiv.innerText = diseaseDatabase[currentLanguage]["scanning"];
    fetchCoordinates();

    const ctx = processingCanvas.getContext('2d');
    processingCanvas.width = inputElement.videoWidth || inputElement.naturalWidth || 224;
    processingCanvas.height = inputElement.videoHeight || inputElement.naturalHeight || 224;
    ctx.drawImage(inputElement, 0, 0, processingCanvas.width, processingCanvas.height);
    
    // Canvas Pre-Processing Filter execution matrix
    const imageData = ctx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);
    const d = imageData.data;
    const contrastFactor = 1.32; 
    for (let i = 0; i < d.length; i += 4) {
        d[i]     = contrastFactor * (d[i] - 128) + 128;     
        d[i + 1] = contrastFactor * (d[i + 1] - 128) + 128; 
        d[i + 2] = contrastFactor * (d[i + 2] - 128) + 128; 
    }
    ctx.putImageData(imageData, 0, 0);

    const prediction = await model.predict(processingCanvas);
    let highestPrediction = prediction[0];
    for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > highestPrediction.probability) { highestPrediction = prediction[i]; }
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
        "organic": "No organic guidelines stored.",
        "chemical": "No chemical records matched.",
        "prevention": "No preventative mapping fields present."
    };
    document.getElementById('prediction-result').classList.remove('hidden');
    document.getElementById('disease-name').innerText = data.name;
    document.getElementById('confidence-level').innerText = confidenceValue;
    locationDisplay.innerText = `${currentLanguage === 'en' ? 'Location' : 'Mahali'}: ${currentGPS}`;
    document.getElementById('treatment-organic').innerText = data.organic;
    document.getElementById('treatment-chemical').innerText = data.chemical;
    document.getElementById('treatment-prevention').innerText = data.prevention;
}

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
        btnExportReport.innerText = currentLanguage === 'en' ? "✅ Copied to Clipboard!" : "✅ Imesikitishwa!";
        btnExportReport.style.background = "#2196f3";
        setTimeout(() => { btnExportReport.innerText = oldText; btnExportReport.style.background = "#4caf50"; }, 2000);
    });
});

initDatabase();
initApp();