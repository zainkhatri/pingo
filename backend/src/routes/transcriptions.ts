import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

const router = express.Router();

// Configure multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  }
});

router.post('/transcriptions', upload.single('file'), async (req, res) => {
  console.log('Transcription endpoint hit!');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  try {
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'speech.webm',
      contentType: req.file.mimetype
    });
    formData.append('model', 'whisper-1'); // Using whisper-1 as it's more reliable

    // Make request to OpenAI
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
      console.error('OpenAI transcription error:', errorText);
      return res.status(response.status).json({ error: 'Transcription failed' });
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
