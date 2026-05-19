const appName = "Aureos ACC Project Creation Form";
const appVersion = "v0.4.0 ALPHA";

const account_id = "24d2d632-e01b-4ca0-b988-385be827cb04"
const default_project_id = "bc44c453-d23a-46ce-8b83-6bea9e90c4b9"

// PKCE public client ID for the Autodesk APS app. Safe to ship in the
// browser — PKCE replaces the client secret entirely with a per-flow
// verifier/challenge pair, so there is no shared secret to protect.
const apsClientId = "rIZ4T6uq2qbVGsBucgGz8zwSPPrENzupOQGkO9ii01U4nNT0"

let toolURL
let accessToken
let userDetails
let userAccessToken
let userRefreshToken

let rolesData = []
let rolesDataExcel = []
let accRoles = []
let companiesList = []
let companiesListExcel = []

// Test-mode allowlist. Only emails in this list can see / use the test
// toggle that bypasses the real Power Automate submission.
const TEST_MODE_ALLOWLIST = [
    "josh.cole@aureos.com",
    "josh1997.cole@hotmail.co.uk",
];

function isTestModeAvailable() {
    if (!userDetails || !userDetails.email) return false;
    return TEST_MODE_ALLOWLIST.includes(userDetails.email.toLowerCase());
}

function getTestMode() {
    // Bypass requires both the allowlist match AND the localStorage flag,
    // so someone who manually sets the flag without being allowlisted can't
    // accidentally (or intentionally) skip the real submission.
    if (!isTestModeAvailable()) return false;
    return localStorage.getItem("acc_test_mode") === "1";
}

function setTestMode(on) {
    if (!isTestModeAvailable()) return;
    localStorage.setItem("acc_test_mode", on ? "1" : "0");
}

function syncTestModeUi() {
    const menuItem = document.getElementById('testModeMenuItem');
    const toggle = document.getElementById('testModeToggle');
    const badge = document.getElementById('testModeBadge');
    if (!menuItem || !toggle || !badge) return;
    if (isTestModeAvailable()) {
        menuItem.classList.remove('hidden');
        toggle.checked = getTestMode();
        badge.classList.toggle('hidden', !getTestMode());
    } else {
        menuItem.classList.add('hidden');
        badge.classList.add('hidden');
    }
}

// Resolves once login has completed AND user details are populated.
// Downstream code (chip setup, role/company fetches, wizard restore)
// awaits this before doing anything that depends on the logged-in user.
let resolveLoginReady;
const loginReady = new Promise(resolve => { resolveLoginReady = resolve; });

document.addEventListener('DOMContentLoaded', async function () {
    const appInfo = document.getElementById("appInfo");
    if (appInfo) appInfo.textContent = `${appName} ${appVersion}`;

    // Strip query string so the redirect URI registered with APS matches
    // exactly (Autodesk does a literal match including query).
    toolURL = window.location.href.split('?')[0];

    showLoadingSpinner();
    try {
        await checkLogin();
    } finally {
        resolveLoginReady();
    }
});
