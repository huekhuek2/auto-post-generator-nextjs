import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from '@vercel/postgres';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


// Shared logic for generating posts
async function handleAutoPost() {
  console.log('Starting auto-post generation...');

  // Check for API Key
  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL ERROR: GEMINI_API_KEY is missing in environment variables');
    return NextResponse.json({ success: false, error: 'Server Configuration Error: Missing API Key' }, { status: 500 });
  }

  try {
    // 1. Generate Content with Gemini
    console.log('Initializing Gemini client...');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `오늘의 코스피, 나스닥, AI 트렌드, 테슬라, 삼성전자 등의 키워드를 조합해서 2030과 40대가 흥미롭게 읽을 수 있는 주식/경제 분석 칼럼을 2,000자 분량의 HTML 또는 마크다운 형식으로 작성해 줘. 
    형식은 다음과 같이 JSON으로 줘:
    {
      "title": "여기에 제목",
      "content": "여기에 본문 내용을 HTML 형식으로"
    }`;

    console.log('Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    console.log('Gemini response received. Processing...');

    const response = await result.response;
    const text = response.text();
    console.log('Raw text length from Gemini:', text.length);

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    let generatedData;
    try {
      generatedData = JSON.parse(cleanText);
    } catch (e) {
      console.error('JSON Parsing Failed. Raw text was:', text);
      console.error('JSON Error:', e);
      // Fallback if not JSON
      generatedData = {
        title: 'Economic Analysis (Auto-Generated)',
        content: text
      };
    }

    // 2. Save to Vercel Postgres
    const { title, content } = generatedData;
    console.log('Content generated. Title:', title);

    try {
      console.log('Attempting to connect to Vercel Postgres...');
      await sql`
        INSERT INTO posts (title, content)
        VALUES (${title}, ${content})
      `;
      console.log('Successfully saved to DB.');
    } catch (dbError) {
      console.error('Database Error:', dbError);
      return NextResponse.json({ success: false, error: 'Database Connection/Insert Failed. Check Vercel Postgres connection.', details: String(dbError) }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Post generated and saved', data: generatedData }, { status: 200 });

  } catch (error: any) {
    console.error('General API Error:', error);
    // Log specific GoogleGenerativeAI error details if available
    if (error.message) console.error('Error Message:', error.message);
    if (error.statusText) console.error('Status Text:', error.statusText);

    return NextResponse.json({
      success: false,
      error: 'Failed to generate post',
      details: error.message || String(error)
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleAutoPost();
}

export async function GET(request: Request) {
  return handleAutoPost();
}

