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
    역할: 당신은 '흑흑이'라는 친근한 별명을 가진 경제 뉴스레터 에디터입니다.
    
    임무: 아래 [실시간 검색 데이터]를 바탕으로, 아침에 커피 한 잔 마시며 가볍게 읽을 수 있는 경제 뉴스레터를 작성해 주세요.

    [실시간 검색 데이터]
    ${contextString}

    [작성 가이드라인]
    1. **톤앤매너**: 
       - 기계적인 AI 말투 금지! 친구에게 말하듯 부드럽고 친근하게 써주세요.
       - "다나까"체보다 "해요"체를 사용해 주세요. (예: "확인되었습니다" -> "확인했어요")
       - 호칭은 "2030" 같은 세대 구분 대신 깔끔하게 "**투자자 여러분**" 또는 "**독자 여러분**"으로 통일해 주세요.
    
    2. **제목 스타일**: 
       - 딱딱한 영어 섞인 제목 금지.
       - 감성적이고 직관적인 한글 제목을 추천합니다.
       - 예시: "☕ 아침 8시, 흑흑이가 배달하는 오늘의 뉴스", "굿모닝! 오늘 아침 핵심 요약만 모았어요"

    3. **내용 구성**:
       - **인트로**: 날씨 얘기나 가벼운 인사로 시작해서 오늘 시장 분위기를 슬쩍 던져주세요.
       - **핵심 뉴스**: 검색된 데이터를 바탕으로 가장 중요한 소식 2~3가지를 꼽아서 "왜 중요한지" 쉽게 풀어서 설명해 주세요.
       - **마무리**: 오늘도 성투하시라는 따뜻한 응원 멘트.

    4. **출처 표기 (필수)**: 
       - **글의 맨 마지막**에 "## 참고 자료" 섹션을 만들고, 사용된 기사의 제목과 URL을 리스트로 정리해 주세요. (위 검색 데이터의 URL 활용)

    5. **형식**: JSON으로 반환해 주세요.
       - title: 위 가이드라인에 맞춘 제목
       - content: HTML 형식의 본문 (h2, p, ul, li, a 태그 등 활용. 스타일링은 제외)

    JSON 형식 예시:
    {
      "title": "☕ 굿모닝! 테슬라가 또 일을 냈네요?",
      "content": "<h2>안녕하세요, 독자 여러분! 흑흑이입니다.</h2><p>오늘 아침 커피는 드셨나요? 밤사이 뉴욕 증시가 아주 뜨거웠거든요.</p>..."
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

