import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

dotenv.config();

const app = express();

// Configure CORS based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://pingo-frontend.vercel.app', 'https://pingo.vercel.app'] // Add your production frontend URLs
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'], // Development URLs
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!", timestamp: new Date().toISOString() });
});

/**
 * Minimal token-mint endpoint for OpenAI Realtime WebRTC.
 * The browser calls this; you return a short-lived session with client_secret.value.
 */
app.get("/session", async (_req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
        turn_detection: null  // Disable automatic turn detection to prevent interruptions
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ error: text });
    }
    const json = await r.json(); // contains client_secret.value and expiry
    res.json(json);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Configure multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  }
});

// Transcription endpoint
app.post("/api/openai/audio/transcriptions", upload.single('file'), async (req, res) => {
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

    const data = await response.json() as { text: string };
    res.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('Transcription endpoint registered at /api/openai/audio/transcriptions');

// Summary endpoint
app.post("/api/summary", async (req, res) => {
  console.log('Summary endpoint hit!');
  try {
    const { conversationText, scenarioContext } = req.body;
    
    if (!conversationText) {
      return res.status(400).json({ error: 'No conversation text provided' });
    }

    // Check for common failure patterns and provide harsh feedback
    const lowerText = conversationText.toLowerCase();
    console.log('Checking for failures in:', lowerText);
    console.log('Scenario context:', scenarioContext);
    
    if (scenarioContext.includes('language learning') && 
        (lowerText.includes("dont know spanish") || 
         lowerText.includes("don't know spanish") ||
         lowerText.includes("no spanish"))) {
      console.log('DETECTED SPANISH FAILURE - returning harsh feedback');
      return res.json({
        summary: "This was a poor performance. You told a Spanish tutor that you don't know Spanish, which completely defeats the purpose of language practice. In a real tutoring session, this would waste everyone's time and money. You should have attempted to speak Spanish, even basic words like 'hola' or 'gracias'. Instead of giving up immediately, you should have asked the tutor to help you practice specific phrases or vocabulary. This approach shows no effort to engage with the learning process."
      });
    }

    if (scenarioContext.includes('interview') && 
        (lowerText.includes("i don't know how to") || 
         lowerText.includes("i have no experience") ||
         lowerText.includes("i'm not sure what") ||
         lowerText.includes("um, well, i guess"))) {
      return res.json({
        summary: "This was a poor interview performance. You gave vague, uncertain answers that would immediately disqualify you from consideration. Saying 'I don't know' or 'not sure' in an interview shows lack of preparation and confidence. Real interviewers expect specific examples, concrete achievements, and confident responses. You need to prepare detailed stories about your projects, practice explaining technical concepts clearly, and eliminate filler words like 'um' and 'well'."
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0.3, // Lower temperature for more direct, less creative responses
        messages: [
          {
            role: 'system',
            content: `You are a helpful performance evaluator. Analyze the conversation and provide balanced, constructive feedback.

Guidelines:
- Summarize what actually happened in the conversation
- Identify both strengths and areas for improvement
- Be honest but supportive in your assessment
- Consider the context and what the user was trying to achieve
- Provide specific, actionable suggestions for improvement
- If the conversation was brief, focus on what can be learned from it

Provide a balanced summary that helps the user understand their performance and how to improve.`
          },
          {
            role: 'user',
            content: `Please analyze this conversation from a ${scenarioContext}:\n\n${conversationText}\n\n**Task**: Provide a balanced summary of what happened and constructive feedback. Include both positive observations and areas for improvement. Make your feedback specific and actionable.`
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI summary error:', errorText);
      return res.status(response.status).json({ error: 'Summary generation failed' });
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    res.json({ summary: data.choices[0].message.content });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('Summary endpoint registered at /api/summary');

// Transcript processing endpoint
app.post("/api/transcript/process", async (req, res) => {
  console.log('Transcript processing endpoint hit!');
  try {
    const { rawTranscript, scenarioType } = req.body;
    
    if (!rawTranscript || !Array.isArray(rawTranscript)) {
      return res.status(400).json({ error: 'No valid transcript provided' });
    }

    // Format the raw transcript for processing
    const conversationText = rawTranscript
      .map(msg => `${msg.role === 'ai' ? 'AI' : 'User'}: ${msg.text}`)
      .join('\n');

    console.log('Processing transcript for scenario:', scenarioType);
    console.log('Raw conversation:', conversationText);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        temperature: 0.1, // Low temperature for accuracy
        messages: [
          {
            role: 'system',
            content: `You are a transcript correction specialist. Your job is to fix speech-to-text errors and create an accurate, properly formatted transcript.

RULES:
1. Fix obvious speech-to-text errors (e.g., "grocery store" when context suggests "Macy's")
2. Maintain the original meaning and flow of conversation
3. Don't add content that wasn't said
4. Fix grammar and punctuation for readability
5. Preserve the natural speaking style
6. Return ONLY a JSON array with format: [{"role": "user" | "ai", "text": "corrected text"}]

Context: This is a ${scenarioType} practice session.`
          },
          {
            role: 'user',
            content: `Please correct this transcript and fix any speech-to-text errors. Pay special attention to misheard words that don't match the context:\n\n${conversationText}\n\nReturn only the corrected JSON array.`
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI transcript processing error:', errorText);
      return res.status(response.status).json({ error: 'Transcript processing failed' });
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    let processedTranscript;
    
    try {
      // Try to parse the JSON response
      const responseText = data.choices[0].message.content.trim();
      // Remove any markdown formatting
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '');
      processedTranscript = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response, using original transcript');
      processedTranscript = rawTranscript;
    }

    res.json({ processedTranscript });
  } catch (error) {
    console.error('Transcript processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

console.log('Transcript processing endpoint registered at /api/transcript/process');

// Export the app for Vercel
export default app;

// Only start the server if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`Auth server on http://localhost:${port}`));
}