import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

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

  try {
    const { rawTranscript, scenarioType } = req.body;
    
    if (!rawTranscript || !Array.isArray(rawTranscript)) {
      return res.status(400).json({ error: 'No valid transcript provided' });
    }

    // Format the raw transcript for processing
    const conversationText = rawTranscript
      .map((msg: any) => `${msg.role === 'ai' ? 'AI' : 'User'}: ${msg.text}`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        temperature: 0.1,
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
}
