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

    // 2. Select 3 Random Topics for "Today's Hot Keywords"
    // Shuffle the array and slice the first 3
    const shuffledTopics = topicConfig.sort(() => 0.5 - Math.random());
    const selectedTopics = shuffledTopics.slice(0, 3);

    console.log(`Selected 3 Hot Topics: ${selectedTopics.map(t => t.name).join(', ')}`);

    // 2. Fetch Data for Selected Topics ONLY
    let combinedContext = '';

    const searchPromises = selectedTopics.map(async (topic, index) => {
      // Construct a query with OR operator for keywords to get diverse results
      const keywordsQuery = topic.keywords.join(' OR ');
      const fullQuery = `"${topic.name}" ${keywordsQuery} ${topic.querySuffix}`;

      console.log(`[Topic ${index + 1}] Searching: ${fullQuery.substring(0, 50)}...`);

      try {
        const braveResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(fullQuery)}&count=5`, { // Increase count slightly to ensure quality
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY || ''
          }
        });

        if (!braveResponse.ok) {
          console.error(`[Topic ${index + 1}] Failed: ${braveResponse.status}`);
          return ''; // Return empty string on failure, don't pollute context with error messages
        }

        const braveData = await braveResponse.json();
        const results = braveData.web?.results?.map((r: any) =>
          `- [${r.title}](${r.url}): ${r.description}`
        ).join('\n');

        if (!results) return '';

        return `### ${topic.name}\n${results}\n`;

      } catch (err) {
        console.error(`[Topic ${index + 1}] Error:`, err);
        return '';
      }
    });

    const searchResults = await Promise.all(searchPromises);
    combinedContext = searchResults.filter(Boolean).join('\n\n'); // Filter out empty results

    if (!combinedContext) {
      throw new Error('No search results found for any topic.');
    }

    console.log('Search results collected.');

    // 3. Generate Content with Gemini
    console.log('Initializing Gemini client...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
    역할: 당신은 '흑흑이'라는 친근한 별명을 가진 경제 뉴스레터 에디터입니다.
    
    [절대 규칙 - 어길 시 해고]
    1. **너는 내가 전달해 준 'Brave Search 검색 결과 데이터'만을 바탕으로 글을 써야 해.**
    2. **검색된 데이터가 있는 주제에 대해서만 2~3개의 소제목으로 나눠서 깊이 있게 분석해.**
    3. **절대 '데이터가 없다', '찾아보지 못했다', '제공된 정보에는 없지만' 같은 무책임한 말은 쓰지 마.**
    4. **네가 받은 데이터 안에서만 완벽한 전문가처럼 글을 완성해.**

    [주제별 실시간 데이터]
    ${combinedContext}

    [작성 가이드라인]
    1. **톤앤매너**:
       - "친구에게 말하듯 편안하고 부드럽게" (딱딱한 뉴스체 절대 금지)
       - "~해요", "~했답니다", "~네요" 등 친근한 종결어미 사용.
       - 독자는 "**투자자 여러분**" 또는 "**구독자님**"으로 호칭.
       - 어려운 경제 용어는 쉽게 풀어써주세요.

    2. **글의 구조**:
       - **제목**: 이모지(☕, 🚀, 📉 등)를 활용한 감성적이고 클릭하고 싶은 제목.
       - **인사말**: 날씨, 계절, 요일 등을 언급하며 가볍게 시작.
       - **본문**: 
         - 위 데이터에서 확인된 **가장 핫한 키워드 2~3개**를 중심으로 소제목(h3)을 달고 깊이 있게 작성하세요.
         - 각 섹션마다 구체적인 수치나 사실을 언급하며 전문성을 보여주세요.
       - **마무리**: 오늘도 화이팅! 하는 따뜻한 격려 메시지.
       - **참고 자료**: 글 맨 마지막에 **## 참고 자료** 섹션을 만들고, 본문에 인용된 모든 기사의 제목과 URL을 리스트로 정리해주세요.

    3. **형식**: JSON으로 반환해주세요.
       - title: (문자열) 생성된 제목
       - content: (문자열) HTML 태그가 포함된 본문 내용 (h2, h3, p, ul, li, strong, a 태그 등 활용. 스타일 속성은 제외)

    JSON 예시:
    {
      "title": "☕ 흑흑이의 모닝 브리핑: 엔비디아 질주, 어디까지?",
      "content": "<h2>안녕하세요, 구독자님! 흑흑이입니다.</h2><p>오늘 아침 뉴욕 증시가 뜨거웠네요...</p><h3>🚀 엔비디아, 또 사상 최고가 경신!</h3><p>엔비디아가 어제 밤사이...</p>..."
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

