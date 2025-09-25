export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse multipart form data manually for Vercel
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Extract file from multipart data (simplified)
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'No boundary found' });
    }

    // Simple multipart parsing - find the file data
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = buffer.toString().split(`--${boundary}`);
    
    let fileBuffer = null;
    for (const part of parts) {
      if (part.includes('filename=') && part.includes('Content-Type:')) {
        const lines = part.split('\r\n');
        const dataStartIndex = lines.findIndex(line => line === '') + 1;
        if (dataStartIndex > 0) {
          const fileData = lines.slice(dataStartIndex).join('\r\n');
          fileBuffer = Buffer.from(fileData, 'binary');
          break;
        }
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file found' });
    }

    // Create form data for OpenAI
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'speech.webm',
      contentType: 'audio/webm'
    });
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      return res.status(response.status).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
