import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from '@vercel/postgres';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


// Shared logic for generating posts
async function handleAutoPost() {
  console.log('Starting auto-post generation...');

  // Check for API Keys
  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL ERROR: GEMINI_API_KEY is missing');
    return NextResponse.json({ success: false, error: 'Server Configuration Error: Missing Gemini API Key' }, { status: 500 });
  }
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    console.error('CRITICAL ERROR: BRAVE_SEARCH_API_KEY is missing');
    return NextResponse.json({ success: false, error: 'Server Configuration Error: Missing Brave Search API Key' }, { status: 500 });
  }

  try {
    // 1. Fetch Real-time Data from Brave Search
    console.log('Fetching real-time data from Brave Search...');
    const query = '삼성전자 테슬라 나스닥 AI 트렌드 경제 전망';
    const braveResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY
      }
    });

    if (!braveResponse.ok) {
      throw new Error(`Brave Search API Failed: ${braveResponse.status} ${braveResponse.statusText}`);
    }

    const braveData = await braveResponse.json();
    const searchResults = braveData.web?.results?.map((result: any) => ({
      title: result.title,
      description: result.description,
      url: result.url
    })) || [];

    console.log(`Found ${searchResults.length} search results.`);

    // Format search results for the prompt
    const contextString = searchResults.map((r: any, i: number) =>
      `[${i + 1}] ${r.title}\n   - 요약: ${r.description}\n   - URL: ${r.url}`
    ).join('\n\n');

    // 2. Generate Content with Gemini
    console.log('Initializing Gemini client...');
    // Using Gemini 2.5 Flash Lite as requested
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
    역할: 당신은 2030, 40대 투자자들을 위한 힙하고 통찰력 있는 경제/주식 분석가입니다.
    
    임무: 아래 제공된 [실시간 검색 데이터]를 바탕으로, 지금 가장 핫한 경제/주식 트렌드를 분석하는 블로그 글을 작성하세요.

    [실시간 검색 데이터]
    ${contextString}

    [작성 가이드라인]
    1. **타겟 독자**: 2030, 40대. 너무 딱딱하지 않게, 하지만 전문적인 깊이는 있게 써주세요.
    2. **내용 구성**:
       - 서론: 현재 시장 분위기 훅(Hook)
       - 본론: 검색된 뉴스들을 통합하여 트렌드 분석 (삼성전자, 테슬라, AI 등)
       - 결론: 투자자들을 위한 인사이트 및 마무리
    3. **출처 표기 (필수)**: 
       - 글 내용을 작성할 때 데이터의 출처를 명확히 하세요.
       - **글의 맨 마지막**에 "## 참고 자료" 섹션을 만들고, 사용된 기사의 제목과 URL을 리스트로 정리해 주세요. (위 검색 데이터의 URL 활용)
    4. **형식**: JSON으로 반환해 주세요.
       - title: 시선을 끄는 매력적인 제목
       - content: HTML 형식의 본문 (h2, p, ul, li, a 태그 등 활용. 스타일링은 제외)

    JSON 형식 예시:
    {
      "title": "2026년 AI 시장, 지금이 기회인가? 삼성전자와 테슬라의 승부수",
      "content": "<h2>AI 대전, 누가 웃을까?</h2><p>...</p><h2>참고 자료</h2><ul><li><a href='...'>기사 제목</a></li></ul>"
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

    // 3. Save to Vercel Postgres
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

