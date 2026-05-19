async function getUserDetailsFill() {
    await getUserDetails();
    // Fetch the 2-legged Autodesk token (via Power Automate) that the
    // companies/roles endpoints need. Separate from userAccessToken,
    // which is the 3-legged user token used for /userinfo.
    accessToken = await getAccessToken("account:read data:read");
    sessionStorage.setItem('userID', userDetails.sub);
    setUserInfo(userDetails);

    const profileMenu = document.getElementById('profileMenu');
    const dropdown = document.getElementById('dropdown');

    profileMenu.addEventListener('click', () => {
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!profileMenu.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function logout() {
    localStorage.setItem("user_refresh_token", "blank");
    sessionStorage.clear();
    clearUrlParameters();
    signin();
}

function setUserInfo(data) {
    const profilePic = document.getElementById("userPic");
    const profileName = document.getElementById("userName");
    const profileEmail = document.getElementById("userEmail");
    if (data.picture) profilePic.src = data.picture;
    profileName.textContent = data.name;
    profileEmail.textContent = data.email;
}

async function getUserDetails() {
    const headers = {
        "Content-Type": "application/json",
        Authorization: "Bearer " + userAccessToken,
    };
    const requestOptions = { method: "GET", headers };
    const apiUrl = "https://api.userprofile.autodesk.com/userinfo";
    const response = await fetch(apiUrl, requestOptions)
        .then(r => r.json())
        .then(data => { userDetails = data; return data; })
        .catch(error => console.error("Error fetching userinfo:", error));
    return response;
}

// PKCE helpers (RFC 7636). The verifier is a high-entropy random string
// kept in sessionStorage across the OAuth redirect; the challenge is its
// SHA-256 hash sent to /authorize. At /token the same verifier is
// submitted, proving the same browser session is redeeming the code —
// no shared client secret needed.
function _pkceBase64Url(bytes) {
    let str = "";
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generateCodeVerifier() {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return _pkceBase64Url(bytes);
}
async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return _pkceBase64Url(new Uint8Array(hash));
}

async function signin() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // Random per-flow state. Autodesk echoes it back on redirect; we verify
    // it matches what we sent before redeeming the code, which prevents an
    // attacker from tricking a logged-in user into redeeming an attacker-
    // controlled `?code=` (CSRF).
    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = _pkceBase64Url(stateBytes);

    sessionStorage.setItem("pkce_verifier", verifier);
    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
        response_type: "code",
        client_id: apsClientId,
        redirect_uri: toolURL,
        scope: "data:read data:write data:create",
        prompt: "login",
        state: state,
        code_challenge: challenge,
        code_challenge_method: "S256",
    });
    window.open(
        "https://developer.api.autodesk.com/authentication/v2/authorize?" + params.toString(),
        "_self"
    );
}

async function checkLogin() {
    const codeParam = getParameterByName("code");
    const stateParam = getParameterByName("state");
    const localRefreshToken = localStorage.getItem("user_refresh_token");

    if (codeParam !== null) {
        // Returning from /authorize with a one-time code — always prefer
        // redeeming this over attempting a refresh.
        const expectedState = sessionStorage.getItem("oauth_state");
        if (!expectedState || stateParam !== expectedState) {
            // State mismatch = CSRF attempt or browser state lost between
            // authorize and redirect. Refuse to redeem and restart cleanly.
            console.warn("OAuth state mismatch — refusing to redeem code and restarting login.");
            sessionStorage.removeItem("oauth_state");
            sessionStorage.removeItem("pkce_verifier");
            clearUrlParameters();
            await signin();
            return;
        }
        sessionStorage.removeItem("oauth_state");
        await getAuthorisation(codeParam);
    } else if (localRefreshToken && localRefreshToken !== "blank") {
        await refreshToken();
    } else {
        await signin();
    }
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function clearUrlParameters() {
    const cleanUrl =
        window.location.protocol + "//" +
        window.location.host +
        window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
}

async function getAuthorisation(code) {
    const verifier = sessionStorage.getItem("pkce_verifier");
    if (!verifier) {
        console.error("PKCE verifier missing — restarting login.");
        await signin();
        return;
    }

    const bodyData = {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: toolURL,
        client_id: apsClientId,
        code_verifier: verifier,
    };

    const formBody = Object.keys(bodyData)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(bodyData[k])}`)
        .join("&");

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
    };

    const apiUrl = "https://developer.api.autodesk.com/authentication/v2/token";
    return await fetch(apiUrl, requestOptions)
        .then(async (response) => {
            if (!response.ok) {
                console.warn("Auth code exchange failed with HTTP " + response.status);
                sessionStorage.removeItem("pkce_verifier");
                localStorage.setItem("user_refresh_token", "blank");
                clearUrlParameters();
                location.reload();
                throw new Error("Auth code exchange failed; reloading.");
            }
            return response.json();
        })
        .then(async (data) => {
            userRefreshToken = data.refresh_token;
            localStorage.setItem("user_refresh_token", userRefreshToken);
            userAccessToken = data.access_token;
            sessionStorage.removeItem("pkce_verifier");
            clearUrlParameters();
            await getUserDetailsFill();
            return data;
        })
        .catch(error => console.error("Error fetching token:", error));
}

async function refreshToken() {
    const localRefreshToken = localStorage.getItem("user_refresh_token");

    const bodyData = {
        grant_type: "refresh_token",
        refresh_token: localRefreshToken,
        client_id: apsClientId,
        redirect_uri: toolURL,
    };
    const formBody = Object.keys(bodyData)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(bodyData[k])}`)
        .join("&");

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
    };

    const apiUrl = "https://developer.api.autodesk.com/authentication/v2/token";
    return await fetch(apiUrl, requestOptions)
        .then(async (response) => {
            if (!response.ok) {
                console.warn("Token refresh failed with HTTP " + response.status + " — forcing fresh login.");
                localStorage.setItem("user_refresh_token", "blank");
                clearUrlParameters();
                location.reload();
                throw new Error("Token refresh failed; reloading.");
            }
            return response.json();
        })
        .then(async (data) => {
            localStorage.setItem("user_refresh_token", data.refresh_token);
            userRefreshToken = data.refresh_token;
            userAccessToken = data.access_token;
            await getUserDetailsFill();
            return data;
        })
        .catch(error => console.error("Error refreshing token:", error));
}
