const express = require('express');
const fetch = require('node-fetch').default;
const FormData = require('form-data');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// load your AILABAPI key from environment
const AILAB_KEY = process.env.AILABAPI_KEY;
// external AGE API URL
const AGE_API_URL = 'https://www.ailabapi.com/api/portrait/effects/face-attribute-editing';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Proxy aging effect request using multipart/form-data
app.post('/api/age-face', async (req, res) => {
  try {
    const { image } = req.body; // data URL: 'data:image/jpeg;base64,...'
    // Extract base64 data
    const base64Data = image.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Construct form-data
    const form = new FormData();
    form.append('action_type', 'TO_OLD');
    form.append('image', buffer, {
      filename: 'file.jpg',
      contentType: 'application/octet-stream'
    });

    // Send to external API
    const apiRes = await fetch(AGE_API_URL, {
      method: 'POST',
      headers: {
        'ailabapi-api-key': AILAB_KEY
        // Note: form.getHeaders() will include correct Content-Type
      },
      body: form
    });

    const json = await apiRes.json();
    if (json.error_code && json.error_code !== 0) {
      console.error('API Error:', json.error_msg);
      return res.status(500).json({ error: json.error_msg || 'API error' });
    }

    // Extract returned base64 image
    const resultBase64 = json.result.image;
    // Prefix to data URL
    const agedImage = `data:image/jpeg;base64,${resultBase64}`;
    res.json({ agedImage });
  } catch (err) {
    console.error('Aging effect failed:', err);
    res.status(500).json({ error: 'Aging effect failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));