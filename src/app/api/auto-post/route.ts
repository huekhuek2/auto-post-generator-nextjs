import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from '@vercel/postgres';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    // 1. Generate Content with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `오늘의 코스피, 나스닥, AI 트렌드, 테슬라, 삼성전자 등의 키워드를 조합해서 2030과 40대가 흥미롭게 읽을 수 있는 주식/경제 분석 칼럼을 2,000자 분량의 HTML 또는 마크다운 형식으로 작성해 줘. 
    형식은 다음과 같이 JSON으로 줘:
    {
      "title": "여기에 제목",
      "content": "여기에 본문 내용을 HTML 형식으로"
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    
    let generatedData;
    try {
      generatedData = JSON.parse(cleanText);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      // Fallback if not JSON
      generatedData = {
        title: 'Economic Analysis (Auto-Generated)',
        content: text
      };
    }

    // 2. Save to Vercel Postgres
    // Ensure table exists (in a real app, do this in migration, but for "factory" usage, simple check is ok or assume created)
    // await sql`CREATE TABLE IF NOT EXISTS posts ...`; // Skip for performance, assume schema setup

    const { title, content } = generatedData;

    await sql`
      INSERT INTO posts (title, content)
      VALUES (${title}, ${content})
    `;

    return NextResponse.json({ success: true, message: 'Post generated and saved', data: generatedData }, { status: 200 });

  } catch (error) {
    console.error('Error in auto-post:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate post' }, { status: 500 });
  }
}
