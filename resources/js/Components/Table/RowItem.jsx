export default function RowItem({ children, content, className = '' }) {
    return (<td className={"py-2 px-6 " + className}>{ content || children || '' }</td>)
}
