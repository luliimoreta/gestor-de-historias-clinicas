// Database Initialization
const db = new Dexie("VitalDocDB");
db.version(2).stores({
    patients: "++id, name, age, triage, lastVisit, signature"
});

// Signature Pad Initialization
let signaturePad;
const canvas = document.getElementById('signature-pad');
if (canvas) {
    signaturePad = new SignaturePad(canvas);
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
            <button class="export-pdf-btn" onclick="exportToPDF(${p.id})">
                <i class="fas fa-file-pdf"></i>
            </button>
        `;
        list.appendChild(card);
    });

    updateStats();
}

// Export to PDF
async function exportToPDF(patientId) {
    const { jsPDF } = window.jspdf;
    const p = await db.patients.get(patientId);
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Navy Blue
    doc.text("VitalDoc - Historia Clínica", 20, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(127, 140, 141);
    doc.text(`Fecha de exportación: ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Content
    doc.setDrawColor(52, 152, 219); // Medical Blue
    doc.line(20, 45, 190, 45);
    
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont(undefined, 'bold');
    doc.text("DATOS DEL PACIENTE", 20, 60);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text(`Nombre: ${p.name}`, 20, 75);
    doc.text(`Edad: ${p.age} años`, 20, 85);
    doc.text(`Estado de Triaje: ${p.triage.toUpperCase()}`, 20, 95);
    doc.text(`Última visita: ${p.lastVisit}`, 20, 105);
    
    // Signature
    if (p.signature) {
        doc.text("FIRMA DEL MÉDICO:", 20, 130);
        doc.addImage(p.signature, 'PNG', 20, 135, 60, 30);
    }
    
    doc.save(`VitalDoc_${p.name.replace(/ /g, '_')}.pdf`);
}

// Stats and other logic...
async function updateStats() {
    const patients = await db.patients.toArray();
    const counts = { emergency: 0, urgent: 0, standard: 0 };
    patients.forEach(p => counts[p.triage]++);
    const total = patients.length || 1;
    document.getElementById('totalToday').innerText = patients.length;
    const chart = document.getElementById('triageChart');
    if (chart) {
        chart.innerHTML = `
            <div class="bar-item emergency-bar" style="height: ${(counts.emergency/total)*100}%" data-label="Emergencia" data-value="${counts.emergency}"></div>
            <div class="bar-item urgent-bar" style="height: ${(counts.urgent/total)*100}%" data-label="Urgente" data-value="${counts.urgent}"></div>
            <div class="bar-item standard-bar" style="height: ${(counts.standard/total)*100}%" data-label="Estándar" data-value="${counts.standard}"></div>
        `;
    }
}

// View Switching
const views = { home: document.getElementById('homeView'), stats: document.getElementById('statsView') };
const navItems = { home: document.getElementById('navHome'), stats: document.getElementById('navStats') };
function switchView(v) {
    Object.values(views).forEach(x => x.classList.remove('active'));
    Object.values(navItems).forEach(x => x.classList.remove('active'));
    views[v].classList.add('active'); navItems[v].classList.add('active');
    if (v === 'stats') updateStats();
}
navItems.home.addEventListener('click', () => switchView('home'));
navItems.stats.addEventListener('click', () => switchView('stats'));

// Modal Handling
const modal = document.getElementById('modalOverlay');
const openBtn = document.getElementById('newPatientBtn');
const closeBtn = document.getElementById('closeModal');
const form = document.getElementById('newPatientForm');

openBtn.addEventListener('click', () => { modal.style.display = 'flex'; signaturePad.clear(); });
closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
document.getElementById('clearSignature').addEventListener('click', () => signaturePad.clear());

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPatient = {
        name: document.getElementById('pName').value,
        age: document.getElementById('pAge').value,
        triage: document.getElementById('pTriage').value,
        lastVisit: "Recién ingresado",
        signature: signaturePad.isEmpty() ? null : signaturePad.toDataURL()
    };
    await db.patients.add(newPatient);
    renderPatients();
    form.reset();
    modal.style.display = 'none';
});

// Search and Initialize
document.getElementById('searchInput').addEventListener('input', (e) => renderPatients(e.target.value));
async function init() { await renderPatients(); }
init();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => console.log('SW registrado')).catch(err => console.log('SW error', err));
    });
}
