"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualTrigger() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGenerate = async () => {
        const password = prompt("관리자 암호(CRON_SECRET)를 입력하세요:");
        if (!password) return;

        setLoading(true);
        try {
            const res = await fetch("/api/auto-post", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${password}`,
                },
            });

            const data = await res.json();

            if (res.ok) {
                alert("✅ 뉴스레터 생성 성공! (페이지가 새로고침됩니다)");
                router.refresh();
            } else {
                alert(`❌ 생성 실패: ${data.error || "알 수 없는 오류"}`);
            }
        } catch (error) {
            console.error(error);
            alert("❌ 네트워크 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        생성 중...
                    </>
                ) : (
                    <>
                        <span>⚡ 수동 생성</span>
                    </>
                )}
            </button>
        </div>
    );
}
