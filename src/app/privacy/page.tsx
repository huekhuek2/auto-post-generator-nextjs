
export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-8 prose prose-slate">
            <h1>개인정보처리방침 (Privacy Policy)</h1>
            <p>본 개인정보처리방침은 '오전 8시 뉴스레터'(이하 "본 사이트")가 이용자의 개인정보를 어떻게 수집, 사용, 보호하는지에 대해 설명합니다.</p>

            <h2>1. 수집하는 정보</h2>
            <p>본 사이트는 뉴스레터 구독, 문의 등의 목적으로 이메일 주소, 이름 등의 개인정보를 수집할 수 있습니다. 또한, 웹사이트 방문 시 쿠키(Cookie) 및 로그 파일이 자동으로 수집될 수 있습니다.</p>

            <h2>2. 쿠키(Cookie) 및 광고</h2>
            <p>본 사이트는 사용자 경험 개선 및 광고 제공을 위해 쿠키를 사용합니다.</p>
            <ul>
                <li><strong>Google AdSense 및 DoubleClick DART 쿠키</strong>: 본 사이트는 광고 수익 창출을 위해 Google AdSense를 사용합니다. Google은 제3자 벤더로서 쿠키를 사용하여 사용자가 본 사이트 및 다른 웹사이트를 방문한 기록을 바탕으로 맞춤형 광고를 제공할 수 있습니다.</li>
                <li><strong>DART 쿠키 거부</strong>: 사용자는 <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Google 광고 및 콘텐츠 네트워크 개인정보처리방침</a>을 방문하여 DART 쿠키 사용을 거부할 수 있습니다.</li>
            </ul>

            <h2>3. 제3자 광고 파트너</h2>
            <p>Google을 포함한 제3자 광고 파트너는 사용자의 관심사에 맞는 광고를 제공하기 위해 쿠키 및 웹 비콘을 사용할 수 있습니다. 이러한 제3자 광고 서버는 본 사이트의 개인정보처리방침과 별도로 운영되므로, 각 파트너사의 정책을 확인하시기 바랍니다.</p>

            <h2>4. 개인정보의 보호</h2>
            <p>본 사이트는 이용자의 개인정보를 안전하게 보호하기 위해 합리적인 보안 조치를 취하고 있습니다. 법적 요구가 있는 경우를 제외하고 이용자의 동의 없이 제3자에게 개인정보를 제공하지 않습니다.</p>

            <h2>5. 문의하기</h2>
            <p>본 개인정보처리방침에 대해 궁금한 점이 있으시면 아래 이메일로 문의해 주세요.</p>
            <p>이메일: <a href="mailto:huekhuek1121@gmail.com">huekhuek1121@gmail.com</a></p>

            <p className="text-sm text-gray-500 mt-8">최종 수정일: {new Date().toLocaleDateString()}</p>
        </div>
    );
}
