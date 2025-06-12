#!/usr/bin/env node

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Example Gemini API key (you need to replace this with your actual key)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';

async function analyzeSentiment(text) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze the sentiment of the following Discord message and respond with ONLY a valid JSON object. No explanation, no markdown, just the JSON:

Message: "${text}"

The JSON must have this exact format:
{
  "sentiment": "positive" or "neutral" or "negative",
  "confidence": number between 0 and 1,
  "reason": "brief explanation"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Clean up response and parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Return default neutral sentiment on error
    return {
      sentiment: 'neutral',
      confidence: 0.5,
      reason: 'Error analyzing sentiment'
    };
  }
}

// Test messages
const testMessages = [
  "This is absolutely amazing! Best project ever! 🎉",
  "I hate this so much, it's terrible",
  "The meeting is at 3pm today",
  "Wow! Can't believe how great this turned out! 💪",
  "This is broken and doesn't work at all 😡",
  "Here's the link to the documentation"
];

async function runTests() {
  console.log('🧪 Testing Gemini Sentiment Analysis\n');
  
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('❌ Please replace YOUR_GEMINI_API_KEY_HERE with your actual Gemini API key');
    console.log('   Get one at: https://aistudio.google.com\n');
    return;
  }
  
  for (const message of testMessages) {
    console.log(`📝 Message: "${message}"`);
    const result = await analyzeSentiment(message);
    console.log(`   Sentiment: ${result.sentiment} (confidence: ${result.confidence})`);
    console.log(`   Reason: ${result.reason}`);
    console.log('');
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the tests
runTests(); 