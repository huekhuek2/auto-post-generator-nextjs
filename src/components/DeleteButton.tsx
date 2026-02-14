'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ id }: { id: number }) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        // 1. Ask for Password
        const password = window.prompt("관리자 비밀번호를 입력하세요:", "");
        if (!password) return;

        if (!confirm("정말 이 글을 삭제하시겠습니까? 돌이킬 수 없습니다.")) return;

        setIsDeleting(true);

        try {
            const res = await fetch('/api/delete-post', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, password }),
            });

            const data = await res.json();

            if (res.ok) {
                alert('삭제되었습니다.');
                router.push('/'); // Redirect to home
                router.refresh(); // Refresh to update list
            } else {
                alert(`삭제 실패: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
            title="관리자 전용 삭제"
        >
            {isDeleting ? '삭제 중...' : '글 삭제'}
        </button>
    );
}
