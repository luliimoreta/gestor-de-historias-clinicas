// Database Initialization with Dexie
const db = new Dexie("VitalDocDB");
db.version(1).stores({
    patients: "++id, name, age, triage, lastVisit"
});

// Initial Data Migration (if localStorage exists)
async function migrateData() {
    const localData = localStorage.getItem('patients');
    if (localData) {
        const patients = JSON.parse(localData);
        // Only migrate if DB is empty
        const count = await db.patients.count();
        if (count === 0) {
            await db.patients.bulkAdd(patients.map(({id, ...p}) => p));
            console.log("Datos migrados de localStorage a IndexedDB");
        }
        localStorage.removeItem('patients');
    }
}

// UI Rendering
async function renderPatients(filter = "") {
    const list = document.getElementById('patientList');
    if (!list) return;
    list.innerHTML = "";

    let patients = await db.patients.toArray();
    
    const filtered = patients.filter(p => 
        p.name.toLowerCase().includes(filter.toLowerCase())
    ).sort((a, b) => b.id - a.id);

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.innerHTML = `
            <div class="triage-indicator triage-${p.triage}"></div>
            <div class="patient-info">
                <div class="patient-name">${p.name}</div>
                <div class="patient-meta">${p.age} años • ${p.lastVisit}</div>
            </div>
            <i class="fas fa-chevron-right" style="color: #BDC3C7"></i>
        `;
        list.appendChild(card);
    });

    updateStats();
}

async function updateStats() {
    const patients = await db.patients.toArray();
    const counts = { emergency: 0, urgent: 0, standard: 0 };
    patients.forEach(p => counts[p.triage]++);

    const total = patients.length || 1; // avoid division by zero
    document.getElementById('totalToday').innerText = patients.length;

    const chart = document.getElementById('triageChart');
    if (!chart) return;
    
    chart.innerHTML = `
        <div class="bar-item emergency-bar" style="height: ${(counts.emergency/total)*100}%" data-label="Emergencia" data-value="${counts.emergency}"></div>
        <div class="bar-item urgent-bar" style="height: ${(counts.urgent/total)*100}%" data-label="Urgente" data-value="${counts.urgent}"></div>
        <div class="bar-item standard-bar" style="height: ${(counts.standard/total)*100}%" data-label="Estándar" data-value="${counts.standard}"></div>
    `;
}

// View Switching
const views = {
    home: document.getElementById('homeView'),
    stats: document.getElementById('statsView')
};

const navItems = {
    home: document.getElementById('navHome'),
    stats: document.getElementById('navStats')
};

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(navItems).forEach(n => n.classList.remove('active'));

    views[viewName].classList.add('active');
    navItems[viewName].classList.add('active');

    if (viewName === 'stats') updateStats();
}

navItems.home.addEventListener('click', () => switchView('home'));
navItems.stats.addEventListener('click', () => switchView('stats'));

// Modal Handling
const modal = document.getElementById('modalOverlay');
const openBtn = document.getElementById('newPatientBtn');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('newPatientForm');

openBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPatient = {
        name: document.getElementById('pName').value,
        age: document.getElementById('pAge').value,
        triage: document.getElementById('pTriage').value,
        lastVisit: "Recién ingresado"
    };

    await db.patients.add(newPatient);
    renderPatients();
    
    form.reset();
    modal.style.display = 'none';
});

// Search
document.getElementById('searchInput').addEventListener('input', (e) => {
    renderPatients(e.target.value);
});

// Initialize App
async function init() {
    await migrateData();
    await renderPatients();
}

init();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registrado'))
            .catch(err => console.log('SW error', err));
    });
}
