# 🌿 MimeaHub — AI-Powered Offline Crop Disease Diagnostic Platform

MimeaHub is a lightweight, edge-computed Progressive Web Application (PWA) designed to empower smallholder farmers to diagnose plant leaf diseases instantly in the field, completely independent of an active internet connection. 

Built using pure native JavaScript and client-side hardware APIs, MimeaHub runs directly inside browser sandboxes on smartphones or laptops without requiring heavy application framework runtimes.

---

## 🚀 Core Engine Architecture & Features

### 🧠 1. Client-Side Neural Compute Network
* Loads a customized, pre-compiled **TensorFlow.js / Teachable Machine** convolutional neural network (`CNN`) model architecture cache directly over local application endpoints.
* Runs image matrices inside **WebGL compilation backends** for high-efficiency edge processing speeds under 100ms.

### 🎛️ 2. Environmental Pre-Processing Filters (Canvas Pipeline)
* Captures camera streams or file uploads and pipes pixels into an off-screen HTML5 `<canvas>` matrix.
* Programmatically handles direct red-green-blue (`RGBA`) contrast enhancement filters up to a scale factor of `1.32` to neutralize shadow and light variance in outdoor farms.

### 📍 3. Geospatial & Offline Data Persistence
* Uses browser-level **Geolocation APIs** to track latitudinal and longitudinal field tracking tokens down to 4 decimal places.
* Encapsulates records locally inside a structured asynchronous **IndexedDB** object storefront database engine, allowing offline access to historical scan logs.

### 📊 4. Trend Analytics Dashboard & Search Filters
* Computes multi-variant statistics from the client database and compiles structural metric progress charts completely via internal script calculations.
* Implements rapid fuzzy text parsing filters to search histories by disease title, time signature, or positional tokens.

---

## Technology Stack Specs

* **Frontend Engine:** HTML5, CSS3, Pure Vanilla JavaScript (ECMAScript 6)
* **AI Computation Layer:** TensorFlow.js Core library, Teachable Machine Helper Libraries
* **Local Transaction Database:** Structured IndexedDB API
* **Deployment Topology:** GitHub Pages Serverless Pipelines, PWA Service Worker Cache Layer


