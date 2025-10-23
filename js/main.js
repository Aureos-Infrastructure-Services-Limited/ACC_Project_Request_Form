document.addEventListener("DOMContentLoaded", async function () {
    document.getElementById("appInfo").textContent = `${appName} ${appVersion}`;
    showLoadingSpinner()
    await runGetRoles()
    await runGetCompanies()
    createEmailRow()
    hideLoadingSpinner()


    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);

    // Format to YYYY-MM-DD
    const formatDate = date => date.toISOString().split('T')[0];

    document.getElementById('startDate').value = formatDate(today);
    document.getElementById('endDate').value = formatDate(nextYear);


    const addRowBtn = document.getElementById('addRowBtn');
    addRowBtn.addEventListener('click', () => createEmailRow());
    document.getElementById("uploadBtn").addEventListener("click", () => {
      document.getElementById("csvUpload").click();
    });

    document
      .getElementById("csvUpload")
      .addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
          const text = e.target.result;
          const emails = extractEmailsFromCSV(text);

          console.log(emails);
          emails.forEach((user) =>
            createEmailRow(
              user.email.trim(),
              user.role.trim(),
              user.company.trim()
            )
          );
        };

        reader.readAsText(file);
      });

      
    document.getElementById("type").addEventListener("change", function() {
    const selectedValue = this.value;
const framework_regions_section_dropdown = document.getElementById("framework_regions_section")
    if (selectedValue === "Framework") {
        // Do something when "Framework" is selected
        framework_regions_section_dropdown.style.display = "block"
    }else{
      framework_regions_section_dropdown.style.display = "none"
    }
    });

// Reusable Multi-email Chips component
  class ChipsInput {
    constructor(root, options={}){
      this.root = root;
      this.wrap = root.querySelector('.chips-wrap');
      this.input = root.querySelector('.chips-input input');
      this.error = root.querySelector('.error');
      this.hidden = root.querySelector('input[type="hidden"]');
      this.items = [];

      // defaults suitable for emails
      const defaults = {
        normalise: (t)=> (t||'').trim().replace(/[;,]+$/, '').toLowerCase(),
        validate: (t)=> /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t),
        // keys that trigger add on keydown
        delimiterKeys: ['Enter','Tab',',',';',' '],
        // regex used when pasting to split multiple tokens
        pasteSplit: /[\s,;\n]+/,
        // whether duplicates are checked case-insensitively on the normalised value
        dedupe: true,
        // optional max length per token (0 = unlimited)
        maxLen: 0,
      };
      this.opts = Object.assign({}, defaults, options);
      this.bind();
    }

    setError(msg=''){ this.error.textContent = msg; }
    syncHidden(){ this.hidden.value = this.items.join(','); }

    render(){
      [...this.wrap.querySelectorAll('.chip')].forEach(n=>n.remove());
      this.items.forEach((val, idx)=>{
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.setAttribute('role','listitem');
        chip.setAttribute('aria-label', val);
        chip.innerHTML = `<span>${val}</span><button type="button" aria-label="Remove ${val}" data-index="${idx}">×</button>`;
        this.wrap.insertBefore(chip, this.wrap.querySelector('.chips-input'));
      });
      this.syncHidden();
    }

    addOne(raw, {silent=false}={}){
      let v = this.opts.normalise(raw);
      if(!v) return false;
      if(this.opts.maxLen && v.length > this.opts.maxLen){ if(!silent) this.setError(`Too long (>${this.opts.maxLen} chars): ${v}`); return false; }
      if(!this.opts.validate(v)){ if(!silent) this.setError(`Invalid value: ${v}`); return false; }
      if(this.opts.dedupe && this.items.includes(v)){ if(!silent) this.setError(`Duplicate ignored: ${v}`); return false; }
      this.items.push(v);
      this.setError('');
      this.render();
      return true;
    }

    addMany(text){
      const parts = String(text).split(this.opts.pasteSplit).map(t=>this.opts.normalise(t)).filter(Boolean);
      let added=0; parts.forEach(p=>{ if(this.addOne(p,{silent:true})) added++; });
      if(added===0 && parts.length) this.setError('No valid new items found.');
      this.render();
    }

    bind(){
      this.input.addEventListener('keydown', (e)=>{
        if(this.opts.delimiterKeys.includes(e.key)){
          e.preventDefault();
          if(this.addOne(this.input.value)) this.input.value='';
        } else if(e.key==='Backspace' && !this.input.value){
          this.items.pop(); this.render();
        }
      });
      this.input.addEventListener('paste', (e)=>{
        e.preventDefault();
        const text = (e.clipboardData||window.clipboardData).getData('text');
        this.addMany(text); this.input.value='';
      });
      this.wrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('button[data-index]');
        if(!btn) return; const idx = +btn.getAttribute('data-index');
        this.items.splice(idx,1); this.render();
      });
    }

    reset(){ this.items=[]; this.render(); this.setError(''); this.input.value=''; }
    get value(){ return [...this.items]; }
  }

  (function(){
    // Build components for each .chips-field based on data-type
    const fields = Array.from(document.querySelectorAll('.chips-field'));
    const instances = [];

    fields.forEach(field=>{
      const type = field.getAttribute('data-type');

      if(type === 'email'){
        instances.push(new ChipsInput(field, {
          // keep defaults (email validator), including space as delimiter
          delimiterKeys: ['Enter','Tab',',',';',' '],
          pasteSplit: /[\s,;\n]+/,
        }));
      } else if(type === 'tags'){
        // Tags: allow spaces within tokens. Use Enter/comma/semicolon only (not space) as delimiter.
        instances.push(new ChipsInput(field, {
          normalise: (t)=> (t||'').trim().replace(/\s+/g,' '),
          validate: (t)=> /^(?=.{2,40}$)[A-Za-z0-9][A-Za-z0-9 &()\-/]*[A-Za-z0-9)]$/.test(t),
          delimiterKeys: ['Enter','Tab',',',';'],
          pasteSplit: /[,;\n]+/,
          dedupe: true,
          maxLen: 40,
        }));
      }
    });

    // Form submission demo
    const form = document.getElementById('intakeForm');
    const out  = document.getElementById('output');
    form.addEventListener('submit',(e)=>{
        e.preventDefault();
        // run native validations
        if(!(form.reportValidity ? form.reportValidity() : true)) return;

        const data = Object.fromEntries(new FormData(form).entries());
        // Replace comma-strings with arrays for readability

        const enrich = {};
      instances.forEach(inst=>{
        const name = inst.hidden.getAttribute('name');
        enrich[name] = inst.value;
      });
        const emailGallery = document.getElementById('emailGallery');
        const rows = emailGallery.querySelectorAll('.row');
        let memberList = []
        rows.forEach(row => {
            console.log(row)
            const email = row.querySelector('input[type="email"]').value;
            const company = row.querySelector('.company-tag').value;
            const role = row.querySelector('.role-tag').value;
            if (email) {
            const item = { email, role, company }
            console.log(item)
            memberList.push(item);
            }
        });

        if(enrich.requestorEmail.length == 0){
          alert("Please enter an email into the Requestor Email field, you may need to click on it an press enter to make it valid")
          return
        }
        const list = {'memberList':memberList}
        console.log('data',data, "enrich",enrich,"list",list)
        out.textContent = JSON.stringify({...data, ...enrich,...list}, null, 2);
        
        // TODO: Wire up to backend
        // fetch('/api/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...data, ...enrich}) });
        postProjectRequest({...data, ...enrich,...list})
        alert("Your creation request has been successfully submitted")
    });

    // Reset all chip components too
    document.getElementById('resetBtn').addEventListener('click',()=>{
      components.forEach(c=>c.reset());
      document.getElementById('output').textContent='';
    });
  })();
});

async function postProjectRequest(data) {
    const bodyData = data;
 
    const headers = {
      'Content-Type':'application/json'
    };
  
    const requestOptions = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyData)
    };
  
    const apiUrl = `https://default917b4d06d2e9475983a3e7369ed74e.8f.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/376e77ea16384ae7a5dd080386bbbdff/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=RBaP6nd3bxYpJ9TL1XC7LNIwVj_bDmJg05ixDQyTQQg`;
    //console.log(apiUrl)
    //console.log(requestOptions)
    responseData = await fetch(apiUrl,requestOptions)
        .then(response => response.json())
        .then(data => {
            const JSONdata = data
  
        console.log(JSONdata)
  
        return JSONdata
        })
        .catch(error => console.error('Error fetching data:', error));
  
  
    return responseData
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createPlaceholderSelect(text) {
    const option = document.createElement('option');
    option.textContent = text;
    option.disabled = true
    option.selected = true
    return option
}

function createEmailRow(email, role='',company) {
  const row = document.createElement('div');
  row.className = 'row';
  if(!email){
    email = ''
  }
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = 'user@example.com';
  emailInput.value = email;

  const companySelect = document.createElement('select');
  companySelect.className = 'company-tag';
  const defaultOptionCompany = createPlaceholderSelect('Select a Company...')
  companySelect.appendChild(defaultOptionCompany)
  companiesList.forEach(opt => {
    const option = document.createElement('option');
    
    option.value = opt.value;
    option.textContent = opt.value;
    if (opt.value === company) option.selected = true;
    companySelect.appendChild(option);
  });

  const roleSelect = document.createElement('select');
  roleSelect.className = 'role-tag';
    const defaultOptionRoles = createPlaceholderSelect('Select a Role...')
  roleSelect.appendChild(defaultOptionRoles)
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
  emailGallery.appendChild(row);
}

async function runGetCompanies() {
  let companiesListRaw = await getCompnaies(accessToken)
  companiesListRaw = companiesListRaw.sort((a, b) => a.name.localeCompare(b.name))
  companiesListRaw.forEach(element => {
    companiesList.push({'value':element.name, 'id':element.id})
    companiesListExcel.push(element.name)
  });
  console.log(companiesList)
}
  


async function runGetRoles() {
  accessToken = await getAccessToken("account:read data:read")
  rolesData = await getProjectRoles()
  rolesData.sort((a, b) => a.role.localeCompare(b.role))
  console.log("Aureos Roles",rolesData);

  accRoles = await getACCRoles()
  console.log("ACC Roles",accRoles);
  console.log("Aureos Roles",rolesData);

  rolesData.forEach(element => {
    rolesDataExcel.push(element.name)
  });
}


  function extractEmailsFromCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const emails = [];

    lines.forEach((line) => {
      const parts = line.split(","); // supports comma-separated or one per line
      console.log(parts);

      if (parts[0] !== "") {
        const data = {
          email: parts[0],
          role: parts[1],
          company: parts[2],
        };
        emails.push(data);
      }
    });

    return emails;
  }

  async function sumbissionComplete(params) {
    
  }