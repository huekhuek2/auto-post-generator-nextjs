import { sql } from "@vercel/postgres";
import Link from "next/link";

export const dynamic = 'force-dynamic';

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: Date;
}

export default async function Home() {
  let posts: Post[] = [];
  try {
    const { rows } = await sql<Post>`SELECT * FROM posts ORDER BY created_at DESC`;
    posts = rows;
  } catch (error) {
    console.error("Database Error:", error);
    // Handle case where table doesn't exist or DB connection fails
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-4">
            오전 8시 뉴스레터
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            매일 아침 8시, 당신에게 필요한 경제 뉴스를 배달합니다.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500 dark:text-gray-400">No posts found. Generate one via API!</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="group h-full">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden h-full flex flex-col transform transition duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl border border-gray-100 dark:border-gray-700">
                  <div className="p-8 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                        ANALYSIS
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(post.created_at))}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 line-clamp-4 leading-relaxed mb-4 flex-1">
                      {post.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
                    </p>
                    <div className="flex items-center text-blue-600 dark:text-blue-400 font-semibold mt-auto">
                      Read Full Analysis
                      <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
