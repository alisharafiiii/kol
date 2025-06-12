import { GoogleGenerativeAI } from '@google/generative-ai';
import { MessageSentiment } from '@/lib/types/discord';
import { redis } from '@/lib/redis';

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  
  private constructor() {}
  
  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }
  
  async initialize() {
    try {
      // Get API key from Redis settings or env
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        console.error('Gemini API key not found');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      console.log('Gemini AI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini:', error);
    }
  }
  
  async getApiKey(): Promise<string | null> {
    try {
      // First check Redis for admin-updated key
      const settings = await redis.get('settings:gemini');
      if (settings && typeof settings === 'object' && 'apiKey' in settings) {
        return (settings as any).apiKey;
      }
      
      // Fallback to env variable
      return process.env.GEMINI_API_KEY || null;
    } catch (error) {
      console.error('Error getting Gemini API key:', error);
      return process.env.GEMINI_API_KEY || null;
    }
  }
  
  async updateApiKey(apiKey: string): Promise<void> {
    await redis.set('settings:gemini', { apiKey, updatedAt: new Date().toISOString() });
    await this.initialize(); // Reinitialize with new key
  }
  
  async analyzeMessage(content: string): Promise<MessageSentiment> {
    if (!this.model) {
      await this.initialize();
      if (!this.model) {
        return {
          score: 'neutral',
          confidence: 0,
          analyzedAt: new Date().toISOString()
        };
      }
    }
    
    try {
      const prompt = `
        Analyze the sentiment of this Discord message and classify it.
        
        Message: "${content}"
        
        Provide a JSON response with:
        1. sentiment: "positive", "neutral", or "negative"
        2. confidence: a number between 0 and 1
        3. tags: array of applicable tags from ["spam", "toxic", "valuable", "question", "announcement", "discussion", "meme", "support"]
        
        Focus on:
        - Overall emotional tone
        - Community value
        - Constructive vs destructive content
        
        Response format:
        {
          "sentiment": "positive|neutral|negative",
          "confidence": 0.85,
          "tags": ["valuable", "discussion"]
        }
      `;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.sentiment || 'neutral',
          confidence: parsed.confidence || 0.5,
          analyzedAt: new Date().toISOString(),
          tags: parsed.tags || []
        };
      }
      
      // Fallback
      return {
        score: 'neutral',
        confidence: 0.5,
        analyzedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error analyzing message:', error);
      return {
        score: 'neutral',
        confidence: 0,
        analyzedAt: new Date().toISOString()
      };
    }
  }
  
  async analyzeBatch(messages: string[]): Promise<MessageSentiment[]> {
    // Process in batches to avoid rate limits
    const batchSize = 10;
    const results: MessageSentiment[] = [];
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(msg => this.analyzeMessage(msg));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay to respect rate limits
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
}

export const geminiService = GeminiService.getInstance(); 