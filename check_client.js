const https = require('https');
https.get('https://xeni.xentroinfotech.com/bn/login', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
});
