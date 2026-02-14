import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sql } from '@vercel/postgres';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


// Shared logic for generating posts
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
    // 1. Define Topics and Keywords
    const topicConfig = [
      {
        name: '글로벌 증시 및 기술주',
        keywords: ['엔비디아', '테슬라', 'ASML', 'MS', 'Apple', 'Google', 'Amazon', 'Meta', 'AMD', 'TSMC', '미국 증시'],
        querySuffix: '최신 주가 및 뉴스'
      },
      {
        name: '암호화폐 및 블록체인',
        keywords: ['비트코인', '이더리움', 'ETF', '가상자산 규제', '블록체인'],
        querySuffix: '최신 시세 및 뉴스'
      },
      {
        name: '거시경제 및 금리 정책',
        keywords: ['연준', '금리인하', '환율', '미국 대선', '트럼프', '정치', 'FOMC'],
        querySuffix: '경제 전망 및 분석'
      },
      {
        name: '한국 증시 및 주요 산업',
        keywords: ['삼성전자', '2차전지', '코스피', 'SK하이닉스', 'LG에너지솔루션', '에코프로', '한국 주식'],
        querySuffix: '최신 뉴스 및 전망'
      },
      {
        name: '미래 기술 및 AI 트렌드',
        keywords: ['생성형 AI', '로봇', '바이오', '우주산업', '양자컴퓨터'],
        querySuffix: '최신 기술 동향'
      }
    ];

    console.log(`Processing ${topicConfig.length} topics...`);

    // 2. Fetch Data for ALL Topics
    let combinedContext = '';

    // We'll perform searches in parallel to save time, but usually sequential is safer for rate limits if they are tight. 
    // Brave Search usually handles concurrent requests well. Let's do `Promise.all`.
    const searchPromises = topicConfig.map(async (topic, index) => {
      // Construct a query with OR operator for keywords to get diverse results
      // Example: "(엔비디아 OR 테슬라 OR ...) 최신 주가 및 뉴스"
      // Ensure the query isn't too long for the API.
      const keywordsQuery = topic.keywords.join(' OR ');
      const fullQuery = `"${topic.name}" ${keywordsQuery} ${topic.querySuffix}`;

      console.log(`[Topic ${index + 1}] Searching: ${fullQuery.substring(0, 50)}...`);

      try {
        const braveResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(fullQuery)}&count=4`, { // Fetch 4 results per topic (total 20)
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || ''
          }
        });

        if (!braveResponse.ok) {
          console.error(`[Topic ${index + 1}] Failed: ${braveResponse.status}`);
          return `### ${topic.name}\n(검색 데이터 수집 실패)\n`;
        }

        const braveData = await braveResponse.json();
        const results = braveData.web?.results?.map((r: any) =>
          `- [${r.title}](${r.url}): ${r.description}`
        ).join('\n') || '(관련 뉴스 없음)';

        return `### ${index + 1}. ${topic.name}\n${results}\n`;

      } catch (err) {
        console.error(`[Topic ${index + 1}] Error:`, err);
        return `### ${topic.name}\n(에러 발생: 데이터 수집 불가)\n`;
      }
    });

    const searchResults = await Promise.all(searchPromises);
    combinedContext = searchResults.join('\n\n');

    console.log('All search results collected.');

    // 3. Generate Content with Gemini
    console.log('Initializing Gemini client...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }); // Using Flash Lite for speed/cost

    const prompt = `
    역할: 당신은 '흑흑이'라는 친근한 별명을 가진 경제 뉴스레터 에디터입니다.
    
    [미션]
    아래 [주제별 실시간 데이터]를 모두 활용하여, **매일 아침 배달되는 종합 경제 뉴스레터**를 작성해주세요.
    사용자가 요청한 5가지 핵심 주제를 **하나도 빠짐없이** 다뤄야 합니다.

    [주제별 실시간 데이터]
    ${combinedContext}

    [필수 작성 가이드라인]
    1. **톤앤매너**:
       - "친구에게 말하듯 편안하고 부드럽게" (딱딱한 뉴스체 절대 금지)
       - "~해요", "~했답니다", "~네요" 등 친근한 종결어미 사용.
       - 독자는 "**투자자 여러분**" 또는 "**구독자님**"으로 호칭.
       - 어려운 경제 용어는 전공자가 아니어도 이해할 수 있게 쉽게 풀어써주세요.

    2. **글의 구조 (순서 준수)**:
       - **제목**: 이모지(☕, 🚀, 📉 등)를 활용한 감성적이고 클릭하고 싶은 제목. (예: "☕ 흑흑이의 모닝 브리핑: 엔비디아부터 비트코인까지!")
       - **인사말**: 날씨, 계절, 요일 등을 언급하며 가볍게 시작.
       - **본문 (5개 섹션)**: 
         - 위 5가지 주제(글로벌 증시, 코인, 거시경제, 한국증시, 미래기술)를 **각각 별도의 소제목(h3)**으로 나누어 작성.
         - 각 섹션마다 검색된 키워드(예: 엔비디아, 삼성전자, 트럼프, 비트코인 등)를 구체적으로 언급하며 내용을 전개하세요.
         - 단순히 사실만 나열하지 말고, "이게 왜 우리에게 중요한지", "앞으로 어떻게 될지"에 대한 짧은 인사이트를 곁들여주세요.
       - **마무리**: 오늘도 화이팅! 하는 따뜻한 격려 메시지.
       - **참고 자료**: 글 맨 마지막에 **## 참고 자료** 섹션을 만들고, 본문에 인용된 모든 기사의 제목과 URL을 리스트로 정리해주세요.

    3. **형식**: JSON으로 반환해주세요.
       - title: (문자열) 생성된 제목
       - content: (문자열) HTML 태그가 포함된 본문 내용 (h2, h3, p, ul, li, strong, a 태그 등 활용. 스타일 속성은 제외)

    JSON 예시:
    {
      "title": "☕ 흑흑이의 모닝 브리핑: 반도체부터 금리까지 한눈에!",
      "content": "<h2>반가워요, 구독자님! 흑흑이입니다.</h2><p>오늘 아침 공기가 참 상쾌하네요...</p><h3>🚀 글로벌 기술주: 엔비디아 질주, 어디까지?</h3><p>엔비디아가 또 신고가를...</p>..."
    }`;

    console.log('Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    console.log('Gemini response received.');

    const response = await result.response;
    const text = response.text();
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    let generatedData;
    try {
      generatedData = JSON.parse(cleanText);
    } catch (e) {
      console.error('JSON Parsing Failed:', e);
      // Construct a fallback object manually if parsing fails
      generatedData = {
        title: '오늘의 경제 뉴스 종합 브리핑',
        content: `<h2>자동 생성 중 오류가 발생했지만, 내용은 아래와 같습니다.</h2>${text}` // Fallback rendering
      };
    }

    // 4. Save to Vercel Postgres
    const { title, content } = generatedData;

    // Validate content isn't empty
    if (!content || content.length < 100) {
      throw new Error('Generated content is too short or empty.');
    }

    await sql`
      INSERT INTO posts (title, content)
      VALUES (${title}, ${content})
    `;
    console.log('Post saved to DB successfully.');

    return NextResponse.json({ success: true, message: 'Comprehensive post generated', data: generatedData }, { status: 200 });

  } catch (error: any) {
    console.error('General API Error:', error);
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

