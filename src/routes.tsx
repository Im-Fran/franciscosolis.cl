import {Router, useRoutes} from "@solidjs/router";
import {lazy} from "solid-js";

const Routes = useRoutes([
    {
        path: '/',
        component: lazy(() => import('@/pages/Home'))
    },

    /* Auth */
    {
        path: '/login',
        component: lazy(() => import('@/pages/auth/Login'))
    }
])


export default function () {
    return <Router>
        <Routes/>
    </Router>
}