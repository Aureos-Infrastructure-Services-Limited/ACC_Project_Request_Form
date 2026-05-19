// Reusable Multi-email Chips component
class ChipsInput {
    constructor(root, options = {}) {
        this.root = root;
        this.wrap = root.querySelector('.chips-wrap');
        this.input = root.querySelector('.chips-input input');
        this.error = root.querySelector('.error');
        this.hidden = root.querySelector('input[type="hidden"]');
        this.items = [];

        const defaults = {
            normalise: (t) => (t || '').trim().replace(/[;,]+$/, '').toLowerCase(),
            validate: (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t),
            delimiterKeys: ['Enter', 'Tab', ',', ';', ' '],
            pasteSplit: /[\s,;\n]+/,
            dedupe: true,
            maxLen: 0,
        };
        this.opts = Object.assign({}, defaults, options);
        this.bind();
    }

    setError(msg = '') { this.error.textContent = msg; }
    syncHidden() { this.hidden.value = this.items.join(','); }

    render() {
        [...this.wrap.querySelectorAll('.chip')].forEach(n => n.remove());
        this.items.forEach((val, idx) => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.setAttribute('role', 'listitem');
            chip.setAttribute('aria-label', val);
            chip.innerHTML = `<span>${val}</span><button type="button" aria-label="Remove ${val}" data-index="${idx}">×</button>`;
            this.wrap.insertBefore(chip, this.wrap.querySelector('.chips-input'));
        });
        this.syncHidden();
        // Notify the wizard (or anyone listening) that the field changed so
        // localStorage persistence picks up chip add/remove without us having
        // to wire a separate callback. `input` events don't fire from hidden
        // inputs on programmatic value changes, so we dispatch synthetically.
        this.root.dispatchEvent(new Event('input', { bubbles: true }));
    }

    addOne(raw, { silent = false } = {}) {
        let v = this.opts.normalise(raw);
        if (!v) return false;
        if (this.opts.maxLen && v.length > this.opts.maxLen) { if (!silent) this.setError(`Too long (>${this.opts.maxLen} chars): ${v}`); return false; }
        if (!this.opts.validate(v)) { if (!silent) this.setError(`Invalid value: ${v}`); return false; }
        if (this.opts.dedupe && this.items.includes(v)) { if (!silent) this.setError(`Duplicate ignored: ${v}`); return false; }
        this.items.push(v);
        this.setError('');
        this.render();
        return true;
    }

    addMany(text) {
        const parts = String(text).split(this.opts.pasteSplit).map(t => this.opts.normalise(t)).filter(Boolean);
        let added = 0; parts.forEach(p => { if (this.addOne(p, { silent: true })) added++; });
        if (added === 0 && parts.length) this.setError('No valid new items found.');
        this.render();
    }

    bind() {
        this.input.addEventListener('keydown', (e) => {
            if (this.input.readOnly) return;
            if (this.opts.delimiterKeys.includes(e.key)) {
                e.preventDefault();
                if (this.addOne(this.input.value)) this.input.value = '';
            } else if (e.key === 'Backspace' && !this.input.value) {
                this.items.pop(); this.render();
            }
        });
        this.input.addEventListener('paste', (e) => {
            if (this.input.readOnly) return;
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            this.addMany(text); this.input.value = '';
        });
        this.wrap.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-index]');
            if (!btn) return;
            const idx = +btn.getAttribute('data-index');
            this.items.splice(idx, 1); this.render();
        });
    }

    reset() { this.items = []; this.render(); this.setError(''); this.input.value = ''; }
    get value() { return [...this.items]; }
}

document.addEventListener("DOMContentLoaded", async function () {
    // Wait for the APS login + userinfo round-trip to finish so we can
    // auto-fill the requestor email and use the 2-legged token for the
    // companies/roles lookups.
    await loginReady;

    showLoadingSpinner();
    await runGetRoles();
    await runGetCompanies();
    createEmailRow();
    hideLoadingSpinner();

    // Default dates: today → today + 1 year.
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    const formatDate = date => date.toISOString().split('T')[0];
    document.getElementById('startDate').value = formatDate(today);
    document.getElementById('endDate').value = formatDate(nextYear);

    document.getElementById('addRowBtn').addEventListener('click', () => createEmailRow());
    document.getElementById("uploadBtn").addEventListener("click", () => {
        document.getElementById("csvUpload").click();
    });

    document.getElementById("csvUpload").addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const emails = extractEmailsFromCSV(text);
            emails.forEach((user) =>
                createEmailRow(
                    (user.email || '').trim(),
                    (user.role || '').trim(),
                    (user.company || '').trim()
                )
            );
        };
        reader.readAsText(file);
    });

    // Build chip components for every .chips-field on the page.
    const fields = Array.from(document.querySelectorAll('.chips-field'));
    const instances = [];
    fields.forEach(field => {
        const type = field.getAttribute('data-type');
        if (type === 'email') {
            instances.push(new ChipsInput(field, {
                delimiterKeys: ['Enter', 'Tab', ',', ';', ' '],
                pasteSplit: /[\s,;\n]+/,
            }));
        } else if (type === 'tags') {
            instances.push(new ChipsInput(field, {
                normalise: (t) => (t || '').trim().replace(/\s+/g, ' '),
                validate: (t) => /^(?=.{2,40}$)[A-Za-z0-9][A-Za-z0-9 &()\-/]*[A-Za-z0-9)]$/.test(t),
                delimiterKeys: ['Enter', 'Tab', ',', ';'],
                pasteSplit: /[,;\n]+/,
                dedupe: true,
                maxLen: 40,
            }));
        }
    });

    // Pre-fill and lock the requestor email chip to the logged-in user.
    const requestorField = instances.find(i => i.hidden.getAttribute('name') === 'requestorEmail');
    if (requestorField && userDetails && userDetails.email) {
        requestorField.addOne(userDetails.email, { silent: true });
        requestorField.input.placeholder = userDetails.email;
    }

    // Hand chip instances to the wizard so it can read them for validation,
    // persistence, and review rendering.
    wizardInit({ chipsInstances: instances, form: document.getElementById('intakeForm') });

    const form = document.getElementById('intakeForm');
    const out = document.getElementById('output');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Submission only happens from step 5. Pressing Enter elsewhere in
        // the form does nothing destructive.
        if (wizardCurrentStep() !== 5) return;
        if (!(form.reportValidity ? form.reportValidity() : true)) return;

        const data = Object.fromEntries(new FormData(form).entries());

        const enrich = {};
        instances.forEach(inst => {
            const name = inst.hidden.getAttribute('name');
            enrich[name] = inst.value;
        });

        const emailGallery = document.getElementById('emailGallery');
        const memberList = [];
        emailGallery.querySelectorAll('.row').forEach(row => {
            const email = row.querySelector('input[type="email"]').value;
            const company = row.querySelector('.company-tag').value;
            const role = row.querySelector('.role-tag').value;
            if (email) memberList.push({ email, role, company });
        });

        if (!enrich.requestorEmail || enrich.requestorEmail.length === 0) {
            alert("We couldn't read your email from your Autodesk profile. Please sign out and back in.");
            return;
        }

        const payload = { ...data, ...enrich, memberList };
        out.textContent = JSON.stringify(payload, null, 2);

        showLoadingSpinner();
        try {
            await postProjectRequest(payload);
            hideLoadingSpinner();
            wizardClearState();
            showSuccessScreen(data.projectName);
        } catch (err) {
            hideLoadingSpinner();
            console.error("Submission failed:", err);
            alert("Submission failed. Please try again, or contact the Digital Delivery team if the problem persists.");
        }
    });

    function resetFormState() {
        // Native fields first (clears text, selects, dates). Hidden inputs also
        // get reset to their default empty value — we put the chip values back
        // after by calling syncHidden() on each instance.
        form.reset();
        instances.forEach(inst => {
            if (inst.hidden.getAttribute('name') === 'requestorEmail') {
                inst.syncHidden(); // requestor chip stays — restore its hidden value
                return;
            }
            inst.reset();
        });
        document.querySelectorAll('#emailGallery .row').forEach(r => r.remove());
        createEmailRow();
        document.getElementById('startDate').value = formatDate(today);
        document.getElementById('endDate').value = formatDate(nextYear);
        document.getElementById('output').textContent = '';
        wizardClearState();
    }

    document.getElementById('resetBtn').addEventListener('click', () => {
        resetFormState();
        wizardGoToStep(1);
    });

    document.getElementById('submitAnotherBtn').addEventListener('click', () => {
        resetFormState();
        hideSuccessScreen();
        wizardGoToStep(1);
    });
});

async function postProjectRequest(data) {
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };

    const apiUrl = `https://default917b4d06d2e9475983a3e7369ed74e.8f.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/376e77ea16384ae7a5dd080386bbbdff/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RBaP6nd3bxYpJ9TL1XC7LNIwVj_bDmJg05ixDQyTQQg`;

    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
        throw new Error(`Submission HTTP ${response.status}`);
    }
    return response.json();
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createPlaceholderSelect(text) {
    const option = document.createElement('option');
    option.textContent = text;
    option.disabled = true;
    option.selected = true;
    return option;
}

function createEmailRow(email, role = '', company = '') {
    const row = document.createElement('div');
    row.className = 'row';
    if (!email) email = '';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'user@example.com';
    emailInput.value = email;

    const companySelect = document.createElement('select');
    companySelect.className = 'company-tag';
    companySelect.appendChild(createPlaceholderSelect('Select a Company...'));
    companiesList.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.value;
        if (opt.value === company) option.selected = true;
        companySelect.appendChild(option);
    });

    const roleSelect = document.createElement('select');
    roleSelect.className = 'role-tag';
    roleSelect.appendChild(createPlaceholderSelect('Select a Role...'));
    rolesData.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.role;
        option.textContent = opt.role;
        if (opt.role === role) option.selected = true;
        roleSelect.appendChild(option);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => emailGallery.removeChild(row);

    row.appendChild(emailInput);
    row.appendChild(companySelect);
    row.appendChild(roleSelect);
    row.appendChild(removeBtn);
    document.getElementById('emailGallery').appendChild(row);
}

async function runGetCompanies() {
    let companiesListRaw = await getCompnaies(accessToken);
    if (!Array.isArray(companiesListRaw)) {
        console.warn("Companies fetch did not return an array:", companiesListRaw);
        return;
    }
    companiesListRaw = companiesListRaw.sort((a, b) => a.name.localeCompare(b.name));
    companiesListRaw.forEach(element => {
        companiesList.push({ 'value': element.name, 'id': element.id });
        companiesListExcel.push(element.name);
    });
}

async function runGetRoles() {
    // Defensive: accessToken should already be set by login.js's
    // getUserDetailsFill, but fetch it now if not (e.g., dev/test paths).
    if (!accessToken) accessToken = await getAccessToken("account:read data:read");
    rolesData = await getProjectRoles();
    if (Array.isArray(rolesData)) {
        rolesData.sort((a, b) => a.role.localeCompare(b.role));
        rolesData.forEach(element => rolesDataExcel.push(element.name));
    } else {
        console.warn("Roles fetch did not return an array:", rolesData);
        rolesData = [];
    }
    accRoles = await getACCRoles();
}

function extractEmailsFromCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const emails = [];
    lines.forEach((line) => {
        const parts = line.split(",");
        if (parts[0] !== "") {
            emails.push({ email: parts[0], role: parts[1], company: parts[2] });
        }
    });
    return emails;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}
