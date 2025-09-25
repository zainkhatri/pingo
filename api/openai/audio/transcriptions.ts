import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import FormData from 'form-data';
import multer from 'multer';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }


  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle multipart form data
  const uploadSingle = upload.single('file');
  
  return new Promise((resolve) => {
    uploadSingle(req as any, res as any, async (err: any) => {
      if (err) {
        return res.status(400).json({ error: 'File upload failed' });
      }

      try {
        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create form data for OpenAI API
        const formData = new FormData();
        formData.append('file', file.buffer, {
          filename: file.originalname || 'speech.webm',
          contentType: file.mimetype
        });
        formData.append('model', 'whisper-1');

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

        const data = await response.json() as { text: string };
        res.json({ text: data.text });
      } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
      resolve(undefined);
    });
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
