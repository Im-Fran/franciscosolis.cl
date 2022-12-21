export default function Row({ children, className = '' }) {
    return (<tr className={"hover:bg-gray-100 dark:hover:bg-neutral-700 border-b border-gray-200 py-10 " + className}>{children}</tr>);
}
