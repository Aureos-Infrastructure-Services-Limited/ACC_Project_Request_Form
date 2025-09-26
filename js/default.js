async function getAccessToken(scopeInput){

  const bodyData = {
      scope: scopeInput,
      };

  const headers = {
      'Content-Type':'application/json'
  };

  const requestOptions = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyData)
  };

  const apiUrl = "https://prod-30.uksouth.logic.azure.com:443/workflows/df0aebc4d2324e98bcfa94699154481f/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=jHsW0eISklveK7XAJcG0nhfEnffX62AP0mLqJrtLq9c";
  //console.log(apiUrl)
  //console.log(requestOptions)
  signedURLData = await fetch(apiUrl,requestOptions)
      .then(response => response.json())
      .then(data => {
          const JSONdata = data

      //console.log(JSONdata)

      return JSONdata.access_token
      })
      .catch(error => console.error('Error fetching data:', error));


  return signedURLData
  }

  async function getProjectRoles(){
  var apiUrl_getProjectRoles = 'https://prod-07.uksouth.logic.azure.com:443/workflows/38dde2d38944467ead65e2349ef9867d/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fdBObPGteUBN6_WeI3A1eQMkhGaGrjh1RkydvSYkHQQ';
  data = fetch(apiUrl_getProjectRoles)
    .then(response => response.json())
    .then(data => {
        return data
    })
    .catch(error => console.error('Error fetching data:', error));
    return data
}

async function getCompnaies(AccessToken){

  const bodyData = {

      };

  const headers = {
      'Authorization':"Bearer "+AccessToken,
      //'Content-Type':'application/json'
  };

  const requestOptions = {
      method: 'GET',
      headers: headers,
      //body: JSON.stringify(bodyData)
  };

  const apiUrl = "https://developer.api.autodesk.com/hq/v1/regions/eu/accounts/"+account_id+"/companies?limit=100";
  //console.log(apiUrl)
  //console.log(requestOptions)
  repsonseData = await fetch(apiUrl,requestOptions)
      .then(response => response.json())
      .then(data => {
          const JSONdata = data
          // console.log(JSONdata)
      return JSONdata
      })
      .catch(error => console.error('Error fetching data:', error));

  return repsonseData
}

async function getACCRoles(){
 
  const headers = {
    'Authorization':"Bearer "+accessToken,
    'Content-Type':'application/json'
  };

  const requestOptions = {
      method: 'GET',
      headers: headers,
      //body: JSON.stringify(bodyData)
  };

  const apiUrl = `https://developer.api.autodesk.com/hq/v2/regions/eu/accounts/${account_id}/projects/${default_project_id}/industry_roles`;
  //console.log(apiUrl)
  //console.log(requestOptions)
  responseData = await fetch(apiUrl,requestOptions)
      .then(response => response.json())
      .then(data => {
          const JSONdata = data

      //console.log(JSONdata)

      return JSONdata
      })
      .catch(error => console.error('Error fetching data:', error));


  return responseData
  }

    async function showLoadingSpinner(element) {
    const loadingSpinner = document.getElementById('loading');
  
    // Show the loading spinner

    loadingSpinner.style.display = 'block';
  }
  
  async function hideLoadingSpinner(element) {
    const loadingSpinner = document.getElementById('loading');
  
    // Show the loading spinner
    loadingSpinner.style.display = 'none';

  }