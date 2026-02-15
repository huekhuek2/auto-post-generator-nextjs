
function testDayLogic(mockDateString) {
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    // Mock current time
    const now = new Date(mockDateString);
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const isSaturday = dayOfWeek === 6;

    console.log(`\n--- Testing Date: ${mockDateString} (Day: ${dayOfWeek}, IsSaturday: ${isSaturday}) ---`);

    let keywords = [];
    let sortOption = 'date';
    let promptType = '';

    if (isSaturday) {
        console.log('Mode: Saturday Weekly Briefing');
        const baseKeywords = ['이번 주 증시 요약', '한 주간 주요 경제 뉴스', '주간 증시 전망', '이번 주 비트코인 흐름'];
        keywords = baseKeywords.map(k => `${k} ${today}`);
        sortOption = 'sim';
        promptType = 'Weekly';
    } else {
        console.log('Mode: Daily News Briefing');
        const baseKeywords = ['코스피', '미국 증시', '삼성전자', '비트코인', '경제 뉴스'];
        keywords = baseKeywords.map(k => `${k} ${today}`);
        sortOption = 'date';
        promptType = 'Daily';
    }

    console.log(`Keywords: ${keywords.join(', ')}`);
    console.log(`Sort Option: ${sortOption}`);
    console.log(`Prompt Type: ${promptType}`);
}

// Test Case 1: Saturday (e.g., 2026-02-14)
testDayLogic('2026-02-14T10:00:00+09:00');

// Test Case 2: Tuesday (e.g., 2026-02-17)
testDayLogic('2026-02-17T10:00:00+09:00');

// Test Case 3: Sunday (e.g., 2026-02-15)
testDayLogic('2026-02-15T10:00:00+09:00');
