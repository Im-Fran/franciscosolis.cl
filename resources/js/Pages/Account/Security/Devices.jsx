import { Inertia } from '@inertiajs/inertia';

import { ComputerDesktopIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import RelativeTime from "@/js/Components/RelativeTime";
import AccountLayout from "@/js/Layouts/AccountLayout";
import Table from '@/js/Components/Table/Table';
import Column from '@/js/Components/Table/Column';
import Row from '@/js/Components/Table/Row';
import RowItem from '@/js/Components/Table/RowItem';

export default function Devices({ sessions }) {
    const meta = [
        { property: 'og:title', content: 'Account > Security > Login & Sessions | FranciscoSolis' },
    ];

    const logout = (e, session_id) => {
        e.stopPropagation()
        e.preventDefault()

        Inertia.post(route('account.security.access.devices.delete'), {
            _method: 'DELETE',
            session_id: session_id,
         }, {
            preserveScroll: true,
        });
    };

    return (
        <AccountLayout title="Security > Devices" meta={meta}>
            <div className="flex flex-col w-full items-start mb-5">
                <h2 className="text-xl">Devices</h2>
                <hr className="w-1/4 border-0 border-t-2 border-gray-500 mb-10"/>

                <div className="flex flex-col w-full">
                    <div className="overflow-x-auto bg-white rounded-lg shadow overflow-y-auto relative">
                        <Table>
                            <Table.Columns>
                                <Column>Device</Column>
                                <Column>Last Used</Column>
                                <Column>IP Address</Column>
                                <Column>Location</Column>
                                <Column>Browser</Column>
                                <Column>Actions</Column>
                            </Table.Columns>
                            <Table.Rows>
                                {sessions.map((session) => (
                                    <Row key={session.id}>
                                        <RowItem>
                                            <span className="flex">
                                                {session.agent.type === 'Desktop' && <ComputerDesktopIcon className="w-6 h-6" />}
                                                {session.agent.type === 'Mobile' && <DevicePhoneMobileIcon className="w-6 h-6" />}
                                                &nbsp;
                                                {session.agent.type}&nbsp;({session.agent.platform})
                                            </span>
                                        </RowItem>
                                        <RowItem><RelativeTime date={session.last_used_at} /></RowItem>
                                        <RowItem>{session.ip_address}</RowItem>
                                        <RowItem>{session.location}</RowItem>
                                        <RowItem>{session.agent.browser}</RowItem>
                                        <RowItem>
                                            <button onClick={(e) => logout(e, session.id)} className="bg-brand-200 bg-opacity-75 hover:bg-opacity-100 text-white font-bold py-2 px-4 rounded">
                                                Logout
                                            </button>
                                        </RowItem>
                                    </Row>
                                ))}
                            </Table.Rows>
                        </Table>
                    </div>
                </div>

                {/* Log out of all devices but this one */}
                <div className="flex flex-col w-full items-end mt-10">
                    <div className="flex">
                        <button onClick={(e) => logout(e, 'all')} className="bg-brand-200 bg-opacity-75 hover:bg-opacity-100 text-white font-bold py-2 px-4 rounded">
                            Log out of all devices
                        </button>
                    </div>
                </div>
            </div>
        </AccountLayout>
    );
}
