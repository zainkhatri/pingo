import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { conversationText, scenarioContext } = req.body;
    
    if (!conversationText) {
      return res.status(400).json({ error: 'No conversation text provided' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
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
      return res.status(response.status).json({ error: 'Summary generation failed' });
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    res.json({ summary: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
