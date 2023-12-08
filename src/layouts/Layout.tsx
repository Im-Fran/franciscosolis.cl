const Layout = ({children, ...rest}) => <div {...rest} class={`flex flex-col min-h-screen w-full ${rest.class || ''}`}>
    {children}
</div>;

export default Layout;