export default function Column({ children, content, className = '' }) {
    return (
        <th className={"py-2 px-6 sticky top-0 border-b border-gray-200 bg-gray-100 dark:bg-zinc-800 " + className}>{ content || children || '' }</th>
    )
}
