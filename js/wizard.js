// Wizard state machine + localStorage persistence for the multi-step form.
// Initialised from main.js once the chip components are ready.

const WIZARD_TOTAL_STEPS = 5;
const WIZARD_STORAGE_PREFIX = "acc_request_form_draft_v1";

let wizardState = {
    currentStep: 1,
};
let wizardChipsByName = {}; // { projectManagers: ChipsInput, ... }
let wizardForm;
let wizardStorageKey;

function wizardCurrentStep() {
    return wizardState.currentStep;
}

function wizardStorageKeyFor(userSub) {
    return userSub ? `${WIZARD_STORAGE_PREFIX}_${userSub}` : WIZARD_STORAGE_PREFIX;
}

function wizardInit({ chipsInstances, form }) {
    wizardForm = form;
    chipsInstances.forEach(inst => {
        const name = inst.hidden.getAttribute("name");
        wizardChipsByName[name] = inst;
    });
    wizardStorageKey = wizardStorageKeyFor(userDetails && userDetails.sub);

    document.getElementById("backBtn").addEventListener("click", () => wizardGoToStep(wizardState.currentStep - 1));
    document.getElementById("nextBtn").addEventListener("click", () => {
        if (validateStep(wizardState.currentStep)) {
            wizardGoToStep(wizardState.currentStep + 1);
        }
    });

    // Show/hide the Framework regions section in response to type change,
    // and re-save so a refresh restores the same visibility.
    const typeSel = document.getElementById("type");
    if (typeSel) {
        typeSel.addEventListener("change", () => {
            updateFrameworkVisibility();
            wizardSaveState();
        });
    }

    // Live save on any form input change (covers text/select/date and
    // chip-input typing). The ChipsInput.render() dispatches a synthetic
    // input event so chip add/remove also lands here.
    wizardForm.addEventListener("input", () => wizardSaveStateDebounced());

    wizardRestoreState();
    updateFrameworkVisibility();
    renderStepper();
    showCurrentStep();
}

function updateFrameworkVisibility() {
    const typeVal = document.getElementById("type") ? document.getElementById("type").value : "";
    const regionsSection = document.getElementById("framework_regions_section");
    if (!regionsSection) return;
    if (typeVal === "Framework") {
        regionsSection.classList.remove("hidden");
    } else {
        regionsSection.classList.add("hidden");
    }
}

function validateStep(step) {
    clearStepErrors(step);

    if (step === 1) {
        // Requestor email is auto-filled from login — should always be valid.
        const requestor = wizardChipsByName.requestorEmail;
        if (!requestor || requestor.value.length === 0) {
            setStepError(1, "Could not detect your email from your Autodesk profile. Please sign out and back in.");
            return false;
        }
        return true;
    }

    if (step === 2) {
        const required = ["projectName", "unit", "stage", "type"];
        for (const name of required) {
            const el = wizardForm.querySelector(`[name="${name}"]`);
            if (!el || !el.value) {
                if (el) el.focus();
                setStepError(2, "Please complete all required fields before continuing.");
                return false;
            }
        }
        return true;
    }

    if (step === 3) {
        const required = ["projectManagers", "documentControllers", "accessApprovers"];
        const missing = required.filter(name => {
            const inst = wizardChipsByName[name];
            return !inst || inst.value.length === 0;
        });
        if (missing.length) {
            setStepError(3, "Each role list must have at least one email address.");
            return false;
        }
        return true;
    }

    // Steps 4 and 5 have no blocking validation.
    return true;
}

function clearStepErrors(step) {
    const panel = document.querySelector(`.step-panel[data-step="${step}"]`);
    if (!panel) return;
    const errBox = panel.querySelector(".step-error");
    if (errBox) errBox.textContent = "";
}

function setStepError(step, message) {
    const panel = document.querySelector(`.step-panel[data-step="${step}"]`);
    if (!panel) return;
    const errBox = panel.querySelector(".step-error");
    if (errBox) errBox.textContent = message;
}

function wizardGoToStep(step) {
    if (step < 1 || step > WIZARD_TOTAL_STEPS) return;
    wizardState.currentStep = step;
    showCurrentStep();
    renderStepper();
    wizardSaveState();
    if (step === 5) renderReviewSummary();
    // Scroll the panel into view so long forms don't leave the user at the bottom.
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showCurrentStep() {
    document.querySelectorAll(".step-panel").forEach(panel => {
        const step = Number(panel.getAttribute("data-step"));
        panel.classList.toggle("active", step === wizardState.currentStep);
    });

    document.getElementById("backBtn").classList.toggle("hidden", wizardState.currentStep === 1);
    document.getElementById("nextBtn").classList.toggle("hidden", wizardState.currentStep === WIZARD_TOTAL_STEPS);
    document.getElementById("submitBtn").classList.toggle("hidden", wizardState.currentStep !== WIZARD_TOTAL_STEPS);
}

function renderStepper() {
    document.querySelectorAll(".step-indicator").forEach(node => {
        const step = Number(node.getAttribute("data-step"));
        node.classList.toggle("active", step === wizardState.currentStep);
        node.classList.toggle("completed", step < wizardState.currentStep);
    });
}

function readFormValues() {
    const data = {};
    const plainFields = ["projectName", "projectId", "client", "clientNo", "location", "unit", "stage", "startDate", "endDate", "type"];
    plainFields.forEach(name => {
        const el = wizardForm.querySelector(`[name="${name}"]`);
        if (el) data[name] = el.value;
    });
    return data;
}

function readChipValues() {
    const result = {};
    Object.keys(wizardChipsByName).forEach(name => {
        result[name] = wizardChipsByName[name].value;
    });
    return result;
}

function readTeamRows() {
    const rows = document.querySelectorAll("#emailGallery .row");
    const list = [];
    rows.forEach(row => {
        const email = row.querySelector('input[type="email"]').value;
        const company = row.querySelector(".company-tag").value;
        const role = row.querySelector(".role-tag").value;
        if (email || company || role) list.push({ email, role, company });
    });
    return list;
}

let _saveTimer;
function wizardSaveStateDebounced() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(wizardSaveState, 250);
}

function wizardSaveState() {
    if (!wizardStorageKey) return;
    try {
        const payload = {
            v: 1,
            currentStep: wizardState.currentStep,
            form: readFormValues(),
            chips: readChipValues(),
            team: readTeamRows(),
        };
        localStorage.setItem(wizardStorageKey, JSON.stringify(payload));
    } catch (err) {
        console.warn("Could not save wizard state:", err);
    }
}

function wizardRestoreState() {
    if (!wizardStorageKey) return;
    let saved;
    try {
        const raw = localStorage.getItem(wizardStorageKey);
        if (!raw) return;
        saved = JSON.parse(raw);
    } catch (err) {
        console.warn("Could not parse saved wizard state:", err);
        return;
    }
    if (!saved || saved.v !== 1) return;

    // Plain form fields
    if (saved.form) {
        Object.entries(saved.form).forEach(([name, value]) => {
            const el = wizardForm.querySelector(`[name="${name}"]`);
            if (el && value !== undefined && value !== null) el.value = value;
        });
    }

    // Chip fields (skip requestorEmail — that's owned by login.js)
    if (saved.chips) {
        Object.entries(saved.chips).forEach(([name, values]) => {
            if (name === "requestorEmail") return;
            const inst = wizardChipsByName[name];
            if (!inst || !Array.isArray(values)) return;
            values.forEach(v => inst.addOne(v, { silent: true }));
        });
    }

    // Team rows — clear the default-empty row first if it exists, then rebuild.
    if (Array.isArray(saved.team) && saved.team.length) {
        document.querySelectorAll("#emailGallery .row").forEach(r => r.remove());
        saved.team.forEach(t => createEmailRow(t.email, t.role, t.company));
    }

    if (saved.currentStep && saved.currentStep >= 1 && saved.currentStep <= WIZARD_TOTAL_STEPS) {
        wizardState.currentStep = saved.currentStep;
    }
}

function wizardClearState() {
    if (!wizardStorageKey) return;
    try { localStorage.removeItem(wizardStorageKey); } catch (_) { /* ignore */ }
}

function renderReviewSummary() {
    const target = document.getElementById("reviewSummary");
    if (!target) return;
    const form = readFormValues();
    const chips = readChipValues();
    const team = readTeamRows();

    const dash = (v) => (v && String(v).trim()) ? v : "—";
    const list = (arr) => (arr && arr.length) ? arr.join(", ") : "—";

    const teamHtml = team.length
        ? `<table class="review-team">
             <thead><tr><th>Email</th><th>Role</th><th>Company</th></tr></thead>
             <tbody>${team.map(t => `<tr><td>${escapeHtml(t.email)}</td><td>${escapeHtml(t.role)}</td><td>${escapeHtml(t.company)}</td></tr>`).join("")}</tbody>
           </table>`
        : `<p class="review-empty">No initial team members added. You can add them in Forma after the project is created.</p>`;

    const regionsBlock = form.type === "Framework"
        ? `<div class="review-row"><dt>Regions / Groups</dt><dd>${list(chips.regions)}</dd></div>`
        : "";

    target.innerHTML = `
      <section class="review-section">
        <h3>Requestor</h3>
        <dl>
          <div class="review-row"><dt>Email</dt><dd>${escapeHtml(list(chips.requestorEmail))}</dd></div>
        </dl>
      </section>
      <section class="review-section">
        <h3>Project Details</h3>
        <dl>
          <div class="review-row"><dt>Project Name</dt><dd>${escapeHtml(dash(form.projectName))}</dd></div>
          <div class="review-row"><dt>Project Ref / ID</dt><dd>${escapeHtml(dash(form.projectId))}</dd></div>
          <div class="review-row"><dt>Client</dt><dd>${escapeHtml(dash(form.client))}</dd></div>
          <div class="review-row"><dt>Client Number</dt><dd>${escapeHtml(dash(form.clientNo))}</dd></div>
          <div class="review-row"><dt>Postcode</dt><dd>${escapeHtml(dash(form.location))}</dd></div>
          <div class="review-row"><dt>Unit</dt><dd>${escapeHtml(dash(form.unit))}</dd></div>
          <div class="review-row"><dt>Contract Stage</dt><dd>${escapeHtml(dash(form.stage))}</dd></div>
          <div class="review-row"><dt>Start Date</dt><dd>${escapeHtml(dash(form.startDate))}</dd></div>
          <div class="review-row"><dt>End Date</dt><dd>${escapeHtml(dash(form.endDate))}</dd></div>
          <div class="review-row"><dt>Project Type</dt><dd>${escapeHtml(dash(form.type))}</dd></div>
          ${regionsBlock}
        </dl>
      </section>
      <section class="review-section">
        <h3>Key Roles</h3>
        <dl>
          <div class="review-row"><dt>Project Managers</dt><dd>${escapeHtml(list(chips.projectManagers))}</dd></div>
          <div class="review-row"><dt>Document Controllers</dt><dd>${escapeHtml(list(chips.documentControllers))}</dd></div>
          <div class="review-row"><dt>Access Approvers</dt><dd>${escapeHtml(list(chips.accessApprovers))}</dd></div>
        </dl>
      </section>
      <section class="review-section">
        <h3>Initial Team (${team.length})</h3>
        ${teamHtml}
      </section>
    `;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showSuccessScreen(projectName, options = {}) {
    const { testMode = false } = options;
    const successEl = document.getElementById("successScreen");
    const projectNameEl = document.getElementById("successProjectName");
    const formEl = document.getElementById("intakeForm");
    const testBanner = document.getElementById("successTestBanner");
    if (projectNameEl) projectNameEl.textContent = projectName || "(unnamed)";
    if (testBanner) testBanner.classList.toggle("hidden", !testMode);
    if (formEl) formEl.classList.add("hidden");
    if (successEl) successEl.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideSuccessScreen() {
    const successEl = document.getElementById("successScreen");
    const formEl = document.getElementById("intakeForm");
    if (successEl) successEl.classList.add("hidden");
    if (formEl) formEl.classList.remove("hidden");
}
