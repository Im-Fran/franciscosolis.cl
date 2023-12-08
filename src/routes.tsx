import {Router, useRoutes} from "@solidjs/router";
import {lazy} from "solid-js";

const Routes = useRoutes([
  {
    path: '/',
    component: lazy(() => import('@/pages/Home'))
  },
  {
    path: '/auth',
    children: [
      {
        path: '/login',
      }
    ]
  }
])


export default function () {
  return <Router>
    <Routes/>
  </Router>
}