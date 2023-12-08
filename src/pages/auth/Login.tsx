import { HiSolidCheckBadge } from 'solid-icons/hi'
import Layout from "@/layouts/Layout";

const BadgedText = ({title, description}: { title: string, description: string}) => <div class={"flex items-start justify-start gap-2.5"}>
    <HiSolidCheckBadge class={"text-primary w-10 h-10"}/>
    <div class={"flex flex-col items-start justify-center"}>
        <h1 class={"text-2xl font-bold"}>{title}</h1>
        <span class={"text-md text-neutral-800 dark:text-neutral-400"}>{description}</span>
    </div>
</div>

const Login = () => <Layout class={"container mx-auto justify-start"}>
    <div class={"grid grid-cols-2 gap-10 w-full my-20"}>
        <div class={"col-span-1"}>
            <div class={"flex flex-col justify-start items-start gap-10"}>
                <BadgedText title={"Access to the whole site!"} description={"Get access to the whole site and features that require an account."}/>
                <BadgedText title={"Stay up to date"} description={"Be the first to try out new features! We promise to not send spam ;)"}/>
                <BadgedText title={"No card required!"} description={"You don't need a credit card to register to the site!"}/>
            </div>
        </div>
        <div class={"col-span-1 flex flex-col items-center justify-center shadow-2xl rounded-lg p-5 border border-gray-500 bg-neutral-100 dark:bg-neutral-700"}>
            <h1 class={"text-2xl font-bold text-center w-full"}>Welcome</h1>
            <h3 class={"text-lg text-center w-full"}>Please enter your email to continue</h3>

            <div class={"flex flex-col items-center justify-center gap-5 w-full mt-5"}>
                <div class="form-control w-full max-w-sm">
                    <label class={"label"}>
                        <span class={"label-text"}>Email:</span>
                    </label>
                    <input
                        type={"text"}
                        placeholder={"john.doe@example.com"}
                        class={"input input-bordered w-full max-w-sm"}
                    />
                    <label class={"label"}>
                        <span class={"label-text-alt"}>Please type in your email</span>
                    </label>
                </div>
            </div>
        </div>
    </div>
</Layout>

export default Login;