import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'

export function RichContent({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[
                rehypeRaw,
                rehypeKatex,
            ]}
        >
            {content}
        </ReactMarkdown>
    )
}