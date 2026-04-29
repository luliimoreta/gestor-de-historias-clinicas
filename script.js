// Database Initialization
const db = new Dexie("VitalDocDB");
db.version(4).stores({
    patients: "++id, name, age, triage, lastVisit, signature",
    appointments: "++id, patient, date, time, reason",
    settings: "id"
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

// Appointment Rendering
async function renderAppointments() {
    const list = document.getElementById('appointmentsList');
    if (!list) return;
    list.innerHTML = "";

    const appointments = await db.appointments.toArray();
    const sorted = appointments.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
    });

    if (sorted.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); margin-top: 20px;">No hay turnos programados.</p>';
        return;
    }

    sorted.forEach(apt => {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.innerHTML = `
            <div class="patient-info">
                <div class="patient-name">${apt.patient}</div>
                <div class="patient-meta">
                    <i class="far fa-calendar-alt"></i> ${apt.date} • 
                    <i class="far fa-clock"></i> ${apt.time}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                    <strong>Motivo:</strong> ${apt.reason}
                </div>
            </div>
            <button class="export-pdf-btn" style="background: #fdf2f2; color: #e74c3c;" onclick="deleteAppointment(${apt.id})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(card);
    });
}

async function deleteAppointment(id) {
    if (confirm('¿Está seguro de que desea eliminar este turno?')) {
        await db.appointments.delete(id);
        renderAppointments();
    }
}

// Export to PDF
async function exportToPDF(patientId) {
    const { jsPDF } = window.jspdf;
    const p = await db.patients.get(patientId);
    const s = await db.settings.get(1) || { name: "Dr. VitalDoc", spec: "Medicina General", clinic: "Clínica Digital" };
    
    const doc = new jsPDF();
    
    // Header - Clinic Info
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80); // Navy Blue
    doc.text(s.clinic.toUpperCase(), 20, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(127, 140, 141);
    doc.text(`${s.name} - ${s.spec}`, 20, 38);
    doc.text(`Fecha de exportación: ${new Date().toLocaleDateString()}`, 20, 45);
    
    // Content
    doc.setDrawColor(52, 152, 219); // Medical Blue
    doc.line(20, 50, 190, 50);
    
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont(undefined, 'bold');
    doc.text("DATOS DEL PACIENTE", 20, 65);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text(`Nombre: ${p.name}`, 20, 80);
    doc.text(`Edad: ${p.age} años`, 20, 90);
    doc.text(`Estado de Triaje: ${p.triage.toUpperCase()}`, 20, 100);
    doc.text(`Última visita: ${p.lastVisit}`, 20, 110);
    
    // Signature
    if (p.signature) {
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 130, 80, 130);
        doc.setFontSize(10);
        doc.text("FIRMA DEL MÉDICO", 20, 135);
        doc.addImage(p.signature, 'PNG', 20, 140, 60, 30);
        
        doc.setFontSize(10);
        doc.text(s.name, 20, 175);
        doc.text(s.spec, 20, 180);
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
const views = { 
    home: document.getElementById('homeView'), 
    stats: document.getElementById('statsView'),
    agenda: document.getElementById('agendaView'),
    ajustes: document.getElementById('ajustesView')
};
const navItems = { 
    home: document.getElementById('navHome'), 
    stats: document.getElementById('navStats'),
    agenda: document.getElementById('navAgenda'),
    ajustes: document.getElementById('navAjustes')
};
function switchView(v) {
    Object.values(views).forEach(x => { if(x) x.classList.remove('active'); });
    Object.values(navItems).forEach(x => { if(x) x.classList.remove('active'); });
    if(views[v]) views[v].classList.add('active'); 
    if(navItems[v]) navItems[v].classList.add('active');
    if (v === 'stats') updateStats();
    if (v === 'agenda') renderAppointments();
}
if(navItems.home) navItems.home.addEventListener('click', () => switchView('home'));
if(navItems.stats) navItems.stats.addEventListener('click', () => switchView('stats'));
if(navItems.agenda) navItems.agenda.addEventListener('click', () => switchView('agenda'));
if(navItems.ajustes) navItems.ajustes.addEventListener('click', () => switchView('ajustes'));

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

// Appointment Modal Handling
const aptModal = document.getElementById('appointmentModal');
const openAptBtn = document.getElementById('newAppointmentBtn');
const closeAptBtn = document.getElementById('closeAppointmentModal');
const aptForm = document.getElementById('newAppointmentForm');

if (openAptBtn) openAptBtn.addEventListener('click', () => { aptModal.style.display = 'flex'; });
if (closeAptBtn) closeAptBtn.addEventListener('click', () => { aptModal.style.display = 'none'; });

if (aptForm) {
    aptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newApt = {
            patient: document.getElementById('aptPatient').value,
            date: document.getElementById('aptDate').value,
            time: document.getElementById('aptTime').value,
            reason: document.getElementById('aptReason').value
        };
        await db.appointments.add(newApt);
        renderAppointments();
        aptForm.reset();
        aptModal.style.display = 'none';
    });
}

// Doctor Settings Handling
async function loadSettings() {
    const s = await db.settings.get(1);
    if (s) {
        if (document.getElementById('docName')) document.getElementById('docName').value = s.name || "";
        if (document.getElementById('docSpec')) document.getElementById('docSpec').value = s.spec || "";
        if (document.getElementById('docClinic')) document.getElementById('docClinic').value = s.clinic || "";
    }
}

const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const settings = {
                id: 1,
                name: document.getElementById('docName').value,
                spec: document.getElementById('docSpec').value,
                clinic: document.getElementById('docClinic').value
            };
            await db.settings.put(settings);
            alert('Configuración guardada correctamente.');
        } catch (error) {
            console.error("Error saving settings:", error);
            alert('Error al guardar la configuración: ' + error.message);
        }
    });
}

// Search and Initialize
document.getElementById('searchInput').addEventListener('input', (e) => renderPatients(e.target.value));
async function init() { 
    try {
        await db.open();
        await renderPatients(); 
        await renderAppointments();
        await loadSettings();
    } catch (err) {
        console.error("Failed to open db:", err);
    }
}
init();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => console.log('SW registrado')).catch(err => console.log('SW error', err));
    });
}
