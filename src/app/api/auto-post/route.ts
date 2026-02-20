import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from '@vercel/postgres';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Shared logic for generating posts
async function handleAutoPost(request: Request) {
  // 0. Security Check (CRON_SECRET)
  // Vercel Cron sends this header strictly.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid CRON_SECRET' },
      { status: 401 }
    );
  }

  // 1. Force KST (Asia/Seoul) strict calculation
  // "2026년 2월 18일 수요일" format strictly in KST
  const today = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'full',
  }).format(new Date());

  console.log(`[Auto-Post] Starting job for date: ${today} based on KST`);

  // Simple check for Saturday based on the Korean string
  // "2026년 2월 18일 수요일" includes the day name.
  const isSaturday = today.includes('토요일');

  // Check for API Keys
  if (!process.env.GEMINI_API_KEY) {
    console.error('CRITICAL ERROR: GEMINI_API_KEY is missing');
    return NextResponse.json({ success: false, error: 'Server Configuration Error: Missing Gemini API Key' }, { status: 500 });
  }
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    console.error('CRITICAL ERROR: NAVER API Keys are missing');
    return NextResponse.json({ success: false, error: 'Server Configuration Error: Missing Naver API Keys' }, { status: 500 });
  }

  try {
    // 2. Define Topics & Sort Order based on Day
    let keywords: string[] = [];
    let sortOption = 'date'; // Default: Sort by query date/latest

    if (isSaturday) {
      // Saturday: Weekly Summary
      console.log('Mode: Saturday Weekly Briefing');
      const baseKeywords = ['이번 주 증시 요약', '한 주간 주요 경제 뉴스', '주간 증시 전망', '이번 주 비트코인 흐름'];
      keywords = baseKeywords.map(k => `${k} ${today.split(' ')[0]} ${today.split(' ')[1]}`); // Approximate date matching if needed, or just keyword
      sortOption = 'sim'; // Sort by similarity/relevance for weekly overviews
    } else {
      // Weekdays + Sunday: Daily News
      console.log('Mode: Daily News Briefing');
      const baseKeywords = ['코스피', '미국 증시', '삼성전자', '비트코인', '경제 뉴스'];
      // Using base keywords combined with sort='date' for latest news
      keywords = baseKeywords;
      sortOption = 'date'; // Sort by latest
    }

    console.log(`Searching Naver News for keywords: ${keywords.join(', ')} (Sort: ${sortOption})`);

    // 3. Fetch Data from Naver News API
    let combinedContext = '';

    const searchPromises = keywords.map(async (keyword, index) => {
      console.log(`[Keyword ${index + 1}] Searching: ${keyword}...`);

      try {
        const naverResponse = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=5&sort=${sortOption}`, {
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
            'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || ''
          }
        });

        if (!naverResponse.ok) {
          console.error(`[Keyword ${index + 1}] Failed with status: ${naverResponse.status}`);
          return '';
        }

        const naverData = await naverResponse.json();
        const results = naverData.items?.map((item: any) => {
          // Clean HTML tags and entities
          const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          const cleanDesc = item.description.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          const pubDate = item.pubDate; // Add pubDate for context
          return `- [${cleanTitle}](${item.link}) (${pubDate}): ${cleanDesc}`;
        }).join('\n');

        if (!results) {
          console.warn(`[Keyword ${index + 1}] No results found for ${keyword}`);
          return '';
        }

        return `### ${keyword}\n${results}\n`;

      } catch (err) {
        console.error(`[Keyword ${index + 1}] Error fetching Naver news:`, err);
        return '';
      }
    });

    const searchResults = await Promise.all(searchPromises);
    combinedContext = searchResults.filter(Boolean).join('\n\n');

    if (!combinedContext) {
      throw new Error('No search results found from Naver API for any keyword.');
    }

    console.log('Naver News data collected successfully.');

    // 4. Generate Content with Gemini
    console.log('Initializing Gemini client...');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: "application/json" }
    });

    let systemInstruction = '';
    if (isSaturday) {
      systemInstruction = `
        오늘은 **토요일 주간 결산 특집**입니다.
        한 주간의 주요 경제 흐름을 요약하고, **다음 주 시장 전망**까지 포함해서 '주간 경제 브리핑' 형식으로 작성해 주세요.
        독자에게 한 주를 정리하는 느낌을 주어야 합니다.
      `;
    } else {
      systemInstruction = `
        오늘은 **데일리 경제 뉴스**입니다.
        가장 최신 소식을 바탕으로 빠르고 정확하게 전달해 주세요.
      `;
    }

    const prompt = `
    역할: 당신은 '흑흑이'라는 친근한 별명을 가진 경제 뉴스레터 에디터입니다.
    오늘 날짜: ${today} (반드시 이 날짜와 요일을 기준으로 작성하세요.)
    
    [모드 설정]
    ${systemInstruction}
    
    [절대 규칙 - 어길 시 해고]
    1. **절대로 \`\`\`json 같은 마크다운 포장지 씌우지 말고, 순수한 JSON 텍스트만 출력해.** (반드시 지켜야 함)
    2. **너는 내가 전달해 준 'Naver News 검색 결과 데이터'만을 바탕으로 글을 써야 해.**
    3. **특히 코스피, 나스닥 같은 주가나 지수 '숫자'는 전달받은 데이터에 정확히 명시되어 있을 때만 적고, 데이터에 없으면 절대 네 마음대로 숫자를 지어내지 마.** (팩트 체크 필수)
    3. **제공된 뉴스 내용에 없는 사실을 꾸며내지 마.**
    4. **전달된 데이터 중에서 가장 시의성 있고 중요한 내용을 선별해서 깊이 있게 분석해.**

    [주제별 실시간 데이터 (Naver News)]
    ${combinedContext}

    [작성 가이드라인]
    1. **톤앤매너**:
       - "친구에게 말하듯 편안하고 부드럽게" (딱딱한 뉴스체 절대 금지)
       - "~해요", "~했답니다", "~네요" 등 친근한 종결어미 사용.
       - 독자는 "**투자자 여러분**" 또는 "**구독자님**"으로 호칭.
       - 어려운 경제 용어는 쉽게 풀어써주세요.

    2. **글의 구조**:
       - **제목**: 이모지(☕, 🚀, 📉 등)를 활용한 감성적이고 클릭하고 싶은 제목. (오늘 날짜 "${today}" 포함 권장)
       - **인사말**: 날씨(한국 기준), 계절, 요일 등을 언급하며 가볍게 시작.
       - **본문**: 
         - 위 데이터에서 확인된 **가장 핫한 키워드 2~3개**를 중심으로 소제목(h3)을 달고 작성하세요.
         - 각 본문 내용은 제공된 뉴스 기사의 내용을 바탕으로 "팩트" 위주로 서술하되, 에디터의 따뜻한 시선을 담아주세요.
       - **마무리**: 오늘도 화이팅! 하는 따뜻한 격려 메시지.
       - **참고 자료**: 글 맨 마지막에 **## 참고 자료** 섹션을 만들고, 본문에 인용된 모든 기사의 제목과 URL을 리스트로 정리해주세요.

    3. **형식**: JSON으로 반환해주세요.
       - title: (문자열) 생성된 제목
       - content: (문자열) HTML 태그가 포함된 본문 내용 (h2, h3, p, ul, li, strong, a 태그 등 활용. 스타일 속성은 제외)

    JSON 스키마 예시:
    {
      "title": "제목",
      "content": "내용"
    }`;

    console.log('Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    console.log('Gemini response received.');

    const response = await result.response;
    const text = response.text();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const cleanText = (firstBrace !== -1 && lastBrace !== -1)
      ? text.substring(firstBrace, lastBrace + 1)
      : text;

    let generatedData;
    try {
      // Step 1: Try parsing the clean text directly (handles pretty-printed JSON correctly)
      generatedData = JSON.parse(cleanText);
    } catch (e) {
      console.warn('First JSON parse attempt failed. Trying fallback (removing newlines)...');
      try {
        // Step 2: Fallback - replace newlines with spaces (safe for JSON structure, fixes unescaped newlines in strings)
        const safeText = cleanText.replace(/[\n\r]/g, " ");
        generatedData = JSON.parse(safeText);
      } catch (e2) {
        console.error('JSON Parsing Failed Final. Raw text start:', text.substring(0, 500));
        generatedData = {
          title: `흑흑이의 경제 뉴스 (${today})`,
          content: `<h2>자동 생성 중 형식 오류가 발생했지만, 내용은 아래와 같습니다.</h2><p><strong>Raw Debug Data:</strong></p><pre>${text.replace(/</g, "&lt;").substring(0, 2000)}...</pre>`
        };
      }
    }

    // 5. Save to Vercel Postgres
    const { title, content } = generatedData;

    // Validate content isn't empty
    if (!content || content.length < 100) {
      throw new Error('Generated content is too short or empty.');
    }

    // Check for duplicate title
    const existingPost = await sql`SELECT id FROM posts WHERE title = ${title} LIMIT 1`;
    if (existingPost.rows.length > 0) {
      console.warn(`[Auto-Post] Duplicate post detected. Title: "${title}". Skipping insertion.`);
      return NextResponse.json({ success: true, message: 'Post generation skipped (Duplicate Title)', data: generatedData }, { status: 200 });
    }

    await sql`
      INSERT INTO posts (title, content)
      VALUES (${title}, ${content})
    `;
    console.log(`[Auto-Post] Post saved to DB successfully. Title: ${title}`);

    return NextResponse.json({ success: true, message: 'Comprehensive post generated via Naver API', data: generatedData }, { status: 200 });

  } catch (error: any) {
    console.error('[Auto-Post] General API Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate post',
      details: error.message || String(error)
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleAutoPost(request);
}

export async function GET(request: Request) {
  return handleAutoPost(request);
}
