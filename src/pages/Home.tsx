import Wave from "@/icons/Wave";
import TypeAnimation from "@/components/TypeAnimation";
import Layout from "@/layouts/Layout";
import Button from "@/components/Button";
import {A} from "@solidjs/router";

const Home = () => <Layout class={"items-center justify-center"}>
    <div class={"flex items-center gap-5"}>
        <Wave class={"h-16 w-16"}/>
        <h2 class={"text-6xl"}>Hello! I&apos;m Fran</h2>
    </div>

    <h4 class={"flex items-center text-4xl mt-2.5"}>FullStack Developer</h4>
    <div class={"flex items-center text-4xl gap-2"}>
        <span>Currently</span>
        <span>
            <TypeAnimation
                sequence={[
                    'using Laravel', 3000,
                    'using SolidJS', 3000,
                    'coding in Swift', 3000,
                    'using SwiftUI', 3000,
                    'coding in KOT', 250,
                    'coding in Kotlin', 2000,
                    'coding in Kotlin (also Java)', 3000,
                    'coding in htm', 200,
                    'coding in HTML', 3000,
                    'coding in CSS', 3000,
                    'coding in JavaSCR', 200,
                    'coding in JavaScript', 3000,
                ]}
                infinite={true}
                style={{display: 'inline-block'}}
            />
        </span>
    </div>

    <div class={"mt-2.5"}>
        <A href={'/login'}>
            <Button size={"xl"}>Authenticate</Button>
        </A>
    </div>
</Layout>

export default Home;