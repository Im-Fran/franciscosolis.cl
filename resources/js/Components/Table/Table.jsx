import { Component as ReactComponent } from 'react'

function Columns() {
    return null;
}

function Rows() {
    return null;
}

class Table extends ReactComponent {
    static Columns = Columns;
    static Rows = Rows;

    render() {
        const { children, className = '' } = this.props;
        const columns = children.find(child => child.type === Columns);
        const rows = children.find(child => child.type === Rows);

        return (
            <table className={"border-collapse table-auto w-full whitespace-no-wrap bg-white dark:bg-brand-500 table-striped relative " + className}>
                <thead>
                    <tr className="text-left">
                        {columns ? columns.props.children : <></>}
                    </tr>
                </thead>
                <tbody>
                    {rows ? rows.props.children : <></>}
                </tbody>
            </table>
        );
    }
}

export default Table;
