import Wave from "@/icons/Wave";
import TypeAnimation from "@/components/TypeAnimation";

const Home = () => <div class={"flex flex-col items-center justify-center min-h-screen"}>
    <div class={"flex items-center gap-5"}>
        <Wave class={"h-16 w-16"}/>
        <h2 class={"text-6xl"}>Hello! I&apos;m Fran</h2>
    </div>

    <h4 class={"flex items-center text-4xl mt-2.5"}>FullStack Developer</h4>
    <div class={"flex items-center text-4xl"}>
        Currently working with
        &nbsp;
        <TypeAnimation
            preRenderFirstString={true}
            sequence={[
                'Laravel', 3000,
                'Swift', 3000,
                'SwiftUI', 3000,
                'KOT', 250,
                'Kotlin', 3000,
                'ReactJs', 250,
                'ReactJS', 3000,
            ]}
            infinite={true}
            writingSpeed={80}
            deletionSpeed={150}
            style={{display: 'inline-block'}}
            class={"type"}
        />

    </div>
</div>

export default Home;