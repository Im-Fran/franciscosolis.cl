import { useHead } from "unhead";

const Home = () => {
  useHead({
    title: 'Home',
  });

  return <>
    <div className={"flex flex-col"}>
      <h1 className={"mb-2.5 text-4xl font-bold"}>Home</h1>
      <span className={"text-md"}>Hello, World!</span>
    </div>
  </>;
};

export default Home;
